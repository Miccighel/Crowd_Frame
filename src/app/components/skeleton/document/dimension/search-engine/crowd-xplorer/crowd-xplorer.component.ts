/* Core modules */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild,} from "@angular/core";
/* Loading screen module */
import {NgxUiLoaderService} from "ngx-ui-loader";
/* Material design modules */
import {MatPaginator} from "@angular/material/paginator";
/* Reactive forms modules */
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators,} from "@angular/forms";
/* Services */
import {BingService} from "../../../../../../services/search_engine/bing.service";
import {BingWebSearchResponse} from "../../../../../../models/search_engine/bingWebSearchResponse";
import {FakerService} from "../../../../../../services/search_engine/faker.service";
import {FakerSearchResponse} from "../../../../../../models/search_engine/fakerSearchResponse";
import {PubmedService} from "../../../../../../services/search_engine/pudmed.service";
import {PubmedSearchResponse} from "../../../../../../models/search_engine/pubmedSearchResponse";
import {PubmedSummaryResponse} from "../../../../../../models/search_engine/pubmedSummaryResponse";
import {ConfigService} from "../../../../../../services/config.service";
import {SearchEngineSettings} from "../../../../../../models/search_engine/searchEngineSettings";
import {CookieService} from 'ngx-cookie-service';
/* Debug config import */
import {S3Service} from "../../../../../../services/aws/s3.service";
import {Task} from "../../../../../../models/skeleton/task";

import {BingDataSource} from '../../../../../../models/search_engine/bingDataSource';
import {of} from "rxjs";
import {catchError, map, tap} from "rxjs/operators";
import {Worker} from "../../../../../../models/worker/worker";

/* Component HTML Tag definition */
@Component({
    selector: "app-crowd-xplorer",
    templateUrl: "./crowd-xplorer.component.html",
    styleUrls: ["./crowd-xplorer.component.scss"],
})

/*
 * This class implements a custom search engine which can be used for Crowdsourcing tasks.
 */
export class CrowdXplorer implements OnInit {
    /* |--------- SEARCH ENGINE SETTINGS - DECLARATION ---------| */

    /* Microsoft Search API key */
    bingApiKey: string;

    /* fakeJSON token */
    fakeJSONToken: string;

    /*
     * Service to query:
     * Possible values are "BingWebSearch", "PubmedSearch", "FakerSearch"
     */
    source: string;

    /*
     * Array of domains to filter out from search results
     */
    domainsToFilter: Array<string>;

    /*
     * Object to wrap search engine settings
     */
    settings: SearchEngineSettings;

    /* |--------- SERVICES & CO. - DECLARATION ---------| */

    /* Loading screen service */
    ngxService: NgxUiLoaderService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;
    cookieService: CookieService

    /* Implementation to query Bing Web Search (Service + REST Interface)*/
    bingService: BingService;
    bingWebSearchResponse: BingWebSearchResponse;

    /* Implementation to query fakeJSON (Service + REST Interface)*/
    fakerService: FakerService;
    fakerSearchResponse: Array<FakerSearchResponse>;

    /* Implementation to query Pubmed (Service + REST Interface)*/
    pubmedService: PubmedService;
    pubmedSearchResponse: PubmedSearchResponse;
    pubmedSummaryResponse: PubmedSummaryResponse;

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

    /* Search form UI controls */
    searchForm: UntypedFormGroup;
    searchStarted: boolean;
    searchInProgress: boolean;
    query: UntypedFormControl;
    urls: UntypedFormControl;
    @ViewChild(MatPaginator) paginator: MatPaginator;

    /* Boolean flag */
    searchPerformed: boolean;

    queryValue: string;

    /* Event emitters to integrate in other components */
    /* EMITTER: Query inserted by user */
    @Output() queryEmitter = new EventEmitter<string>();
    /* EMITTER: Responses retrieved by search engine */
    @Output() resultEmitter = new EventEmitter<Object>();
    /* EMITTER: Response selected by user */
    @Output() selectedRowEmitter = new EventEmitter<Object>();

    @Input() task: Task;
    @Input() worker: Worker;
    @Input() documentIndex: number;

    @Input() resetEvent: EventEmitter<void>;
    @Input() disableEvent: EventEmitter<boolean>;

    /* Search results table UI variables and controls */
    resultsAmount = 0;
    resultsCurrentOffset = 0
    bingDataSource: BingDataSource;
    // TODO: We must implement a PubMed data source
    displayedColumns = ["name"];

    resultsOffset = 0;

    /* Random digits to generate unique CSS ids when multiple instances of the search engine are used */
    digits: string;

    //Screen dimension flag
    isSmallScreen = false;

    /* |--------- CONSTRUCTOR IMPLEMENTATION ---------| */

    constructor(
        changeDetector: ChangeDetectorRef,
        ngxService: NgxUiLoaderService,
        S3Service: S3Service,
        bingService: BingService,
        fakerService: FakerService,
        pubmedService: PubmedService,
        configService: ConfigService,
        formBuilder: UntypedFormBuilder,
        cookieService: CookieService
    ) {
        /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

        /* Service initialization */
        this.changeDetector = changeDetector;
        this.ngxService = ngxService;
        this.S3Service = S3Service;
        this.bingService = bingService;
        this.fakerService = fakerService;
        this.pubmedService = pubmedService;
        this.configService = configService;
        this.formBuilder = formBuilder;
        this.cookieService = cookieService;

        /* |--------- CONTROL FLOW & UI ELEMENTS - INITIALIZATION ---------| */

        /* Control booleans */
        this.searchStarted = true;
        this.searchInProgress = false;

        /* The random digits for the current instances are generated */
        this.digits = this.randomDigits();

        /* |--------- SEARCH ENGINE SETTINGS - INITIALIZATION ---------| */

        this.bingApiKey = this.configService.environment.bing_api_key;
        this.fakeJSONToken = this.configService.environment.fake_json_token;
        this.loadSettings();

        /* The form control for user query is initialized and bound with its synchronous validator(s) */
        this.query = new UntypedFormControl("", [Validators.required]);
        this.urls = new UntypedFormControl("", [Validators.required]);
        /* The search form is initialized by adding each form control */
        this.searchForm = formBuilder.group({
            query: this.query,
            urls: this.urls,
        });

        let msClientIdName = 'MSEdge-ClientID'
        if (this.checkCookie(msClientIdName)) {
            this.bingService.msEdgeClientID = this.loadCookie(msClientIdName)
        }

        this.bingDataSource = new BingDataSource((query = this.queryValue, resultsAmount, resultsToSkip) => {
            this.ngxService.startBackgroundLoader('skeleton-inner');
            let res = this.bingService.performWebSearch(this.bingApiKey, query, resultsAmount, resultsToSkip).pipe(
                map((searchResponse) => {
                    if (!this.checkCookie(msClientIdName)) {
                        const expireDate = new Date();
                        expireDate.setDate(expireDate.getDate() + 365); // Set the cookie to expire in 1 year
                        this.storeCookie(msClientIdName, this.bingService.msEdgeClientID, expireDate)
                    }
                    this.resultsAmount = searchResponse.webPages.totalEstimatedMatches
                    this.bingWebSearchResponse = this.bingService.filterResponse(searchResponse, this.domainsToFilter);
                    let decodedResponse = this.bingService.decodeResponse(this.bingWebSearchResponse);
                    /* EMITTER: The matching response is emitted to provide it to an eventual parent component*/
                    this.resultEmitter.emit(decodedResponse);
                    /* The results amount is saved*/
                    return decodedResponse;
                }),
                catchError((error) => {
                    this.resultsAmount = 0
                    return of([]); /* Return an empty array in case of error */
                })
            )
            this.ngxService.stopBackgroundLoader('skeleton-inner')
            return res
        });

    }

    ngOnInit() {
        if (this.task.settings.modality == "conversational") {
            this.resetEvent.subscribe(() => this.resetSearchEngineState());
            this.disableSearchEngine(true);
            this.disableEvent.subscribe((disable: boolean) =>
                this.disableSearchEngine(disable)
            );
        }
        if (this.worker.getIP()['ip'])
            this.bingService.ipAddress = this.worker.getIP()['ip']
        if (this.worker.latitude)
            this.bingService.latitude = this.worker.latitude
        if (this.worker.longitude)
            this.bingService.longitude = this.worker.longitude
        if (this.worker.accuracy)
            this.bingService.accuracy = this.worker.accuracy
        if (this.worker.altitude)
            this.bingService.altitude = this.worker.altitude
        if (this.worker.altitudeAccuracy)
            this.bingService.altitude = this.worker.altitudeAccuracy
    }

    ngAfterViewInit() {
        this.paginator.page
            .pipe(
                tap(pageEvent => {
                    this.bingDataSource.loadData(this.queryValue, pageEvent.pageSize, pageEvent.pageIndex * pageEvent.pageSize)
                })
            )
            .subscribe();
    }

    /*
     * This function interacts with an Amazon S3 bucket to retrieve and initialize the settings for the search engine.
     */
    public async loadSettings() {
        let rawSettings = await this.S3Service.downloadSearchEngineSettings(
            this.configService.environment
        );
        this.settings = new SearchEngineSettings(rawSettings);
        this.source = this.settings.source;
        this.domainsToFilter = this.settings.domains_filter;
    }

    /* |--------- WEB SEARCH ---------| */

    public saveQueryText(query: string) {
        this.queryValue = query;
    }

    public storeCookie(identifier: string, value: string, expireDate: Date) {
        this.cookieService.set(identifier, value, expireDate, '/'); // Last parameter '/' is the path of the cookie
    }

    public checkCookie(identifier: string) {
        return this.cookieService.check(identifier);
    }

    public loadCookie(identifier: string) {
        return this.cookieService.get(identifier);
    }

    /*
     * This function uses the text received as a parameter to perform a request using the chosen service.
     */
    public performWebSearch() {

        if (this.queryValue.length > 0) {
            /* The loading screen is shown */

            /* A search has been started */
            this.searchInProgress = true;

            /* EMITTER: The user query is emitted to provide it to an eventual parent component, only when the websearch is triggered */
            this.queryEmitter.emit(this.queryValue);

            switch (this.source) {
                /* The search operation for Bing Web Search is performed */
                case "BingWebSearch": {
                    this.bingDataSource.loadData(this.queryValue, this.paginator.pageIndex, this.paginator.pageSize)
                    this.searchInProgress = false;
                    break;
                }
            }
        }
    }

    /* This function trigger an emitter when the user selects one the result shown on the interface */

    /* EMITTER: The result item clicked by user is emitted to provide it to an eventual parent component */
    public selectRow(row: Object) {
        this.selectedRowEmitter.emit(row);
    }

    /* |--------- OTHER AMENITIES ---------| */

    /* UTF8 URL decode for special characters in URL */
    public decodeURI(uri: string): string {
        return decodeURIComponent(uri);
    }

    /* Random digits generation */
    public randomDigits(): string {
        let array = Array.from({length: 10}, () =>
            Math.floor(Math.random() * (1000 - 1 + 1) + 1)
        );
        return array.join("");
    }

    /* Timeout setting */
    public delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private resetSearchEngineState() {
        this.searchForm.reset();
        this.resultsAmount = 0;
    }

    private disableSearchEngine(disable: boolean) {
        this.searchInProgress = false;
        disable ? this.searchForm.disable() : this.searchForm.enable();
    }
}
