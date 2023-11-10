/* Core modules */
import {ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, QueryList, ViewChildren} from "@angular/core";
import {fromEvent, of, takeUntil} from "rxjs";
import {catchError, debounceTime, map, tap} from "rxjs/operators";
/* Loading screen module */
import {NgxUiLoaderService} from "ngx-ui-loader";
/* Material design modules */
import {MatPaginator} from "@angular/material/paginator";
/* Reactive forms modules */
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators,} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../../../services/config.service";
import {CookieService} from 'ngx-cookie-service';
import {S3Service} from "../../../../../../services/aws/s3.service";
import {BingService} from "../../../../../../services/searchEngine/bing.service";
import {BingWebSearchResponse} from "../../../../../../models/searchEngine/bingWebSearchResponse";
import {PubmedService} from "../../../../../../services/searchEngine/pudmed.service";
import {PubmedSearchResponse} from "../../../../../../models/searchEngine/pubmedSearchResponse";
import {PubmedSummaryResponse} from "../../../../../../models/searchEngine/pubmedSummaryResponse";
import {FakerService} from "../../../../../../services/searchEngine/faker.service";
import {FakeSearchResponse} from "../../../../../../models/searchEngine/fakeSearchResponse";
/* Models */
import {Task} from "../../../../../../models/skeleton/task";
import {Worker} from "../../../../../../models/worker/worker";
import {SearchEngineSettings} from "../../../../../../models/searchEngine/searchEngineSettings";
import {CustomDataSource} from '../../../../../../models/searchEngine/customDataSource';
import {BaseResponse} from "../../../../../../models/searchEngine/baseResponse";

/* Component HTML Tag definition */
@Component({
    selector: "app-search-engine-body",
    templateUrl: "./search-engine-body.component.html",
    styleUrls: ["./search-engine-body.component.scss"],
})

/*
 * This class implements a custom search engine which can be used within crowdsourcing tasks.
 */
export class SearchEngineBodyComponent implements OnInit {
    /* |--------- SEARCH ENGINE SETTINGS - DECLARATION ---------| */

    /* Microsoft Search API key */
    bingApiKey: string;

    /* Pubmed free API key */
    pubmedApiKey: string

    /*
     * Object to wrap search engine settings
     * source: possible values are "BingWebSearch", "PubmedSearch", "FakerWebSearch"
     * domainsToFilter: array of domains to filter out from search results
     */
    settings: SearchEngineSettings;

    /* Loading screen service */
    ngxService: NgxUiLoaderService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Cookie handling service */
    cookieService: CookieService
    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Implementation to query Bing Web Search (Service + REST Interface)*/
    bingService: BingService;
    bingWebSearchResponse: BingWebSearchResponse;

    /* Implementation to query fakeJSON (Service + REST Interface)*/
    fakerService: FakerService;
    fakerSearchResponse: Array<FakeSearchResponse>;

    /* Implementation to query Pubmed (Service + REST Interface)*/
    pubmedService: PubmedService;
    pubmedSearchResponse: PubmedSearchResponse;

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

    /* Data source */
    dataSource: CustomDataSource;
    displayedColumns = ["name"];

    /* Boolean flag */
    searchPerformed: boolean;

    /* Stored query text */
    queryValue: string;

    /* Event emitters */
    /* EMITTER: Query inserted by user */
    @Output() queryEmitter = new EventEmitter<Object>();
    /* EMITTER: Responses retrieved by search engine */
    @Output() resultEmitter = new EventEmitter<Object>();
    /* EMITTER: Response selected by user */
    @Output() selectedRowEmitter = new EventEmitter<Object>();

    @Input() task: Task;
    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() dimensionIndex: number;
    @Input() resultsRetrievedForms: Array<Array<Object>>;

    @Input() resetEvent: EventEmitter<void>;
    @Input() disableEvent: EventEmitter<boolean>;

    /* Data and search parameters */
    estimatedMatches = 0;
    resultsAmount = 0;
    searchAmount = 0;
    baseResponses: Array<BaseResponse> = []

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
        this.changeDetector = changeDetector;
        this.ngxService = ngxService;
        this.S3Service = S3Service;
        this.bingService = bingService;
        this.fakerService = fakerService;
        this.pubmedService = pubmedService;
        this.configService = configService;
        this.formBuilder = formBuilder;
        this.cookieService = cookieService;

        this.searchStarted = true;
        this.searchInProgress = false;

        this.bingApiKey = this.configService.environment.bing_api_key;
        this.pubmedApiKey = this.configService.environment.pubmed_api_key;

        if (this.configService.environment.production)
            this.bingService.endPoint = `${this.configService.environment.api_gateway_endpoint}/bing`
    }

    ngOnInit() {

        this.settings = this.task.searchEngineSettings

        /* This header must be restored from cookies and attached to each request sent to Bing API*/
        let msClientIdName = 'MSEdge-ClientID'
        if (this.checkCookie(msClientIdName))
            this.bingService.msEdgeClientID = this.loadCookie(msClientIdName)

        switch (this.settings.source) {
            case 'BingWebSearch':
                this.searchAmount = this.bingService.SEARCH_AMOUNT
                this.dataSource = new CustomDataSource((query = this.queryValue, resultsToSkip, querySentByUser = false) => {
                    let resultSliceStart = (this.paginator.pageIndex) * this.paginator.pageSize
                    let resultSliceEnd = resultSliceStart + this.paginator.pageSize
                    if (querySentByUser || resultSliceEnd > this.resultsAmount || this.resultsAmount == 0) {
                        if (querySentByUser) {
                            /* EMITTER: The user query is emitted to provide it to an eventual parent component, when the query is sent manually */
                            this.queryEmitter.emit({
                                "text": this.queryValue,
                                "encoded": encodeURIComponent(this.queryValue)
                            });
                            this.baseResponses = []
                        }
                        this.ngxService.startBackgroundLoader('search-loader');
                        this.searchInProgress = true
                        return this.bingService.performWebSearch(this.bingApiKey, encodeURIComponent(query), resultsToSkip).pipe(
                            map((searchResponse) => {
                                if (!this.checkCookie(msClientIdName)) {
                                    const expireDate = new Date();
                                    /* Set the cookie to expire in 1 year */
                                    expireDate.setDate(expireDate.getDate() + 365);
                                    this.storeCookie(msClientIdName, this.bingService.msEdgeClientID, expireDate)
                                }
                                /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                                this.bingWebSearchResponse = this.bingService.filterResponse(searchResponse, this.settings.domains_filter);
                                this.estimatedMatches = searchResponse.webPages.totalEstimatedMatches
                                let decodedResponses = this.bingService.decodeResponse(this.bingWebSearchResponse)
                                this.baseResponses = this.baseResponses.concat(decodedResponses)
                                this.resultsAmount = this.baseResponses.length
                                /* EMITTER: The matching response is emitted to provide it to the parent component*/
                                /* Page index and size refer to the results available before the current query */
                                this.resultEmitter.emit({
                                    "decodedResponses": decodedResponses,
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": decodedResponses.length,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                });
                                this.searchInProgress = false;
                                this.ngxService.stopBackgroundLoader('search-loader')
                                return this.baseResponses.slice(resultSliceStart, resultSliceEnd);
                            }),
                            catchError((error) => {
                                console.log(error)
                                this.searchInProgress = false;
                                this.estimatedMatches = 0
                                this.resultEmitter.emit({
                                    "decodedResponses": [],
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": 0,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                })
                                this.ngxService.stopBackgroundLoader('search-loader')
                                /* Return an empty array in case of error */
                                return of([]);
                            })
                        )
                    } else {
                        /* Return the current "slice" of paginated results */
                        return of(this.baseResponses.slice(resultSliceStart, resultSliceEnd));
                    }
                });
                break;

            case 'PubmedSearch':
                this.searchAmount = this.pubmedService.SEARCH_AMOUNT
                this.dataSource = new CustomDataSource((query = this.queryValue, resultsToSkip, querySentByUser = false) => {
                    let resultSliceStart = (this.paginator.pageIndex) * this.paginator.pageSize
                    let resultSliceEnd = resultSliceStart + this.paginator.pageSize
                    if (querySentByUser || resultSliceEnd > this.resultsAmount || this.resultsAmount == 0) {
                        if (querySentByUser) {
                            this.queryEmitter.emit({
                                "text": this.queryValue,
                                "encoded": encodeURIComponent(this.queryValue)
                            });
                            this.baseResponses = []
                        }
                        this.ngxService.startBackgroundLoader('search-loader');
                        this.searchInProgress = true
                        return this.pubmedService.performWebSearch(this.pubmedApiKey, encodeURIComponent(query), resultsToSkip).pipe(
                            map((searchResponse) => {
                                this.pubmedSearchResponse = searchResponse['firstRequestData']
                                this.estimatedMatches = this.pubmedSearchResponse.esearchresult.count
                                let decodedResponses = this.pubmedService.decodeResponse(searchResponse['additionalResponses'])
                                this.baseResponses = this.baseResponses.concat(decodedResponses)
                                this.resultsAmount = this.baseResponses.length
                                this.resultEmitter.emit({
                                    "decodedResponses": decodedResponses,
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": decodedResponses.length,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                });
                                this.searchInProgress = false;
                                this.ngxService.stopBackgroundLoader('search-loader')
                                return this.baseResponses.slice(resultSliceStart, resultSliceEnd);
                            }),
                            catchError((error) => {
                                console.log(error)
                                this.searchInProgress = false;
                                this.estimatedMatches = 0
                                this.resultEmitter.emit({
                                    "decodedResponses": [],
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": 0,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                })
                                this.ngxService.stopBackgroundLoader('search-loader')
                                return of([]);
                            })
                        )
                    } else {
                        return of(this.baseResponses.slice(resultSliceStart, resultSliceEnd));
                    }
                });
                break;

            case 'FakerWebSearch':
                this.searchAmount = this.fakerService.SEARCH_AMOUNT
                this.dataSource = new CustomDataSource((query = this.queryValue, resultsToSkip, querySentByUser = false) => {
                    let resultSliceStart = (this.paginator.pageIndex) * this.paginator.pageSize
                    let resultSliceEnd = resultSliceStart + this.paginator.pageSize
                    if (querySentByUser || resultSliceEnd > this.resultsAmount || this.resultsAmount == 0) {
                        if (querySentByUser) {
                            this.queryEmitter.emit({
                                "text": this.queryValue,
                                "encoded": encodeURIComponent(this.queryValue)
                            });
                            this.baseResponses = []
                        }
                        this.ngxService.startBackgroundLoader('search-loader');
                        this.searchInProgress = true
                        return this.fakerService.performWebSearch(encodeURIComponent(query)).pipe(
                            map((searchResponses) => {
                                let decodedResponses = this.fakerService.decodeResponse(searchResponses)
                                this.estimatedMatches = decodedResponses.length
                                this.resultEmitter.emit({
                                    "decodedResponses": decodedResponses,
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": decodedResponses.length,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                });
                                this.baseResponses = this.baseResponses.concat(decodedResponses)
                                this.resultsAmount = this.baseResponses.length
                                this.searchInProgress = false;
                                this.ngxService.stopBackgroundLoader('search-loader')
                                return this.baseResponses.slice(resultSliceStart, resultSliceEnd);
                            }),
                            catchError((error) => {
                                console.log(error)
                                this.estimatedMatches = 0
                                this.searchInProgress = false;
                                this.resultEmitter.emit({
                                    "decodedResponses": [],
                                    "estimatedMatches": this.estimatedMatches,
                                    "resultsRetrieved": 0,
                                    "resultsToSkip": resultsToSkip,
                                    "resultsAmount": this.resultsAmount,
                                    "pageIndex": this.paginator.pageIndex,
                                    "pageSize": this.paginator.pageSize,
                                })
                                this.ngxService.stopBackgroundLoader('search-loader')
                                return of([]);
                            })
                        )
                    } else {
                        return of(this.baseResponses.slice(resultSliceStart, resultSliceEnd));
                    }
                });
                break;
        }

        if (!this.resultsRetrievedForms[this.documentIndex] || !this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]) {
            /* The form control for user query is initialized and bound with its synchronous validator(s) */
            this.query = new UntypedFormControl("", [Validators.required]);
            this.urls = new UntypedFormControl("", [Validators.required]);
            /* The search form is initialized by adding each form control */
            this.searchForm = this.formBuilder.group({
                query: this.query,
                urls: this.urls,
            });
            if (!this.resultsRetrievedForms[this.documentIndex]) this.resultsRetrievedForms[this.documentIndex] = []
            if (!this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]) this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex] = {}
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["form"] = this.searchForm
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"] = 10
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"] = 0
        } else {
            this.query = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["form"].controls["query"]
            this.urls = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["form"].controls["urls"]
            this.searchForm = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["form"]
            this.queryValue = this.searchForm.value["query"]
            this.performWebSearch()
        }
        if (this.task.settings.modality == "conversational") {
            this.resetEvent.subscribe(() => this.resetSearchEngineState());
            this.disableSearchEngine(true);
            this.disableEvent.subscribe((disable: boolean) =>
                this.disableSearchEngine(disable)
            );
        }
        /* Useful properties that can be sent to Bing API for improving the search experience */
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
                    if (this.queryValue && this.estimatedMatches > this.searchAmount) {
                        this.dataSource.loadData(this.queryValue, this.resultsAmount, false)
                        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"] = pageEvent.pageSize
                        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"] = pageEvent.pageIndex
                    }
                })
            )
            .subscribe();
        if (this.resultsRetrievedForms[this.documentIndex] && this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]) {
            this.paginator.pageSize = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"]
            this.paginator.pageIndex = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"]
        }
    }

    public saveQueryText(query: string) {
        this.queryValue = query;
    }

    /*
     * This function uses the text received as a parameter to perform a request using the chosen service.
     */
    public performWebSearch() {
        if (this.queryValue.length > 0) {
            this.dataSource.loadData(this.queryValue, this.resultsAmount, true)
        }
    }

    public storeCookie(identifier: string, value: string, expireDate: Date) {
        this.cookieService.set(identifier, value, expireDate, '/'); // Last parameter '/' is the path of the cookie
    }

    /* This function trigger an emitter when the user selects one the result shown on the interface */
    /* EMITTER: The response item clicked by user is emitted to provide it to an eventual parent component */
    public selectRow(response: BaseResponse) {
        this.selectedRowEmitter.emit(response);
    }

    public checkCookie(identifier: string) {
        return this.cookieService.check(identifier);
    }

    public loadCookie(identifier: string) {
        return this.cookieService.get(identifier);
    }

    /* UTF-8 URL decode for special characters in URL */
    public decodeURI(uri: string): string {
        return decodeURIComponent(uri);
    }

    /* Timeout setting */
    public delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private resetSearchEngineState() {
        this.searchForm.reset();
        this.estimatedMatches = 0;
    }

    private disableSearchEngine(disable: boolean) {
        this.searchInProgress = false;
        disable ? this.searchForm.disable() : this.searchForm.enable();
    }
}
