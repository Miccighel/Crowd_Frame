/* Core modules */
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewChild,
    AfterViewInit
} from "@angular/core";
import {of} from "rxjs";
import {catchError, map, tap} from "rxjs/operators";
/* Loading screen module */
import {NgxUiLoaderService} from "ngx-ui-loader";
/* Material design modules */
import {MatPaginator} from "@angular/material/paginator";
/* Reactive forms modules */
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators
} from "@angular/forms";
/* Models */
import {Task} from "../../../../../../models/skeleton/task";
import {Worker} from "../../../../../../models/worker/worker";
import {
    DisplayModality,
    PreRetrievedResultsSettings,
    SearchEngineSettings
} from "../../../../../../models/searchEngine/searchEngineSettings";
import {CustomDataSource} from "../../../../../../models/searchEngine/customDataSource";
import {BaseResponse} from "../../../../../../models/searchEngine/baseResponse";
import {DataRecord} from "../../../../../../models/skeleton/dataRecord";
import {Dimension} from "src/app/models/skeleton/dimension";
import {BingWebSearchResponse} from "../../../../../../models/searchEngine/bingWebSearchResponse";
import {PubmedSearchResponse} from "../../../../../../models/searchEngine/pubmedSearchResponse";
import {FakeSearchResponse} from "../../../../../../models/searchEngine/fakeSearchResponse";
import {PreRetrievedResult} from "../../../../../../models/searchEngine/preRetrievedResult";
import {SectionService} from "../../../../../../services/section.service";
import {ConfigService} from "../../../../../../services/config.service";
import {CookieService} from "ngx-cookie-service";
import {S3Service} from "../../../../../../services/aws/s3.service";
import {BingService} from "../../../../../../services/searchEngine/bing.service";
import {PubmedService} from "../../../../../../services/searchEngine/pudmed.service";
import {FakerService} from "../../../../../../services/searchEngine/faker.service";

@Component({
    selector: "app-search-engine-body",
    templateUrl: "./search-engine-body.component.html",
    styleUrls: ["./search-engine-body.component.scss"],
    standalone: false
})

/*
 * This class implements a custom search engine which can be used within crowdsourcing tasks.
 */
export class SearchEngineBodyComponent implements OnInit, AfterViewInit {
    /* Microsoft Search API key */
    bingApiKey: string;
    /* Pubmed free API key */
    pubmedApiKey: string;

    /*
     * Object to wrap search engine settings
     * source: possible values are "BingWebSearch", "PubmedSearch", "FakerWebSearch"
     * domainsToFilter: array of domains to filter out from search results
     */
    settings: SearchEngineSettings;
    ngxService: NgxUiLoaderService;
    configService: ConfigService;
    S3Service: S3Service;
    cookieService: CookieService;
    sectionService: SectionService;
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

    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() dimension: Dimension;
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    @Input() resetEvent?: EventEmitter<void>;
    @Input() disableEvent?: EventEmitter<boolean>;

    task: Task;
    dimensionIndex: number;

    previousDataRecord: DataRecord;
    preRetrievedResultsSettings: PreRetrievedResultsSettings;
    preRetrievedResults: Array<PreRetrievedResult>;

    /* Search form UI controls */
    searchForm: UntypedFormGroup;
    searchStarted: boolean;
    searchInProgress: boolean;
    searchPerformed: boolean;
    query: UntypedFormControl;
    searchButtonEnabled: boolean;
    urls: UntypedFormControl;

    @ViewChild(MatPaginator) paginator: MatPaginator;

    /* Stored query text */
    queryValue: string;
    /* Last searched query text */
    lastQueryValue: string;

    /* Data source */
    dataSource: CustomDataSource;
    displayedColumns = ["name"];

    /* Data and search parameters */
    estimatedMatches = 0;
    resultsAmount = 0;
    searchAmount = 0;
    baseResponses: Array<BaseResponse> = [];

    /* Event emitters */
    /* EMITTER: Query inserted by user */
    @Output() queryEmitter = new EventEmitter<Object>();
    /* EMITTER: Responses retrieved by search engine */
    @Output() resultEmitter = new EventEmitter<Object>();
    /* EMITTER: Response selected by user */
    @Output() selectedRowEmitter = new EventEmitter<Object>();
    @Output() visitedRowEmitter = new EventEmitter<Object>();

    /* |--------- CONSTRUCTOR IMPLEMENTATION ---------| */
    constructor(
        changeDetector: ChangeDetectorRef,
        ngxService: NgxUiLoaderService,
        S3Service: S3Service,
        bingService: BingService,
        fakerService: FakerService,
        sectionService: SectionService,
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
        this.sectionService = sectionService;
        this.formBuilder = formBuilder;
        this.cookieService = cookieService;

        this.task = this.sectionService.task;
        this.documentIndex = 0;
        this.searchStarted = true;
        this.searchInProgress = false;
        this.searchButtonEnabled = true;
        this.bingApiKey = this.configService.environment.bing_api_key;
        this.pubmedApiKey = this.configService.environment.pubmed_api_key;
        if (this.configService.environment.production)
            this.bingService.endPoint = `${this.configService.environment.api_gateway_endpoint}/bing`;
    }

    /**
     * Defensive helper: ensures resultsRetrievedForms and all nested levels are arrays/objects as needed
     */
    private ensureResultsRetrievedFormsReady() {
        if (typeof this.documentIndex !== "number" || this.documentIndex < 0) return;
        if (typeof this.dimensionIndex !== "number" || this.dimensionIndex < 0) return;
        this.resultsRetrievedForms ??= [];
        this.resultsRetrievedForms[this.documentIndex] ??= [];
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex] ??= {
            estimatedMatches: 0,
            lastQueryValue: "",
            pageIndex: 0,
            resultsAmount: 0
        };
    }

    /** Safely get the most recent query record for this doc/dimension (or null). */
    private getLastQueryRecordForDocDim(): any | null {
        try {
            const all = this.previousDataRecord
                ?.loadSearchEngineQueries?.().data ?? [];
            if (!Array.isArray(all) || all.length === 0) return null;
            let last: any = null;
            for (const q of all) {
                if (q.document === this.documentIndex && q.dimension === this.dimensionIndex) {
                    if (!last || (q.timestamp ?? 0) > (last.timestamp ?? 0)) last = q;
                }
            }
            return last;
        } catch {
            return null;
        }
    }

    /** Paginator-safe helpers used inside the dataSource loader */
    private currentPageIndex(): number {
        return this.paginator?.pageIndex ?? 0;
    }

    private currentPageSize(): number {
        return this.paginator?.pageSize ?? 10;
    }

    ngOnInit() {
        // When used in chat-widget, dimension might not be explicitly passed
        this.dimensionIndex = this.dimension.index;

        /* Defensive: ensure preRetrievedResults and forms arrays exist at all levels */
        if (!this.task.searchEnginePreRetrievedResults) this.task.searchEnginePreRetrievedResults = [];
        if (!this.task.searchEnginePreRetrievedResults[this.documentIndex]) this.task.searchEnginePreRetrievedResults[this.documentIndex] = [];
        this.preRetrievedResults = this.task.searchEnginePreRetrievedResults[this.documentIndex] ?? [];
        this.preRetrievedResultsSettings = this.task.searchEnginePreRetrievedResultsSettings;
        this.ensureResultsRetrievedFormsReady();

        this.settings = this.task.searchEngineSettings;
        this.previousDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex];

        /* This header must be restored from cookies and attached to each request sent to Bing API*/
        const msClientIdName = "MSEdge-ClientID";
        if (this.checkCookie(msClientIdName))
            this.bingService.msEdgeClientID = this.loadCookie(msClientIdName);

        const makeLoader = (performFetch: (query: string, resultsToSkip: number, querySentByUser: boolean) => any) =>
            new CustomDataSource((query = this.lastQueryValue, resultsToSkip, querySentByUser = false) => {
                this.ensureResultsRetrievedFormsReady();
                const pageIndex = this.currentPageIndex();
                const pageSize = this.currentPageSize();
                const resultSliceStart = pageIndex * pageSize;
                const resultSliceEnd = resultSliceStart + pageSize;

                const needMore =
                    querySentByUser ||
                    (resultSliceEnd > this.resultsAmount && this.estimatedMatches > this.resultsAmount) ||
                    this.resultsAmount === 0;

                if (needMore) {
                    if (querySentByUser) {
                        /* EMITTER: The user query is emitted to provide it to an eventual parent component, when the query is sent manually */
                        this.queryEmitter.emit({
                            text: this.lastQueryValue,
                            encoded: encodeURIComponent(this.lastQueryValue)
                        });
                        this.baseResponses = [];
                        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
                    }

                    this.ngxService.startBackgroundLoader("search-loader");
                    this.searchInProgress = true;

                    return performFetch(query, resultsToSkip, querySentByUser).pipe(
                        map(() => {
                            // adapter-specific mapping happens in performFetch
                            const pageIdx = this.currentPageIndex();
                            const pageSz = this.currentPageSize();
                            const sliceStart = pageIdx * pageSz;
                            const sliceEnd = sliceStart + pageSz;

                            this.searchInProgress = false;
                            this.ngxService.stopBackgroundLoader("search-loader");
                            return this.baseResponses.slice(sliceStart, sliceEnd);
                        }),
                        catchError((_error) => {
                            this.searchInProgress = false;
                            this.estimatedMatches = 0;
                            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;
                            this.resultEmitter.emit({
                                decodedResponses: [],
                                estimatedMatches: this.estimatedMatches,
                                resultsRetrieved: 0,
                                resultsToSkip: resultsToSkip,
                                resultsAmount: this.resultsAmount,
                                pageIndex: this.currentPageIndex(),
                                pageSize: this.currentPageSize()
                            });
                            this.ngxService.stopBackgroundLoader("search-loader");
                            return of([]);
                        })
                    );
                } else {
                    return of(this.baseResponses.slice(resultSliceStart, resultSliceEnd));
                }
            });

        if (this.preRetrievedResults.length <= 0) {
            switch (this.settings.source) {
                case "BingWebSearch":
                    this.searchAmount = this.bingService.SEARCH_AMOUNT;
                    this.dataSource = makeLoader((query, resultsToSkip) => {
                        return this.bingService.performWebSearch(this.bingApiKey, encodeURIComponent(query), resultsToSkip).pipe(
                            map((searchResponse) => {
                                if (!this.checkCookie(msClientIdName)) {
                                    const expireDate = new Date();
                                    expireDate.setDate(expireDate.getDate() + 365);
                                    this.storeCookie(msClientIdName, this.bingService.msEdgeClientID, expireDate);
                                }
                                /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                                this.bingWebSearchResponse = this.bingService.filterResponse(searchResponse, this.settings.domains_filter);
                                this.estimatedMatches = searchResponse.webPages.totalEstimatedMatches;
                                const decodedResponses = this.bingService.decodeResponse(this.bingWebSearchResponse);
                                this.baseResponses = this.baseResponses.concat(decodedResponses);
                                this.resultsAmount = this.baseResponses.length;

                                this.ensureResultsRetrievedFormsReady();
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = this.resultsAmount;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;

                                /* EMITTER: The matching response is emitted to provide it to the parent component*/
                                this.resultEmitter.emit({
                                    decodedResponses: this.baseResponses,
                                    estimatedMatches: this.estimatedMatches,
                                    resultsRetrieved: decodedResponses.length,
                                    resultsToSkip: resultsToSkip,
                                    resultsAmount: this.resultsAmount,
                                    pageIndex: this.currentPageIndex(),
                                    pageSize: this.currentPageSize()
                                });
                                return true;
                            })
                        );
                    });
                    break;

                case "PubmedSearch":
                    this.searchAmount = this.pubmedService.SEARCH_AMOUNT;
                    this.dataSource = makeLoader((query, resultsToSkip) => {
                        return this.pubmedService.performWebSearch(this.pubmedApiKey, encodeURIComponent(query), resultsToSkip).pipe(
                            map((searchResponse) => {
                                this.pubmedSearchResponse = searchResponse["firstRequestData"];
                                this.estimatedMatches = this.pubmedSearchResponse.esearchresult.count;
                                const decodedResponses = this.pubmedService.decodeResponse(searchResponse["additionalResponses"]);
                                this.baseResponses = this.baseResponses.concat(decodedResponses);
                                this.resultsAmount = this.baseResponses.length;

                                this.ensureResultsRetrievedFormsReady();
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = this.resultsAmount;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;

                                this.resultEmitter.emit({
                                    decodedResponses: this.baseResponses,
                                    estimatedMatches: this.estimatedMatches,
                                    resultsRetrieved: decodedResponses.length,
                                    resultsToSkip: resultsToSkip,
                                    resultsAmount: this.resultsAmount,
                                    pageIndex: this.currentPageIndex(),
                                    pageSize: this.currentPageSize()
                                });
                                return true;
                            })
                        );
                    });
                    break;

                case "FakerWebSearch":
                    this.searchAmount = this.fakerService.SEARCH_AMOUNT;
                    this.dataSource = makeLoader((query, resultsToSkip) => {
                        return this.fakerService.performWebSearch(encodeURIComponent(query)).pipe(
                            map((searchResponses) => {
                                const decodedResponses = this.fakerService.decodeResponse(searchResponses);
                                this.estimatedMatches = decodedResponses.length;
                                this.baseResponses = this.baseResponses.concat(decodedResponses);
                                this.resultsAmount = this.baseResponses.length;

                                this.ensureResultsRetrievedFormsReady();
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = this.resultsAmount;
                                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;

                                this.resultEmitter.emit({
                                    decodedResponses: this.baseResponses,
                                    estimatedMatches: this.estimatedMatches,
                                    resultsRetrieved: decodedResponses.length,
                                    resultsToSkip: resultsToSkip,
                                    resultsAmount: this.resultsAmount,
                                    pageIndex: this.currentPageIndex(),
                                    pageSize: this.currentPageSize()
                                });
                                return true;
                            })
                        );
                    });
                    break;
            }
        } else {
            this.queryValue = this.preRetrievedResults?.at(0)?.queryText ?? "";
            this.lastQueryValue = this.queryValue;
            this.queryEmitter.emit({
                text: this.lastQueryValue,
                encoded: encodeURIComponent(this.lastQueryValue)
            });
            this.searchAmount = this.preRetrievedResults.length;
            this.dataSource = new CustomDataSource((_query, _resultsToSkip, _querySentByUser) => {
                this.ensureResultsRetrievedFormsReady();
                const pageIndex = this.currentPageIndex();
                const pageSize = this.currentPageSize();
                const resultSliceStart = pageIndex * pageSize;
                const resultSliceEnd = resultSliceStart + pageSize;

                this.resultsAmount = this.preRetrievedResults.length;
                this.estimatedMatches = this.preRetrievedResults.length;
                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = this.preRetrievedResults.length;
                this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.preRetrievedResults.length;

                this.searchInProgress = false;
                for (const pre of this.preRetrievedResults) {
                    const baseResponse = new BaseResponse(pre.pageUrl, pre.pageName, pre.pageSnippet, false);
                    baseResponse.setParameter("resultUUID", pre.resultUUID);
                    this.baseResponses.push(baseResponse);
                }
                this.resultEmitter.emit({
                    decodedResponses: this.baseResponses,
                    estimatedMatches: this.estimatedMatches,
                    resultsRetrieved: this.preRetrievedResults.length,
                    resultsToSkip: 0,
                    resultsAmount: this.resultsAmount,
                    pageIndex,
                    pageSize
                });
                return of(this.baseResponses.slice(resultSliceStart, resultSliceEnd));
            });
        }

        // Restore or init form controls, always guarded
        let urlValue = "";
        let pageSize = 10;
        let pageIndex = 0;

        if (this.previousDataRecord) {
            const previousQuery = this.getLastQueryRecordForDocDim();
            if (previousQuery) {
                this.lastQueryValue = previousQuery.text;
                this.queryValue = previousQuery.text;
            }

            const prevRetrievedAll = this.previousDataRecord.loadSearchEngineRetrievedResponses().data ?? [];
            if (prevRetrievedAll.length > 0) {
                // prefer matching query index if available, else fallback to last by timestamp for doc+dim
                let retrievedForThis: any[] = prevRetrievedAll.filter((r: any) =>
                    r.document === this.documentIndex &&
                    r.dimension === this.dimensionIndex &&
                    (previousQuery ? r.query === previousQuery.index : true)
                );
                if (retrievedForThis.length === 0) {
                    retrievedForThis = prevRetrievedAll.filter((r: any) =>
                        r.document === this.documentIndex && r.dimension === this.dimensionIndex
                    );
                }
                if (retrievedForThis.length > 0) {
                    retrievedForThis.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
                    const last = retrievedForThis[retrievedForThis.length - 1];
                    const baseResponses: BaseResponse[] = [];
                    for (const pr of (last.response ?? [])) {
                        const br = new BaseResponse(pr.url, pr.name, pr.snippet, pr.visited);
                        Object.entries(pr.parameters ?? {}).forEach(([n, v]) => br.setParameter(n, v));
                        baseResponses.push(br);
                    }
                    this.baseResponses = baseResponses;
                    this.estimatedMatches = parseInt(last.estimated_matches, 10) || 0;
                    this.resultsAmount = parseInt(last.results_amount, 10) || this.baseResponses.length;
                    pageSize = parseInt(last.page_size, 10) || pageSize;
                    pageIndex = parseInt(last.page_index, 10) || pageIndex;
                }
            }

            const prevSelected = this.previousDataRecord.loadSearchEngineSelectedResponses().data ?? [];
            if (prevSelected.length > 0) {
                prevSelected.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
                // match doc/dim; if query missing, ignore it
                const candidates = prevSelected.filter((s: any) =>
                    s.document === this.documentIndex &&
                    s.dimension === this.dimensionIndex &&
                    (previousQuery ? s.query === previousQuery.index : true)
                );
                if (candidates.length > 0) {
                    urlValue = candidates[candidates.length - 1].response.url;
                }
            }
        }

        this.query = new UntypedFormControl(this.queryValue, [Validators.required]);
        this.urls = new UntypedFormControl(urlValue, [Validators.required]);
        this.searchForm = this.formBuilder.group({
            query: this.query,
            urls: this.urls
        });

        this.ensureResultsRetrievedFormsReady();
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["form"] = this.searchForm;
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"] = pageSize;
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"] = pageIndex;
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["lastQueryValue"] = this.queryValue ?? "";
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["baseResponses"] = this.baseResponses;
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = this.resultsAmount;
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;

        if (this.task.settings.modality == "conversational") {
            this.resetEvent?.subscribe(() => this.resetSearchEngineState());
            this.disableSearchEngine(true);
            this.disableEvent?.subscribe((disable: boolean) => this.disableSearchEngine(disable));
        }

        /* Useful properties that can be sent to Bing API for improving the search experience */
        if ((this.worker.getIP() as any)?.ip) this.bingService.ipAddress = (this.worker.getIP() as any).ip;
        if ((this.worker as any).latitude) this.bingService.latitude = (this.worker as any).latitude;
        if ((this.worker as any).longitude) this.bingService.longitude = (this.worker as any).longitude;
        if ((this.worker as any).accuracy) this.bingService.accuracy = (this.worker as any).accuracy;
        if ((this.worker as any).altitude) this.bingService.altitude = (this.worker as any).altitude;
        if ((this.worker as any).altitudeAccuracy) this.bingService.altitude = (this.worker as any).altitudeAccuracy;
    }

    ngAfterViewInit() {
        this.ensureResultsRetrievedFormsReady();
        this.paginator.page
            .pipe(
                tap(pageEvent => {
                    this.ensureResultsRetrievedFormsReady();
                    if (this.lastQueryValue && this.estimatedMatches > pageEvent.pageSize * pageEvent.pageIndex) {
                        this.dataSource.loadData(this.lastQueryValue, this.resultsAmount, false);
                        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"] = pageEvent.pageSize;
                        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"] = pageEvent.pageIndex;
                    }
                    const retrievedResponseData = {
                        decodedResponses: this.baseResponses,
                        estimatedMatches: this.estimatedMatches,
                        resultsRetrieved: 0,
                        resultsToSkip: 0,
                        resultsAmount: this.resultsAmount,
                        pageIndex: pageEvent.pageIndex,
                        pageSize: pageEvent.pageSize
                    };
                    this.task.storeSearchEngineRetrievedResponse(retrievedResponseData, this.task.documents[this.documentIndex], this.dimension);
                })
            )
            .subscribe();

        if (
            this.resultsRetrievedForms[this.documentIndex] &&
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex] &&
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] > 0
        ) {
            this.paginator.pageSize = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageSize"];
            this.paginator.pageIndex = this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"];
            this.dataSource.loadData(this.lastQueryValue, this.resultsAmount, false);
        }

        if (this.preRetrievedResults.length > 0) {
            this.query?.setValue(this.preRetrievedResults?.at(0).queryText);
            this.performWebSearch();
            this.query.disable();
        }
    }

    public saveQueryText(query: string) {
        this.queryValue = query;
    }

    /*
     * This function uses the text received as a parameter to perform a request using the chosen service.
     */
    public performWebSearch() {
        if (this.queryValue && this.queryValue.length > 0) {
            this.lastQueryValue = this.queryValue;
            if (this.paginator) this.paginator.pageIndex = 0;
            this.resultsAmount = 0;
            this.ensureResultsRetrievedFormsReady();
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["lastQueryValue"] = this.lastQueryValue;
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["pageIndex"] = 0;
            this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["resultsAmount"] = 0;
            this.dataSource.loadData(this.lastQueryValue, 0, true);
        }
    }

    public storeCookie(identifier: string, value: string, expireDate: Date) {
        this.cookieService.set(identifier, value, expireDate, "/"); // Last parameter '/' is the path of the cookie
    }

    /* EMITTER: The response item clicked by user is emitted to provide it to an eventual parent component */
    public selectBaseResponse(response: BaseResponse) {
        this.selectedRowEmitter.emit(response);
    }

    public markAsVisited(response: BaseResponse) {
        this.visitedRowEmitter.emit(response);
    }

    public checkCookie(identifier: string) {
        return this.cookieService.check(identifier);
    }

    public loadCookie(identifier: string) {
        return this.cookieService?.get(identifier);
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
        this.ensureResultsRetrievedFormsReady();
        this.resultsRetrievedForms[this.documentIndex][this.dimensionIndex]["estimatedMatches"] = this.estimatedMatches;
    }

    private disableSearchEngine(disable: boolean) {
        this.searchInProgress = false;
        disable ? this.searchForm.disable() : this.searchForm.enable();
    }

    protected generatePreRetrievedResultSummaryUrl(resultUUID: string) {
        if (this.configService.environment.production)
            return `https://${this.configService.environment.cloudfrontEndpoint}/${this.configService.environment.taskName}/${this.configService.environment.batchName}/?result-summary=${resultUUID}`;
        else
            return `${window.location.origin}/?result-summary=${resultUUID}`;
    }

    protected readonly DisplayModality = DisplayModality;
}
