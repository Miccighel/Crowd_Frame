/* =============================================================================
 * GeneratorComponent – cache-first batches + horizontal stepper + tidy clone UI
 * Perf: OnPush CD, runOutsideAngular for heavy work, debounced filter, trackBy
 * ============================================================================= */

import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    NgZone,
    OnDestroy,
    ViewChild
} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup} from '@angular/forms';
import {MatStepper} from '@angular/material/stepper';

/* Services */
import {S3Service, S3Config} from '../../services/aws/s3.service';
import {ConfigService} from '../../services/config.service';
import {LocalStorageService} from '../../services/localStorage.service';

/* Models */
import {AngularEditorConfig} from '@kolkov/angular-editor';

/* Step Components */
import {WorkerChecksStepComponent} from './generator-steps/worker-checks-step/worker-checks-step.component';
import {QuestionnaireStepComponent} from './generator-steps/questionnaire-step/questionnaire-step.component';
import {InstructionsGeneralStep} from './generator-steps/instructions-general-step/instructions-general-step.component';
import {SearchEngineStepComponent} from './generator-steps/search-engine-step/search-engine-step.component';
import {DimensionsStepComponent} from './generator-steps/dimensions-step/dimensions-step.component';
import {TaskSettingsStepComponent} from './generator-steps/task-settings-step/task-settings-step.component';

import {Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, takeUntil} from 'rxjs/operators';

type BatchNode = { batch: string; whitelist: boolean; blacklist: boolean; id: number };
type TaskNode = { task: string; batches: BatchNode[] };
type BatchesCache = { ts: number; tree: TaskNode[] };

@Component({
    selector: 'app-generator',
    templateUrl: './generator.component.html',
    styleUrls: ['./generator.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class GeneratorComponent implements OnDestroy {

    /* ---------- STEP #1 - Questionnaires ---------- */
    @ViewChild(QuestionnaireStepComponent) questionnaireStep!: QuestionnaireStepComponent;
    questionnaireStepForm!: UntypedFormGroup;

    /* ---------- STEP #2 - Dimensions ---------- */
    @ViewChild(DimensionsStepComponent) dimensionsStep!: DimensionsStepComponent;
    dimensionsStepForm!: UntypedFormGroup;

    /* ---------- STEP #3 - General Instructions ---------- */
    @ViewChild('generalInstructions') generalInstructionsStep!: InstructionsGeneralStep;
    generalInstructionsStepForm!: UntypedFormGroup;

    /* ---------- STEP #4 - Evaluation Instructions ---------- */
    @ViewChild('evaluationInstructions') evaluationInstructionsStep!: InstructionsGeneralStep;
    evaluationInstructionsStepForm!: UntypedFormGroup;

    /* ---------- STEP #5 - Search Engine ---------- */
    @ViewChild(SearchEngineStepComponent) searchEngineStep!: SearchEngineStepComponent;
    searchEngineStepForm!: UntypedFormGroup;

    /* ---------- STEP #6 - Task Settings ---------- */
    @ViewChild(TaskSettingsStepComponent) taskSettingsStep!: TaskSettingsStepComponent;
    taskSettingsStepForm!: UntypedFormGroup;
    @Input() taskModality!: string;

    /* ---------- STEP #7 - Worker Checks ---------- */
    @ViewChild(WorkerChecksStepComponent) workerChecksStep!: WorkerChecksStepComponent;
    workerChecksStepForm!: UntypedFormGroup;

    /* ---------- SERVICES ---------- */
    private destroy$ = new Subject<void>();

    constructor(
        private readonly changeDetector: ChangeDetectorRef,
        private readonly configService: ConfigService,
        private readonly S3Service: S3Service,
        private readonly localStorageService: LocalStorageService,
        private readonly ngZone: NgZone
    ) {
        /* Keep originals for restore */
        this.configService.environment['taskNameInitial'] = this.configService.environment['taskName'];
        this.configService.environment['batchNameInitial'] = this.configService.environment['batchName'];

        /* Watch filter changes */
        this.batchFilterCtrl.valueChanges
            .pipe(debounceTime(150), distinctUntilChanged(), takeUntil(this.destroy$))
            .subscribe(term => {
                this.applyBatchesFilter(term ?? '');
                this.changeDetector.markForCheck();
            });

        void this.performGeneratorSetup();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /* ---------- BATCH TREE STATE ---------- */
    batchCloned: UntypedFormControl = new UntypedFormControl();
    taskCloned = false;

    /** Raw tree from S3 */
    batchesTree: TaskNode[] = [];

    /** Filtered view bound to the select */
    filteredBatchesTree: TaskNode[] = [];

    batchesTreeInitialization = false;
    public showBatchesToolbar = true;

    /** filter input */
    batchFilterCtrl: UntypedFormControl = new UntypedFormControl('');
    totalTasks = 0;
    totalBatches = 0;
    filteredBatches = 0;

    /* Stepper ref */
    @ViewChild('generator') generator!: MatStepper;

    /* Rich text editor config */
    editorConfig: AngularEditorConfig = {
        editable: true,
        spellcheck: true,
        height: 'auto',
        minHeight: '0',
        maxHeight: 'auto',
        width: 'auto',
        minWidth: '0',
        translate: 'yes',
        enableToolbar: true,
        showToolbar: true,
        placeholder: 'Enter text here...',
        defaultParagraphSeparator: '',
        defaultFontName: '',
        defaultFontSize: '',
        fonts: [
            {class: 'arial', name: 'Arial'},
            {class: 'times-new-roman', name: 'Times New Roman'},
            {class: 'calibri', name: 'Calibri'},
        ],
        customClasses: [
            {name: 'Yellow Highlight', class: 'highlight-yellow'},
            {name: 'Green Highlight', class: 'highlight-green'},
            {name: 'Orange Highlight', class: 'highlight-orange'}
        ],
        sanitize: true,
        toolbarPosition: 'top',
        toolbarHiddenButtons: [
            [], ['insertImage', 'insertVideo']
        ]
    };

    /* Cache key (localStorage) — single key, no separate “meta” entry */
    private static readonly BATCHES_CACHE_KEY = 'batches-tree.v3'; // { ts:number, tree:TaskNode[] }
    private static readonly BATCHES_TTL_MS = 5 * 60 * 1000; /* 5 minutes */

    /* ---------------------------------- Cache helpers ---------------------------------- */
    private readBatchesCache(): BatchesCache | null {
        const raw = this.localStorageService.getItem(GeneratorComponent.BATCHES_CACHE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.ts === 'number' && Array.isArray(parsed?.tree)) {
                return parsed as BatchesCache;
            }
        } catch { /* ignore */ }
        return null;
    }

    private writeBatchesCache(tree: TaskNode[]): void {
        const payload: BatchesCache = { ts: Date.now(), tree };
        this.localStorageService.setItem(GeneratorComponent.BATCHES_CACHE_KEY, JSON.stringify(payload));
    }

    private isCacheFresh(ts: number | null, ttlMs = GeneratorComponent.BATCHES_TTL_MS): boolean {
        return ts !== null && (Date.now() - ts) < ttlMs;
    }

    private evictBatchesCache(): void {
        this.localStorageService.removeItem(GeneratorComponent.BATCHES_CACHE_KEY);
    }

    /* ---------------------------------- Setup ---------------------------------- */
    private async safeInit(step: any, label: string) {
        if (!step || typeof step.ngOnInit !== 'function') return;
        try {
            const maybe = step.ngOnInit();
            if (maybe && typeof maybe.then === 'function') await maybe;
        } catch (err) {
            console.warn(`[generator] init skipped for "${label}" due to error:`, err);
        }
    }

    public async performGeneratorSetup() {
        const env = this.configService.environment as S3Config;

        let differentTask = false;
        let t = this.localStorageService.getItem('task-name');
        if (t) {
            t = t.replace(/"/g, '');
            if (t !== env.taskName) differentTask = true;
        } else {
            this.localStorageService.setItem('task-name', JSON.stringify(env.taskName));
        }

        let differentBatch = false;
        let b = this.localStorageService.getItem('batch-name');
        if (b) {
            b = b.replace(/"/g, '');
            if (b !== env.batchName) differentBatch = true;
        } else {
            this.localStorageService.setItem('batch-name', JSON.stringify(env.batchName));
        }

        if (differentTask || differentBatch) {
            this.evictBatchesCache();
            this.localStorageService.setItem('task-name', JSON.stringify(env.taskName));
            this.localStorageService.setItem('batch-name', JSON.stringify(env.batchName));
        }

        await this.loadBatchesTree(); /* cache-first + revalidate if stale */
    }

    /* ---------------------------------- Data loading ---------------------------------- */
    async loadBatchesTree(forceNetwork = false) {
        this.batchesTreeInitialization = false;
        this.changeDetector.markForCheck();

        const cached = this.readBatchesCache();
        const fresh = this.isCacheFresh(cached?.ts ?? null);

        if (!forceNetwork && cached) {
            this.setBatchesTree(cached.tree);
            this.batchesTreeInitialization = true;
            this.changeDetector.markForCheck();

            if (fresh) return; // up-to-date
        }

        try {
            const env = this.configService.environment as S3Config;

            // All S3 calls are read-only and optional; empty buckets are handled gracefully.
            const tasksRaw: any[] = await this.S3Service.listFolders(env).catch(() => []) ?? [];

            // Try to read worker settings; if missing (e.g., after a fresh deploy), default to empty.
            const workerSettingsRaw = await this.S3Service.downloadWorkers(env).catch(() => null as any);
            const workerSettings = {
                blacklist_batches: Array.isArray(workerSettingsRaw?.blacklist_batches) ? workerSettingsRaw.blacklist_batches : [],
                whitelist_batches: Array.isArray(workerSettingsRaw?.whitelist_batches) ? workerSettingsRaw.whitelist_batches : [],
            };
            const blacklistSet = new Set(workerSettings.blacklist_batches);
            const whitelistSet = new Set(workerSettings.whitelist_batches);

            // Build the tree outside Angular to avoid extra change detection passes
            const tree: TaskNode[] = await this.ngZone.runOutsideAngular(async () => {
                const perTaskResults = await Promise.all(
                    tasksRaw.map(async (task: any) => {
                        const taskPrefix = task['Prefix'];
                        const batches = await this.S3Service
                            .listFolders(env, taskPrefix)
                            .catch(() => []) ?? [];
                        return ({ taskPrefix, batches });
                    })
                );

                let counter = 0;
                return perTaskResults.map(({ taskPrefix, batches }) => ({
                    task: taskPrefix,
                    batches: batches.map((b: any) => {
                        const batchPrefix = b['Prefix'];
                        return {
                            batch: batchPrefix,
                            blacklist: blacklistSet.has(batchPrefix),
                            whitelist: whitelistSet.has(batchPrefix),
                            id: counter++,
                        } as BatchNode;
                    }),
                })) as TaskNode[];
            });

            this.setBatchesTree(tree);
            this.writeBatchesCache(tree);

        } finally {
            this.batchesTreeInitialization = true;
            this.changeDetector.markForCheck();
        }
    }

    private setBatchesTree(tree: TaskNode[]): void {
        this.batchesTree = tree ?? [];
        this.totalTasks = this.batchesTree.length;
        this.totalBatches = this.batchesTree.reduce((sum, t) => sum + (t?.batches?.length ?? 0), 0);
        this.applyBatchesFilter(this.batchFilterCtrl.value ?? '');
    }

    private applyBatchesFilter(term: string): void {
        const q = (term || '').toLowerCase().trim();
        if (!q) {
            this.filteredBatchesTree = this.batchesTree;
            this.filteredBatches = this.totalBatches;
            return;
        }
        const filtered: TaskNode[] = [];
        for (const t of this.batchesTree) {
            const batches = (t.batches || []).filter(b =>
                t.task.toLowerCase().includes(q) ||
                b.batch.toLowerCase().includes(q)
            );
            if (batches.length) filtered.push({ task: t.task, batches });
        }
        this.filteredBatchesTree = filtered;
        this.filteredBatches = filtered.reduce((sum, t) => sum + t.batches.length, 0);
    }

    /* ---------------------------------- Clone / Restore ---------------------------------- */
    async clonePreviousBatch(data: any) {
        try {
            const selected = data?.value ?? '';
            let taskName: string | null = null;
            let batchName: string | null = null;

            for (const taskNode of this.batchesTree ?? []) {
                for (const batchNode of (taskNode as any)['batches'] ?? []) {
                    if (batchNode['batch'] === selected) {
                        taskName = (taskNode as any)['task'];
                        batchName = batchNode['batch'];
                        break;
                    }
                }
                if (taskName) break;
            }
            if (!taskName || !batchName) return;

            const tName = String(taskName).replace(/\/$/, '');
            const bName = String(batchName).replace(/\/$/, '').replace(tName + '/', '');

            this.configService.environment['taskName'] = tName;
            this.configService.environment['batchName'] = bName;

            this.taskCloned = true;
            this.batchesTreeInitialization = false;

            await this.performGeneratorSetup();

            await this.safeInit(this.questionnaireStep, 'questionnaire');
            await this.safeInit(this.dimensionsStep, 'dimensions');
            await this.safeInit(this.generalInstructionsStep, 'instructions-general');
            await this.safeInit(this.evaluationInstructionsStep, 'instructions-evaluation');
            await this.safeInit(this.searchEngineStep, 'search-engine');
            await this.safeInit(this.taskSettingsStep, 'task-settings');
            await this.safeInit(this.workerChecksStep, 'worker-checks');
        } finally {
            this.changeDetector.markForCheck();
        }
    }

    async restoreGenerator() {
        try {
            this.generator.selectedIndex = 1;
            this.batchCloned = new UntypedFormControl();
            this.localStorageService.clear();

            this.configService.environment['taskName'] = this.configService.environment['taskNameInitial'];
            this.configService.environment['batchName'] = this.configService.environment['batchNameInitial'];

            this.taskCloned = true;
            this.batchesTreeInitialization = false;

            await this.performGeneratorSetup();

            await this.safeInit(this.questionnaireStep, 'questionnaire');
            await this.safeInit(this.dimensionsStep, 'dimensions');
            await this.safeInit(this.generalInstructionsStep, 'instructions-general');
            await this.safeInit(this.evaluationInstructionsStep, 'instructions-evaluation');
            await this.safeInit(this.searchEngineStep, 'search-engine');
            await this.safeInit(this.taskSettingsStep, 'task-settings');
            await this.safeInit(this.workerChecksStep, 'worker-checks');
        } finally {
            this.changeDetector.markForCheck();
        }
    }

    /* ---------------------------------- Store APIs ---------------------------------- */
    public storeQuestionnaireForm(data: UntypedFormGroup) {
        this.questionnaireStepForm = data;
    }

    public storeGeneralInstructionsForm(data: UntypedFormGroup) {
        this.generalInstructionsStepForm = data;
    }

    public storeDimensionsForm(data: UntypedFormGroup) {
        this.dimensionsStepForm = data;
    }

    public storeEvaluationInstructionsForm(data: UntypedFormGroup) {
        this.evaluationInstructionsStepForm = data;
    } // alias

    public storeSearchEngineStepForm(data: UntypedFormGroup) {
        this.searchEngineStepForm = data;
    }

    public storeTaskSettingsForm(data: UntypedFormGroup) {
        this.taskSettingsStepForm = data;
    }

    public storeWorkerChecksForm(data: UntypedFormGroup) {
        this.workerChecksStepForm = data;
    }

    public storeTaskModality(data: string) {
        this.taskModality = data;
    }

    /* ---------------------------------- Template helpers ---------------------------------- */
    public batchLabel(taskPrefix: string, batchPrefix: string): string {
        let label = batchPrefix.startsWith(taskPrefix) ? batchPrefix.slice(taskPrefix.length) : batchPrefix;
        if (label.endsWith('/')) label = label.slice(0, -1);
        return label;
    }

}
