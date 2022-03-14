/* Core */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, QueryList, ViewChild, ViewChildren} from "@angular/core";
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
import {HttpClient, HttpHeaders} from "@angular/common/http";
/* Services */
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {ConfigService} from "../../services/config.service";
import {S3Service} from "../../services/aws/s3.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {ActionLogger} from "../../services/userActionLogger.service";
/* Models */
import {Task} from "../../models/skeleton/task";
import {Worker} from "../../models/worker/worker";
import {TaskSettings} from "../../models/skeleton/taskSettings";
import {GoldChecker} from "../../../../data/build/skeleton/goldChecker";
import {WorkerSettings} from "../../models/worker/workerSettings";
import {Hit} from "../../models/skeleton/hit";
/* Material Design */
import {MatSnackBar} from "@angular/material/snack-bar";
/* Services */
import {SectionService} from "../../services/section.service";
import {DynamoDBService} from "../../services/aws/dynamoDB.service";
import {UtilsService} from "../../services/utils.service";
import {DebugService} from "../../services/debug.service";
/* Components */
import {OutcomeSectionComponent} from "./outcome/outcome-section.component";
import {DocumentComponent} from "./document/document.component";

/* Component HTML Tag definition */
@Component({
    selector: 'app-skeleton',
    templateUrl: './skeleton.component.html',
    styleUrls: ['./skeleton.component.scss'],
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
    documentsForm: FormGroup[];
    @ViewChildren(DocumentComponent) documentComponent: QueryList<DocumentComponent>;

    /* Array of form references, one for each questionnaire within a Hit */
    questionnairesForm: FormGroup[];

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
        this.sectionService.task = this.task
        this.task.taskName = this.configService.environment.taskName
        this.task.batchName = this.configService.environment.batchName

        if (this.configService.environment.debug_mode == 'true') {
            this.enableTask()
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

                    this.sectionService.taskAllowed = taskAllowed

                    if (taskAllowed) {

                        /* The worker's remote S3 folder is retrieved */
                        this.worker.folder = this.S3Service.getWorkerFolder(this.configService.environment, this.worker)
                        this.worker.setParameter('task_name', this.configService.environment.taskName)
                        this.worker.setParameter('batch_name', this.configService.environment.batchName)
                        this.worker.setParameter('folder', this.worker.folder)
                        this.worker.setParameter('paid', String(false))
                        this.worker.setParameter('in_progress', String(false))
                        this.worker.setParameter('try_left', String(this.task.settings.allowed_tries))
                        this.worker.setParameter('time_arrival', new Date().toUTCString())
                        /* Some worker properties are loaded using ngxDeviceDetector npm package capabilities... */
                        this.worker.updateProperties('ngxdevicedetector', this.deviceDetectorService.getDeviceInfo())
                        /* ... or the simple Navigator DOM's object */
                        this.worker.updateProperties('navigator', window.navigator)

                        /* We fetch the task's HITs */
                        let hits = await this.S3Service.downloadHits(this.configService.environment)
                        /* Flag to understand if there is a HIT assigned to the current worker */
                        let hitAssigned = false

                        /* Anonymous function to assing the found HIT to the worker and mark it as in progress.
                           it also sets the HIT's input token in the form control */
                        let assignHit = function (worker, hit, tokenInput) {
                            worker.setParameter('unit_id', hit['unit_id'])
                            worker.setParameter('in_progress', String(true))
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
                                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, true)
                                    /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                    hitAssigned = true
                                    break
                                }
                            }

                            /* If the flag is still false, it means that all the available HITs have been assigned once...
                               ... however, a worker have probably abandoned the task if someone reaches this point of the code. */

                            let lastUnpaidUnassignedHit = null

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
                                wholeEntries.sort((a, b) => (a.time_arrival > b.time_arrival) ? 1 : -1)

                                for (let aclEntry of wholeEntries) {

                                    /*
                                    If the worker that received the current unit did not complete it he abandoned or returned the task.
                                    Thus, we free its slot, and we assign the HIT found to the current worker.
                                    This happens also if the worker does not have any try left, and thus it's entry has a completion time but the two flags are set to false.
                                    */

                                    let timeArrival = new Date(aclEntry['time_arrival']).getTime()
                                    let timeActual = new Date().getTime()
                                    let hoursElapsed = Math.abs(timeActual - timeArrival) / 36e5;
                                    if (((/true/i).test(aclEntry['paid']) == false && (/true/i).test(aclEntry['in_progress']) == true) && hoursElapsed > this.task.settings.time_assessment ||
                                        ((/true/i).test(aclEntry['paid']) == false && (/true/i).test(aclEntry['in_progress']) == false) && parseInt(aclEntry['try_left'])<=1) {

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
                                        await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, true)
                                        /* The record for the worker that abandoned/returned the task is updated */
                                        aclEntry['time_expired'] = String(true)
                                        aclEntry['in_progress'] = String(false)
                                        await this.dynamoDBService.insertACLRecordUnitId(this.configService.environment, aclEntry, this.task.tryCurrent, false, true)
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
                            if ((/true/i).test(aclEntry['in_progress']) == false && (/true/i).test(aclEntry['paid']) == false) {
                                /* As of today, such a worker is not allowed to perform the task */
                                taskAllowed = false
                            } else {
                                /* Otherwise, the corresponding hit is searched to set the input token */
                                for (let hit of hits) {
                                    if (hit['unit_id'] == aclEntry['unit_id']) {
                                        this.tokenInput.setValue(hit['token_input'])
                                        await this.dynamoDBService.insertACLRecordUnitId(this.configService.environment, aclEntry, this.task.tryCurrent, true, false)
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

                        /* We launch a call to Cloudflare to trace the worker */
                        if (this.worker.settings.analysis) {
                            this.client.get('https://www.cloudflare.com/cdn-cgi/trace', {responseType: 'text'}).subscribe(
                                /* If we retrieve some data from Cloudflare we use them to populate worker's object */
                                cloudflareData => {
                                    this.worker.updateProperties('cloudflare', cloudflareData)
                                    unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed)
                                },
                                /* Otherwise, we won't have such information */
                                error => {
                                    this.worker.updateProperties('error', error)
                                    unlockTask(this.changeDetector, this.ngxService, this.sectionService, taskAllowed);
                                }
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
        this.task.settings = new TaskSettings(await this.S3Service.downloadTaskSettings(this.configService.environment))
        this.worker.settings = new WorkerSettings(await this.S3Service.downloadWorkers(this.configService.environment))
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

            this.sectionService.taskStarted = true;

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

            /* A form for each document is initialized */
            this.documentsForm = new Array<FormGroup>();

            let questionnaires = await this.S3Service.downloadQuestionnaires(this.configService.environment)
            this.task.initializeQuestionnaires(questionnaires)

            /* A form for each questionnaire is initialized */
            this.questionnairesForm = new Array<FormGroup>();


            /* The evaluation instructions stored on Amazon S3 are retrieved */
            this.task.initializeInstructionsEvaluation(await this.S3Service.downloadEvaluationInstructions(this.configService.environment))

            /* |--------- DIMENSIONS ELEMENTS (see: dimensions.json) ---------| */

            this.task.initializeDimensions(await this.S3Service.downloadDimensions(this.configService.environment))

            this.task.loadAccessCounter()
            this.task.loadTimestamps()

            if (!(this.worker.identifier == null)) {
                let taskInitialPayload = this.task.buildTaskInitialPayload(this.worker)
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, taskInitialPayload)
            }

        }

        /* The loading spinner is stopped */
        this.ngxService.stop();
        this.changeDetector.detectChanges()

    }

    /* |--------- LOGGING SERVICE & SECTION SERVICE ---------| */

    /* Logging service initialization */
    public logInit(workerIdentifier, taskName, batchName, http: HttpClient, logOnConsole: boolean) {
        this.actionLogger.logInit(this.configService.environment.bucket, workerIdentifier, taskName, batchName, http, logOnConsole);
    }

    public updateQuestionnaireForm(form, questionnaireIndex) {
        this.questionnairesForm[questionnaireIndex] = form
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
        for (let index = 0; index < this.documentsForm.length; index++) if (this.documentsForm[index].valid == false) documentsFormValidity = false;
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

        /* Set stepper document_index to the first tab (currentDocument.e., bring the worker to the first document after the questionnaire) */
        this.stepper.selectedIndex = this.task.questionnaireAmountStart;

        /* Decrease the remaining tries amount*/
        this.task.settings.allowed_tries = this.task.settings.allowed_tries - 1;

        /* Increases the current try document_index */
        this.task.tryCurrent = this.task.tryCurrent + 1;

        /* The countdowns are set back to 0 */
        if (this.task.settings.countdown_time >= 0) {
            if (this.documentComponent[0].countdown.left > 0) {
                this.documentComponent[0].countdown.resume();
            }
        }

        this.outcomeSection.commentSent = false

        /* The loading spinner is stopped */
        this.ngxService.stop();

    }

    public handleCountdowns(currentDocument: number, completedDocument: number, action: string) {
        /* The countdowns are stopped and resumed to the left or to the right of the current document,
        *  depending on the chosen action ("Back" or "Next") */
        let currentIndex = currentDocument
        let countdown = this.documentComponent[currentIndex].countdown
        switch (action) {
            case "Next":
                if (currentIndex > 0 && countdown.toArray()[currentIndex - 1].left > 0) {
                    countdown.toArray()[currentIndex - 1].pause();
                }
                if (countdown.toArray()[currentIndex].left == this.task.documentsCountdownTime[completedDocument]) {
                    countdown.toArray()[currentIndex].begin();
                } else if (countdown.toArray()[currentIndex].left > 0) {
                    countdown.toArray()[currentIndex].resume();
                }
                break;
            case "Back":
                if (countdown.toArray()[currentIndex + 1].left > 0) {
                    countdown.toArray()[currentIndex + 1].pause();
                }
                if (countdown.toArray()[currentIndex].left == this.task.documentsCountdownTime[completedDocument]) {
                    countdown.toArray()[currentIndex].begin();
                } else if (countdown.toArray()[currentIndex].left > 0) {
                    countdown.toArray()[currentIndex].resume();
                }
                break;
            case "Finish":
                if (countdown.toArray()[currentIndex - 1].left > 0) {
                    countdown.toArray()[currentIndex - 1].pause();
                }
                break;
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
                for (let [attribute, value] of Object.entries(this.documentsForm[goldDocument.index].value)) {
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
     * This function gives the possibility to the worker to provide a comment when a try is finished, successfully or not.
     * The comment can be typed in a textarea and when the worker clicks the "Send" button such comment is uploaded to an Amazon S3 bucket.
     */
    public async performCommentSaving(comment) {
        this.outcomeSection.commentSent = true
        if (!(this.worker.identifier == null)) {
            let data = {}
            let actionInfo = {
                try: this.task.tryCurrent,
                sequence: this.task.sequenceNumber,
                element: "comment"
            };
            data["info"] = actionInfo
            data['comment'] = comment
            await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, data)
            this.task.sequenceNumber = this.task.sequenceNumber + 1
        }
    }

    public storeQuestionnaireForm(data, questionnaireIndex) {
        if (!this.questionnairesForm[questionnaireIndex])
            this.questionnairesForm[questionnaireIndex] = data["form"]
        let action = data["action"]
        if (action) {
            this.produceData(action, questionnaireIndex)
        }
    }

    public storeDocumentForm(data, documentIndex) {
        if (!this.documentsForm[documentIndex])
            this.documentsForm[documentIndex] = data["form"]
        let action = data["action"]
        if (action) {
            this.produceData(action, documentIndex)
        }

    }

    /*
     * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
     */
    public async produceData(action: string, completedElement) {


        if (action == "Finish") {
            /* The current try is completed and the final can shall begin */
            this.ngxService.start()
        }

        let currentElement = this.stepper.selectedIndex;
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

        let completedElementBaseIndex = completedElement
        let currentElementBaseIndex = currentElement
        let completedElementData = this.task.getElementIndex(completedElement)
        let currentElementData = this.task.getElementIndex(currentElement)
        let completedElementType = completedElementData['elementType']
        let completedElementIndex = completedElementData['elementIndex']
        let currentElementType = currentElementData['elementType']
        let currentElementIndex = currentElementData['elementIndex']

        this.task.elementsAccesses[completedElementBaseIndex] = this.task.elementsAccesses[completedElementBaseIndex] + 1;

        this.computeTimestamps(currentElementBaseIndex, completedElementBaseIndex, action)
        if (this.task.settings.countdown_time) {
            if (currentElementType == 'S') {
                this.handleCountdowns(currentElementIndex, completedElementIndex, action)
            }
        }
        if (this.task.settings.annotator) {
            if (this.task.settings.annotator.type == 'options') {
                if (completedElementType == 'S') {
                    this.documentComponent[completedElementIndex].annotatorOptions.handleNotes()
                }
            }
        }

        let qualityChecks = null
        let qualityChecksPayload = null

        if (action == "Finish") {
            qualityChecks = this.performQualityChecks()
            qualityChecksPayload = this.task.buildQualityChecksPayload(qualityChecks, action)
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
                    this.worker.setParameter('in_progress', String(false))
                    this.worker.setParameter('paid', String(true))
                    this.worker.setParameter('time_completion', new Date().toUTCString())
                    this.worker.setParameter('try_left', String((this.task.settings.allowed_tries - this.task.tryCurrent) + 1))
                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, false)
                } else {
                    if (this.task.tryCurrent >= this.task.settings.allowed_tries) {
                        this.worker.setParameter('in_progress', String(false))
                        this.worker.setParameter('paid', String(false))
                        this.worker.setParameter('try_left', String((this.task.settings.allowed_tries - this.task.tryCurrent) + 1))
                        this.worker.setParameter('time_completion', new Date().toUTCString())
                        await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, false)
                    } else {
                        this.worker.setParameter('in_progress', String(true))
                        this.worker.setParameter('paid', String(false))
                        this.worker.setParameter('try_left', String((this.task.settings.allowed_tries - this.task.tryCurrent) + 1))
                        this.worker.setParameter('time_completion', new Date().toUTCString())
                        await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker, false)
                    }
                }
            }
        }

        if (!(this.worker.identifier == null)) {

            if (completedElementType == "Q") {
                let questionnairePayload = this.task.buildTaskQuestionnairePayload(completedElementIndex, this.questionnairesForm[completedElementIndex].value, action)
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, questionnairePayload)
            }

            if (completedElementType == "S") {
                let countdown = null
                if (this.task.settings.countdown_time)
                    countdown = Number(this.documentComponent[completedElementIndex].countdown["i"]["text"])
                let documentPayload = this.task.buildTaskDocumentPayload(completedElementIndex, this.documentsForm[completedElementIndex].value, countdown, action)
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, documentPayload)
            }

            if (completedElementBaseIndex == this.task.getElementsNumber() - 1 && action == "Finish") {
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, qualityChecksPayload)
                let countdowns = []
                if (this.task.settings.countdown_time)
                    for (let index = 0; index < this.task.documentsAmount; index++) countdowns.push(this.documentComponent[index].countdown)
                let fullPayload = this.task.buildTaskFinalPayload(this.questionnairesForm, this.documentsForm, qualityChecksPayload, countdowns, action)
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, fullPayload)
            }

        }

        if (action == "Finish") {
            this.ngxService.stop()
            this.changeDetector.detectChanges()
        }

    }

    /* |--------- OTHER AMENITIES ---------| */

    public showSnackbar(message, action, duration) {
        this.snackBar.open(message, action, {
            duration: duration,
        });
    }


}

