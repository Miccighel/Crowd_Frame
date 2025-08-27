/* Core */
import {ChangeDetectorRef, Component, Input, ViewChild} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup} from '@angular/forms';

/* Material Design */
import {MatStepper} from "@angular/material/stepper";

/* Services */
import {NgxUiLoaderService} from "ngx-ui-loader";
import {S3Service} from "../../services/aws/s3.service";
import {ConfigService} from "../../services/config.service";
import {UtilsService} from "../../services/utils.service";
import {LocalStorageService} from '../../services/localStorage.service';

/* Models */
import {AngularEditorConfig} from "@kolkov/angular-editor";

/* Components */
import {WorkerChecksStepComponent} from "./generator-steps/worker-checks-step/worker-checks-step.component";
import {QuestionnaireStepComponent} from "./generator-steps/questionnaire-step/questionnaire-step.component";
import {InstructionsGeneralStep} from "./generator-steps/instructions-general-step/instructions-general-step.component";
import {SearchEngineStepComponent} from "./generator-steps/search-engine-step/search-engine-step.component";
import {DimensionsStepComponent} from "./generator-steps/dimensions-step/dimensions-step.component";
import {TaskSettingsStepComponent} from "./generator-steps/task-settings-step/task-settings-step.component";

/* Component HTML Tag definition */
@Component({
    selector: 'app-generator',
    templateUrl: './generator.component.html',
    styleUrls: ['./generator.component.scss'],
    standalone: false
})
export class GeneratorComponent {

    /* ---------- STEP #1 - Questionnaires ---------- */
    @ViewChild(QuestionnaireStepComponent) questionnaireStep: QuestionnaireStepComponent;
    questionnaireStepForm: UntypedFormGroup;

    /* ---------- STEP #2 - Dimensions ---------- */
    @ViewChild(DimensionsStepComponent) dimensionsStep: DimensionsStepComponent;
    dimensionsStepForm: UntypedFormGroup;

    /* ---------- STEP #3 - General Instructions ---------- */
    @ViewChild('generalInstructions') generalInstructionsStep: InstructionsGeneralStep;
    generalInstructionsStepForm: UntypedFormGroup;

    /* ---------- STEP #4 - Evaluation Instructions ---------- */
    @ViewChild('evaluationInstructions') evaluationInstructionsStep: InstructionsGeneralStep;
    evaluationInstructionsStepForm: UntypedFormGroup;

    /* ---------- STEP #5 - Search Engine ---------- */
    @ViewChild(SearchEngineStepComponent) searchEngineStep: SearchEngineStepComponent;
    searchEngineStepForm: UntypedFormGroup;

    /* ---------- STEP #6 - Task Settings ---------- */
    @ViewChild(TaskSettingsStepComponent) taskSettingsStep: TaskSettingsStepComponent;
    taskSettingsStepForm: UntypedFormGroup;
    @Input() taskModality: string;

    /* ---------- STEP #7 - Worker Checks ---------- */
    @ViewChild(WorkerChecksStepComponent) workerChecksStep: WorkerChecksStepComponent;
    workerChecksStepForm: UntypedFormGroup;

    /* ---------- SERVICES & CO - DECLARATION ---------- */
    ngxService: NgxUiLoaderService;
    configService: ConfigService;
    S3Service: S3Service;
    localStorageService: LocalStorageService;
    utilsService: UtilsService;
    changeDetector: ChangeDetectorRef;

    /* References to clone a previously deployed batch */
    batchCloned: UntypedFormControl;
    taskCloned: boolean;

    /* References to load deployed tasks names */
    batchesTree: Array<any>;
    batchesTreeInitialization: boolean;

    redraw: boolean;

    /* ---------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------- */
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

    @ViewChild('generator') generator: MatStepper;

    constructor(
        changeDetector: ChangeDetectorRef,
        ngxService: NgxUiLoaderService,
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
        utilsService: UtilsService
    ) {
        /* ---------- Services init ---------- */
        this.ngxService = ngxService;
        this.configService = configService;
        this.S3Service = S3Service;
        this.changeDetector = changeDetector;
        this.localStorageService = localStorageService;
        this.utilsService = utilsService;

        this.ngxService.startLoader('generator-inner');

        this.batchCloned = new UntypedFormControl();
        this.taskCloned = false;

        /* Keep originals for restore */
        this.configService.environment['taskNameInitial'] = this.configService.environment['taskName'];
        this.configService.environment['batchNameInitial'] = this.configService.environment['batchName'];

        this.batchesTreeInitialization = false;

        /* Kick off setup (await inside method) */
        void this.performGeneratorSetup();
    }

    /* Reusable: swallow a step's init errors so missing configs don't crash cloning */
    private async safeInit(step: any, label: string) {
        if (!step || typeof step.ngOnInit !== 'function') return;
        try {
            const maybe = step.ngOnInit();
            if (maybe && typeof maybe.then === 'function') await maybe;
        } catch (err) {
            /* Missing S3 file, malformed JSON, etc. */
            console.warn(`[generator] init skipped for "${label}" due to error:`, err);
        }
    }

    /* Make setup awaitable and keep logic compact */
    public async performGeneratorSetup() {
        let differentTask = false;
        let t = this.localStorageService.getItem('task-name');
        if (t) {
            t = t.replace(/"/g, '');
            if (t !== this.configService.environment.taskName) differentTask = true;
        } else {
            this.localStorageService.setItem('task-name', JSON.stringify(this.configService.environment.taskName));
        }

        let differentBatch = false;
        let b = this.localStorageService.getItem('batch-name');
        if (b) {
            b = b.replace(/"/g, '');
            if (b !== this.configService.environment.batchName) differentBatch = true;
        } else {
            this.localStorageService.setItem('batch-name', JSON.stringify(this.configService.environment.batchName));
        }

        if (differentTask && differentBatch) {
            this.localStorageService.clear();
            /* Re-seed after clear so downstream reads have names */
            this.localStorageService.setItem('task-name', JSON.stringify(this.configService.environment.taskName));
            this.localStorageService.setItem('batch-name', JSON.stringify(this.configService.environment.batchName));
        }

        await this.loadBatchesTree();
    }

    async loadBatchesTree() {
        this.batchesTreeInitialization = false;
        try {
            const cachedRaw = this.localStorageService.getItem('batches-tree');
            const cached = cachedRaw ? JSON.parse(cachedRaw) : null;

            this.batchesTree = [];

            if (cached) {
                this.batchesTree = cached;
            } else {
                /* Safe worker settings: default to empty if file missing */
                let workerSettings: { blacklist_batches: string[]; whitelist_batches: string[] } =
                    {blacklist_batches: [], whitelist_batches: []};
                try {
                    const ws: any = await this.S3Service.downloadWorkers(this.configService.environment);
                    workerSettings = {
                        blacklist_batches: Array.isArray(ws?.blacklist_batches) ? ws.blacklist_batches : [],
                        whitelist_batches: Array.isArray(ws?.whitelist_batches) ? ws.whitelist_batches : [],
                    };
                } catch (_e) {
                    /* NoSuchKey → keep empty defaults */
                }

                /* List tasks & batches; guard arrays */
                const tasks = await this.S3Service.listFolders(this.configService.environment) ?? [];
                let counter = 0;

                for (const task of tasks) {
                    const taskPrefix = task['Prefix']; /* e.g., "TaskA/" */
                    const taskNode: any = {task: taskPrefix, batches: []};

                    const batches = await this.S3Service.listFolders(this.configService.environment, taskPrefix) ?? [];
                    for (const batch of batches) {
                        const batchPrefix = batch['Prefix']; /* e.g., "TaskA/Batch1/" */
                        const node: any = {
                            batch: batchPrefix,
                            blacklist: workerSettings.blacklist_batches.includes(batchPrefix),
                            whitelist: workerSettings.whitelist_batches.includes(batchPrefix),
                            counter: counter++
                        };
                        taskNode.batches.push(node);
                    }

                    this.batchesTree.push(JSON.parse(JSON.stringify(taskNode)));
                }

                this.localStorageService.setItem('batches-tree', JSON.stringify(this.batchesTree));
            }
        } finally {
            this.batchesTreeInitialization = true;
            this.ngxService.stopLoader('generator-inner');
        }
    }

    /* Clone a previously deployed batch; tolerate that some per-step configs may be missing */
    async clonePreviousBatch(data: any) {
        this.ngxService.startLoader('generator-inner');
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

            /* Normalize names inline: strip trailing '/', remove "<taskName>/" prefix from batch */
            const tName = String(taskName).replace(/\/$/, '');
            const bName = String(batchName).replace(/\/$/, '').replace(tName + '/', '');

            this.configService.environment['taskName'] = tName;
            this.configService.environment['batchName'] = bName;

            this.taskCloned = true;
            this.batchesTreeInitialization = false;

            await this.performGeneratorSetup();

            /* Re-init children; swallow step errors so cloning doesn’t break */
            await this.safeInit(this.questionnaireStep, 'questionnaire');
            await this.safeInit(this.dimensionsStep, 'dimensions');
            await this.safeInit(this.generalInstructionsStep, 'instructions-general');
            await this.safeInit(this.evaluationInstructionsStep, 'instructions-evaluation');
            await this.safeInit(this.searchEngineStep, 'search-engine');
            await this.safeInit(this.taskSettingsStep, 'task-settings');
            await this.safeInit(this.workerChecksStep, 'worker-checks');

        } finally {
            this.ngxService.stopLoader('generator-inner');
        }
    }

    async restoreGenerator() {
        this.ngxService.startLoader('generator-inner');
        try {
            this.generator.selectedIndex = 1;
            this.batchCloned = new UntypedFormControl();
            this.localStorageService.clear();

            this.configService.environment['taskName'] = this.configService.environment['taskNameInitial'];
            this.configService.environment['batchName'] = this.configService.environment['batchNameInitial'];

            this.taskCloned = true;
            this.batchesTreeInitialization = false;

            await this.performGeneratorSetup();

            /* Also restore steps safely */
            await this.safeInit(this.questionnaireStep, 'questionnaire');
            await this.safeInit(this.dimensionsStep, 'dimensions');
            await this.safeInit(this.generalInstructionsStep, 'instructions-general');
            await this.safeInit(this.evaluationInstructionsStep, 'instructions-evaluation');
            await this.safeInit(this.searchEngineStep, 'search-engine');
            await this.safeInit(this.taskSettingsStep, 'task-settings');
            await this.safeInit(this.workerChecksStep, 'worker-checks');

        } finally {
            this.ngxService.stopLoader('generator-inner');
        }
    }

    /* ---------- Store APIs (unchanged) ---------- */

    public storeQuestionnaireForm(data: UntypedFormGroup) {
        this.questionnaireStepForm = data;
    }

    public storeGeneralInstructionsForm(data: UntypedFormGroup) {
        this.generalInstructionsStepForm = data;
    }

    public storeDimensionsForm(data: UntypedFormGroup) {
        this.dimensionsStepForm = data;
    }

    public storeEvaluationlInstructionsForm(data: UntypedFormGroup) {
        this.evaluationInstructionsStepForm = data;
    }

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
}
