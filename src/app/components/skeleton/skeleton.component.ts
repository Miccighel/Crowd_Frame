/* Angular Core Modules */
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    QueryList,
    ViewChild,
    ViewChildren,
    ViewEncapsulation
} from "@angular/core";
import {UntypedFormBuilder, UntypedFormGroup} from "@angular/forms";
import {HttpClient} from "@angular/common/http";

/* Angular Material Components */
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
import {MatSnackBar} from "@angular/material/snack-bar";

/* RxJS Modules */
import {of, Subject} from "rxjs";
import {catchError, tap, takeUntil} from "rxjs/operators";

/* Services */
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
import {NgxUiLoaderService} from "ngx-ui-loader";

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
export class SkeletonComponent implements OnInit, OnDestroy {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    dynamoDBService: DynamoDBService;
    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    titleService: Title;
    /* Service to log to the server */
    actionLogger: ActionLogger | null;
    /* Service to track current section */
    sectionService: SectionService;
    utilsService: UtilsService;
    localStorageService: LocalStorageService;
    debugService: DebugService;

    /* HTTP client and headers */
    client: HttpClient;

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    /* Snackbar reference */
    snackBar: MatSnackBar;

    /* Single global loader controller (host lives in BaseComponent) */
    ngx: NgxUiLoaderService;

    /* Single global loader controller state */
    private overlayStopped = false;

    /* This is a convention often used in Angular to manage the cleanup of subscriptions. It involves a Subject that emits a value when the component is
     * about to be destroyed, typically in the ngOnDestroy lifecycle hook. */
    private unsubscribe$ = new Subject<void>();

    /* #################### LOCAL ATTRIBUTES #################### */

    /* Object to encapsulate all task-related information */
    task: Task;
    /* Object to encapsulate all worker-related information */
    worker: Worker;
    /* Check to understand if the generator or the skeleton should be loader */
    generator: boolean;

    private _stepper!: MatStepper; // actual holder

    @ViewChild('stepper', {static: false})
    set stepperSetter(stepper: MatStepper | undefined) {
        if (!stepper) return; // view not ready yet
        this._stepper = stepper; // keep a reference

        /* ----  RESTORE LAST POSITION  -------------------------------- */
        const last = this.worker?.getPositionCurrent() ?? 0;
        this._stepper.selectedIndex = last;
        this.sectionService.stepIndex = last;

        /* Force CD so that bindings inside the newly-selected step update
           (kept with detectChanges here to sync immediately after view init) */
        this.changeDetector.detectChanges();

        /* Stop the global overlay only now: UI is actually present */
        this.stopGlobalOnNextPaint();
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

    /* Reference to the outcome section component (setter used as a sentinel to stop overlay if we land here directly) */
    private _outcomeSection?: OutcomeSectionComponent;

    @ViewChild(OutcomeSectionComponent)
    set outcomeSectionSetter(cmp: OutcomeSectionComponent | undefined) {
        if (!cmp) return;
        this._outcomeSection = cmp;

        /* If we show Outcome directly (task completed/already done), ensure overlay is stopped */
        this.stopGlobalOnNextPaint();
    }

    get outcomeSection(): OutcomeSectionComponent | undefined {
        return this._outcomeSection;
    }

    constructor(
        private baseComponent: BaseComponent,
        changeDetector: ChangeDetectorRef,
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
        debugService: DebugService,
        ngx: NgxUiLoaderService
    ) {
        this.changeDetector = changeDetector;
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

        this.generator = false;

        this.ngx = ngx; // store loader service
    }

    /* To follow the execution flow of the skeleton, the functions need to be read in order (i.e., from top to bottom). */
    ngOnInit() {
        /* Subscription is tied to component lifetime to avoid leaks. */
        this.baseComponent.initializationCompleted
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(_params => {
                this.task = this.sectionService.task;
                const paramsFetched = this.parseURLParams(new URL(window.location.href));
                this.startWorkerInitialization(paramsFetched);
            });
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    /* ------------------------------------------------------
       Parse URL params and normalize keys.
       Preserves original behavior (identifier autodetection).
       ------------------------------------------------------ */
    private parseURLParams(url: URL): Record<string, string> {
        const paramsFetched: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            if (key.toLowerCase().includes("workerid")) {
                paramsFetched["identifier"] = value;
            } else {
                key = key.replace(/(?:^|\.?)([A-Z])/g, (_x, y) => "_" + y.toLowerCase()).replace(/^_/, "");
                paramsFetched[key] = value;
            }
        });
        return paramsFetched;
    }

    /* ------------------------------------------------------
       Begin worker initialization.
       - Enrich Worker with device/navigator info.
       - Fetch external IP hints (best-effort).
       - UI unlock is deferred to finalization to prevent flicker.
       ------------------------------------------------------ */
    private startWorkerInitialization(params: Record<string, string>) {
        this.worker = new Worker(params);
        this.worker.updateProperties('ngxdevicedetector', this.deviceDetectorService.getDeviceInfo());
        this.worker.updateProperties('navigator', window.navigator);

        this.fetchExternalData()
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({complete: () => this.finalizeWorkerInitialization()});
    }

    /* ------------------------------------------------------
       Fetch external IP-related info.
       - Cloudflare trace attempted first (text).
       - ipify used as fallback (JSON).
       - On total failure, a status is set but UI is not unlocked here.
       - Prevents premature UI flip during transient network issues.
       ------------------------------------------------------ */
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
                    /* Do not unlock here; allow the normal init flow to decide. */
                }
            })
        );
    }

    /* ------------------------------------------------------
       Normalize Worker IP.
       Accepts string or object with ip/ipAddress fields.
       Centralizes IP handling to avoid shape errors.
       ------------------------------------------------------ */
    private getNormalizedWorkerIp(): string | null {
        const raw = this.worker?.getIP?.();
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object') {
            const anyRaw: any = raw;
            return anyRaw.ip ?? anyRaw.ipAddress ?? null;
        }
        return null;
    }

    /* Persist a unit-level ACL row (HIT slot). Optional status and timestamp flags. */
    private async writeUnitAcl(entry: any, opts?: { statusCode?: StatusCodes, updateArrivalTime?: boolean, updateRemovalTime?: boolean }) {
        if (opts?.statusCode !== undefined && opts?.statusCode !== null) {
            entry["status_code"] = opts.statusCode;
        }
        await this.dynamoDBService.insertACLRecordUnitId(
            this.configService.environment,
            entry,
            this.task?.tryCurrent ?? 0,
            opts?.updateArrivalTime ?? false,
            opts?.updateRemovalTime ?? false
        );
    }

    /*
     * Finalize worker initialization.
     * - Rehydrates or creates the worker ACL entry.
     * - Optionally assigns a HIT (unassigned → recovery from abandonment → inconsistency sweep).
     * - Writes TASK_OVERBOOKING / TASK_COMPLETED_BY_OTHERS outcomes back to ACL for auditability.
     * - Uses best-effort unit claim helper; behavior is preserved, data consistency is improved.
     */
    public async finalizeWorkerInitialization() {
        /* Flag to indicate if a HIT is assigned to the current worker. */
        let hitAssigned = false;
        const env = this.configService.environment;

        /* Retrieve existing ACL records by IP (if any). */
        /* FIX: normalize IP to avoid object-vs-string mismatches that caused everyone to be treated as "new". */
        const aclByIp = await this.dynamoDBService.getACLRecordIpAddress(env, this.getNormalizedWorkerIp());
        const aclItems: any[] = aclByIp?.Items ?? [];

        /* Track whether we generated a worker id locally. */
        let workerIdGenerated = String(false);
        const workerIdentifierProvided = this.worker.identifier;

        if (aclItems.length <= 0) {
            /* -------------------------
               NEW WORKER INITIALIZATION
               ------------------------- */

            /* Ensure we have a worker identifier. */
            if (this.worker.identifier == null) {
                const generatedId = this.utilsService.randomIdentifier(14).toUpperCase();
                this.worker.setParameter("identifier", generatedId);
                this.worker.identifier = generatedId;
                workerIdGenerated = String(true);
            }

            /* Persist batch/task metadata. */
            this.worker.setParameter("task_name", env.taskName);
            this.worker.setParameter("batch_name", env.batchName);
            if (this.worker.getParameter("platform") == null) this.worker.setParameter("platform", "custom");
            this.worker.setParameter("folder", this.S3Service.getWorkerFolder(env, this.worker));
            this.worker.setParameter("access_counter", String(1));
            this.worker.setParameter("paid", String(false));
            this.worker.setParameter("generated", workerIdGenerated);
            this.worker.setParameter("in_progress", String(true));
            this.worker.setParameter("position_current", String(0));
            this.worker.setParameter("try_current", String(this.task.tryCurrent));
            this.worker.setParameter("try_left", String(this.task.settings.allowed_tries));

            /* Arrival/expiration timestamps for assessment window. */
            const timeArrival = new Date();
            const timeExpiration = new Date(timeArrival.getTime() + this.task.settings.time_assessment * 60 * 60 * 1000);
            this.worker.setParameter("time_arrival", timeArrival.toUTCString());
            this.worker.setParameter("time_expiration", timeExpiration.toUTCString());

            /* Look up most recent expiration across active entries. */
            const nearestExpiration = await this.retrieveMostRecentExpirationDate();
            this.worker.setParameter("time_expiration_nearest", nearestExpiration ?? timeExpiration.toUTCString());
            this.worker.setParameter("time_expired", String(false));

            /* Persist network/user agent hints. */
            const ipStr = this.getNormalizedWorkerIp();
            this.worker.setParameter("ip_address", ipStr ?? String(false));
            const rawIp = this.worker?.getIP?.();
            const ipSource = (rawIp && typeof rawIp === 'object') ? (rawIp as any).source ?? null : null;
            if (ipSource != null) this.worker.setParameter("ip_source", ipSource);
            this.worker.setParameter("user_agent", this.worker.getUAG()["uag"]);
            this.worker.setParameter("user_agent_source", this.worker.getUAG()["source"]);

        } else {
            /* -----------------------------
               RETURNING/EXISTING WORKER FLOW
               ----------------------------- */

            const aclEntry = aclItems[0];

            /* Keep try counters in sync with stored ACL state. */
            this.task.settings.allowed_tries = aclEntry["try_left"];
            this.task.tryCurrent = aclEntry["try_current"];

            /* Refresh nearest expiration across active unpaid entries. */
            const nearestExpiration = await this.retrieveMostRecentExpirationDate();
            this.worker.setParameter("time_expiration_nearest", nearestExpiration ?? String(false));

            if (/true/i.test(aclEntry["paid"]) == true) {
                /* Already paid worker → mark as completed and write status. */
                this.sectionService.taskAlreadyCompleted = true;
                Object.entries(aclEntry).forEach(([k, v]) => this.worker.setParameter(k, v));
                this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']));
                await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_ALREADY_COMPLETED);

            } else {
                /* Not paid yet → check validity window and progress state. */
                Object.entries(aclEntry).forEach(([k, v]) => this.worker.setParameter(k, v));

                const timeArrivalMs = Date.parse(aclEntry["time_arrival"] ?? "");
                const nowMs = Date.now();
                const hoursElapsed = Math.abs(nowMs - (Number.isFinite(timeArrivalMs) ? timeArrivalMs : nowMs)) / 36e5;

                const expiredTime =
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && hoursElapsed > this.task.settings.time_assessment);
                const exhaustedTries =
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && parseInt(aclEntry["try_left"]) < 1);
                const notInProgress =
                    (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == false);

                if (expiredTime || exhaustedTries || notInProgress) {
                    /* This worker cannot proceed now; compute final status and persist. */
                    if (expiredTime) this.worker.setParameter("status_code", StatusCodes.TASK_TIME_EXPIRED);
                    if (notInProgress && parseInt(aclEntry["try_left"]) < 1) this.worker.setParameter("status_code", StatusCodes.TASK_FAILED_NO_TRIES);

                    this.worker.setParameter("in_progress", String(false));
                    this.worker.setParameter("time_removal", new Date().toUTCString());
                    this.sectionService.taskFailed = true;
                    this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']));

                    const finalStatus =
                        expiredTime
                            ? StatusCodes.TASK_TIME_EXPIRED
                            : (notInProgress && parseInt(aclEntry["try_left"]) < 1)
                                ? StatusCodes.TASK_FAILED_NO_TRIES
                                : StatusCodes.WORKER_RETURNING_BLOCK;

                    await this.dynamoDBService.updateWorkerAcl(env, this.worker, finalStatus);

                } else {
                    /* Valid, in-progress slot retained by this worker. */
                    Object.entries(aclEntry).forEach(([k, v]) => this.worker.setParameter(k, v));
                    this.worker.identifier = this.worker.getParameter("identifier");
                    this.worker.setParameter("access_counter", (parseInt(this.worker.getParameter("access_counter")) + 1).toString());
                    this.worker.setParameter("status_code", StatusCodes.TASK_HIT_ASSIGNED);
                    this.worker.setParameter('identifiers_provided', this.worker.storeIdentifiersProvided(workerIdentifierProvided, aclEntry['identifiers_provided']));
                    await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_HIT_ASSIGNED);
                    hitAssigned = true;
                }
            }
        }

        /* --------------------------------------
           Continue only if we’re not already done
           -------------------------------------- */
        if (!this.sectionService.taskAlreadyCompleted && !this.sectionService.taskFailed) {

            /* Load per-batch worker settings from S3. */
            this.worker.settings = new WorkerSettings(await this.S3Service.downloadWorkers(env));

            /* Init logger only if enabled. */
            if (this.task.settings.logger_enable)
                this.initializeLogger(
                    this.worker.identifier,
                    env.taskName,
                    env.batchName,
                    env.region,
                    this.client,
                    env.log_on_console
                );
            else
                this.actionLogger = null;

            /* Run allowlist/denylist checks, then assign a HIT if needed. */
            this.performWorkerStatusCheck().then(async (taskAllowed) => {
                this.sectionService.taskAllowed = taskAllowed;

                const hitCompletedOrInProgress: Record<string, boolean> = {};

                if (taskAllowed) {
                    if (!hitAssigned) {
                        /* Try to claim an unassigned HIT first (sequential in-order, skip active, verify claim). */
                        const hits = await this.S3Service.downloadHits(env);

                        if ((aclItems?.length ?? 0) <= 0) {
                            /* Initialize bookkeeping for all units (default: not completed/in-progress). */
                            for (const h of hits) hitCompletedOrInProgress[h.unit_id] = false;

                            const ipStr = this.getNormalizedWorkerIp();

                            /* Helper: check if a unit is currently in-progress & unpaid (active holder). */
                            const unitIsActive = async (unitId: string) => {
                                /* Prefer a keyed getter by unit_id if available; fall back to scan. */
                                let page = await this.dynamoDBService.scanACLRecordUnitId(env);
                                const consider = (items: any[]) => {
                                    for (const e of (items ?? [])) {
                                        if (e?.unit_id === unitId) {
                                            const inProg = /true/i.test(String(e.in_progress));
                                            const unpaid = /true/i.test(String(e.paid)) === false;
                                            if (inProg && unpaid) return true;
                                        }
                                    }
                                    return false;
                                };
                                if (consider(page.Items)) return true;
                                let lek = page.LastEvaluatedKey;
                                while (typeof lek !== "undefined") {
                                    page = await this.dynamoDBService.scanACLRecordUnitId(env, null, lek);
                                    if (consider(page.Items)) return true;
                                    lek = page.LastEvaluatedKey;
                                }
                                return false;
                            };

                            /* ---- Sequential scan from index 0 (deterministic order) */
                            for (let idx = 0; idx < hits.length && !hitAssigned; idx++) {
                                const hit = hits[idx];

                                /* Skip units already held by someone in-progress & unpaid. */
                                if (await unitIsActive(hit.unit_id)) {
                                    hitCompletedOrInProgress[hit.unit_id] = true;
                                    continue;
                                }

                                /* Attempt atomic claim (backend must enforce a conditional write). */
                                const unitEntry: any = {
                                    unit_id: hit.unit_id,
                                    token_input: hit.token_input,
                                    token_output: hit.token_output,
                                    identifier: this.worker.identifier,
                                    ip_address: ipStr ?? String(false),
                                    in_progress: String(true),
                                    paid: String(false),
                                    time_arrival: new Date().toUTCString()
                                };

                                const {claimed} = await this.dynamoDBService.claimUnitIfUnassigned(env, unitEntry);

                                if (!claimed) {
                                    /* Someone else raced for this index; mark busy and proceed to the next one. */
                                    hitCompletedOrInProgress[hit.unit_id] = true;
                                    continue;
                                }

                                /* Post-claim verification (defensive): ensure ACL row is bound to this worker. */
                                let claimedByUs = false;
                                let page = await this.dynamoDBService.scanACLRecordUnitId(env);
                                const verify = (items: any[]) => {
                                    for (const e of (items ?? [])) {
                                        if (e?.unit_id === hit.unit_id) {
                                            const idMatch = String(e.identifier) === String(this.worker.identifier);
                                            const inProg = /true/i.test(String(e.in_progress));
                                            const unpaid = /true/i.test(String(e.paid)) === false;
                                            if (idMatch && inProg && unpaid) return true;
                                        }
                                    }
                                    return false;
                                };
                                if (verify(page.Items)) claimedByUs = true;
                                let lek = page.LastEvaluatedKey;
                                while (!claimedByUs && typeof lek !== "undefined") {
                                    page = await this.dynamoDBService.scanACLRecordUnitId(env, null, lek);
                                    if (verify(page.Items)) claimedByUs = true;
                                    lek = page.LastEvaluatedKey;
                                }

                                if (claimedByUs) {
                                    /* Store unit metadata on worker and write status. */
                                    this.worker.setParameter("unit_id", hit.unit_id);
                                    this.worker.setParameter("token_input", hit.token_input);
                                    this.worker.setParameter("token_output", hit.token_output);
                                    await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_HIT_ASSIGNED);
                                    hitAssigned = true;
                                    break;
                                } else {
                                    /* Failed verification, keep scanning the next unit in order. */
                                    hitCompletedOrInProgress[hit.unit_id] = true;
                                }
                            }

                            /* Try to recover a slot from expired/abandoned entries. */
                            if (!hitAssigned) {
                                const myIp = this.getNormalizedWorkerIp();
                                let wholeEntries = await this.retrieveAllACLEntries();

                                for (const aclEntry of wholeEntries) {
                                    if ((aclEntry["ip_address"] ?? null) !== (myIp ?? null)) {
                                        if (/true/i.test(aclEntry["paid"]) == true ||
                                            ((/true/i.test(aclEntry["paid"]) == false) && (/true/i.test(aclEntry["in_progress"]) == true))) {
                                            hitCompletedOrInProgress[aclEntry["unit_id"]] = true;
                                        }

                                        /* A slot can be recovered if it elapsed or tries are almost gone. */
                                        const timeArrival = Date.parse(aclEntry["time_arrival"] ?? "");
                                        const hoursElapsed = Math.abs(Date.now() - (Number.isFinite(timeArrival) ? timeArrival : Date.now())) / 36e5;

                                        if ((/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && hoursElapsed >= this.task.settings.time_assessment) ||
                                            (/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == true && parseInt(aclEntry["try_left"]) <= 1)) {
                                            hitAssigned = true;

                                            /* Close the abandoned entry. */
                                            aclEntry["time_expired"] = String(true);
                                            aclEntry["in_progress"] = String(false);
                                            await this.writeUnitAcl(aclEntry, {updateRemovalTime: true});

                                            /* Assign slot to current worker. */
                                            this.worker.setParameter("token_input", aclEntry["token_input"]);
                                            this.worker.setParameter("token_output", aclEntry["token_output"]);
                                            this.worker.setParameter("unit_id", aclEntry["unit_id"]);
                                            this.worker.setParameter("time_arrival", new Date().toUTCString());

                                            await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_HIT_ASSIGNED);
                                        }
                                    }

                                    if (hitAssigned) break;
                                }

                                /* Sweep for inconsistent units (recently released with no active holder). */
                                if (!hitAssigned) {
                                    const inconsistentUnits: string[] = [];
                                    for (const [unitId, status] of Object.entries(hitCompletedOrInProgress)) {
                                        if (status === false && !inconsistentUnits.includes(unitId)) inconsistentUnits.push(unitId);
                                    }

                                    if (inconsistentUnits.length > 0) {
                                        const myIp2 = this.getNormalizedWorkerIp();
                                        wholeEntries = await this.retrieveAllACLEntries();
                                        for (const inconsistentUnit of inconsistentUnits) {
                                            let mostRecentAclEntry: any = null;
                                            for (const aclEntry of wholeEntries) {
                                                if ((aclEntry["ip_address"] ?? null) !== (myIp2 ?? null)) {
                                                    if ((/true/i.test(aclEntry["paid"]) == false && /true/i.test(aclEntry["in_progress"]) == false) &&
                                                        inconsistentUnit == aclEntry['unit_id']) {
                                                        mostRecentAclEntry = aclEntry;
                                                    }
                                                }
                                            }
                                            if (mostRecentAclEntry) {
                                                hitAssigned = true;
                                                this.worker.setParameter("token_input", mostRecentAclEntry["token_input"]);
                                                this.worker.setParameter("token_output", mostRecentAclEntry["token_output"]);
                                                this.worker.setParameter("unit_id", mostRecentAclEntry["unit_id"]);
                                                this.worker.setParameter("time_arrival", new Date().toUTCString());

                                                await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_HIT_ASSIGNED_AFTER_INCONSISTENCY_CHECK);
                                            }
                                            if (hitAssigned) break;
                                        }
                                    }
                                }
                            }
                        }

                        /* If we still couldn't assign, persist the overall condition. */
                        if (!hitAssigned) {
                            let hitsStillToComplete = false;
                            /* At least one hit is not marked as (completed/in-progress) → still to complete. */
                            const hits = await this.S3Service.downloadHits(env);
                            for (const h of hits) {
                                if (hitCompletedOrInProgress[h.unit_id] == false) {
                                    hitsStillToComplete = true;
                                    break;
                                }
                            }
                            if (hitsStillToComplete)
                                await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_OVERBOOKING);
                            else
                                await this.dynamoDBService.updateWorkerAcl(env, this.worker, StatusCodes.TASK_COMPLETED_BY_OTHERS);
                        }
                    }

                    /* Load existing data records, configure task, then unlock UI. */
                    this.task.storeDataRecords(await this.retrieveDataRecords());
                    await this.performTaskSetup();
                    this.unlockTask(hitAssigned);

                } else {
                    /* Not allowed to run → show the appropriate branch and stop overlay. */
                    this.unlockTask(false);
                }
            });

        } else {
            /* Task already completed/failed earlier → just unlock to show outcome. */
            this.unlockTask(false);
        }

        /* Ensure change detection picks up the new branch. */
        this.changeDetector.markForCheck();
    }


    /* ------------------------------------------------------
       Scan all ACL entries (paged) and return them ordered
       by time_arrival ascending. Original semantics preserved.
       ------------------------------------------------------ */
    public async retrieveAllACLEntries() {
        /* The whole set of ACL records must be scanned to find the oldest worker that participated in the task but abandoned it */
        const env = this.configService.environment;
        const wholeEntries: any[] = [];

        let page = await this.dynamoDBService.scanACLRecordUnitId(env);
        (page.Items ?? []).forEach(e => wholeEntries.push(e));
        let lastEvaluatedKey = page.LastEvaluatedKey;

        while (typeof lastEvaluatedKey != "undefined") {
            page = await this.dynamoDBService.scanACLRecordUnitId(env, null, lastEvaluatedKey);
            lastEvaluatedKey = page.LastEvaluatedKey;
            (page.Items ?? []).forEach(e => wholeEntries.push(e));
        }

        /* Each ACL record is sorted considering the timestamp, in ascending order */
        wholeEntries.sort((a, b) => {
            const ta = Date.parse(a?.time_arrival ?? "");
            const tb = Date.parse(b?.time_arrival ?? "");
            const na = Number.isFinite(ta) ? ta : 0;
            const nb = Number.isFinite(tb) ? tb : 0;
            return na - nb;
        });

        return wholeEntries;
    }

    /* ------------------------------------------------------
       Return the most recent expiration date among active,
       unpaid entries. Paged scan is used; memory usage is bounded.
       ------------------------------------------------------ */
    public async retrieveMostRecentExpirationDate() {
        let mostRecentExpirationEpoch: number | null = null;
        let mostRecentExpirationISO: string | null = null;
        const env = this.configService.environment;

        const consider = (entry: any) => {
            if (!(entry && entry.in_progress && entry.paid == false)) return;
            const iso = entry.time_expiration as string | undefined;
            if (!iso) return;
            const t = Date.parse(iso);
            if (!Number.isFinite(t)) return;
            if (mostRecentExpirationEpoch === null || t > mostRecentExpirationEpoch) {
                mostRecentExpirationEpoch = t;
                mostRecentExpirationISO = iso;
            }
        };

        let page = await this.dynamoDBService.scanACLRecordUnitId(env);
        (page.Items ?? []).forEach(consider);
        let lastEvaluatedKey = page.LastEvaluatedKey;

        while (typeof lastEvaluatedKey !== "undefined") {
            page = await this.dynamoDBService.scanACLRecordUnitId(env, null, lastEvaluatedKey);
            lastEvaluatedKey = page.LastEvaluatedKey;
            (page.Items ?? []).forEach(consider);
        }

        return mostRecentExpirationISO;
    }

    /*
     * Goal
     * ----
     * Decide whether the current worker is allowed to run the task.
     *
     * Check order (kept consistent with original intent):
     *  1) Previous-batch BLACKLIST (via DynamoDB ACL if available, else S3 identifier list)
     *  2) Previous-batch WHITELIST (can override 1)
     *  3) Current-batch ACL "returning" block (DynamoDB) if settings.block === true
     *  4) Current-batch manual BLACKLIST (S3)
     *  5) Current-batch manual WHITELIST (S3)
     *
     * Key fixes:
     *  - Inline, type-safe IP normalization (no `.ip` on Object error).
     *  - Correctly load previous-batch WHITELIST from S3 `whitelist` (not `blacklist`).
     *  - Exact ACL table name match instead of loose `includes`.
     *  - Robust DynamoDB item IP extraction (DocumentClient vs low-level).
     *  - Parallel S3 reads where independent.
     */
    public async performWorkerStatusCheck() {
        let taskAllowed = true;

        /* Normalize environment and worker IP. */
        const env = this.configService.environment;
        const rawIp: unknown = this.worker.getIP();
        const ip: string | undefined =
            typeof rawIp === 'string'
                ? rawIp
                : (rawIp && typeof rawIp === 'object' && typeof (rawIp as any).ip === 'string'
                    ? (rawIp as any).ip
                    : (rawIp && typeof rawIp === 'object' && typeof (rawIp as any).ipAddress === 'string'
                        ? (rawIp as any).ipAddress
                        : undefined));

        /* Conservative block if IP cannot be determined. */
        if (!ip) {
            this.worker.setParameter('status_code', StatusCodes.WORKER_RETURNING_BLOCK);
            return false;
        }

        /* Read table list and current manual lists in parallel. */
        const [tables, workersManual] = await Promise.all([
            this.dynamoDBService.listTables(env),
            this.S3Service.downloadWorkers(env)
        ]);

        const tableNames: string[] = (tables && (tables as any).TableNames) ? (tables as any).TableNames : [];

        /* Consolidate previous-batch metadata once. */
        const prevBlacklistBatches: string[] = this.worker.settings?.blacklist_batches ?? [];
        const prevWhitelistBatches: string[] = this.worker.settings?.whitelist_batches ?? [];
        const allPrevBatches: string[] = Array.from(new Set([...prevBlacklistBatches, ...prevWhitelistBatches]));

        const prevBatchEntries = await Promise.all(
            allPrevBatches.map(async (batchName) => {
                const parts = (batchName ?? '').split('/');
                const previousTaskName = parts[0];
                const previousBatchName = parts[1];

                const s3Workers = await this.S3Service.downloadWorkers(env, batchName);
                const tableName = previousTaskName && previousBatchName
                    ? tableNames.find(t => t === `${previousTaskName}_${previousBatchName}_ACL`)
                    : undefined;

                const meta: any = {};
                if (tableName) meta.tableName = tableName;
                if (prevBlacklistBatches.includes(batchName)) meta.blacklist = s3Workers?.blacklist ?? [];
                if (prevWhitelistBatches.includes(batchName)) meta.whitelist = s3Workers?.whitelist ?? [];
                return [batchName, meta] as const;
            })
        );
        const batchesStatus = new Map<string, any>(prevBatchEntries);

        /* 1) Previous-batch BLACKLIST. */
        for (const [, meta] of batchesStatus.entries()) {
            if (meta.tableName) {
                const result = await this.dynamoDBService.getACLRecordIpAddress(env, ip, meta.tableName);
                const items: any[] = result?.Items ?? [];
                const match = items.some((it: any) => {
                    const itemIp: string | undefined =
                        (it && typeof it === 'object' && ((it as any).ip_address?.S ?? (it as any).ip_address ?? (it as any).ipAddress?.S ?? (it as any).ipAddress)) as string | undefined;
                    return itemIp === ip;
                });
                if (match) {
                    taskAllowed = false;
                    this.worker.setParameter('status_code', StatusCodes.WORKER_BLACKLIST_PREVIOUS);
                    break;
                }
            }
            if (taskAllowed && Array.isArray(meta.blacklist) && meta.blacklist.includes(this.worker.identifier)) {
                taskAllowed = false;
                this.worker.setParameter('status_code', StatusCodes.WORKER_BLACKLIST_PREVIOUS);
                break;
            }
        }

        /* 2) Previous-batch WHITELIST can override. */
        if (!taskAllowed) {
            for (const [, meta] of batchesStatus.entries()) {
                if (meta.tableName) {
                    const result = await this.dynamoDBService.getACLRecordIpAddress(env, ip, meta.tableName);
                    const items: any[] = result?.Items ?? [];
                    const match = items.some((it: any) => {
                        const itemIp: string | undefined =
                            (it && typeof it === 'object' && ((it as any).ip_address?.S ?? (it as any).ip_address ?? (it as any).ipAddress?.S ?? (it as any).ipAddress)) as string | undefined;
                        return itemIp === ip;
                    });
                    if (match) {
                        taskAllowed = true;
                        this.worker.setParameter('status_code', StatusCodes.WORKER_WHITELIST_PREVIOUS);
                        break;
                    }
                }
                if (!taskAllowed && Array.isArray(meta.whitelist) && meta.whitelist.includes(this.worker.identifier)) {
                    taskAllowed = true;
                    this.worker.setParameter('status_code', StatusCodes.WORKER_WHITELIST_PREVIOUS);
                    break;
                }
            }
        }

        /* 3) Current-batch returning block. */
        if (this.worker.settings?.block) {
            const currentAcl = await this.dynamoDBService.getACLRecordIpAddress(env, ip /* current table inferred */);
            const items: any[] = currentAcl?.Items ?? [];
            const seen = items.some((it: any) => {
                const itemIp: string | undefined =
                    (it && typeof it === 'object' && ((it as any).ip_address?.S ?? (it as any).ip_address ?? (it as any).ipAddress?.S ?? (it as any).ipAddress)) as string | undefined;
                return itemIp === ip;
            });
            if (seen) {
                this.worker.setParameter('status_code', StatusCodes.WORKER_RETURNING_BLOCK);
                return false;
            }
        }

        /* 4) Current-batch manual BLACKLIST. */
        if (workersManual?.blacklist?.includes?.(this.worker.identifier)) {
            this.worker.setParameter('status_code', StatusCodes.WORKER_BLACKLIST_CURRENT);
            return false;
        }

        /* 5) Current-batch manual WHITELIST. */
        if (workersManual?.whitelist?.includes?.(this.worker.identifier)) {
            this.worker.setParameter('status_code', StatusCodes.WORKER_WHITELIST_CURRENT);
            return true;
        }

        return taskAllowed;
    }

    /* ------------------------------------------------------
       Unlock the task based on the status check outcome.
       Stop the global overlay **after paint** from here as a catch-all.
       Stepper/outcome setters will also call it, but it’s idempotent.
       ------------------------------------------------------ */
    public unlockTask(taskAllowed: boolean) {
        this.sectionService.taskAllowed = taskAllowed;
        this.sectionService.checkCompleted = true;

        // Ensure first paint of whichever branch is about to render
        this.changeDetector.markForCheck();
        this.changeDetector.detectChanges?.();

        // Always schedule a stop after paint; safe & idempotent
        this.stopGlobalOnNextPaint();
    }

    /*
     * This function enables the task when the worker clicks on "Proceed" inside the main instructions page.
     */
    public enableTask() {
        /* The main-instructions card is now dismissed */
        this.sectionService.taskInstructionsRead = true;

        /* Update the browser tab title – keeps the original logic */
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

    /*
     *  This function retrieves the hit identified by the validated token input inserted by the current worker and sets the task up accordingly.
     *  Such hit is represented by a Hit object. The task is set up by parsing the hit content as an Array of Document objects.
     *  Therefore, to use a customized the task the Document interface must be adapted to correctly parse each document's field.
     *  The Document interface can be found at this path: ../../../../data/build/task/document.ts
     *
     *  Improvement:
     *  - Direct lookup by unit_id instead of scanning all hits.
     *  - Static assets (questionnaires/instructions/dimensions) are fetched in parallel.
     *  - Arrays are preallocated to reduce churn. Semantics are preserved.
     */
    public async performTaskSetup() {
        /* The token input has been already validated, this is just to be sure */

        this.sectionService.taskStarted = true;

        /* The hits stored on Amazon S3 are retrieved */
        const env = this.configService.environment;
        const hits = await this.S3Service.downloadHits(env);

        /* Scan each entry for the token input → now direct find by unit_id */
        const unitId = this.worker.getParameter('unit_id');
        let currentHit = hits.find(h => h.unit_id === unitId);

        if (!currentHit) {
            /* Defensive guard: assignment became stale or corrupted.
            -> Show Outcome immediately (failed state), no snackbar. */
            this.sectionService.taskFailed = true;
            this.sectionService.taskSuccessful = false;
            this.sectionService.taskCompleted = true;

            /* Force a render so Outcome mounts (and the overlay stops via outcomeSectionSetter) */
            this.changeDetector.markForCheck();
            this.changeDetector.detectChanges();

            return;
        }

        /* If the token input of the current hit matches with the one inserted by the worker the right hit has been found */
        currentHit = currentHit as Hit;
        this.task.tokenInput = currentHit.token_input;
        this.task.tokenOutput = currentHit.token_output;
        this.task.unitId = currentHit.unit_id;
        this.task.documentsAmount = currentHit.documents.length;
        this.task.hit = currentHit;
        /* The array of documents is initialized */
        this.task.initializeDocuments(currentHit.documents, (currentHit as any)["documents_params"]);

        if (this.task.settings.logger_enable)
            this.actionLogger!.unitId = this.task.unitId;

        /* Preallocate document arrays. */
        this.documentsForm = new Array<UntypedFormGroup>(this.task.documentsAmount);
        this.documentsFormsAdditional = Array.from({length: this.task.documentsAmount}, () => []);
        this.searchEngineForms = new Array<Array<UntypedFormGroup>>(this.task.documentsAmount);
        this.resultsRetrievedForms = new Array<Array<Object>>(this.task.documentsAmount);

        /* Static assets are read in parallel. */
        const [questionnaires, instructions, dimensions] = await Promise.all([
            this.S3Service.downloadQuestionnaires(env),
            this.S3Service.downloadEvaluationInstructions(env),
            this.S3Service.downloadDimensions(env)
        ]);
        this.task.initializeQuestionnaires(questionnaires);

        /* A form for each questionnaire is initialized */
        this.questionnairesForm = new Array<UntypedFormGroup>(this.task.questionnaireAmount);

        /* The evaluation instructions stored on Amazon S3 are retrieved */
        this.task.initializeInstructionsEvaluation(instructions);
        this.task.initializeDimensions(dimensions);

        this.task.initializeAccessCounter();
        this.task.initializeTimestamps();
        this.task.initializePostAssessment();

        /* Initial data record is written only once per worker. */
        if (!(this.worker.identifier == null)) {
            if (this.task.dataRecords.length <= 0) {
                const taskInitialPayload = this.task.buildTaskInitialPayload(this.worker);
                await this.dynamoDBService.insertDataRecord(env, this.worker, this.task, taskInitialPayload);
            }
        }

        this.changeDetector.detectChanges();
    }

    public storePositionCurrent(data) {
        this.worker.setParameter("position_current", String(data));
        this.dynamoDBService.insertACLRecordWorkerID(this.configService.environment, this.worker);
    }

    /* #################### LOGGER #################### */

    /* Logging service initialization */
    public initializeLogger(workerIdentifier, taskName, batchName, regionName, http: HttpClient, logOnConsole: boolean) {
        this.actionLogger!.logInit(this.configService.environment.bucket, workerIdentifier, taskName, batchName, regionName, http, logOnConsole);
    }

    /* #################### QUALITY CHECKS #################### */

    public performQualityChecks() {
        /*
         * This section performs the necessary checks to ensure the quality of the worker's output.
         * Three checks are conducted:
         * 1) GLOBAL VALIDITY CHECK (QUESTIONNAIRE + DOCUMENTS)
         * 2) GOLD QUESTION CHECK
         * 3) TIME SPENT CHECK
         */

        /* 1) GLOBAL VALIDITY CHECK performed here */
        const globalValidityCheck = this.performGlobalValidityCheck();

        /* 2) GOLD ELEMENTS CHECK performed here */
        const goldConfiguration = this.task.generateGoldConfiguration(
            this.task.goldDocuments,
            this.task.goldDimensions,
            this.documentsForm,
            this.task.notes
        );
        const goldChecks = GoldChecker.performGoldCheck(goldConfiguration);

        /* 3) TIME SPENT CHECK performed here (centralized in Task) */
        const timeSpentCheck = this.task.timeSpentOk();

        const qualityCheckData = {
            globalOutcome: null as boolean | null,
            globalFormValidity: globalValidityCheck,
            timeSpentCheck: timeSpentCheck,
            goldChecks: goldChecks,
            goldConfiguration: goldConfiguration,
        };

        const checker = (arr: boolean[]) => arr.every(Boolean);
        qualityCheckData.globalOutcome = checker([
            qualityCheckData.globalFormValidity,
            qualityCheckData.timeSpentCheck,
            checker(qualityCheckData.goldChecks),
        ]);

        /* If each check is true, the task is successful; otherwise, the task fails. */
        return qualityCheckData;
    }


    public performGlobalValidityCheck() {
        /* The "valid" flag of each questionnaire or document form must be true to pass this check. */
        let questionnaireFormValidity = true;
        let documentsFormValidity = true;
        for (let index = 0; index < this.questionnairesForm.length; index++) {
            if (this.questionnairesForm[index].valid == false)
                questionnaireFormValidity = false;
        }
        for (let index = 0; index < this.documentsForm.length; index++) {
            let assessmentForm = this.documentsForm[index];
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

    public performReset() {

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

        let jumpIndex = this.computeJumpIndex();
        this.worker.setParameter('position_current', String(jumpIndex));

        /* Force change detection so a valid Stepper ref is ensured */
        this.changeDetector.detectChanges();

        /* Jump straight to the desired step (no intermediate instantiation) */
        this.stepper!.selectedIndex = jumpIndex;
        this.sectionService.stepIndex = jumpIndex;

        /* Store the new start timestamp (initialise array slot on first use) */
        if (!this.task.timestampsStart[jumpIndex]) {
            this.task.timestampsStart[jumpIndex] = [];
        }
        this.task.timestampsStart[jumpIndex].push(Date.now() / 1000);
    }

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

        // Tracks if any previous checks have failed, to restrict how far back the flow can go.
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
                   The jump target must not land on or before this questionnaire. */
                if (!objAllowBack["allow_back"]) {
                    lastLockedQuestionnaireIdx = i;
                }
            } else {
                /* For documents: check validity and time spent. */
                failChecksCurrent =
                    failChecksCurrent ||
                    objFormValidity.valid === false ||
                    this.task.timestampsElapsed[i] < timeCheckAmount[i];
            }
        }

        if (lastLockedQuestionnaireIdx >= 0 && jumpIndex <= lastLockedQuestionnaireIdx) {
            return lastLockedQuestionnaireIdx + 1 < totalSteps ? lastLockedQuestionnaireIdx + 1 : lastLockedQuestionnaireIdx;
        }

        return Math.min(jumpIndex, totalSteps - 1);
    }

    /* ------------------------------------------------------
       Data records retrieval.
       - Paged query by identifier is used (no full-table scan).
       - Entries are filtered by sequence IP match (normalized).
       - Items are parsed incrementally to cap memory usage.
       ------------------------------------------------------ */
    public async retrieveDataRecords() {
        const env = this.configService.environment;
        const out: any[] = [];
        const ip = this.getNormalizedWorkerIp();
        const ipNeedle = ip ?? (this.worker.getIP() as any)?.ip ?? '';

        let page = await this.dynamoDBService.getDataRecord(env, this.worker.identifier);
        for (const it of (page.Items ?? [])) {
            if (this.worker.identifier == it["identifier"] && String(it["sequence"] ?? '').includes(ipNeedle)) {
                try {
                    it["data"] = JSON.parse(it["data"]);
                } catch { /* keep original if parsing fails */
                }
                out.push(it);
            }
        }

        let lastEvaluatedKey = page.LastEvaluatedKey;
        while (typeof lastEvaluatedKey != "undefined") {
            page = await this.dynamoDBService.getDataRecord(env, this.worker.identifier, null, lastEvaluatedKey);
            lastEvaluatedKey = page.LastEvaluatedKey;
            for (const it of (page.Items ?? [])) {
                if (this.worker.identifier == it["identifier"] && String(it["sequence"] ?? '').includes(ipNeedle)) {
                    try {
                        it["data"] = JSON.parse(it["data"]);
                    } catch { /* ignore */
                    }
                    out.push(it);
                }
            }
        }

        return out;
    }

    /* =========================================================
     * Child -> parent questionnaire emit handler
     * - Keeps original behavior: register the form once and
     *   forward any action to produceData(action, stepIndex).
     * - Adds light guards to avoid runtime errors.
     * ========================================================= */
    public storeQuestionnaireForm(data: any, stepIndex: number) {
        try {
            /* Resolve the element metadata; ignore if not a questionnaire */
            const el = this.task.getElementIndex(stepIndex);
            if (!el || el.elementType !== 'Q') return;

            /* Extract payload bits defensively */
            const form = data?.form;
            const action: string | undefined = data?.action;

            /* Ensure the array exists */
            this.questionnairesForm ??= [];

            /* Index of the questionnaire in Task */
            const qIndex: number = el.elementIndex;

            /* Register the form exactly once (first time we see it) */
            if (!this.questionnairesForm[qIndex] && form && typeof form.get === 'function') {
                this.questionnairesForm[qIndex] = form;
            }

            /* Forward action (unchanged semantics) */
            if (action && typeof action === 'string') {
                this.produceData(action, stepIndex);
            }
        } catch (err) {
            /* Fail-soft: ignore malformed emissions but keep the app running */
            console.warn('[storeQuestionnaireForm] skipped due to error:', err);
        }
    }

    /* =========================================================
     * Child -> parent document emit handler
     * - Keeps original behavior:
     *   - store initial form in documentsForm[docIdx] once
     *   - push post/extra forms into documentsFormsAdditional[docIdx]
     *   - call produceData(action, stepIndex) when action is present
     * - Adds null-safety and duplicate-guarding.
     * ========================================================= */
    public storeDocumentForm(data: any, stepIndex: number) {
        try {
            /* Resolve the element metadata; ignore if not a document */
            const el = this.task.getElementIndex(stepIndex);
            if (!el || el.elementType !== 'S') return;

            /* Extract payload defensively */
            const form = data?.form;
            const type = (data?.type ?? 'initial') as 'initial' | 'post';
            const action: string | undefined = data?.action;

            /* Ensure storage arrays exist */
            this.documentsForm ??= [];
            this.documentsFormsAdditional ??= [];

            /* Index of the document in Task */
            const docIdx: number = el.elementIndex;

            /* Ensure nested array for additional/post forms exists */
            this.documentsFormsAdditional[docIdx] ??= [];

            if (type === 'initial' || type == null) {
                /* Register the initial form once */
                if (!this.documentsForm[docIdx] && form && typeof form.get === 'function') {
                    this.documentsForm[docIdx] = form;
                }
            } else {
                /* Append post-assessment forms, avoiding duplicates */
                if (form && typeof form.get === 'function' &&
                    !this.documentsFormsAdditional[docIdx].includes(form)) {
                    this.documentsFormsAdditional[docIdx].push(form);
                }
            }

            /* Forward action (unchanged semantics) */
            if (action && typeof action === 'string') {
                this.produceData(action, stepIndex);
            }
        } catch (err) {
            /* Fail-soft: ignore malformed emissions but keep the app running */
            console.warn('[storeDocumentForm] skipped due to error:', err);
        }
    }

    /* ------------------------------------------------------
     * Outcome comment handler
     * - Marks the UI as sent so the component can disable the input
     * - Persists the comment as a data record (if worker has an id)
     * ------------------------------------------------------ */
    public async storeComment(data: any): Promise<void> {
        /* Update child UI immediately */
        if (this.outcomeSection) {
            this.outcomeSection.commentSent = true;
        }

        /* Best-effort persistence */
        try {
            if (this.worker?.identifier != null) {
                const commentPayload = this.task.buildCommentPayload(data);
                await this.dynamoDBService.insertDataRecord(
                    this.configService.environment,
                    this.worker,
                    this.task,
                    commentPayload
                );
            }
        } catch (err) {
            /* Non-fatal: keep UI responsive even if logging fails */
            console.error('[Skeleton] Failed to store comment:', err);
        }
    }

    /*
     * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
     */
    public async produceData(action: string, completedElement) {
        /* Resolve the current step; if finishing, jump to the last element. */
        let currentElement = this.stepper!.selectedIndex;
        if (action == "Finish")
            currentElement = this.task.getElementsNumber() - 1;

        /* Compute base/overall indices and types. */
        let completedElementBaseIndex = completedElement;
        let currentElementBaseIndex = currentElement;
        let completedElementData = this.task.getElementIndex(completedElement);
        let currentElementData = this.task.getElementIndex(currentElement);
        let completedElementType = completedElementData["elementType"];
        let completedElementIndex = completedElementData["elementIndex"];

        /* Track accesses per element. */
        this.task.elementsAccesses[completedElementBaseIndex] = this.task.elementsAccesses[completedElementBaseIndex] + 1;

        /* Update timestamps and countdowns if configured. */
        this.computeTimestamps(currentElementBaseIndex, completedElementBaseIndex, action);
        if (this.task.hasCountdown()) {
            this.handleCountdowns(currentElementData, completedElementData, action);
        }

        /* Annotator hook for options-type annotator on documents. */
        if (this.task.settings.annotator) {
            if (this.task.settings.annotator.type == "options") {
                if (completedElementType == "S")
                    this.documentComponent?.get(completedElementIndex).annotatorOptions.first?.handleNotes();
            }
        }

        let qualityChecks = null;

        /* Finish branch: run quality checks, set outcome flags, and persist ACL status. */
        if (action == "Finish") {
            await this.withGlobalOverlay(async () => {
                /* Perform all quality checks (global validity + gold + time). */
                qualityChecks = this.performQualityChecks();

                /* Set outcome flags according to checks */
                if (qualityChecks["globalOutcome"]) {
                    this.sectionService.taskSuccessful = true;
                    this.sectionService.taskFailed = false;
                } else {
                    this.sectionService.taskSuccessful = false;
                    this.sectionService.taskFailed = true;
                }

                /* Update ACL row with final status (typed StatusCodes). */
                if (!(this.worker.identifier == null)) {
                    this.worker.setParameter("time_completion", new Date().toUTCString());

                    if (this.sectionService.taskSuccessful) {
                        /* Success → mark paid and not in progress. */
                        this.worker.setParameter("in_progress", String(false));
                        this.worker.setParameter("paid", String(true));
                    } else {
                        /* Failure → increment try counters and compute jump index. */
                        const triesLeft = this.task.settings.allowed_tries - this.task.tryCurrent;
                        this.worker.setParameter("try_left", String(triesLeft));
                        this.worker.setParameter("try_current", String(this.task.tryCurrent));
                        this.worker.setParameter("in_progress", String(true));
                        this.worker.setParameter("paid", String(false));
                        this.worker.setParameter('position_current', String(this.computeJumpIndex()));
                    }

                    /* Single, typed write based on outcome and remaining tries. */
                    const status = this.sectionService.taskSuccessful
                        ? StatusCodes.TASK_SUCCESSFUL
                        : (this.task.settings.allowed_tries - this.task.tryCurrent > 0
                            ? StatusCodes.TASK_FAILED_WITH_TRIES
                            : StatusCodes.TASK_FAILED_NO_TRIES);

                    await this.dynamoDBService.updateWorkerAcl(
                        this.configService.environment,
                        this.worker,
                        status
                    );
                }
            });
        }

        /* Persist questionnaire/document data records and position whenever applicable. */
        if (!(this.worker.identifier == null)) {
            if (completedElementType == "Q") {
                /* Questionnaire payload. */
                let questionnairePayload = this.task.buildTaskQuestionnairePayload(
                    completedElementData,
                    this.questionnairesForm[completedElementIndex].value,
                    action
                );
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, questionnairePayload);
                this.storePositionCurrent(String(currentElement));
            }

            if (completedElementType == "S") {
                /* Document payload (with optional countdown + post forms). */
                let countdown = null;
                if (this.task.settings.countdownTime >= 0)
                    countdown = Math?.round(Number(this.documentComponent?.get(completedElementIndex).countdown.i.value) / 1000);

                let additionalAnswers = {};
                for (let assessmentFormAdditional of this.documentsFormsAdditional[completedElementIndex]) {
                    Object.keys(assessmentFormAdditional.controls)?.forEach(controlName => {
                        additionalAnswers[controlName] = assessmentFormAdditional?.get(controlName).value;
                    });
                }

                let documentPayload = this.task.buildTaskDocumentPayload(
                    completedElementData,
                    this.documentsForm[completedElementIndex].value,
                    additionalAnswers,
                    countdown,
                    action
                );

                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, documentPayload);
                this.storePositionCurrent(String(currentElement));
            }

            if (completedElementBaseIndex == this.task.getElementsNumber() - 1 && action == "Finish") {
                /* Persist the overall quality checks at the very end. */
                const qualityChecksPayload = this.task.buildQualityChecksPayload(qualityChecks);
                await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, qualityChecksPayload);
                this.storePositionCurrent(String(currentElement));
            }
        }

        /* Toggle completion flags and re-render Outcome on finish. */
        if (action == "Finish") {
            this.sectionService.taskCompleted = true;
            this.changeDetector.markForCheck();
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
        };

        if (completedDocumentData.elementType === "S") {
            pauseCountdown(completedDocumentData.elementIndex);
            if (action === "Finish")
                return; // No need to start/resume the countdown if the action is Finish
        }
        if (currentDocumentData.elementType === "S" && !this.task.countdownsExpired[currentDocumentData.elementIndex] && this.task.countdownsStarted[currentDocumentData.elementIndex]) {
            const currentCountdown = getCountdown(currentDocumentData.elementIndex);
            /* Tolerance is added to avoid equality edge cases on begin/resume. */
            const remaining = currentCountdown.i.value / 1000;
            const total = this.task.documentsCountdownTime[currentDocumentData.elementIndex];
            const nearStart = Math.abs(remaining - total) <= 0.25; // ~250ms tolerance
            if (nearStart) currentCountdown.begin();
            else currentCountdown.resume();
        }
    }

    public showSnackbar(message, action, duration) {
        this.snackBar.open(message, action, {
            duration: duration,
        });
    }

    /* ------------------------------------------------------
       Global loader stop (idempotent).
       - Double rAF: stop after layout & paint of the new branch.
       - Drain a few times in case upstream incremented multiple times.
       ------------------------------------------------------ */
    private stopGlobalOnNextPaint(): void {
        if (this.overlayStopped) return;
        const stop = () => {
            for (let i = 0; i < 3; i++) {
                try {
                    this.ngx.stopLoader('global');
                } catch {
                    break;
                }
            }
            this.overlayStopped = true;
        };
        requestAnimationFrame(() => requestAnimationFrame(stop));
    }

    /** Runs async work under the global overlay. Always stops it (finally). */
    private async withGlobalOverlay<T>(work: () => Promise<T>): Promise<T> {
        /* Start overlay (named instance kept consistent with other calls) */
        try {
            this.ngx.startLoader('global');
        } catch {
            this.ngx.start?.();
        }

        try {
            return await work();
        } finally {
            /* Always stop, even if the task throws */
            try {
                this.ngx.stopLoader('global');
            } catch {
                this.ngx.stop?.();
            }
        }
    }

}
