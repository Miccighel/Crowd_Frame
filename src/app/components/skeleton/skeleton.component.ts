/* Core modules */
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ViewChild,
    ViewChildren,
    QueryList, OnInit
} from "@angular/core";
/* Reactive forms modules */
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
import {CountdownComponent} from 'ngx-countdown';
/* Services */
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {ConfigService} from "../../services/config.service";
import {S3Service} from "../../services/s3.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Task models */
import {Task} from "../../models/task";
import {ScaleMagnitude} from "../../models/dimension";
import {Worker} from "../../models/worker";
import {SettingsTask} from "../../models/settingsTask";
import {GoldChecker} from "../../../../data/build/skeleton/goldChecker";
import {ActionLogger} from "../../services/userActionLogger.service";
/* HTTP Client */
import {HttpClient, HttpHeaders} from "@angular/common/http";
/* Material modules */
import {MatSnackBar} from "@angular/material/snack-bar";
import {Object} from 'aws-sdk/clients/customerprofiles';
/* Services */
import {SectionService} from "../../services/section.service";
import {DynamoDBService} from "../../services/dynamoDB.service";
import {SettingsWorker} from "../../models/settingsWorker";
import {OutcomeSectionComponent} from "./pointwise/outcome/outcome-section.component";
import {AnnotatorOptionsComponent} from "./pointwise/elements/annotator-options/annotator-options.component";
import {UtilsService} from "../../services/utils.service";
import {DebugService} from "../../services/debug.service";
import {Hit} from "../../models/hit";
import {DimensionPointwiseComponent} from "./pointwise/dimension/dimension-pointwise.component";

/* Component HTML Tag definition */
@Component({
    selector: 'app-skeleton',
    templateUrl: './skeleton.component.html',
    styleUrls: ['./skeleton.component.scss', './skeleton.shared.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})

/*
* This class implements a skeleton for Crowdsourcing tasks.
*/
export class SkeletonComponent implements OnInit {

    /* |--------- SERVICES & CO. - DECLARATION ---------| */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to provide loading screens */
    ngxService: NgxUiLoaderService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    dynamoDBService: DynamoDBService;
    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    /* Service to log to the server */
    actionLogger: ActionLogger
    /* Service to track current section */
    sectionService: SectionService
    utilsService: UtilsService
    debugService: DebugService

    /* HTTP client and headers */
    client: HttpClient;
    headers: HttpHeaders;

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: FormBuilder;

    /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

    /* References to task stepper and token forms */
    @ViewChild('stepper') stepper: MatStepper;
    @ViewChild('urlField') urlField: MatFormField;
    tokenForm: FormGroup;
    tokenInput: FormControl;
    tokenInputValid: boolean;

    /* Snackbar reference */
    snackBar: MatSnackBar;

    /* Object to encapsulate all task-related information */
    task: Task

    /* Object to encapsulate all worker-related information */
    worker: Worker

    /* Array of form references, one for each document within a Hit */
    assessmentForms: FormGroup[];

    /* Array of form references, one for each questionnaire within a Hit */
    questionnairesForm: FormGroup[];

    /* Reference to the outcome section component */
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(DimensionPointwiseComponent) dimensionsPointwise: QueryList<DimensionPointwiseComponent>;

    /* |--------- COUNTDOWN HANDLING ---------| */

    /* References to the HTML elements */
    @ViewChildren('countdownElement') countdown: QueryList<CountdownComponent>;

    /* Available options to label an annotation */
    annotationOptions: FormGroup;

    /* |--------- OUTCOME SECTION ELEMENTS - DECLARATION ---------| */

    /* Reference to the outcome section component */
    @ViewChild(OutcomeSectionComponent) outcomeSection: OutcomeSectionComponent;

    /* Check to understand if the generator or the skeleton should be loader */
    generator: boolean;

    constructor(
        changeDetector: ChangeDetectorRef,
        ngxService: NgxUiLoaderService,
        configService: ConfigService,
        S3Service: S3Service,
        dynamoDBService: DynamoDBService,
        deviceDetectorService: DeviceDetectorService,
        client: HttpClient,
        formBuilder: FormBuilder,
        snackBar: MatSnackBar,
        actionLogger: ActionLogger,
        sectionService: SectionService,
        utilsService: UtilsService,
        debugService: DebugService
    ) {
        /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

        this.changeDetector = changeDetector
        this.ngxService = ngxService
        this.configService = configService
        this.S3Service = S3Service
        this.dynamoDBService = dynamoDBService
        this.actionLogger = actionLogger
        this.sectionService = sectionService
        this.deviceDetectorService = deviceDetectorService
        this.utilsService = utilsService
        this.debugService = debugService

        this.client = client
        this.formBuilder = formBuilder
        this.snackBar = snackBar

        this.ngxService.start();

        /* |--------- CONTROL FLOW & UI ELEMENTS - INITIALIZATION ---------| */

        this.tokenInput = new FormControl('', [Validators.required, Validators.maxLength(11)], this.validateTokenInput.bind(this));
        this.tokenForm = formBuilder.group({
            "tokenInput": this.tokenInput
        });
        this.tokenInputValid = false;

        /* |--------- CONFIGURATION GENERATOR INTEGRATION - INITIALIZATION ---------| */

        this.generator = false;

    }

    /* |--------- MAIN FLOW IMPLEMENTATION ---------| */

    /* To follow the execution flow of the skeleton the functions needs to be read somehow in order (i.e., from top to bottom) */
    public async ngOnInit() {

        this.ngxService.start()

        this.task = new Task()
        this.task.platformName = this.configService.environment.platformName
        this.task.taskName = this.configService.environment.taskName
        this.task.batchName = this.configService.environment.batchName

        if (this.configService.environment.debug_mode) {
            let hits = await this.S3Service.downloadHits(this.configService.environment)
            this.tokenInput.setValue(this.debugService.selectRandomToken(hits))
        }


        let url = new URL(window.location.href);

        /* The GET URL parameters are parsed and used to init worker's instance */
        let paramsFetched: Record<string, string> = {};
        url.searchParams.forEach((value, param) => {
            if (param.toLowerCase().includes('workerid')) {
                paramsFetched['identifier'] = value
            } else {
                param = param.replace(/(?:^|\.?)([A-Z])/g, function (x, y) {
                    return "_" + y.toLowerCase()
                }).replace(/^_/, "")
                paramsFetched[param] = value
            }
        })

        this.worker = new Worker(paramsFetched)

        /* The task settings are loaded */
        this.loadSettings().then(() => {

            /* The logging service is enabled if it is needed */
            if (this.task.settings.logger_enable)
                this.logInit(this.worker.identifier, this.configService.environment.taskName, this.configService.environment.batchName, this.client, this.configService.environment.log_on_console);
            else
                this.actionLogger = null;

            /* Anonymous  function that unlocks the task depending on performWorkerStatusCheck outcome */
            let unlockTask = function (changeDetector: ChangeDetectorRef, ngxService: NgxUiLoaderService, sectionService: SectionService, taskAllowed: boolean) {
                sectionService.taskAllowed = taskAllowed
                sectionService.checkCompleted = true
                changeDetector.detectChanges()
                /* The loading spinner is stopped */
                ngxService.stop();
            };

            /* If there is an external worker which is trying to perform the task, check its status */
            if (!(this.worker.identifier == null)) {

                /* The performWorkerStatusCheck function checks worker's status and its result is interpreted as a success|error callback */
                this.performWorkerStatusCheck().then(async taskAllowed => {

                    if (taskAllowed) {

                        /* The worker's remote S3 folder is retrieved */
                        this.worker.folder = this.S3Service.getWorkerFolder(this.configService.environment, this.worker)
                        this.worker.setParameter('folder', this.worker.folder)
                        this.worker.setParameter('paid', 'false')
                        this.worker.setParameter('in_progress', 'false')
                        this.worker.setParameter('time_arrival', new Date().toUTCString())
                        /* Some worker properties are loaded using ngxDeviceDetector npm package capabilities... */
                        this.worker.updateProperties('ngxdevicedetector', this.deviceDetectorService.getDeviceInfo())
                        /* ... or the simple Navigator DOM's object */
                        this.worker.updateProperties('navigator', window.navigator)

                        /* If the platform is Prolific, an allocation scheme without input token is used */
                        if (this.configService.environment.platformName == 'prolific') {

                            /* We fetch the task's HITs */
                            let hits = await this.S3Service.downloadHits(this.configService.environment)
                            /* Flag to understand if there is a HIT assigned to the current worker */
                            let hitAssigned = false

                            /* Anonymous function to assing the found HIT to the worker and mark it as in progress.
                               it also sets the HIT's input token in the form control */
                            let assignHit = function (worker, hit, tokenInput) {
                                worker.setParameter('unit_id', hit['unit_id'])
                                worker.setParameter('in_progress', 'true')
                                tokenInput.setValue(hit['token_input'])
                            }

                            /* An ACL record for the current worker is searched */
                            let workerACLRecord = await this.dynamoDBService.getACLRecordWorkerId(this.configService.environment, this.worker.identifier)
                            /* It there is not any record, an available HIT can be assigned to him */
                            if (workerACLRecord['Items'].length <= 0) {
                                for (let hit of hits) {
                                    /* The status of each HIT is checked */
                                    let unitACLRecords = await this.dynamoDBService.getACLRecordUnitId(this.configService.environment, hit['unit_id'])
                                    /* If is has not been assigned, the current worker can receive it */
                                    if (unitACLRecords['Items'].length <= 0) {
                                        /* Call to the previous function */
                                        assignHit(this.worker, hit, this.tokenInput)
                                        /* The worker's ACL record is then updated */
                                        await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, this.task.tryCurrent)
                                        /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                        hitAssigned = true
                                        break
                                    }
                                }

                                /* If the flag is still false, it means that all the available HITs have been assigned once...
                                   ... however, a worker have probably abandoned the task if someone reaches this point of the code. */

                                if (!hitAssigned) {

                                    /* The whole set of ACL records must be scanned to find the oldest worker that participated in the task but abandoned it */
                                    let wholeEntries = []
                                    let aclEntries = await this.dynamoDBService.scanACLRecordUnitId(this.configService.environment)
                                    for (let aclEntry of aclEntries.Items) {
                                        wholeEntries.push(aclEntry)
                                    }
                                    let lastEvaluatedKey = aclEntries.LastEvaluatedKey
                                    while (typeof lastEvaluatedKey != "undefined") {
                                        aclEntries = await this.dynamoDBService.scanACLRecordUnitId(this.configService.environment, null, lastEvaluatedKey)
                                        lastEvaluatedKey = aclEntries.LastEvaluatedKey
                                        for (let aclEntry of aclEntries.Items) {
                                            wholeEntries.push(aclEntry)
                                        }
                                    }

                                    /* Each ACL record is sorted considering the timestamp, in ascending order */
                                    wholeEntries.sort((a, b) => (a.time > b.time) ? 1 : -1)

                                    for (let aclEntry of wholeEntries) {

                                        /* If the worker that received the current unit did not complete it he abandoned or returned the task.
                                           Thus, we free its slot, and we assign the HIT found to the current worker. */

                                        if (aclEntry['paid'] == 'false' && aclEntry['in_progress'] == 'true') {
                                            let hitFound = null
                                            for (let currentHit of hits) {
                                                if (currentHit['unit_id'] == aclEntry['unit_id']) {
                                                    hitFound = currentHit
                                                    break
                                                }
                                            }
                                            assignHit(this.worker, hitFound, this.tokenInput)
                                            hitAssigned = true
                                            /* The record for the current worker is updated */
                                            await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, this.task.tryCurrent)
                                            /* The record for the worker that abandoned/returned the task is updated */
                                            aclEntry['in_progress'] = 'false'
                                            await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, aclEntry, this.task.tryCurrent)
                                            /* As soon a slot for the current HIT is freed and assigned to the current worker the search can be stopped */
                                            break
                                        }

                                        /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                        if (hitAssigned) break
                                    }

                                }

                            } else {
                                /* If an ACL record for the current worker already exists, he already received a HIT. */
                                let aclEntry = workerACLRecord['Items'].pop()
                                /* If the two flags are set to false, s/he is a worker that abandoned the task earlier;
                                   furthermore, his/her it has been assigned to someone else. It's a sort of overbooking. */
                                if (aclEntry['in_progress'] == 'false' && aclEntry['paid'] == 'false') {
                                    /* As of today, such a worker is not allowed to perform the task */
                                    taskAllowed = false
                                } else {
                                    /* Otherwise, the corresponding hit is searched to set the input token */
                                    for (let hit of hits) {
                                        if (hit['unit_id'] == aclEntry['unit_id']) {
                                            this.tokenInput.setValue(hit['token_input'])
                                            await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, aclEntry, this.task.tryCurrent)
                                            hitAssigned = true
                                            break
                                        }
                                    }
                                    taskAllowed = true
                                }
                            }

                            /* If after the whole workflow still a HIT has not been assigned to the current worker, we ran out of this */
                            if (!hitAssigned) {
                                this.sectionService.taskOverbooking = true
                                taskAllowed = false
                            }

                        } else await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, this.task.tryCurrent)

                        /* We launch a call to Cloudflare to trace the worker */
                        if (this.worker.settings.analysis) {
                            this.client.get('https://www.cloudflare.com/cdn-cgi/trace', {responseType: 'text'}).subscribe(
                                /* If we retrieve some data from Cloudflare we use them to populate worker's object */
                                cloudflareData => {
                                    this.worker.updateProperties('cloudflare', cloudflareData)
                                    unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed)
                                },
                                /* Otherwise, we won't have such information */
                                error => unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed)
                            )

                        } else unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed)

                    } else unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed)
                })
                /* If there is not any worker ID we simply load the task. A sort of testing mode. */
            } else unlockTask(this.changeDetector, this.ngxService, this.sectionService, true)

        })


        /* |--------- INSTRUCTIONS MAIN (see: instructions_main.json) ---------| */

        this.task.initializeInstructionsGeneral(await this.S3Service.downloadGeneralInstructions(this.configService.environment));

        this.changeDetector.detectChanges()

    }

    /*
    * This function interacts with an Amazon S3 bucket to retrieve and initialize the settings for the current task.
    */
    public async loadSettings() {
        this.task.settings = new SettingsTask(await this.S3Service.downloadTaskSettings(this.configService.environment))
        this.worker.settings = new SettingsWorker(await this.S3Service.downloadWorkers(this.configService.environment))
    }

    /*
    * This function interacts with an Amazon S3 bucket to perform a check on the current worker identifier.
    * If the worker has already started the task in the past he is not allowed to continue the task.
    */
    public async performWorkerStatusCheck() {

        let taskAllowed = true

        if (this.worker.settings.block) {

            let batchesStatus = {}
            let tables = await this.dynamoDBService.listTables(this.configService.environment)
            let workersManual = await this.S3Service.downloadWorkers(this.configService.environment)
            let workersACL = await this.dynamoDBService.getACLRecordWorkerId(this.configService.environment, this.worker.identifier)

            /* To blacklist a previous batch its worker list is picked up */
            for (let batchName of this.worker.settings.blacklist_batches) {
                let previousTaskName = batchName.split("/")[0]
                let previousBatchName = batchName.split("/")[1]
                if (!(batchName in batchesStatus)) {
                    let workers = await this.S3Service.downloadWorkers(this.configService.environment, batchName)
                    batchesStatus[batchName] = {}
                    batchesStatus[batchName]['blacklist'] = workers['blacklist']
                    for (let tableName of tables['TableNames']) {
                        if (tableName.includes(`${previousTaskName}_${previousBatchName}_ACL`)) {
                            batchesStatus[batchName]['tableName'] = tableName
                        }
                    }
                }
            }

            /* To whitelist a previous batch its blacklist is picked up */
            for (let batchName of this.worker.settings.whitelist_batches) {
                let previousTaskName = batchName.split("/")[0]
                let previousBatchName = batchName.split("/")[1]
                if (!(batchName in batchesStatus)) {
                    let workers = await this.S3Service.downloadWorkers(this.configService.environment, batchName)
                    batchesStatus[batchName] = {}
                    batchesStatus[batchName]['whitelist'] = workers['blacklist']
                    for (let tableName of tables['TableNames']) {
                        if (tableName.includes(`${previousTaskName}_${previousBatchName}_ACL`)) {
                            batchesStatus[batchName]['tableName'] = tableName
                        }
                    }
                }
            }

            /* The true checking operation starts here */

            /* Check to verify if the current worker was present into a previous legacy or dynamo-db based blacklisted batch */
            for (let batchName in batchesStatus) {
                let batchStatus = batchesStatus[batchName]
                if ('blacklist' in batchStatus) {
                    if ('tableName' in batchStatus) {
                        let rawWorker = await this.dynamoDBService.getACLRecordWorkerId(this.configService.environment, this.worker.identifier, batchStatus['tableName'])
                        if ('Items' in rawWorker) {
                            for (let worker of rawWorker['Items']) {
                                if (this.worker.identifier == worker['identifier']) {
                                    taskAllowed = false
                                }
                            }
                        }
                    } else {
                        for (let workerIdentifier of batchStatus['blacklist']) {
                            if (this.worker.identifier == workerIdentifier) {
                                taskAllowed = false
                            }
                        }
                    }
                }
            }

            /* Check to verify if the current worker was present into a previous legacy or dynamo-db based whitelisted batch */
            for (let batchName in batchesStatus) {
                let batchStatus = batchesStatus[batchName]
                if ('whitelist' in batchStatus) {
                    if ('tableName' in batchStatus) {
                        let rawWorker = await this.dynamoDBService.getACLRecordWorkerId(this.configService.environment, this.worker.identifier, batchStatus['tableName'])
                        if ('Items' in rawWorker) {
                            for (let worker of rawWorker['Items']) {
                                if (this.worker.identifier == worker['identifier']) {
                                    taskAllowed = true
                                }
                            }
                        }
                    } else {
                        for (let workerIdentifier of batchStatus['whitelist']) {
                            if (this.worker.identifier == workerIdentifier) {
                                taskAllowed = true
                            }
                        }
                    }
                }
            }

            /* Check to verify if the current worker already accessed the current task using the dynamo-db based acl */
            if ('Items' in workersACL) {
                for (let worker of workersACL['Items']) {
                    if (this.worker.identifier == worker['identifier']) {
                        taskAllowed = false
                        return taskAllowed
                    }
                }
            }

            /* Check to verify if the current worker is manually blacklisted into the current batch */
            for (let worker of workersManual['blacklist']) {
                if (this.worker.identifier == worker) {
                    taskAllowed = false
                    return taskAllowed
                }
            }


            /* Check to verify if the current worker is manually whitelisted into the current batch using the dynamo-db based acl */

            for (let worker of workersManual['whitelist']) {
                if (this.worker.identifier == worker) {
                    taskAllowed = true
                }
            }

        }

        return taskAllowed
    }

    /*
     * This function enables the task when the worker clicks on "Proceed" inside the main instructions page.
     */
    public enableTask() {
        this.sectionService.taskInstructionsRead = true
        this.showSnackbar("If you have a very slow internet connection please wait a few seconds before clicking \"Start\".", "Dismiss", 15000)
    }

    /*
    * This function interacts with an Amazon S3 bucket to search the token input
    * typed by the user inside within the hits.json file stored in the bucket.
    * If such token cannot be found, an error message is returned.
    */
    public async validateTokenInput(control: FormControl) {
        let hits = await this.S3Service.downloadHits(this.configService.environment)
        for (let hit of hits) if (hit.token_input === control.value) return null;
        return {"invalid": "This token is not valid."}
    }

    /*
    *  This function retrieves the hit identified by the validated token input inserted by the current worker and sets the task up accordingly.
    *  Such hit is represented by an Hit object. The task is set up by parsing the hit content as an Array of Document objects.
    *  Therefore, to use a customize the task the Document interface must be adapted to correctly parse each document's field.
    *  The Document interface can be found at this path: ../../../../data/build/task/document.ts
    */
    public async performTaskSetup() {

        /* The token input has been already validated, this is just to be sure */
        if (this.tokenForm.valid) {

            /* The loading spinner is started */
            this.ngxService.start();

            /* The hits stored on Amazon S3 are retrieved */
            let hits = await this.S3Service.downloadHits(this.configService.environment)

            /* Scan each entry for the token input */
            for (let currentHit of hits) {
                /* If the token input of the current hit matches with the one inserted by the worker the right hit has been found */
                if (this.tokenInput.value === currentHit.token_input) {
                    currentHit = currentHit as Hit
                    this.task.tokenInput = this.tokenInput.value
                    this.task.tokenOutput = currentHit.token_output;
                    this.task.unitId = currentHit.unit_id
                    this.task.documentsAmount = currentHit.documents.length;
                    /* The array of documents is initialized */
                    this.task.initializeDocuments(currentHit.documents)
                }
            }

            if (this.task.settings.logger_enable)
                this.actionLogger.unitId = this.task.unitId

            /* The token input field is disabled and the task interface can be shown */
            this.tokenInput.disable();
            this.sectionService.taskStarted = true;

            /* A form for each document is initialized */
            this.assessmentForms = new Array<FormGroup>();

            this.task.initializeQuestionnaires(await this.S3Service.downloadQuestionnaires(this.configService.environment))

            /* A form for each questionnaire is initialized */
            this.questionnairesForm = new Array<FormGroup>();
            for (let index = 0; index < this.task.questionnaires.length; index++) {
                let questionnaire = this.task.questionnaires[index];
                if (questionnaire.type == "standard" || questionnaire.type == "likert") {
                    let controlsConfig = {};
                    for (let indexQuestion = 0; indexQuestion < questionnaire.questions.length; indexQuestion++) {
                        let currentQuestion = this.task.questionnaires[index].questions[indexQuestion]
                        if (currentQuestion.type != 'section') {
                            let controlName = `${currentQuestion.name}`
                            let validators = []
                            if (currentQuestion.required) validators = [Validators.required]
                            if (currentQuestion.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                            if (currentQuestion.type == 'email') validators.push(Validators.email)
                            controlsConfig[`${controlName}_answer`] = new FormControl('', validators)
                            if (currentQuestion.freeText) controlsConfig[`${controlName}_free_text`] = new FormControl('')
                        }
                        if (currentQuestion.questions) {
                            for (let indexQuestionSub = 0; indexQuestionSub < currentQuestion.questions.length; indexQuestionSub++) {
                                let currentQuestionSub = currentQuestion.questions[indexQuestionSub]
                                if (currentQuestionSub.type != 'section') {
                                    let controlNameSub = `${currentQuestion.nameFull}_${currentQuestionSub.name}`
                                    let validators = []
                                    if (currentQuestionSub.required) validators = [Validators.required]
                                    if (currentQuestionSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                    if (currentQuestionSub.type == 'email') validators.push(Validators.email)
                                    controlsConfig[`${controlNameSub}_answer`] = new FormControl('', validators)
                                    if (currentQuestionSub.freeText) controlsConfig[`${controlNameSub}_free_text`] = new FormControl('')
                                }
                                if (currentQuestionSub.questions) {
                                    for (let indexQuestionSubSub = 0; indexQuestionSubSub < currentQuestionSub.questions.length; indexQuestionSubSub++) {
                                        let currentQuestionSubSub = currentQuestionSub.questions[indexQuestionSubSub]
                                        if (currentQuestionSubSub.type != 'section') {
                                            let controlNameSubSub = `${currentQuestionSub.nameFull}_${currentQuestionSubSub.name}`
                                            let validators = []
                                            if (currentQuestionSubSub.required) validators = [Validators.required]
                                            if (currentQuestionSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                            if (currentQuestionSubSub.type == 'email') validators.push(Validators.email)
                                            controlsConfig[`${controlNameSubSub}_answer`] = new FormControl('', validators)
                                            if (currentQuestionSubSub.freeText) controlsConfig[`${controlNameSubSub}_free_text`] = new FormControl('')
                                        }
                                        if (currentQuestionSubSub.questions) {
                                            for (let indexQuestionSubSubSub = 0; indexQuestionSubSubSub < currentQuestionSubSub.questions.length; indexQuestionSubSubSub++) {
                                                let currentQuestionSubSubSub = currentQuestionSubSub.questions[indexQuestionSubSubSub]
                                                if (currentQuestionSubSubSub.type != 'section') {
                                                    let controlNameSubSubSub = `${currentQuestionSubSub.nameFull}_${currentQuestionSubSubSub.name}`
                                                    let validators = []
                                                    if (currentQuestionSubSubSub.required) validators = [Validators.required]
                                                    if (currentQuestionSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                    if (currentQuestionSubSubSub.type == 'email') validators.push(Validators.email)
                                                    controlsConfig[`${controlNameSubSubSub}_answer`] = new FormControl('', validators)
                                                    if (currentQuestionSubSubSub.freeText) controlsConfig[`${controlNameSubSubSub}_free_text`] = new FormControl('')
                                                }
                                                if (currentQuestionSubSubSub.questions) {
                                                    for (let indexQuestionSubSubSubSub = 0; indexQuestionSubSubSubSub < currentQuestionSubSubSub.questions.length; indexQuestionSubSubSubSub++) {
                                                        let currentQuestionSubSubSubSub = currentQuestionSubSubSub.questions[indexQuestionSubSubSubSub]
                                                        if (currentQuestionSubSubSubSub.type != 'section') {
                                                            let controlNameSubSubSubSub = `${currentQuestionSubSubSub.nameFull}_${currentQuestionSubSubSubSub.name}`
                                                            let validators = []
                                                            if (currentQuestionSubSubSubSub.required) validators = [Validators.required]
                                                            if (currentQuestionSubSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                            if (currentQuestionSubSubSubSub.type == 'email') validators.push(Validators.email)
                                                            controlsConfig[`${controlNameSubSubSubSub}_answer`] = new FormControl('', validators)
                                                            if (currentQuestionSubSubSubSub.freeText) controlsConfig[`${controlNameSubSubSubSub}_free_text`] = new FormControl('')
                                                        }
                                                        if (currentQuestionSubSubSubSub.questions) {
                                                            for (let indexQuestionSubSubSubSubSub = 0; indexQuestionSubSubSubSubSub < currentQuestionSubSubSubSub.questions.length; indexQuestionSubSubSubSubSub++) {
                                                                let currentQuestionSubSubSubSubSub = currentQuestionSubSubSubSub.questions[indexQuestionSubSubSubSubSub]
                                                                if (currentQuestionSubSubSubSubSub.type != 'section') {
                                                                    let controlNameSubSubSubSubSub = `${currentQuestionSubSubSubSub.nameFull}_${currentQuestionSubSubSubSubSub.name}`
                                                                    let validators = []
                                                                    if (currentQuestionSubSubSubSubSub.required) validators = [Validators.required]
                                                                    if (currentQuestionSubSubSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                                    if (currentQuestionSubSubSubSubSub.type == 'email') validators.push(Validators.email)
                                                                    controlsConfig[`${controlNameSubSubSubSubSub}_answer`] = new FormControl('', validators)
                                                                    if (currentQuestionSubSubSubSubSub.freeText) controlsConfig[`${controlNameSubSubSubSubSub}_free_text`] = new FormControl('')
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
                } else {
                    /* If the questionnaire is a CRT one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user; required, max and min validators are needed */
                    let controlsConfig = {};
                    for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`${this.task.questionnaires[index].questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
                    this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
                }
            }

            /* The evaluation instructions stored on Amazon S3 are retrieved */
            this.task.initializeInstructionsEvaluation(await this.S3Service.downloadEvaluationInstructions(this.configService.environment))

            /* |--------- DIMENSIONS ELEMENTS (see: dimensions.json) ---------| */

            this.task.initializeDimensions(await this.S3Service.downloadDimensions(this.configService.environment))
            /**Iniziliazziare il vettore degli statement */
            this.dimensionValueinsert();

            for (let index = 0; index < this.task.documentsAmount; index++) {
                let controlsConfig = {};

                if (this.task.settings.modality == 'pairwise') {
                    if (this.task.documents[index] != undefined) {
                        if (this.task.documents[index] != null) controlsConfig[`pairwise_value_selected`] = new FormControl('', [Validators.required]);
                    }
                    for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
                        let dimension = this.task.dimensions[index_dimension];
                        if (dimension.scale) {

                            for (let i = 0; i < this.task.documents[index]['statements'].length; i++) {
                                if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value_${i}`] = new FormControl('', [Validators.required]);
                                if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value_${i}`] = new FormControl('', [Validators.required]);
                                if (dimension.scale.type == "magnitude_estimation") {
                                    if ((<ScaleMagnitude>dimension.scale).lower_bound) {
                                        controlsConfig[`${dimension.name}_value_${i}`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min), Validators.required]);
                                    } else {
                                        controlsConfig[`${dimension.name}_value_${i}`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min + 1), Validators.required]);
                                    }
                                }
                                //if (dimension.justification) controlsConfig[`${dimension.name}_justification_${i}`] = new FormControl('', [Validators.required, this.validateJustification.bind(this)])
                            }
                            //if (dimension.url) controlsConfig[`${dimension.name}_url`] = new FormControl('', [Validators.required, this.validateSearchEngineUrl.bind(this)]);
                        }
                    }
                }
            }

            /* Section service gets updated with loaded values */
            this.updateAmounts()

            this.task.loadAccessCounter()
            this.task.loadTimestamps()

            /* Detect changes within the DOM and update the page */
            this.changeDetector.detectChanges();

            /* If there are no questionnaires and the countdown time is set, enable the first countdown */
            if (this.task.settings.countdown_time >= 0 && this.task.questionnaireAmountStart == 0) {
                //this.countdown.forEach((countdown, index) => console.log(countdown));
                this.countdown.first.begin();
            }

            /* The loading spinner is stopped */
            this.ngxService.stop();

        }
    }

    /* |--------- LOGGING SERVICE & SECTION SERVICE ---------| */

    /* Logging service initialization */
    public logInit(workerIdentifier, taskName, batchName, http: HttpClient, logOnConsole: boolean) {
        this.actionLogger.logInit(this.configService.environment.bucket, workerIdentifier, taskName, batchName, http, logOnConsole);
    }

    /* Section service gets updated with questionnaire and document amounts */
    public updateAmounts() {
        this.sectionService.updateAmounts(this.task.questionnaireAmount, this.task.documentsAmount, this.task.settings.allowed_tries)
    }

    public nextStep() {
        let stepper = document.getElementById('stepper');
        stepper.scrollIntoView();
        this.sectionService.increaseIndex()
        this.task.currentDocument = this.sectionService.documentIndex
    }

    public previousStep() {
        let stepper = document.getElementById('stepper');
        stepper.scrollIntoView();
        this.sectionService.decreaseIndex()
        this.task.currentDocument = this.sectionService.documentIndex
    }

    /* |--------- DIMENSIONS ---------| */

    public storeAssessmentForm(form, documentIndex) {
        this.assessmentForms[documentIndex] = form
        console.log(this.assessmentForms)
    }

    /* |--------- COUNTDOWN ---------| */

    /*
     * This function intercept the event triggered when the time left to evaluate a document reaches 0
     * and it simply sets the corresponding flag to false
     */
    public handleCountdown(event, i) {
        if (event['left'] == 0) {
            this.task.countdownsExpired[i] = true
            this.annotatorOptions.toArray()[i].changeDetector.detectChanges()
            this.dimensionsPointwise.toArray()[i].changeDetector.detectChanges()
        }
    }

    /* |--------- PAIRWISE ---------| */

    /*
    * //@AggiunteAbbondo
    /* contains the last element(pairwise) selected */
    valueCheck: number
    //selected_statement:string;
    selected_stetements: Object[] = [];
    checkedValue = new Array();

    /*
    //@AggiunteAbbondo
      Funziona che cambia il colore del div dello statemente

      this.checkedValue[documentnumber][0][0]=true mette al true la prima dimension cosi da venire visuallizata
    */
    public changeColor(valueData: Object, documentnumber: number) {
        //this.selected_statement=valueData["value"]
        //this.selected_stetements[documentnumber]=valueData["value"];
        let a = document.getElementById("StatementA." + documentnumber) as HTMLInputElement
        let b = document.getElementById("StatementB." + documentnumber) as HTMLInputElement
        if (valueData["value"] == "A") {
            a.style.backgroundColor = "#B6BDE2"
            b.style.backgroundColor = "#FCFCFC"
        } else if (valueData["value"] == "B") {
            b.style.backgroundColor = "#B6BDE2"
            a.style.backgroundColor = "#FCFCFC"
        } else {
            b.style.backgroundColor = "#B6BDE2"
            a.style.backgroundColor = "#B6BDE2"
        }


        if (valueData['source']['_checked'] == true) {

            // mette al true la prima dimension del primo documento cosi da venire visualizzata
            this.checkedValue[documentnumber][0][0] = true
            this.checkedValue[documentnumber][0][1] = true
        }
    }

    //@AggiunteAbbondo
    // metodo che crea l'array tridimensionale
    public dimensionValueinsert() {
        for (let i = 0; i < this.task.documentsAmount; i++) {
            let statement = new Array();
            for (let j = 0; j < this.task.dimensionsAmount; j++) {
                let pairwise = new Array()
                pairwise[0] = false
                pairwise[1] = false
                statement[j] = pairwise
            }
            this.checkedValue[i] = statement
        }

    }

    //@AggiunteAbbondo
    // Metodo che cambia la lettera che mostrata sulla scritta Answer for Statement
    public changeletter(index: number) {
        if (index == 0) {
            return 'A';
        } else {
            return 'B';
        }
    }

    //@AggiunteAbbondo
    //Metodo che controllo se le due dimension(Scale) precedenti sono state cliccate
    public checkdimension(documentnumber: number, dimensionnumber: number) {
        if (this.checkedValue[documentnumber][dimensionnumber][0] == true && this.checkedValue[documentnumber][dimensionnumber][1] == true) {
            return true
        } else {
            return false
        }
    }

    //@AggiunteAbbondo
    //Cambia il valore delle dimesion(Scale) da false a  true
    public changeValue(documentnumber: number, dimensionnumber: number, j: number) {
        if (dimensionnumber >= this.task.dimensionsAmount) {
        } else {
            this.checkedValue[documentnumber][dimensionnumber][j] = true
        }
    }

    //@AggiunteAbbondo
    //Cambia il colore del radio button una volta cliccato sullo statement
    public changeColorRadio(valueData: Object, document_index: number) {
        let a = document.getElementById("radioStatementA." + document_index) as HTMLInputElement
        let b = document.getElementById("radioStatementB." + document_index) as HTMLInputElement
        if (valueData["value"] == "A") {
            if (b.classList.contains('mat-radio-checked')) {
                b.classList.remove('mat-radio-checked')
            }
            a.classList.add('mat-radio-checked')
        } else {
            if (a.classList.contains('mat-radio-checked')) {
                a.classList.remove('mat-radio-checked')
            }
            b.classList.add('mat-radio-checked')
        }
    }

    //@AggiunteAbbondo
    //Cambia il colore per gli altri due radio quanto si clicca sullo radio centrale
    public changeBoth(document_index: number) {
        let a = document.getElementById("radioStatementA." + document_index) as HTMLInputElement
        let b = document.getElementById("radioStatementB." + document_index) as HTMLInputElement

        b.classList.remove('mat-radio-checked')
        a.classList.remove('mat-radio-checked')
    }

    /* |--------- QUALITY CHECKS ---------| */

    /*
     * This function performs and scan of each form filled by the current worker (currentDocument.e., questionnaires + document answers)
     * to ensure that each form posses the validation step (currentDocument.e., each field is filled, the url provided as a justification
     * is an url retrieved by search engine, a truth level is selected, etc.)
     */
    public performGlobalValidityCheck() {
        /* The "valid" flag of each questionnaire or document form must be true to pass this check. */
        let questionnaireFormValidity = true;
        let documentsFormValidity = true;
        for (let index = 0; index < this.questionnairesForm.length; index++) if (this.questionnairesForm[index].valid == false) questionnaireFormValidity = false;
        for (let index = 0; index < this.assessmentForms.length; index++) if (this.assessmentForms[index].valid == false) documentsFormValidity = false;
        return (questionnaireFormValidity && documentsFormValidity)
    }


    /*
     * This function resets the task by bringing the worker to the first document if he still has some available tries.
     * The worker can trigger this operation by clicking the "Reset" button when quality checks are completed and the outcome is shown.
     */
    public performReset() {

        /* The loading spinner is started */
        this.ngxService.start();

        this.sectionService.taskFailed = false;
        this.sectionService.taskSuccessful = false;
        this.sectionService.taskCompleted = false;
        this.sectionService.taskStarted = true;
        this.sectionService.decreaseAllowedTries();

        /* Set stepper document_index to the first tab (currentDocument.e., bring the worker to the first document after the questionnaire) */
        this.stepper.selectedIndex = this.task.questionnaireAmountStart;

        /* Decrease the remaining tries amount*/
        this.task.settings.allowed_tries = this.task.settings.allowed_tries - 1;

        /* Increases the current try document_index */
        this.task.tryCurrent = this.task.tryCurrent + 1;

        /* The countdowns are set back to 0 */
        if (this.task.settings.countdown_time >= 0) {
            if (this.countdown.toArray()[0].left > 0) {
                this.countdown.toArray()[0].resume();
            }
        }

        this.outcomeSection.commentSent = false

        /* The loading spinner is stopped */
        this.ngxService.stop();

    }

    // |--------- AMAZON AWS INTEGRATION - FUNCTIONS ---------|

    public handleQuestionnaireFilled(data) {
        this.questionnairesForm[data['step']] = data['questionnaireForm']
        this.produceData(data['action'], data['step'])
        if (data['action'] == 'Next') {
            this.nextStep()
        } else {
            if (data['action'] == 'Back') {
                this.previousStep()
            } else {
                this.nextStep()
            }
        }

    }

    public handleCountdowns(currentElement: number, documentIndex: number, action: string) {
        /* The countdowns are stopped and resumed to the left or to the right of the current document,
        *  depending on the chosen action ("Back" or "Next") */
        if ((currentElement >= this.task.questionnaireAmountStart && currentElement < this.task.questionnaireAmountStart + this.task.documentsAmount) && this.task.settings.countdown_time >= 0) {
            let currentIndex = currentElement - this.task.questionnaireAmountStart;
            switch (action) {
                case "Next":
                    if (currentIndex > 0 && this.countdown.toArray()[currentIndex - 1].left > 0) {
                        this.countdown.toArray()[currentIndex - 1].pause();
                    }
                    if (this.countdown.toArray()[currentIndex].left == this.task.documentsCountdownTime[documentIndex]) {
                        this.countdown.toArray()[currentIndex].begin();
                    } else if (this.countdown.toArray()[currentIndex].left > 0) {
                        this.countdown.toArray()[currentIndex].resume();
                    }
                    break;
                case "Back":
                    if (this.countdown.toArray()[currentIndex + 1].left > 0) {
                        this.countdown.toArray()[currentIndex + 1].pause();
                    }
                    if (this.countdown.toArray()[currentIndex].left == this.task.documentsCountdownTime[documentIndex]) {
                        this.countdown.toArray()[currentIndex].begin();
                    } else if (this.countdown.toArray()[currentIndex].left > 0) {
                        this.countdown.toArray()[currentIndex].resume();
                    }
                    break;
                case "Finish":
                    if (this.countdown.toArray()[currentIndex - 1].left > 0) {
                        this.countdown.toArray()[currentIndex - 1].pause();
                    }
                    break;
            }
        }
    }

    public computeTimestamps(currentElement: number, completedElement: number, action: string) {

        let timeInSeconds = Date.now() / 1000;
        switch (action) {
            case "Next":
                /*
                 * If a transition to the following document is performed the current timestamp is:
                 * the start timestamp for the document at <stepper.selectedIndex>
                 * the end timestamps for the document at <stepper.selectedIndex - 1>
                 */
                this.task.timestampsStart[currentElement].push(timeInSeconds);
                this.task.timestampsEnd[completedElement].push(timeInSeconds);
                break;
            case "Back":
                /*
                 * If a transition to the previous document is performed the current timestamp is:
                 * the start timestamp for the document at <stepper.selectedIndex>
                 * the end timestamps for the document at <stepper.selectedIndex + 1>
                 */
                this.task.timestampsStart[currentElement].push(timeInSeconds);
                this.task.timestampsEnd[completedElement].push(timeInSeconds);
                break;
            case "Finish":
                /* If the task finishes, the current timestamp is the end timestamp for the current document. */
                this.task.timestampsEnd[currentElement].push(timeInSeconds);
                break;
        }

        /*
         * The general idea with start and end timestamps is that each time a worker goes to
         * the next document, the current timestamp is the start timestamp for such document
         * and the end timestamp for the previous and viceversa
         */

        /* In the corresponding array the elapsed timestamps for each document are computed */
        for (let i = 0; i < this.task.documentsAmount + this.task.questionnaireAmount; i++) {
            let totalSecondsElapsed = 0;
            for (let k = 0; k < this.task.timestampsEnd[i].length; k++) {
                if (this.task.timestampsStart[i][k] !== null && this.task.timestampsEnd[i][k] !== null) {
                    totalSecondsElapsed = totalSecondsElapsed + (Number(this.task.timestampsEnd[i][k]) - Number(this.task.timestampsStart[i][k]))
                }
            }
            this.task.timestampsElapsed[i] = totalSecondsElapsed
        }
    }

    public performQualityChecks() {
        /*
             * This section performs the checks needed to ensure that the worker has made a quality work.
             * Three checks are performed:
             * 1) GLOBAL VALIDITY CHECK (QUESTIONNAIRE + DOCUMENTS): Verifies that each field of each form has valid values
             * 2) GOLD QUESTION CHECK:   Implements a custom check on gold elements retrieved using their ids.
             *                           An element is gold if its id contains the word "GOLD-".
             * 3) TIME SPENT CHECK:      Verifies if the time spent by worker on each document and questionnaire is higher than
             *                           <timeCheckAmount> seconds, using the <timestampsElapsed> array
             * If each check is successful, the task can end. If the worker has some tries left, the task is reset.
             */

        let globalValidityCheck: boolean;
        let timeSpentCheck: boolean;
        let timeCheckAmount = this.task.settings.time_check_amount;

        /* 1) GLOBAL VALIDITY CHECK performed here */
        globalValidityCheck = this.performGlobalValidityCheck();

        /* 2) GOLD ELEMENTS CHECK performed here */

        let goldConfiguration = []
        /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
        for (let goldDocument of this.task.goldDocuments) {
            let currentConfiguration = {}
            currentConfiguration["document"] = goldDocument
            let answers = {}
            for (let goldDimension of this.task.goldDimensions) {
                for (let [attribute, value] of Object.entries(this.assessmentForms[goldDocument.index].value)) {
                    let dimensionName = attribute.split("_")[0]
                    if (dimensionName == goldDimension.name) {
                        answers[attribute] = value
                    }
                }
            }
            currentConfiguration["answers"] = answers
            currentConfiguration["notes"] = this.task.notes ? this.task.notes[goldDocument.index] : []
            goldConfiguration.push(currentConfiguration)
        }

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        let goldChecks = GoldChecker.performGoldCheck(goldConfiguration)

        /* 3) TIME SPENT CHECK performed here */
        timeSpentCheck = true;
        this.task.timestampsElapsed.forEach(item => {
            if (item < timeCheckAmount) timeSpentCheck = false;
        });

        let qualityCheckData = {
            globalOutcome: null,
            globalFormValidity: globalValidityCheck,
            timeSpentCheck: timeSpentCheck,
            timeCheckAmount: timeCheckAmount,
            goldChecks: goldChecks,
            goldConfiguration: goldConfiguration
        };

        let checksOutcome = []
        let checker = array => array.every(Boolean);

        checksOutcome.push(qualityCheckData['globalFormValidity'])
        checksOutcome.push(qualityCheckData['timeSpentCheck'])
        checksOutcome.push(checker(qualityCheckData['goldChecks']))

        qualityCheckData['globalOutcome'] = checker(checksOutcome)

        /* If each check is true, the task is successful, otherwise the task is failed (but not over if there are more tries) */

        return qualityCheckData

    }

    /*
     * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
     */
    public async produceData(action: string, documentIndex: number) {

        if (action == "Finish") {
            /* The current try is completed and the final can shall begin */
            this.ngxService.start()
        }

        /* IMPORTANT: The current document document_index is the stepper current document_index AFTER the transition
             * If a NEXT action is performed at document 3, the stepper current document_index is 4.
             * If a BACK action is performed at document 3, the stepper current document_index is 2.
             * This is tricky only for the following switch which has to set the start/end
             * timestamps for the previous/following document. */
        let currentElement = this.stepper.selectedIndex;
        /* completedElement is the document_index of the document/questionnaire in which the user was before */
        let completedElement = this.stepper.selectedIndex;

        switch (action) {
            case "Next":
                completedElement = currentElement - 1;
                break;
            case "Back":
                completedElement = currentElement + 1;
                break;
            case "Finish":
                completedElement = this.task.getElementsNumber() - 1;
                currentElement = this.task.getElementsNumber() - 1;
                break;
        }

        this.computeTimestamps(currentElement, completedElement, action)
        this.handleCountdowns(currentElement, documentIndex, action)
        if (this.task.settings.annotator.type == 'options') this.annotatorOptions.toArray()[documentIndex].handleNotes(completedElement)

        let qualityChecks = null
        if (action == "Finish") {
            qualityChecks = this.performQualityChecks()
            qualityChecks['info'] = {
                try: this.task.tryCurrent,
                sequence: this.task.sequenceNumber,
                element: "checks"
            };
        }

        /* If there is a worker ID then the data should be uploaded to the S3 bucket */

        if (!(this.worker.identifier == null)) {

            let data = {}
            let actionInfo = {
                try: this.task.tryCurrent,
                sequence: this.task.sequenceNumber,
                element: "data"
            };
            /* The full information about task setup (currentDocument.e., its document and questionnaire structures) are uploaded, only once */
            let taskData = {
                platform_name: this.configService.environment.platformName,
                task_id: this.configService.environment.taskName,
                batch_name: this.configService.environment.batchName,
                worker_id: this.worker.identifier,
                unit_id: this.task.unitId,
                token_input: this.tokenInput.value,
                token_output: this.task.tokenOutput,
                tries_amount: this.task.settings.allowed_tries,
                questionnaire_amount: this.task.questionnaireAmount,
                questionnaire_amount_start: this.task.questionnaireAmountStart,
                questionnaire_amount_end: this.task.questionnaireAmountEnd,
                documents_amount: this.task.documentsAmount,
                dimensions_amount: this.task.dimensionsAmount
            };
            data["info"] = actionInfo
            /* General info about task */
            data["task"] = taskData
            /* The answers of the current worker to the questionnaire */
            data["questionnaires"] = this.task.questionnaires
            /* The parsed document contained in current worker's hit */
            data["documents"] = this.task.documents
            /* The dimensions of the answers of each worker */
            data["dimensions"] = this.task.dimensions
            /* General info about worker */
            data["worker"] = this.worker
            /* await (this.upload(`${this.workerFolder}/worker.json`, this.worker)); */

            if (this.task.sequenceNumber <= 0) {
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, data)
                this.task.sequenceNumber = this.task.sequenceNumber + 1
            }

            /* If the worker has completed a questionnaire */
            if (completedElement < this.task.questionnaireAmountStart || (completedElement >= this.task.questionnaireAmountStart + this.task.documentsAmount)) {

                /* if the questionnaire it's at the end */

                let completedQuestionnaire = 0
                if (completedElement >= this.task.questionnaireAmountStart + this.task.documentsAmount) {
                    completedQuestionnaire = completedElement - this.task.documentsAmount
                } else {
                    completedQuestionnaire = completedElement
                }

                /* The amount of accesses to the current questionnaire is retrieved */
                let accessesAmount = this.task.elementsAccesses[completedElement];

                /* If the worker has completed the first questionnaire
                 * The partial data about the completed questionnaire are uploaded */

                let data = {}

                let actionInfo = {
                    action: action,
                    access: accessesAmount,
                    try: this.task.tryCurrent,
                    index: completedQuestionnaire,
                    sequence: this.task.sequenceNumber,
                    element: "questionnaire"
                };
                /* Info about the performed action ("Next"? "Back"? From where?) */
                data["info"] = actionInfo
                /* Worker's answers to the current questionnaire */
                let answers = this.questionnairesForm[completedQuestionnaire].value;
                data["answers"] = answers
                /* Start, end and elapsed timestamps for the current questionnaire */
                let timestampsStart = this.task.timestampsStart[completedElement];
                data["timestamps_start"] = timestampsStart
                let timestampsEnd = this.task.timestampsEnd[completedElement];
                data["timestamps_end"] = timestampsEnd
                let timestampsElapsed = this.task.timestampsElapsed[completedElement];
                data["timestamps_elapsed"] = timestampsElapsed
                /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
                data["accesses"] = accessesAmount + 1

                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, data)

                /* The amount of accesses to the current questionnaire is incremented */
                this.task.sequenceNumber = this.task.sequenceNumber + 1
                this.task.elementsAccesses[completedElement] = accessesAmount + 1;

                /* If the worker has completed a document */
            } else {

                /* The document_index of the completed document is the completed element minus the questionnaire amount */
                let completedDocument = completedElement - this.task.questionnaireAmountStart;

                /* The amount of accesses to the current document is retrieved */
                let accessesAmount = this.task.elementsAccesses[completedElement];

                let data = {}

                let actionInfo = {
                    action: action,
                    access: accessesAmount,
                    try: this.task.tryCurrent,
                    index: completedDocument,
                    sequence: this.task.sequenceNumber,
                    element: "document"
                };
                /* Info about the performed action ("Next"? "Back"? From where?) */
                data["info"] = actionInfo
                /* Worker's answers for the current document */
                let answers = this.assessmentForms[completedDocument].value;
                data["answers"] = answers
                let notes = (this.task.settings.annotator) ? this.task.notes[completedDocument] : []
                data["notes"] = notes
                /* Worker's dimensions selected values for the current document */
                let dimensionsSelectedValues = this.task.dimensionsSelectedValues[completedDocument];
                data["dimensions_selected"] = dimensionsSelectedValues
                /* Worker's search engine queries for the current document */
                let searchEngineQueries = this.task.searchEngineQueries[completedDocument];
                data["queries"] = searchEngineQueries
                /* Start, end and elapsed timestamps for the current document */
                let timestampsStart = this.task.timestampsStart[completedElement];
                data["timestamps_start"] = timestampsStart
                let timestampsEnd = this.task.timestampsEnd[completedElement];
                data["timestamps_end"] = timestampsEnd
                let timestampsElapsed = this.task.timestampsElapsed[completedElement];
                data["timestamps_elapsed"] = timestampsElapsed
                /* Countdown time and corresponding flag */
                let countdownTimeStart = (this.task.settings.countdown_time >= 0) ? this.task.documentsCountdownTime[completedDocument] : []
                data["countdowns_times_start"] = countdownTimeStart
                let countdownTime = (this.task.settings.countdown_time >= 0) ? Number(this.countdown.toArray()[completedDocument]["i"]["text"]) : []
                data["countdowns_times_left"] = countdownTime
                let countdown_expired = (this.task.settings.countdown_time >= 0) ? this.task.countdownsExpired[completedDocument] : []
                data["countdowns_expired"] = countdown_expired
                /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
                let accesses = accessesAmount + 1
                data["accesses"] = accesses
                /* Responses retrieved by search engine for each worker's query for the current document */
                let responsesRetrieved = this.task.searchEngineRetrievedResponses[completedDocument];
                data["responses_retrieved"] = responsesRetrieved
                /* Responses by search engine ordered by worker's click for the current document */
                let responsesSelected = this.task.searchEngineSelectedResponses[completedDocument];
                data["responses_selected"] = responsesSelected

                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, data)

                /* The amount of accesses to the current document is incremented */
                this.task.elementsAccesses[completedElement] = accessesAmount + 1;
                this.task.sequenceNumber = this.task.sequenceNumber + 1
                /* If the worker has completed the last element the sequence number must be incremented again */
            }

            /* If the worker has completed the last element */

            if (completedElement >= (this.task.questionnaireAmountStart + this.task.documentsAmount + this.task.questionnaireAmountEnd) - 1) {

                /* All data about documents are uploaded, only once */
                let actionInfo = {
                    action: action,
                    try: this.task.tryCurrent,
                    sequence: this.task.sequenceNumber,
                    element: "all"
                };
                /* Info about each performed action ("Next"? "Back"? From where?) */
                data["info"] = actionInfo
                let answers = [];
                for (let index = 0; index < this.questionnairesForm.length; index++) answers.push(this.questionnairesForm[index].value);
                data["questionnaires_answers"] = answers
                answers = [];
                for (let index = 0; index < this.assessmentForms.length; index++) answers.push(this.assessmentForms[index].value);
                data["documents_answers"] = answers
                let notes = (this.task.settings.annotator) ? this.task.notes : []
                data["notes"] = notes
                /* Worker's dimensions selected values for the current document */
                data["dimensions_selected"] = this.task.dimensionsSelectedValues
                /* Start, end and elapsed timestamps for each document */
                data["timestamps_start"] = this.task.timestampsStart
                data["timestamps_end"] = this.task.timestampsEnd
                data["timestamps_elapsed"] = this.task.timestampsElapsed
                /* Countdown time and corresponding flag for each document */
                let countdownTimes = [];
                let countdownTimesStart = [];
                let countdownExpired = [];
                if (this.task.settings.countdown_time >= 0)
                    for (let countdown of this.countdown) countdownTimes.push(countdown["i"]);
                if (this.task.settings.countdown_time >= 0)
                    for (let countdown of this.task.documentsCountdownTime) countdownTimesStart.push(countdown);
                for (let index = 0; index < this.task.countdownsExpired.length; index++) countdownExpired.push(this.task.countdownsExpired[index]);
                data["countdowns_times_start"] = countdownTimesStart
                data["countdowns_times_left"] = countdownTimes
                data["countdowns_expired"] = countdownExpired
                /* Number of accesses to each document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
                data["accesses"] = this.task.elementsAccesses
                /* Worker's search engine queries for each document */
                data["queries"] = this.task.searchEngineQueries
                /* Responses retrieved by search engine for each worker's query for each document */
                data["responses_retrieved"] = this.task.searchEngineRetrievedResponses
                /* Responses by search engine ordered by worker's click for the current document */
                data["responses_selected"] = this.task.searchEngineSelectedResponses
                /* If the last element is a document */
                qualityChecks["info"]["sequence"] = this.task.sequenceNumber
                data["checks"] = qualityChecks

                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, qualityChecks)
                this.task.sequenceNumber = this.task.sequenceNumber + 1
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, data)
                this.task.sequenceNumber = this.task.sequenceNumber + 1

            }

        }

        if (action == "Finish") {

            if (qualityChecks['globalOutcome']) {
                this.sectionService.taskSuccessful = true;
                this.sectionService.taskFailed = false;

            } else {
                this.sectionService.taskSuccessful = false;
                this.sectionService.taskFailed = true;
            }
            this.sectionService.taskCompleted = true;


            /* Lastly, we update the ACL */
            if (!(this.worker.identifier == null)) {
                if (this.sectionService.taskSuccessful) {
                    this.worker.setParameter('in_progress', 'false')
                    this.worker.setParameter('paid', 'true')
                    this.worker.setParameter('time_completion', new Date().toUTCString())
                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, this.task.tryCurrent)
                } else {
                    if (this.task.settings.allowed_tries > this.task.tryCurrent) {
                        this.worker.setParameter('in_progress', 'false')
                        this.worker.setParameter('paid', 'false')
                        this.worker.setParameter('time_completion', new Date().toUTCString())
                        await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, this.task.tryCurrent)
                    }
                }
            }

            this.ngxService.stop()

            this.changeDetector.detectChanges()

        }
    }

    /*
     * This function gives the possibility to the worker to provide a comment when a try is finished, successfully or not.
     * The comment can be typed in a textarea and when the worker clicks the "Send" button such comment is uploaded to an Amazon S3 bucket.
     */
    public async performCommentSaving(comment) {
        if (!(this.worker.identifier == null)) {
            let data = {}
            let actionInfo = {
                try: this.task.tryCurrent,
                sequence: this.task.sequenceNumber,
                element: "comment"
            };
            data["info"] = actionInfo
            data['comment'] = comment
            await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker.identifier, this.task.unitId, this.task.tryCurrent, this.task.sequenceNumber, data)
            this.task.sequenceNumber = this.task.sequenceNumber + 1
        }
        this.outcomeSection.commentSent = true
    }

    /* |--------- OTHER AMENITIES ---------| */

    public showSnackbar(message, action, duration) {
        this.snackBar.open(message, action, {
            duration: duration,
        });
    }


}

