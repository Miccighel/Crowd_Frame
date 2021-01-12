/* Core modules */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
  ViewChildren,
  QueryList, OnInit, ElementRef, AfterViewInit, ViewEncapsulation, Inject,
} from '@angular/core';
/* Reactive forms modules */
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatFormField } from "@angular/material/form-field";
import { MatStepper } from "@angular/material/stepper";
import { CountdownComponent } from 'ngx-countdown';
/* Services */
import { NgxUiLoaderService } from 'ngx-ui-loader';
import { ConfigService } from "../../services/config.service";
import { S3Service } from "../../services/s3.service";
/* Task models */
import { Document } from "../../../../data/build/document";
import { Hit } from "../../models/skeleton/hit";
import { Questionnaire } from "../../models/skeleton/questionnaire";
import { Dimension, ScaleInterval } from "../../models/skeleton/dimension";
import { Instruction } from "../../models/shared/instructions";
/* Font Awesome icons */
import { Annotator, Settings } from "../../models/skeleton/settings";
import { Worker } from "../../models/skeleton/worker";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Note } from "../../models/skeleton/notes";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DialogData, InstructionsDialog } from "../instructions/instructions.component";
import { doHighlight, deserializeHighlights, serializeHighlights, removeHighlights, optionsImpl } from "@funktechno/texthighlighter/lib";
import { DeviceDetectorService } from 'ngx-device-detector';
import { Amplify } from 'aws-sdk';


/* Component HTML Tag definition */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

/*
* This class implements a skeleton for Crowdsourcing tasks. If you want to use this code to launch a Crowdsourcing task
* you have to set the environment variables in ../environments/ folder.
* File environment.ts --- DEVELOPMENT ENVIRONMENT
* File environment.prod.ts --- PRODUCTION ENVIRONMENT
*/
export class SkeletonComponent implements OnInit {

  /* |--------- GENERAL ELEMENTS - DECLARATION ---------| */

  /* Name of the current task */
  taskName: string;

  /* Sub name of the current task */
  batchName: string;

  /* Unique identifier of the current worker */
  workerIdentifier: string;

  worker: Worker

  /* Flag to unlock the task for the worker */
  taskAllowed: boolean;

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  /* Service to provide loading screens */
  ngxService: NgxUiLoaderService;
  /* Service to provide an environment-based configuration */
  configService: ConfigService;
  S3Service: S3Service;
  deviceDetectorService: DeviceDetectorService;

  /* HTTP client and headers */
  client: HttpClient;
  headers: HttpHeaders;

  /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
  formBuilder: FormBuilder;

  /* Variables to handle the control flow of the task */
  taskStarted: boolean;
  taskCompleted: boolean;
  taskSuccessful: boolean;
  taskFailed: boolean;
  checkCompleted: boolean;

  /* References to task stepper and token forms */
  @ViewChild('stepper') stepper: MatStepper;
  @ViewChild('urlField') urlField: MatFormField;
  tokenForm: FormGroup;
  tokenInput: FormControl;
  tokenOutput: string;
  tokenInputValid: boolean;

  /* Reference to the current hit */
  hit: Hit;
  /* Identifier of the current hit */
  unitId: string;
  /* Number of the current try */
  currentTry: number;

  settings: Settings

  /* Number of allowed tries */
  allowedTries: number;
  timeCheckAmount: number;
  blacklistBatches: Array<string>
  whitelistBatches: Array<string>
  countdownTime: number
  annotator: Annotator
  annotationOptions: FormGroup;

  /* |--------- QUESTIONNAIRE ELEMENTS - DECLARATION ---------| */

  /* Array of form references, one for each questionnaire within a Hit */
  questionnairesForm: FormGroup[];
  /* Reference to the current questionnaires */
  questionnaires: Array<Questionnaire>;
  /* Number of different questionnaires inserted within task's body
  * (currentDocument.e., a standard questionnaire and two cognitive questionnaires  */
  questionnaireAmount: number;

  /* |--------- HIT ELEMENTS - DECLARATION ---------| */

  taskInstructions: Array<Instruction>;
  taskInstructionsAmount: number;
  taskInstructionsRead: boolean;

  /* Instructions for dimension assessing */
  instructions: Array<Instruction>;
  /* Amount of instructions sentences */
  instructionsAmount: number;

  /* Array of worker answers dimensions */
  dimensions: Array<Dimension>;
  /* Amount of asked dimensions */
  dimensionsAmount: number;
  dimensionsSelectedValues: Array<object>;
  /* Reference to the current dimension */
  currentDimension: number;

  /* Array of form references, one for each document within a Hit */
  documentsForm: FormGroup[];
  /* Amount of documents within a hit */
  documentsAmount: number;
  /* Array of documents */
  documents: Array<Document>;

  /* Array of accesses counters, one for each element (questionnaire + documents) */
  elementsAccesses: Array<number>;

  /* |--------- SEARCH ENGINE INTEGRATION - DECLARATION ---------| */
  /* https://github.com/Miccighel/CrowdXplorer */

  /* Array to store search engine queries and responses, one for each document within a Hit */
  searchEngineQueries: Array<object>;
  currentQuery: number
  searchEngineRetrievedResponses: Array<object>;
  /* Array to store the responses selected by workers within search engine results, one for each document within a Hit */
  searchEngineSelectedResponses: Array<object>;
  /* Flag to check if the query returned some results */
  resultsFound: boolean;

  /* |--------- QUALITY CHECKS - DECLARATION ---------| */

  /* Indexes of the gold questions within a Hit */
  goldIndex: number;
  goldIndexHigh: number;
  goldIndexLow: number;

  /* Arrays to record timestamps, one for each document within a Hit */
  timestampsStart: Array<Array<number>>;
  timestampsEnd: Array<Array<number>>;
  timestampsElapsed: Array<number>;

  /* |--------- COMMENT ELEMENTS - DECLARATION ---------| */

  /* Comment form reference */
  commentForm: FormGroup;
  /* Comment textarea */
  comment: FormControl;
  /* Flag to check if the comment has been correctly sent */
  commentSent: boolean;

  /* |--------- OTHER ELEMENTS - DECLARATION ---------| */

  /* Font awesome spinner icon */
  faSpinner: Object;
  /* Font awesome infoCircle icon */
  faInfoCircle: Object;

  /* |--- COUNTDOWN ---| */
  @ViewChildren('cd') countdown: QueryList<CountdownComponent>;
  countdownsExpired: Array<boolean>;

  /* |--- TASK GENERATOR ---| */
  generator: boolean;

  snackBar: MatSnackBar;

  highlighter: any
  notes: Array<Array<Note>>

  sequenceNumber: number

  /* |--------- CONSTRUCTOR ---------| */

  constructor(
    public annotationDialog: MatDialog,
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
    deviceDetectorService: DeviceDetectorService,
    client: HttpClient,
    formBuilder: FormBuilder,
    snackBar: MatSnackBar
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.changeDetector = changeDetector;
    this.ngxService = ngxService;
    this.configService = configService;
    this.S3Service = S3Service;
    this.deviceDetectorService = deviceDetectorService;
    this.client = client;
    this.formBuilder = formBuilder;

    this.snackBar = snackBar

    this.ngxService.startLoader('skeleton');

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    this.taskAllowed = true;

    this.taskStarted = false;
    this.taskCompleted = false;
    this.taskSuccessful = false;
    this.taskFailed = false;
    this.checkCompleted = false;

    /* |--- TASK GENERATOR ---| */
    this.generator = false;

    this.tokenInput = new FormControl('PJMYDLCIWD', [Validators.required, Validators.maxLength(11)], this.validateTokenInput.bind(this));
    this.tokenForm = formBuilder.group({
      "tokenInput": this.tokenInput
    });
    this.tokenInputValid = false;

    this.currentTry = 1;

    /* |--------- SEARCH ENGINE INTEGRATION - INITIALIZATION ---------| */

    this.resultsFound = false;

    /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

    this.comment = new FormControl('');
    this.commentForm = formBuilder.group({
      "comment": this.comment,
    });

    this.sequenceNumber = 0
  }

  public async ngOnInit() {

    this.ngxService.startLoader('skeleton')

    let url = new URL(window.location.href);

    let rawTaskInstructions = await this.S3Service.downloadTaskInstructions(this.configService.environment);
    this.taskInstructionsAmount = rawTaskInstructions.length;
    /* The instructions are parsed using the Instruction class */
    this.taskInstructions = new Array<Instruction>();
    for (let index = 0; index < this.taskInstructionsAmount; index++) {
      this.taskInstructions.push(new Instruction(index, rawTaskInstructions[index]));
    }

    /* If there is an external worker which is trying to perform the task, check its status */
    this.loadSettings().then(() => {
      this.workerIdentifier = url.searchParams.get("workerID");
      if (!(this.workerIdentifier === null)) {
        this.performWorkerStatusCheck().then(outcome => {
          this.client.get('https://www.cloudflare.com/cdn-cgi/trace', { responseType: 'text' }).subscribe(
            cloudflareData => {
              this.worker = new Worker(this.workerIdentifier, this.S3Service.getWorkerFolder(this.configService.environment, null, this.workerIdentifier), cloudflareData, window.navigator, this.deviceDetectorService.getDeviceInfo())
              this.taskAllowed = outcome;
              this.checkCompleted = true
              this.changeDetector.detectChanges()
              /* The loading spinner is stopped */
              this.ngxService.stopLoader('skeleton');
            },
            error => {
              this.worker = new Worker(this.workerIdentifier, this.S3Service.getWorkerFolder(this.configService.environment, null, this.workerIdentifier), null, window.navigator, this.deviceDetectorService.getDeviceInfo())
              this.taskAllowed = outcome;
              this.checkCompleted = true
              this.changeDetector.detectChanges()
              /* The loading spinner is stopped */
              this.ngxService.stopLoader('skeleton');
            }
          )
        })
      } else {
        this.worker = new Worker(null, null, null, null, null)
        this.checkCompleted = true
        this.changeDetector.detectChanges()
        this.ngxService.stopLoader('skeleton')
      }
    })


  }

  public enableTask() {

    this.taskInstructionsRead = true
    this.showSnackbar("If you have a very slow internet connection please wait a few seconds before clicking \"Start\".", "Dismiss", 15000)
    this.changeDetector.detectChanges()
  }


  /* |--------- GENERAL ELEMENTS - FUNCTIONS ---------| */

  public async loadSettings() {
    this.settings = new Settings(await this.S3Service.downloadTaskSettings(this.configService.environment))
    this.allowedTries = this.settings.allowedTries
    this.timeCheckAmount = this.settings.timeCheckAmount
    this.blacklistBatches = this.settings.blacklistBatches
    this.whitelistBatches = this.settings.whitelistBatches
    this.countdownTime = this.settings.countdownTime
    this.annotator = this.settings.annotator
  }

  /*
  * This function interacts with an Amazon S3 bucket to perform a check on the current worker identifier.
  * If the worker has already started the task in the past (currentDocument.e., it's present in the workers.json
  * file within the current scale folder of the task's bucket) he is not allowed to continue the task.
  * If there is a task for each rating scale within the task, three different checks are made.
  * This behavior is controlled by setting the useEachScale flag.
  */
  public async performWorkerStatusCheck() {
    /* The worker identifiers of the current task are downloaded */
    let workers = await this.S3Service.downloadWorkers(this.configService.environment)
    if ('started' in workers) {
      workers['blacklist'] = workers['started']
      delete workers['started']
    }
    let blacklistedInCurrentTask = false;
    for (let currentWorker of workers['blacklist']) if (currentWorker == this.workerIdentifier) blacklistedInCurrentTask = true;
    if (!blacklistedInCurrentTask) {

      for (let blacklistBatch of this.blacklistBatches) {
        let blacklistedWorkers = await this.S3Service.downloadWorkers(this.configService.environment, blacklistBatch)
        if ('started' in blacklistedWorkers) {
          blacklistedWorkers['blacklist'] = blacklistedWorkers['started']
          delete blacklistedWorkers['started']
        }
        for (let currentWorker of blacklistedWorkers['blacklist']) {
          if (currentWorker == this.workerIdentifier) {
            return false
          }
        }
      }

      for (let whitelistBatch of this.whitelistBatches) {
        let whitelistedWorkers = await this.S3Service.downloadWorkers(this.configService.environment, whitelistBatch)
        if ('started' in whitelistedWorkers) {
          whitelistedWorkers['blacklist'] = whitelistedWorkers['started']
          delete whitelistedWorkers['started']
        }
        for (let currentWorker of whitelistedWorkers['blacklist']) {
          if (currentWorker == this.workerIdentifier) {
            workers['blacklist'].push(this.workerIdentifier);
            workers['whitelist'].push(this.workerIdentifier);
            let uploadStatus = await this.S3Service.uploadWorkers(this.configService.environment, workers);
            return !uploadStatus["failed"];
          }
        }
      }

      if (this.whitelistBatches.length > 0) {
        return false
      } else {
        workers['blacklist'].push(this.workerIdentifier);
        let uploadStatus = await this.S3Service.uploadWorkers(this.configService.environment, workers);
        return !uploadStatus["failed"];
      }

    } else {
      /* If a returning worker for the current task has been found, the task must be blocked */
      return false
    }
  }

  /*
  * This function interacts with an Amazon S3 bucket to search the token input
  * typed by the user inside within the hits.json file stored in the bucket.
  * If such token cannot be found, an error message is returned.
  */
  public async validateTokenInput(control: FormControl) {
    let hits = await this.S3Service.downloadHits(this.configService.environment)
    for (let hit of hits) if (hit.token_input === control.value) return null;
    return { "invalid": "This token is not valid." }
  }

  /*
  *  This function retrieves the hit identified by the validated token input inserted by the current worker.
  *  Such hit is represented by an Hit object. After that, the task is initialized by setting each required
  *  variables and by parsing hit content as an Array of Document objects. Therefore, to use a custom hit format
  *  the Hit and Document interfaces must be adapted; the former to match a different number of documents within each hit,
  *  the latter to correctly parse each document's field.
  *  The Hit interface can be found at this path: ../models/skeleton/hit.ts
  *  The Document interface can be found at this path: ../models/skeleton/document.ts
  */
  public async performTaskSetup() {
    /* The token input has been already validated, this is just to be sure */
    if (this.tokenForm.valid) {

      /* The loading spinner is started */
      this.ngxService.startLoader('skeleton');

      /* The hits stored on Amazon S3 are retrieved */
      let hits = await this.S3Service.downloadHits(this.configService.environment)

      /* Scan each entry for the token input */
      for (let currentHit of hits) {
        /* If the token input of the current hit matches with the one inserted by the worker the right hit has been found */
        if (this.tokenInput.value === currentHit.token_input) {
          this.hit = currentHit;
          this.tokenOutput = currentHit.token_output;
          this.unitId = currentHit.unit_id
        }
      }

      /* The token input field is disabled and the task can start */
      this.tokenInput.disable();
      this.taskStarted = true;

      /* |- QUESTIONNAIRE ELEMENTS - INITIALIZATION -| */

      /* The array of questionnaires is initialized */
      this.questionnaires = new Array<Questionnaire>();

      /* The questionnaires stored on Amazon S3 are retrieved */
      let rawQuestionnaires = await this.S3Service.downloadQuestionnaires(this.configService.environment)
      this.questionnaireAmount = rawQuestionnaires.length;

      /* Each questionnaire is parsed using the Questionnaire class */
      for (let index = 0; index < this.questionnaireAmount; index++) this.questionnaires.push(new Questionnaire(index, rawQuestionnaires[index]));

      /* A form for each questionnaire is initialized */
      this.questionnairesForm = new Array<FormGroup>();
      for (let index = 0; index < this.questionnaires.length; index++) {
        let questionnaire = this.questionnaires[index];
        if (questionnaire.type == "standard" || questionnaire.type == "likert") {
          /* If the questionnaire is a standard one it means that it has only questions where answers must be selected within a group of radio buttons.
           * This means that only a required validator is required to check answer presence
           */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaires[index].questions[index_question].name}`] = new FormControl('', [Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        } else {
          /* If the questionnaire is a crt one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user.
           * This means that required, max and min validators are needed
           */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaires[index].questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        }
      }

      /* |- HIT DIMENSIONS - INITIALIZATION -| */

      /* The dimensions stored on Amazon S3 are retrieved */
      let rawInstructions = await this.S3Service.downloadDimensionsInstructions(this.configService.environment)
      this.instructionsAmount = rawInstructions.length;

      /* The instructions are parsed using the Instruction class */
      this.instructions = new Array<Instruction>();
      for (let index = 0; index < this.instructionsAmount; index++) this.instructions.push(new Instruction(index, rawInstructions[index]));


      /* The array of dimensions is initialized */
      this.dimensions = new Array<Dimension>();

      /* The dimensions stored on Amazon S3 are retrieved */
      let rawDimensions = await this.S3Service.downloadDimensions(this.configService.environment)
      this.dimensionsAmount = rawDimensions.length;

      /* Each dimension is parsed using the Dimension class */
      for (let index = 0; index < this.dimensionsAmount; index++) this.dimensions.push(new Dimension(index, rawDimensions[index]));

      /* |- HIT DOCUMENTS - INITIALIZATION-| */

      this.documentsAmount = this.hit.documents.length;

      /* The array of documents is initialized */
      this.documents = new Array<Document>();

      /* A form for each document is initialized */
      this.documentsForm = new Array<FormGroup>();
      for (let index = 0; index < this.documentsAmount; index++) {
        let controlsConfig = {};
        for (let index_dimension = 0; index_dimension < this.dimensions.length; index_dimension++) {
          let dimension = this.dimensions[index_dimension];
          if (dimension.scale) if (dimension.scale.type != "continue") controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.required]); else controlsConfig[`${dimension.name}_value`] = new FormControl((Math.round(((<ScaleInterval>dimension.scale).min + (<ScaleInterval>dimension.scale).max) / 2)), [Validators.required]);
          if (dimension.justification) controlsConfig[`${dimension.name}_justification`] = new FormControl('', [Validators.required, this.validateJustification.bind(this)])
          if (dimension.url) controlsConfig[`${dimension.name}_url`] = new FormControl('', [Validators.required, this.validateSearchEngineUrl.bind(this)]);
        }
        this.documentsForm[index] = this.formBuilder.group(controlsConfig)
      }

      this.dimensionsSelectedValues = new Array<object>(this.documentsAmount);
      for (let index = 0; index < this.dimensionsSelectedValues.length; index++) {
        this.dimensionsSelectedValues[index] = {};
        this.dimensionsSelectedValues[index]["data"] = [];
        this.dimensionsSelectedValues[index]["amount"] = 0;
      }

      /*  Each document of the current hit is parsed using the Document interface.  */
      let rawDocuments = this.hit.documents;
      for (let index = 0; index < rawDocuments.length; index++) {
        let currentDocument = rawDocuments[index];
        this.documents.push(new Document(index, currentDocument));
      }

      /* The array of accesses counter is initialized */
      this.elementsAccesses = new Array<number>(this.documentsAmount + this.questionnaireAmount);
      for (let index = 0; index < this.elementsAccesses.length; index++) this.elementsAccesses[index] = 0;

      /* |--- COUNTDOWN ---| */
      this.countdownsExpired = new Array<boolean>(this.documentsAmount);
      for (let index = 0; index < this.documentsAmount; index++) this.countdownsExpired[index] = false;

      /* |- HIT SEARCH ENGINE - INITIALIZATION-| */

      this.searchEngineQueries = new Array<object>(this.documentsAmount);
      for (let index = 0; index < this.searchEngineQueries.length; index++) {
        this.searchEngineQueries[index] = {};
        this.searchEngineQueries[index]["data"] = [];
        this.searchEngineQueries[index]["amount"] = 0;
      }
      this.currentQuery = 0;
      this.searchEngineRetrievedResponses = new Array<object>(this.documentsAmount);
      for (let index = 0; index < this.searchEngineRetrievedResponses.length; index++) {
        this.searchEngineRetrievedResponses[index] = {};
        this.searchEngineRetrievedResponses[index]["data"] = [];
        this.searchEngineRetrievedResponses[index]["amount"] = 0;
      }
      this.searchEngineSelectedResponses = new Array<object>(this.documentsAmount);
      for (let index = 0; index < this.searchEngineSelectedResponses.length; index++) {
        this.searchEngineSelectedResponses[index] = {};
        this.searchEngineSelectedResponses[index]["data"] = [];
        this.searchEngineSelectedResponses[index]["amount"] = 0;
      }

      /* |- HIT QUALITY CHECKS - INITIALIZATION-| */

      /* Indexes of high and low gold questions are retrieved */
      for (let index = 0; index < this.documentsAmount; index++) {
        // if (this.documents[index].getGoldQuestionIndex("HIGH") != null) this.goldIndexHigh = this.documents[index].getGoldQuestionIndex("HIGH");
        // if (this.documents[index].getGoldQuestionIndex("LOW") != null) this.goldIndexLow = this.documents[index].getGoldQuestionIndex("LOW");
        if (this.documents[index].getGoldQuestionIndex("GOLD-") != null) this.goldIndex = this.documents[index].getGoldQuestionIndex("GOLD-")
      }

      /*
       * Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
       * on each document, including each questionnaire
       */
      this.timestampsStart = new Array<Array<number>>(this.documentsAmount + this.questionnaireAmount);
      this.timestampsEnd = new Array<Array<number>>(this.documentsAmount + this.questionnaireAmount);
      this.timestampsElapsed = new Array<number>(this.documentsAmount + this.questionnaireAmount);
      for (let i = 0; i < this.timestampsStart.length; i++) this.timestampsStart[i] = [];
      for (let i = 0; i < this.timestampsEnd.length; i++) this.timestampsEnd[i] = [];
      /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
      this.timestampsStart[0].push(Math.round(Date.now() / 1000));

      this.notes = new Array<Array<Note>>(this.documentsAmount);
      for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];

      if (this.annotator) {
        switch (this.annotator.type) {
          case "options":
            this.annotationOptions = this.formBuilder.group({
              label: new FormControl('')
            });
            break;
        }
      }

      /* Detect changes within the DOM and update the page */
      this.changeDetector.detectChanges();

      /* The loading spinner is stopped */
      this.ngxService.stopLoader('skeleton');

    }
  }

  public filterDimensions(type: string, position: string) {
    let filteredDimensions = []
    for (let dimension of this.dimensions) if (dimension.style.type == type && dimension.style.position == position) filteredDimensions.push(dimension)
    return filteredDimensions
  }

  /*
   * This function intercepts a <changeEvent> triggered by the value controls of a dimension.
   * The parameters are:
   * - a JSON object which holds the selected selected value.
   * - a reference to the current document
   * - a reference to the current dimension
   * This array CAN BE EMPTY, if the worker does not select any value and leaves the task or if a dimension does not require a value.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeDimensionValue(valueData: Object, document: number, dimension: number) {
    /* The current document, dimension and user query are copied from parameters */
    let currentDocument = document
    let currentDimension = dimension
    /* A reference to the current dimension is saved */
    this.currentDimension = currentDimension;
    let currentValue = valueData['value'];
    let timeInSeconds = Date.now() / 1000;
    /* If some data for the current document already exists*/
    if (this.dimensionsSelectedValues[currentDocument]['amount'] > 0) {
      /* The new query is pushed into current document data array along with a index used to identify such query*/
      let selectedValues = Object.values(this.dimensionsSelectedValues[currentDocument]['data']);
      selectedValues.push({
        "dimension": currentDimension,
        "index": selectedValues.length,
        "timestamp": timeInSeconds,
        "value": currentValue
      });
      /* The data array within the data structure is updated */
      this.dimensionsSelectedValues[currentDocument]['data'] = selectedValues;
      /* The total amount of selected values for the current document is updated */
      this.dimensionsSelectedValues[currentDocument]['amount'] = selectedValues.length;
    } else {
      /* The data slot for the current document is created */
      this.dimensionsSelectedValues[currentDocument] = {};
      /* A new data array for the current document is created and the fist selected value is pushed */
      this.dimensionsSelectedValues[currentDocument]['data'] = [{
        "dimension": currentDimension,
        "index": 0,
        "timestamp": timeInSeconds,
        "value": currentValue
      }];
      /* The total amount of selected values for the current document is set to 1 */
      /* IMPORTANT: the index of the last selected value for a document will be <amount -1> */
      this.dimensionsSelectedValues[currentDocument]['amount'] = 1
    }
  }

  /*
   * This function performs a validation of the worker justification field each time the current worker types or pastes in its inside
   * if the worker types the selected url as part of the justification an <invalid> error is raised
   * if the worker types a justification which has lesser than 15 words a <longer> error is raised
   * IMPORTANT: the <return null> part means: THE FIELD IS VALID
   */
  public validateJustification(control: FormControl) {
    /* The justification is divided into words */
    let minWords = 0
    let words = control.value.split(' ')
    let cleanedWords = new Array<string>()
    for (let word of words) {
      let trimmedWord = word.trim()
      if (trimmedWord.length > 0) {
        cleanedWords.push(trimmedWord)
      }
    }
    if (this.stepper) {
      /* If at least the first document has been reached */
      if (this.stepper.selectedIndex >= this.questionnaireAmount) {
        /* The current document index is selected */
        let currentDocument = this.stepper.selectedIndex - this.questionnaireAmount;
        /* If the user has selected some search engine responses for the current document */
        if (this.searchEngineSelectedResponses[currentDocument]) {
          if (this.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
            let selectedUrl = Object.values(this.searchEngineSelectedResponses[currentDocument]["data"]).pop()
            let response = selectedUrl["response"]
            /* The controls are performed */
            for (let word of cleanedWords) {
              if (word == response["url"]) return { "invalid": "You cannot use the selected search engine url as part of the justification." }
            }
          }
        }
        const allControls = this.getControlGroup(control).controls;
        let currentControl = Object.keys(allControls).find(name => control === allControls[name])
        let currentDimensionName = currentControl.split("_")[0]
        for (let dimension of this.dimensions) if (dimension.name == currentDimensionName) if (dimension.justification.minWords) minWords = dimension.justification.minWords
      }
      return cleanedWords.length > minWords ? null : { "longer": "This is not valid." };
    }
  }

  // |--------- SEARCH ENGINE INTEGRATION - FUNCTIONS ---------|

  /*
   * This function intercepts a <queryEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the query typed by the worker within a given document.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineUserQuery(queryData: Object) {
    /* The current document, dimension and user query are parsed from the JSON object */
    let currentDocument = parseInt(queryData['target']['id'].split("-")[3]);
    let currentDimension = parseInt(queryData['target']['id'].split("-")[4]);
    /* A reference to the current dimension is saved */
    this.currentDimension = currentDimension;
    let currentQueryText = queryData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some data for the current document already exists*/
    if (this.searchEngineQueries[currentDocument]['amount'] > 0) {
      /* The new query is pushed into current document data array along with a index used to identify such query*/
      let storedQueries = Object.values(this.searchEngineQueries[currentDocument]['data']);
      storedQueries.push({
        "dimension": currentDimension,
        "index": storedQueries.length,
        "timestamp": timeInSeconds,
        "text": currentQueryText
      });
      this.currentQuery = storedQueries.length - 1
      /* The data array within the data structure is updated */
      this.searchEngineQueries[currentDocument]['data'] = storedQueries;
      /* The total amount of query for the current document is updated */
      this.searchEngineQueries[currentDocument]['amount'] = storedQueries.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineQueries[currentDocument] = {};
      /* A new data array for the current document is created and the fist query is pushed */
      this.searchEngineQueries[currentDocument]['data'] = [{
        "dimension": currentDimension,
        "index": 0,
        "timestamp": timeInSeconds,
        "text": currentQueryText
      }];
      this.currentQuery = 0
      /* The total amount of query for the current document is set to 1 */
      /* IMPORTANT: the index of the last query inserted for a document will be <amount -1> */
      this.searchEngineQueries[currentDocument]['amount'] = 1
    }
  }

  /*
   * This function intercepts a <resultEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds an array of <BaseResponse> objects, one for each search result.
   * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineRetrievedResponse(retrievedResponseData: Object) {
    /* The current document, dimension and user search engine retrieved response are parsed from the JSON object */
    let currentDocument = parseInt(retrievedResponseData['target']['id'].split("-")[3]);
    let currentDimension = parseInt(retrievedResponseData['target']['id'].split("-")[4]);
    /* A reference to the current dimension is saved */
    this.currentDimension = currentDimension;
    let currentRetrievedResponse = retrievedResponseData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineRetrievedResponses[currentDocument]['groups'] > 0) {
      /* The new response is pushed into current document data array along with its query index */
      let storedResponses = Object.values(this.searchEngineRetrievedResponses[currentDocument]['data']);
      storedResponses.push({
        "dimension": currentDimension,
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "index": storedResponses.length,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse,
      });
      /* The data array within the data structure is updated */
      this.searchEngineRetrievedResponses[currentDocument]['data'] = storedResponses;
      /* The total amount retrieved responses for the current document is updated */
      this.searchEngineRetrievedResponses[currentDocument]['amount'] = this.searchEngineRetrievedResponses[currentDocument]['amount'] + currentRetrievedResponse.length
      /* The total amount of groups of retrieved responses for the current document is updated */
      this.searchEngineRetrievedResponses[currentDocument]['groups'] = storedResponses.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineRetrievedResponses[currentDocument] = {};
      /* A new data array for the current document is created and the fist response is pushed */
      this.searchEngineRetrievedResponses[currentDocument]['data'] = [{
        "dimension": currentDimension,
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "index": 0,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse
      }];
      /* The total amount of retrieved responses for the current document is set to the length of the first group */
      /* IMPORTANT: the index of the last retrieved response for a document will be <amount -1> */
      this.searchEngineRetrievedResponses[currentDocument]['amount'] = currentRetrievedResponse.length
      /* The total amount of groups retrieved responses for the current document is set to 1 */
      this.searchEngineRetrievedResponses[currentDocument]['groups'] = 1
    }
    /* The form control to set the url of the selected search result is enabled */
    this.documentsForm[currentDocument].controls[this.dimensions[this.currentDimension].name.concat("_url")].enable();
  }

  /*
   * This function intercepts a <selectedRowEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the selected search engine result within a given document.
   * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineSelectedResponse(selectedResponseData: Object) {
    /* The current document, dimension and user search engine retrieved response are parsed from the JSON object */
    let currentDocument = parseInt(selectedResponseData['target']['id'].split("-")[3]);
    let currentDimension = parseInt(selectedResponseData['target']['id'].split("-")[4]);
    /* A reference to the current dimension is saved */
    this.currentDimension = currentDimension;
    let currentSelectedResponse = selectedResponseData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
      /* The new response is pushed into current document data array along with its query index */
      let storedResponses = Object.values(this.searchEngineSelectedResponses[currentDocument]['data']);
      storedResponses.push({
        "dimension": currentDimension,
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "index": storedResponses.length,
        "timestamp": timeInSeconds,
        "response": currentSelectedResponse,
      });
      /* The data array within the data structure is updated */
      this.searchEngineSelectedResponses[currentDocument]['data'] = storedResponses;
      /* The total amount of selected responses for the current document is updated */
      this.searchEngineSelectedResponses[currentDocument]['amount'] = storedResponses.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineSelectedResponses[currentDocument] = {};
      /* A new data array for the current document is created and the fist response is pushed */
      this.searchEngineSelectedResponses[currentDocument]['data'] = [{
        "dimension": currentDimension,
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "index": 0,
        "timestamp": timeInSeconds,
        "response": currentSelectedResponse
      }];
      /* The total amount of selected responses for the current document is set to 1 */
      /* IMPORTANT: the index of the last selected response for a document will be <amount -1> */
      this.searchEngineSelectedResponses[currentDocument]['amount'] = 1
    }
    this.documentsForm[currentDocument].controls[this.dimensions[this.currentDimension].name.concat("_url")].setValue(currentSelectedResponse['url']);
  }

  /*
   * This function performs a validation of the worker url field each time the current worker types or pastes in its inside
   * or when he selects one of the responses retrieved by the search engine. If the url present in the field is not equal
   * to an url retrieved by the search engine an <invalidSearchEngineUrl> error is raised.
   * IMPORTANT: the <return null> part means: THE FIELD IS VALID
   */
  public validateSearchEngineUrl(workerUrlFormControl: FormControl) {
    /* If the stepped is initialized to something the task is started */
    if (this.stepper) {
      if (this.stepper.selectedIndex >= this.questionnaireAmount) {
        /* If the worker has interacted with the form control of a dimension */
        if (this.currentDimension) {
          let currentDocument = this.stepper.selectedIndex - this.questionnaireAmount;
          /* If there are data for the current document */
          if (this.searchEngineRetrievedResponses[currentDocument]) {
            let retrievedResponses = this.searchEngineRetrievedResponses[currentDocument];
            if (retrievedResponses.hasOwnProperty("data")) {
              /* The current set of responses is the total amount - 1 */
              let currentSet = retrievedResponses["amount"] - 1;
              /* The responses retrieved by search engine are selected */
              let currentResponses = retrievedResponses["data"][currentSet]["response"];
              let currentDimension = retrievedResponses["data"][currentSet]["dimension"];
              /* Each response is scanned */
              for (let index = 0; index < currentResponses.length; index++) {
                /* As soon as an url that matches with the one selected/typed by the worker for the current dimension the validation is successful */
                if (workerUrlFormControl.value == currentResponses[index].url && this.currentDimension == currentDimension) return null;
              }
              /* If no matching url has been found, raise the error */
              return { invalidSearchEngineUrl: "Select (or copy & paste) one of the URLs shown above." }
            }
            return null
          }
          return null
        }
        return null
      }
      return null
    }
    return null
  }

  public performHighlighting(changeDetector, event: Object, documentIndex: number, annotationDialog, notes, annotator: Annotator) {

    let domElement = null
    let optionChosen = null
    if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
      const selection = document.getSelection();
      if (selection) {
        domElement = document.getElementById(`statement-${documentIndex}`);
      }
    } else {
      domElement = document.getElementById(`statement-${documentIndex}`);
    }

    //check if the selection is an overlay
    if (domElement) {
      let first_clone = document.querySelector(`.statement-text-${documentIndex}`).cloneNode(true) //clone the element

      //Attach the event bindings
      first_clone.addEventListener('mouseup', (e) => this.performHighlighting(changeDetector, event, documentIndex, annotationDialog, notes, annotator))
      first_clone.addEventListener('touchend', (e) => this.performHighlighting(changeDetector, event, documentIndex, annotationDialog, notes, annotator))


      const highlightMade = doHighlight(domElement, true, {

        onAfterHighlight(range, highlight) {
          const selection = document.getSelection();
          if (highlight[0]["outerText"]) { //If something is selected
            selection.empty() //clear the selection

            let notesForDocument = notes[documentIndex]
            let newAnnotation = new Note(documentIndex, range, highlight) //create new note

            //Remove the default yellow background
            let element = <HTMLElement>document.querySelector(`[data-timestamp='${newAnnotation.timestamp_created}']`)
            element.style.backgroundColor = ""
            //

            //Check if the selected text is an overlap of another annotation
            for (let note of notesForDocument) { //check if the note is already annotated
              //
              if (!note.deleted && newAnnotation.quote.includes(note.quote)) { //if the note is arleady annotated
                let element = document.querySelector(`.statement-text-${documentIndex}`) //select the main element
                element.remove()
                document.querySelector(`.tweet_content_li_${documentIndex}`).append(first_clone) //append the element bukupped...

                return true //Exit from the callback!
              }
              //

            }

            notes[documentIndex] = notesForDocument //update the notes of the document
            annotationDialog.open(AnnotationDialog, { //then open the annotation dialog
              width: '80%',
              minHeight: '86%',
              disableClose: true,
              data: {
                annotation: newAnnotation,
                annotator: annotator
              }
            }).afterClosed().subscribe(result => {
              if (result) { //
                newAnnotation.option = result.label
                newAnnotation.color = result.color
                let element = <HTMLElement>document.querySelector(`[data-timestamp='${newAnnotation.timestamp_created}']`)
                element.style.backgroundColor = result.color

                element.style.userSelect = "none" //disable user select to avoid over selection!
                element.style.webkitUserSelect = "none"
                element.style.pointerEvents = "none"
                element.style.touchAction = "none"
                element.style.cursor = "no-drop"

                notesForDocument.push(newAnnotation)
                notes[documentIndex] = notesForDocument
                changeDetector.detectChanges()
                return true
              } else {// if the user click on cancel button, mark the annotation as deleted and remove the highlight
                let element = document.querySelector(`[data-timestamp='${newAnnotation.timestamp_created}']`)
                element.parentNode.insertBefore(document.createTextNode(newAnnotation.quote), element);
                element.remove()
                return true
              }

            })
          }
        }
      });
    }
  }

  public removeAnnotation(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    currentNote.markDeleted()

    currentNote.timestamp_deleted = Date.now()
    let element = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
    element.parentNode.insertBefore(document.createTextNode(currentNote.quote), element);
    element.remove()


  }

  public checkUndeletedNotesPresence(notes) {
    let undeletedNotes = false
    for (let note of notes) {
      if (note.deleted == false) {
        undeletedNotes = true
        break
      }
    }
    return undeletedNotes
  }


  /* |--------- QUALITY CHECKS INTEGRATION - FUNCTIONS ---------| */

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
   * This function performs the checks needed to ensure that the worker has made a quality work.
   * Three checks are performed:
   * 1) GLOBAL VALIDITY CHECK (QUESTIONNAIRE + DOCUMENTS): Verifies that each field of each form has valid values
   * 2) GOLD QUESTION CHECK:   Verifies if the truth value selected by worker for the gold question obviously false
   *                           is lower that the value selected for the gold question obviously true, for each dimension
   * 3) TIME SPENT CHECK:      Verifies if the time spent by worker on each document and questionnaire is higher than
   *                           <timeCheckAmount> seconds, using the <timestampsElapsed> array
   * If each check is successful, the task can end. If the worker has some tries left, the task is reset.
   */
  public async performQualityCheck() {

    /* The loading spinner is started */
    this.ngxService.startLoader('skeleton');

    /* The current try is completed and the final can shall begin */
    this.taskCompleted = true;

    /* Booleans to hold result of checks */
    let globalValidityCheck: boolean;
    let goldQuestionCheck: boolean;
    let timeSpentCheck: boolean;
    let timeCheckAmount = this.timeCheckAmount;

    let computedChecks = []

    /* 1) GLOBAL VALIDITY CHECK performed here - MANDATORY CHECK */
    globalValidityCheck = this.performGlobalValidityCheck();
    computedChecks.push(globalValidityCheck)

    /* 2) GOLD QUESTION CHECK performed here - OPTIONAL CHECK */

    // console.log(this.goldIndex)
    // console.log("DOCUMENT: " + JSON.stringify(this.documents[this.goldIndex]))

    this.notes[this.goldIndex].forEach(item => {

      if (item.option == 'ade') {
        "['" + item.quote.replace(/\s+/g, '') + "']" == this.documents[this.goldIndex].adr_text
          ? goldQuestionCheck = true
          : goldQuestionCheck = false

      } else if (item.option == 'drug') {

        "['" + item.quote.replace(/\s+/g, '') + "']" == this.documents[this.goldIndex].drug_text
          ? goldQuestionCheck = true
          : goldQuestionCheck = false

      }
      computedChecks.push(goldQuestionCheck)
    });


    // for (let dimension of this.dimensions) {

    //   if (dimension.goldQuestionCheck) {
    //     goldQuestionCheck = this.documentsForm[this.goldIndexLow].controls[dimension.name.concat('_value')].value < this.documentsForm[this.goldIndexHigh].controls[dimension.name.concat('_value')].value;

    //     // goldQuestionCheck = this.documentsForm[this.goldIndex].controls[dimension.]

    //     //console.log("goldCheck: " + goldQuestionCheck)
    //     computedChecks.push(goldQuestionCheck)
    //   }
    // }

    /* 3) TIME SPENT CHECK performed here - MANDATORY CHECK */
    timeSpentCheck = true;
    for (let i = 0; i < this.timestampsElapsed.length; i++) if (this.timestampsElapsed[i] < timeCheckAmount) timeSpentCheck = false;
    computedChecks.push(timeSpentCheck)

    /* If each check is true, the task is successful, otherwise the task is failed (but not over if there are more tries) */
    let checker = array => array.every(Boolean);
    if (checker(computedChecks)) {
      this.taskSuccessful = true;
      this.taskFailed = false;
    } else {
      this.taskSuccessful = false;
      this.taskFailed = true;
    }

    /* The result of quality check control for the current try is uploaded to the Amazon S3 bucket. */
    if (!(this.worker.identifier === null)) {
      let qualityCheckData = {
        globalFormValidity: globalValidityCheck,
        goldQuestionCheck: goldQuestionCheck,
        timeSpentCheck: timeSpentCheck,
        timeCheckAmount: timeCheckAmount,
      };
      let uploadStatus = await this.S3Service.uploadQualityCheck(
        this.configService.environment,
        this.worker,
        qualityCheckData,
        this.currentTry
      )
    }

    /* Detect changes within the DOM and stop the spinner */
    this.changeDetector.detectChanges();

    /* The loading spinner is stopped */
    this.ngxService.stopLoader('skeleton');

  }

  /*
   * This function resets the task by bringing the worker to the first document if he still has some available tries.
   * The worker can trigger this operation by clicking the "Reset" button when quality checks are completed and the outcome is shown.
   */
  public performReset() {

    /* |--- COUNTDOWN ---| */
    if (this.settings.countdownTime) {
      if (this.countdown.toArray()[0].left > 0) {
        this.countdown.toArray()[0].resume();
      }
    }

    /* The loading spinner is started */
    this.ngxService.startLoader('skeleton');

    /* Control variables to restore the state of task */
    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted = true;
    this.comment.setValue("");
    this.commentSent = false;

    /* Set stepper index to the first tab (currentDocument.e., bring the worker to the first document after the questionnaire) */
    this.stepper.selectedIndex = this.questionnaireAmount;

    /* Decrease the remaining tries amount*/
    this.allowedTries = this.allowedTries - 1;

    /* Increases the current try index */
    this.currentTry = this.currentTry + 1;

    /* The loading spinner is stopped */
    this.ngxService.stopLoader('skeleton');

  }

  // |--------- AMAZON AWS INTEGRATION - FUNCTIONS ---------|

  /*
   * This function interacts with an Amazon S3 bucket to store each data produced within the task.
   * A folder on the bucket is created for each worker identifier and such folders contain .json files.
   * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
   * Moreover, this function stores the timestamps used to check how much time the worker spends on each document.
   * The "Final" folder is filled with a full task snapshot at the end of each allowed try.
   * The "Partial" folder contains a snapshot of the current document each time a user clicks on a "Back" or "Next" button.
   */
  public async performLogging(action: string) {

    /* |--- COUNTDOWN ---| */
    if ((this.stepper.selectedIndex >= this.questionnaireAmount) && this.settings.countdownTime) {
      let currentIndex = this.stepper.selectedIndex - this.questionnaireAmount;
      switch (action) {
        case "Next":
          if (currentIndex > 0 && this.countdown.toArray()[currentIndex - 1].left > 0) {
            this.countdown.toArray()[currentIndex - 1].pause();
          }
          if (this.countdown.toArray()[currentIndex].left == this.settings.countdownTime) {
            this.countdown.toArray()[currentIndex].begin();
          } else if (this.countdown.toArray()[currentIndex].left > 0) {
            this.countdown.toArray()[currentIndex].resume();
          }
          break;
        case "Back":
          if (this.countdown.toArray()[currentIndex + 1].left > 0) {
            this.countdown.toArray()[currentIndex + 1].pause();
          }
          if (this.countdown.toArray()[currentIndex].left == this.settings.countdownTime) {
            this.countdown.toArray()[currentIndex].begin();
          } else if (this.countdown.toArray()[currentIndex].left > 0) {
            this.countdown.toArray()[currentIndex].resume();
          }
          break;
        case "Finish":
          if (this.countdown.toArray()[currentIndex - 1].left > 0) {
            this.countdown.toArray()[currentIndex - 1].pause();
          }
          break;
      }
    }

    if (!(this.worker.identifier === null)) {

      /*
       * IMPORTANT: The current document index is the stepper current index AFTER the transition
       * If a NEXT action is performed at document 3, the stepper current index is 4.
       * If a BACK action is performed at document 3, the stepper current index is 2.
       * This is tricky only for the following switch which has to set the start/end
       * timestamps for the previous/following document.
       */
      let currentElement = this.stepper.selectedIndex;
      /* completedElement is the index of the document/questionnaire in which the user was before */
      let completedElement = this.stepper.selectedIndex;

      switch (action) {
        case "Next":
          completedElement = currentElement - 1;
          break;
        case "Back":
          completedElement = currentElement + 1;
          break;
        case "Finish":
          completedElement = this.questionnaireAmount + this.documentsAmount - 1;
          currentElement = this.questionnaireAmount + this.documentsAmount - 1;
          break;
      }

      let timeInSeconds = Date.now() / 1000;
      switch (action) {
        case "Next":
          /*
           * If a transition to the following document is performed the current timestamp is:
           * the start timestamp for the document at <stepper.selectedIndex>
           * the end timestamps for the document at <stepper.selectedIndex - 1>
           */
          this.timestampsStart[currentElement].push(timeInSeconds);
          this.timestampsEnd[completedElement].push(timeInSeconds);
          break;
        case "Back":
          /*
           * If a transition to the previous document is performed the current timestamp is:
           * the start timestamp for the document at <stepper.selectedIndex>
           * the end timestamps for the document at <stepper.selectedIndex + 1>
           */
          this.timestampsStart[currentElement].push(timeInSeconds);
          this.timestampsEnd[completedElement].push(timeInSeconds);
          break;
        case "Finish":
          /* If the task finishes, the current timestamp is the end timestamp for the current document. */
          this.timestampsEnd[currentElement].push(timeInSeconds);
          break;
      }

      /*
       * The general idea with start and end timestamps is that each time a worker goes to
       * the next document, the current timestamp is the start timestamp for such document
       * and the end timestamp for the previous and viceversa
       */

      /* In the corresponding array the elapsed timestamps for each document are computed */
      for (let i = 0; i < this.documentsAmount + this.questionnaireAmount; i++) {
        let totalSecondsElapsed = 0;
        for (let k = 0; k < this.timestampsEnd[i].length; k++) {
          if (this.timestampsStart[i][k] !== null && this.timestampsEnd[i][k] !== null) {
            totalSecondsElapsed = totalSecondsElapsed + (Number(this.timestampsEnd[i][k]) - Number(this.timestampsStart[i][k]))
          }
        }
        this.timestampsElapsed[i] = totalSecondsElapsed
      }

      /* If the worker has completed a questionnaire */
      if (completedElement < this.questionnaireAmount) {

        /* The amount of accesses to the current questionnaire is retrieved */
        let accessesAmount = this.elementsAccesses[completedElement];

        /* If the worker has completed the first questionnaire */
        if (completedElement == 0) {

          let data = {}

          /* The full information about task setup (currentDocument.e., its document and questionnaire structures) are uploaded, only once */
          let taskData = {
            task_id: this.taskName,
            batch_name: this.batchName,
            worker_id: this.worker.identifier,
            unit_id: this.unitId,
            token_input: this.tokenInput.value,
            token_output: this.tokenOutput,
            tries_amount: this.allowedTries,
            questionnaire_amount: this.questionnaireAmount,
            documents_amount: this.documentsAmount,
            dimensions_amount: this.dimensionsAmount,
          };
          /* General info about task */
          data["task"] = taskData
          /* await (this.upload(`${this.workerFolder}/task.json`, taskData)); */
          /* The answers of the current worker to the questionnaire */
          data["questionnaires"] = this.questionnaires
          /* await (this.upload(`${this.workerFolder}/questionnaires.json`, this.questionnaires)); */
          /* The parsed document contained in current worker's hit */
          data["documents"] = this.documents
          /* await (this.upload(`${this.workerFolder}/documents.json`, this.documents)); */
          /* The dimensions of the answers of each worker */
          data["dimensions"] = this.dimensions
          /* await (this.upload(`${this.workerFolder}/dimensions.json`, this.dimensions)); */
          /* General info about worker */
          data["worker"] = this.worker
          /* await (this.upload(`${this.workerFolder}/worker.json`, this.worker)); */

          let uploadStatus = await this.S3Service.uploadTaskData(this.configService.environment, this.worker, data)

        }

        /* The partial data about the completed questionnaire are uploaded */

        let data = {}

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedElement,
          sequence: this.sequenceNumber,
          element: "questionnaire"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's answers to the current questionnaire */
        let answers = this.questionnairesForm[completedElement].value;
        data["answers"] = answers
        /* Start, end and elapsed timestamps for the current questionnaire */
        let timestampsStart = this.timestampsStart[completedElement];
        data["timestamps_start"] = timestampsStart
        let timestampsEnd = this.timestampsEnd[completedElement];
        data["timestamps_end"] = timestampsEnd
        let timestampsElapsed = this.timestampsElapsed[completedElement];
        data["timestamps_elapsed"] = timestampsElapsed
        /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
        data["accesses"] = accessesAmount + 1

        let uploadStatus = await this.S3Service.uploadQuestionnaire(this.configService.environment, this.worker, data, false, this.currentTry, completedElement, accessesAmount + 1, this.sequenceNumber)

        /* The amount of accesses to the current questionnaire is incremented */
        this.sequenceNumber = this.sequenceNumber + 1
        this.elementsAccesses[completedElement] = accessesAmount + 1;

        /* If the worker has completed a document */
      } else {

        if (this.questionnaireAmount == 0) {

          let data = {}

          /* The full information about task setup (currentDocument.e., its document and questionnaire structures) are uploaded, only once */
          let taskData = {
            task_id: this.taskName,
            batch_name: this.batchName,
            worker_id: this.worker.identifier,
            unit_id: this.unitId,
            token_input: this.tokenInput.value,
            token_output: this.tokenOutput,
            tries_amount: this.allowedTries,
            questionnaire_amount: this.questionnaireAmount,
            documents_amount: this.documentsAmount,
            dimensions_amount: this.dimensionsAmount,
          };
          /* General info about task */
          data["task"] = taskData
          /* await (this.upload(`${this.workerFolder}/task.json`, taskData)); */
          /* The answers of the current worker to the questionnaire */
          data["questionnaires"] = this.questionnaires
          /* await (this.upload(`${this.workerFolder}/questionnaires.json`, this.questionnaires)); */
          /* The parsed document contained in current worker's hit */
          data["documents"] = this.documents
          /* await (this.upload(`${this.workerFolder}/documents.json`, this.documents)); */
          /* The dimensions of the answers of each worker */
          data["dimensions"] = this.dimensions
          /* await (this.upload(`${this.workerFolder}/dimensions.json`, this.dimensions)); */
          /* General info about worker */
          data["worker"] = this.worker
          /* await (this.upload(`${this.workerFolder}/worker.json`, this.worker)); */

          let uploadStatus = await this.S3Service.uploadTaskData(this.configService.environment, this.worker, data)

        }

        /* The amount of accesses to the current document is retrieved */
        let accessesAmount = this.elementsAccesses[completedElement];

        /* The index of the completed document is the completed element minus the questionnaire amount */
        let completedDocument = completedElement - this.questionnaireAmount;

        let data = {}

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedElement,
          sequence: this.sequenceNumber,
          element: "document"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's truth level and justification for the current document */
        let answers = this.documentsForm[completedDocument].value;
        data["answers"] = answers
        let notes = this.notes[completedDocument]
        data["notes"] = notes
        /* Worker's dimensions selected values for the current document */
        let dimensionsSelectedValues = this.dimensionsSelectedValues[completedDocument];
        data["dimensions_selected"] = dimensionsSelectedValues
        /* Worker's search engine queries for the current document */
        let searchEngineQueries = this.searchEngineQueries[completedDocument];
        data["queries"] = searchEngineQueries
        /* Start, end and elapsed timestamps for the current document */
        let timestampsStart = this.timestampsStart[completedElement];
        data["timestamps_start"] = timestampsStart
        let timestampsEnd = this.timestampsEnd[completedElement];
        data["timestamps_end"] = timestampsEnd
        let timestampsElapsed = this.timestampsElapsed[completedElement];
        data["timestamps_elapsed"] = timestampsElapsed
        let countdownTime = (this.settings.countdownTime) ? Number(this.countdown[completedElement]["i"]["text"]) : null
        data["countdowns_times"] = countdownTime
        let countdown_expired = this.countdownsExpired[completedElement]
        data["countdowns_expired"] = countdown_expired
        /* Number of accesses to the current document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        let accesses = accessesAmount + 1
        data["accesses"] = accesses
        /* Responses retrieved by search engine for each worker's query for the current document */
        let responsesRetrieved = this.searchEngineRetrievedResponses[completedDocument];
        data["responses_retrieved"] = responsesRetrieved
        /* Responses by search engine ordered by worker's click for the current document */
        let responsesSelected = this.searchEngineSelectedResponses[completedDocument];
        data["responses_selected"] = responsesSelected

        let uploadStatus = await this.S3Service.uploadDocument(this.configService.environment, this.worker, data, false, this.currentTry, completedElement, accessesAmount + 1, this.sequenceNumber)

        /* The amount of accesses to the current document is incremented */
        this.elementsAccesses[completedElement] = accessesAmount + 1;
        this.sequenceNumber = this.sequenceNumber + 1

        /* If the worker has completed the last document */
        if (completedElement == this.questionnaireAmount + this.documentsAmount - 1) {

          /* The amount of accesses to the current document is incremented */
          this.elementsAccesses[completedElement] = accessesAmount + 1;
          this.sequenceNumber = this.sequenceNumber + 1

          data = {}

          /* All data about documents are uploaded, only once */
          let actionInfo = {
            action: action,
            access: accessesAmount + 1,
            try: this.currentTry,
            index: completedElement,
            sequence: this.sequenceNumber,
            element: "document"
          };
          /* Info about each performed action ("Next"? "Back"? From where?) */
          data["info"] = actionInfo
          let answers = [];
          for (let index = 0; index < this.questionnairesForm.length; index++) answers.push(this.questionnairesForm[index].value);
          data["questionnaires_answers"] = answers
          answers = [];
          for (let index = 0; index < this.documentsForm.length; index++) answers.push(this.documentsForm[index].value);
          data["documents_answers"] = answers
          let notes = this.notes
          data["notes"] = notes
          /* Worker's dimensions selected values for the current document */
          data["dimensions_selected"] = this.dimensionsSelectedValues
          /* Start, end and elapsed timestamps for each document */
          data["timestamps_start"] = this.timestampsStart
          /* await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/timestamps_start.json`, this.timestampsStart)); */
          data["timestamps_end"] = this.timestampsEnd
          /* await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/timestamps_end.json`, this.timestampsEnd)); */
          data["timestamps_elapsed"] = this.timestampsElapsed
          let countdownTimes = [];
          if (this.settings.countdownTime)
            for (let index = 0; index < this.countdown.length; index++) countdownTimes.push(Number(this.countdown[index]["i"]["text"]));
          data["countdowns_times"] = countdownTimes
          data["countdowns_expired"] = this.countdownsExpired
          /* Number of accesses to each document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
          data["accesses"] = this.elementsAccesses
          /* Worker's search engine queries for each document */
          data["queries"] = this.searchEngineQueries
          /* Responses retrieved by search engine for each worker's query for each document */
          data["responses_retrieved"] = this.searchEngineRetrievedResponses
          /* Responses by search engine ordered by worker's click for the current document */
          data["responses_selected"] = this.searchEngineSelectedResponses

          let uploadStatus = await this.S3Service.uploadDocument(this.configService.environment, this.worker, data, true, this.currentTry)

        }

      }

    }
  }

  /*
   * This function gives the possibility to the worker to provide a comment when a try is finished, successfully or not.
   * The comment can be typed in a textarea and when the worker clicks the "Send" button such comment is uploaded to an Amazon S3 bucket.
   */
  public async performCommentSaving() {
    let uploadStatus = await this.S3Service.uploadComment(this.configService.environment, this.worker, this.commentForm.value, this.currentTry)
    this.commentSent = true;
  }

  /* |--------- UTILITIES ELEMENTS - FUNCTIONS ---------| */

  protected getControlGroup(c: AbstractControl): FormGroup | FormArray {
    return c.parent;
  }

  /*
   * This function retrieves the string associated to an error code thrown by a form field validator.
   */
  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

  public capitalize(word: string) {
    if (!word) return word;
    let text = word.split("-")
    let str = ""
    for (word of text) str = str + " " + word[0].toUpperCase() + word.substr(1).toLowerCase();
    return str.trim()
  }

  /* |--- COUNTDOWN ---| */
  public handleCountdown(event, i) {
    if (event.left == 0) {
      this.countdownsExpired[i] = true
    }
  }

  public showSnackbar(message, action, duration) {
    this.snackBar.open(message, action, {
      duration: duration,
    });
  }

}

/* Component HTML Tag definition */
@Component({
  selector: 'app-annotation-dialog',
  styleUrls: ['annotation-dialog.component.scss'],
  templateUrl: 'annotation-dialog.component.html',
  encapsulation: ViewEncapsulation.None
})

export class AnnotationDialog {

  annotation: Note
  annotator: Annotator

  /* |---------  ELEMENTS - DECLARATION ---------| */

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialogRef: MatDialogRef<AnnotationDialog>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.annotation = data["annotation"]
    this.annotator = data["annotator"]
  }

  /* |--------- ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function closes the modal previously opened.
   */
  closeDialog(): void {
    this.dialogRef.close();
  }

}
