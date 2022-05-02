/* Core */
import {ChangeDetectorRef, Component, Input, ViewChild} from '@angular/core'
import {FormBuilder, FormControl, FormGroup} from '@angular/forms'
/* Material Design */
import {MatStepper} from "@angular/material/stepper"
/* Services */
import {NgxUiLoaderService} from "ngx-ui-loader"
import {S3Service} from "../../services/aws/s3.service"
import {ConfigService} from "../../services/config.service"
import {UtilsService} from "../../services/utils.service"
import {LocalStorageService} from '../../services/localStorage.service'
/* Models */
import {AngularEditorConfig} from "@kolkov/angular-editor"
/* Components */
import {WorkerChecksStepComponent} from "./generator-steps/worker-checks-step/worker-checks-step.component"
import {QuestionnaireStepComponent} from "./generator-steps/questionnaire-step/questionnaire-step.component"
import {InstructionsGeneralStep} from "./generator-steps/instructions-general-step/instructions-general-step.component"
import {SearchEngineStepComponent} from "./generator-steps/search-engine-step/search-engine-step.component"
import {DimensionsStepComponent} from "./generator-steps/dimensions-step/dimensions-step.component"
import {TaskSettingsStepComponent} from "./generator-steps/task-settings-step/task-settings-step.component"


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

    @ViewChild(QuestionnaireStepComponent) questionnaireStep: QuestionnaireStepComponent;
    questionnaireStepForm: FormGroup

    /* STEP #2 - Dimensions */

    @ViewChild(DimensionsStepComponent) dimensionsStep: DimensionsStepComponent;
    dimensionsStepForm: FormGroup

    /* STEP #3 - General Instructions */
    @ViewChild('generalInstructions') generalInstructionsStep: InstructionsGeneralStep;
    generalInstructionsStepForm: FormGroup

    /* STEP #4 - Evaluation Instructions */
    @ViewChild('evaluationInstructions') evaluationInstructionsStep: InstructionsGeneralStep;
    evaluationInstructionsStepForm: FormGroup

    /* STEP #5 - Search Engine */
    @ViewChild(SearchEngineStepComponent) searchEngineStep: SearchEngineStepComponent;
    searchEngineStepForm: FormGroup

    /* STEP #6 - Task Settings */
    @ViewChild(TaskSettingsStepComponent) taskSettingsStep: TaskSettingsStepComponent;
    taskSettingsStepForm: FormGroup
    @Input() taskModality: string

    /* STEP #7 - Worker Checks */

    @ViewChild(WorkerChecksStepComponent) workerChecksStep: WorkerChecksStepComponent;
    workerChecksStepForm: FormGroup

    /* |--------- SERVICES & CO - DECLARATION ---------| */

    /* Loading screen service */
    ngxService: NgxUiLoaderService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;
    utilsService: UtilsService
    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* References to clone a previously deployed batch */
    batchCloned: FormControl
    taskCloned: boolean

    /* References to load deployed tasks names */
    batchesTree: Array<JSON>
    batchesTreeInitialization: boolean

    redraw: boolean

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
        utilsService: UtilsService,
        private _formBuilder: FormBuilder,
    ) {

        /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

        /* Service initialization */
        this.ngxService = ngxService
        this.configService = configService
        this.S3Service = S3Service
        this.changeDetector = changeDetector
        this.localStorageService = localStorageService
        this.utilsService = utilsService
        this.ngxService.startLoader('generator-inner')

        this.batchCloned = new FormControl();
        this.taskCloned = false

        this.configService.environment['taskNameInitial'] = this.configService.environment['taskName']
        this.configService.environment['batchNameInitial'] = this.configService.environment['batchName']

        this.batchesTreeInitialization = false

        this.performGeneratorSetup()

    }

    public performGeneratorSetup() {
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

        let batchesPromise = this.loadBatchesTree()

    }

    async loadBatchesTree() {

        let batchesTreeSerialized = JSON.parse(this.localStorageService.getItem('batches-tree'))

        this.batchesTree = []
        if (batchesTreeSerialized) {
            this.batchesTree = batchesTreeSerialized
            this.batchesTreeInitialization = true
        } else {
            let workerSettings = await this.S3Service.downloadWorkers(this.configService.environment)
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
                    taskNode["batches"].push(batchNode)
                    counter = counter + 1
                    workerSettings['blacklist_batches'].forEach((batchName, batchIndex) => {
                        if (batchName == batch['Prefix']) {
                            batchNode['blacklist'] = true
                        }
                    })
                    workerSettings['whitelist_batches'].forEach((batchName, batchIndex) => {
                        if (batchName == batch['Prefix']) {
                            batchNode['whitelist'] = true
                        }
                    })
                }
                this.batchesTree.push(JSON.parse(JSON.stringify(taskNode)))
            }
            this.localStorageService.setItem(`batches-tree`, JSON.stringify(this.batchesTree))
        }
        this.batchesTreeInitialization = true
        this.ngxService.stopLoader("generator-inner")
    }

    async clonePreviousBatch(data: Object) {
        this.ngxService.startLoader('generator-inner')
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
        this.batchesTreeInitialization = false
        this.performGeneratorSetup()
        this.questionnaireStep.ngOnInit()
        this.dimensionsStep.ngOnInit()
        this.generalInstructionsStep.ngOnInit()
        this.evaluationInstructionsStep.ngOnInit()
        this.searchEngineStep.ngOnInit()
        this.taskSettingsStep.ngOnInit()
        this.workerChecksStep.ngOnInit()
    }

    async restoreGenerator() {
        this.ngxService.startLoader('generator-inner')
        this.generator.selectedIndex=1
        this.batchCloned = new FormControl();
        this.localStorageService.clear()
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial']
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial']
        this.taskCloned = true
        this.batchesTreeInitialization = false
        this.performGeneratorSetup()
        this.questionnaireStep.ngOnInit()
        this.dimensionsStep.ngOnInit()
        this.generalInstructionsStep.ngOnInit()
        this.evaluationInstructionsStep.ngOnInit()
        this.searchEngineStep.ngOnInit()
        this.taskSettingsStep.ngOnInit()
        this.workerChecksStep.ngOnInit()
    }

    /* The "stored" within each generator step may be in the form:
     * - a function which returns the filled form (i.e., questionnaires())
     * - a function which returns the values of a sub element (i.e., questions())
     * - a function called addXXX which adds a new sub element to the form (i.e., addQuestion())
     * - a function called removeXXX which removes a sub element from the form (i.e., removeQuestion())
     * - a function called updateXXX which updates an already present sub element to responds to values chosen
     *   in other fiels (i.e., updateQuestionnaire())
     * - a funcion called resetXXX which resets a single field or a sub element (i.e., resetJustification())
     * - a function called xxxJSON which outputs the values of a single step's form as a JSON dictionary (i.e., questionnairesJSON())
     * */

    /* STEP #1 - Questionnaires */

    public storeQuestionnaireForm(data: FormGroup) {
        this.questionnaireStepForm = data
    }

    /* STEP #3 - General Instructions */

    public storeGeneralInstructionsForm(data: FormGroup) {
        this.generalInstructionsStepForm = data
    }

    /* STEP #2 - Dimensions */

    public storeDimensionsForm(data: FormGroup) {
        this.dimensionsStepForm = data
    }

    /* STEP #3 - Evaluation Instructions */

    public storeEvaluationlInstructionsForm(data: FormGroup) {
        this.evaluationInstructionsStepForm = data
    }

    /* STEP #5 - Search Engine */

    public storeSearchEngineStepForm(data: FormGroup) {
        this.searchEngineStepForm = data
    }

    /* STEP #6 - Task Settings */

    public storeTaskSettingsForm(data: FormGroup) {
        this.taskSettingsStepForm = data
    }

    /* STEP #7 - Task Settings */

    public storeWorkerChecksForm(data: FormGroup) {
        this.workerChecksStepForm = data
    }

    public storeTaskModality(data: string) {
        this.taskModality = data
    }

}
