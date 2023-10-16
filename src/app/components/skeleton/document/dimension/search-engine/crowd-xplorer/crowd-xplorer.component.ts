/* Core modules */
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    Output,
    ViewChild,
    OnInit,
    OnDestroy,
    HostListener,
} from "@angular/core";
/* Loading screen module */
import { NgxUiLoaderService } from "ngx-ui-loader";
/* Material design modules */
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
/* Reactive forms modules */
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
/* Services */
import { BingService } from "../../../../../../services/search_engine/bing.service";
import { BingWebSearchResponse } from "../../../../../../models/search_engine/bingWebSearchResponse";
import { FakerService } from "../../../../../../services/search_engine/faker.service";
import { FakerSearchResponse } from "../../../../../../models/search_engine/fakerSearchResponse";
import { PubmedService } from "../../../../../../services/search_engine/pudmed.service";
import { PubmedSearchResponse } from "../../../../../../models/search_engine/pubmedSearchResponse";
import { PubmedSummaryResponse } from "../../../../../../models/search_engine/pubmedSummaryResponse";
import { ConfigService } from "../../../../../../services/config.service";
import { SearchEngineSettings } from "../../../../../../models/search_engine/searchEngineSettings";
/* Debug config import */
import { S3Service } from "../../../../../../services/aws/s3.service";
import { Task } from "../../../../../../models/skeleton/task";

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
    @Input() documentIndex: number;

    @Input() resetEvent: EventEmitter<void>;
    @Input() disableEvent: EventEmitter<boolean>;

    /* Search results table UI variables and controls */
    resultsAmount = 0;
    resultsFound = false;
    resultPageSize = 10;
    resultPageSizeOptions = [5, 10, 15, 20];
    dataSource = new MatTableDataSource<any>();
    displayedColumns = ["name"];
    paginator: MatPaginator;

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
        formBuilder: UntypedFormBuilder
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
    }

    ngOnInit() {
        if (this.task.settings.modality == "conversational") {
            this.resetEvent.subscribe(() => this.resetSearchEngineState());
            this.disableSearchEngine(true);
            this.disableEvent.subscribe((disable: boolean) =>
                this.disableSearchEngine(disable)
            );
        }
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

    /*
     * This function uses the text received as a parameter to perform a request using the chosen service.
     */
    public performWebSearch() {

        if (this.queryValue.length > 0) {
            /* The loading screen is shown */
            this.ngxService.startBackground();

            /* A search has been started */
            this.searchInProgress = true;

            /* EMITTER: The user query is emitted to provide it to an eventual parent component, only when the websearch is triggered */
            this.queryEmitter.emit(this.queryValue);

            switch (this.source) {
                /* The search operation for Bing Web Search is performed */
                /* This is done by subscribing to an Observable of <BingWebSearchResponse> items */
                case "BingWebSearch": {
                    this.bingService
                        .performWebSearch(this.bingApiKey, this.queryValue)
                        .subscribe((searchResponse) => {
                            /* We are interested in parsing the webPages property of a <BingWebSearchResponse> */
                            if (searchResponse.hasOwnProperty("webPages")) {
                                /* Some results exist */
                                this.resultsFound = true;
                                /* The matching response is saved and filtered if the environment variable is not an empty array */
                                this.bingWebSearchResponse =
                                    this.bingService.filterResponse(
                                        searchResponse,
                                        this.domainsToFilter
                                    );
                                let decodedResponse =
                                    this.bingService.decodeResponse(
                                        this.bingWebSearchResponse
                                    );
                                /* EMITTER: The matching response is emitted to provide it to an eventual parent component*/
                                this.resultEmitter.emit(decodedResponse);
                                /* The results amount is saved*/
                                this.resultsAmount = decodedResponse.length;
                                /* Each <webPage> item is saved into results table */
                                this.dataSource.data = decodedResponse;
                            } else {
                                /* There are not any result */
                                this.resultEmitter.emit([]);
                                this.resultsFound = false;
                                this.resultsAmount = 0;
                                this.dataSource.data = [];
                            }
                            this.searchInProgress = false;
                            /* The loading screen is hidden */
                            this.ngxService.stopBackground();
                        });
                    break;
                }
                case "FakerWebSearch": {
                    this.fakerService
                        .performWebSearch(this.fakeJSONToken, this.queryValue)
                        .subscribe((searchResponse) => {
                            /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                            if (searchResponse.length > 0) {
                                /* Some results exist */
                                this.resultsFound = true;
                                /* The matching response is saved */
                                this.fakerSearchResponse = searchResponse;
                                let decodedResponse =
                                    this.fakerService.decodeResponse(
                                        searchResponse
                                    );
                                /* EMITTER: The matching response is emitted to provide it to an eventual parent component*/
                                this.resultEmitter.emit(decodedResponse);
                                /* The results amount is saved*/
                                this.resultsAmount = decodedResponse.length;
                                /* Each <webPage> item is saved into results table */
                                this.dataSource.data = decodedResponse;
                            } else {
                                /* There are not any result */
                                this.resultEmitter.emit([]);
                                this.resultsFound = false;
                                this.resultsAmount = 0;
                                this.dataSource.data = [];
                            }

                            this.searchInProgress = false;
                            /* The loading screen is hidden */
                            this.ngxService.stopBackground();
                        });
                    break;
                }
                case "PubmedSearch": {
                    this.pubmedService
                        .performWebSearch(this.queryValue)
                        .subscribe(async (searchResponse) => {
                            /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                            if (
                                searchResponse.esearchresult.idlist.length > 0
                            ) {
                                /* The matching response is saved */
                                this.pubmedSearchResponse = searchResponse;
                                /* EMITTER: The matching response is emitted to provide it to an eventual parent component*/
                                //this.resultEmitter.emit(this.pubmedSearchResponse);
                                let decodedResponses = [];
                                for (let index in this.pubmedSearchResponse
                                    .esearchresult.idlist) {
                                    let articleId =
                                        this.pubmedSearchResponse.esearchresult
                                            .idlist[index];
                                    this.pubmedService
                                        .retrieveArticle(articleId)
                                        .subscribe((summaryResponse) => {
                                            this.pubmedSummaryResponse =
                                                summaryResponse;
                                            decodedResponses.push(
                                                this.pubmedService.decodeResponse(
                                                    summaryResponse
                                                )
                                            );
                                        });
                                    /* Some results exist */
                                    this.resultsFound = true;
                                    /* The results amount is saved*/
                                    this.resultsAmount =
                                        decodedResponses.length;
                                    /* Each <webPage> item is saved into results table */
                                    this.dataSource.data = decodedResponses;
                                    await this.delay(750);
                                }
                                this.resultEmitter.emit(decodedResponses);
                            } else {
                                /* There are not any result */
                                this.resultEmitter.emit([]);
                                this.resultsFound = false;
                                this.resultsAmount = 0;
                                this.dataSource.data = [];
                            }
                            /* The search operation for Bing Web Search is completed */
                            this.searchPerformed = true;
                            /* The loading screen is hidden */
                            this.searchInProgress = false;
                            this.ngxService.stopBackground();
                        });
                    break;
                }
            }
        }
    }

    /* VIEWCHILD: A reference to a mat-paginator html element is created and bound with the result table */
    @ViewChild(MatPaginator) set matPaginator(matPaginator: MatPaginator) {
        this.dataSource.paginator = matPaginator;
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
        let array = Array.from({ length: 10 }, () =>
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
        this.resultsFound = false;
        this.dataSource = new MatTableDataSource<any>();
        this.resultPageSize = 0;
        this.resultsAmount = 0;
    }

    private disableSearchEngine(disable: boolean) {
        this.searchInProgress = false;
        disable ? this.searchForm.disable() : this.searchForm.enable();
    }
}
