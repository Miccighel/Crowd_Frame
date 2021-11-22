/* Core modules */
import {ChangeDetectorRef, Component, ViewChild} from '@angular/core';
/* Reactive forms modules */
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
/* Material design modules */
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {S3Service} from "../../services/s3.service";
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {LocalStorageService} from '../../services/localStorage.service';
/* File handling helpers */
import {ReadFile, ReadMode} from "ngx-file-helpers";
import {Question, Questionnaire} from "../../models/questionnaire";
import {Dimension, Mapping} from "../../models/dimension";
import {Instruction} from "../../models/instructions";
import {SettingsSearchEngine} from "../../models/settingsSearchEngine";
import {Attribute, SettingsTask} from "../../models/settingsTask";
import {Hit} from "../../models/hit";
import {SettingsWorker} from "../../models/settingsWorker";
import {AngularEditorConfig} from "@kolkov/angular-editor";
import {WorkerChecksComponent} from "../generator-steps/worker-checks/worker-checks.component";


/*
 * The following interfaces are used to simplify data handling for each generator step.
 */

/* STEP #1 - Questionnaires */

interface QuestionnaireType {
    value: string;
    viewValue: string;
}

interface QuestionnairePosition {
    value: string;
    viewValue: string;
}

/* STEP #2 - Dimensions */

interface ScaleType {
    value: string;
    viewValue: string;
}

interface StyleType {
    value: string;
    viewValue: string;
}

interface PositionType {
    value: string;
    viewValue: string;
}

interface OrientationType {
    value: string;
    viewValue: string;
}

/* STEP #5 - Search Engine */

interface SourceType {
    value: string;
    viewValue: string;
}

/* STEP #6 - Task Settings */

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

/* Component HTML Tag definition */
@Component({
    selector: 'app-generator',
    templateUrl: './generator.component.html',
    styleUrls: ['./generator.component.scss']
})

/*
 * This class implements the generator of custom task configurations
 */
export class GeneratorComponent {

    /*
     * The following elements are used to define the forms to be filled for
     * each generator step and some data types to allow easier data handling
     */

    /* STEP #1 - Questionnaires */
    questionnairesForm: FormGroup;
    questionnaireTypes: QuestionnaireType[] = [
        {value: 'crt', viewValue: 'CRT'},
        {value: 'likert', viewValue: 'Likert'},
        {value: 'standard', viewValue: 'Standard'}
    ];
    questionnairePosition: QuestionnairePosition[] = [
        {value: 'start', viewValue: 'Start'},
        {value: 'end', viewValue: 'End'},
    ];

    questionnairesFetched: Array<Questionnaire>
    questionnairesSerialized: string

    /* STEP #2 - Dimensions */
    dimensionsForm: FormGroup;
    scaleTypes: ScaleType[] = [
        {value: 'categorical', viewValue: 'Categorical'},
        {value: 'interval', viewValue: 'Interval'},
        {value: 'magnitude_estimation', viewValue: 'Magnitude Estimation'}
    ];
    annotatorTypes: AnnotatorType[] = [
        {value: 'options', viewValue: 'Options'},
        {value: 'laws', viewValue: 'Laws'},
    ];
    styleTypes: StyleType[] = [
        {value: 'list', viewValue: 'List'},
        {value: 'matrix', viewValue: 'Matrix'}
    ];
    positionTypes: PositionType[] = [
        {value: 'top', viewValue: 'Top'},
        {value: 'middle', viewValue: 'Middle'},
        {value: 'bottom', viewValue: 'Bottom'}
    ];
    orientationTypes: OrientationType[] = [
        {value: 'horizontal', viewValue: 'Horizontal'},
        {value: 'vertical', viewValue: 'Vertical'}
    ];
    dimensionsFetched: Array<Dimension>
    dimensionsSerialized: string

    /* STEP #3 - General Instructions */
    generalInstructionsForm: FormGroup;
    generalInstructionsFetched: Array<Instruction>
    generalInstructionsSerialized: string

    /* STEP #4 - Evaluation Instructions */
    evaluationInstructionsForm: FormGroup;
    evaluationInstructionsFetched: Array<Instruction>
    evaluationInstructionsSerialized: string

    /* STEP #5 - Search Engine */
    searchEngineForm: FormGroup;
    sourceTypes: SourceType[] = [
        {value: null, viewValue: 'None'},
        {value: 'BingWebSearch', viewValue: 'BingWeb'},
        {value: 'FakerWebSearch', viewValue: 'FakerWeb'},
        {value: 'PubmedSearch', viewValue: 'Pubmed'}
    ];
    searchEngineFetched: SettingsSearchEngine
    searchEngineSerialized: string

    /* STEP #6 - Task Settings */
    taskSettingsForm: FormGroup;
    taskSettingsFetched: SettingsTask
    taskSettingsSerialized: string
    modalityTypes: ModalityType[] = [
        {value: 'pointwise', viewValue: 'Pointwise'},
        {value: 'pairwise', viewValue: 'Pairwise'},
    ];
    countdownBehavior: ModalityType[] = [
        {value: 'disable_form', viewValue: 'Disable Forms'},
        {value: 'hide_attributes', viewValue: 'Hide Attributes'},
    ];
    additionalTimeModalities: ModalityType[] = [
        {value: 'attribute', viewValue: 'Attribute'},
        {value: 'position', viewValue: 'Position'},
    ];
    batchesTree: Array<JSON>
    batchesTreeInitialization: boolean
    batchesTreeSerialized: Array<JSON>
    annotatorOptionColors: Array<string>
    /* Variables to handle hits file upload */
    hitsFile: ReadFile
    hitsFileName: string
    hitsParsed: Array<Hit>
    hitsParsedString: string
    hitsAttributes: Array<string>
    hitsAttributesValues: Object
    hitsPositions: number
    hitsSize: number
    hitsDetected: number
    readMode: ReadMode

    /* STEP #7 - Worker Checks */

    @ViewChild(WorkerChecksComponent) workerChecks: WorkerChecksComponent;
    workerChecksForm: FormGroup
    workerChecksResult: string

    /* STEP #8 - Summary */

    uploadStarted: boolean
    uploadCompleted: boolean
    /* S3 Bucket base upload path */
    fullS3Path: string
    /* questionnaires.json upload path */
    questionnairesPath: string
    /* hits.json upload path */
    hitsPath: string
    /* dimensions.json upload path */
    dimensionsPath: string
    /* instructions_main.json upload path */
    taskInstructionsPath: string
    /* instructions_dimension.json upload path */
    dimensionsInstructionsPath: string
    /* search_engine.json upload path */
    searchEngineSettingsPath: string
    /* task.json upload path */
    taskSettingsPath: string
    /* workers.json upload path */
    workerChecksPath: string

    /* |--------- SERVICES & CO - DECLARATION ---------| */

    /* Loading screen service */
    ngxService: NgxUiLoaderService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    cloneTask: FormControl
    taskCloned: boolean

    /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

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
            {name: 'Yellow Highlight', class: 'highlight-yellow',},
            {name: 'Green Highlight', class: 'highlight-green',},
            {name: 'Orange Highlight', class: 'highlight-orange',}
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
        private _formBuilder: FormBuilder,
    ) {

        /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

        /* Service initialization */
        this.ngxService = ngxService
        this.configService = configService
        this.S3Service = S3Service
        this.changeDetector = changeDetector
        this.localStorageService = localStorageService
        this.ngxService.startLoader('generator-inner')

        this.questionnairesFetched = []
        this.dimensionsFetched = []
        this.generalInstructionsFetched = []
        this.evaluationInstructionsFetched = []
        this.searchEngineFetched = new SettingsSearchEngine()
        this.taskSettingsFetched = new SettingsTask()

        /* STEP #8 - Summary */

        this.fullS3Path = `${this.configService.environment.region}/${this.configService.environment.bucket}/${this.configService.environment.taskName}/${this.configService.environment.batchName}/`
        this.uploadStarted = false
        this.uploadCompleted = false
        this.questionnairesPath = null
        this.dimensionsPath = null
        this.taskInstructionsPath = null
        this.dimensionsInstructionsPath = null
        this.searchEngineSettingsPath = null
        this.workerChecksPath = null

        this.ngxService.startLoader('generator-inner')

        this.cloneTask = new FormControl();
        this.taskCloned = false

        this.configService.environment['taskNameInitial'] = this.configService.environment['taskName']
        this.configService.environment['batchNameInitial'] = this.configService.environment['batchName']

        this.performGeneratorSetup()

        /* Read mode during hits file upload*/
        this.readMode = ReadMode.text
    }

    async performGeneratorSetup() {

        let differentTask = false
        let serializedTaskName = this.localStorageService.getItem('task-name')
        if (serializedTaskName) {
            serializedTaskName = serializedTaskName.replace(/"/g, '');
            if (serializedTaskName != this.configService.environment.taskName) differentTask = true
        } else {
            this.localStorageService.setItem(`task-name`, JSON.stringify(this.configService.environment.taskName))
        }
        let differentBatch = false
        let serializedBatchName = this.localStorageService.getItem('batch-name')
        if (serializedBatchName) {
            serializedBatchName = serializedBatchName.replace(/"/g, '');
            if (serializedBatchName != this.configService.environment.batchName) differentBatch = true
        } else {
            this.localStorageService.setItem(`batch-name`, JSON.stringify(this.configService.environment.batchName))
        }
        if (differentTask && differentBatch) this.localStorageService.clear()

        /* STEP #1 - Questionnaires */

        let serializedQuestionnaires = Object.keys(localStorage).filter((key) => key.startsWith('questionnaire-'))
        if (serializedQuestionnaires.length > 0) {
            serializedQuestionnaires.forEach(questionnaireKey => {
                let index = questionnaireKey.split("-")[1]
                let item = this.localStorageService.getItem(`questionnaire-${index}`)
                this.questionnairesFetched.push(JSON.parse(item))
            })
        } else {
            let rawQuestionnaires = await this.S3Service.downloadQuestionnaires(this.configService.environment)
            rawQuestionnaires.forEach((data, index) => {
                let questionnaire = new Questionnaire(index, data)
                this.questionnairesFetched.push(questionnaire)
                this.localStorageService.setItem(`questionnaire-${index}`, JSON.stringify(questionnaire))
            })
        }
        this.questionnairesForm = this._formBuilder.group({
            questionnaires: this._formBuilder.array([])
        });
        if (this.questionnairesFetched.length > 0) {
            this.questionnairesFetched.forEach((questionnaire, questionnaireIndex) => {
                this.addQuestionnaire(questionnaireIndex, questionnaire)
            })
        }
        this.questionnairesForm.valueChanges.subscribe(forms => {
            this.questionnairesJSON()
        })
        this.questionnairesJSON()

        /* STEP #2 - Dimensions */

        let serializedDimensions = Object.keys(localStorage).filter((key) => key.startsWith('dimension-'))
        if (serializedDimensions.length > 0) {
            serializedDimensions.forEach(key => {
                let index = key.split("-")[1]
                let item = this.localStorageService.getItem(`dimension-${index}`)
                this.dimensionsFetched.push(JSON.parse(item))
            })
        } else {
            let rawDimensions = await this.S3Service.downloadDimensions(this.configService.environment)
            rawDimensions.forEach((data, index) => {
                let dimension = new Dimension(index, data)
                this.dimensionsFetched.push(dimension)
                this.localStorageService.setItem(`dimension-${index}`, JSON.stringify(dimension))
            })
        }
        this.dimensionsForm = this._formBuilder.group({
            dimensions: this._formBuilder.array([])
        });
        if (this.dimensionsFetched.length > 0) {
            this.dimensionsFetched.forEach((dimension, dimensionIndex) => {
                this.addDimension(dimensionIndex, dimension)
            })
        }
        this.dimensionsForm.valueChanges.subscribe(forms => {
            this.dimensionsJSON()
        })
        this.dimensionsJSON()

        /* STEP #3 - General Instructions */

        let serializedGeneralInstructions = Object.keys(localStorage).filter((key) => key.startsWith('general-instruction-'))
        if (serializedGeneralInstructions.length > 0) {
            serializedGeneralInstructions.forEach(key => {
                let index = key.split("-")[2]
                let item = this.localStorageService.getItem(`general-instruction-${index}`)
                this.generalInstructionsFetched.push(JSON.parse(item))
            })
        } else {
            let rawGeneralInstructions = await this.S3Service.downloadGeneralInstructions(this.configService.environment)
            rawGeneralInstructions.forEach((data, index) => {
                let generalInstruction = new Instruction(index, data)
                this.generalInstructionsFetched.push(generalInstruction)
                this.localStorageService.setItem(`general-instruction-${index}`, JSON.stringify(generalInstruction))
            })
        }
        this.generalInstructionsForm = this._formBuilder.group({
            generalInstructions: this._formBuilder.array([])
        });
        if (this.generalInstructionsFetched.length > 0) {
            this.generalInstructionsFetched.forEach((instruction, instructionIndex) => {
                this.addGeneralInstruction(instructionIndex, instruction)
            })
        }
        this.generalInstructionsForm.valueChanges.subscribe(forms => {
            this.generalInstructionsJSON()
        })
        this.generalInstructionsJSON()

        /* STEP #4 - Evaluation Instructions */

        let serializedEvaluationInstructions = Object.keys(localStorage).filter((key) => key.startsWith('evaluation-instruction-'))
        if (serializedEvaluationInstructions.length > 0) {
            serializedEvaluationInstructions.forEach(key => {
                let index = key.split("-")[2]
                let item = this.localStorageService.getItem(`evaluation-instruction-${index}`)
                this.evaluationInstructionsFetched.push(JSON.parse(item))
            })
        } else {
            let rawEvaluationInstructions = await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
            rawEvaluationInstructions.forEach((data, index) => {
                let evaluationInstruction = new Instruction(index, data)
                this.evaluationInstructionsFetched.push(evaluationInstruction)
                this.localStorageService.setItem(`evaluation-instruction-${index}`, JSON.stringify(evaluationInstruction))
            })
        }
        this.evaluationInstructionsForm = this._formBuilder.group({
            evaluationInstructions: this._formBuilder.array([])
        });
        if (this.evaluationInstructionsFetched.length > 0) {
            this.evaluationInstructionsFetched.forEach((instruction, instructionIndex) => {
                this.addEvaluationInstruction(instructionIndex, instruction)
            })
        }
        this.evaluationInstructionsForm.valueChanges.subscribe(forms => {
            this.evaluationInstructionsJSON()
        })
        this.evaluationInstructionsJSON()

        /* STEP #5 - Search Engine Settings */

        let serializedSearchEngineSettings = this.localStorageService.getItem("search-engine-settings")
        if (serializedSearchEngineSettings) {
            this.searchEngineFetched = new SettingsSearchEngine(JSON.parse(serializedSearchEngineSettings))
        } else {
            let rawSearchEngineSettings = await this.S3Service.downloadSearchEngineSettings(this.configService.environment)
            this.searchEngineFetched = new SettingsSearchEngine(rawSearchEngineSettings)
            this.localStorageService.setItem(`search-engine-settings`, JSON.stringify(rawSearchEngineSettings))
        }
        this.searchEngineForm = this._formBuilder.group({
            source: [this.searchEngineFetched ? this.searchEngineFetched.source : ''],
            domains_filter: this._formBuilder.array([])
        });
        if (this.searchEngineFetched) if (this.searchEngineFetched.domains_filter) if (this.searchEngineFetched.domains_filter.length > 0) this.searchEngineFetched.domains_filter.forEach((domain, domainIndex) => this.addDomain(domain))
        this.searchEngineForm.valueChanges.subscribe(form => {
            this.searchEngineJSON()
        })
        this.searchEngineJSON()

        /* STEP #6 - Task Settings */

        let serializedTaskSettings = this.localStorageService.getItem("task-settings")
        if (serializedTaskSettings) {
            this.taskSettingsFetched = new SettingsTask(JSON.parse(serializedTaskSettings))
        } else {
            let rawTaskSettings = await this.S3Service.downloadTaskSettings(this.configService.environment)
            this.taskSettingsFetched = new SettingsTask(rawTaskSettings)
            this.localStorageService.setItem(`task-settings`, JSON.stringify(rawTaskSettings))
        }
        this.annotatorOptionColors = ['#FFFF7B']
        if (this.taskSettingsFetched.annotator) {
            if (this.taskSettingsFetched.annotator.type == "options") {
                if (this.taskSettingsFetched.annotator.values.length > 0) {
                    this.annotatorOptionColors = []
                    this.taskSettingsFetched.annotator.values.forEach((optionValue, optionValueIndex) => {
                        this.annotatorOptionColors.push(optionValue['color'])
                    })
                }
            }
        }
        this.batchesTreeInitialization = false

        this.taskSettingsForm = this._formBuilder.group({
            modality: this.taskSettingsFetched ? this.taskSettingsFetched.modality ? this.taskSettingsFetched.modality : '' : '',
            allowed_tries: this.taskSettingsFetched ? this.taskSettingsFetched.allowed_tries ? this.taskSettingsFetched.allowed_tries : '' : '',
            time_check_amount: this.taskSettingsFetched ? this.taskSettingsFetched.time_check_amount ? this.taskSettingsFetched.time_check_amount : '' : '',
            attributes: this._formBuilder.array([]),
            setAnnotator: !!this.taskSettingsFetched.annotator,
            annotator: this._formBuilder.group({
                type: this.taskSettingsFetched.annotator ? this.taskSettingsFetched.annotator.type ? this.taskSettingsFetched.annotator.type : '' : '',
                values: this._formBuilder.array([]),
            }),
            setCountdownTime: this.taskSettingsFetched.countdown_time >= 0 ? true : '',
            countdown_time: this.taskSettingsFetched.countdown_time >= 0 ? this.taskSettingsFetched.countdown_time : '',
            countdown_behavior: this.taskSettingsFetched.countdown_behavior ? this.taskSettingsFetched.countdown_behavior : '',
            setAdditionalTimes: this.taskSettingsFetched.countdown_modality ? true : '',
            countdown_modality: this.taskSettingsFetched.countdown_modality ? this.taskSettingsFetched.countdown_modality ? this.taskSettingsFetched.countdown_modality : '' : '',
            countdown_attribute: this.taskSettingsFetched.countdown_attribute ? this.taskSettingsFetched.countdown_attribute ? this.taskSettingsFetched.countdown_attribute : '' : '',
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: !!this.taskSettingsFetched.logger,
            logOption: this.taskSettingsFetched.logOption,
            serverEndpoint: this.taskSettingsFetched.serverEndpoint
        });
        if (this.taskSettingsFetched.messages) if (this.taskSettingsFetched.messages.length > 0) this.taskSettingsFetched.messages.forEach((message, messageIndex) => this.addMessage(message))
        if (this.taskSettingsFetched.annotator) if (this.taskSettingsFetched.annotator.type == "options") this.taskSettingsFetched.annotator.values.forEach((optionValue, optionValueIndex) => this.addOptionValue(optionValue))
        if (this.taskSettingsFetched.countdown_time >= 0) {
            if (this.taskSettingsFetched.countdown_modality == 'attribute') {
                if (this.taskSettingsFetched.countdown_attribute_values) {
                    for (let countdownAttribute of this.taskSettingsFetched.countdown_attribute_values) {
                        this.updateCountdownAttribute(countdownAttribute)
                    }
                }
            }
        }
        if (this.taskSettingsFetched.countdown_time >= 0) {
            if (this.taskSettingsFetched.countdown_modality == 'position') {
                if (this.taskSettingsFetched.countdown_position_values) {
                    for (let countdownPosition of this.taskSettingsFetched.countdown_position_values) {
                        this.updateCountdownPosition(countdownPosition)
                    }
                }
            }
        }
        this.taskSettingsForm.valueChanges.subscribe(form => {
            this.taskSettingsJSON()
        })
        this.taskSettingsJSON()

        let hitsPromise = this.loadHits()
        let batchesPromise = this.loadBatchesTree()
        batchesPromise.then((result) => {
            this.changeDetector.detectChanges()
        })

        this.ngxService.stopLoader("generator-inner")

    }

    async clonePreviousBatch(data: Object) {
        this.ngxService.startLoader('generator-inner')
        this.localStorageService.clear()
        this.questionnairesFetched = []
        this.dimensionsFetched = []
        this.generalInstructionsFetched = []
        this.evaluationInstructionsFetched = []
        this.searchEngineFetched = new SettingsSearchEngine()
        this.taskSettingsFetched = new SettingsTask()
        this.workerChecks.dataStored = new SettingsWorker()
        this.generator.selectedIndex = 0
        let taskName = null
        let batchName = null
        for (let taskNode of this.batchesTree) {
            for (let batchNode of taskNode['batches']) {
                if (batchNode['batch'] == data['value']) {
                    taskName = taskNode['task']
                    batchName = batchNode['batch']
                }
            }
        }
        this.configService.environment['taskName'] = taskName.slice(0, -1)
        this.configService.environment['batchName'] = batchName.slice(0, -1).replace(taskName, "")
        this.taskCloned = true
        this.performGeneratorSetup()
        this.changeDetector.detectChanges()
        this.ngxService.stopLoader('generator-inner')
    }

    async clearClonedBatch() {
        this.ngxService.startLoader('generator-inner')
        this.localStorageService.clear()
        this.cloneTask = new FormControl('')
        this.taskCloned = false
        this.questionnairesFetched = []
        this.dimensionsFetched = []
        this.generalInstructionsFetched = []
        this.evaluationInstructionsFetched = []
        this.searchEngineFetched = new SettingsSearchEngine()
        this.taskSettingsFetched = new SettingsTask()
        this.workerChecks.dataStored = new SettingsWorker()
        this.generator.selectedIndex = 0
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial']
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial']
        this.performGeneratorSetup()
        this.changeDetector.detectChanges()
        this.ngxService.stopLoader('generator-inner')
    }

    async loadHits() {
        let hits = JSON.parse(this.localStorageService.getItem('hits'))
        if (hits) {
            this.updateHitsFile(hits)
            this.localStorageService.setItem(`hits`, JSON.stringify(hits))
        } else {
            let hits = []
            try {
                hits = await this.S3Service.downloadHits(this.configService.environment)
            } catch (exception) {
            }
            this.localStorageService.setItem(`hits`, JSON.stringify(hits))
            this.updateHitsFile(hits)
        }
    }

    async loadBatchesTree() {

        this.batchesTreeSerialized = JSON.parse(this.localStorageService.getItem('batches-tree'))
        this.batchesTree = []
        if (this.batchesTreeSerialized) {
            this.batchesTree = this.batchesTreeSerialized
        } else {
            let counter = 0
            let blackListedBatches = 0
            let whiteListedBatches = 0
            let tasks = await this.S3Service.listFolders(this.configService.environment)
            for (let task of tasks) {
                let taskNode = {
                    "task": task['Prefix'],
                    "batches": []
                }
                let batches = await this.S3Service.listFolders(this.configService.environment, task['Prefix'])
                for (let batch of batches) {
                    let batchNode = {
                        "batch": batch['Prefix'],
                        "blacklist": false,
                        "whitelist": false,
                        "counter": counter
                    }
                    if (this.workerChecks.dataStored.blacklist_batches) {
                        this.workerChecks.dataStored.blacklist_batches.forEach((batchName, batchIndex) => {
                            blackListedBatches = blackListedBatches + 1
                            batchNode['blacklist'] = batchName == batch["Prefix"];
                        })
                    }
                    if (this.workerChecks.dataStored.whitelist_batches) {
                        this.workerChecks.dataStored.whitelist_batches.forEach((batchName, batchIndex) => {
                            whiteListedBatches = whiteListedBatches + 1
                            batchNode['whitelist'] = batchName == batch["Prefix"];
                        })
                    }
                    taskNode["batches"].push(batchNode)
                    counter = counter + 1
                }
                this.batchesTree.push(JSON.parse(JSON.stringify(taskNode)))
            }
            this.localStorageService.setItem(`batches-tree`, JSON.stringify(this.batchesTree))
        }
        this.batchesTreeInitialization = true
    }

    /* The following functions are sorted on a per-step basis. For each step it may be present:
     * - a function which returns the filled form (i.e., questionnaires())
     * - a function which returns the values of a sub element (i.e., questions())
     * - a function called addXXX which adds a new sub element to the form (i.e., addQuestion())
     * - a function called removeXXX which removes a sub element from the form (i.e., removeQuestion())
     * - a function called updateXXX which updates an already present sub element to responds to values chosen
     *   in other fiels (i.e., updateQuestionnaire())
     * - a funcion called resetXXX which resets a single field or a sub element (i.e., resetJustification())
     * - a function called xxxJSON which outputs the values of a single step's form as a JSON dictionary (i.e., questionnairesJSON())
     * */

    async checkProgressStatus(stepperStatus) {

        if (stepperStatus.selectedIndex == 7) {
            this.questionnairesJSON()
            this.dimensionsJSON()
            this.generalInstructionsJSON()
            this.questionnairesJSON()
            this.searchEngineJSON()
            this.taskSettingsJSON()
            this.workerChecks.serializeConfiguration()
        }

    }

    /* STEP #1 - Questionnaires */

    questionnaires(): FormArray {
        return this.questionnairesForm.get('questionnaires') as FormArray;
    }

    addQuestionnaire(questionnaireIndex = null, questionnaire = null as Questionnaire) {
        this.questionnaires().push(this._formBuilder.group({
            type: questionnaire ? questionnaire.type ? questionnaire.type : '' : '',
            description: questionnaire ? questionnaire.description ? questionnaire.description : '' : '',
            position: questionnaire ? questionnaire.position ? questionnaire.position : '' : '',
            questions: this._formBuilder.array([]),
            mapping: this._formBuilder.array([])
        }))
        if (questionnaire) {
            questionnaire.questions.forEach((question, questionIndex) => this.addQuestion(questionnaireIndex, questionIndex, question))
        }
    }

    removeQuestionnaire(questionnaireIndex: number) {
        this.questionnaires().removeAt(questionnaireIndex);
    }

    updateQuestionnaire(questionnaireIndex) {
        let questionnaire = this.questionnaires().at(questionnaireIndex);

        questionnaire.get('description').setValue('');
        questionnaire.get('description').clearValidators();
        questionnaire.get('description').updateValueAndValidity();

        this.questions(questionnaireIndex).clear();
        this.mapping(questionnaireIndex).clear();

        this.addQuestion(questionnaireIndex);
        if (questionnaire.get('type').value == 'likert') {
            this.addMapping(questionnaireIndex);
        }
    }

    /* SUB ELEMENT: Questions */

    questions(questionnaireIndex: number): FormArray {
        return this.questionnaires().at(questionnaireIndex).get('questions') as FormArray;
    }

    addQuestion(questionnaireIndex: number, questionIndex = null as number, question = null as Question) {
        this.questions(questionnaireIndex).push(this._formBuilder.group({
            name: question ? question.name ? question.name : '' : '',
            text: question ? question.name ? question.name : '' : '',
            answers: this._formBuilder.array([])
        }));
        if (question && question.answers) for (let answer of question.answers) this.addAnswer(questionnaireIndex, questionIndex, answer)
        if (this.questionnaires().at(questionnaireIndex).get('type').value == 'standard' && this.questions(questionnaireIndex).length == 0) {
            this.addAnswer(questionnaireIndex, this.questions(questionnaireIndex).length - 1);
        }
    }

    removeQuestion(questionnaireIndex: number, questionIndex: number) {
        this.questions(questionnaireIndex).removeAt(questionIndex);
    }

    /* SUB ELEMENT: Answers */

    answers(questionnaireIndex: number, questionIndex: number): FormArray {
        return this.questions(questionnaireIndex).at(questionIndex).get('answers') as FormArray;
    }

    addAnswer(questionnaireIndex: number, questionIndex: number, answer = null as string) {
        this.answers(questionnaireIndex, questionIndex).push(this._formBuilder.group({
            answer: answer ? answer : ''
        }))
    }

    removeAnswer(questionnaireIndex: number, questionIndex: number, answerIndex: number) {
        this.answers(questionnaireIndex, questionIndex).removeAt(answerIndex);
    }

    /* SUB ELEMENT: Mappings  */

    mapping(questionnaireIndex: number): FormArray {
        return this.questionnaires().at(questionnaireIndex).get('mapping') as FormArray;
    }

    addMapping(questionnaireIndex: number) {
        this.mapping(questionnaireIndex).push(this._formBuilder.group({
            label: '',
            value: ''
        }))
    }

    removeMapping(questionnaireIndex: number, mappingIndex: number) {
        this.mapping(questionnaireIndex).removeAt(mappingIndex);
    }

    /* JSON Output */

    questionnairesJSON() {
        let serializedQuestionnaires = Object.keys(localStorage).filter((key) => key.startsWith('questionnaire-'))
        if (serializedQuestionnaires.length > 0) serializedQuestionnaires.forEach(questionnaireKey => this.localStorageService.removeItem(questionnaireKey))
        let questionnairesJSON = JSON.parse(JSON.stringify(this.questionnairesForm.get('questionnaires').value));
        questionnairesJSON.forEach((questionnaire, questionnaireIndex) => {
            switch (questionnaire.type) {
                case 'crt':
                    delete questionnaire.description;
                    for (let questionIndex in questionnaire.questions) {
                        delete questionnaire.questions[questionIndex].answers;
                    }
                    delete questionnaire.mapping;
                    break;

                case 'likert':
                    for (let questionIndex in questionnaire.questions) {
                        delete questionnaire.questions[questionIndex].answers;
                    }
                    break;

                case 'standard':
                    delete questionnaire.description;
                    for (let questionIndex in questionnaire.questions) {
                        let answersStringArray = [];
                        for (let answerIndex in questionnaire.questions[questionIndex].answers) {
                            answersStringArray.push(questionnaire.questions[questionIndex].answers[answerIndex].answer);
                        }
                        questionnaire.questions[questionIndex].answers = answersStringArray;
                    }
                    delete questionnaire.mapping;
                    break;
                default:
                    break;
            }
            this.localStorageService.setItem(`questionnaire-${questionnaireIndex}`, JSON.stringify(questionnaire))
        })
        this.questionnairesSerialized = JSON.stringify(questionnairesJSON)
    }

    /* STEP #2 - Dimensions */

    dimensions(): FormArray {
        return this.dimensionsForm.get('dimensions') as FormArray;
    }

    addDimension(dimensionIndex = null, dimension = null as Dimension) {
        let name, name_pretty, description, gold, setJustification, justification, url, setScale, scale, setStyle, style;
        name = dimension ? dimension.name ? dimension.name : '' : '';
        name_pretty = dimension ? dimension.name_pretty ? dimension.name_pretty : '' : '';
        description = dimension ? dimension.description ? dimension.description : '' : '';
        gold = dimension ? dimension.gold ? dimension.gold : false : false
        setJustification = dimension ? dimension.justification ? dimension.justification : false : false;
        justification = this._formBuilder.group({text: '', min_words: ''})
        if (dimension) {
            if (dimension.justification) {
                justification = this._formBuilder.group({
                    text: [dimension.justification.text],
                    min_words: [dimension.justification.min_words]
                })
            }
        }
        url = dimension ? dimension.url ? dimension.url : false : false
        setScale = dimension ? dimension.scale ? dimension.scale : false : false
        scale = this._formBuilder.group({
            type: '',
            min: '',
            max: '',
            step: '',
            mapping: this._formBuilder.array([]),
            lower_bound: '',
        })
        if (dimension) {
            if (dimension.scale) {
                scale = this._formBuilder.group({
                    type: [dimension.scale.type],
                    min: [dimension.scale['min'] ? dimension.scale['min'] : dimension.scale['min'] == 0 ? 0 : ''],
                    max: [dimension.scale['max'] ? dimension.scale['max'] : dimension.scale['max'] == 0 ? 0 : ''],
                    step: [dimension.scale['step'] ? dimension.scale['step'] : dimension.scale['step'] == 0 ? 0 : ''],
                    mapping: this._formBuilder.array([]),
                    lower_bound: [dimension.scale['lower_bound'] ? dimension.scale['lower_bound'] : '']
                })
            }
        }
        setStyle = dimension ? dimension.style ? dimension.style : false : false
        style = this._formBuilder.group({
            styleType: '',
            position: '',
            orientation: '',
            separator: ''
        })
        if (dimension) {
            if (dimension.style) {
                style = this._formBuilder.group({
                    styleType: [dimension.style.type],
                    position: [dimension.style.position],
                    orientation: [dimension.style.orientation],
                    separator: [dimension.style.separator]
                })
            }
        }
        this.dimensions().push(this._formBuilder.group({
            name: name,
            name_pretty: name_pretty,
            description: description,
            gold: gold,
            setJustification: setJustification,
            justification: justification,
            url: url,
            setScale: setScale,
            scale: scale,
            setStyle: setStyle,
            style: style
        }))
        if (dimension) {
            if (dimension.scale) if (dimension.scale.type == 'categorical') {
                if (dimension.scale['mapping']) for (let mapping of dimension.scale['mapping']) this.addDimensionMapping(dimensionIndex, mapping)
                if (this.dimensionMapping(dimensionIndex).length == 0) this.addDimensionMapping(dimensionIndex)
            }
            if (dimension.style)
                this.updateStyleType(dimensionIndex)
        }
    }

    removeDimension(dimensionIndex: number) {
        this.dimensions().removeAt(dimensionIndex);
    }

    resetJustification(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);

        dim.get('justification').get('text').setValue('');
        dim.get('justification').get('min_words').setValue('');

        if (dim.get('setJustification').value == false) {
            dim.get('justification').get('text').clearValidators();
            dim.get('justification').get('min_words').clearValidators();
        } else {
            dim.get('justification').get('text').setValidators(Validators.required);
            dim.get('justification').get('min_words').setValidators(Validators.required);
        }
        dim.get('justification').get('text').updateValueAndValidity();
        dim.get('justification').get('min_words').updateValueAndValidity();
    }

    resetScale(dimensionIndex) {
        this.updateScale(dimensionIndex);
        this.updateStyleType(dimensionIndex);
    }

    updateScale(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);

        if (dim.get('setScale').value == false) {
            dim.get('scale').get('type').clearValidators();
            dim.get("setStyle").setValue(false)
            dim.get("setStyle").disable()
        } else {
            dim.get('scale').get('type').setValidators(Validators.required);
        }

        dim.get('scale').get('min').setValue('');
        dim.get('scale').get('min').clearValidators();
        dim.get('scale').get('min').updateValueAndValidity();

        dim.get('scale').get('max').setValue('');
        dim.get('scale').get('max').clearValidators();
        dim.get('scale').get('max').updateValueAndValidity();

        dim.get('scale').get('step').setValue('');
        dim.get('scale').get('step').clearValidators();
        dim.get('scale').get('step').updateValueAndValidity();

        dim.get('scale').get('lower_bound').setValue(true);
        dim.get('scale').get('lower_bound').clearValidators();
        dim.get('scale').get('lower_bound').updateValueAndValidity();

        this.dimensionMapping(dimensionIndex).clear();

        if (dim.get('setScale').value == true && dim.get('scale').get('type').value == 'categorical') {
            this.addDimensionMapping(dimensionIndex);
        }

        if (dim.get('setScale').value == true) {
            switch (dim.get('scale').get('type').value) {
                case "categorical":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').enable()
                    dim.get('style').get('styleType').setValue('list')
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').enable()
                    dim.get('style').get('orientation').setValue('vertical')
                    this.updateStyleType(dimensionIndex)
                    break;
                case "interval":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').setValue("list")
                    dim.get('style').get('styleType').disable()
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    this.updateStyleType(dimensionIndex)
                    break;
                case "magnitude_estimation":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').setValue("list")
                    dim.get('style').get('styleType').disable()
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    this.updateStyleType(dimensionIndex)
                    break;
                default:
                    dim.get('setStyle').disable()
            }
        }
    }

    resetStyle(dimensionIndex) {
        this.updateStyleType(dimensionIndex);
    }

    updateStyleType(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);
        let styleType = dim.get('style').get('styleType').value;
        if (dim.get('setStyle').value == true) {
            dim.get('style').get('styleType').setValidators(Validators.required);
            dim.get('style').get('position').setValidators(Validators.required);
            dim.get('style').get('orientation').setValidators(Validators.required);
            dim.get('style').get('separator').setValidators(Validators.required);
            switch (styleType) {
                case "matrix":
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    dim.get("style").get('separator').enable()
                    break;
                case "list":
                    if (dim.get('scale').get('type')) {
                        if (dim.get('scale').get('type').value == "categorical") {
                            dim.get('style').get('orientation').enable()
                        } else {
                            dim.get('style').get('orientation').disable()
                        }
                    }
                    dim.get("style").get('separator').disable()
                    dim.get("style").get('separator').setValue(false)
                    break;
                default:
                    dim.get('style').get('position').setValue('middle')
                    dim.get("style").get('orientation').disable()
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get("style").get('separator').disable()
                    dim.get("style").get('separator').setValue(false)
            }
            dim.get('style').get('styleType').updateValueAndValidity();
            dim.get('style').get('position').updateValueAndValidity();
            dim.get('style').get('orientation').updateValueAndValidity();
            dim.get('style').get('separator').updateValueAndValidity();
        }

    }

    /* SUB ELEMENT: Mapping */

    dimensionMapping(dimensionIndex: number): FormArray {
        return this.dimensions().at(dimensionIndex).get('scale').get('mapping') as FormArray;
    }

    addDimensionMapping(dimensionIndex: number, mapping = null as Mapping) {
        this.dimensionMapping(dimensionIndex).push(this._formBuilder.group({
            label: mapping ? mapping.label ? mapping.label : '' : '',
            description: mapping ? mapping.description ? mapping.description : '' : '',
            value: mapping ? mapping.value ? mapping.value : '' : ''
        }))
    }

    removeDimensionMapping(dimensionIndex: number, dimensionMappingIndex: number) {
        this.dimensionMapping(dimensionIndex).removeAt(dimensionMappingIndex);
    }

    /* JSON Output */

    dimensionsJSON() {

        let serializedDimensions = Object.keys(localStorage).filter((key) => key.startsWith('dimension-'))
        if (serializedDimensions.length > 0) serializedDimensions.forEach(key => this.localStorageService.removeItem(key))

        let dimensionsJSON = JSON.parse(JSON.stringify(this.dimensionsForm.get('dimensions').value));

        dimensionsJSON.forEach((dimension, dimensionIndex) => {

            if (dimension.description == '') dimension.description = false

            dimension.gold = !!dimension.gold;

            if (!dimension.setJustification) dimension.justification = false
            delete dimension.setJustification;

            dimension.url = !!dimension.url;

            if (dimension.setScale == false) {
                delete dimension.scale
                dimension.scale = false
                dimension.style = false
            } else {
                switch (dimension.scale.type) {
                    case 'categorical':
                        delete dimension.scale.min;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        delete dimension.scale.lower_bound;
                        break;
                    case 'interval':
                        delete dimension.scale.mapping;
                        delete dimension.scale.lower_bound;
                        break;
                    case 'magnitude_estimation':
                        delete dimension.scale.mapping;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        delete dimension.scale.mapping;
                        break;
                    default:
                        break;
                }
            }
            delete dimension.setScale;

            if (dimension.style) {

                if (dimension.setStyle) {
                    dimension.style.type = dimension.style.styleType;
                    delete dimension.style.styleType;

                    if (!dimension.style.type) dimension.style.type = ''
                    if (!dimension.style.position) dimension.style.position = ''

                    if (dimension.scale.type == 'interval' || dimension.scale.type == 'magnitude_estimation') {
                        dimension.style.type = 'list'
                        dimension.style.orientation = 'vertical'
                    }
                    if (dimension.scale.type == 'categorical' && dimension.style.type == 'matrix') dimension.style.orientation = false

                    dimension.style.separator = !!dimension.style.separator;
                } else {
                    dimension.style = false
                }


            } else {
                dimension.style = false
            }
            delete dimension.setStyle;

            this.localStorageService.setItem(`dimension-${dimensionIndex}`, JSON.stringify(dimension))
        })
        this.dimensionsSerialized = JSON.stringify(dimensionsJSON)
    }

    /* STEP #3 - General Instructions */
    generalInstructions(): FormArray {
        return this.generalInstructionsForm.get('generalInstructions') as FormArray;
    }

    addGeneralInstruction(instructionIndex = null, instruction = null as Instruction) {
        this.generalInstructions().push(this._formBuilder.group({
            caption: instruction ? instruction.caption ? instruction.caption : '' : '',
            text: instruction ? instruction.text ? instruction.text : '' : '',
        }));
    }

    removeGeneralInstruction(generalInstructionIndex: number) {
        this.generalInstructions().removeAt(generalInstructionIndex);
    }

    /* JSON Output */

    generalInstructionsJSON() {
        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith('general-instruction-'))
        if (serializedInstructions.length > 0) serializedInstructions.forEach(key => this.localStorageService.removeItem(key))
        let generalInstructionsJSON = JSON.parse(JSON.stringify(this.generalInstructionsForm.get('generalInstructions').value));
        generalInstructionsJSON.forEach((generalInstruction, generalInstructionIndex) => {
            if (generalInstruction.caption == '') generalInstruction.caption = false
            this.localStorageService.setItem(`general-instruction-${generalInstructionIndex}`, JSON.stringify(generalInstruction))
        })
        this.generalInstructionsSerialized = JSON.stringify(generalInstructionsJSON);
    }

    /* STEP #4 - Evaluation Instructions */

    evaluationInstructions(): FormArray {
        return this.evaluationInstructionsForm.get('evaluationInstructions') as FormArray;
    }

    addEvaluationInstruction(instructionIndex = null, instruction = null as Instruction) {
        this.evaluationInstructions().push(this._formBuilder.group({
            caption: instruction ? instruction.caption ? instruction.caption : '' : '',
            text: instruction ? instruction.text ? instruction.text : '' : ''
        }));
    }

    removeEvaluationInstruction(evaluationInstructionIndex: number) {
        this.evaluationInstructions().removeAt(evaluationInstructionIndex);
    }

    /* JSON Output */

    evaluationInstructionsJSON() {
        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith('evaluation-instruction-'))
        if (serializedInstructions.length > 0) serializedInstructions.forEach(key => this.localStorageService.removeItem(key))
        let evaluationInstructionsJSON = JSON.parse(JSON.stringify(this.evaluationInstructionsForm.get('evaluationInstructions').value));
        evaluationInstructionsJSON.forEach((evaluationInstruction, instructionIndex) => {
            if (evaluationInstruction.caption == '') evaluationInstruction.caption = false
            this.localStorageService.setItem(`evaluation-instruction-${instructionIndex}`, JSON.stringify(evaluationInstruction))
        })
        this.evaluationInstructionsSerialized = JSON.stringify(evaluationInstructionsJSON);
    }

    /* STEP #5 - Search Engine */

    domains(): FormArray {
        return this.searchEngineForm.get('domains_filter') as FormArray;
    }

    addDomain(domain = null) {
        this.domains().push(this._formBuilder.group({
            url: domain ? domain : ''
        }))
    }

    removeDomain(domainIndex: number) {
        this.domains().removeAt(domainIndex);
    }

    /* JSON OUTPUT */

    searchEngineJSON() {
        let searchEngineJSON = JSON.parse(JSON.stringify(this.searchEngineForm.value));
        if (searchEngineJSON.source) {
            let domainsStringArray = [];
            for (let domain of searchEngineJSON.domains_filter) domainsStringArray.push(domain.url);
            searchEngineJSON.domains_filter = domainsStringArray;
        } else {
            searchEngineJSON.source = false
            searchEngineJSON.domains_filter = []
        }
        this.localStorageService.setItem(`search-engine-settings`, JSON.stringify(searchEngineJSON))
        this.searchEngineSerialized = JSON.stringify(searchEngineJSON)
    }

    /* STEP #6 - Task Settings */

    updateLogOption(el: string, action: string) {
        let truthValue = this.taskSettingsForm.get('logOption').value[el][action] != true;
        if (action == 'general') {
            for (let key in this.taskSettingsForm.get('logOption').value[el])
                this.taskSettingsForm.get('logOption').value[el][key] = truthValue
        } else
            this.taskSettingsForm.get('logOption').value[el][action] = truthValue
    }

    updateServerEndpoint() {
        return this.taskSettingsForm.get('serverEndpoint').value
    }

    updateHitsFile(hits = null) {
        this.hitsParsed = hits ? hits : JSON.parse(this.hitsFile.content) as Array<Hit>;
        this.hitsParsedString = JSON.stringify(this.hitsParsed)
        if (!hits) {
            this.localStorageService.setItem(`hits`, JSON.stringify(this.hitsParsed))
        }
        if (this.hitsParsed.length > 0) {
            this.hitsDetected = ("documents" in this.hitsParsed[0]) && ("token_input" in this.hitsParsed[0]) && ("token_output" in this.hitsParsed[0]) && ("unit_id" in this.hitsParsed[0]) ? this.hitsParsed.length : 0;
        } else {
            this.hitsDetected = 0
        }
        this.hitsAttributes = []
        this.hitsAttributesValues = {}

        if (this.hitsDetected > 0) {
            let hits = JSON.parse(JSON.stringify(this.hitsParsed))
            let document = hits[0]['documents'][0]
            this.hitsPositions = hits[0]['documents'].length
            if ('statements' in document) {
                for (let attribute in document['statements'][0]) {
                    if (!(attribute in this.hitsAttributes)) {
                        this.hitsAttributes.push(attribute)
                        this.hitsAttributesValues[attribute] = []
                    }
                }
            } else {
                for (let attribute in document) {
                    if (!(attribute in this.hitsAttributes)) {
                        this.hitsAttributes.push(attribute)
                        this.hitsAttributesValues[attribute] = []
                    }
                }
            }

            for (let hit of hits) {
                for (let document of hit['documents']) {
                    if ('statements' in document) {
                        Object.entries(document['statements'][0]).forEach(
                            ([attribute, value]) => {
                                if (!this.hitsAttributesValues[attribute].includes(value)) this.hitsAttributesValues[attribute].push(value)
                            }
                        )
                    } else {
                        Object.entries(document).forEach(
                            ([attribute, value]) => {
                                if (!this.hitsAttributesValues[attribute].includes(value)) this.hitsAttributesValues[attribute].push(value)
                            }
                        );
                    }
                }
            }
        }
        this.hitAttributes().clear({emitEvent: true})
        for (let attributeIndex in this.hitsAttributes) {
            if (attributeIndex in this.taskSettingsFetched.attributes) {
                this.addHitAttribute(this.hitsAttributes[attributeIndex], this.taskSettingsFetched.attributes[attributeIndex])
            } else {
                this.addHitAttribute(this.hitsAttributes[attributeIndex])
            }
        }
        if (this.hitsFile) {
            this.hitsSize = Math.round(this.hitsFile.size / 1024)
            this.hitsFileName = this.hitsFile.name
        } else {
            this.hitsSize = (new TextEncoder().encode(this.hitsParsed.toString())).length
            this.hitsFileName = "hits.json"
        }
    }

    hitAttributes() {
        return this.taskSettingsForm.get('attributes') as FormArray;
    }

    addHitAttribute(name: string, attribute = null as Attribute) {
        this.hitAttributes().push(this._formBuilder.group({
            name: attribute ? attribute.name : name,
            show: attribute ? attribute.show : true,
            annotate: attribute ? this.taskSettingsForm.get('setAnnotator').value ? attribute.annotate : false : false,
            required: attribute ? this.taskSettingsForm.get('setAnnotator').value ? attribute.required : false : false,
        }))
        this.resetHitAttributes()
    }

    resetHitAttributes() {
        for (let attribute of this.hitAttributes().controls) {
            if (this.taskSettingsForm.get('setAnnotator').value == false) {
                attribute.get("annotate").disable()
                attribute.get("annotate").setValue(false)
                attribute.get("required").disable()
                attribute.get("required").setValue(false)
            } else {
                attribute.get("annotate").enable()
                attribute.get("required").enable()
            }
        }
    }

    updateHitAttribute(attributeIndex) {
        let attribute = this.hitAttributes().at(attributeIndex)
        if (attribute.get("show").value == true) {
            attribute.get("annotate").enable()
            attribute.get("required").enable()
        } else {
            attribute.get("annotate").disable()
            attribute.get("required").disable()
            attribute.get("annotate").setValue(false)
            attribute.get("required").setValue(false)
        }
        if (attribute.get("annotate").value == true) {
            attribute.get("required").enable()
        } else {
            attribute.get("required").disable()
            attribute.get("required").setValue(false)
        }
        this.resetHitAttributes()
    }

    resetCountdown() {
        if (this.taskSettingsForm.get('setCountdownTime').value == false) {
            this.taskSettingsForm.get('countdown_time').setValue(false)
            this.taskSettingsForm.get('countdown_time').clearValidators();
            this.taskSettingsForm.get('countdown_time').updateValueAndValidity();
        } else {
            this.taskSettingsForm.get('countdown_time').setValidators([Validators.required, this.positiveOrZeroNumber.bind(this)]);
            this.taskSettingsForm.get('countdown_time').updateValueAndValidity();
        }
        console.log(this.taskSettingsForm)
        this.resetAdditionalTimes()
    }

    resetAdditionalTimes() {
        if (this.taskSettingsForm.get('setAdditionalTimes').value == false) {
            this.taskSettingsForm.get('countdown_modality').setValue(false)
            this.taskSettingsForm.get('countdown_modality').clearValidators();
            this.taskSettingsForm.get('countdown_modality').updateValueAndValidity();
            this.taskSettingsForm.get('countdown_attribute').setValue(false)
            this.taskSettingsForm.get('countdown_attribute').clearValidators()
            this.taskSettingsForm.get('countdown_attribute').updateValueAndValidity()
            this.countdownAttributeValues().clear()
            this.countdownAttributeValues().updateValueAndValidity()
            this.countdownPositionValues().clear()
            this.countdownPositionValues().updateValueAndValidity()
        } else {
            this.taskSettingsForm.get('countdown_modality').setValidators([Validators.required]);
            if (this.taskSettingsForm.get('countdown_modality').value == 'attribute')
                this.taskSettingsForm.get('countdown_attribute').setValidators([Validators.required]);
        }
    }

    countdownAttributeValues() {
        return this.taskSettingsForm.get('countdown_attribute_values') as FormArray;
    }

    updateCountdownModality() {
        if (this.taskSettingsForm.get('countdown_modality').value == "attribute") {
            this.countdownPositionValues().clear()
        } else {
            this.taskSettingsForm.get('countdown_attribute').setValue(false)
            this.taskSettingsForm.get('countdown_attribute').clearValidators()
            this.countdownAttributeValues().clear()
            this.countdownAttributeValues().updateValueAndValidity()
            this.updateCountdownPosition()
        }
    }

    updateCountdownAttribute(countdownAttribute = null) {
        if (countdownAttribute) {
            let control = this._formBuilder.group({
                name: countdownAttribute['name'],
                time: countdownAttribute['time']
            })
            this.countdownAttributeValues().push(control)
        } else {
            this.countdownAttributeValues().clear()
            let chosenAttribute = this.taskSettingsForm.get('countdown_attribute').value
            let values = this.hitsAttributesValues[chosenAttribute]
            for (let value of values) {
                let control = this._formBuilder.group({
                    name: value,
                    time: '',
                })
                this.countdownAttributeValues().push(control)
            }
        }

    }

    countdownPositionValues() {
        return this.taskSettingsForm.get('countdown_position_values') as FormArray;
    }

    updateCountdownPosition(countdownPosition = null) {
        if (countdownPosition) {
            let control = this._formBuilder.group({
                position: countdownPosition['name'],
                time: countdownPosition['time']
            })
            this.countdownPositionValues().push(control)
        } else {
            this.countdownPositionValues().clear()
            for (let index = 0; index < this.hitsPositions; index++) {
                let control = this._formBuilder.group({
                    position: index,
                    time: '',
                })
                this.countdownPositionValues().push(control)
            }
        }

    }

    annotator() {
        return this.taskSettingsForm.get('annotator') as FormGroup
    }

    setAnnotatorType() {
        if (this.annotator().get('type').value == 'options' && this.annotatorOptionValues().length == 0) {
            this.annotatorOptionValues().push(this._formBuilder.group({
                label: '',
                color: ''
            }))
        }
    }

    resetAnnotator() {
        for (let attributeControl of this.hitAttributes().controls) {
            attributeControl.get('annotate').setValue(false)
        }
        this.annotator().get('type').setValue('')
        if (this.taskSettingsForm.get('setAnnotator').value == false) {
            this.annotator().get('type').clearValidators();
        } else {
            this.annotator().get('type').setValidators([Validators.required, this.positiveNumber.bind(this)]);
        }
        this.annotator().get('type').updateValueAndValidity();
        this.resetHitAttributes()
    }

    /* SUB ELEMENT: Annotator */
    annotatorOptionValues(): FormArray {
        return this.taskSettingsForm.get('annotator').get('values') as FormArray;
    }

    addOptionValue(option = null as Object) {
        this.annotatorOptionValues().push(this._formBuilder.group({
            label: option ? option['label'] ? option['label'] : '' : '',
            color: option ? option['color'] ? option['color'] : '' : ''
        }))
        if (!option) {
            this.annotatorOptionColors.push("")
        }
    }

    updateOptionColor(color, optionIndex) {
        this.annotatorOptionColors[optionIndex] = color
    }

    removeAnnotatorOptionValue(valueIndex) {
        this.annotatorOptionValues().removeAt(valueIndex);
    }

    messages(): FormArray {
        return this.taskSettingsForm.get('messages') as FormArray;
    }

    addMessage(message = null) {
        this.messages().push(this._formBuilder.group({
            message: message ? message : ''
        }))
    }

    removeMessage(messageIndex: number) {
        this.messages().removeAt(messageIndex);
    }

    /* JSON Output */

    taskSettingsJSON() {

        let taskSettingsJSON = JSON.parse(JSON.stringify(this.taskSettingsForm.value));

        if (!taskSettingsJSON.setAnnotator) taskSettingsJSON.annotator = false
        delete taskSettingsJSON.setAnnotator

        if (taskSettingsJSON.annotator.type == "options") {
            taskSettingsJSON.annotator.values.forEach((option, index) => {
                option["color"] = this.annotatorOptionColors[index]
            });
        }

        if (!taskSettingsJSON.setCountdownTime) {
            taskSettingsJSON.countdown_time = false
            taskSettingsJSON.additional_times = false
            taskSettingsJSON.countdown_modality = false
            taskSettingsJSON.countdown_attribute = false
            taskSettingsJSON.countdown_attribute_values = []
            taskSettingsJSON.countdown_position_values = []
        }
        if (!taskSettingsJSON.setAdditionalTimes) {
            taskSettingsJSON.additional_times = false
            taskSettingsJSON.countdown_modality = false
            taskSettingsJSON.countdown_attribute = false
            taskSettingsJSON.countdown_attribute_values = []
            taskSettingsJSON.countdown_position_values = []
        } else {
            taskSettingsJSON.additional_times = taskSettingsJSON.setAdditionalTimes
        }
        delete taskSettingsJSON.setCountdownTime
        delete taskSettingsJSON.setAdditionalTimes

        if ('attributes' in taskSettingsJSON) {
            for (let attributeIndex in taskSettingsJSON['attributes']) {
                let attribute = taskSettingsJSON['attributes'][attributeIndex]
                attribute['name'] = this.hitsAttributes[attributeIndex]
                if (!attribute['show']) {
                    attribute['annotate'] = false
                    attribute['required'] = false
                }
                if (!attribute['annotate']) {
                    attribute['required'] = false
                }
                if (!taskSettingsJSON.annotator) {
                    attribute['annotate'] = false
                    attribute['required'] = false
                }
                taskSettingsJSON['attributes'][attributeIndex] = attribute
            }
        }

        if (taskSettingsJSON.messages.length == 0) {
            delete taskSettingsJSON.messages;
        } else {
            let messages = [];
            for (let messageIndex in taskSettingsJSON.messages) messages.push(taskSettingsJSON.messages[messageIndex].message);
            taskSettingsJSON.messages = messages;
        }

        this.localStorageService.setItem(`task-settings`, JSON.stringify(taskSettingsJSON))
        this.taskSettingsSerialized = JSON.stringify(taskSettingsJSON)
    }

    /* STEP #7 - Task Settings */

    public storeWorkerChecksForm(data: FormGroup) {
        this.workerChecksForm = data
    }

    public storeWorkerChecks(data: string) {
        this.workerChecksResult = data
    }

    /* STEP 8 - Summary  */

    public updateFullPath() {
        this.fullS3Path = this.S3Service.getTaskDataS3Path(this.configService.environment, this.configService.environment.taskName, this.configService.environment.batchName)
    }

    public async uploadConfiguration() {
        this.uploadStarted = true
        this.uploadCompleted = false
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial']
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial']
        let questionnairePromise = this.S3Service.uploadQuestionnairesConfig(this.configService.environment, this.questionnairesSerialized)
        let hitsPromise = this.S3Service.uploadHitsConfig(this.configService.environment, this.hitsParsed)
        let dimensionsPromise = this.S3Service.uploadDimensionsConfig(this.configService.environment, this.dimensionsSerialized)
        let taskInstructionsPromise = this.S3Service.uploadTaskInstructionsConfig(this.configService.environment, this.generalInstructionsSerialized)
        let dimensionsInstructionsPromise = this.S3Service.uploadDimensionsInstructionsConfig(this.configService.environment, this.evaluationInstructionsSerialized)
        let searchEngineSettingsPromise = this.S3Service.uploadSearchEngineSettings(this.configService.environment, this.searchEngineSerialized)
        let taskSettingsPromise = this.S3Service.uploadTaskSettings(this.configService.environment, this.taskSettingsSerialized)
        let workerChecksPromise = this.S3Service.uploadWorkersCheck(this.configService.environment, this.workerChecksResult)
        questionnairePromise.then(result => {
            if (!result["failed"]) {
                this.questionnairesPath = this.S3Service.getQuestionnairesConfigPath(this.configService.environment)
            } else this.questionnairesPath = "Failure"
        })
        hitsPromise.then(result => {
            if (!result["failed"]) {
                this.hitsPath = this.S3Service.getHitsConfigPath(this.configService.environment)
            } else this.hitsPath = "Failure"
        })
        dimensionsPromise.then(result => {
            if (!result["failed"]) {
                this.dimensionsPath = this.S3Service.getDimensionsConfigPath(this.configService.environment)
            } else this.dimensionsPath = "Failure"
        })
        taskInstructionsPromise.then(result => {
            if (!result["failed"]) {
                this.taskInstructionsPath = this.S3Service.getTaskInstructionsConfigPath(this.configService.environment)
            } else this.taskInstructionsPath = "Failure"
        })
        dimensionsInstructionsPromise.then(result => {
            if (!result["failed"]) {
                this.dimensionsInstructionsPath = this.S3Service.getDimensionsInstructionsConfigPath(this.configService.environment)
            } else this.dimensionsInstructionsPath = "Failure"
        })
        searchEngineSettingsPromise.then(result => {
            if (!result["failed"]) {
                this.searchEngineSettingsPath = this.S3Service.getSearchEngineSettingsConfigPath(this.configService.environment)
            } else this.searchEngineSettingsPath = "Failure"
        })
        taskSettingsPromise.then(result => {
            if (!result["failed"]) {
                this.taskSettingsPath = this.S3Service.getTaskSettingsConfigPath(this.configService.environment)
            } else this.taskSettingsPath = "Failure"
        })
        workerChecksPromise.then(result => {
            if (!result["failed"]) {
                this.workerChecksPath = this.S3Service.getWorkerChecksConfigPath(this.configService.environment)
            } else this.workerChecksPath = "Failure"
        })
        this.uploadCompleted = true
        if (this.uploadCompleted) {
            this.localStorageService.clear()
            this.questionnairesJSON()
            this.dimensionsJSON()
            this.generalInstructionsJSON()
            this.evaluationInstructionsJSON()
            this.searchEngineJSON()
            this.taskSettingsJSON()
            this.workerChecks.serializeConfiguration()
            this.uploadStarted = false
        }
    }

    public resetConfiguration() {
        this.ngxService.startLoader('generator-inner')
        this.localStorageService.clear()
        this.uploadStarted = false
        this.uploadCompleted = false
        this.questionnairesPath = null
        this.dimensionsPath = null
        this.taskInstructionsPath = null
        this.dimensionsInstructionsPath = null
        this.searchEngineSettingsPath = null
        this.workerChecksPath = null
        this.batchesTree = []
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial']
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial']
        this.generator.selectedIndex = 0
        this.performGeneratorSetup()
    }

    /* |--------- OTHER AMENITIES ---------| */

    public checkFormControl(form: FormGroup, field: string, key: string): boolean {
        return form.get(field).hasError(key);
    }

    public positiveNumber(control: FormControl) {
        if (Number(control.value) < 1) {
            return {invalid: true};
        } else {
            return null;
        }
    }

    public positiveOrZeroNumber(control: FormControl) {
        if (Number(control.value) < 0) {
            return {invalid: true};
        } else {
            return null;
        }
    }


}
