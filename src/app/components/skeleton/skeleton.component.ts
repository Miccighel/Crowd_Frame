/* Core */
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    QueryList,
    ViewChild,
    ViewChildren,
    ViewEncapsulation,
} from "@angular/core";
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
import { MatFormField } from "@angular/material/form-field";
import { MatStepper } from "@angular/material/stepper";
import { HttpClient, HttpHeaders } from "@angular/common/http";
/* Services */
import { NgxUiLoaderService } from "ngx-ui-loader";
import { ConfigService } from "../../services/config.service";
import { S3Service } from "../../services/aws/s3.service";
import { DeviceDetectorService } from "ngx-device-detector";
import { ActionLogger } from "../../services/userActionLogger.service";
/* Models */
import { Task } from "../../models/skeleton/task";
import { Worker } from "../../models/worker/worker";
import { TaskSettings } from "../../models/skeleton/taskSettings";
import { GoldChecker } from "../../../../data/build/skeleton/goldChecker";
import { WorkerSettings } from "../../models/worker/workerSettings";
import { Hit } from "../../models/skeleton/hit";
/* Material Design */
import { MatSnackBar } from "@angular/material/snack-bar";
/* Services */
import { SectionService } from "../../services/section.service";
import { StatusCodes } from "../../services/section.service";
import { DynamoDBService } from "../../services/aws/dynamoDB.service";
import { UtilsService } from "../../services/utils.service";
import { DebugService } from "../../services/debug.service";
/* Components */
import { OutcomeSectionComponent } from "./outcome/outcome-section.component";
import { DocumentComponent } from "./document/document.component";
import { LocalStorageService } from "../../services/localStorage.service";
import { fadeIn } from "../chatbot/animations";
import {SearchEngineSettings} from "../../models/searchEngine/searchEngineSettings";

/* Component HTML Tag definition */
@Component({
    selector: "app-skeleton",
    templateUrl: "./skeleton.component.html",
    styleUrls: ["./skeleton.component.scss"],
    animations: [fadeIn],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
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
    actionLogger: ActionLogger;
    /* Service to track current section */
    sectionService: SectionService;
    utilsService: UtilsService;
    localStorageService: LocalStorageService;
    debugService: DebugService;

    /* HTTP client and headers */
    client: HttpClient;
    headers: HttpHeaders;

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

    /* References to task stepper and token forms */
    @ViewChild("stepper", { static: false }) stepper: MatStepper;
    @ViewChild("urlField") urlField: MatFormField;
    tokenForm: UntypedFormGroup;
    tokenInput: UntypedFormControl;
    tokenInputValid: boolean;

    /* Snackbar reference */
    snackBar: MatSnackBar;

    /* Object to encapsulate all task-related information */
    task: Task;

    platform: string;

    /* Object to encapsulate all worker-related information */
    worker: Worker;

    /* Array of form references, one for each document within a Hit */
    documentsForm: UntypedFormGroup[];
    @ViewChildren(DocumentComponent)
    documentComponent: QueryList<DocumentComponent>;

    /* Array of search form references, one for each document within a Hit */
    searchEngineForms: Array<Array<UntypedFormGroup>>;
    resultsRetrievedForms: Array<Array<Object>>;
    
    
    /* Array of form references, one for each questionnaire within a Hit */
    questionnairesForm: UntypedFormGroup[];

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
        formBuilder: UntypedFormBuilder,
        snackBar: MatSnackBar,
        actionLogger: ActionLogger,
        sectionService: SectionService,
        localStorageService: LocalStorageService,
        utilsService: UtilsService,
        debugService: DebugService
    ) {
        /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

        this.changeDetector = changeDetector;
        this.ngxService = ngxService;
        this.configService = configService;
        this.S3Service = S3Service;
        this.dynamoDBService = dynamoDBService;
        this.actionLogger = actionLogger;
        this.sectionService = sectionService;
        this.deviceDetectorService = deviceDetectorService;
        this.utilsService = utilsService;
        this.localStorageService = localStorageService;
        this.debugService = debugService;

        this.client = client;
        this.formBuilder = formBuilder;
        this.snackBar = snackBar;

        this.ngxService.startLoader("skeleton-inner");

        /* |--------- CONTROL FLOW & UI ELEMENTS - INITIALIZATION ---------| */

        this.tokenInput = new UntypedFormControl(
            "",
            [Validators.required, Validators.maxLength(11)],
            this.validateTokenInput.bind(this)
        );
        this.tokenForm = formBuilder.group({
            tokenInput: this.tokenInput,
        });
        this.tokenInputValid = false;

        /* |--------- CONFIGURATION GENERATOR INTEGRATION - INITIALIZATION ---------| */

        this.generator = false;
    }

    /* |--------- MAIN FLOW IMPLEMENTATION ---------| */

    /* To follow the execution flow of the skeleton the functions needs to be read somehow in order (i.e., from top to bottom) */
    public async ngOnInit() {
        this.task = new Task();

        this.task.taskName = this.configService.environment.taskName;
        this.task.batchName = this.configService.environment.batchName;
        this.task.settings = new TaskSettings(
            await this.S3Service.downloadTaskSettings(
                this.configService.environment
            )
        );
        this.task.initializeInstructionsGeneral(
            await this.S3Service.downloadGeneralInstructions(
                this.configService.environment
            )
        );
        this.task.searchEngineSettings = new SearchEngineSettings(
            await this.S3Service.downloadSearchEngineSettings(
                this.configService.environment
            )
        );
        this.sectionService.task = this.task;

        let url = new URL(window.location.href);

        /* The GET URL parameters are parsed and used to init worker's instance */
        let paramsFetched: Record<string, string> = {};
        url.searchParams.forEach((value, param) => {
            if (param.toLowerCase().includes("workerid")) {
                paramsFetched["identifier"] = value;
            } else {
                param = param
                    .replace(/(?:^|\.?)([A-Z])/g, function (x, y) {
                        return "_" + y.toLowerCase();
                    })
                    .replace(/^_/, "");
                paramsFetched[param] = value;
            }
        });

        this.worker = new Worker(paramsFetched);
        /* Some worker properties are loaded using ngxDeviceDetector npm package capabilities... */
        this.worker.updateProperties(
            "ngxdevicedetector",
            this.deviceDetectorService.getDeviceInfo()
        );
        /* ... or the simple Navigator DOM's object */
        this.worker.updateProperties("navigator", window.navigator);

        this.client
            .get("https://www.cloudflare.com/cdn-cgi/trace", {
                responseType: "text",
            })
            .subscribe(
                /* If we retrieve some data from Cloudflare we use them to populate worker's object */
                (cloudflareData) => {
                    this.worker.updateProperties("cloudflare", cloudflareData);
                    this.initializeWorker();
                },
                /* Otherwise, we won't have such information */
                (error) => {
                    this.client
                        .get("https://api64.ipify.org?format=json")
                        .subscribe(
                            /* If we retrieve some data from Cloudflare we use them to populate worker's object */
                            (ipifyData) => {
                                this.worker.updateProperties(
                                    "ipify",
                                    ipifyData
                                );
                                this.initializeWorker();
                            },
                            /* Otherwise, we won't have such information */
                            (error) => {
                                this.worker.setParameter(
                                    "status_code",
                                    StatusCodes.IP_INFORMATION_MISSING
                                );
                                this.unlockTask(false);
                            }
                        );
                }
            );
    }

    public async initializeWorker() {
        /* Flag to understand if there is a HIT assigned to the current worker */
        let hitAssigned = false;

        let workerACLRecord = await this.dynamoDBService.getACLRecordIpAddress(
            this.configService.environment,
            this.worker.getIP()
        );
        let workerIdGenerated = String(false);
        if (workerACLRecord["Items"].length <= 0) {
            if (this.worker.identifier == null) {
                let identifierGenerated = this.utilsService
                    .randomIdentifier(14)
                    .toUpperCase();
                this.worker.setParameter("identifier", identifierGenerated);
                this.worker.identifier = identifierGenerated;
                workerIdGenerated = String(true);
            }
            this.worker.setParameter(
                "task_name",
                this.configService.environment.taskName
            );
            this.worker.setParameter(
                "batch_name",
                this.configService.environment.batchName
            );
            if (this.worker.getParameter("platform") == null)
                this.worker.setParameter("platform", "custom");
            this.worker.setParameter(
                "batch_name",
                this.configService.environment.batchName
            );
            this.worker.setParameter(
                "folder",
                this.S3Service.getWorkerFolder(
                    this.configService.environment,
                    this.worker
                )
            );
            this.worker.setParameter("access_counter", String(1));
            this.worker.setParameter("paid", String(false));
            this.worker.setParameter("generated", workerIdGenerated);
            this.worker.setParameter("in_progress", String(true));
            this.worker.setParameter(
                "try_current",
                String(this.task.tryCurrent)
            );
            this.worker.setParameter(
                "try_left",
                String(this.task.settings.allowed_tries)
            );
            let timeArrival = new Date();
            let timeExpiration = new Date(timeArrival.getTime());
            timeExpiration.setTime(
                timeExpiration.getTime() +
                    this.task.settings.time_assessment * 60 * 60 * 1000
            );
            this.worker.setParameter("time_arrival", timeArrival.toUTCString());
            this.worker.setParameter(
                "time_expiration",
                timeExpiration.toUTCString()
            );
            let timeExpirationNearest =
                await this.retrieveMostRecentExpirationDate();
            if (timeExpirationNearest)
                this.worker.setParameter(
                    "time_expiration_nearest",
                    timeExpirationNearest
                );
            else
                this.worker.setParameter(
                    "time_expiration_nearest",
                    timeExpiration.toUTCString()
                );
            this.worker.setParameter("time_expired", String(false));
            this.worker.setParameter("ip_address", this.worker.getIP()["ip"]);
            this.worker.setParameter(
                "ip_source",
                this.worker.getIP()["source"]
            );
            this.worker.setParameter("user_agent", this.worker.getUAG()["uag"]);
            this.worker.setParameter(
                "user_agent_source",
                this.worker.getUAG()["source"]
            );
        } else {
            let aclEntry = workerACLRecord["Items"][0];
            let timeExpirationNearest =
                await this.retrieveMostRecentExpirationDate();
            if (timeExpirationNearest)
                this.worker.setParameter(
                    "time_expiration_nearest",
                    timeExpirationNearest
                );
            else
                this.worker.setParameter(
                    "time_expiration_nearest",
                    String(false)
                );
            if (/true/i.test(aclEntry["paid"]) == true) {
                this.sectionService.taskAlreadyCompleted = true;
                Object.entries(aclEntry).forEach(([key, value]) =>
                    this.worker.setParameter(key, value)
                );
                this.worker.setParameter(
                    "status_code",
                    StatusCodes.TASK_ALREADY_COMPLETED
                );
                await this.dynamoDBService.insertACLRecordWorkerID(
                    this.configService.environment,
                    this.worker
                );
            } else {
                Object.entries(aclEntry).forEach(([key, value]) =>
                    this.worker.setParameter(key, value)
                );
                /* If the two flags are set to false, s/he is a worker that abandoned the task earlier;
                   furthermore, his/her it has been assigned to someone else. It's a sort of overbooking. */
                let timeArrival = new Date(aclEntry["time_arrival"]).getTime();
                let timeActual = new Date().getTime();
                let hoursElapsed = Math.abs(timeActual - timeArrival) / 36e5;
                if (
                    (/true/i.test(aclEntry["paid"]) == false &&
                        /true/i.test(aclEntry["in_progress"]) == true &&
                        hoursElapsed > this.task.settings.time_assessment) ||
                    (/true/i.test(aclEntry["paid"]) == false &&
                        /true/i.test(aclEntry["in_progress"]) == true &&
                        parseInt(aclEntry["try_left"]) <= 1) ||
                    (/true/i.test(aclEntry["paid"]) == false &&
                        /true/i.test(aclEntry["in_progress"]) == false)
                ) {
                    // TODO: Implementare controlli per gli status codes nel caso di task overbooking
                    /* As of today, such a worker is not allowed to perform the task */
                    if (
                        /true/i.test(aclEntry["paid"]) == false &&
                        /true/i.test(aclEntry["in_progress"]) == true &&
                        hoursElapsed > this.task.settings.time_assessment
                    )
                        this.worker.setParameter(
                            "status_code",
                            StatusCodes.TASK_TIME_EXPIRED
                        );
                    if (
                        /true/i.test(aclEntry["paid"]) == false &&
                        /true/i.test(aclEntry["in_progress"]) == false &&
                        parseInt(aclEntry["try_left"]) <= 1
                    )
                        this.worker.setParameter(
                            "status_code",
                            StatusCodes.TASK_FAILED_NO_TRIES
                        );
                    this.worker.setParameter("in_progress", String(false));
                    this.worker.setParameter(
                        "time_removal",
                        new Date().toUTCString()
                    );
                    this.sectionService.taskFailed = true;
                    await this.dynamoDBService.insertACLRecordWorkerID(
                        this.configService.environment,
                        this.worker
                    );
                } else {
                    Object.entries(aclEntry).forEach(([key, value]) =>
                        this.worker.setParameter(key, value)
                    );
                    this.tokenInput.setValue(aclEntry["token_input"]);
                    this.worker.identifier =
                        this.worker.getParameter("identifier");
                    this.worker.setParameter(
                        "access_counter",
                        (
                            parseInt(
                                this.worker.getParameter("access_counter")
                            ) + 1
                        ).toString()
                    );
                    hitAssigned = true;
                    this.worker.setParameter(
                        "status_code",
                        StatusCodes.TASK_HIT_ASSIGNED
                    );
                    await this.dynamoDBService.insertACLRecordWorkerID(
                        this.configService.environment,
                        this.worker
                    );
                }
            }
        }

        if (
            !this.sectionService.taskAlreadyCompleted &&
            !this.sectionService.taskFailed
        ) {
            this.worker.settings = new WorkerSettings(
                this.S3Service.downloadWorkers(this.configService.environment)
            );

            /* The logging service is enabled if it is needed */
            if (this.task.settings.logger_enable)
                this.logInit(
                    this.worker.identifier,
                    this.configService.environment.taskName,
                    this.configService.environment.batchName,
                    this.client,
                    this.configService.environment.log_on_console
                );
            else this.actionLogger = null;

            this.performWorkerStatusCheck().then(async (taskAllowed) => {
                this.sectionService.taskAllowed = taskAllowed;

                let hitCompletionStatus = {};

                if (taskAllowed) {
                    if (!hitAssigned) {
                        /* We fetch the task's HITs */
                        let hits = await this.S3Service.downloadHits(
                            this.configService.environment
                        );

                        /* It there is not any record, an available HIT can be assigned to him */
                        if (workerACLRecord["Items"].length <= 0) {
                            for (let hit of hits) {
                                /* The status of each HIT is checked */
                                let unitACLRecord =
                                    await this.dynamoDBService.getACLRecordUnitId(
                                        this.configService.environment,
                                        hit["unit_id"]
                                    );
                                /* If is has not been assigned, the current worker can receive it */
                                if (unitACLRecord["Items"].length <= 0) {
                                    this.worker.setParameter(
                                        "unit_id",
                                        hit["unit_id"]
                                    );
                                    this.worker.setParameter(
                                        "token_input",
                                        hit["token_input"]
                                    );
                                    this.worker.setParameter(
                                        "token_output",
                                        hit["token_output"]
                                    );
                                    this.worker.setParameter(
                                        "status_code",
                                        StatusCodes.TASK_HIT_ASSIGNED
                                    );
                                    this.tokenInput.setValue(
                                        hit["token_input"]
                                    );
                                    await this.dynamoDBService.insertACLRecordWorkerID(
                                        this.configService.environment,
                                        this.worker
                                    );
                                    /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                    hitAssigned = true;
                                    break;
                                }
                            }

                            /* If the flag is still false, it means that all the available HITs have been assigned once...
                                ... however, a worker have probably abandoned the task if someone reaches this point of the code. */

                            if (!hitAssigned) {
                                let wholeEntries =
                                    await this.retrieveAllACLEntries();

                                for (let aclEntry of wholeEntries) {
                                    if (
                                        aclEntry["ip_address"] !=
                                        this.worker.getIP()
                                    ) {
                                        if (
                                            /true/i.test(aclEntry["paid"]) ==
                                            true
                                        )
                                            hitCompletionStatus[
                                                aclEntry["unit_id"]
                                            ] = true;

                                        /*
                                        If the worker that received the current unit did not complete it he abandoned or returned the task.
                                        Thus, we free its slot, and we assign the HIT found to the current worker.
                                        This happens also if the worker does not have any try left, and thus it's entry has a completion time but the two flags are set to false.
                                        */

                                        let timeArrival = new Date(
                                            aclEntry["time_arrival"]
                                        ).getTime();
                                        let timeActual = new Date().getTime();
                                        let hoursElapsed =
                                            Math.abs(timeActual - timeArrival) /
                                            36e5;

                                        if (
                                            (/true/i.test(aclEntry["paid"]) ==
                                                false &&
                                                /true/i.test(
                                                    aclEntry["in_progress"]
                                                ) == true &&
                                                hoursElapsed >=
                                                    this.task.settings
                                                        .time_assessment) ||
                                            (/true/i.test(aclEntry["paid"]) ==
                                                false &&
                                                /true/i.test(
                                                    aclEntry["in_progress"]
                                                ) == true &&
                                                parseInt(
                                                    aclEntry["try_left"]
                                                ) <= 1)
                                        ) {
                                            let hitFound = null;
                                            for (let currentHit of hits) {
                                                if (
                                                    currentHit["unit_id"] ==
                                                    aclEntry["unit_id"]
                                                ) {
                                                    hitFound = currentHit;
                                                    break;
                                                }
                                            }

                                            hitAssigned = true;
                                            /* The record for the worker that abandoned/returned the task is updated */
                                            aclEntry["time_expired"] =
                                                String(true);
                                            aclEntry["in_progress"] =
                                                String(false);
                                            aclEntry["time_removal"] =
                                                new Date().toUTCString();
                                            await this.dynamoDBService.insertACLRecordUnitId(
                                                this.configService.environment,
                                                aclEntry,
                                                this.task.tryCurrent,
                                                false,
                                                true
                                            );
                                            /* As soon a slot for the current HIT is freed and assigned to the current worker the search can be stopped */
                                            this.worker.setParameter(
                                                "token_input",
                                                aclEntry["token_input"]
                                            );
                                            this.worker.setParameter(
                                                "token_output",
                                                aclEntry["token_output"]
                                            );
                                            this.worker.setParameter(
                                                "unit_id",
                                                aclEntry["unit_id"]
                                            );
                                            this.worker.setParameter(
                                                "time_arrival",
                                                new Date().toUTCString()
                                            );
                                            this.worker.setParameter(
                                                "status_code",
                                                StatusCodes.TASK_HIT_ASSIGNED
                                            );
                                            this.tokenInput.setValue(
                                                aclEntry["token_input"]
                                            );
                                            await this.dynamoDBService.insertACLRecordWorkerID(
                                                this.configService.environment,
                                                this.worker
                                            );
                                        }
                                    }

                                    /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                    if (hitAssigned) break;
                                }
                            }
                        }

                        if (!hitAssigned) {
                            let hitsStillToComplete = false;
                            for (let hit of hits) {
                                if (
                                    !Object.keys(hitCompletionStatus).includes(
                                        hit["unit_id"]
                                    )
                                )
                                    hitsStillToComplete = true;
                            }
                            if (hitsStillToComplete)
                                this.worker.setParameter(
                                    "status_code",
                                    StatusCodes.TASK_OVERBOOKING
                                );
                            else
                                this.worker.setParameter(
                                    "status_code",
                                    StatusCodes.TASK_COMPLETED_BY_OTHERS
                                );
                        }
                    }
                    await this.performTaskSetup();
                    this.unlockTask(hitAssigned);
                } else {
                    /* If a check during the execution of performWorkerStatusCheck has not been satisfied */
                    this.unlockTask(false);
                }
            });
        } else {
            this.unlockTask(false);
        }

        this.changeDetector.detectChanges();
    }

    public async retrieveAllACLEntries() {
        /* The whole set of ACL records must be scanned to find the oldest worker that participated in the task but abandoned it */
        let wholeEntries = [];
        let aclEntries = await this.dynamoDBService.scanACLRecordUnitId(
            this.configService.environment
        );
        for (let aclEntry of aclEntries.Items) wholeEntries.push(aclEntry);
        let lastEvaluatedKey = aclEntries.LastEvaluatedKey;
        while (typeof lastEvaluatedKey != "undefined") {
            aclEntries = await this.dynamoDBService.scanACLRecordUnitId(
                this.configService.environment,
                null,
                lastEvaluatedKey
            );
            lastEvaluatedKey = aclEntries.LastEvaluatedKey;
            for (let aclEntry of aclEntries.Items) wholeEntries.push(aclEntry);
        }
        /* Each ACL record is sorted considering the timestamp, in ascending order */
        /* Each ACL record is sorted considering the timestamp, in ascending order */
        wholeEntries.sort((a, b) => (a.time_arrival > b.time_arrival ? 1 : -1));
        return wholeEntries;
    }

    public async retrieveMostRecentExpirationDate() {
        let wholeEntries = await this.retrieveAllACLEntries();
        wholeEntries.sort((a, b) =>
            a.time_expiration > b.time_expiration ? 1 : -1
        );
        let entriesActive = [];
        for (let entryActive of entriesActive) {
            if (entryActive.in_progress && entryActive.paid == false) {
                entriesActive.push(entryActive);
            }
        }
        if (entriesActive.length > 0) {
            return entriesActive.pop()["time_expiration"];
        } else {
            return null;
        }
    }

    /*
     * This function interacts with an Amazon S3 bucket to perform a check on the current worker identifier.
     * If the worker has already started the task in the past he is not allowed to continue the task.
     */
    public async performWorkerStatusCheck() {
        let taskAllowed = true;

        let batchesStatus = {};

        let tables = await this.dynamoDBService.listTables(
            this.configService.environment
        );
        let workersManual = await this.S3Service.downloadWorkers(
            this.configService.environment
        );
        let workersACL = await this.dynamoDBService.getACLRecordIpAddress(
            this.configService.environment,
            this.worker.getIP()
        );

        /* To blacklist a previous batch its worker list is picked up */
        for (let batchName of this.worker.settings.blacklist_batches) {
            let previousTaskName = batchName.split("/")[0];
            let previousBatchName = batchName.split("/")[1];
            if (!(batchName in batchesStatus)) {
                let workers = await this.S3Service.downloadWorkers(
                    this.configService.environment,
                    batchName
                );
                batchesStatus[batchName] = {};
                batchesStatus[batchName]["blacklist"] = workers["blacklist"];
                for (let tableName of tables["TableNames"]) {
                    if (
                        tableName.includes(
                            `${previousTaskName}_${previousBatchName}_ACL`
                        )
                    ) {
                        batchesStatus[batchName]["tableName"] = tableName;
                    }
                }
            }
        }

        /* To whitelist a previous batch its blacklist is picked up */
        for (let batchName of this.worker.settings.whitelist_batches) {
            let previousTaskName = batchName.split("/")[0];
            let previousBatchName = batchName.split("/")[1];
            if (!(batchName in batchesStatus)) {
                let workers = await this.S3Service.downloadWorkers(
                    this.configService.environment,
                    batchName
                );
                batchesStatus[batchName] = {};
                batchesStatus[batchName]["whitelist"] = workers["blacklist"];
                for (let tableName of tables["TableNames"]) {
                    if (
                        tableName.includes(
                            `${previousTaskName}_${previousBatchName}_ACL`
                        )
                    ) {
                        batchesStatus[batchName]["tableName"] = tableName;
                    }
                }
            }
        }

        /* The true checking operation starts here */

        /* Check to verify if the current worker was present into a previous legacy or dynamo-db based blacklisted batch */
        for (let batchName in batchesStatus) {
            let batchStatus = batchesStatus[batchName];
            if ("blacklist" in batchStatus) {
                if ("tableName" in batchStatus) {
                    let rawWorker =
                        await this.dynamoDBService.getACLRecordIpAddress(
                            this.configService.environment,
                            this.worker.getIP(),
                            batchStatus["tableName"]
                        );
                    if ("Items" in rawWorker) {
                        for (let worker of rawWorker["Items"]) {
                            if (
                                this.worker.getIP()["ip"] ==
                                worker["ip_address"]
                            ) {
                                taskAllowed = false;
                                this.worker.setParameter(
                                    "status_code",
                                    StatusCodes.WORKER_BLACKLIST_PREVIOUS
                                );
                            }
                        }
                    }
                } else {
                    for (let workerIdentifier of batchStatus["blacklist"]) {
                        if (this.worker.identifier == workerIdentifier) {
                            taskAllowed = false;
                            this.worker.setParameter(
                                "status_code",
                                StatusCodes.WORKER_BLACKLIST_PREVIOUS
                            );
                        }
                    }
                }
            }
        }

        /* Check to verify if the current worker was present into a previous legacy or dynamo-db based whitelisted batch */
        for (let batchName in batchesStatus) {
            let batchStatus = batchesStatus[batchName];
            if ("whitelist" in batchStatus) {
                if ("tableName" in batchStatus) {
                    let rawWorker =
                        await this.dynamoDBService.getACLRecordIpAddress(
                            this.configService.environment,
                            this.worker.getIP(),
                            batchStatus["tableName"]
                        );
                    if ("Items" in rawWorker) {
                        for (let worker of rawWorker["Items"]) {
                            if (
                                this.worker.getIP()["ip"] ==
                                worker["ip_address"]
                            ) {
                                taskAllowed = true;
                                this.worker.setParameter(
                                    "status_code",
                                    StatusCodes.WORKER_WHITELIST_PREVIOUS
                                );
                            }
                        }
                    }
                } else {
                    for (let workerIdentifier of batchStatus["whitelist"]) {
                        if (this.worker.identifier == workerIdentifier) {
                            taskAllowed = true;
                            this.worker.setParameter(
                                "status_code",
                                StatusCodes.WORKER_WHITELIST_PREVIOUS
                            );
                        }
                    }
                }
            }
        }

        if (this.worker.settings.block) {
            /* Check to verify if the current worker already accessed the current task using the dynamo-db based acl */
            if ("Items" in workersACL) {
                for (let worker of workersACL["Items"]) {
                    if (this.worker.getIP()["ip"] == worker["ip_address"]) {
                        taskAllowed = false;
                        this.worker.setParameter(
                            "status_code",
                            StatusCodes.WORKER_RETURNING_BLOCK
                        );
                        return taskAllowed;
                    }
                }
            }
        }

        /* Check to verify if the current worker is manually blacklisted into the current batch */
        for (let worker of workersManual["blacklist"]) {
            if (this.worker.identifier == worker) {
                taskAllowed = false;
                this.worker.setParameter(
                    "status_code",
                    StatusCodes.WORKER_BLACKLIST_CURRENT
                );
                return taskAllowed;
            }
        }

        /* Check to verify if the current worker is manually whitelisted into the current batch using the dynamo-db based acl */

        for (let worker of workersManual["whitelist"]) {
            if (this.worker.identifier == worker) {
                taskAllowed = true;
                this.worker.setParameter(
                    "status_code",
                    StatusCodes.WORKER_WHITELIST_CURRENT
                );
            }
        }

        return taskAllowed;
    }

    /*
     * This function enables the task when the worker clicks on "Proceed" inside the main instructions page.
     */
    public enableTask() {
        this.sectionService.taskInstructionsRead = true;
        // TODO: Set here the updated selectedIndex, if applicable
        this.showSnackbar(
            "If you have a very slow internet connection please wait a few seconds",
            "Dismiss",
            10000
        );
    }

    /* Anonymous  function that unlocks the task depending on performWorkerStatusCheck outcome */

    public unlockTask(taskAllowed: boolean) {
        this.sectionService.taskAllowed = taskAllowed;
        this.sectionService.checkCompleted = true;
        this.changeDetector.detectChanges();
        /* The loading spinner is stopped */
        this.ngxService.stopLoader("skeleton-inner");
    }

    /*
     * This function interacts with an Amazon S3 bucket to search the token input
     * typed by the user inside within the hits.json file stored in the bucket.
     * If such token cannot be found, an error message is returned.
     */
    public async validateTokenInput(control: UntypedFormControl) {
        let hits = await this.S3Service.downloadHits(
            this.configService.environment
        );
        for (let hit of hits)
            if (hit.token_input === control.value) return null;
        return { invalid: "This token is not valid." };
    }

    /*
     *  This function retrieves the hit identified by the validated token input inserted by the current worker and sets the task up accordingly.
     *  Such hit is represented by a Hit object. The task is set up by parsing the hit content as an Array of Document objects.
     *  Therefore, to use a customized the task the Document interface must be adapted to correctly parse each document's field.
     *  The Document interface can be found at this path: ../../../../data/build/task/document.ts
     */
    public async performTaskSetup() {
        /* The token input has been already validated, this is just to be sure */
        if (this.tokenForm.valid) {
            this.sectionService.taskStarted = true;

            /* The hits stored on Amazon S3 are retrieved */
            let hits = await this.S3Service.downloadHits(
                this.configService.environment
            );

            /* Scan each entry for the token input */
            for (let currentHit of hits) {
                /* If the token input of the current hit matches with the one inserted by the worker the right hit has been found */
                if (this.tokenInput.value === currentHit.token_input) {
                    currentHit = currentHit as Hit;
                    this.task.tokenInput = this.tokenInput.value;
                    this.task.tokenOutput = currentHit.token_output;
                    this.task.unitId = currentHit.unit_id;
                    this.task.documentsAmount = currentHit.documents.length;
                    this.task.hit = currentHit;
                    /* The array of documents is initialized */
                    this.task.initializeDocuments(currentHit.documents, currentHit["documents_params"]);
                }
            }

            if (this.task.settings.logger_enable)
                this.actionLogger.unitId = this.task.unitId;

            /* The token input field is disabled and the task interface can be shown */
            this.tokenInput.disable();

            /* A form for each document is initialized */
            this.documentsForm = new Array<UntypedFormGroup>();

            this.searchEngineForms = new Array<Array<UntypedFormGroup>>();
            this.resultsRetrievedForms = new Array<Array<Object>>();


            let questionnaires = await this.S3Service.downloadQuestionnaires(
                this.configService.environment
            );
            this.task.initializeQuestionnaires(questionnaires);

            /* A form for each questionnaire is initialized */
            this.questionnairesForm = new Array<UntypedFormGroup>();

            /* The evaluation instructions stored on Amazon S3 are retrieved */
            this.task.initializeInstructionsEvaluation(
                await this.S3Service.downloadEvaluationInstructions(
                    this.configService.environment
                )
            );

            /* |--------- DIMENSIONS ELEMENTS (see: dimensions.json) ---------| */

            this.task.initializeDimensions(
                await this.S3Service.downloadDimensions(
                    this.configService.environment
                )
            );

            this.task.loadAccessCounter();
            this.task.loadTimestamps();

            if (!(this.worker.identifier == null)) {
                let taskInitialPayload = this.task.buildTaskInitialPayload(
                    this.worker
                );
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    taskInitialPayload
                );
            }

            //this.colorStepper(this.task.questionnaireAmount, this.task.documentsAmount)
        }

        this.changeDetector.detectChanges();
    }

    /* |--------- LOGGING SERVICE & SECTION SERVICE ---------| */

    /* Logging service initialization */
    public logInit(
        workerIdentifier,
        taskName,
        batchName,
        http: HttpClient,
        logOnConsole: boolean
    ) {
        this.actionLogger.logInit(
            this.configService.environment.bucket,
            workerIdentifier,
            taskName,
            batchName,
            http,
            logOnConsole
        );
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
        for (let index = 0; index < this.questionnairesForm.length; index++)
            if (this.questionnairesForm[index].valid == false)
                questionnaireFormValidity = false;
        for (let index = 0; index < this.documentsForm.length; index++)
            if (this.documentsForm[index].valid == false)
                documentsFormValidity = false;
        return questionnaireFormValidity && documentsFormValidity;
    }

    /*
     * This function resets the task by bringing the worker to the first document if he still has some available tries.
     * The worker can trigger this operation by clicking the "Reset" button when quality checks are completed and the outcome is shown.
     */
    public performReset() {
        /* The loading spinner is started */
        this.ngxService.startLoader("skeleton-inner");

        this.sectionService.taskFailed = false;
        this.sectionService.taskSuccessful = false;
        this.sectionService.taskCompleted = false;
        this.sectionService.taskStarted = true;

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

        this.outcomeSection.commentSent = false;

        this.worker.setParameter(
            "try_left",
            String(this.task.settings.allowed_tries - this.task.tryCurrent)
        );
        this.worker.setParameter("try_current", String(this.task.tryCurrent));

        this.dynamoDBService.insertACLRecordWorkerID(
            this.configService.environment,
            this.worker
        );

        /* Trigger change detection to restore stepper reference */
        this.changeDetector.detectChanges();

        /* Set stepper document_index to the first tab (currentDocument.e., bring the worker to the first document after the questionnaire) */
        this.stepper.selectedIndex = this.task.questionnaireAmountStart;

        /* The loading spinner is stopped */
        this.ngxService.stopLoader("skeleton-inner");
    }

    public handleCountdowns(
        currentDocument: number,
        completedDocument: number,
        action: string
    ) {
        /* The countdowns are stopped and resumed to the left or to the right of the current document,
         *  depending on the chosen action ("Back" or "Next") */
        let currentIndex = currentDocument;
        let countdown = this.documentComponent[currentIndex].countdown;
        switch (action) {
            case "Next":
                if (
                    currentIndex > 0 &&
                    countdown.toArray()[currentIndex - 1].left > 0
                ) {
                    countdown.toArray()[currentIndex - 1].pause();
                }
                if (
                    countdown.toArray()[currentIndex].left ==
                    this.task.documentsCountdownTime[completedDocument]
                ) {
                    countdown.toArray()[currentIndex].begin();
                } else if (countdown.toArray()[currentIndex].left > 0) {
                    countdown.toArray()[currentIndex].resume();
                }
                break;
            case "Back":
                if (countdown.toArray()[currentIndex + 1].left > 0) {
                    countdown.toArray()[currentIndex + 1].pause();
                }
                if (
                    countdown.toArray()[currentIndex].left ==
                    this.task.documentsCountdownTime[completedDocument]
                ) {
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

    public computeTimestamps(
        currentElement: number,
        completedElement: number,
        action: string
    ) {
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
        for (
            let i = 0;
            i < this.task.documentsAmount + this.task.questionnaireAmount;
            i++
        ) {
            let totalSecondsElapsed = 0;
            for (let k = 0; k < this.task.timestampsEnd[i].length; k++) {
                if (
                    this.task.timestampsStart[i][k] !== null &&
                    this.task.timestampsEnd[i][k] !== null
                ) {
                    totalSecondsElapsed =
                        totalSecondsElapsed +
                        (Number(this.task.timestampsEnd[i][k]) -
                            Number(this.task.timestampsStart[i][k]));
                }
            }
            this.task.timestampsElapsed[i] = totalSecondsElapsed;
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

        let goldConfiguration = this.utilsService.generateGoldConfiguration(this.task.goldDocuments,this.task.goldDimensions, this.documentsForm, this.task.notes);

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        let goldChecks = GoldChecker.performGoldCheck(goldConfiguration);

        /* 3) TIME SPENT CHECK performed here */
        timeSpentCheck = true;
        this.task.timestampsElapsed.forEach((item) => {
            if (item < timeCheckAmount) timeSpentCheck = false;
        });

        let qualityCheckData = {
            globalOutcome: null,
            globalFormValidity: globalValidityCheck,
            timeSpentCheck: timeSpentCheck,
            timeCheckAmount: timeCheckAmount,
            goldChecks: goldChecks,
            goldConfiguration: goldConfiguration,
        };

        let checksOutcome = [];
        let checker = (array) => array.every(Boolean);

        checksOutcome.push(qualityCheckData["globalFormValidity"]);
        checksOutcome.push(qualityCheckData["timeSpentCheck"]);
        checksOutcome.push(checker(qualityCheckData["goldChecks"]));

        qualityCheckData["globalOutcome"] = checker(checksOutcome);

        /* If each check is true, the task is successful, otherwise the task is failed (but not over if there are more tries) */

        return qualityCheckData;
    }

    /*
     * This function gives the possibility to the worker to provide a comment when a try is finished, successfully or not.
     * The comment can be typed in a textarea and when the worker clicks the "Send" button such comment is uploaded to an Amazon S3 bucket.
     */

    public async performCommentSaving(data) {
        this.outcomeSection.commentSent = true;
        if (!(this.worker.identifier == null)) {
            let comment = this.task.buildCommentPayload(data);
            await this.dynamoDBService.insertDataRecord(
                this.configService.environment,
                this.worker,
                this.task,
                comment
            );
        }
    }

    public storeQuestionnaireForm(data, questionnaireIndex) {
        if (!this.questionnairesForm[questionnaireIndex])
            this.questionnairesForm[questionnaireIndex] = data["form"];
        let action = data["action"];
        if (action) {
            this.produceData(action, questionnaireIndex);
        }
    }

    public storeDocumentForm(data, documentIndex) {
        if (!this.documentsForm[documentIndex])
            this.documentsForm[documentIndex] = data["form"];
        let action = data["action"];
        if (action) {
            this.produceData(action, documentIndex);
        }
    }

    /*
     * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
     */
    public async produceData(action: string, completedElement) {
        if (action == "Finish") {
            /* The current try is completed and the final can shall begin */
            this.ngxService.startLoader("skeleton-inner");
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

        let completedElementBaseIndex = completedElement;
        let currentElementBaseIndex = currentElement;
        let completedElementData = this.task.getElementIndex(completedElement);
        let currentElementData = this.task.getElementIndex(currentElement);
        let completedElementType = completedElementData["elementType"];
        let completedElementIndex = completedElementData["elementIndex"];
        let currentElementType = currentElementData["elementType"];
        let currentElementIndex = currentElementData["elementIndex"];

        this.task.elementsAccesses[completedElementBaseIndex] =
            this.task.elementsAccesses[completedElementBaseIndex] + 1;

        this.computeTimestamps(
            currentElementBaseIndex,
            completedElementBaseIndex,
            action
        );
        if (this.task.settings.countdown_time) {
            if (currentElementType == "S") {
                this.handleCountdowns(
                    currentElementIndex,
                    completedElementIndex,
                    action
                );
            }
        }
        if (this.task.settings.annotator) {
            if (this.task.settings.annotator.type == "options") {
                if (completedElementType == "S") {
                    this.documentComponent
                        .get(completedElementIndex)
                        .annotatorOptions.first.handleNotes();
                }
            }
        }

        let qualityChecks = null;
        let qualityChecksPayload = null;

        if (action == "Finish") {
            qualityChecks = this.performQualityChecks();
            if (qualityChecks["globalOutcome"]) {
                this.sectionService.taskSuccessful = true;
                this.sectionService.taskFailed = false;
            } else {
                this.sectionService.taskSuccessful = false;
                this.sectionService.taskFailed = true;
            }
            /* Lastly, we update the ACL */
            if (!(this.worker.identifier == null)) {
                this.worker.setParameter(
                    "time_completion",
                    new Date().toUTCString()
                );
                if (this.sectionService.taskSuccessful) {
                    this.worker.setParameter("in_progress", String(false));
                    this.worker.setParameter("paid", String(true));
                    this.worker.setParameter(
                        "status_code",
                        StatusCodes.TASK_SUCCESSFUL
                    );
                } else {
                    this.worker.setParameter(
                        "try_left",
                        String(
                            this.task.settings.allowed_tries -
                                this.task.tryCurrent
                        )
                    );
                    this.worker.setParameter("in_progress", String(true));
                    this.worker.setParameter("paid", String(false));
                    this.worker.setParameter(
                        "status_code",
                        StatusCodes.TASK_FAILED_WITH_TRIES
                    );
                }
                await this.dynamoDBService.insertACLRecordWorkerID(
                    this.configService.environment,
                    this.worker
                );
            }
        }

        if (!(this.worker.identifier == null)) {
            if (completedElementType == "Q") {
                let questionnairePayload =
                    this.task.buildTaskQuestionnairePayload(
                        completedElementIndex,
                        this.questionnairesForm[completedElementIndex].value,
                        action
                    );
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    questionnairePayload
                );
            }

            if (completedElementType == "S") {
                let countdown = null;
                if (this.task.settings.countdown_time)
                    countdown = Number(
                        this.documentComponent[completedElementIndex].countdown[
                            "i"
                        ]["text"]
                    );
                let documentPayload = this.task.buildTaskDocumentPayload(
                    completedElementIndex,
                    this.documentsForm[completedElementIndex].value,
                    countdown,
                    action
                );
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    documentPayload
                );
            }

            if (
                completedElementBaseIndex ==
                    this.task.getElementsNumber() - 1 &&
                action == "Finish"
            ) {
                qualityChecksPayload =
                    this.task.buildQualityChecksPayload(qualityChecks);
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    qualityChecksPayload
                );
            }
        }

        if (action == "Finish") {
            this.sectionService.taskCompleted = true;
            this.ngxService.stopLoader("skeleton-inner");
            this.changeDetector.detectChanges();
        }
    }

    /* |--------- OTHER AMENITIES ---------| */

    public showSnackbar(message, action, duration) {
        this.snackBar.open(message, action, {
            duration: duration,
        });
    }

}
