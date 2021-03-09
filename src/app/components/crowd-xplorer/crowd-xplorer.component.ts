/* Core modules */
import {Component, EventEmitter, Output, ViewChild} from '@angular/core';
/* Loading screen module */
import {NgxUiLoaderService} from "ngx-ui-loader";
/* Material design modules */
import { MatTableDataSource } from '@angular/material/table';
import {MatPaginator} from "@angular/material/paginator";
/* Reactive forms modules */
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
/* Services */
import {BingService} from '../../services/bing.service';
import {BingWebSearchResponse} from "../../models/crowd-xplorer/bingWebSearchResponse";
import {FakerService} from "../../services/faker.service";
import {FakerSearchResponse} from "../../models/crowd-xplorer/fakerSearchResponse";
import {PubmedService} from "../../services/pudmed.service";
import {PubmedSearchResponse} from "../../models/crowd-xplorer/pubmedSearchResponse";
import {PubmedSummaryResponse} from '../../models/crowd-xplorer/pubmedSummaryResponse';
import {ConfigService} from "../../services/config.service";
import * as AWS from "aws-sdk";
import {Settings} from "../../models/crowd-xplorer/settings";
/* Debug config import */
import {S3Service} from "../../services/s3.service";

/* Component HTML Tag definition */
@Component({
  selector: 'app-crowd-xplorer',
  templateUrl: './crowd-xplorer.component.html',
  styleUrls: ['./crowd-xplorer.component.scss']
})

/*
* This class implements a custom search engine which can be used for Crowdsourcing tasks.
* Please, remember to review the environment variables in ../environments/ folder.
* File environment.ts --- DEVELOPMENT ENVIRONMENT
* File environment.prod.ts --- PRODUCTION ENVIRONMENT
*/
export class CrowdXplorer {

  /* |--------- GENERAL ELEMENTS - DECLARATION ---------| */

  /* Microsoft Search API key */
  apiKey: string

  /*
   * Service to query:
   * Possible values are "BingWebSearch", "PubmedSearch", "FakerSearch"
   */
  source: string;

  /* Loading screen service */
  ngxService: NgxUiLoaderService;
  /* Service to provide an environment-based configuration */
  configService: ConfigService;
  S3Service: S3Service;

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


  /* Search form UI controls */
  searchForm: FormGroup;
  searchStarted: boolean;
  searchInProgress: boolean;
  query: FormControl;

  domainsToFilter: Array<string>

  /* Boolean flag */
  searchPerformed: boolean;

  /* Event emitters to integrate Binger in other components */
  /* EMITTER: Query inserted by user */
  @Output() queryEmitter: EventEmitter<string>;
  /* EMITTER: Responses retrieved by search engine */
  @Output() resultEmitter: EventEmitter<Object>;
  /* EMITTER: Response selected by user */
  @Output() selectedRowEmitter: EventEmitter<Object>;

  /* Search results table UI variables and controls */
  resultsAmount = 0;
  resultsFound = false;
  resultPageSize = 10;
  resultPageSizeOptions = [5, 10, 15, 20];
  dataSource = new MatTableDataSource<any>();
  displayedColumns = ['name'];
  paginator: MatPaginator;

  /* Random digits to generate unique CSS ids when multiple instances of the search engine are used */
  digits: string;

  settings: Settings

  /* |--------- AMAZON AWS INTEGRATION - DECLARATION ---------| */

  /* Name of the current task */
  taskName: string;
  /* Sub name of the current task */
  batchName: string;

  /* AWS S3 Integration*/
  s3: AWS.S3;
  /* Region identifier */
  region: string;
  /* Bucket identifier */
  bucket: string;
  /* Folder to use within the bucket */
  folder: string;
  /* File where some general settings are stored */
  settingsFile: string;

  // |--------- CONSTRUCTOR ---------|

  constructor(
    ngxService: NgxUiLoaderService,
    S3Service: S3Service,
    bingService: BingService,
    fakerService: FakerService,
    pubmedService: PubmedService,
    configService: ConfigService,
    formBuilder: FormBuilder
  ) {

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    /* Service initialization */
    this.ngxService = ngxService;
    this.S3Service = S3Service;
    this.bingService = bingService;
    this.fakerService = fakerService;
    this.pubmedService = pubmedService;
    this.configService = configService;

    this.apiKey = this.configService.environment.bing_api_key

    /* The form control for user query is initialized and bound with its synchronous validator(s) */
    this.query = new FormControl('', [Validators.required]);
    /* The search form is initialized by adding each form control */
    this.searchForm = formBuilder.group({"query": this.query});

    /* Control booleans */
    this.searchStarted = true;
    this.searchInProgress = false;

    /* EMITTER: each emitter is initialized with the corresponding datatype to be emitted */
    this.queryEmitter = new EventEmitter<string>();
    this.resultEmitter = new EventEmitter<Object>();
    this.selectedRowEmitter = new EventEmitter<Object>();

    /* The random digits for the current instances are generated */
    this.digits = this.randomDigits();

    this.loadSettings().then(() => {})

  }

  public async loadSettings() {
    let rawSettings = await this.S3Service.downloadSearchEngineSettings(this.configService.environment)
    this.settings = new Settings(rawSettings)
    this.source = this.settings.source
    this.domainsToFilter = this.settings.domainsToFilter
  }

  /* |--------- GENERAL ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function uses the text received as a parameter to perform a request using the chosen service.
   */
  public performWebSearch(query: string) {

    /* The loading screen is shown */
    this.ngxService.startBackground();

    /* A search has been started */
    this.searchInProgress = true;

    /* EMITTER: The user query is emitted to provide it to an eventual parent component */
    this.queryEmitter.emit(query);

    switch (this.source) {
      /* The search operation for Bing Web Search is performed */
      /* This is done by subscribing to an Observable of <BingWebSearchResponse> items */
      case "BingWebSearch": {
        this.bingService.performWebSearch(this.apiKey, query).subscribe(
          searchResponse => {
            /* We are interested in parsing the webPages property of a <BingWebSearchResponse> */
            if (searchResponse.hasOwnProperty("webPages")) {
              /* Some results exist */
              this.resultsFound = true;
              /* The matching response is saved and filtered if the environment variable is not an empty array */
              this.bingWebSearchResponse = this.bingService.filterResponse(searchResponse, this.domainsToFilter);
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
            this.ngxService.stopBackground();
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
            this.ngxService.stopBackground();
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
            this.ngxService.stopBackground();
          }
        );
        break;
      }
    }
  }

  /* VIEWCHILD: A reference to a mat-paginator html element is created and bound with the result table */
  @ViewChild(MatPaginator) set matPaginator(matPaginator: MatPaginator) {
    this.dataSource.paginator = matPaginator
  }

  /* This function trigger an emitter when the user selects one the result shown on the interface */
  /* EMITTER: The result item clicked by user is emitted to provide it to an eventual parent component */
  public selectRow(row: Object) {
    this.selectedRowEmitter.emit(row)
  }

  /* |--------- UTILITY - FUNCTIONS ---------| */

  /* UTF8 URL decode for special characters in URL */
  public decodeURI(uri: string): string {
    return decodeURIComponent(uri)
  }

  /* Random digits generation */
  public randomDigits(): string {
    let array = Array.from({length: 10}, () => Math.floor(Math.random() * (1000 - 1 + 1) + 1));
    return array.join("")
  }

  /* Timeout setting */
  public delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
