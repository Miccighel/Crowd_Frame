/* Core modules */
import {Component, EventEmitter, Output, ViewChild} from '@angular/core';

/* Loading screen module */
import {NgxUiLoaderService} from "ngx-ui-loader";

/* Material design modules */
import {MatTableDataSource} from '@angular/material';
import {MatPaginator} from "@angular/material/paginator";

/* Reactive forms modules */
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";


import {BingService} from '../../services/bing.service';
import {BingWebSearchResponse} from "../../models/binger/bingWebSearchResponse";
import {FakerService} from "../../services/faker.service";
import {FakerSearchResponse} from "../../models/binger/fakerSearchResponse";
import {PubmedService} from "../../services/pudmed.service";
import {PubmedSearchResponse} from "../../models/binger/pubmedSearchResponse";
import {PubmedSummaryResponse} from '../../models/binger/pubmedSummaryResponse';

@Component({
    selector: 'app-binger',
    templateUrl: './binger.component.html',
    styleUrls: ['./binger.component.scss']
})

/* BINGER COMPONENT MAIN CLASS */
export class BingerComponent {

    /* ATTRIBUTES */

    source: string;

    /* Loading screen service */
    ngxService: NgxUiLoaderService;

    /* Bing Web Search implementation (Service + REST Interface)*/
    bingService: BingService;
    fakerService: FakerService;
    pubmedService: PubmedService;
    bingWebSearchResponse: BingWebSearchResponse;
    fakerSearchResponse: Array<FakerSearchResponse>;
    pubmedSearchResponse: PubmedSearchResponse;
    pubmedSummaryResponse: PubmedSummaryResponse;

    /* Search form UI controls */
    searchForm: FormGroup;
    searchStarted: boolean;
    searchInProgress: boolean;
    query: FormControl;

    /* Boolean flag */
    searchPerformed: boolean;

    /* Event emitters to integrate Binger in other components */
    // Emitter for user query
    @Output() queryEmitter: EventEmitter<string>;
    // Emitter for search result
    @Output() resultEmitter: EventEmitter<Object>;
    // Emitter for user selected result item
    @Output() selectedRowEmitter: EventEmitter<Object>;

    /* Search results table UI variables and controls */
    resultsAmount = 0;
    resultsFound = false;
    resultPageSize = 10;
    resultPageSizeOptions = [5, 10, 15, 20];
    dataSource = new MatTableDataSource<any>();
    displayedColumns = ['name'];
    paginator: MatPaginator;

    /* Random digits to generate unique CSS ids when multiple Binger instances are used */
    digits: string;

    /* CORE FUNCTIONS */

    constructor(
        ngxService: NgxUiLoaderService,
        bingService: BingService,
        fakerService: FakerService,
        pubmedService: PubmedService,
        formBuilder: FormBuilder
    ) {

        this.source = "BingWebSearch";

        /* Service initialization */
        this.ngxService = ngxService;
        this.bingService = bingService;
        this.fakerService = fakerService;
        this.pubmedService = pubmedService;

        /* The form control for user query is initialized and bound with its synchronous validator(s) */
        this.query = new FormControl('', [Validators.required]);
        /* The search form is initialized by adding each form control */
        this.searchForm = formBuilder.group({"query": this.query});

        this.searchStarted = true;
        this.searchInProgress = false;

        /* EMITTER: each emitter is initialized with the corresponding datatype to be emitted */
        this.queryEmitter = new EventEmitter<string>();
        this.resultEmitter = new EventEmitter<Object>();
        this.selectedRowEmitter = new EventEmitter<Object>();

        /* The random digits for the current Binger instances are generated */
        this.digits = this.randomDigits();

    }

    public performWebSearch(query: string) {

        /* The loading screen is shown */
        this.ngxService.start();

        this.searchInProgress = true;

        /* EMITTER: The user query is emitted to provide it to an eventual parent component */
        this.queryEmitter.emit(query);

        switch (this.source) {
            /* The search operation for Bing Web Search is performed */
            /* This is done by subscribing to an Observable of <BingWebSearchResponse> items */
            case "BingWebSearch": {
                this.bingService.performWebSearch(query).subscribe(
                    searchResponse => {
                        /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                        if (searchResponse.hasOwnProperty("webPages")) {
                            /* Some results exist */
                            this.resultsFound = true;
                            /* The matching response is saved */
                            this.bingWebSearchResponse = searchResponse;
                            let decodedResponse = this.bingService.decodeResponse(this.bingWebSearchResponse);
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
                        this.ngxService.stop();
                    }
                );
                break;
            }
            case "FakerWebSearch": {
                this.fakerService.performWebSearch(query).subscribe(
                    searchResponse => {
                        /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                        if (searchResponse.length > 0) {
                            /* Some results exist */
                            this.resultsFound = true;
                            /* The matching response is saved */
                            this.fakerSearchResponse = searchResponse;
                            let decodedResponse = this.fakerService.decodeResponse(searchResponse);
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
                        this.ngxService.stop();
                    }
                );
                break;
            }
            case "PubmedSearch": {
                this.pubmedService.performWebSearch(query).subscribe(
                    async searchResponse => {
                        /* We are interested in parsing the webPages property of a BingWebSearchResponse */
                        if (searchResponse.esearchresult.idlist.length > 0) {
                            /* The matching response is saved */
                            this.pubmedSearchResponse = searchResponse;
                            /* EMITTER: The matching response is emitted to provide it to an eventual parent component*/
                            //this.resultEmitter.emit(this.pubmedSearchResponse);
                            let decodedResponses = []
                            for (let index in this.pubmedSearchResponse.esearchresult.idlist) {
                                let articleId = this.pubmedSearchResponse.esearchresult.idlist[index];
                                this.pubmedService.retrieveArticle(articleId).subscribe(
                                    summaryResponse => {
                                        this.pubmedSummaryResponse = summaryResponse;
                                        decodedResponses.push(this.pubmedService.decodeResponse(summaryResponse))
                                    }
                                );
                                /* Some results exist */
                                this.resultsFound = true;
                                /* The results amount is saved*/
                                this.resultsAmount = decodedResponses.length;
                                /* Each <webPage> item is saved into results table */
                                this.dataSource.data = decodedResponses;
                                await this.delay(750)
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
                        this.ngxService.stop();
                    }
                );
                break;
            }
        }
    }

    /* VIEWCHILD: A reference to a mat-paginator html element is created and bound with the result table */
    @ViewChild(MatPaginator, {static: false}) set matPaginator(matPaginator: MatPaginator) {
        this.dataSource.paginator = matPaginator
    }

    /* EMITTER: The result item clicked by user is emitted to provide it to an eventual parent component */
    public selectRow(row: Object) {
        this.selectedRowEmitter.emit(row)
    }

    /* UTILITY FUNCTIONS */

    // UTF8 URL decode for special characters in URL
    public decodeURI(uri: string): string {
        return decodeURIComponent(uri)
    }

    // Random digits generation
    public randomDigits(): string {
        let array = Array.from({length: 10}, () => Math.floor(Math.random() * (1000 - 1 + 1) + 1));
        return array.join("")
    }

    public delay(ms: number) {
        return new Promise( resolve => setTimeout(resolve, ms) );
    }
}
