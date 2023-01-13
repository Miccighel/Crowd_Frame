/* Core */
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    OnInit,
    Output,
} from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
/* Services */

import { ConfigService } from "../../../../services/config.service";
import { LocalStorageService } from "../../../../services/localStorage.service";
import { NgxUiLoaderService } from "ngx-ui-loader";
import { UtilsService } from "../../../../services/utils.service";
import { HitsSolverService } from "../../../../services/hitsSolver.service";
import { ReadFile, ReadMode } from "ngx-file-helpers";
/* Models */
import { Hit } from "../../../../models/skeleton/hit";
import {
    Attribute,
    DocCategory,
    TaskSettings,
} from "../../../../models/skeleton/taskSettings";
import { S3Service } from "../../../../services/aws/s3.service";

interface AnnotatorType {
    value: string;
    viewValue: string;
}

interface ModalityType {
    value: string;
    viewValue: string;
}

interface BatchNode {
    name: string;
    batches?: BatchNode[];
}

@Component({
    selector: "app-task-settings-step",
    templateUrl: "./task-settings-step.component.html",
    styleUrls: ["../../generator.component.scss"],
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
        { value: "options", viewValue: "Options" },
        { value: "laws", viewValue: "Laws" },
    ];
    modalityTypes: ModalityType[] = [
        { value: "pointwise", viewValue: "Pointwise" },
        { value: "pairwise", viewValue: "Pairwise" },
    ];
    countdownBehavior: ModalityType[] = [
        { value: "disable_form", viewValue: "Disable Forms" },
        { value: "hide_attributes", viewValue: "Hide Attributes" },
    ];
    additionalTimeModalities: ModalityType[] = [
        { value: "attribute", viewValue: "Attribute" },
        { value: "position", viewValue: "Position" },
    ];

    batchesTree: Array<JSON>;
    batchesTreeInitialization: boolean;
    batchesTreeSerialized: Array<JSON>;
    annotatorOptionColors: Array<string>;
    /* Variables to handle hits file upload */
    hitsFile: ReadFile;
    hitsFileName: string;
    hitsParsed: Array<Hit>;
    hitsParsedString: string;
    hitsAttributes: Array<string>;
    hitsAttributesValues: Object;
    hitsPositions: number;
    hitsSize: number;
    hitsDetected: number;
    readMode: ReadMode;

    /* Variables to handle docs file upoload */
    docsFile: ReadFile;
    docsFileName: string;
    docsParsed: Array<JSON>;
    docsParsedString: string;
    docsCategories: Array<string>;
    docsCategoriesValues: Object;
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
        if (this.configService.environment.hit_solver_endpoint != "None")
            this.initHitSolver();
        this.utilsService = utilsService;
        this.initializeControls();
    }

    initHitSolver() {
        this.HitsSolverService.getSolverConfiguration(
            this.configService
        ).subscribe(
            (response) => {
                this.HitsSolverService.setRunners(response);
                this.solverStatus = true;
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            },
            (error) => {
                this.solverStatus = false;
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            }
        );
    }

    checkSolverStatus() {
        this.HitsSolverService.getSolverConfiguration(
            this.configService
        ).subscribe(
            (response) => {
                this.HitsSolverService.setRunners(response);
                this.solverStatus = true;
                this.cd.detectChanges();
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            },
            (error) => {
                this.solverStatus = false;
                this.cd.detectChanges();
                setTimeout(() => {
                    this.checkSolverStatus();
                }, 5000);
            }
        );
    }

    public initializeControls() {
        this.dataStored = new TaskSettings();
        this.formStep = this._formBuilder.group({
            modality: "",
            allowed_tries: "",
            time_check_amount: "",
            time_assessment: "",
            documents: this._formBuilder.group({
                min_docs_repetitions: 1,
                doc_categories: this._formBuilder.array([]),
                workers_number: "",
            }),
            attributes: this._formBuilder.array([]),
            setAnnotator: false,
            annotator: this._formBuilder.group({
                type: "",
                values: this._formBuilder.array([]),
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
            server_endpoint: "",
        });
        this.hitDimension = 0;
        this.errorMessage = "";
        this.solutionStatus = "";
        /* Read mode during hits file upload*/
        this.readMode = ReadMode.text;
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
        this.modalityEmitter = new EventEmitter<string>();
    }

    public async ngOnInit() {
        let serializedTaskSettings =
            this.localStorageService.getItem("task-settings");
        if (serializedTaskSettings) {
            this.dataStored = new TaskSettings(
                JSON.parse(serializedTaskSettings)
            );
        } else {
            this.initializeControls();
            let rawTaskSettings = await this.S3Service.downloadTaskSettings(
                this.configService.environment
            );
            this.dataStored = new TaskSettings(rawTaskSettings);
            this.localStorageService.setItem(
                `task-settings`,
                JSON.stringify(rawTaskSettings)
            );
        }
        this.annotatorOptionColors = ["#FFFF7B"];
        if (this.dataStored.annotator) {
            if (this.dataStored.annotator.type == "options") {
                if (this.dataStored.annotator.values.length > 0) {
                    this.annotatorOptionColors = [];
                    this.dataStored.annotator.values.forEach(
                        (optionValue, optionValueIndex) => {
                            this.annotatorOptionColors.push(
                                optionValue["color"]
                            );
                        }
                    );
                }
            }
        }
        this.formStep = this._formBuilder.group({
            modality: [
                this.dataStored
                    ? this.dataStored.modality
                        ? this.dataStored.modality
                        : ""
                    : "",
                [Validators.required],
            ],
            allowed_tries: [
                this.dataStored
                    ? this.dataStored.allowed_tries
                        ? this.dataStored.allowed_tries
                        : ""
                    : "",
                [Validators.required],
            ],
            time_check_amount: [
                this.dataStored
                    ? this.dataStored.time_check_amount
                        ? this.dataStored.time_check_amount
                        : ""
                    : "",
                [Validators.required],
            ],
            time_assessment: [
                this.dataStored
                    ? this.dataStored.time_assessment
                        ? this.dataStored.time_assessment
                        : ""
                    : "",
                [Validators.required],
            ],
            documents: this._formBuilder.group({
                min_docs_repetitions: 1,
                doc_categories: this._formBuilder.array([]),
                workers_number: "",
            }),
            attributes: this._formBuilder.array([]),
            setAnnotator: !!this.dataStored.annotator,
            annotator: this._formBuilder.group({
                type: this.dataStored.annotator
                    ? this.dataStored.annotator.type
                        ? this.dataStored.annotator.type
                        : ""
                    : "",
                values: this._formBuilder.array([]),
            }),
            setCountdownTime: this.dataStored.countdown_time >= 0 ? true : "",
            countdown_time:
                this.dataStored.countdown_time >= 0
                    ? this.dataStored.countdown_time
                    : "",
            countdown_behavior: this.dataStored.countdown_behavior
                ? this.dataStored.countdown_behavior
                : "",
            setAdditionalTimes: this.dataStored.countdown_modality ? true : "",
            countdown_modality: this.dataStored.countdown_modality
                ? this.dataStored.countdown_modality
                    ? this.dataStored.countdown_modality
                    : ""
                : "",
            countdown_attribute: this.dataStored.countdown_attribute
                ? this.dataStored.countdown_attribute
                    ? this.dataStored.countdown_attribute
                    : ""
                : "",
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: !!this.dataStored.logger_enable,
            logger_option: this.dataStored.logger_options,
            server_endpoint: this.dataStored.logger_server_endpoint
                ? this.dataStored.logger_server_endpoint
                    ? this.dataStored.logger_server_endpoint
                    : ""
                : "",
        });
        if (this.dataStored.modality)
            this.emitModality(this.dataStored.modality);
        if (this.dataStored.messages)
            if (this.dataStored.messages.length > 0)
                this.dataStored.messages.forEach((message, messageIndex) =>
                    this.addMessage(message)
                );
        if (this.dataStored.annotator)
            if (this.dataStored.annotator.type == "options")
                this.dataStored.annotator.values.forEach(
                    (optionValue, optionValueIndex) =>
                        this.addOptionValue(optionValue)
                );
        if (this.dataStored.countdown_time >= 0) {
            if (this.dataStored.countdown_modality == "attribute") {
                if (this.dataStored.countdown_attribute_values) {
                    for (let countdownAttribute of this.dataStored
                        .countdown_attribute_values) {
                        this.updateCountdownAttribute(countdownAttribute);
                    }
                }
            }
        }
        if (this.dataStored.countdown_time >= 0) {
            if (this.dataStored.countdown_modality == "position") {
                if (this.dataStored.countdown_position_values) {
                    for (let countdownPosition of this.dataStored
                        .countdown_position_values) {
                        this.updateCountdownPosition(countdownPosition);
                    }
                }
            }
        }
        let hitsPromise = this.loadHits();
        this.formStep.valueChanges.subscribe((form) => {
            this.serializeConfiguration();
        });
        this.serializeConfiguration();
        this.formEmitter.emit(this.formStep);
    }

    async loadHits() {
        let hits = JSON.parse(this.localStorageService.getItem("hits"));
        if (hits) {
            this.updateHitsFile(hits);
            this.localStorageService.setItem(`hits`, JSON.stringify(hits));
        } else {
            let hits = [];
            try {
                hits = await this.S3Service.downloadHits(
                    this.configService.environment
                );
            } catch (exception) {}
            this.localStorageService.setItem(`hits`, JSON.stringify(hits));
            this.updateHitsFile(hits);
        }
    }

    emitModality(data) {
        this.modalityEmitter.emit(data["value"]);
    }

    async loadHitsFromResponse(hits) {
        this.localStorageService.setItem(`hits`, JSON.stringify(hits));
        this.updateHitsFile(hits);
    }

    updateLogger() {
        if (this.formStep.get("logger").value == true) {
            this.formStep
                .get("server_endpoint")
                .addValidators([Validators.required]);
        } else {
            this.formStep.get("server_endpoint").clearValidators();
        }
        this.formStep.get("server_endpoint").updateValueAndValidity();
    }

    updateLoggerOption(el: string, action: string) {
        let truthValue =
            this.formStep.get("logger_option").value[el][action] != true;
        if (action == "general") {
            for (let key in this.formStep.get("logger_option").value[el]) {
                let value = this.formStep.get("logger_option").value;
                value[el][key] = truthValue;
                this.formStep.get("logger_option").setValue(value);
            }
        } else {
            let value = this.formStep.get("logger_option").value;
            value[el][action] = truthValue;
            this.formStep.get("logger_option").setValue(value);
        }
    }

    updateServerEndpoint() {
        return this.formStep.get("server_endpoint").value;
    }

    updateHitsFile(hits = null) {
        this.hitsParsed = hits
            ? hits
            : (JSON.parse(this.hitsFile.content) as Array<Hit>);
        this.hitsParsedString = JSON.stringify(this.hitsParsed);
        if (!hits) {
            this.localStorageService.setItem(
                `hits`,
                JSON.stringify(this.hitsParsed)
            );
        }
        if (this.hitsParsed.length > 0) {
            this.hitsDetected =
                "documents" in this.hitsParsed[0] &&
                "token_input" in this.hitsParsed[0] &&
                "token_output" in this.hitsParsed[0] &&
                "unit_id" in this.hitsParsed[0]
                    ? this.hitsParsed.length
                    : 0;
        } else {
            this.hitsDetected = 0;
        }
        this.hitsAttributes = [];
        this.hitsAttributesValues = {};

        if (this.hitsDetected > 0) {
            let hits = JSON.parse(JSON.stringify(this.hitsParsed));
            let document = hits[0]["documents"][0];
            this.hitsPositions = hits[0]["documents"].length;
            if (this.hitsPositions > 0) {
                if ("statements" in document) {
                    for (let attribute in document["statements"][0]) {
                        if (!(attribute in this.hitsAttributes)) {
                            this.hitsAttributes.push(attribute);
                            this.hitsAttributesValues[attribute] = [];
                        }
                    }
                } else {
                    for (let attribute in document) {
                        if (!(attribute in this.hitsAttributes)) {
                            this.hitsAttributes.push(attribute);
                            this.hitsAttributesValues[attribute] = [];
                        }
                    }
                }
            }

            for (let hit of hits) {
                for (let document of hit["documents"]) {
                    if ("statements" in document) {
                        Object.entries(document["statements"][0]).forEach(
                            ([attribute, value]) => {
                                if (
                                    !this.hitsAttributesValues[
                                        attribute
                                    ].includes(value)
                                )
                                    this.hitsAttributesValues[attribute].push(
                                        value
                                    );
                            }
                        );
                    } else {
                        Object.entries(document).forEach(
                            ([attribute, value]) => {
                                if (
                                    !this.hitsAttributesValues[
                                        attribute
                                    ].includes(value)
                                )
                                    this.hitsAttributesValues[attribute].push(
                                        value
                                    );
                            }
                        );
                    }
                }
            }
        }
        this.hitAttributes().clear({ emitEvent: true });
        for (let attributeIndex in this.hitsAttributes) {
            if (attributeIndex in this.dataStored.attributes) {
                this.addHitAttribute(
                    this.hitsAttributes[attributeIndex],
                    this.dataStored.attributes[attributeIndex]
                );
            } else {
                this.addHitAttribute(this.hitsAttributes[attributeIndex]);
            }
        }
        if (this.hitsFile) {
            this.hitsSize = Math.round(this.hitsFile.size / 1024);
            this.hitsFileName = this.hitsFile.name;
        } else {
            this.hitsSize = new TextEncoder().encode(
                this.hitsParsed.toString()
            ).length;
            this.hitsFileName = "hits.json";
        }
    }

    updateDocsFile(docs = null) {
        this.docsParsed = docs
            ? docs
            : (JSON.parse(this.docsFile.content) as Array<JSON>);
        this.docsParsedString = JSON.stringify(this.docsParsed);
        let condition = this.existsIdentificationAttribute(docs);
        if (this.docsParsed.length > 0 && condition) {
            this.docsDetected = this.docsParsed.length;
        } else {
            this.docsDetected = 0;
            if (this.docsParsed.length < 0) {
                this.errorMessage =
                    "This JSON file does not contain any valid document. Please, review your selection.";
            } else if (!condition) {
                this.errorMessage =
                    "There's no attribute that can be used as a unique identificator on the solver. Please, review your selection";
            }
        }

        this.resetCategorySelection();
        this.docCategories().clear({ emitEvent: true });

        this.docsCategories = [];
        this.docsCategoriesValues = {};

        if (this.docsDetected > 0) {
            let docs = JSON.parse(JSON.stringify(this.docsParsed));
            let doc_sample = docs[0];

            for (let attribute in doc_sample) {
                if (!(attribute in this.docsCategories)) {
                    this.docsCategories.push(attribute);
                    this.docsCategoriesValues[attribute] = [];
                }
            }

            for (let doc of docs) {
                Object.entries(doc).forEach(([attribute, value]) => {
                    if (this.docsCategories.includes(attribute)) {
                        if (
                            !this.docsCategoriesValues[attribute].includes(
                                value
                            )
                        )
                            this.docsCategoriesValues[attribute].push(value);
                    }
                });
            }

            this.documentsOptions()
                .get("min_docs_repetitions")
                .valueChanges.subscribe((data) => {
                    if (data != null) this.updateWorkerNumber(data);
                });

            let VALUES_LIMIT = 6;

            this.docsCategories.forEach((category) => {
                // The interface shows only the attributes which number of values that doesn't exceed the VALUES_LIMIT
                if (
                    this.docsCategoriesValues[category].length <= VALUES_LIMIT
                ) {
                    this.addDocCategory(
                        category,
                        new DocCategory(
                            category,
                            this.docsCategoriesValues[category].length,
                            0
                        ),
                        this.categoryIsBalanced(category)
                    );
                }
            });
            for (let category of this.docCategories().controls) {
                if (!this.categoryIsBalanced(category.get("name").value))
                    category.get("selected").disable();
            }
            this.resetWorkerAssignment();

            if (this.docCategories().length == 0) {
                this.docsDetected = 0;
                this.errorMessage =
                    "There's no category with a balanced number of documents.";
            }
        }

        if (this.docsFile) {
            this.docsSize = Math.round(this.docsFile.size / 1024);
            this.docsFileName = this.docsFile.name;
        } else {
            this.docsSize = new TextEncoder().encode(
                this.docsParsed.toString()
            ).length;
            this.docsFileName = "docs.json";
        }
        this.solutionStatus = "";
    }

    hitAttributes() {
        return this.formStep.get("attributes") as UntypedFormArray;
    }

    addHitAttribute(name: string, attribute = null as Attribute) {
        this.hitAttributes().push(
            this._formBuilder.group({
                name: attribute ? attribute.name : name,
                name_pretty: attribute
                    ? attribute.name_pretty
                        ? attribute.name_pretty
                        : ""
                    : "",
                show: attribute ? attribute.show : true,
                annotate: attribute
                    ? this.formStep.get("setAnnotator").value
                        ? attribute.annotate
                        : false
                    : false,
                required: attribute
                    ? this.formStep.get("setAnnotator").value
                        ? attribute.required
                        : false
                    : false,
            })
        );
        this.resetHitAttributes();
    }

    resetHitAttributes() {
        for (let attribute of this.hitAttributes().controls) {
            if (this.formStep.get("setAnnotator").value == false) {
                attribute.get("annotate").disable();
                attribute.get("annotate").setValue(false);
                attribute.get("required").disable();
                attribute.get("required").setValue(false);
            } else {
                attribute.get("annotate").enable();
                attribute.get("required").enable();
            }
        }
    }

    updateHitAttribute(attributeIndex) {
        let attribute = this.hitAttributes().at(attributeIndex);
        if (attribute.get("show").value == true) {
            attribute.get("annotate").enable();
            attribute.get("required").enable();
        } else {
            attribute.get("annotate").disable();
            attribute.get("required").disable();
            attribute.get("annotate").setValue(false);
            attribute.get("required").setValue(false);
        }
        if (attribute.get("annotate").value == true) {
            attribute.get("required").enable();
        } else {
            attribute.get("required").disable();
            attribute.get("required").setValue(false);
        }
        this.resetHitAttributes();
    }

    documentsOptions(): UntypedFormGroup {
        return this.formStep.get("documents") as UntypedFormGroup;
    }

    docCategories(): UntypedFormArray {
        return this.documentsOptions().get(
            "doc_categories"
        ) as UntypedFormArray;
    }

    docCategory(valueIndex) {
        return this.docCategories().at(valueIndex);
    }

    existsIdentificationAttribute(docs) {
        let docsParsed = docs
            ? docs
            : (JSON.parse(this.docsFile.content) as Array<JSON>);
        let attributes = [];
        let attributeValues = {};
        for (let attribute in docsParsed[0]) {
            attributes.push(attribute);
            attributeValues[attribute] = [];
        }
        for (let doc of docsParsed) {
            for (let attr of attributes) {
                if (!attributeValues[attr].includes(doc[attr]))
                    attributeValues[attr].push(doc[attr]);
            }
        }
        for (let attr of attributes) {
            if (attributeValues[attr].length == docsParsed.length) {
                this.identificationAttribute = attr;
                return true;
            }
        }
        return false;
    }

    getCategoryReport(category) {
        let report = "";
        let MAX_VALUE_LENGTH = 12;
        this.docsCategoriesValues[category].forEach((element) => {
            let docs = [];
            for (let doc of this.docsParsed) {
                if (doc[category] == element) docs.push(doc);
            }
            let el = element
                ? element.length > 0
                    ? element.length > MAX_VALUE_LENGTH
                        ? element.substring(0, MAX_VALUE_LENGTH) + ".."
                        : element
                    : "NO VALUE"
                : "NO VALUE";
            report +=
                report == ""
                    ? `${el}: ${docs.length} documents`
                    : `\n ${el}: ${docs.length} documents`;
        });
        return report;
    }

    addDocCategory(
        name: string,
        category = null as DocCategory,
        balanced: boolean
    ) {
        this.docCategories().push(
            this._formBuilder.group({
                name: name,
                name_pretty: category
                    ? category.name_pretty
                        ? category.name_pretty
                        : name
                    : name,
                values_number: category
                    ? category.values_number
                        ? category.values_number
                        : 0
                    : 0,
                selected: category
                    ? category.selected
                        ? category.selected
                        : false
                    : false,
                worker_assignment: category
                    ? category.worker_assignment
                        ? category.worker_assignment
                        : 0
                    : 0,
                balanced: balanced,
            })
        );
    }

    resetWorkerAssignment() {
        for (let category of this.docCategories().controls) {
            category.get("worker_assignment").disable();
        }
    }

    updateDocCategory(categoryIndex) {
        let category = this.docCategories().at(categoryIndex);
        if (category.get("selected").value == true) {
            category.get("worker_assignment").enable();
            category.get("worker_assignment").setValue(1);
        } else {
            category.get("worker_assignment").setValue(0);
            category.get("worker_assignment").disable();
        }
    }

    categoryIsBalanced(category) {
        let documents_number = [];
        this.docsCategoriesValues[category].forEach((element) => {
            let docs = [];
            for (let doc of this.docsParsed) {
                if (doc[category] == element) docs.push(doc);
            }
            documents_number.push(docs.length);
        });
        return documents_number.every((el, index, arr) => el == arr[0]);
    }

    checkCategoriesSelection() {
        // This array stores the number of documents to be judged for each selected category
        let hitDimensions = [];
        for (let category of this.docCategories().controls) {
            if (category.get("selected").value == true) {
                let name = category.get("name").value;
                let worker_assignment = Math.round(
                    category.get("worker_assignment").value
                );
                let values = this.docsCategoriesValues[name].length;
                hitDimensions.push(worker_assignment * values);
            }
        }
        if (hitDimensions.length == 0) {
            // Requester has chosen 0 categories from the list and has clicked the 'CHECK SELECTION' button
            this.hitDimension = 0;
        }
        if (hitDimensions.length > 0) {
            // Requester has chosen at least 1 one categories from the list
            if (
                hitDimensions.every((val, i, arr) => val == arr[0]) &&
                hitDimensions[0] > 0
            ) {
                // All the values in the hitDimensions array are equals
                this.hitDimension = hitDimensions[0];
                for (let category of this.docCategories().controls) {
                    category.get("selected").disable();
                    category.get("worker_assignment").disable();
                }
                let min_docs_rep = this.documentsOptions().get(
                    "min_docs_repetitions"
                ).value;
                let min_workers_number = Math.ceil(
                    (this.docsDetected * min_docs_rep) / this.hitDimension
                );

                let workers_number =
                    this.documentsOptions().get("workers_number");
                workers_number.setValue(min_workers_number);
                workers_number.addValidators(
                    Validators.min(min_workers_number)
                );
            } else {
                // There's at least one value that differs from the other in the hitDimensions array
                this.hitDimension = -1;
            }
        }
    }

    resetCategorySelection() {
        this.hitDimension = 0;
        this.resetWorkerAssignment();
        this.documentsOptions().get("min_docs_repetitions").setValue(1);
        this.documentsOptions().get("workers_number").setValue("");
        for (let category of this.docCategories().controls) {
            if (this.categoryIsBalanced(category.get("name").value))
                category.get("selected").enable();
            category.get("selected").setValue(false);
            category.get("worker_assignment").setValue(0);
        }
        let workers_number = this.documentsOptions().get("workers_number");
        workers_number.clearValidators();
        workers_number.addValidators(Validators.min(1));
        this.solutionStatus = "";
    }

    updateWorkerNumber(min_docs_rep) {
        if (this.hitDimension > 0) {
            let min_workers_number = Math.ceil(
                (this.docsDetected * min_docs_rep) / this.hitDimension
            );
            let workers_number = this.documentsOptions().get("workers_number");
            workers_number.setValue(min_workers_number);
            workers_number.addValidators(Validators.min(min_workers_number));
        }
    }

    sendRequestToHitSolver() {
        let min_docs_rep = this.documentsOptions().get(
            "min_docs_repetitions"
        ).value;
        let selectedCategories = [];
        let selectedWorkerAssignment = [];
        for (let category of this.docCategories().controls) {
            if (category.get("selected").value == true) {
                let name = category.get("name").value;
                let worker_assignment = category.get("worker_assignment").value;
                selectedCategories.push(name);
                selectedWorkerAssignment[name] = worker_assignment;
            }
        }
        let workers_number =
            this.documentsOptions().get("workers_number").value;
        let req = this.HitsSolverService.createRequest(
            this.docsParsed,
            this.identificationAttribute,
            min_docs_rep,
            0,
            selectedCategories,
            selectedWorkerAssignment,
            workers_number
        );

        console.log(JSON.stringify(req));

        this.ngxService.startBackground();
        this.HitsSolverService.submitRequest(req).subscribe(
            (response) => {
                this.solutionStatus = "Request has been sent to the solver";
                let task_id = response.task_id;
                let url = response.url;

                /* This function check */
                this.checkHitStatus(url, task_id, this.docsParsed, 2000);
            },
            (error) => {
                this.solutionStatus =
                    "Error on the solver. Please check if the solver is online.";
                this.ngxService.stopBackground();
            }
        );
    }

    /**
     * This function uses the HitSolver service to check if the solution for the request is ready.
     * If the solution isn't ready the function waits for the timeout and then send a new request
     * to the HitSolver. This process continues until a solution is available.
     * When a solution is available, then, a new array of hit is created in the format of the
     * framework.
     * @param url
     * @param task_id
     * @param docs
     * @param timeout
     */
    public checkHitStatus(
        url: string,
        task_id: string,
        docs: Array<JSON>,
        timeout: number
    ) {
        this.HitsSolverService.checkSolutionStatus(url).subscribe(
            (response) => {
                if (response["finished"] == false) {
                    /* Wait to repull the solution from the solver */
                    setTimeout(() => {
                        this.checkHitStatus(url, task_id, docs, timeout);
                    }, timeout);
                } else {
                    this.HitsSolverService.getSolution(task_id).subscribe(
                        (response) => {
                            let receivedHit = this.HitsSolverService.createHits(
                                response,
                                docs,
                                this.identificationAttribute
                            );
                            this.loadHitsFromResponse(receivedHit);

                            this.ngxService.stopBackground();
                            this.solutionStatus =
                                "Solution from the solver has been received";
                        }
                    );
                }
            }
        );
    }

    resetCountdown() {
        if (this.formStep.get("setCountdownTime").value == false) {
            this.formStep.get("countdown_time").setValue("");
            this.formStep.get("countdown_time").clearValidators();
            this.formStep.get("countdown_time").updateValueAndValidity();
            this.formStep.get("countdown_behavior").setValue("");
            this.formStep.get("countdown_behavior").clearValidators();
            this.formStep.get("countdown_behavior").updateValueAndValidity();
        } else {
            this.formStep
                .get("countdown_time")
                .setValidators([
                    Validators.required,
                    this.utilsService.positiveOrZeroNumber.bind(this),
                ]);
            this.formStep.get("countdown_time").updateValueAndValidity();
            this.formStep
                .get("countdown_behavior")
                .setValidators([Validators.required]);
            this.formStep.get("countdown_behavior").updateValueAndValidity();
        }
        this.resetAdditionalTimes();
    }

    resetAdditionalTimes() {
        if (this.formStep.get("setAdditionalTimes").value == false) {
            this.formStep.get("countdown_modality").setValue("");
            this.formStep.get("countdown_modality").clearValidators();
            this.formStep.get("countdown_modality").updateValueAndValidity();
            this.formStep.get("countdown_attribute").setValue("");
            this.formStep.get("countdown_attribute").clearValidators();
            this.formStep.get("countdown_attribute").updateValueAndValidity();
            this.countdownAttributeValues().clear();
            this.countdownAttributeValues().updateValueAndValidity();
            this.countdownPositionValues().clear();
            this.countdownPositionValues().updateValueAndValidity();
        } else {
            this.formStep
                .get("countdown_modality")
                .setValidators([Validators.required]);
            if (this.formStep.get("countdown_modality").value == "attribute")
                this.formStep
                    .get("countdown_attribute")
                    .setValidators([Validators.required]);
        }
    }

    countdownAttributeValues() {
        return this.formStep.get(
            "countdown_attribute_values"
        ) as UntypedFormArray;
    }

    updateCountdownModality() {
        if (this.formStep.get("countdown_modality").value == "attribute") {
            this.countdownPositionValues().clear();
        } else {
            this.formStep.get("countdown_attribute").setValue(false);
            this.formStep.get("countdown_attribute").clearValidators();
            this.countdownAttributeValues().clear();
            this.countdownAttributeValues().updateValueAndValidity();
            this.updateCountdownPosition();
        }
    }

    updateCountdownAttribute(countdownAttribute = null) {
        if (countdownAttribute) {
            let control = this._formBuilder.group({
                name: countdownAttribute["name"],
                time: countdownAttribute["time"],
            });
            this.countdownAttributeValues().push(control);
        } else {
            this.countdownAttributeValues().clear();
            let chosenAttribute = this.formStep.get(
                "countdown_attribute"
            ).value;
            let values = this.hitsAttributesValues[chosenAttribute];
            for (let value of values) {
                let control = this._formBuilder.group({
                    name: value,
                    time: "",
                });
                this.countdownAttributeValues().push(control);
            }
        }
    }

    countdownPositionValues() {
        return this.formStep.get(
            "countdown_position_values"
        ) as UntypedFormArray;
    }

    updateCountdownPosition(countdownPosition = null) {
        if (countdownPosition) {
            let control = this._formBuilder.group({
                position: countdownPosition["name"],
                time: countdownPosition["time"],
            });
            this.countdownPositionValues().push(control);
        } else {
            this.countdownPositionValues().clear();
            for (let index = 0; index < this.hitsPositions; index++) {
                let control = this._formBuilder.group({
                    position: index,
                    time: "",
                });
                this.countdownPositionValues().push(control);
            }
        }
    }

    annotator() {
        return this.formStep.get("annotator") as UntypedFormGroup;
    }

    setAnnotatorType() {
        if (
            this.annotator().get("type").value == "options" &&
            this.annotatorOptionValues().length == 0
        ) {
            this.annotatorOptionValues().push(
                this._formBuilder.group({
                    label: ["", [Validators.required]],
                    color: ["", [Validators.required]],
                })
            );
        }
    }

    resetAnnotator() {
        for (let attributeControl of this.hitAttributes().controls) {
            attributeControl.get("annotate").setValue(false);
        }
        if (this.formStep.get("setAnnotator").value == false) {
            this.annotator().get("type").setValue("");
            this.annotator().get("type").clearValidators();
            this.annotator().get("type").clearAsyncValidators();
            for (
                let index = 0;
                index < this.annotatorOptionValues().controls.length;
                index++
            ) {
                this.removeAnnotatorOptionValue(index);
            }
        } else {
            this.annotator().get("type").setValidators([Validators.required]);
            this.setAnnotatorType();
        }
        this.annotator().get("type").updateValueAndValidity();
        this.resetHitAttributes();
    }

    /* SUB ELEMENT: Annotator */
    annotatorOptionValues(): UntypedFormArray {
        return this.formStep.get("annotator").get("values") as UntypedFormArray;
    }

    addOptionValue(option = null as Object) {
        this.annotatorOptionValues().push(
            this._formBuilder.group({
                label: [
                    option ? (option["label"] ? option["label"] : "") : "",
                    [Validators.required],
                ],
                color: [
                    option ? (option["color"] ? option["color"] : "") : "",
                    [Validators.required],
                ],
            })
        );
        if (!option) {
            this.annotatorOptionColors.push("");
        }
    }

    updateOptionColor(color, optionIndex) {
        this.annotatorOptionColors[optionIndex] = color;
    }

    removeAnnotatorOptionValue(valueIndex) {
        this.annotatorOptionValues().removeAt(valueIndex);
    }

    messages(): UntypedFormArray {
        return this.formStep.get("messages") as UntypedFormArray;
    }

    addMessage(message = null) {
        this.messages().push(
            this._formBuilder.group({
                message: [message ? message : "", [Validators.required]],
            })
        );
    }

    removeMessage(messageIndex: number) {
        this.messages().removeAt(messageIndex);
    }

    /* JSON Output */

    serializeConfiguration() {
        let taskSettingsJSON = JSON.parse(JSON.stringify(this.formStep.value));

        if (!taskSettingsJSON.time_assessment) {
            taskSettingsJSON.time_assessment = 2;
        }

        if (!taskSettingsJSON.setAnnotator) taskSettingsJSON.annotator = false;
        delete taskSettingsJSON.setAnnotator;

        if (taskSettingsJSON.annotator.type == "options") {
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
            taskSettingsJSON.additional_times =
                taskSettingsJSON.setAdditionalTimes;
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
            let messages = [];
            for (let messageIndex in taskSettingsJSON.messages)
                messages.push(taskSettingsJSON.messages[messageIndex].message);
            taskSettingsJSON.messages = messages;
        }

        this.localStorageService.setItem(
            `task-settings`,
            JSON.stringify(taskSettingsJSON)
        );
        this.configurationSerialized = JSON.stringify(taskSettingsJSON);
    }
}
