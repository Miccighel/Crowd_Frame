/* =============================================================================
 * SummaryStepComponent – Perf-tuned summary with short JSON previews
 * ============================================================================ */

import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output
} from '@angular/core';

import {QuestionnaireStepComponent} from "../questionnaire-step/questionnaire-step.component";
import {DimensionsStepComponent} from "../dimensions-step/dimensions-step.component";
import {InstructionsGeneralStep} from "../instructions-general-step/instructions-general-step.component";
import {SearchEngineStepComponent} from "../search-engine-step/search-engine-step.component";
import {TaskSettingsStepComponent} from "../task-settings-step/task-settings-step.component";
import {WorkerChecksStepComponent} from "../worker-checks-step/worker-checks-step.component";

import {S3Service} from 'src/app/services/aws/s3.service';
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";

type PreviewKey =
    | 'questionnaires'
    | 'dimensions'
    | 'general'
    | 'evaluation'
    | 'search'
    | 'task'
    | 'workers'
    | 'hits';

interface PreviewBlock {
    full: string;
    short: string;
    expanded: boolean;
}

@Component({
    selector: 'app-summary-step',
    templateUrl: './summary-step.component.html',
    styleUrls: ['../../generator.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryStepComponent implements OnInit {

    /* ---------- Services ---------- */
    public configService: ConfigService;
    public S3Service: S3Service;
    public localStorageService: LocalStorageService;
    private cdr: ChangeDetectorRef;

    /* ---------- Inputs ---------- */
    @Input() questionnaireStep!: QuestionnaireStepComponent;
    @Input() dimensionsStep!: DimensionsStepComponent;
    @Input() generalInstructionsStep!: InstructionsGeneralStep;
    @Input() evaluationInstructionsStep!: InstructionsGeneralStep;
    @Input() searchEngineStep!: SearchEngineStepComponent;
    @Input() taskSettingsStep!: TaskSettingsStepComponent;
    @Input() workerChecksStep!: WorkerChecksStepComponent;

    /* ---------- Upload state ---------- */
    public uploadStarted = false;
    public uploadCompleted = false;

    /* S3 paths */
    public fullS3Path: string;
    public questionnairesPath: string | null = null;
    public hitsPath: string | null = null;
    public dimensionsPath: string | null = null;
    public taskInstructionsPath: string | null = null;
    public dimensionsInstructionsPath: string | null = null;
    public searchEngineSettingsPath: string | null = null;
    public taskSettingsPath: string | null = null;
    public workerChecksPath: string | null = null;

    /* Preview gate + cache */
    public showRawPreviews = false;
    public previews: Record<PreviewKey, PreviewBlock> = {
        questionnaires: {full: '', short: '', expanded: false},
        dimensions: {full: '', short: '', expanded: false},
        general: {full: '', short: '', expanded: false},
        evaluation: {full: '', short: '', expanded: false},
        search: {full: '', short: '', expanded: false},
        task: {full: '', short: '', expanded: false},
        workers: {full: '', short: '', expanded: false},
        hits: {full: '', short: '', expanded: false}
    };

    @Output() resetEmitter: EventEmitter<boolean>;

    constructor(
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
        cdr: ChangeDetectorRef
    ) {
        this.configService = configService;
        this.S3Service = S3Service;
        this.localStorageService = localStorageService;
        this.cdr = cdr;

        this.fullS3Path =
            `${this.configService.environment.region}/${this.configService.environment.bucket}/` +
            `${this.configService.environment.taskName}/${this.configService.environment.batchName}/`;

        this.resetEmitter = new EventEmitter<boolean>();
    }

    ngOnInit(): void {
    }

    /* ---------- Utils: pretty + short JSON ---------- */

    private normalizePretty(input: unknown): string {
        if (typeof input === 'string') {
            try {
                return JSON.stringify(JSON.parse(input), null, 2);
            } catch {
                return input; // already a string; not JSON
            }
        }
        try {
            return JSON.stringify(input, null, 2);
        } catch {
            return String(input ?? '');
        }
    }

    private makePreview(fullStr: string, maxChars = 600, maxLines = 12): PreviewBlock {
        const lines = fullStr.split('\n');
        let short = lines.slice(0, maxLines).join('\n');
        if (short.length > maxChars) short = short.slice(0, maxChars);
        if (short.length < fullStr.length) short += '\n…';
        return {full: fullStr, short, expanded: false};
    }

    public togglePreviews(checked: boolean): void {
        this.showRawPreviews = checked;
        if (checked) this.refreshPreviews();
        this.cdr.markForCheck();
    }

    public refreshPreviews(): void {
        const q = this.normalizePretty(this.questionnaireStep?.configurationSerialized);
        const d = this.normalizePretty(this.dimensionsStep?.configurationSerialized);
        const g = this.normalizePretty(this.generalInstructionsStep?.configurationSerialized);
        const e = this.normalizePretty(this.evaluationInstructionsStep?.configurationSerialized);
        const s = this.normalizePretty(this.searchEngineStep?.configurationSerialized);
        const t = this.normalizePretty(this.taskSettingsStep?.configurationSerialized);
        const w = this.normalizePretty(this.workerChecksStep?.configurationSerialized);
        const h = this.normalizePretty(this.taskSettingsStep?.hitsParsedString);

        this.previews.questionnaires = this.makePreview(q);
        this.previews.dimensions = this.makePreview(d);
        this.previews.general = this.makePreview(g);
        this.previews.evaluation = this.makePreview(e);
        this.previews.search = this.makePreview(s);
        this.previews.task = this.makePreview(t);
        this.previews.workers = this.makePreview(w);
        this.previews.hits = this.makePreview(h);

        this.cdr.markForCheck();
    }

    public toggleExpand(key: PreviewKey): void {
        this.previews[key].expanded = !this.previews[key].expanded;
        this.cdr.markForCheck();
    }

    public async copyFull(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    /* ---------- Upload logic (unchanged except batching) ---------- */

    public updateFullPath(): void {
        this.fullS3Path = this.S3Service.getTaskDataS3Path(
            this.configService.environment,
            this.configService.environment.taskName,
            this.configService.environment.batchName
        );
        this.cdr.markForCheck();
    }

    private resetEnvNamesToInitial(): void {
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial'];
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial'];
    }

    public async uploadConfiguration(): Promise<void> {
        this.uploadStarted = true;
        this.uploadCompleted = false;
        this.cdr.markForCheck();

        this.resetEnvNamesToInitial();
        const env = this.configService.environment;

        try {
            const results = await Promise.allSettled([
                this.S3Service.uploadQuestionnairesConfig(env, this.questionnaireStep.configurationSerialized),
                this.S3Service.uploadHitsConfig(env, this.taskSettingsStep.hitsParsed),
                this.S3Service.uploadDimensionsConfig(env, this.dimensionsStep.configurationSerialized),
                this.S3Service.uploadTaskInstructionsConfig(env, this.generalInstructionsStep.configurationSerialized),
                this.S3Service.uploadDimensionsInstructionsConfig(env, this.evaluationInstructionsStep.configurationSerialized),
                this.S3Service.uploadSearchEngineSettings(env, this.searchEngineStep.configurationSerialized),
                this.S3Service.uploadTaskSettings(env, this.taskSettingsStep.configurationSerialized),
                this.S3Service.uploadWorkersCheck(env, this.workerChecksStep.configurationSerialized)
            ]);

            const ok = (r: PromiseSettledResult<any>) =>
                r.status === 'fulfilled' && !(r.value && r.value.failed);

            const [q, h, d, ti, di, se, ts, wc] = results;

            this.questionnairesPath = ok(q) ? this.S3Service.getQuestionnairesConfigPath(env) : 'Failure';
            this.hitsPath = ok(h) ? this.S3Service.getHitsConfigPath(env) : 'Failure';
            this.dimensionsPath = ok(d) ? this.S3Service.getDimensionsConfigPath(env) : 'Failure';
            this.taskInstructionsPath = ok(ti) ? this.S3Service.getTaskInstructionsConfigPath(env) : 'Failure';
            this.dimensionsInstructionsPath = ok(di) ? this.S3Service.getDimensionsInstructionsConfigPath(env) : 'Failure';
            this.searchEngineSettingsPath = ok(se) ? this.S3Service.getSearchEngineSettingsConfigPath(env) : 'Failure';
            this.taskSettingsPath = ok(ts) ? this.S3Service.getTaskSettingsConfigPath(env) : 'Failure';
            this.workerChecksPath = ok(wc) ? this.S3Service.getWorkerChecksConfigPath(env) : 'Failure';
        } finally {
            this.uploadCompleted = true;
            this.cdr.markForCheck();
        }
    }

    /* ---------- Validity getters ---------- */
    get questionnairesValid(): boolean {
        return !!this.questionnaireStep?.formStep?.valid;
    }

    get dimensionsValid(): boolean {
        return !!this.dimensionsStep?.formStep?.valid;
    }

    get generalInstrValid(): boolean {
        return !!this.generalInstructionsStep?.formStep?.valid;
    }

    get evalInstrValid(): boolean {
        return !!this.evaluationInstructionsStep?.formStep?.valid;
    }

    get searchValid(): boolean {
        return !!this.searchEngineStep?.formStep?.valid;
    }

    get taskSettingsValid(): boolean {
        return !!this.taskSettingsStep?.formStep?.valid && (this.taskSettingsStep?.hitsDetected ?? 0) > 0;
    }

    get workerChecksValid(): boolean {
        return !!this.workerChecksStep?.formStep?.valid;
    }
}
