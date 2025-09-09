/* Core */
import {ChangeDetectorRef, Component, EventEmitter, OnInit, Output} from "@angular/core";
import {UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {UtilsService} from "../../../../services/utils.service";
import {HitsSolverService} from "../../../../services/hitsSolver.service";
import {ReadFile, ReadMode} from "ngx-file-helpers";
/* Models */
import {Hit} from "../../../../models/skeleton/hit";
import {AttributeMain, DocumentCategory, TaskSettings} from "../../../../models/skeleton/taskSettings";
import {S3Service} from "../../../../services/aws/s3.service";

interface AnnotatorType {
    value: string;
    viewValue: string;
}

interface ModalityType {
    value: string;
    viewValue: string;
}

@Component({
    selector: "app-task-settings-step",
    templateUrl: "./task-settings-step.component.html",
    styleUrls: ["../../generator.component.scss"],
    standalone: false
})
export class TaskSettingsStepComponent implements OnInit {
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;
    /* Service which wraps the interaction with the Hits solver*/
    HitsSolverService: HitsSolverService;
    /* Service to provide loading screens */
    ngxService: NgxUiLoaderService;
    utilsService: UtilsService;

    /* STEP #6 - Task Settings */
    dataStored: TaskSettings;
    formStep: UntypedFormGroup;

    annotatorTypes: AnnotatorType[] = [
        {value: "options", viewValue: "Options"},
        {value: "laws", viewValue: "Laws"}
    ];
    modalityTypes: ModalityType[] = [
        {value: "pointwise", viewValue: "Pointwise"},
        {value: "pairwise", viewValue: "Pairwise"}
    ];
    countdownBehavior: ModalityType[] = [
        {value: "disable_form", viewValue: "Disable Forms"},
        {value: "hide_attributes", viewValue: "Hide Attributes"}
    ];
    additionalTimeModalities: ModalityType[] = [
        {value: "attribute", viewValue: "Attribute"},
        {value: "position", viewValue: "Position"}
    ];

    batchesTree: Array<JSON>;
    batchesTreeInitialization: boolean;
    annotatorOptionColors: string[];

    /* Variables to handle hits file upload */
    hitsFile: ReadFile;
    hitsFileName: string;
    hitsParsed: Hit[];
    hitsParsedString: string;

    /* SAFER typings (fixed) */
    hitsAttributes: string[] = [];
    hitsAttributesValues: Record<string, any[]> = {};
    hitsPositions: number;
    hitsSize: number;
    hitsDetected: number;
    readMode: ReadMode;

    /* Variables to handle docs file upload */
    docsFile: ReadFile;
    docsFileName: string;
    docsParsed: Array<JSON>;
    docsParsedString: string;

    /* SAFER typings (fixed) */
    docsCategories: string[] = [];
    docsCategoriesValues: Record<string, any[]> = {};

    docsSize: number;
    docsDetected: number;
    identificationAttribute: string;
    errorMessage: string;
    solutionStatus: string;
    solverStatus: boolean;
    hitDimension: number;

    configurationSerialized: string;

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;
    @Output() modalityEmitter: EventEmitter<string>;

    /* trackBy for stable indices inside FormArray loops (prevents path glitches during CD) */
    trackByIndex = (i: number) => i;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        ngxService: NgxUiLoaderService,
        HitsSolverService: HitsSolverService,
        utilsService: UtilsService,
        private _formBuilder: UntypedFormBuilder,
        private cd: ChangeDetectorRef
    ) {
        this.configService = configService;
        this.S3Service = S3Service;
        this.localStorageService = localStorageService;
        this.ngxService = ngxService;
        this.HitsSolverService = HitsSolverService;
        this.solverStatus = false;
        if (this.configService.environment.hit_solver_endpoint != "None") this.initHitSolver();
        this.utilsService = utilsService;
        this.initializeControls();
    }

    /* ───────────────────────── Helpers (new) ───────────────────────── */

    /** Ensure a key exists as an array in a record and return it */
    private ensureArrayBucket<T>(map: Record<string, T[]>, key: string): T[] {
        return (map[key] ??= []);
    }

    /** Push into array if not already present (strict equality) */
    private pushUnique<T>(arr: T[], value: T): void {
        if (!arr.includes(value)) arr.push(value);
    }

    /* ───────────────────────── Solver init ───────────────────────── */

    initHitSolver() {
        this.HitsSolverService.getSolverConfiguration(this.configService).subscribe(
            (response) => {
                this.HitsSolverService.setRunners(response);
                this.solverStatus = true;
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            },
            (_error) => {
                this.solverStatus = false;
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            }
        );
    }

    checkSolverStatus() {
        this.HitsSolverService.getSolverConfiguration(this.configService).subscribe(
            (response) => {
                this.HitsSolverService.setRunners(response);
                this.solverStatus = true;
                this.cd.detectChanges();
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            },
            (_error) => {
                this.solverStatus = false;
                this.cd.detectChanges();
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            }
        );
    }

    /* ───────────────────────── Forms bootstrap ───────────────────────── */

    public initializeControls() {
        /* Build a minimal, valid scaffold to avoid null parent errors in the template */
        this.dataStored = new TaskSettings();
        this.formStep = this._formBuilder.group({
            modality: "",
            allowed_tries: "",
            time_check_amount: "",
            time_assessment: "",
            documents: this._formBuilder.group({
                min_docs_repetitions: 1,
                doc_categories: this._formBuilder.array([]),
                workers_number: ""
            }),
            attributes: this._formBuilder.array([]),
            setAnnotator: false,
            annotator: this._formBuilder.group({
                type: "",
                values: this._formBuilder.array([])
            }),
            setCountdownTime: "",
            countdown_time: "",
            countdown_behavior: "",
            setAdditionalTimes: "",
            countdown_modality: "",
            countdown_attribute: "",
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: false,
            logger_option: false,
            server_endpoint: ""
        });
        this.hitDimension = 0;
        this.errorMessage = "";
        this.solutionStatus = "";
        /* Read mode during hits file upload*/
        this.readMode = ReadMode.Text;
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
        this.modalityEmitter = new EventEmitter<string>();
    }

    /* ───────────────────────── Getters used in template (stable paths) ───────────────────────── */

    /* These getters provide a single source of truth for parent groups/arrays used in loops */
    get documentsFG(): UntypedFormGroup {
        return this.formStep.get("documents") as UntypedFormGroup;
    }

    get docCategoriesFA(): UntypedFormArray {
        return this.documentsFG.get("doc_categories") as UntypedFormArray;
    }

    get attributesFA(): UntypedFormArray {
        return this.formStep.get("attributes") as UntypedFormArray;
    }

    get annotatorFG(): UntypedFormGroup {
        return this.formStep.get("annotator") as UntypedFormGroup;
    }

    get annotatorValuesFA(): UntypedFormArray {
        return this.annotatorFG.get("values") as UntypedFormArray;
    }

    get countdownAttrValuesFA(): UntypedFormArray {
        return this.formStep.get("countdown_attribute_values") as UntypedFormArray;
    }

    get countdownPosValuesFA(): UntypedFormArray {
        return this.formStep.get("countdown_position_values") as UntypedFormArray;
    }

    get messagesFA(): UntypedFormArray {
        return this.formStep.get("messages") as UntypedFormArray;
    }

    /* Keep original helpers for backwards compatibility in TS (template now prefers getters) */
    hitAttributes() {
        return this.attributesFA;
    }

    documentsOptions(): UntypedFormGroup {
        return this.documentsFG;
    }

    docCategories(): UntypedFormArray {
        return this.docCategoriesFA;
    }

    docCategory(valueIndex: number) {
        return this.docCategoriesFA?.at(valueIndex);
    }

    annotator() {
        return this.annotatorFG;
    }

    annotatorOptionValues(): UntypedFormArray {
        return this.annotatorValuesFA;
    }

    countdownAttributeValues() {
        return this.countdownAttrValuesFA;
    }

    countdownPositionValues() {
        return this.countdownPosValuesFA;
    }

    messages() {
        return this.messagesFA;
    }

    /* ───────────────────────── Lifecycle ───────────────────────── */

    public async ngOnInit() {
        /* Load dataStored either from local storage or S3 */
        let serializedTaskSettings = this.localStorageService.getItem("task-settings");
        if (serializedTaskSettings) {
            this.dataStored = new TaskSettings(JSON.parse(serializedTaskSettings));
        } else {
            this.initializeControls();
            let rawTaskSettings = await this.S3Service.downloadTaskSettings(this.configService.environment);
            this.dataStored = new TaskSettings(rawTaskSettings);
            this.localStorageService.setItem(`task-settings`, JSON.stringify(rawTaskSettings));
        }

        /* Seed annotator colors if present */
        this.annotatorOptionColors = ["#FFFF7B"];
        if (this.dataStored.annotator) {
            if (this.dataStored.annotator.type == "options") {
                if (this.dataStored.annotator.values.length > 0) {
                    this.annotatorOptionColors = [];
                    this.dataStored.annotator.values.forEach((optionValue, _optionValueIndex) => {
                        this.annotatorOptionColors.push(optionValue["color"]);
                    });
                }
            }
        }

        /* Recreate the form with validators and arrays in place */
        this.formStep = this._formBuilder.group({
            modality: [this.dataStored ? (this.dataStored.modality ? this.dataStored.modality : "") : "", [Validators.required]],
            allowed_tries: [
                this.dataStored ? (this.dataStored.allowed_tries ? this.dataStored.allowed_tries : "") : "",
                [Validators.required]
            ],
            time_check_amount: [
                this.dataStored ? (this.dataStored.time_check_amount ? this.dataStored.time_check_amount : "") : "",
                [Validators.required]
            ],
            time_assessment: [
                this.dataStored ? (this.dataStored.time_assessment ? this.dataStored.time_assessment : "") : "",
                [Validators.required]
            ],
            documents: this._formBuilder.group({
                min_docs_repetitions: 1,
                doc_categories: this._formBuilder.array([]),
                workers_number: ""
            }),
            attributes: this._formBuilder.array([]),
            setAnnotator: !!this.dataStored.annotator,
            annotator: this._formBuilder.group({
                type: this.dataStored.annotator ? (this.dataStored.annotator.type ? this.dataStored.annotator.type : "") : "",
                values: this._formBuilder.array([])
            }),
            setCountdownTime: this.dataStored.countdownTime >= 0 ? true : "",
            countdown_time: this.dataStored.countdownTime >= 0 ? this.dataStored.countdownTime : "",
            countdown_behavior: this.dataStored.countdown_behavior ? this.dataStored.countdown_behavior : "",
            setAdditionalTimes: this.dataStored.countdown_modality ? true : "",
            countdown_modality: this.dataStored.countdown_modality
                ? this.dataStored.countdown_modality
                : "",
            countdown_attribute: this.dataStored.countdown_attribute ? this.dataStored.countdown_attribute : "",
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: !!this.dataStored.logger_enable,
            logger_option: this.dataStored.logger_options,
            server_endpoint: this.dataStored.logger_server_endpoint ? this.dataStored.logger_server_endpoint : ""
        });

        /* Emit modality if present */
        if (this.dataStored.modality) this.emitModality(this.dataStored.modality);

        /* Restore messages */
        if (this.dataStored.messages)
            if (this.dataStored.messages.length > 0)
                this.dataStored.messages.forEach((message, _messageIndex) => this.addMessage(message));

        /* Restore annotator options */
        if (this.dataStored.annotator)
            if (this.dataStored.annotator.type == "options")
                this.dataStored.annotator.values.forEach((optionValue, _optionValueIndex) => this.addOptionValue(optionValue));

        /* Restore additional times */
        if (this.dataStored.countdownTime >= 0) {
            if (this.dataStored.countdown_modality == "attribute") {
                if (this.dataStored.countdown_attribute_values) {
                    for (let countdownAttribute of this.dataStored.countdown_attribute_values) {
                        this.updateCountdownAttribute(countdownAttribute);
                    }
                }
            }
        }
        if (this.dataStored.countdownTime >= 0) {
            if (this.dataStored.countdown_modality == "position") {
                if (this.dataStored.countdown_position_values) {
                    for (let countdownPosition of this.dataStored.countdown_position_values) {
                        this.updateCountdownPosition(countdownPosition);
                    }
                }
            }
        }

        /* Load hits (populates attributes form array safely) */
        await this.loadHits();

        /* Persist every change */
        this.formStep.valueChanges.subscribe((_form) => {
            this.serializeConfiguration();
        });
        this.serializeConfiguration();

        /* Pass form to parent */
        this.formEmitter.emit(this.formStep);
    }

    /* ───────────────────────── Hits load (hardened) ───────────────────────── */

    async loadHits() {
        let hits: Hit[] | undefined;
        try {
            const raw = this.localStorageService.getItem("hits");
            hits = raw ? JSON.parse(raw) : undefined;
        } catch {
            // ignore
        }

        if (!Array.isArray(hits)) {
            try {
                hits = await this.S3Service.downloadHits(this.configService.environment);
            } catch {
                hits = [];
            }
        }

        this.localStorageService.setItem(`hits`, JSON.stringify(hits));
        this.updateHitsFile(hits);
    }

    emitModality(data: any) {
        /* If the select emits just the string value, support both shapes */
        const value = typeof data === "string" ? data : data?.value;
        this.modalityEmitter.emit(value);
    }

    async loadHitsFromResponse(hits: Hit[]) {
        this.localStorageService.setItem(`hits`, JSON.stringify(hits));
        this.updateHitsFile(hits);
    }

    updateLogger() {
        if (this.formStep?.get("logger").value == true) {
            this.formStep?.get("server_endpoint")?.addValidators([Validators.required]);
        } else {
            this.formStep?.get("server_endpoint")?.clearValidators();
        }
        this.formStep?.get("server_endpoint")?.updateValueAndValidity();
    }

    updateLoggerOption(el: string, action: string) {
        const current = this.formStep?.get("logger_option").value ?? {};
        const truthValue = current[el]?.[action] != true;
        if (action == "general") {
            for (let key in current[el]) {
                current[el][key] = truthValue;
            }
            this.formStep?.get("logger_option")?.setValue(current);
        } else {
            current[el][action] = truthValue;
            this.formStep?.get("logger_option")?.setValue(current);
        }
    }

    get loggerOptionValue(): { [key: string]: { [key: string]: boolean } } {
        return this.formStep.get("logger_option")?.value ?? {};
    }

    updateServerEndpoint() {
        return this.formStep?.get("server_endpoint").value;
    }

    /* ───────────────────────── updateHitsFile (fixed) ───────────────────────── */

    updateHitsFile(hits: Hit[] | null = null) {
        this.hitsParsed = hits ?? (JSON.parse(this.hitsFile.content) as Hit[]);
        this.hitsParsedString = JSON.stringify(this.hitsParsed);

        if (!hits) {
            this.localStorageService.setItem(`hits`, this.hitsParsedString);
        }

        if (this.hitsParsed?.length > 0) {
            const h0: any = this.hitsParsed[0] ?? {};
            const valid =
                Array.isArray(h0.documents) &&
                "token_input" in h0 &&
                "token_output" in h0 &&
                "unit_id" in h0;
            this.hitsDetected = valid ? this.hitsParsed.length : 0;
        } else {
            this.hitsDetected = 0;
        }

        /* Reset attributes model */
        this.hitsAttributes = [];
        this.hitsAttributesValues = {};
        this.hitsPositions = 0;

        if (this.hitsDetected > 0) {
            const copy = JSON.parse(JSON.stringify(this.hitsParsed)) as any[];

            const firstDocs: any[] = Array.isArray(copy[0]?.documents) ? copy[0].documents : [];
            this.hitsPositions = firstDocs.length;

            /* Walk every document of every hit, discover attributes + distinct values safely */
            for (const hit of copy) {
                const docs: any[] = Array.isArray(hit?.documents) ? hit.documents : [];
                for (const doc of docs) {
                    if (Array.isArray(doc?.statements) && doc.statements[0] && typeof doc.statements[0] === "object") {
                        for (const [attr, val] of Object.entries(doc.statements[0])) {
                            if (!this.hitsAttributes.includes(attr)) this.hitsAttributes.push(attr);
                            const bucket = this.ensureArrayBucket(this.hitsAttributesValues, attr);
                            this.pushUnique(bucket, val as any);
                        }
                    } else if (doc && typeof doc === "object") {
                        for (const [attr, val] of Object.entries(doc)) {
                            if (!this.hitsAttributes.includes(attr)) this.hitsAttributes.push(attr);
                            const bucket = this.ensureArrayBucket(this.hitsAttributesValues, attr);
                            this.pushUnique(bucket, val as any);
                        }
                    }
                }
            }
        }

        /* Rebuild form array for attributes with stable parent path */
        this.attributesFA.clear({emitEvent: true});
        for (let i = 0; i < this.hitsAttributes.length; i++) {
            const existing = this.dataStored?.attributesMain?.[i];
            this.addHitAttribute(this.hitsAttributes[i], existing ?? null);
        }

        /* File meta */
        if (this.hitsFile) {
            this.hitsSize = Math.round(this.hitsFile.size / 1024);
            this.hitsFileName = this.hitsFile.name;
        } else {
            this.hitsSize = Math.round((this.hitsParsedString?.length ?? 0) / 1024);
            this.hitsFileName = "hits.json";
        }
    }

    /* ───────────────────────── Docs parsing (minor guards) ───────────────────────── */

    updateDocsFile(docs: any[] | null = null) {
        this.docsParsed = docs ? docs : (JSON.parse(this.docsFile.content) as Array<JSON>);
        this.docsParsedString = JSON.stringify(this.docsParsed);
        let condition = this.existsIdentificationAttribute(docs ?? undefined);
        if (this.docsParsed.length > 0 && condition) {
            this.docsDetected = this.docsParsed.length;
        } else {
            this.docsDetected = 0;
            if (this.docsParsed.length < 0) {
                this.errorMessage = "This JSON file does not contain any valid document. Please, review your selection.";
            } else if (!condition) {
                this.errorMessage =
                    "There's no attribute that can be used as a unique identificator on the solver. Please, review your selection";
            }
        }

        /* Clear & repopulate categories safely */
        this.resetCategorySelection();
        this.docCategoriesFA.clear({emitEvent: true});

        this.docsCategories = [];
        this.docsCategoriesValues = {};

        if (this.docsDetected > 0) {
            const docsCopy = JSON.parse(JSON.stringify(this.docsParsed)) as any[];
            const doc_sample = docsCopy[0] ?? {};

            for (let attribute in doc_sample) {
                if (!this.docsCategories.includes(attribute)) {
                    this.docsCategories.push(attribute);
                    this.docsCategoriesValues[attribute] = [];
                }
            }

            for (let doc of docsCopy) {
                Object.entries(doc).forEach(([attribute, value]) => {
                    if (this.docsCategories.includes(attribute)) {
                        const bucket = this.ensureArrayBucket(this.docsCategoriesValues, attribute);
                        this.pushUnique(bucket, value as any);
                    }
                });
            }

            this.documentsFG
                ?.get("min_docs_repetitions")
                .valueChanges?.subscribe((data) => {
                if (data != null) this.updateWorkerNumber(data);
            });

            let VALUES_LIMIT = 6;

            this.docsCategories.forEach((category) => {
                if ((this.docsCategoriesValues[category] ?? []).length <= VALUES_LIMIT) {
                    this.addDocCategory(
                        category,
                        new DocumentCategory(category, (this.docsCategoriesValues[category] ?? []).length, 0),
                        this.categoryIsBalanced(category)
                    );
                }
            });

            for (let category of this.docCategoriesFA.controls) {
                if (!this?.categoryIsBalanced(category?.get("name").value)) category?.get("selected")?.disable();
            }
            this.resetWorkerAssignment();

            if (this.docCategoriesFA.length == 0) {
                this.docsDetected = 0;
                this.errorMessage = "There's no category with a balanced number of documents.";
            }
        }

        if (this.docsFile) {
            this.docsSize = Math.round(this.docsFile.size / 1024);
            this.docsFileName = this.docsFile.name;
        } else {
            this.docsSize = Math.round((this.docsParsedString?.length ?? 0) / 1024);
            this.docsFileName = "docs.json";
        }
        this.solutionStatus = "";
    }

    addHitAttribute(name: string, attribute: AttributeMain = null) {
        this.attributesFA?.push(
            this._formBuilder?.group({
                name: attribute ? attribute.name : name,
                name_pretty: attribute ? (attribute.name_pretty ? attribute.name_pretty : "") : "",
                show: attribute ? attribute.show : true,
                annotate: attribute ? (this.formStep?.get("setAnnotator").value ? attribute.annotate : false) : false,
                required: attribute ? (this.formStep?.get("setAnnotator").value ? attribute.required : false) : false
            })
        );
        this.resetHitAttributes();
    }

    resetHitAttributes() {
        for (let attribute of this.attributesFA.controls) {
            if (this.formStep?.get("setAnnotator").value == false) {
                attribute?.get("annotate")?.disable();
                attribute?.get("annotate")?.setValue(false);
                attribute?.get("required")?.disable();
                attribute?.get("required")?.setValue(false);
            } else {
                attribute?.get("annotate")?.enable();
                attribute?.get("required")?.enable();
            }
        }
    }

    updateHitAttribute(attributeIndex: number) {
        let attribute = this.attributesFA?.at(attributeIndex);
        if (attribute?.get("show").value == true) {
            attribute?.get("annotate")?.enable();
            attribute?.get("required")?.enable();
        } else {
            attribute?.get("annotate")?.disable();
            attribute?.get("required")?.disable();
            attribute?.get("annotate")?.setValue(false);
            attribute?.get("required")?.setValue(false);
        }
        if (attribute?.get("annotate").value == true) {
            attribute?.get("required")?.enable();
        } else {
            attribute?.get("required")?.disable();
            attribute?.get("required")?.setValue(false);
        }
        this.resetHitAttributes();
    }

    /* (fixed) Guard empty docs */
    existsIdentificationAttribute(docs?: any[]): boolean {
        const docsParsed: any[] = docs ?? (JSON.parse(this.docsFile.content) as any[]);
        if (!Array.isArray(docsParsed) || docsParsed.length === 0) return false;

        const first = docsParsed[0] ?? {};
        const attributes = Object.keys(first);
        const attributeValues: Record<string, any[]> = {};
        for (const a of attributes) attributeValues[a] = [];

        for (const doc of docsParsed) {
            for (const a of attributes) {
                const bucket = attributeValues[a];
                if (!bucket.includes(doc[a])) bucket.push(doc[a]);
            }
        }

        for (const a of attributes) {
            if (attributeValues[a].length === docsParsed.length) {
                this.identificationAttribute = a;
                return true;
            }
        }
        return false;
    }

    getCategoryReport(category: string) {
        let report = "";
        let MAX_VALUE_LENGTH = 12;
        (this.docsCategoriesValues[category] ?? []).forEach((element) => {
            let docs: any[] = [];
            for (let doc of this.docsParsed ?? []) {
                if (doc[category] == element) docs.push(doc);
            }
            const el = element
                ? (element.length > 0 ? (element.length > MAX_VALUE_LENGTH ? element.substring(0, MAX_VALUE_LENGTH) + ".." : element) : "NO VALUE")
                : "NO VALUE";
            report += report == "" ? `${el}: ${docs.length} documents` : `\n ${el}: ${docs.length} documents`;
        });
        return report;
    }

    addDocCategory(name: string, category: DocumentCategory = null, balanced: boolean) {
        this.docCategoriesFA.push(
            this._formBuilder.group({
                name: name,
                name_pretty: category ? (category.name_pretty ? category.name_pretty : name) : name,
                values_number: category ? (category.values_number ? category.values_number : 0) : 0,
                selected: category ? (category.selected ? category.selected : false) : false,
                worker_assignment: category ? (category.worker_assignment ? category.worker_assignment : 0) : 0,
                balanced: balanced
            })
        );
    }

    resetWorkerAssignment() {
        for (let category of this.docCategoriesFA.controls) {
            category?.get("worker_assignment")?.disable();
        }
    }

    updateDocCategory(categoryIndex: number) {
        let category = this.docCategoriesFA?.at(categoryIndex);
        if (category?.get("selected").value == true) {
            category?.get("worker_assignment")?.enable();
            category?.get("worker_assignment")?.setValue(1);
        } else {
            category?.get("worker_assignment")?.setValue(0);
            category?.get("worker_assignment")?.disable();
        }
    }

    /* (fixed) Safe + defensive */
    categoryIsBalanced(category: string): boolean {
        const values = this.docsCategoriesValues?.[category] ?? [];
        if (!values.length || !Array.isArray(this.docsParsed)) return false;

        const counts: number[] = [];
        for (const v of values) {
            let n = 0;
            for (const doc of this.docsParsed) if ((doc as any)?.[category] === v) n++;
            counts.push(n);
        }
        return counts.length > 0 && counts.every((el) => el === counts[0]);
    }

    checkCategoriesSelection() {
        // This array stores the number of documents to be judged for each selected category
        let hitDimensions: number[] = [];
        for (let category of this.docCategoriesFA.controls) {
            if (category?.get("selected").value == true) {
                let name = category?.get("name").value;
                let worker_assignment = Math?.round(category?.get("worker_assignment").value);
                let values = (this.docsCategoriesValues[name] ?? []).length;
                hitDimensions.push(worker_assignment * values);
            }
        }
        if (hitDimensions.length == 0) {
            this.hitDimension = 0;
        }
        if (hitDimensions.length > 0) {
            if (hitDimensions.every((val, _i, arr) => val == arr[0]) && hitDimensions[0] > 0) {
                this.hitDimension = hitDimensions[0];
                for (let category of this.docCategoriesFA.controls) {
                    category?.get("selected")?.disable();
                    category?.get("worker_assignment")?.disable();
                }
                let min_docs_rep = this.documentsFG?.get("min_docs_repetitions").value;
                let min_workers_number = Math.ceil((this.docsDetected * min_docs_rep) / this.hitDimension);

                let workers_number = this.documentsFG?.get("workers_number");
                workers_number.setValue(min_workers_number);
                workers_number.addValidators(Validators.min(min_workers_number));
            } else {
                this.hitDimension = -1;
            }
        }
    }

    resetCategorySelection() {
        this.hitDimension = 0;
        this.resetWorkerAssignment();
        this.documentsFG?.get("min_docs_repetitions")?.setValue(1);
        this.documentsFG?.get("workers_number")?.setValue("");
        for (let category of this.docCategoriesFA.controls) {
            if (this?.categoryIsBalanced(category?.get("name").value)) category?.get("selected")?.enable();
            category?.get("selected")?.setValue(false);
            category?.get("worker_assignment")?.setValue(0);
        }
        let workers_number = this.documentsFG?.get("workers_number");
        workers_number.clearValidators();
        workers_number.addValidators(Validators.min(1));
        this.solutionStatus = "";
    }

    updateWorkerNumber(min_docs_rep: number) {
        if (this.hitDimension > 0) {
            let min_workers_number = Math.ceil((this.docsDetected * min_docs_rep) / this.hitDimension);
            let workers_number = this.documentsFG?.get("workers_number");
            workers_number.setValue(min_workers_number);
            workers_number.addValidators(Validators.min(min_workers_number));
        }
    }

    sendRequestToHitSolver() {
        let min_docs_rep = this.documentsFG?.get("min_docs_repetitions").value;
        let selectedCategories: string[] = [];
        let selectedWorkerAssignment: Record<string, number> = {};
        for (let category of this.docCategoriesFA.controls) {
            if (category?.get("selected").value == true) {
                let name = category?.get("name").value;
                let worker_assignment = category?.get("worker_assignment").value;
                selectedCategories.push(name);
                selectedWorkerAssignment[name] = worker_assignment;
            }
        }
        let workers_number = this.documentsFG?.get("workers_number").value;
        let req = this.HitsSolverService.createRequest(
            this.docsParsed,
            this.identificationAttribute,
            min_docs_rep,
            0,
            selectedCategories,
            selectedWorkerAssignment as any,
            workers_number
        );

        this.ngxService.startBackground();
        this.HitsSolverService.submitRequest(req).subscribe(
            (response) => {
                this.solutionStatus = "Request has been sent to the solver";
                let task_id = response.task_id;
                let url = response.url;

                /* This function checks until finished; UI shows loader */
                this.checkHitStatus(url, task_id, this.docsParsed as any, 2000);
            },
            (_error) => {
                this.solutionStatus = "Error on the solver. Please check if the solver is online.";
                this.ngxService.stopBackground();
            }
        );
    }

    /**
     * Poll solver until finished; then build new hits and load them.
     */
    public checkHitStatus(url: string, task_id: string, docs: Array<JSON>, timeout: number) {
        this.HitsSolverService.checkSolutionStatus(url).subscribe((response) => {
            if (response["finished"] == false) {
                /* Wait to repull the solution from the solver */
                setTimeout(() => {
                    this.checkHitStatus(url, task_id, docs, timeout);
                }, timeout);
            } else {
                this.HitsSolverService.getSolution(task_id).subscribe((solution) => {
                    let receivedHit = this.HitsSolverService.createHits(solution, docs, this.identificationAttribute);
                    this.loadHitsFromResponse(receivedHit);

                    this.ngxService.stopBackground();
                    this.solutionStatus = "Solution from the solver has been received";
                });
            }
        });
    }

    resetCountdown() {
        if (this.formStep?.get("setCountdownTime").value == false) {
            this.formStep?.get("countdown_time")?.setValue("");
            this.formStep?.get("countdown_time")?.clearValidators();
            this.formStep?.get("countdown_time")?.updateValueAndValidity();
            this.formStep?.get("countdown_behavior")?.setValue("");
            this.formStep?.get("countdown_behavior")?.clearValidators();
            this.formStep?.get("countdown_behavior")?.updateValueAndValidity();
        } else {
            this.formStep?.get("countdown_time")?.setValidators([Validators.required, this.utilsService.positiveOrZeroNumber.bind(this)]);
            this.formStep?.get("countdown_time")?.updateValueAndValidity();
            this.formStep?.get("countdown_behavior")?.setValidators([Validators.required]);
            this.formStep?.get("countdown_behavior")?.updateValueAndValidity();
        }
        this.resetAdditionalTimes();
    }

    resetAdditionalTimes() {
        if (this.formStep?.get("setAdditionalTimes").value == false) {
            this.formStep?.get("countdown_modality")?.setValue("");
            this.formStep?.get("countdown_modality")?.clearValidators();
            this.formStep?.get("countdown_modality")?.updateValueAndValidity();
            this.formStep?.get("countdown_attribute")?.setValue("");
            this.formStep?.get("countdown_attribute")?.clearValidators();
            this.formStep?.get("countdown_attribute")?.updateValueAndValidity();
            this.countdownAttrValuesFA.clear();
            this.countdownAttrValuesFA.updateValueAndValidity();
            this.countdownPosValuesFA.clear();
            this.countdownPosValuesFA.updateValueAndValidity();
        } else {
            this.formStep?.get("countdown_modality")?.setValidators([Validators.required]);
            if (this.formStep?.get("countdown_modality").value == "attribute") this.formStep?.get("countdown_attribute")?.setValidators([Validators.required]);
        }
    }

    updateCountdownModality() {
        if (this.formStep?.get("countdown_modality").value == "attribute") {
            this.countdownPosValuesFA.clear();
        } else {
            this.formStep?.get("countdown_attribute")?.setValue(false);
            this.formStep?.get("countdown_attribute")?.clearValidators();
            this.countdownAttrValuesFA.clear();
            this.countdownAttrValuesFA.updateValueAndValidity();
            this.updateCountdownPosition();
        }
    }

    updateCountdownAttribute(countdownAttribute: any = null) {
        if (countdownAttribute) {
            let control = this._formBuilder.group({
                name: countdownAttribute["name"],
                time: countdownAttribute["time"]
            });
            this.countdownAttrValuesFA.push(control);
        } else {
            this.countdownAttrValuesFA.clear();
            let chosenAttribute = this.formStep?.get("countdown_attribute").value;
            const values = this.hitsAttributesValues[chosenAttribute] ?? [];
            for (let value of values) {
                let control = this._formBuilder.group({
                    name: value,
                    time: ""
                });
                this.countdownAttrValuesFA.push(control);
            }
        }
    }

    updateCountdownPosition(countdownPosition: any = null) {
        if (countdownPosition) {
            let control = this._formBuilder.group({
                position: countdownPosition["name"],
                time: countdownPosition["time"]
            });
            this.countdownPosValuesFA.push(control);
        } else {
            this.countdownPosValuesFA.clear();
            for (let index = 0; index < (this.hitsPositions ?? 0); index++) {
                let control = this._formBuilder.group({
                    position: index,
                    time: ""
                });
                this.countdownPosValuesFA.push(control);
            }
        }
    }

    setAnnotatorType() {
        if (this.annotatorFG?.get("type").value == "options" && this.annotatorValuesFA.length == 0) {
            this.annotatorValuesFA.push(
                this._formBuilder.group({
                    label: ["", [Validators.required]],
                    color: ["", [Validators.required]]
                })
            );
        }
    }

    resetAnnotator() {
        for (let attributeControl of this.attributesFA.controls) {
            attributeControl?.get("annotate")?.setValue(false);
        }
        if (this.formStep?.get("setAnnotator").value == false) {
            this.annotatorFG?.get("type")?.setValue("");
            this.annotatorFG?.get("type")?.clearValidators();
            this.annotatorFG?.get("type")?.clearAsyncValidators();
            for (let index = 0; index < this.annotatorValuesFA.controls.length; index++) {
                this.removeAnnotatorOptionValue(index);
            }
        } else {
            this.annotatorFG?.get("type")?.setValidators([Validators.required]);
            this.setAnnotatorType();
        }
        this.annotatorFG?.get("type")?.updateValueAndValidity();
        this.resetHitAttributes();
    }

    addOptionValue(option: any = null) {
        this.annotatorValuesFA.push(
            this._formBuilder.group({
                label: [option ? (option["label"] ? option["label"] : "") : "", [Validators.required]],
                color: [option ? (option["color"] ? option["color"] : "") : "", [Validators.required]]
            })
        );
        if (!option) {
            if (!this.annotatorOptionColors) this.annotatorOptionColors = [];
            this.annotatorOptionColors.push("");
        }
    }

    updateOptionColor(color: string, optionIndex: number) {
        this.annotatorOptionColors[optionIndex] = color;
    }

    removeAnnotatorOptionValue(valueIndex: number) {
        this.annotatorValuesFA.removeAt(valueIndex);
    }

    addMessage(message: string = null) {
        this.messagesFA.push(
            this._formBuilder.group({
                message: [message ? message : "", [Validators.required]]
            })
        );
    }

    removeMessage(messageIndex: number) {
        this.messagesFA.removeAt(messageIndex);
    }

    /* JSON Output */

    serializeConfiguration() {
        let taskSettingsJSON = JSON.parse(JSON.stringify(this.formStep.value));

        if (!taskSettingsJSON.time_assessment) {
            taskSettingsJSON.time_assessment = 2;
        }

        if (!taskSettingsJSON.setAnnotator) taskSettingsJSON.annotator = false;
        delete taskSettingsJSON.setAnnotator;

        if (taskSettingsJSON.annotator?.type == "options") {
            taskSettingsJSON.annotator.values.forEach((option, index) => {
                option["color"] = this.annotatorOptionColors[index];
            });
        }

        if (!taskSettingsJSON.setCountdownTime) {
            taskSettingsJSON.countdown_time = false;
            taskSettingsJSON.additional_times = false;
            taskSettingsJSON.countdown_behavior = false;
            taskSettingsJSON.countdown_modality = false;
            taskSettingsJSON.countdown_attribute = false;
            taskSettingsJSON.countdown_attribute_values = [];
            taskSettingsJSON.countdown_position_values = [];
        }
        if (!taskSettingsJSON.setAdditionalTimes) {
            taskSettingsJSON.additional_times = false;
            taskSettingsJSON.countdown_modality = false;
            taskSettingsJSON.countdown_attribute = false;
            taskSettingsJSON.countdown_attribute_values = [];
            taskSettingsJSON.countdown_position_values = [];
        } else {
            taskSettingsJSON.additional_times = taskSettingsJSON.setAdditionalTimes;
        }
        delete taskSettingsJSON.setCountdownTime;
        delete taskSettingsJSON.setAdditionalTimes;

        if ("attributes" in taskSettingsJSON) {
            for (let attributeIndex in taskSettingsJSON["attributes"]) {
                let attribute = taskSettingsJSON["attributes"][attributeIndex];
                attribute["name"] = this.hitsAttributes[attributeIndex];
                if (!attribute["show"]) {
                    attribute["annotate"] = false;
                    attribute["required"] = false;
                }
                if (!attribute["annotate"]) {
                    attribute["required"] = false;
                }
                if (!taskSettingsJSON.annotator) {
                    attribute["annotate"] = false;
                    attribute["required"] = false;
                }
                taskSettingsJSON["attributes"][attributeIndex] = attribute;
            }
        }

        if (taskSettingsJSON.messages.length == 0) {
            delete taskSettingsJSON.messages;
        } else {
            let messages: string[] = [];
            for (let messageIndex in taskSettingsJSON.messages) messages.push(taskSettingsJSON.messages[messageIndex].message);
            taskSettingsJSON.messages = messages;
        }

        this.localStorageService.setItem(`task-settings`, JSON.stringify(taskSettingsJSON));
        this.configurationSerialized = JSON.stringify(taskSettingsJSON);
    }
}
