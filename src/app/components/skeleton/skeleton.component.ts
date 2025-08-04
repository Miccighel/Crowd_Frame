// TODO(strict-forms): auto-guarded by codemod – review if needed.
/* Angular Core Modules */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, ViewEncapsulation} from "@angular/core";
import {UntypedFormBuilder, UntypedFormGroup, UntypedFormControl} from "@angular/forms";
import {HttpClient, HttpHeaders} from "@angular/common/http";

/* Angular Material Components */
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
import {MatSnackBar} from "@angular/material/snack-bar";

/* RxJS Modules */
import {of, Subject} from "rxjs";
import {catchError, tap} from "rxjs/operators";

/* Services */
import {NgxUiLoaderService} from "ngx-ui-loader";
import {ConfigService} from "../../services/config.service";
import {S3Service} from "../../services/aws/s3.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {ActionLogger} from "../../services/userActionLogger.service";
import {SectionService} from "../../services/section.service";
import {StatusCodes} from "../../services/section.service";
import {DynamoDBService} from "../../services/aws/dynamoDB.service";
import {UtilsService} from "../../services/utils.service";
import {DebugService} from "../../services/debug.service";
import {LocalStorageService} from "../../services/localStorage.service";


/* Models */
import {Task} from "../../models/skeleton/task";
import {Worker} from "../../models/worker/worker";
import {WorkerSettings} from "../../models/worker/workerSettings";
import {Hit} from "../../models/skeleton/hit";
import {GoldChecker} from "../../../../data/build/skeleton/goldChecker";

/* Custom Components */
import {OutcomeSectionComponent} from "./outcome/outcome-section.component";
import {DocumentComponent} from "./document/document.component";

/* Base Component */
import {BaseComponent} from "../base/base.component";

/* Animations */
import {fadeIn} from "../chatbot/animations";
import {Title} from "@angular/platform-browser";


/* Component HTML Tag definition */
@Component({
    selector: "app-skeleton",
    templateUrl: "./skeleton.component.html",
    styleUrls: ["./skeleton.component.scss"],
    animations: [fadeIn],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    standalone: false
})

/*
 * This class implements the skeleton for Crowdsourcing tasks.
 */
export class SkeletonComponent implements OnInit, OnDestroy {

    /* #################### SERVICES & CORE STUFF #################### */

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
    titleService: Title
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

    /* Snackbar reference */
    snackBar: MatSnackBar;

    /* This is a convention often used in Angular to manage the cleanup of subscriptions. It involves a Subject that emits a value when the component is
     * about to be destroyed, typically in the ngOnDestroy lifecycle hook. */
    private unsubscribe$ = new Subject<void>();

    /* #################### LOCAL ATTRIBUTES #################### */

    /* Object to encapsulate all task-related information */
    task: Task;
    /* Object to encapsulate all worker-related information */
    worker: Worker;
    platform: string;
    /* Check to understand if the generator or the skeleton should be loader */
    generator: boolean;

    private _stepper!: MatStepper;                 // actual holder

    @ViewChild('stepper', {static: false})
    set stepperSetter(stepper: MatStepper | undefined) {
        if (!stepper) {
            return;
        }                    // view not ready yet
        this._stepper = stepper;                     // keep a reference

        /* ----  RESTORE LAST POSITION  -------------------------------- */
        const last = this.worker?.getPositionCurrent() ?? 0;
        this._stepper.selectedIndex = last;
        this.sectionService.stepIndex = last;

        /* Force CD so that bindings inside the newly-selected step update */
        this.changeDetector.detectChanges();
    }

    /* Expose a readonly getter elsewhere in the class if you still use `this.stepper` */
    get stepper(): MatStepper | undefined {
        return this._stepper;
    }

    /* Array of form references, one for each document within a Hit */
    documentsForm: Array<UntypedFormGroup>;
    documentsFormsAdditional: Array<Array<UntypedFormGroup>>;
    @ViewChildren(DocumentComponent) documentComponent: QueryList<DocumentComponent>;

    /* Array of form references, one for each questionnaire within a Hit */
    questionnairesForm: UntypedFormGroup[];

    /* Array of search form references, one for each document within a Hit */
    searchEngineForms: Array<Array<UntypedFormGroup>>;
    resultsRetrievedForms: Array<Array<Object>>;
    @ViewChild("urlField") urlField: MatFormField;

    /* Reference to the outcome section component */
    @ViewChild(OutcomeSectionComponent) outcomeSection: OutcomeSectionComponent;

    constructor(
        private baseComponent: BaseComponent,
        changeDetector: ChangeDetectorRef,
        ngxService: NgxUiLoaderService,
        configService: ConfigService,
        S3Service: S3Service,
        dynamoDBService: DynamoDBService,
        deviceDetectorService: DeviceDetectorService,
        titleService: Title,
        client: HttpClient,
        formBuilder: UntypedFormBuilder,
        snackBar: MatSnackBar,
        actionLogger: ActionLogger,
        sectionService: SectionService,
        localStorageService: LocalStorageService,
        utilsService: UtilsService,
        debugService: DebugService
    ) {
        this.changeDetector = changeDetector;
        this.ngxService = ngxService;
        this.configService = configService;
        this.S3Service = S3Service;
        this.dynamoDBService = dynamoDBService;
        this.actionLogger = actionLogger;
        this.sectionService = sectionService;
        this.deviceDetectorService = deviceDetectorService;
        this.titleService = titleService;
        this.utilsService = utilsService;
        this.localStorageService = localStorageService;
        this.debugService = debugService;

        this.client = client;
        this.formBuilder = formBuilder;
        this.snackBar = snackBar;
        this.ngxService.startLoader("skeleton-inner");

        this.generator = false;
    }

    /* To follow the execution flow of the skeleton, the functions need to be read in order (i.e., from top to bottom). */
    ngOnInit() {
        this.baseComponent.initializationCompleted.subscribe(params => {
            this.task = this.sectionService.task;
            const paramsFetched = this.parseURLParams(new URL(window.location.href));
            this.startWorkerInitialization(paramsFetched);
        });
    }

    private parseURLParams(url: URL): Record<string, string> {
        const paramsFetched: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            if (key.toLowerCase().includes("workerid")) {
                paramsFetched["identifier"] = value;
            } else {
                key = key.replace(/(?:^|\.?)([A-Z])/g, (x, y) => "_" + y.toLowerCase()).replace(/^_/, "");
                paramsFetched[key] = value;
            }
        });
        return paramsFetched;
    }

    private startWorkerInitialization(params: Record<string, string>) {
        this.worker = new Worker(params);
        this.worker.updateProperties('ngxdevicedetector', this.deviceDetectorService.getDeviceInfo());
        this.worker.updateProperties('navigator', window.navigator);

        this.fetchExternalData().subscribe({
            complete: () => this.finalizeWorkerInitialization()
        });
    }

    private fetchExternalData() {
        return this.client?.get("https://1.0.0.1/cdn-cgi/trace", {responseType: "text"})?.pipe(
            tap(cloudflareData => this.worker.updateProperties("cloudflare", cloudflareData)),
            catchError(() => this.client?.get("https://api64.ipify.org?format=json")),
            catchError(() => of(null)),
            tap(ipifyData => {
                if (ipifyData) {
                    this.worker.updateProperties("ipify", ipifyData);
                } else {
                    this.worker.setParameter("status_code", StatusCodes.IP_INFORMATION_MISSING);
                    this.unlockTask(false);
                }
            })
        );
    }

    public async finalizeWorkerInitialization() {
        /* Flag to indicate if a HIT is assigned to the current worker. */
        let hitAssigned = false;

        let workerACLRecord = await this.dynamoDBService.getACLRecordIpAddress(this.configService.environment, this.worker.getIP());
        let workerIdGenerated = String(false);
        let workerIdentifierProvided = this.worker.identifier
        if (workerACLRecord["Items"].length <= 0) {
            if (this.worker.identifier == null) {
                let identifierGenerated = this.utilsService.randomIdentifier(14).toUpperCase();
                this.worker.setParameter("identifier", identifierGenerated);
                this.worker.identifier = identifierGenerated;
                workerIdGenerated = String(true);
            }
            this.worker.setParameter("task_name", this.configService.environment.taskName);
            this.worker.setParameter("batch_name", this.configService.environment.batchName);
            if (this.worker.getParameter("platform") == null) this.worker.setParameter("platform", "custom");
            this.worker.setParameter("batch_name", this.configService.environment.batchName);
            this.worker.setParameter("folder", this.S3Service.getWorkerFolder(this.configService.environment, this.worker));
            this.worker.setParameter("access_counter", String(1));
            this.worker.setParameter("paid", String(false));
            this.worker.setParameter("generated", workerIdGenerated);
            this.worker.setParameter("in_progress", String(true));
            this.worker.setParameter("position_current", String(0));
            this.worker.setParameter("try_current", String(this.task.tryCurrent));
            this.worker.setParameter("try_left", String(this.task.settings.allowed_tries));
            let timeArrival = new Date();
            let timeExpiration = new Date(timeArrival.getTime());
            timeExpiration.setTime(timeExpiration.getTime() + this.task.settings.time_assessment * 60 * 60 * 1000);
            this.worker.setParameter("time_arrival", timeArrival.toUTCString());
            this.worker.setParameter("time_expiration", timeExpiration.toUTCString());
            let timeExpirationNearest = await this.retrieveMostRecentExpirationDate();
            if (timeExpirationNearest)
                this.worker.setParameter("time_expiration_nearest", timeExpirationNearest);
            else
                this.worker.setParameter("time_expiration_nearest", timeExpiration.toUTCString());
            this.worker.setParameter("time_expired", String(false));
            this.worker.setParameter("ip_address", this.worker.getIP()["ip"]);
            this.worker.setParameter("ip_source", this.worker.getIP()["source"]);
            this.worker.setParameter("user_agent", this.worker.getUAG()["uag"]);
            this.worker.setParameter("user_agent_source", this.worker.getUAG()["source"]);
        } else {
            let aclEntry = workerACLRecord["Items"][0];

            this.task.settings.allowed_tries = aclEntry["try_left"]
            this.task.tryCurrent = aclEntry["try_current"]

            let timeExpirationNearest = await this.retrieveMostRecentExpirationDate();
            if (timeExpirationNearest)
                this.worker.setParameter("time_expiration_nearest", timeExpirationNearest);
            else
                this.worker.setParameter("time_expiration_nearest", String(false));
            if (/true/i.test(aclEntry["paid"]) == true) {
                this.sectionService.taskAlreadyCompleted = true;
                Object.entries(aclEntry).forEach(([key, value]) =>
                    this.worker.setParameter(key, value)
                );
                this.worker.setParameter("status_code", StatusCodes.TASK_ALREADY_COMPLETED);
                this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']))
                await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
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
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && hoursElapsed > this.task.settings.time_assessment) ||
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && parseInt(aclEntry["try_left"]) < 1) ||
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == false)
                ) {
                    // TODO: Implementare controlli per gli status codes nel caso di task overbooking
                    /* As of today, such a worker is not allowed to perform the task */
                    if (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && hoursElapsed > this.task.settings.time_assessment)
                        this.worker.setParameter("status_code", StatusCodes.TASK_TIME_EXPIRED);
                    if (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == false && parseInt(aclEntry["try_left"]) < 1)
                        this.worker.setParameter("status_code", StatusCodes.TASK_FAILED_NO_TRIES);
                    this.worker.setParameter("in_progress", String(false));
                    this.worker.setParameter("time_removal", new Date().toUTCString());
                    this.sectionService.taskFailed = true;
                    this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']))
                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
                } else {
                    Object.entries(aclEntry).forEach(([key, value]) => this.worker.setParameter(key, value));
                    this.worker.identifier = this.worker.getParameter("identifier");
                    this.worker.setParameter("access_counter", (parseInt(this.worker.getParameter("access_counter")) + 1).toString());
                    this.worker.setParameter("status_code", StatusCodes.TASK_HIT_ASSIGNED);
                    this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']))
                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
                    hitAssigned = true;
                }
            }
        }

        if (!this.sectionService.taskAlreadyCompleted && !this.sectionService.taskFailed) {

            this.worker.settings = new WorkerSettings(await this.S3Service.downloadWorkers(
                this.configService.environment
            ));

            /* The logging service is enabled if it is needed */
            if (this.task.settings.logger_enable)
                this.initializeLogger(
                    this.worker.identifier,
                    this.configService.environment.taskName,
                    this.configService.environment.batchName,
                    this.configService.environment.region,
                    this.client,
                    this.configService.environment.log_on_console
                );
            else this.actionLogger = null;

            this.performWorkerStatusCheck().then(async (taskAllowed) => {
                this.sectionService.taskAllowed = taskAllowed;

                let hitCompletedOrInProgress = {};

                if (taskAllowed) {
                    if (!hitAssigned) {
                        /* We fetch the task's HITs */
                        let hits = await this.S3Service.downloadHits(this.configService.environment);

                        /* It there is not any record, an available HIT can be assigned to him */
                        if (workerACLRecord["Items"].length <= 0) {
                            for (let hit of hits) {
                                hitCompletedOrInProgress[hit['unit_id']] = false
                                /* The status of each HIT is checked */
                                let unitACLRecord = await this.dynamoDBService.getACLRecordUnitId(this.configService.environment, hit["unit_id"]);
                                /* If it has not been assigned, the current worker can receive it */
                                if (unitACLRecord["Items"].length <= 0) {
                                    this.worker.setParameter("unit_id", hit["unit_id"]);
                                    this.worker.setParameter("token_input", hit["token_input"]);
                                    this.worker.setParameter("token_output", hit["token_output"]);
                                    this.worker.setParameter("status_code", StatusCodes.TASK_HIT_ASSIGNED);
                                    await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
                                    /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                    hitAssigned = true;
                                    break;
                                }
                            }

                            /* If the flag is still false, it means that all the available HITs have been assigned once...
                                ... however, a worker have probably abandoned the task if someone reaches this point of the code. */

                            if (!hitAssigned) {
                                let wholeEntries = await this.retrieveAllACLEntries();

                                for (let aclEntry of wholeEntries) {
                                    if (aclEntry["ip_address"] != this.worker.getIP()) {
                                        if (/true/i.test(aclEntry["paid"]) == true || ((/true/i.test(aclEntry["paid"]) == false) && (/true/i.test(aclEntry["in_progress"]) == true)))

                                            hitCompletedOrInProgress[aclEntry["unit_id"]] = true;

                                        /*
                                           If the worker who received the current unit did not complete it, they either abandoned or returned the task.
                                           In either case, we free up the slot and assign the HIT found to the current worker.
                                           This also occurs when the worker has no tries left; in this case, the entry has a completion time, but the two flags are set to false.
                                        */

                                        let timeArrival = new Date(aclEntry["time_arrival"]).getTime();
                                        let timeActual = new Date().getTime();
                                        let hoursElapsed = Math.abs(timeActual - timeArrival) / 36e5;

                                        if ((/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && hoursElapsed >= this.task.settings.time_assessment) ||
                                            (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && parseInt(aclEntry["try_left"]) <= 1)) {
                                            hitAssigned = true;
                                            /* The record for the worker that abandoned/returned the task is updated */
                                            aclEntry["time_expired"] = String(true);
                                            aclEntry["in_progress"] = String(false);
                                            aclEntry["time_removal"] = new Date().toUTCString();
                                            await this.dynamoDBService.insertACLRecordUnitId(this.configService.environment, aclEntry, this.task.tryCurrent, false, true);
                                            /* As soon a slot for the current HIT is freed and assigned to the current worker the search can be stopped */
                                            this.worker.setParameter("token_input", aclEntry["token_input"]);
                                            this.worker.setParameter("token_output", aclEntry["token_output"]);
                                            this.worker.setParameter("unit_id", aclEntry["unit_id"]);
                                            this.worker.setParameter("time_arrival", new Date().toUTCString());
                                            this.worker.setParameter("status_code", StatusCodes.TASK_HIT_ASSIGNED);
                                            await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
                                        }
                                    }

                                    /* As soon as a HIT is assigned to the current worker the search can be stopped */
                                    if (hitAssigned)
                                        break;
                                }


                                if (!hitAssigned) {
                                    let inconsistentUnits = []
                                    for (const [unitId, status] of Object.entries(hitCompletedOrInProgress)) {
                                        if (status == false)
                                            if (!inconsistentUnits.includes(unitId))
                                                inconsistentUnits.push(unitId)
                                    }

                                    if (inconsistentUnits.length > 0) {
                                        wholeEntries = await this.retrieveAllACLEntries();
                                        for (const inconsistentUnit of inconsistentUnits) {
                                            let mostRecentAclEntry = null
                                            for (let aclEntry of wholeEntries) {
                                                if (aclEntry["ip_address"] != this.worker.getIP()) {
                                                    if (
                                                        (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == false) &&
                                                        inconsistentUnit == aclEntry['unit_id']
                                                    ) {
                                                        mostRecentAclEntry = aclEntry
                                                    }
                                                }
                                            }
                                            if (mostRecentAclEntry) {
                                                hitAssigned = true;
                                                this.worker.setParameter("token_input", mostRecentAclEntry["token_input"]);
                                                this.worker.setParameter("token_output", mostRecentAclEntry["token_output"]);
                                                this.worker.setParameter("unit_id", mostRecentAclEntry["unit_id"]);
                                                this.worker.setParameter("time_arrival", new Date().toUTCString());
                                                this.worker.setParameter("status_code", StatusCodes.TASK_HIT_ASSIGNED_AFTER_INCONSISTENCY_CHECK);
                                                await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
                                            }
                                            /* The search can be stopped as soon as a HIT is assigned to the current worker. */
                                            if (hitAssigned)
                                                break;
                                        }

                                    }
                                }

                            }

                        }
                        if (!hitAssigned) {
                            let hitsStillToComplete = false;
                            for (let hit of hits) {
                                if (hitCompletedOrInProgress[hit["unit_id"]] == false)
                                    hitsStillToComplete = true;
                            }
                            if (hitsStillToComplete)
                                this.worker.setParameter("status_code", StatusCodes.TASK_OVERBOOKING);
                            else
                                this.worker.setParameter("status_code", StatusCodes.TASK_COMPLETED_BY_OTHERS);
                        }

                    }
                    this.task.storeDataRecords(await this.retrieveDataRecords())
                    await this.performTaskSetup();
                    this.unlockTask(hitAssigned);
                } else {
                    /* If a condition in the execution of performWorkerStatusCheck is not satisfied */
                    this.unlockTask(false);
                }
            });
        } else {
            this.unlockTask(false);
        }
        this.changeDetector.detectChanges();
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    public async retrieveAllACLEntries() {
        /* The whole set of ACL records must be scanned to find the oldest worker that participated in the task but abandoned it */
        let wholeEntries = [];
        let aclEntries = await this.dynamoDBService.scanACLRecordUnitId(this.configService.environment);
        for (let aclEntry of aclEntries.Items) wholeEntries.push(aclEntry);
        let lastEvaluatedKey = aclEntries.LastEvaluatedKey;
        while (typeof lastEvaluatedKey != "undefined") {
            aclEntries = await this.dynamoDBService.scanACLRecordUnitId(this.configService.environment, null, lastEvaluatedKey);
            lastEvaluatedKey = aclEntries.LastEvaluatedKey;
            for (let aclEntry of aclEntries.Items) wholeEntries.push(aclEntry);
        }
        /* Each ACL record is sorted considering the timestamp, in ascending order */
        wholeEntries.sort((a, b) => (a.time_arrival > b.time_arrival ? 1 : -1));
        return wholeEntries;
    }

    public async retrieveMostRecentExpirationDate() {
        let wholeEntries = await this.retrieveAllACLEntries();
        wholeEntries.sort((a, b) => a.time_expiration > b.time_expiration ? 1 : -1);
        let entriesActive = [];
        for (let entryActive of wholeEntries) {
            if (entryActive.in_progress && entryActive.paid == false)
                entriesActive.push(entryActive);
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

        let tables = await this.dynamoDBService.listTables(this.configService.environment);
        let workersManual = await this.S3Service.downloadWorkers(this.configService.environment);
        let workersACL = await this.dynamoDBService.getACLRecordIpAddress(this.configService.environment, this.worker.getIP());

        /* To blacklist a previous batch its worker list is picked up */
        for (let batchName of this.worker.settings.blacklist_batches) {
            let previousTaskName = batchName.split("/")[0];
            let previousBatchName = batchName.split("/")[1];
            if (!(batchName in batchesStatus)) {
                let workers = await this.S3Service.downloadWorkers(this.configService.environment, batchName);
                batchesStatus[batchName] = {};
                batchesStatus[batchName]["blacklist"] = workers["blacklist"];
                for (let tableName of tables["TableNames"]) {
                    if (tableName.includes(`${previousTaskName}_${previousBatchName}_ACL`)) {
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
                let workers = await this.S3Service.downloadWorkers(this.configService.environment, batchName);
                batchesStatus[batchName] = {};
                batchesStatus[batchName]["whitelist"] = workers["blacklist"];
                for (let tableName of tables["TableNames"]) {
                    if (tableName.includes(`${previousTaskName}_${previousBatchName}_ACL`)) {
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
                        await this.dynamoDBService.getACLRecordIpAddress(this.configService.environment, this.worker.getIP(), batchStatus["tableName"]);
                    if ("Items" in rawWorker) {
                        for (let worker of rawWorker["Items"]) {
                            if (this.worker.getIP()["ip"] == worker["ip_address"]) {
                                taskAllowed = false;
                                this.worker.setParameter("status_code", StatusCodes.WORKER_BLACKLIST_PREVIOUS);
                            }
                        }
                    }
                } else {
                    for (let workerIdentifier of batchStatus["blacklist"]) {
                        if (this.worker.identifier == workerIdentifier) {
                            taskAllowed = false;
                            this.worker.setParameter("status_code", StatusCodes.WORKER_BLACKLIST_PREVIOUS);
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
                        await this.dynamoDBService.getACLRecordIpAddress(this.configService.environment, this.worker.getIP(), batchStatus["tableName"]);
                    if ("Items" in rawWorker) {
                        for (let worker of rawWorker["Items"]) {
                            if (this.worker.getIP()["ip"] == worker["ip_address"]) {
                                taskAllowed = true;
                                this.worker.setParameter("status_code", StatusCodes.WORKER_WHITELIST_PREVIOUS);
                            }
                        }
                    }
                } else {
                    for (let workerIdentifier of batchStatus["whitelist"]) {
                        if (this.worker.identifier == workerIdentifier) {
                            taskAllowed = true;
                            this.worker.setParameter("status_code", StatusCodes.WORKER_WHITELIST_PREVIOUS);
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
                        this.worker.setParameter("status_code", StatusCodes.WORKER_RETURNING_BLOCK);
                        return taskAllowed;
                    }
                }
            }
        }

        /* Check to verify if the current worker is manually blacklisted into the current batch */
        for (let worker of workersManual["blacklist"]) {
            if (this.worker.identifier == worker) {
                taskAllowed = false;
                this.worker.setParameter("status_code", StatusCodes.WORKER_BLACKLIST_CURRENT);
                return taskAllowed;
            }
        }

        /* Check to verify if the current worker is manually whitelisted into the current batch using the dynamo-db based acl */

        for (let worker of workersManual["whitelist"]) {
            if (this.worker.identifier == worker) {
                taskAllowed = true;
                this.worker.setParameter("status_code", StatusCodes.WORKER_WHITELIST_CURRENT);
            }
        }

        return taskAllowed;
    }

    /* Unlocks the task depending on performWorkerStatusCheck outcome */
    public unlockTask(taskAllowed: boolean) {
        this.sectionService.taskAllowed = taskAllowed;
        this.sectionService.checkCompleted = true;
        this.changeDetector.detectChanges();
        /* The loading spinner is stopped */
        this.ngxService.stopLoader("skeleton-inner");
    }

    /*
     * This function enables the task when the worker clicks on "Proceed" inside the main instructions page.
     */
    public enableTask() {
        /* The main-instructions card is now dismissed */
        this.sectionService.taskInstructionsRead = true;

        /* Update the browser tab title – keeps your original logic */
        if (this.configService.environment.taskTitle !== "none") {
            this.titleService.setTitle(
                `${this.configService.environment.taskTitle}: ${this.task.getElementIndex(this.worker.getPositionCurrent()).elementType}${this.worker.getPositionCurrent()}`
            );
        } else {
            this.titleService.setTitle(
                `${this.configService.environment.taskName}: ${this.task.getElementIndex(this.worker.getPositionCurrent()).elementType}${this.worker.getPositionCurrent()}`
            );
        }

        /* Helper message */
        this.showSnackbar(
            "If you have a very slow internet connection, please wait a few seconds for the page to load.",
            "Dismiss",
            8000
        );

        /* Start the timer for the very first element */
        this.task.timestampsStart[this.worker.getPositionCurrent()].push(Math.round(Date.now() / 1000));
    }

    public async retrieveDataRecords() {
        let wholeEntries = [];
        let dataEntries = await this.dynamoDBService.getDataRecord(this.configService.environment, this.worker.identifier);
        for (let dataEntry of dataEntries.Items) wholeEntries.push(dataEntry);
        let lastEvaluatedKey = dataEntries.LastEvaluatedKey;
        while (typeof lastEvaluatedKey != "undefined") {
            dataEntries = await this.dynamoDBService.getDataRecord(
                this.configService.environment,
                this.worker.identifier,
                null,
                lastEvaluatedKey
            );
            lastEvaluatedKey = dataEntries.LastEvaluatedKey;
            for (let dataEntry of dataEntries.Items) wholeEntries.push(dataEntry);
        }
        let entriesParsed = []
        for (let dataEntry of wholeEntries) {
            if (this.worker.identifier == dataEntry.identifier && dataEntry.sequence.includes(this.worker.getIP()['ip'])) {
                dataEntry["data"] = JSON.parse(dataEntry["data"])
                entriesParsed.push(dataEntry)
            }
        }
        return entriesParsed
    }

    /*
     *  This function retrieves the hit identified by the validated token input inserted by the current worker and sets the task up accordingly.
     *  Such hit is represented by a Hit object. The task is set up by parsing the hit content as an Array of Document objects.
     *  Therefore, to use a customized the task the Document interface must be adapted to correctly parse each document's field.
     *  The Document interface can be found at this path: ../../../../data/build/task/document.ts
     */
    public async performTaskSetup() {
        /* The token input has been already validated, this is just to be sure */

        this.sectionService.taskStarted = true;

        /* The hits stored on Amazon S3 are retrieved */
        let hits = await this.S3Service.downloadHits(
            this.configService.environment
        );

        /* Scan each entry for the token input */
        for (let currentHit of hits) {
            /* If the token input of the current hit matches with the one inserted by the worker the right hit has been found */
            if (this.worker.getParameter('unit_id') === currentHit.unit_id) {
                currentHit = currentHit as Hit;
                this.task.tokenInput = currentHit.token_input;
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

        /* A form for each document is initialized */
        this.documentsForm = new Array<UntypedFormGroup>();
        this.documentsFormsAdditional = new Array<Array<UntypedFormGroup>>();
        /* Initialize an array for additional assessment forms with a length equal to the post attributes length. */
        if (this.task.settings.post_assessment) {
            for (let index = 0; index < this.task.documents.length; index++)
                this.documentsFormsAdditional[index] = Array(0);
        }

        this.searchEngineForms = new Array<Array<UntypedFormGroup>>();
        this.resultsRetrievedForms = new Array<Array<Object>>();

        let questionnaires = await this.S3Service.downloadQuestionnaires(this.configService.environment);
        this.task.initializeQuestionnaires(questionnaires);

        /* A form for each questionnaire is initialized */
        this.questionnairesForm = new Array<UntypedFormGroup>();

        /* The evaluation instructions stored on Amazon S3 are retrieved */
        this.task.initializeInstructionsEvaluation(
            await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
        );

        this.task.initializeDimensions(
            await this.S3Service.downloadDimensions(this.configService.environment)
        );

        this.task.initializeAccessCounter();

        this.task.initializeTimestamps();

        this.task.initializePostAssessment()

        if (!(this.worker.identifier == null)) {
            if (this.task.dataRecords.length <= 0) {
                let taskInitialPayload = this.task.buildTaskInitialPayload(this.worker);
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, taskInitialPayload);
            }
        }

        this.changeDetector.detectChanges();
    }

    public storePositionCurrent(data) {
        this.worker.setParameter("position_current", String(data))
        this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
    }

    /* #################### LOGGER #################### */

    /* Logging service initialization */
    public initializeLogger(workerIdentifier, taskName, batchName, regionName, http: HttpClient, logOnConsole: boolean) {
        this.actionLogger.logInit(this.configService.environment.bucket, workerIdentifier, taskName, batchName, regionName, http, logOnConsole);
    }

    /* #################### QUALITY CHECKS #################### */

    public performQualityChecks() {
        /*
         * This section performs the necessary checks to ensure the quality of the worker's output.
         * Three checks are conducted:
         * 1) GLOBAL VALIDITY CHECK (QUESTIONNAIRE + DOCUMENTS): Verifies that each field of every form contains valid values.
         * 2) GOLD QUESTION CHECK: Implements a custom check on gold elements retrieved using their IDs. An element is considered gold if its ID contains the word "GOLD-".
         * 3) TIME SPENT CHECK: Verifies if the time spent by the worker on each document and questionnaire exceeds <timeCheckAmount> seconds, using the <timestampsElapsed> array.
         * If each check is successful, the task can conclude. If the worker has remaining attempts, the task is reset.
         */

        let globalValidityCheck: boolean;
        let timeSpentCheck: boolean;
        let timeCheckAmount = this.task.getTimesCheckAmount();

        /* 1) GLOBAL VALIDITY CHECK performed here */
        globalValidityCheck = this.performGlobalValidityCheck();

        /* 2) GOLD ELEMENTS CHECK performed here */
        let goldConfiguration = this.task.generateGoldConfiguration(this.task.goldDocuments, this.task.goldDimensions, this.documentsForm, this.task.notes);

        /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
        let goldChecks = GoldChecker.performGoldCheck(goldConfiguration);

        /* 3) TIME SPENT CHECK performed here */
        timeSpentCheck = true;

        for (let i = 0; i < this.task.timestampsElapsed.length; i++) {
            if (this.task.timestampsElapsed[i] < timeCheckAmount[i]) {
                timeSpentCheck = false
                break
            }
        }

        let qualityCheckData = {
            globalOutcome: null,
            globalFormValidity: globalValidityCheck,
            timeSpentCheck: timeSpentCheck,
            goldChecks: goldChecks,
            goldConfiguration: goldConfiguration,
        };

        let checksOutcome = [];
        let checker = (array) => array.every(Boolean);

        checksOutcome.push(qualityCheckData["globalFormValidity"]);
        checksOutcome.push(qualityCheckData["timeSpentCheck"]);
        checksOutcome.push(checker(qualityCheckData["goldChecks"]));

        qualityCheckData["globalOutcome"] = checker(checksOutcome);

        /* If each check is true, the task is successful; otherwise, the task fails (but is not terminated if there are more attempts available). */
        return qualityCheckData;

    }

    /*
     * This function performs a scan of each form filled by the current worker (i.e., questionnaires + document answers)
     * to ensure that each form undergoes the validation step (i.e., each field is filled, the URL provided as justification
     * is retrieved from a search engine, a truth level is selected, etc.).
     */
    public performGlobalValidityCheck() {
        /* The "valid" flag of each questionnaire or document form must be true to pass this check. */
        let questionnaireFormValidity = true;
        let documentsFormValidity = true;
        for (let index = 0; index < this.questionnairesForm.length; index++) {
            if (this.questionnairesForm[index].valid == false)
                questionnaireFormValidity = false;
        }
        for (let index = 0; index < this.documentsForm.length; index++) {
            let assessmentForm = this.documentsForm[index]
            if (!this.task.settings.post_assessment) {
                if (assessmentForm.valid == false)
                    documentsFormValidity = false;
            } else {
                let documentFormsAdditional = this.documentsFormsAdditional[index];
                /* Check validity of the last post assessment form */
                let lastPostAssessmentFormValidity = documentFormsAdditional[documentFormsAdditional.length - 1].valid;
                /* Check disabled status of the initial assessment form */
                let isAssessmentFormDisabled = assessmentForm.status === "DISABLED";
                /* Check validity or disabled status for previous post assessment forms */
                let previousPostAssessmentFormsValidity = documentFormsAdditional.slice(0, -1).every(form => form.valid || form.status === "DISABLED");
                /* Check the overall validity */
                let overallValidity = (isAssessmentFormDisabled || assessmentForm.valid) && previousPostAssessmentFormsValidity && lastPostAssessmentFormValidity;
                if (!overallValidity) {
                    documentsFormValidity = false;
                }
            }
        }
        return questionnaireFormValidity && documentsFormValidity;
    }

    /*
     * This function resets the task by bringing the worker to the first document if he still has some available tries.
     * The worker can trigger this operation by clicking the "Reset" button when quality checks are completed and the outcome is shown.
     */
    public performReset() {

        /* Start the loading spinner */
        this.ngxService.startLoader('skeleton-inner');

        /* Reset status flags */
        this.sectionService.taskFailed = false;
        this.sectionService.taskSuccessful = false;
        this.sectionService.taskCompleted = false;
        this.sectionService.taskStarted = true;

        /* Update try counters */
        this.task.tryCurrent += 1;

        /* Restart countdown on the first document (if present) */
        if (this.task.settings.countdownTime >= 0 &&
            this.documentComponent?.[0]?.countdown?.left! > 0) {
            this.documentComponent[0].countdown.resume();
        }

        /* Compute and persist metadata */
        const triesLeft = this.task.settings.allowed_tries - this.task.tryCurrent;
        this.worker.setParameter('try_left', String(triesLeft));
        this.worker.setParameter('try_current', String(this.task.tryCurrent));

        let jumpIndex = this.computeJumpIndex()
        this.worker.setParameter('position_current', String(jumpIndex))

        /* Force change detection so we still have a valid Stepper ref */
        this.changeDetector.detectChanges();

        /* Jump straight to the desired step (no intermediate instantiation) */
        this.stepper.selectedIndex = jumpIndex;
        this.sectionService.stepIndex = jumpIndex;

        /* Stop the spinner */
        this.ngxService.stopLoader('skeleton-inner');

        /* Store the new start timestamp (initialise array slot on first use) */
        if (!this.task.timestampsStart[jumpIndex]) {
            this.task.timestampsStart[jumpIndex] = [];
        }
        this.task.timestampsStart[jumpIndex].push(Date.now() / 1000);

    }

    /**
     * Computes the index to jump to on reset.
     *
     * Logic:
     * - Prefer jumping to the first document with "reset_jump" if set; otherwise, to the first document.
     * - Never land on or before a questionnaire where allow_back is false or absent (locked questionnaires).
     * - Performs validity and timing checks for each step before the jump.
     *
     * Returns:
     * - The safest index to jump to, respecting locked questionnaires and workflow requirements.
     */
    public computeJumpIndex() {
        let jumpIndex = 0;

        // If there are documents, jump to the first document (after questionnaires).
        if (this.task.documentsAmount !== 0) {
            jumpIndex += this.task.questionnaireAmountStart;

            // If a document has reset_jump set, prefer jumping there.
            for (let i = 0; i < this.task.documents.length; i++) {
                const doc = this.task.documents[i];
                if (doc["params"]["reset_jump"] === true) {
                    jumpIndex += doc["index"];
                    break;
                }
            }
        }

        // Track the last questionnaire index with allow_back === false (or undefined), i.e., locked.
        let lastLockedQuestionnaireIdx = -1;

        // Tracks if any previous checks have failed, to restrict how far back we can go.
        let failChecksCurrent = false;

        // Used for referencing current step's allow_back setting and form validity.
        let objAllowBack;
        let objFormValidity;

        // Compute the total number of steps.
        const totalSteps = this.task.questionnaireAmount + this.task.documentsAmount;

        // Get the allowed time for each check.
        const timeCheckAmount = this.task.getTimesCheckAmount();

        // Iterate over all steps up to and including jumpIndex (or until totalSteps).
        for (let i = 0; i <= jumpIndex && i < totalSteps; i++) {
            let idx = null;
            let isQuestionnaire = false;

            // Determine whether this step is a document or a questionnaire and get relevant references.
            if (
                i >= this.task.questionnaireAmountStart &&
                i < this.task.questionnaireAmountStart + this.task.documentsAmount
            ) {
                // Document step
                objFormValidity = this.documentsForm[i - this.task.questionnaireAmountStart];
            } else {
                // Questionnaire step
                isQuestionnaire = true;
                idx = i < this.task.questionnaireAmountStart ? i : i - this.task.documentsAmount;
                objAllowBack = this.task.questionnaires[idx];
                objFormValidity = this.questionnairesForm[idx];
            }

            /* For questionnaires: perform checks before evaluating allow_back. */
            if (isQuestionnaire) {
                failChecksCurrent =
                    failChecksCurrent ||
                    objFormValidity.valid === false ||
                    this.task.timestampsElapsed[i] < timeCheckAmount[i];

                /* If allow_back is absent or false, treat as locked (no back allowed).
                   We must not allow jumping to or before this questionnaire on reset. */
                if (!objAllowBack["allow_back"]) {
                    lastLockedQuestionnaireIdx = i;
                }
            } else {
                /* For documents: perform checks after evaluating allow_back (not needed for allow_back). */
                failChecksCurrent =
                    failChecksCurrent ||
                    objFormValidity.valid === false ||
                    this.task.timestampsElapsed[i] < timeCheckAmount[i];
            }
        }

        /*
         * If the computed jumpIndex is before or at a locked questionnaire step,
         * jump to the first step immediately after the last locked questionnaire (if possible).
         * This ensures we never land on or before a locked questionnaire.
         */
        if (lastLockedQuestionnaireIdx >= 0 && jumpIndex <= lastLockedQuestionnaireIdx) {
            return lastLockedQuestionnaireIdx + 1 < totalSteps ? lastLockedQuestionnaireIdx + 1 : lastLockedQuestionnaireIdx;
        }

        /*
         * Otherwise, jump to the intended step, but never go beyond the last valid step.
         */
        return Math.min(jumpIndex, totalSteps - 1);
    }

    public storeQuestionnaireForm(data, stepIndex) {
        let questionnaireIndex = this.task.getElementIndex(stepIndex)['elementIndex']
        if (!this.questionnairesForm[questionnaireIndex])
            this.questionnairesForm[questionnaireIndex] = data["form"];
        let action = data["action"];
        if (action)
            this.produceData(action, stepIndex);
    }

    public storeDocumentForm(data, stepIndex) {
        let documentIndex = this.task.getElementIndex(stepIndex)['elementIndex']
        let type = data['type']
        /* Added a check for null and undefined values in post-assessment cases, where the main form bounces when clicking on Next, Back, or Finish. */
        if (type == 'initial' || type === null || type === undefined) {
            if (!this.documentsForm[documentIndex]) {
                this.documentsForm[documentIndex] = data["form"];
                this.documentsFormsAdditional[documentIndex] = []
            }
        } else {
            this.documentsFormsAdditional[documentIndex].push(data["form"])
        }
        let action = data["action"];
        if (action)
            this.produceData(action, stepIndex);
    }

    /*
     * This function allows the worker to provide a comment when a try is finished, whether successful or not.
     * The comment can be typed in a textarea, and when the worker clicks the "Send" button, such a comment is uploaded to an Amazon S3 bucket.
     */
    public async storeComment(data) {
        this.outcomeSection.commentSent = true;
        if (!(this.worker.identifier == null)) {
            let comment = this.task.buildCommentPayload(data);
            await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, comment);
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
        if (action == "Finish")
            currentElement = this.task.getElementsNumber() - 1;

        let completedElementBaseIndex = completedElement;
        let currentElementBaseIndex = currentElement;
        let completedElementData = this.task.getElementIndex(completedElement);
        let currentElementData = this.task.getElementIndex(currentElement);
        let completedElementType = completedElementData["elementType"];
        let completedElementIndex = completedElementData["elementIndex"];

        this.task.elementsAccesses[completedElementBaseIndex] = this.task.elementsAccesses[completedElementBaseIndex] + 1;

        this.computeTimestamps(currentElementBaseIndex, completedElementBaseIndex, action);
        if (this.task.hasCountdown()) {
            this.handleCountdowns(currentElementData, completedElementData, action);
        }
        if (this.task.settings.annotator) {
            if (this.task.settings.annotator.type == "options") {
                if (completedElementType == "S")
                    this.documentComponent?.get(completedElementIndex).annotatorOptions.first?.handleNotes();
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
                this.worker.setParameter("time_completion", new Date().toUTCString());
                if (this.sectionService.taskSuccessful) {
                    this.worker.setParameter("in_progress", String(false));
                    this.worker.setParameter("paid", String(true));
                    this.worker.setParameter("status_code", StatusCodes.TASK_SUCCESSFUL);
                } else {
                    const triesLeft = this.task.settings.allowed_tries - this.task.tryCurrent;
                    this.worker.setParameter("try_left", String(triesLeft));
                    this.worker.setParameter("try_current", String(this.task.tryCurrent));
                    this.worker.setParameter("in_progress", String(true));
                    this.worker.setParameter("paid", String(false));
                    this.worker.setParameter("status_code", this.task.settings.allowed_tries - this.task.tryCurrent > 0 ? StatusCodes.TASK_FAILED_WITH_TRIES : StatusCodes.TASK_FAILED_NO_TRIES);
                    this.worker.setParameter('position_current', String(this.computeJumpIndex()))
                }
                await this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
            }
        }

        if (!(this.worker.identifier == null)) {
            if (completedElementType == "Q") {
                let questionnairePayload = this.task.buildTaskQuestionnairePayload(completedElementData, this.questionnairesForm[completedElementIndex].value, action);
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, questionnairePayload);
                this.storePositionCurrent(String(currentElement))
            }

            if (completedElementType == "S") {
                let countdown = null;
                if (this.task.settings.countdownTime >= 0)
                    countdown = Math?.round(Number(this.documentComponent?.get(completedElementIndex).countdown.i.value) / 1000);
                let additionalAnswers = {}
                for (let assessmentFormAdditional of this.documentsFormsAdditional[completedElementIndex]) {
                    Object.keys(assessmentFormAdditional.controls)?.forEach(controlName => {
                        additionalAnswers[controlName] = assessmentFormAdditional?.get(controlName).value
                    });
                }
                let documentPayload = this.task.buildTaskDocumentPayload(completedElementData, this.documentsForm[completedElementIndex].value, additionalAnswers, countdown, action);
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, documentPayload);
                this.storePositionCurrent(String(currentElement))

            }

            if (completedElementBaseIndex == this.task.getElementsNumber() - 1 && action == "Finish") {
                qualityChecksPayload = this.task.buildQualityChecksPayload(qualityChecks);
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, qualityChecksPayload);
                this.storePositionCurrent(String(currentElement))
            }
        }

        if (action == "Finish") {
            this.sectionService.taskCompleted = true;
            this.ngxService.stopLoader("skeleton-inner");
            this.changeDetector.detectChanges();
        }
    }

    public computeTimestamps(
        currentElement: number,
        completedElement: number,
        action: string
    ) {
        let timeInSeconds = Date.now() / 1000;

        if (action == "Finish") {
            /* If the task finishes, the current timestamp is the end timestamp for the current document. */
            this.task.timestampsEnd[currentElement].push(timeInSeconds);
        } else {
            /*
             * If a transition to the following document is performed (Next) the current timestamp is:
             * the start timestamp for the document at <stepper.selectedIndex>
             * the end timestamps for the document at <stepper.selectedIndex - 1>
             */
            /*
             * If a transition to the previous document is performed (Back) the current timestamp is:
             * the start timestamp for the document at <stepper.selectedIndex>
             * the end timestamps for the document at <stepper.selectedIndex + 1>
             */
            this.task.timestampsStart[currentElement].push(timeInSeconds);
            this.task.timestampsEnd[completedElement].push(timeInSeconds);
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
                    totalSecondsElapsed = totalSecondsElapsed + (Number(this.task.timestampsEnd[i][k]) - Number(this.task.timestampsStart[i][k]));
                }
            }
            this.task.timestampsElapsed[i] = totalSecondsElapsed;
        }

    }

    /* #################### COUNTDOWNS #################### */
    public handleCountdowns(
        currentDocumentData: { elementType: string, elementIndex: number, overallIndex: any, elementLabel: string },
        completedDocumentData: { elementType: string, elementIndex: number, overallIndex: any, elementLabel: string },
        action: string
    ) {
        const getCountdown = (index: number) => this.documentComponent?.get(index).countdown;
        const pauseCountdown = (index: number) => {
            const countdown = getCountdown(index);
            if (!this.task.countdownsExpired[index])
                countdown.pause();
        }

        if (completedDocumentData.elementType === "S") {
            pauseCountdown(completedDocumentData.elementIndex);
            if (action === "Finish")
                return; // No need to start/resume the countdown if the action is Finish
        }
        if (currentDocumentData.elementType === "S" && !this.task.countdownsExpired[currentDocumentData.elementIndex] && this.task.countdownsStarted[currentDocumentData.elementIndex]) {
            const currentCountdown = getCountdown(currentDocumentData.elementIndex);
            if (currentCountdown.i.value / 1000 === this.task.documentsCountdownTime[currentDocumentData.elementIndex])
                currentCountdown.begin();
            else
                currentCountdown.resume();
        }
    }

    public showSnackbar(message, action, duration) {
        this.snackBar.open(message, action, {
            duration: duration,
        });
    }

}
