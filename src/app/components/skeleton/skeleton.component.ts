/* Core modules */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewChild,
  ViewChildren,
  QueryList, OnInit
} from "@angular/core";
/* Reactive forms modules */
import {AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
import {CountdownComponent} from 'ngx-countdown';
/* Services */
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {ConfigService} from "../../services/config.service";
import {S3Service} from "../../services/s3.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Task models */
import {Document} from "../../../../data/build/skeleton/document";
import {Hit} from "../../models/hit";
import {Questionnaire} from "../../models/questionnaire";
import {Dimension, ScaleInterval, ScaleMagnitude, Style} from "../../models/dimension";
import {Instruction} from "../../models/instructions";
import {Note} from "../../models/notes";
import {Worker} from "../../models/worker";
import {Annotator, SettingsTask} from "../../models/settingsTask";
import {GoldChecker} from "../../../../data/build/skeleton/goldChecker";
import {ActionLogger} from "../../services/userActionLogger.service";
/* Annotator functions */
import {doHighlight} from "@funktechno/texthighlighter/lib";
/* HTTP Client */
import {HttpClient, HttpHeaders} from "@angular/common/http";
/* Material modules */
import {MatSnackBar} from "@angular/material/snack-bar";
import {NoteStandard} from "../../models/notes_standard";
import {NoteLaws} from "../../models/notes_laws";
import {MatRadioChange} from "@angular/material/radio";
import {MatCheckboxChange} from "@angular/material/checkbox";
import {ButtonDirective} from "./skeleton.directive";
import {SectionService} from "../../services/section.service";
import CryptoES from "crypto-es";
import algo = CryptoES.algo;


/* Component HTML Tag definition */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  /* Service to detect user's device */
  deviceDetectorService: DeviceDetectorService;
  /* Service to log to the server */
  actionLogger: ActionLogger
  /* Service to track current section */
  sectionService: SectionService

  /* HTTP client and headers */
  client: HttpClient;
  headers: HttpHeaders;

  /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
  formBuilder: FormBuilder;

  /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

  /* References to task stepper and token forms */
  @ViewChild('stepper') stepper: MatStepper;
  @ViewChild('urlField') urlField: MatFormField;
  tokenForm: FormGroup;
  tokenInput: FormControl;
  tokenOutput: string;
  tokenInputValid: boolean;

  /* Snackbar reference */
  snackBar: MatSnackBar;

  /* |--------- WORKER ATTRIBUTES - DECLARATION ---------| */

  /* Unique identifier of the current worker */
  workerIdentifier: string;

  /* Object to encapsulate all worker-related information */
  worker: Worker

  /* |--------- HIT ELEMENTS - DECLARATION - (see: hit.json) ---------| */

  /* Reference to the current hit */
  hit: Hit;
  /* Identifier of the current hit */
  unitId: string;
  /* Number of the current try */
  currentTry: number;

  /* Array of form references, one for each document within a Hit */
  documentsForm: FormGroup[];
  /* Amount of documents within a hit */
  documentsAmount: number;
  /* Array of documents */
  documents: Array<Document>;

  /* Arrays to record timestamps, one for each document within a Hit */
  timestampsStart: Array<Array<number>>;
  timestampsEnd: Array<Array<number>>;
  timestampsElapsed: Array<number>;

  /* |--------- INSTRUCTIONS MAIN - DECLARATION - (see: instructions_main.json) ---------| */

  /* Array of task instructions. Each object represents a paragraph with an optional caption made of steps */
  taskInstructions: Array<Instruction>;
  /* Amount of different instruction paragraphs */
  taskInstructionsAmount: number;
  /* Check to understand if the worker click on Next after looking at the main instruction page */
  //taskInstructionsRead: boolean;  <--- IMPLEMENTED IN SectionService

  /* |--------- INSTRUCTIONS DIMENSIONS - DECLARATION - (see: instructions_dimensions.json) ---------| */

  /* Array of evaluation instructions. Each object represents a paragraph with an optional caption made of steps */
  instructions: Array<Instruction>;
  /* Amount of evaluation instructions paragraphs */
  instructionsAmount: number;

  /* |--------- QUESTIONNAIRE ELEMENTS - DECLARATION - (see: questionnaires.json) ---------| */

  /* Array of form references, one for each questionnaire within a Hit */
  questionnairesForm: FormGroup[];
  /* Reference to the current questionnaires */
  questionnaires: Array<Questionnaire>;
  /* Number of different questionnaires inserted within task's body */
  questionnaireAmount: number;
  questionnaireAmountStart: number;
  questionnaireAmountEnd: number;

  /* |--------- DIMENSIONS ELEMENTS - DECLARATION - (see: dimensions.json) ---------| */

  /* Array of dimensions to be assessed */
  dimensions: Array<Dimension>;
  /* Amount of dimensions to be assessed */
  dimensionsAmount: number;
  /* Selected values for each dimension. Used to reconstruct worker's behavior. */
  dimensionsSelectedValues: Array<object>;
  /* Reference to the current dimension */
  currentDimension: number;

  /* Array of accesses counters, one for each element (questionnaire + documents) */
  elementsAccesses: Array<number>;

  /* |--------- SEARCH ENGINE INTEGRATION - DECLARATION - (see: search_engine.json | https://github.com/Miccighel/CrowdXplorer) ---------| */

  /* Array to store search engine queries and responses, one for each document within a Hit */
  searchEngineQueries: Array<object>;
  /* Reference to the current query */
  currentQuery: number
  /* Array to store the responses retrieved by the search engine */
  searchEngineRetrievedResponses: Array<object>;
  /* Array to store the responses selected by workers within search engine results */
  searchEngineSelectedResponses: Array<object>;
  /* Flag to check if the query returned some results */
  resultsFound: boolean;

  /* |--------- TASK SETTINGS - DECLARATION - (see task.json)---------| */

  /* Name of the current task */
  taskName: string;

  /* Batch name of the current task */
  batchName: string;

  /* Settings of the current task */
  settings: SettingsTask

  /* Number of allowed tries */
  allowedTries: number;

  /* Time allowed to be spent on each document */
  timeCheckAmount: number;

  /* Batches to blacklist */
  blacklistBatches: Array<string>

  /* Batches to whitelist */
  whitelistBatches: Array<string>

  /* Optional countdown to use for each document */
  countdownTime: number
  documentsTime : Array<number>

  /* Optional document time value for each document */
  timeOfDocument : number

  /* References to the HTML elements */
  @ViewChildren('countdownElement') countdown: QueryList<CountdownComponent>;
  /* Array of checks to see if the countdowns are expired; one for each document */
  countdownsExpired: Array<boolean>;

  /* Object to encapsulate annotator's settings */
  annotator: Annotator
  /* Available options to label an annotation */
  annotationOptions: FormGroup;
  /* Arrays to store user annotations, one for each document within a Hit */
  notes: Array<Array<Note>>
  /* Array of checks to understand if the annotation button should be disabled, one for each document */
  annotationButtonsDisabled: Array<boolean>

  notesDone: boolean[];
  colors: string[] = ["#F36060", "#DFF652", "#FFA500", "#FFFF7B"]

  /* |--------- COMMENT ELEMENTS - DECLARATION ---------| */

  /* Final comment form reference */
  commentForm: FormGroup;
  /* Final comment form textarea */
  comment: FormControl;
  /* Flag to check if the comment has been correctly sent to S3 */
  commentSent: boolean;

  /* |--------- QUALITY CHECKS - DECLARATION ---------| */

  /* Array of gold documents within a Hit */
  goldDocuments: Array<Document>;
  /* Array of gold dimensions within a Hit */
  goldDimensions: Array<Dimension>;

  /* |--------- LOGGING ELEMENTS - DECLARATION ---------| */
  sequenceNumber: number
  logger: boolean
  loggerOpt: Object
  logOnConsole: boolean
  serverEndpoint: string

  /* |--------- CONFIGURATION GENERATOR INTEGRATION - DECLARATION ---------| */

  /* Check to understand if the generator or the skeleton should be loader */
  generator: boolean;

  /* |--------- OTHER AMENITIES - DECLARATION ---------| */

  /* Font awesome spinner icon */
  faSpinner: Object;
  /* Font awesome infoCircle icon */
  faInfoCircle: Object;

  /* |--------- CONSTRUCTOR IMPLEMENTATION ---------| */

  /* When using Angular the construct is deputed to initialize elements for which the UI does not need to be initialized */

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
    deviceDetectorService: DeviceDetectorService,
    client: HttpClient,
    formBuilder: FormBuilder,
    snackBar: MatSnackBar,
    actionLogger: ActionLogger,
    sectionService: SectionService
  ) {
    /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

    this.changeDetector = changeDetector;
    this.ngxService = ngxService;
    this.configService = configService;
    this.S3Service = S3Service;

    this.actionLogger = actionLogger

    this.sectionService = sectionService

    this.deviceDetectorService = deviceDetectorService;
    this.client = client;
    this.formBuilder = formBuilder;

    this.snackBar = snackBar

    this.ngxService.start();

    /* |--------- CONTROL FLOW & UI ELEMENTS - INITIALIZATION ---------| */

    this.tokenInput = new FormControl('', [Validators.required, Validators.maxLength(11)], this.validateTokenInput.bind(this));
    this.tokenForm = formBuilder.group({
      "tokenInput": this.tokenInput
    });
    this.tokenInputValid = false;

    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    /* |--------- HIT ELEMENTS - INITIALIZATION - (see: hit.json) ---------| */

    this.currentTry = 1;

    /* |--------- SEARCH ENGINE INTEGRATION - INITIALIZATION - (see: search_engine.json | https://github.com/Miccighel/CrowdXplorer) ---------| */

    this.resultsFound = false;

    /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

    this.comment = new FormControl('');
    this.commentForm = formBuilder.group({
      "comment": this.comment,
    });

    /* |--------- LOGGING ELEMENTS - INITIALIZATION ---------| */

    this.sequenceNumber = 0
    this.logOnConsole = this.configService.environment.logOnConsole
    this.serverEndpoint = this.configService.environment.server_endpoint

    /* |--------- CONFIGURATION GENERATOR INTEGRATION - INITIALIZATION ---------| */

    this.generator = false;

  }

  /* |--------- MAIN FLOW IMPLEMENTATION ---------| */

  /* To follow the execution flow of the skeleton the functions needs to be read somehow in order (i.e., from top to bottom) */
  public async ngOnInit() {

    this.ngxService.start()

    let url = new URL(window.location.href);

    /* The task settings are loaded */
    this.loadSettings().then(() => {
      this.workerIdentifier = url.searchParams.get("workerID");

      // Log session start
      if(this.logger)
        this.logInit(this.workerIdentifier, this.taskName, this.batchName, this.client, this.serverEndpoint, this.logOnConsole);
      else
        this.actionLogger = null;

      /* If there is an external worker which is trying to perform the task, check its status */
      if (!(this.workerIdentifier === null)) {
        /* The performWorkerStatusCheck function checks worker's status and its result is interpreted as a success|error callback */
        this.performWorkerStatusCheck().then(taskAllowed => {
          /* But at the end of the day it's just a boolean so we launch a call to Cloudflare to trace the worker and we use such boolean in the second callback */
          this.client.get('https://www.cloudflare.com/cdn-cgi/trace', {responseType: 'text'}).subscribe(
            /* If we retrieve some data from Cloudflare we use them to populate worker's object */
            cloudflareData => {
              this.worker = new Worker(this.workerIdentifier, this.S3Service.getWorkerFolder(this.configService.environment, null, this.workerIdentifier), cloudflareData, window.navigator, this.deviceDetectorService.getDeviceInfo())
              this.sectionService.taskAllowed = taskAllowed
              this.sectionService.checkCompleted = true

              this.changeDetector.detectChanges()
              /* The loading spinner is stopped */
              this.ngxService.stop();
            },
            /* Otherwise we won't have such information */
            error => {
              this.worker = new Worker(this.workerIdentifier, this.S3Service.getWorkerFolder(this.configService.environment, null, this.workerIdentifier), null, window.navigator, this.deviceDetectorService.getDeviceInfo())
              this.sectionService.taskAllowed = taskAllowed
              this.sectionService.checkCompleted = true

              this.changeDetector.detectChanges()
              /* The loading spinner is stopped */
              this.ngxService.stop();
            }
          )
        })
        /* If there is not any worker ID we simply load the task. A sort of testing mode. */
      } else {
        this.worker = new Worker(null, null, null, null, null)
        this.sectionService.checkCompleted = true

        this.changeDetector.detectChanges()
        this.ngxService.stop()
      }
    })

    /* |--------- INSTRUCTIONS MAIN (see: instructions_main.json) ---------| */

    let rawTaskInstructions = await this.S3Service.downloadGeneralInstructions(this.configService.environment);
    this.taskInstructionsAmount = rawTaskInstructions.length;
    /* The instructions are parsed using the Instruction class */
    this.taskInstructions = new Array<Instruction>();
    for (let index = 0; index < this.taskInstructionsAmount; index++) {
      this.taskInstructions.push(new Instruction(index, rawTaskInstructions[index]));
    }

    this.changeDetector.detectChanges()

  }

  /*
  * This function interacts with an Amazon S3 bucket to retrieve and initialize the settings for the current task.
  */
  public async loadSettings() {
    this.settings = new SettingsTask(await this.S3Service.downloadTaskSettings(this.configService.environment))
    this.allowedTries = this.settings.allowed_tries
    this.timeCheckAmount = this.settings.time_check_amount
    this.blacklistBatches = this.settings.blacklist_batches
    this.whitelistBatches = this.settings.whitelist_batches
    this.countdownTime = this.settings.countdown_time
    this.annotator = this.settings.annotator
    this.logger = this.settings.logger
  }

  /*
  * This function interacts with an Amazon S3 bucket to perform a check on the current worker identifier.
  * If the worker has already started the task in the past he is not allowed to continue the task.
  */
  public async performWorkerStatusCheck() {
    /* The worker identifiers of the current task are downloaded */
    let currentWorkers = await this.S3Service.downloadWorkers(this.configService.environment)

    /* Legacy version of this software used a "started" attributed to generate a dictionary instead of a "blacklist" attribute */
    if ('started' in currentWorkers) {
      currentWorkers['blacklist'] = currentWorkers['started']
      delete currentWorkers['started']
    }

    let blacklistedInCurrentTask = false;

    /* Check if the worker is blacklisted within the current task */
    for (let currentWorker of currentWorkers['blacklist']) if (currentWorker == this.workerIdentifier) blacklistedInCurrentTask = true;

    /* If he is not blacklisted in the current back the check can continue for the previous batches */
    if (!blacklistedInCurrentTask) {

      /* If the current worker was blacklisted in a previous batch he must be blocked... */
      for (let blacklistBatch of this.blacklistBatches) {
        let blacklistedWorkers = await this.S3Service.downloadWorkers(this.configService.environment, blacklistBatch)
        for (let currentWorker of blacklistedWorkers['blacklist']) {
          if (currentWorker == this.workerIdentifier) {
            if (!currentWorkers["blacklist"].includes(this.workerIdentifier))
              currentWorkers['blacklist'].push(this.workerIdentifier);
          }
        }
      }

      for (let whitelistBatch of this.whitelistBatches) {
        let whitelistedWorkers = await this.S3Service.downloadWorkers(this.configService.environment, whitelistBatch)
        for (let currentWorker of whitelistedWorkers['blacklist']) {
          if (currentWorker == this.workerIdentifier) {
            if (!currentWorkers["whitelist"].includes(this.workerIdentifier))
              currentWorkers['whitelist'].push(this.workerIdentifier);
          }
        }
      }

      /* If the worker was not blacklisted he is allowed to perform the task */
      if (!currentWorkers["blacklist"].includes(this.workerIdentifier)) {
        currentWorkers['blacklist'].push(this.workerIdentifier);
        let uploadStatus = await this.S3Service.uploadWorkers(this.configService.environment, currentWorkers);
        return true;
      } else {
        /* If the worker was blacklisted within a previous batch but whitelisted within the current batch he is allowed to perform the task */
        if (currentWorkers["blacklist"].includes(this.workerIdentifier) && currentWorkers["whitelist"].includes(this.workerIdentifier)) {
          let uploadStatus = await this.S3Service.uploadWorkers(this.configService.environment, currentWorkers);
          return true
        } else {
          let uploadStatus = await this.S3Service.uploadWorkers(this.configService.environment, currentWorkers);
          return false
        }
      }

    } else {
      /* If a returning worker for the current batch is found he is not allowed to perform the task */
      return false
    }
  }

  /*
   * This function enables the task when the worker clicks on "Proceed" inside the main instructions page.
   */
  public enableTask() {
    this.sectionService.taskInstructionsRead = true
    this.showSnackbar("If you have a very slow internet connection please wait a few seconds before clicking \"Start\".", "Dismiss", 15000)
  }

  /*
  * This function interacts with an Amazon S3 bucket to search the token input
  * typed by the user inside within the hits.json file stored in the bucket.
  * If such token cannot be found, an error message is returned.
  */
  public async validateTokenInput(control: FormControl) {
    let hits = await this.S3Service.downloadHits(this.configService.environment)
    for (let hit of hits) if (hit.token_input === control.value) return null;
    return {"invalid": "This token is not valid."}
  }

  /*
  *  This function retrieves the hit identified by the validated token input inserted by the current worker and sets the task up accordingly.
  *  Such hit is represented by an Hit object. The task is set up by parsing the hit content as an Array of Document objects.
  *  Therefore, to use a customize the task the Document interface must be adapted to correctly parse each document's field.
  *  The Document interface can be found at this path: ../../../../data/build/task/document.ts
  */
  public async performTaskSetup() {
    /* The token input has been already validated, this is just to be sure */
    if (this.tokenForm.valid) {

      /* The loading spinner is started */
      this.ngxService.start();

      /* |--------- HIT ELEMENTS (see: hit.json) ---------| */

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

      /* The token input field is disabled and the task interface can be shown */
      this.tokenInput.disable();
      this.sectionService.taskStarted = true;

      this.documentsAmount = this.hit.documents.length;

      /* The array of documents is initialized */
      this.documents = new Array<Document>();

      /* A form for each document is initialized */
      this.documentsForm = new Array<FormGroup>();

      /*  Each document of the current hit is parsed using the Document interface.  */
      let rawDocuments = this.hit.documents;
      for (let index = 0; index < rawDocuments.length; index++) {
        let currentDocument = rawDocuments[index];
        //console.log(currentDocument['time'])
        this.documents.push(new Document(index, currentDocument));
      }

      /* |--------- QUESTIONNAIRE ELEMENTS (see: questionnaires.json) ---------| */

      /* The array of questionnaires is initialized */
      this.questionnaires = new Array<Questionnaire>();

      /* The questionnaires stored on Amazon S3 are retrieved */
      let rawQuestionnaires = await this.S3Service.downloadQuestionnaires(this.configService.environment)
      this.questionnaireAmount = rawQuestionnaires.length;
      this.questionnaireAmountStart = 0;
      this.questionnaireAmountEnd = 0;

      /* Each questionnaire is parsed using the Questionnaire class */
      for (let index = 0; index < this.questionnaireAmount; index++) {
        let questionnaire = new Questionnaire(index, rawQuestionnaires[index])
        this.questionnaires.push(questionnaire);
        if (questionnaire.position == "start" || questionnaire.position == null) this.questionnaireAmountStart = this.questionnaireAmountStart + 1
        if (questionnaire.position == "end") this.questionnaireAmountEnd = this.questionnaireAmountEnd + 1
      }

      /* A form for each questionnaire is initialized */
      this.questionnairesForm = new Array<FormGroup>();
      for (let index = 0; index < this.questionnaires.length; index++) {
        let questionnaire = this.questionnaires[index];
        if (questionnaire.type == "standard" || questionnaire.type == "likert") {
          /* If the questionnaire is a standard one it means that it has only questions where answers must be selected
           * within a group of radio buttons; only a required validator is required to check answer presence */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaires[index].questions[index_question].name}`] = new FormControl('', [Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        } else {
          /* If the questionnaire is a CRT one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user; required, max and min validators are needed */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaires[index].questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        }
      }

      /* |--------- INSTRUCTIONS DIMENSIONS (see: instructions_dimensions.json) ---------| */

      /* The evaluation instructions stored on Amazon S3 are retrieved */
      let rawInstructions = await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
      this.instructionsAmount = rawInstructions.length;

      /* The instructions are parsed using the Instruction class */
      this.instructions = new Array<Instruction>();
      for (let index = 0; index < this.instructionsAmount; index++) this.instructions.push(new Instruction(index, rawInstructions[index]));

      /* |--------- DIMENSIONS ELEMENTS (see: dimensions.json) ---------| */

      /* The array of dimensions is initialized */
      this.dimensions = new Array<Dimension>();

      /* The dimensions stored on Amazon S3 are retrieved */
      let rawDimensions = await this.S3Service.downloadDimensions(this.configService.environment)
      this.dimensionsAmount = rawDimensions.length;

      /* Each dimension is parsed using the Dimension class */
      for (let index = 0; index < this.dimensionsAmount; index++) this.dimensions.push(new Dimension(index, rawDimensions[index]));

      for (let index = 0; index < this.documentsAmount; index++) {
        let controlsConfig = {};
        for (let index_dimension = 0; index_dimension < this.dimensions.length; index_dimension++) {
          let dimension = this.dimensions[index_dimension];
          if (dimension.scale) {
            if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.required]);
            if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value`] = new FormControl((Math.round(((<ScaleInterval>dimension.scale).min + (<ScaleInterval>dimension.scale).max) / 2)), [Validators.required]);
            if (dimension.scale.type == "magnitude_estimation") {
              if ((<ScaleMagnitude>dimension.scale).lower_bound) {
                controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min), Validators.required]);
              } else {
                controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min + 1), Validators.required]);
              }
            }
          }
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



      /* |--------- SEARCH ENGINE INTEGRATION (see: search_engine.json | https://github.com/Miccighel/CrowdXplorer) ---------| */

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

      /* |--------- TASK SETTINGS (see task.json)---------| */

      if (this.annotator) {
        switch (this.annotator.type) {
          case "options":
            this.annotationOptions = this.formBuilder.group({
              label: new FormControl('')
            });
            this.notes = new Array<Array<NoteStandard>>(this.documentsAmount);
            for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
            break;
          case "laws":
            this.notes = new Array<Array<NoteLaws>>(this.documentsAmount);
            for (let i = 0; i < this.notes.length; i++) this.notes[i] = [];
        }
      }

      this.annotationButtonsDisabled = new Array<boolean>();
      for (let index = 0; index < this.documentsAmount; index++) {
        this.annotationButtonsDisabled.push(true)
      }

      this.notesDone = [false, false, false, false, false]

      /* |--------- COUNTDOWN ---------| */

      this.countdownsExpired = new Array<boolean>(this.documentsAmount);
      for (let index = 0; index < this.documentsAmount; index++) this.countdownsExpired[index] = false;

      this.documentsTime = new Array<number>();
      for (let index = 0; index < this.documents.length; index++) {
        let position = this.documents[index]['index'];
        let trueValue = this.documents[index]['id'];
        //this.documentsTime[index]= this.calculateTimeOfStatement(position, trueValue)
      }


      /* |--------- QUALITY CHECKS ---------| */

      this.goldDocuments = new Array<Document>();

      /* Indexes of the gold elements are retrieved */
      for (let index = 0; index < this.documentsAmount; index++) {
        if (this.documents[index].id.includes('GOLD')) {
          this.goldDocuments.push(this.documents[index])
        }
      }

      this.goldDimensions = new Array<Dimension>();

      /* Indexes of the gold dimensions are retrieved */
      for (let index = 0; index < this.dimensionsAmount; index++) {
        if (this.dimensions[index].gold) {
          this.goldDimensions.push(this.dimensions[index])
        }
      }

      /* |--------- LOGGING ELEMENTS ---------| */

      /* The array of accesses counter is initialized */
      this.elementsAccesses = new Array<number>(this.documentsAmount + this.questionnaireAmount);
      for (let index = 0; index < this.elementsAccesses.length; index++) this.elementsAccesses[index] = 0;

      /* Arrays of start, end and elapsed timestamps are initialized to track how much time the worker spends
       * on each document, including each questionnaire */
      this.timestampsStart = new Array<Array<number>>(this.documentsAmount + this.questionnaireAmount);
      this.timestampsEnd = new Array<Array<number>>(this.documentsAmount + this.questionnaireAmount);
      this.timestampsElapsed = new Array<number>(this.documentsAmount + this.questionnaireAmount);
      for (let i = 0; i < this.timestampsStart.length; i++) this.timestampsStart[i] = [];
      for (let i = 0; i < this.timestampsEnd.length; i++) this.timestampsEnd[i] = [];
      /* The task is now started and the worker is looking at the first questionnaire, so the first start timestamp is saved */
      this.timestampsStart[0].push(Math.round(Date.now() / 1000));

      /* |--------- FINALIZATION ---------| */

      /* Section service gets updated with loaded values */
      this.updateAmounts()

      /* Detect changes within the DOM and update the page */
      this.changeDetector.detectChanges();

      /* If there are no questionnaires and the countdown time is set, enable the first countdown */
      if (this.settings.countdown_time && this.questionnaireAmountStart == 0) this.countdown.toArray()[0].begin();

      /* trigger the changeDetection again */
      this.changeDetector.detectChanges();

      /* The loading spinner is stopped */
      this.ngxService.stop();

    }
  }

  /* |--------- LOGGING SERVICE & SECTION SERVICE ---------| */

  /* Logging service initialization */
  public logInit(workerIdentifier, taskName, batchName, http: HttpClient, endpoint: string, logOnConsole: boolean) {
    this.actionLogger.logInit(workerIdentifier, taskName, batchName, http, endpoint, logOnConsole);
  }

  /* Section service gets updated with questionnaire and document amounts */
  public updateAmounts() {
    this.sectionService.updateAmounts(this.questionnaireAmount, this.documentsAmount, this.allowedTries)
  }

  public nextStep() {
    this.sectionService.increaseIndex()
  }

  public previousStep() {
    this.sectionService.decreaseIndex()
  }

  /* |--------- DIMENSIONS ELEMENTS (see: dimensions.json) ---------| */

  /* This function is used to sort each dimension that a worker have to assess according the position specified */
  public filterDimensions(kind: string, position: string) {
    let filteredDimensions = []
    for (let dimension of this.dimensions) {
      if (dimension.style) {
        if (dimension.style.type == kind && dimension.style.position == position) filteredDimensions.push(dimension)
      } else {
        if (kind == "list" && position == "bottom") filteredDimensions.push(dimension)
      }
    }
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
      /* The new query is pushed into current document data array along with a document_index used to identify such query*/
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
      /* IMPORTANT: the document_index of the last selected value for a document will be <amount -1> */
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
    /* The justification is divided into words and cleaned */
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
      if (this.stepper.selectedIndex >= this.questionnaireAmountStart && this.stepper.selectedIndex < this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd) {
        /* The current document document_index is selected */
        let currentDocument = this.stepper.selectedIndex - this.questionnaireAmountStart;
        /* If the user has selected some search engine responses for the current document */
        if (this.searchEngineSelectedResponses[currentDocument]) {
          if (this.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
            let selectedUrl = Object.values(this.searchEngineSelectedResponses[currentDocument]["data"]).pop()
            let response = selectedUrl["response"]
            /* The controls are performed */
            for (let word of cleanedWords) {
              if (word == response["url"]) return {"invalid": "You cannot use the selected search engine url as part of the justification."}
            }
          }
        }
        const allControls = this.getControlGroup(control).controls;
        let currentControl = Object.keys(allControls).find(name => control === allControls[name])
        let currentDimensionName = currentControl.split("_")[0]
        for (let dimension of this.dimensions) if (dimension.name == currentDimensionName) if (dimension.justification.min_words) minWords = dimension.justification.min_words
      }
      return cleanedWords.length > minWords ? null : {"longer": "This is not valid."};
    }
  }

  /* |--------- SEARCH ENGINE INTEGRATION (see: search_engine.json | https://github.com/Miccighel/CrowdXplorer) ---------| */

  /*
   * This function intercepts a <queryEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the query typed by the worker within a given document.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineUserQuery(queryData: string, document: Document, dimension: Dimension) {
    this.currentDimension = dimension.index
    let currentQueryText = queryData;
    let timeInSeconds = Date.now() / 1000;
    /* If some data for the current document already exists*/
    if (this.searchEngineQueries[document.index]['amount'] > 0) {
      /* The new query is pushed into current document data array along with a document_index used to identify such query*/
      let storedQueries = Object.values(this.searchEngineQueries[document.index]['data']);
      storedQueries.push({
        "dimension": dimension.index,
        "index": storedQueries.length,
        "timestamp": timeInSeconds,
        "text": currentQueryText
      });
      this.currentQuery = storedQueries.length - 1
      /* The data array within the data structure is updated */
      this.searchEngineQueries[document.index]['data'] = storedQueries;
      /* The total amount of query for the current document is updated */
      this.searchEngineQueries[document.index]['amount'] = storedQueries.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineQueries[document.index] = {};
      /* A new data array for the current document is created and the fist query is pushed */
      this.searchEngineQueries[document.index]['data'] = [{
        "dimension": dimension.index,
        "index": 0,
        "timestamp": timeInSeconds,
        "text": currentQueryText
      }];
      this.currentQuery = 0
      /* The total amount of query for the current document is set to 1 */
      /* IMPORTANT: the document_index of the last query inserted for a document will be <amount -1> */
      this.searchEngineQueries[document.index]['amount'] = 1
    }
  }

  /*
   * This function intercepts a <resultEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds an array of <BaseResponse> objects, one for each search result.
   * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineRetrievedResponse(retrievedResponseData: Array<Object>, document: Document, dimension: Dimension) {
    let currentRetrievedResponse = retrievedResponseData;
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineRetrievedResponses[document.index]['groups'] > 0) {
      /* The new response is pushed into current document data array along with its query document_index */
      let storedResponses = Object.values(this.searchEngineRetrievedResponses[document.index]['data']);
      storedResponses.push({
        "dimension": dimension.index,
        "query": this.searchEngineQueries[document.index]['amount'] - 1,
        "index": storedResponses.length,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse,
      });
      /* The data array within the data structure is updated */
      this.searchEngineRetrievedResponses[document.index]['data'] = storedResponses;
      /* The total amount retrieved responses for the current document is updated */
      this.searchEngineRetrievedResponses[document.index]['amount'] = this.searchEngineRetrievedResponses[document.index]['amount'] + currentRetrievedResponse.length
      /* The total amount of groups of retrieved responses for the current document is updated */
      this.searchEngineRetrievedResponses[document.index]['groups'] = storedResponses.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineRetrievedResponses[document.index] = {};
      /* A new data array for the current document is created and the fist response is pushed */
      this.searchEngineRetrievedResponses[document.index]['data'] = [{
        "dimension": dimension.index,
        "query": this.searchEngineQueries[document.index]['amount'] - 1,
        "index": 0,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse
      }];
      /* The total amount of retrieved responses for the current document is set to the length of the first group */
      /* IMPORTANT: the document_index of the last retrieved response for a document will be <amount -1> */
      this.searchEngineRetrievedResponses[document.index]['amount'] = currentRetrievedResponse.length
      /* The total amount of groups retrieved responses for the current document is set to 1 */
      this.searchEngineRetrievedResponses[document.index]['groups'] = 1
    }
    /* The form control to set the url of the selected search result is enabled */
    this.documentsForm[document.index].controls[dimension.name.concat("_url")].enable();
  }

  /*
   * This function intercepts a <selectedRowEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the selected search engine result within a given document.
   * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineSelectedResponse(selectedResponseData: Object, document: Document, dimension: Dimension) {
    let currentSelectedResponse = selectedResponseData;
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineSelectedResponses[document.index]['amount'] > 0) {
      /* The new response is pushed into current document data array along with its query document_index */
      let storedResponses = Object.values(this.searchEngineSelectedResponses[document.index]['data']);
      storedResponses.push({
        "dimension": dimension.index,
        "query": this.searchEngineQueries[document.index]['amount'] - 1,
        "index": storedResponses.length,
        "timestamp": timeInSeconds,
        "response": currentSelectedResponse,
      });
      /* The data array within the data structure is updated */
      this.searchEngineSelectedResponses[document.index]['data'] = storedResponses;
      /* The total amount of selected responses for the current document is updated */
      this.searchEngineSelectedResponses[document.index]['amount'] = storedResponses.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineSelectedResponses[document.index] = {};
      /* A new data array for the current document is created and the fist response is pushed */
      this.searchEngineSelectedResponses[document.index]['data'] = [{
        "dimension": dimension.index,
        "query": this.searchEngineQueries[document.index]['amount'] - 1,
        "index": 0,
        "timestamp": timeInSeconds,
        "response": currentSelectedResponse
      }];
      /* The total amount of selected responses for the current document is set to 1 */
      /* IMPORTANT: the document_index of the last selected response for a document will be <amount -1> */
      this.searchEngineSelectedResponses[document.index]['amount'] = 1
    }
    this.documentsForm[document.index].controls[dimension.name.concat("_url")].setValue(currentSelectedResponse['url']);
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
      if (this.stepper.selectedIndex >= this.questionnaireAmountStart && this.stepper.selectedIndex < this.questionnaireAmountStart + this.documentsAmount) {
        /* If the worker has interacted with the form control of a dimension */
        if (this.currentDimension) {
          let currentDocument = this.stepper.selectedIndex - this.questionnaireAmountStart;
          /* If there are data for the current document */
          if (this.searchEngineRetrievedResponses[currentDocument]) {
            let retrievedResponses = this.searchEngineRetrievedResponses[currentDocument];
            if (retrievedResponses.hasOwnProperty("data")) {
              /* The current set of responses is the total amount - 1 */
              let currentSet = retrievedResponses["data"].length - 1;
              /* The responses retrieved by search engine are selected */
              let currentResponses = retrievedResponses["data"][currentSet]["response"];
              let currentDimension = retrievedResponses["data"][currentSet]["dimension"];
              /* Each response is scanned */
              for (let index = 0; index < currentResponses.length; index++) {
                /* As soon as an url that matches with the one selected/typed by the worker for the current dimension the validation is successful */
                if (workerUrlFormControl.value == currentResponses[index].url && this.currentDimension == currentDimension) return null;
              }
              /* If no matching url has been found, raise the error */
              return {invalidSearchEngineUrl: "Select (or copy & paste) one of the URLs shown above."}
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

  /* |--------- COUNTDOWN ---------| */

  /*
   * This function intercept the event triggered when the time left to evaluate a document reaches 0
   * and it simply sets the corresponding flag to false
   */
  public handleCountdown(event, i) {
    if (event.left == 0) {
      this.countdownsExpired[i] = true
    }
  }


  /* |--------- ANNOTATOR ---------| */

  /*
   * This function intercepts the annotation event triggered by a worker by selecting a substring of the document's text.
   * It cleans previous not finalized notes and checks if the new note which is about to be created overlaps with a previous finalized note;
   * if it is not an overlap the new note is finally created and pushed inside the corresponding data structure. After such step
   * the annotation button is enabled and the worker is allowed to choose the type of the created annotation
   */
  public performAnnotation(documentIndex: number, attributeIndex: number, notes: Array<Array<Note>>, changeDetector) {

    /* If there is a leftover note (i.e., its type was not selected by current worker [it is "yellow"]) it is marked as deleted */
    for (let note of notes[documentIndex]) {
      if (note.option == "not_selected" && !note.deleted) {
        note.ignored = true
        this.removeAnnotation(documentIndex, notes[documentIndex].length - 1, changeDetector)
      }
    }

    /* The hit element which triggered the annotation event is detected */
    let domElement = null
    let noteIdentifier = `document-${documentIndex}-attribute-${attributeIndex}`
    if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
      const selection = document.getSelection();
      if (selection) domElement = document.getElementById(noteIdentifier);
    } else domElement = document.getElementById(noteIdentifier);

    if (domElement) {

      /* The container of the annotated element is cloned and the event bindings are attached again */
      let elementContainerClone = domElement.cloneNode(true)
      elementContainerClone.addEventListener('mouseup', () => this.performAnnotation(documentIndex, attributeIndex, notes, changeDetector))
      elementContainerClone.addEventListener('touchend', () => this.performAnnotation(documentIndex, attributeIndex, notes, changeDetector))

      /* the doHighlight function of the library is called and the flow is handled within two different callback */
      doHighlight(domElement, false, {
        /* the onBeforeHighlight event is called before the creation of the yellow highlight to encase the selected text */
        onBeforeHighlight: (range: Range) => {
          let attributeIndex = parseInt(domElement.id.split("-")[3])
          let notesForDocument = notes[documentIndex]
          if (range.toString().trim().length == 0)
            return false
          let indexes = this.getSelectionCharacterOffsetWithin(domElement)
          /* To detect an overlap the indexes of the current annotation are check with respect to each annotation previously created */
          for (let note of notesForDocument) {
            if (note.deleted == false && note.attribute_index == attributeIndex) if (indexes["start"] < note.index_end && note.index_start < indexes["end"]) return false
          }
          return true
        },
        /* the onAfterHighlight event is called after the creation of the yellow highlight to encase the selected text */
        onAfterHighlight: (range, highlight) => {
          if (highlight.length > 0) {
            if (highlight[0]["outerText"]) notes[documentIndex].push(new NoteStandard(documentIndex, attributeIndex, range, highlight))
            return true
          }
        }
      })

    }

    /* The annotation option button is enabled if there is an highlighted but not annotated note
     * and is disabled if all the notes of the current document are annotated */
    let notSelectedNotesCheck = false
    for (let note of this.notes[documentIndex]) {
      if (note.option == "not_selected" && note.deleted == false) {
        notSelectedNotesCheck = true
        this.annotationButtonsDisabled[documentIndex] = false
        break
      }
    }
    if (!notSelectedNotesCheck) this.annotationButtonsDisabled[documentIndex] = true

    this.changeDetector.detectChanges()
  }

  /*
   * This function finds the domElement of each note of a document using the timestamp of
   * the note itself and sets the CSS styles of the chosen option
   */
  public handleAnnotationOption(value, documentIndex: number) {
    this.notes[documentIndex].forEach((element, index) => {
      if (index === this.notes[documentIndex].length - 1) {
        if (!element.deleted) {
          element.color = value.color
          element.option = value.label
          let noteElement = <HTMLElement>document.querySelector(`[data-timestamp='${element.timestamp_created}']`)
          noteElement.style.backgroundColor = value.color
          noteElement.style.userSelect = "none"
          noteElement.style.webkitUserSelect = "none"
          noteElement.style.pointerEvents = "none"
          noteElement.style.touchAction = "none"
          noteElement.style.cursor = "no-drop"
        }
      }
    })
    /* The annotation option button of the current document is disabled; the processing is terminated  */
    this.annotationButtonsDisabled[documentIndex] = true
    this.changeDetector.detectChanges()
  }

  /*
   * This function checks if each undeleted note of a document has a corresponding
   * option; if this is true the worker can proceed to the following element
   */
  public checkAnnotationConsistency(documentIndex: number) {
    let requiredAttributes = []
    for (let attribute of this.settings.attributes) {
      if (attribute.required) {
        requiredAttributes.push(attribute.index)
      }
    }
    let check = false
    this.notes[documentIndex].forEach((element) => {
      if (element instanceof NoteStandard) {
        if (!element.deleted && element.option != "not_selected") {
          const index = requiredAttributes.indexOf(element.attribute_index);
          if (index > -1) {
            requiredAttributes.splice(index, 1);
          }
          check = true
        }
      } else {
        if (!element.deleted) check = true
      }
    })
    if(requiredAttributes.length>0) {
      check = false
    }
    if (!this.annotator) {
      check = true
    }
    return check
  }

  /*
   * This function removes a particular annotation when the worker clicks on the "Delete" button
   * The corresponding object is not truly deleted, to preserve annotation behavior. It is simply marked as "deleted".
   */
  public removeAnnotation(documentIndex: number, noteIndex: number, changeDetector) {
    /* The wanted note is selected and marked as deleted at the current timestamp */
    let currentNote = this.notes[documentIndex][noteIndex]
    currentNote.markDeleted()
    currentNote.timestamp_deleted = Date.now()
    /* The corresponding HTML element is selected by using note timestamp; its text is preserved
     * and inserted back in DOM as a simple text node and the HTML is deleted */
    let domElement = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
    let textNode = document.createTextNode(currentNote.current_text)
    domElement.parentNode.insertBefore(textNode, domElement);
    domElement.remove()
    /* The element is then normalized to join each text node */
    //document.querySelector(`.statement-${documentIndex}`).normalize()
    changeDetector.detectChanges()
  }

  /*
   * This function checks the presence of undeleted worker's notes. If there it as least one undeleted note, the summary table is shown
   */
  public checkUndeletedNotesPresence(notes) {
    let undeletedNotes = false
    for (let note of notes) {
      if (note.deleted == false && note.option != "not_selected") {
        undeletedNotes = true
        break
      }
    }
    return undeletedNotes
  }

  public performHighlighting(changeDetector, event: Object, documentIndex: number, notes, annotator: Annotator) {
    let domElement = null
    if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
      const selection = document.getSelection();
      if (selection) {
        domElement = document.getElementById(`statement-${documentIndex}`);
      }
    } else {
      domElement = document.getElementById(`statement-${documentIndex}`);
    }
    if (domElement) {
      let first_clone = document.querySelectorAll(`.statement-text`)[documentIndex].cloneNode(true)
      first_clone.addEventListener('mouseup', (e) => this.performHighlighting(changeDetector, event, documentIndex, notes, annotator))
      first_clone.addEventListener('touchend', (e) => this.performHighlighting(changeDetector, event, documentIndex, notes, annotator))
      const highlightMade = doHighlight(domElement, true, {
        onAfterHighlight(range, highlight) {
          const selection = document.getSelection();
          if (highlight.length > 0) {
            if (highlight[0]["outerText"]) {
              selection.empty()
              let notesForDocument = notes[documentIndex]
              range["endContainer"]["children"]
              let newAnnotation = new NoteLaws(documentIndex, range, highlight)
              let noteAlreadyFound = false
              for (let note of notesForDocument) {
                if (!note.deleted && newAnnotation.current_text.includes(note.current_text)) {
                  /* let element = document.querySelectorAll(`.statement-text`)[documentIndex]
                  document.querySelectorAll(".law_content_li")[documentIndex].append(first_clone)
                  element.remove()
                  return true */
                  note.deleted = true
                }
              }
              if (noteAlreadyFound) {
                return true
              } else {
                for (let index = 0; index < notesForDocument.length; ++index) {
                  if (newAnnotation.timestamp_created == notesForDocument[index].timestamp_created) {
                    if (newAnnotation.current_text.length > notesForDocument[index].current_text.length) notesForDocument.splice(index, 1);
                  }
                }
                notes[documentIndex] = notesForDocument
                notesForDocument.unshift(newAnnotation)
                notes[documentIndex] = notesForDocument
                changeDetector.detectChanges()
                return true
              }
            }
          } else {
            let element = document.querySelectorAll(".statement-text")[documentIndex]
            element.remove()
            document.querySelectorAll(".law_content_li")[documentIndex].append(first_clone)
          }
        }
      });
    }
  }

  public performInnerHighlighting(changeDetector, event: Object, documentIndex: number, noteIndex: number, notes, annotator: Annotator) {
    let domElement = null
    if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
      const selection = document.getSelection();
      if (selection) {
        domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
      }
    } else {
      domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
    }
    if (domElement) {
      let first_clone = document.getElementById(`references-${noteIndex}.${documentIndex}`).cloneNode(true)
      first_clone.addEventListener('mouseup', (e) => this.performInnerHighlighting(changeDetector, event, documentIndex, noteIndex, notes, annotator))
      first_clone.addEventListener('touchend', (e) => this.performInnerHighlighting(changeDetector, event, documentIndex, noteIndex, notes, annotator))
      const highlightMade = doHighlight(domElement, true, {
        onAfterHighlight(range, highlight) {
          const selection = document.getSelection();
          if (highlight.length > 0) {
            if (highlight[0]["outerText"]) {
              selection.empty()
              let notesForDocument = notes
              range["endContainer"]["children"]
              let newAnnotation = new NoteLaws(documentIndex, range, highlight)
              let noteAlreadyFound = false
              for (let note of notesForDocument) {
                if (!note.deleted && newAnnotation.current_text.includes(note.current_text)) {
                  note.deleted = true
                }
              }
              if (noteAlreadyFound) {
                return true
              } else {
                for (let index = 0; index < notesForDocument.length; ++index) {
                  if (newAnnotation.timestamp_created == notesForDocument[index].timestamp_created) {
                    if (newAnnotation.current_text.length > notesForDocument[index].current_text.length) notesForDocument.splice(index, 1);
                  }
                }
                notesForDocument.unshift(newAnnotation)
                changeDetector.detectChanges()
                return true
              }
            }
          } else {
            let element = document.getElementById(`references-${noteIndex}.${documentIndex}`)
            element.remove()
            document.getElementById(`note-current-${noteIndex}.${documentIndex}`).appendChild(first_clone)
          }
        }
      });
    }
  }

  public checkIfSaved(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      let year = (<HTMLInputElement>document.getElementById("year-" + noteIndex + "." + documentIndex)).value
      let number = (<HTMLInputElement>document.getElementById("number-" + noteIndex + "." + documentIndex)).value
      this.checkEnabledNotes(documentIndex)
      if (currentNote.year == Number(year) && currentNote.number == Number(number)) {
        return true
      } else {
        return false
      }
    }
  }

  public checkIfLast(documentIndex: number, noteIndex: number) {
    let currentNotes = this.notes[documentIndex]
    let currentNote = currentNotes[noteIndex]
    let index = 0
    let undeletedNotes = 0
    for (let note of currentNotes) {
      if (!note.deleted) {
        undeletedNotes += 1
      }
    }
    if (currentNotes.length > 0) {
      for (let pos = currentNotes.length - 1; pos >= 0; pos--) {
        if (!currentNotes[pos].deleted) {
          if (currentNotes[pos].timestamp_created != currentNote.timestamp_created) {
            index += 1
          } else {
            break
          }
        }
      }
    }
    if (index == undeletedNotes - 1) {
      return true
    } else {
      return false
    }
  }

  public innerCheckIfSaved(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
    let mainNote = this.notes[documentIndex][noteIndex]
    if (mainNote instanceof NoteLaws) {
      let currentNote = mainNote.innerAnnotations[innerNoteIndex]
      let year = (<HTMLInputElement>document.getElementById("year-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
      let number = (<HTMLInputElement>document.getElementById("number-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
      this.checkEnabledNotes(documentIndex)
      if (currentNote.year == Number(year) && currentNote.number == Number(number)) {
        return true
      } else {
        return false
      }
    }
  }

  public checkNoteDeleted(note: Note) {
    return note.deleted
  }

  public checkReferenceWithoutDetails(note: Note) {
    if (note instanceof NoteLaws) {
      if (note.type == "reference") {
        if (!note.withoutDetails) {
          return (note.year == 0 && note.number == 0)
        } else {
          return false
        }
      }
    }
    return false
  }

  public filterNotes(notes: Note[]) {
    var result: Note[] = []
    for (let note of notes) {
      if (note instanceof NoteLaws) {
        if (note.year != 0 && note.number != 0 && note.type == "reference" && !note.withoutDetails && !note.deleted) {
          result.push(note)
        }
      }
    }
    return result
  }

  public referenceRadioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      if ($event.value == "null") {
        currentNote.year = 0
        currentNote.number = 0
      } else {
        let fields = $event.value.split("-")
        currentNote.year = fields[0]
        currentNote.number = fields[1]
      }
    }
  }

  public detailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      if ($event.checked) {
        currentNote.withoutDetails = true
        this.checkEnabledNotes(documentIndex)
      } else {
        currentNote.withoutDetails = false
        this.checkEnabledNotes(documentIndex)
      }
    }
  }

  public innerDetailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number, innerNoteIndex: number) {
    let mainNote = this.notes[documentIndex][noteIndex]
    if (mainNote instanceof NoteLaws) {
      let currentNote = mainNote.innerAnnotations[innerNoteIndex]
      if ($event.checked) {
        currentNote.withoutDetails = true
        currentNote.year = 0
        currentNote.number = 0
        this.checkEnabledNotes(documentIndex)
      } else {
        currentNote.withoutDetails = false
        this.checkEnabledNotes(documentIndex)
      }
    }
  }

  public checkEnabledNotes(documentIndex: number) {
    this.notesDone[documentIndex] = true
    let currentNotes = this.notes[documentIndex]
    var notesNotDeleted: Note[] = []
    var booleans: Boolean[] = [true]
    for (let note of currentNotes) {
      if (!note.deleted) {
        notesNotDeleted.push(note)
      }
    }
    for (let note of notesNotDeleted) {
      if (note instanceof NoteLaws) {
        if (note.type == "reference") {
          if (this.checkReferenceWithoutDetails(note)) {
            booleans.push(false)
          } else {
            booleans.push(true)
          }
        } else {
          booleans.push(this.auxCEN(note))
        }
      }
    }
    if (booleans.length == 0) {
      this.notesDone[documentIndex] = false
    } else {
      let checker = array => array.every(Boolean)
      if (checker(booleans)) {
        this.notesDone[documentIndex] = true
      } else {
        this.notesDone[documentIndex] = false
      }
    }
  }

  public auxCEN(note: Note) {
    var booleans: Boolean[] = []
    if (note instanceof NoteLaws) {
      for (let n of note.innerAnnotations) {
        if (!n.deleted) {
          if ((n.number != 0 && n.year != 0) || n.withoutDetails) {
            booleans.push(true)
          } else {
            booleans.push(false)
          }
        }
      }
      if (note.containsReferences) {
        if (booleans.length == 0) {
          return false
        } else {
          let checker = array => array.every(Boolean)
          if (checker(booleans)) {
            return true
          } else {
            return false
          }
        }
      } else {
        return true
      }
    }
  }

  public resetRadioButton(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      // console.log("Sto cercando " + currentNote.year + " " + currentNote.number)
      for (let note of this.notes[documentIndex]) {
        if (note instanceof NoteLaws) {
          if (!note.deleted && note.type != "reference") {
            // console.log("Nota " + note.year + " " + note.number)
            if (note.year == currentNote.year && note.number == currentNote.number) {
              // console.log("Annotazione resettata: " + note.current_text)
              note.year = 0
              note.number = 0
            }
          }
        }
      }
    }
  }

  public performAnnotationLaws(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      this.resetRadioButton(documentIndex, noteIndex)
      let year = (<HTMLInputElement>document.getElementById("year-" + noteIndex + "." + documentIndex)).value
      let number = (<HTMLInputElement>document.getElementById("number-" + noteIndex + "." + documentIndex)).value
      currentNote.year = Number(year)
      currentNote.number = Number(number)
      currentNote.updateNote()
      this.checkEnabledNotes(documentIndex)
    }
  }

  public performInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
    let mainNote = this.notes[documentIndex][noteIndex]
    if (mainNote instanceof NoteLaws) {
      let currentNote = mainNote.innerAnnotations[innerNoteIndex]
      let year = (<HTMLInputElement>document.getElementById("year-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
      let number = (<HTMLInputElement>document.getElementById("number-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
      currentNote.year = Number(year)
      currentNote.number = Number(number)
      currentNote.updateNote()
      this.checkEnabledNotes(documentIndex)
    }
  }

  public changeSpanColor(documentIndex: number, noteIndex: number) {
    let note = this.notes[documentIndex][noteIndex]
    let note_timestamp = note.timestamp_created
    document.querySelector(`[data-timestamp='${note_timestamp}']`).setAttribute("style", `background-color: ${note.color};`)
  }

  public radioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      switch ($event.value) {
        case "insertion": {
          currentNote.type = "insertion"
          currentNote.containsReferences = false
          currentNote.innerAnnotations = []
          currentNote.color = this.colors[1]
          this.changeSpanColor(documentIndex, noteIndex)
          this.checkEnabledNotes(documentIndex)
          break
        }
        case "substitution": {
          currentNote.type = "substitution"
          currentNote.containsReferences = false
          currentNote.innerAnnotations = []
          currentNote.color = this.colors[2]
          this.changeSpanColor(documentIndex, noteIndex)
          this.checkEnabledNotes(documentIndex)
          break
        }
        case "repeal": {
          currentNote.type = "repeal"
          currentNote.containsReferences = false
          currentNote.innerAnnotations = []
          currentNote.color = this.colors[0]
          this.changeSpanColor(documentIndex, noteIndex)
          this.checkEnabledNotes(documentIndex)
          break
        }
        case "reference": {
          currentNote.type = "reference"
          currentNote.containsReferences = true
          currentNote.innerAnnotations = []
          currentNote.color = this.colors[3]
          this.changeSpanColor(documentIndex, noteIndex)
          this.checkEnabledNotes(documentIndex)
          break
        }
      }
    }
  }

  public checkboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      if ($event.checked) {
        currentNote.containsReferences = true
        this.checkEnabledNotes(documentIndex)
      } else {
        currentNote.containsReferences = false
        currentNote.innerAnnotations = []
        this.checkEnabledNotes(documentIndex)
      }
    }
  }

  public removeAnnotationLaws(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    currentNote.markDeleted()
    this.resetRadioButton(documentIndex, noteIndex)
    currentNote.timestamp_deleted = Date.now()
    let element = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
    element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
    element.remove()
    this.checkEnabledNotes(documentIndex)
  }

  public removeInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
    let mainNote = this.notes[documentIndex][noteIndex]
    if (mainNote instanceof NoteLaws) {
      let currentNote = mainNote.innerAnnotations[innerNoteIndex]
      currentNote.markDeleted()
      currentNote.timestamp_deleted = Date.now()
      let element = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
      element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
      element.remove()
      this.checkEnabledNotes(documentIndex)
    }
  }

  public countInnerUndeletedNotes(note: Note) {
    var undeletedNotes = 0
    if (note instanceof NoteLaws) {
      for (let innerNote of note.innerAnnotations) {
        if (!innerNote.deleted) {
          undeletedNotes += 1
        }
      }
    }
    return undeletedNotes
  }

  public referenceRadioButtonCheck(documentIndex: number, noteIndex: number) {
    let currentNote = this.notes[documentIndex][noteIndex]
    if (currentNote instanceof NoteLaws) {
      if (currentNote.year == 0 && currentNote.number == 0) {
        return true
      }
    }
    return false
  }

  public checkUndeletedNotesPresenceLaws(notes) {
    let undeletedNotes = false
    for (let note of notes) {
      if (note.deleted == false) {
        undeletedNotes = true
        break
      }
    }
    return undeletedNotes
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
    for (let index = 0; index < this.questionnairesForm.length; index++) if (this.questionnairesForm[index].valid == false) questionnaireFormValidity = false;
    for (let index = 0; index < this.documentsForm.length; index++) if (this.documentsForm[index].valid == false) documentsFormValidity = false;
    return (questionnaireFormValidity && documentsFormValidity)
  }

  /*
   * This function performs the checks needed to ensure that the worker has made a quality work.
   * Three checks are performed:
   * 1) GLOBAL VALIDITY CHECK (QUESTIONNAIRE + DOCUMENTS): Verifies that each field of each form has valid values
   * 2) GOLD QUESTION CHECK:   Implements a custom check on gold elements retrieved using their ids.
   *                           An element is gold if its id contains the word "GOLD-".
   * 3) TIME SPENT CHECK:      Verifies if the time spent by worker on each document and questionnaire is higher than
   *                           <timeCheckAmount> seconds, using the <timestampsElapsed> array
   * If each check is successful, the task can end. If the worker has some tries left, the task is reset.
   */
  public async performQualityCheck() {

    /* The loading spinner is started */
    this.ngxService.start();

    /* The current try is completed and the final can shall begin */
    this.sectionService.taskCompleted = true

    /* Booleans to hold result of checks */
    let globalValidityCheck: boolean;
    let goldQuestionCheck: boolean;
    let timeSpentCheck: boolean;
    let timeCheckAmount = this.timeCheckAmount;

    /* Array that stores the results of each check */
    let computedChecks = []

    /* Handful expression to check an array of booleans */
    let checker = array => array.every(Boolean);

    /* 1) GLOBAL VALIDITY CHECK performed here */
    globalValidityCheck = this.performGlobalValidityCheck();
    computedChecks.push(globalValidityCheck)

    /* 2) GOLD ELEMENTS CHECK performed here */

    let goldConfiguration = []
    /* For each gold document its attribute, answers and notes are retrieved to build a gold configuration */
    for (let goldDocument of this.goldDocuments) {
      goldConfiguration = []
      let currentConfiguration = {}
      currentConfiguration["document"] = goldDocument
      let answers = {}
      for (let goldDimension of this.goldDimensions) {
        for (let [attribute, value] of Object.entries(this.documentsForm[goldDocument.index].value)) {
          let dimensionName = attribute.split("_")[0]
          if (dimensionName == goldDimension.name) {
            answers[attribute] = value
          }
        }
      }
      currentConfiguration["answers"] = answers
      currentConfiguration["notes"] = this.notes[goldDocument.index]
    }

    /* The gold configuration is evaluated using the static method implemented within the GoldChecker class */
    let goldChecks = GoldChecker.performGoldCheck(goldConfiguration)

    /* Since there is a boolean for each gold element, the corresponding array is checked using the checker expression
     * to understand if each boolean is true */
    computedChecks.push(checker(goldChecks))

    /* 3) TIME SPENT CHECK performed here */
    timeSpentCheck = true;
    for (let i = 0; i < this.timestampsElapsed.length; i++) if (this.timestampsElapsed[i] < timeCheckAmount) timeSpentCheck = false;
    computedChecks.push(timeSpentCheck)

    /* If each check is true, the task is successful, otherwise the task is failed (but not over if there are more tries) */

    if (checker(computedChecks)) {
      this.sectionService.taskSuccessful = true;
      this.sectionService.taskFailed = false;

    } else {
      this.sectionService.taskSuccessful = false;
      this.sectionService.taskFailed = true;

    }

    if (!(this.worker.identifier === null)) {
      /* The result of quality check control  for the current try is uploaded to the Amazon S3 bucket along with the gold configuration. */
      let qualityCheckData = {
        globalFormValidity: globalValidityCheck,
        timeSpentCheck: timeSpentCheck,
        timeCheckAmount: timeCheckAmount,
        goldChecks: goldChecks,
        goldConfiguration: goldConfiguration
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
    this.ngxService.stop();

  }

  /*
   * This function resets the task by bringing the worker to the first document if he still has some available tries.
   * The worker can trigger this operation by clicking the "Reset" button when quality checks are completed and the outcome is shown.
   */
  public performReset() {

    /* The loading spinner is started */
    this.ngxService.start();

    /* Control variables to restore the state of task */
    this.comment.setValue("");
    this.commentSent = false;

    this.sectionService.taskFailed = false;
    this.sectionService.taskSuccessful = false;
    this.sectionService.taskCompleted = false;
    this.sectionService.taskStarted = true;
    this.sectionService.decreaseAllowedTries();

    /* Set stepper document_index to the first tab (currentDocument.e., bring the worker to the first document after the questionnaire) */
    this.stepper.selectedIndex = this.questionnaireAmountStart;

    /* Decrease the remaining tries amount*/
    this.allowedTries = this.allowedTries - 1;

    /* Increases the current try document_index */
    this.currentTry = this.currentTry + 1;

    /* The countdowns are set back to 0 */
    if (this.settings.countdown_time) {
      if (this.countdown.toArray()[0].left > 0) {
        this.countdown.toArray()[0].resume();
      }
    }

    /* The loading spinner is stopped */
    this.ngxService.stop();

  }

  // |--------- AMAZON AWS INTEGRATION - FUNCTIONS ---------|

  /*
   * This function interacts with an Amazon S3 bucket to store each data produced within the task.
   * A folder on the bucket is created for each worker identifier and such folders contain .json files.
   * The data include questionnaire results, quality checks, worker hit, search engine results, etc.
   * Moreover, this function stores the timestamps used to check how much time the worker spends on each document.
   */
  public async performLogging(action: string, documentIndex: number) {

    /* The countdowns are stopped and resumed to the left or to the right of the current document,
    *  depending on the chosen action ("Back" or "Next") */
    if ((this.stepper.selectedIndex >= this.questionnaireAmountStart && this.stepper.selectedIndex < this.questionnaireAmountStart + this.documentsAmount) && this.settings.countdown_time) {
      let currentIndex = this.stepper.selectedIndex - this.questionnaireAmountStart;
      switch (action) {
        case "Next":
          if (currentIndex > 0 && this.countdown.toArray()[currentIndex - 1].left > 0) {
            this.countdown.toArray()[currentIndex - 1].pause();
          }
          if (this.countdown.toArray()[currentIndex].left == this.settings.countdown_time) {
            this.countdown.toArray()[currentIndex].begin();
          } else if (this.countdown.toArray()[currentIndex].left > 0) {
            this.countdown.toArray()[currentIndex].resume();
          }
          break;
        case "Back":
          if (this.countdown.toArray()[currentIndex + 1].left > 0) {
            this.countdown.toArray()[currentIndex + 1].pause();
          }
          if (this.countdown.toArray()[currentIndex].left == this.settings.countdown_time) {
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

    /* The yellow leftover notes are marked as deleted */
    if (this.annotator) {
      if (this.notes[documentIndex]) {
        if (this.notes[documentIndex].length > 0) {
          let element = this.notes[documentIndex][this.notes[documentIndex].length - 1]
          if (element.option == "not_selected" && !element.deleted) {
            this.removeAnnotation(documentIndex, this.notes[documentIndex].length - 1, this.changeDetector)
          }
        }
      }
    }

    /* If there is a worker ID then the data should be uploaded to the S3 bucket */

    if (!(this.worker.identifier === null)) {

      /* IMPORTANT: The current document document_index is the stepper current document_index AFTER the transition
       * If a NEXT action is performed at document 3, the stepper current document_index is 4.
       * If a BACK action is performed at document 3, the stepper current document_index is 2.
       * This is tricky only for the following switch which has to set the start/end
       * timestamps for the previous/following document. */
      let currentElement = this.stepper.selectedIndex;
      /* completedElement is the document_index of the document/questionnaire in which the user was before */
      let completedElement = this.stepper.selectedIndex;

      switch (action) {
        case "Next":
          completedElement = currentElement - 1;
          break;
        case "Back":
          completedElement = currentElement + 1;
          break;
        case "Finish":
          completedElement = this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd - 1;
          currentElement = this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd - 1;
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
        questionnaire_amount_start: this.questionnaireAmountStart,
        questionnaire_amount_end: this.questionnaireAmountEnd,
        documents_amount: this.documentsAmount,
        dimensions_amount: this.dimensionsAmount,
      };
      /* General info about task */
      data["task"] = taskData
      /* The answers of the current worker to the questionnaire */
      data["questionnaires"] = this.questionnaires
      /* The parsed document contained in current worker's hit */
      data["documents"] = this.documents
      /* The dimensions of the answers of each worker */
      data["dimensions"] = this.dimensions
      /* General info about worker */
      data["worker"] = this.worker
      /* await (this.upload(`${this.workerFolder}/worker.json`, this.worker)); */

      let uploadStatus = await this.S3Service.uploadTaskData(this.configService.environment, this.worker, data)

      /* If the worker has completed a questionnaire */
      if (completedElement < this.questionnaireAmountStart || (completedElement >= this.questionnaireAmountStart + this.documentsAmount)) {

        /* if the questionnaire it's at the end */

        let completedQuestionnaire = 0
        if (completedElement >= this.questionnaireAmountStart + this.documentsAmount) {
          completedQuestionnaire = completedElement - this.documentsAmount
        } else {
          completedQuestionnaire = completedElement
        }

        /* The amount of accesses to the current questionnaire is retrieved */
        let accessesAmount = this.elementsAccesses[completedElement];

        /* If the worker has completed the first questionnaire
         * The partial data about the completed questionnaire are uploaded */

        let data = {}

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedQuestionnaire,
          sequence: this.sequenceNumber,
          element: "questionnaire"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's answers to the current questionnaire */
        let answers = this.questionnairesForm[completedQuestionnaire].value;
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

        let uploadStatus = await this.S3Service.uploadQuestionnaire(this.configService.environment, this.worker, data, this.currentTry, completedQuestionnaire, accessesAmount + 1, this.sequenceNumber)

        /* The amount of accesses to the current questionnaire is incremented */
        this.sequenceNumber = this.sequenceNumber + 1
        this.elementsAccesses[completedElement] = accessesAmount + 1;

        /* If the worker has completed a document */
      } else {

        /* The document_index of the completed document is the completed element minus the questionnaire amount */
        let completedDocument = completedElement - this.questionnaireAmountStart;

        /* The amount of accesses to the current document is retrieved */
        let accessesAmount = this.elementsAccesses[completedElement];

        let data = {}

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedDocument,
          sequence: this.sequenceNumber,
          element: "document"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        /* Worker's answers for the current document */
        let answers = this.documentsForm[completedDocument].value;
        data["answers"] = answers
        let notes = (this.settings.annotator) ? this.notes[completedDocument] : []
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
        /* Countdown time and corresponding flag */
        let countdownTime = (this.settings.countdown_time) ? Number(this.countdown[completedDocument]["i"]["text"]) : []
        data["countdowns_times"] = countdownTime
        let countdown_expired = (this.settings.countdown_time) ? this.countdownsExpired[completedDocument] : []
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

        let uploadStatus = await this.S3Service.uploadDocument(this.configService.environment, this.worker, data, this.currentTry, completedDocument, accessesAmount + 1, this.sequenceNumber)

        /* The amount of accesses to the current document is incremented */
        this.elementsAccesses[completedElement] = accessesAmount + 1;
        this.sequenceNumber = this.sequenceNumber + 1

      }

      /* If the worker has completed the last element */

      if (completedElement >= (this.questionnaireAmountStart + this.documentsAmount + this.questionnaireAmountEnd) - 1) {

        /* All data about documents are uploaded, only once */
        let actionInfo = {
          action: action,
          try: this.currentTry,
          sequence: this.sequenceNumber,
          element: "all"
        };
        /* Info about each performed action ("Next"? "Back"? From where?) */
        data["info"] = actionInfo
        let answers = [];
        for (let index = 0; index < this.questionnairesForm.length; index++) answers.push(this.questionnairesForm[index].value);
        data["questionnaires_answers"] = answers
        answers = [];
        for (let index = 0; index < this.documentsForm.length; index++) answers.push(this.documentsForm[index].value);
        data["documents_answers"] = answers
        let notes = (this.settings.annotator) ? this.notes : []
        data["notes"] = notes
        /* Worker's dimensions selected values for the current document */
        data["dimensions_selected"] = this.dimensionsSelectedValues
        /* Start, end and elapsed timestamps for each document */
        data["timestamps_start"] = this.timestampsStart
        data["timestamps_end"] = this.timestampsEnd
        data["timestamps_elapsed"] = this.timestampsElapsed
        /* Countdown time and corresponding flag for each document */
        let countdownTimes = [];
        let countdownExpired = [];
        if (this.settings.countdown_time)
          for (let index = 0; index < this.countdown.length; index++) countdownTimes.push(Number(this.countdown[index]["i"]["text"]));
        for (let index = 0; index < this.countdownsExpired.length; index++) countdownExpired.push(this.countdownsExpired[index]);
        data["countdowns_times"] = countdownTimes
        data["countdowns_expired"] = countdownExpired
        /* Number of accesses to each document (currentDocument.e., how many times the worker reached the document with a "Back" or "Next" action */
        data["accesses"] = this.elementsAccesses
        /* Worker's search engine queries for each document */
        data["queries"] = this.searchEngineQueries
        /* Responses retrieved by search engine for each worker's query for each document */
        data["responses_retrieved"] = this.searchEngineRetrievedResponses
        /* Responses by search engine ordered by worker's click for the current document */
        data["responses_selected"] = this.searchEngineSelectedResponses
        /* If the last element is a document */

        let uploadStatus = await this.S3Service.uploadFinalData(this.configService.environment, this.worker, data, this.currentTry)

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

  /* |--------- OTHER AMENITIES ---------| */

  protected getControlGroup(c: AbstractControl): FormGroup | FormArray {
    return c.parent;
  }

  /*
   * This function retrieves the string associated to an error code thrown by a form field validator.
   */
  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

  public showSnackbar(message, action, duration) {
    this.snackBar.open(message, action, {
      duration: duration,
    });
  }

  public capitalize(word: string) {
    if (!word) return word;
    let text = word.split("-")
    let str = ""
    for (word of text) str = str + " " + word[0].toUpperCase() + word.substr(1).toLowerCase();
    return str.trim()
  }


  public getSelectionCharacterOffsetWithin(element) {
    var start = 0;
    var end = 0;
    var doc = element.ownerDocument || element.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel;
    if (typeof win.getSelection != "undefined") {
      sel = win.getSelection();
      if (sel.rangeCount > 0) {
        var range = win.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        start = preCaretRange.toString().length;
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        end = preCaretRange.toString().length;
      }
    } else if ((sel = doc.selection) && sel.type != "Control") {
      var textRange = sel.createRange();
      var preCaretTextRange = doc.body.createTextRange();
      preCaretTextRange.moveToElementText(element);
      preCaretTextRange.setEndPoint("EndToStart", textRange);
      start = preCaretTextRange.text.length;
      preCaretTextRange.setEndPoint("EndToEnd", textRange);
      end = preCaretTextRange.text.length;
    }
    return {start: start, end: end};
  }

  /***
      * This function modifies the countdown value based on the position of the document and its truth value
      */
   public calculateTimeOfStatement(position: number, trueValue?: string){

    let trueValueDocumentData = this.findTrueValueDocument(trueValue);

    let timeOfStatement = 0;
    console.log(trueValueDocumentData)
     let documentTime = this.settings.documentsTimeAndWeight[trueValueDocumentData].time;
     let weightTrueValue = this.settings.documentsTimeAndWeight[trueValueDocumentData].weight;
     let weightposition = this.settings.documentPositionWeights[position].weight;
     console.log("Document time: " +documentTime +" TrueValue weight: " +weightTrueValue+" Document position weight: " +weightposition)

     timeOfStatement = documentTime*weightTrueValue*weightposition;

    return timeOfStatement;
  }

  private findTrueValueDocument(trueValue):string{
    trueValue = trueValue.toLowerCase().split('_')
    const values = ['true','mostly-true','half-true','mostly-false','false','pants-on-fire','low','high']
    let responce = null;

    values.forEach(element => {
      if(element === trueValue[0])
        responce = element;
    });
    return responce;
  }
}
