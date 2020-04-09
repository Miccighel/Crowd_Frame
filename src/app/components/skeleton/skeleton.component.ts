/* Core modules */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
/* Reactive forms modules */
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {ConfigService} from "../../services/config.service";
/* Task models */
import {Document} from "../../models/skeleton/document";
import {Hit} from "../../models/skeleton/hit";
/* AWS Integration*/
import * as AWS from 'aws-sdk';
import {ManagedUpload} from "aws-sdk/clients/s3";
import {Questionnaire} from "../../models/skeleton/questionnaire";
import {faSpinner} from "@fortawesome/free-solid-svg-icons";

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
export class SkeletonComponent {

  /* |--------- GENERAL ELEMENTS - DECLARATION ---------| */

  /* Name of the current task */
  experimentId: string;

  /* Unique identifier of the current worker */
  workerIdentifier: string;

  /* Flag to unlock the task for the worker */
  taskAllowed: boolean;

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  /* Service to provide loading screens */
  ngxService: NgxUiLoaderService;
  /* Service to provide an environment-based configuration */
  configService: ConfigService;

  /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
  formBuilder: FormBuilder;

  /* Variables to handle the control flow of the task */
  taskStarted: boolean;
  taskCompleted: boolean;
  taskSuccessful: boolean;
  taskFailed: boolean;

  /* Rating scale to be used */
  scale: string;
  /* Each possible rating scale */
  allScales: Array<string>;
  /* Flag to launch a batch of experiments for multiple rating scales */
  useEachScale: boolean;

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
  /* Number of allowed tries */
  allowedTries: number;
  /* Number of the current try */
  currentTry: number;

  /* |--------- AMAZON AWS INTEGRATION - DECLARATION ---------| */

  /* AWS S3 Integration*/
  s3: AWS.S3;
  /* Region identifier */
  region: string;
  /* Bucket identifier */
  bucket: string;
  /* Folder to use within the bucket */
  folder: string;
  /* File where task instructions are stored */
  instructionsFile: string;
  /* File where each worker identifier is stored */
  workersFile: string;
  /* File where each questionnaire is stored */
  questionnairesFile: string;
  /* File where each hit is stored */
  hitsFile: string;
  /* Folder in which upload data produced within the task by current worker */
  workerFolder: string;

  /* |--------- QUESTIONNAIRE ELEMENTS - DECLARATION ---------| */

  questionnairesForm: FormGroup[];

  /* Reference to the current questionnaires */
  questionnaires: Array<Questionnaire>;

  /* Number of different questionnaires inserted within task's body
  * (i.e., a standard questionnaire and two cognitive questionnaires  */
  questionnaireAmount: number;

  /* |--------- HIT ELEMENTS - DECLARATION ---------| */

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
  searchEngineRetrievedResponses: Array<object>;
  /* Array to store the responses selected by workers within search engine results, one for each document within a Hit */
  searchEngineSelectedResponses: Array<object>;
  /* Flag to check if the query returned some results */
  resultsFound: boolean;

  /* |--------- QUALITY CHECKS - DECLARATION ---------| */

  /* Indexes of the gold questions within a Hit */
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

  /* |--------- CONSTRUCTOR ---------| */

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    formBuilder: FormBuilder,
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.changeDetector = changeDetector;
    this.ngxService = ngxService;
    this.configService = configService;
    this.formBuilder = formBuilder;

    this.ngxService.start();

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.experimentId = this.configService.environment.experimentId;

    let url = new URL(window.location.href);
    this.workerIdentifier = url.searchParams.get("workerID");

    this.taskAllowed = true;

    this.taskStarted = false;
    this.taskCompleted = false;
    this.taskSuccessful = false;
    this.taskFailed = false;

    this.scale = this.configService.environment.scale;
    this.allScales = this.configService.environment.allScales;
    this.useEachScale = this.configService.environment.useEachScale;

    this.tokenInput = new FormControl('BZEDUKJKXPQ', [Validators.required, Validators.maxLength(11)], this.validateTokenInput.bind(this));
    this.tokenForm = formBuilder.group({
      "tokenInput": this.tokenInput
    });
    this.tokenInputValid = false;

    this.allowedTries = this.configService.environment.allowedTries;
    this.currentTry = 1;

    /* |--------- AMAZON AWS INTEGRATION - INITIALIZATION ---------| */

    this.region = this.configService.environment.region;
    this.bucket = this.configService.environment.bucket;
    if (this.useEachScale) {
      this.folder = `${this.experimentId}/Multi/`;
    } else {
      this.folder = `${this.experimentId}/Single/`;
    }
    this.instructionsFile = `${this.folder}${this.scale}/instructions.html`;
    this.workersFile = `${this.folder}${this.scale}/workers.json`;
    this.questionnairesFile = `${this.folder}${this.scale}/questionnaires.json`;
    this.hitsFile = `${this.folder}${this.scale}/hits.json`;
    this.workerFolder = `${this.folder}${this.scale}/Data/${this.workerIdentifier}`;
    this.s3 = new AWS.S3({
      region: this.region,
      params: {Bucket: this.bucket},
      credentials: new AWS.Credentials(this.configService.environment.aws_id_key, this.configService.environment.aws_secret_key)
    });

    /* |--------- SEARCH ENGINE INTEGRATION - INITIALIZATION ---------| */

    this.resultsFound = false;

    /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

    this.comment = new FormControl('', [Validators.required]);
    this.commentForm = formBuilder.group({
      "comment": this.comment,
    });

    /* If there is an external worker which is trying to perform the task, check its status */
    if (!(this.workerIdentifier === null)) {
      this.performWorkerStatusCheck().then(outcome => {
        this.taskAllowed = outcome;
        this.changeDetector.detectChanges()
      })
    }

    /* Font awesome spinner icon initialization */
    this.faSpinner = faSpinner;

    this.ngxService.stop();
  }

  /* |--------- GENERAL ELEMENTS - FUNCTIONS ---------| */

  /*
  * This function interacts with an Amazon S3 bucket to search the token input
  * typed by the user inside within the hits.json file stored in the bucket.
  * If such token cannot be found, an error message is returned.
  */
  public async validateTokenInput(control: FormControl) {
    let hits = await this.download(this.hitsFile);
    for (let hit of hits) if (hit.token_input === control.value) return null;
    return {"invalid": "This token is not valid."}
  }

  /*
  * This function interacts with an Amazon S3 bucket to perform a check on the current worker identifier.
  * If the worker has already started the task in the past (i.e., it's present in the workers.json
  * file within the current scale folder of the experiment's bucket) he is not allowed to continue the task.
  * If there is a task for each rating scale within the experiment, three different checks are made.
  * This behavior is controlled by setting the useEachScale flag.
  */
  public async performWorkerStatusCheck() {
    /* Only one scale must be checked or each one of them */
    if (this.useEachScale) {
      /* At the start, any worker identifier has been found */
      let existingWorkerFoundForAScale = false;
      /* Variable which contains the upload result */
      let uploadStatus = null;
      /* Each scale is tested */
      for (let currentScale of this.allScales) {
        /* If a worker identifier has been found for a scale, the task must be blocked */
        if (existingWorkerFoundForAScale) {
          break
        } else {
          /* The worker identifiers of the current scale are downloaded */
          let workers = await this.download(`${this.folder}${currentScale}/workers.json`);
          /* Check to verify if one of the workers which have already started the task is the current one */
          let taskAlreadyStarted = false;
          for (let currentWorker of workers['started']) if (currentWorker == this.workerIdentifier) taskAlreadyStarted = true;
          /* If the current worker has not started the task */
          if (!taskAlreadyStarted) {
            /* His identifier is uploaded to the file of the scale to which he is assigned */
            if (this.scale == currentScale) {
              workers['started'].push(this.workerIdentifier);
              uploadStatus = await (this.upload(this.workersFile, workers));
            }
            /* The current one is a brand new worker */
            existingWorkerFoundForAScale = false;
          } else {
            /* The current one is a returning worker */
            existingWorkerFoundForAScale = true;
          }
        }
      }
      /* If a returning worker has been found, the task must be blocked, otherwise he is free to proceed */
      if (existingWorkerFoundForAScale) return false;
      return !uploadStatus["failed"];
    } else {
      /* The worker identifiers of the current scale are downloaded */
      let workers = await this.download(this.workersFile);
      /* Check to verify if one of the workers which have already started the task is the current one */
      let taskAlreadyStarted = false;
      for (let currentWorker of workers['started']) if (currentWorker == this.workerIdentifier) taskAlreadyStarted = true;
      /* If the current worker has not started the task */
      if (!taskAlreadyStarted) {
        /* His identifier is uploaded to the file of the scale to which he is assigned */
        workers['started'].push(this.workerIdentifier);
        let uploadStatus = await (this.upload(this.workersFile, workers));
        /* If the current worker is a brand new one he is free to proceed */
        return !uploadStatus["failed"];
      }
      /* If a returning worker has been found, the task must be blocked */
      return false
    }
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
      this.ngxService.start();

      /* The hits stored on Amazon S3 are retrieved */
      let hits = await this.download(this.hitsFile);

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
      let rawQuestionnaires = await this.download(this.questionnairesFile);
      this.questionnaireAmount = rawQuestionnaires.length;

      /*  Each questionnaire is parsed using the Questionnaire class.  */
      for (let index = 0; index < this.questionnaireAmount; index++) this.questionnaires.push(new Questionnaire(index, rawQuestionnaires[index]));

      /* A form for each questionnaire is initialized */
      this.questionnairesForm = new Array<FormGroup>();
      for (let index = 0; index < this.questionnaires.length; index++) {
        let questionnaire = this.questionnaires[index];
        if (questionnaire.type == "standard") {
          /* If the questionnaire is a standard one it means that it has only questions where answers must be selected within a group of radio buttons.
           * This means that only a required validator is required to check answer presence
           */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`control_${index_question}`] = new FormControl('', [Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        } else {
          /* If the questionnaire is a crt one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user.
           * This means that required, max and min validators are needed
           */
          let controlsConfig = {};
          for (let index_question = 0; index_question < questionnaire.questions.length; index_question++) controlsConfig[`control_${index_question}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
          this.questionnairesForm[index] = this.formBuilder.group(controlsConfig)
        }
      }

      /* |- HIT DOCUMENTS - INITIALIZATION-| */

      /* The array of documents is initialized */
      this.documents = new Array<Document>();
      this.documentsAmount = this.hit.documents_number;

      /* A form for each document is initialized */
      this.documentsForm = new Array<FormGroup>();
      for (let index = 0; index < this.documentsAmount; index++) {
        /* Validators are initialized for each field to ensure data consistency */
        let workerValue = null;
        if (this.scale != "S100") workerValue = new FormControl('', [Validators.required]); else workerValue = new FormControl(50, [Validators.required]);
        let workerUrl = new FormControl('', [Validators.required, this.validateSearchEngineUrl.bind(this)]);
        this.documentsForm[index] = this.formBuilder.group({
          "worker_value": workerValue,
          "worker_url": workerUrl,
        })
      }

      /*  Each document of the current hit is parsed using the Document interface.  */
      for (let index = 1; index <= this.documentsAmount; index++) {
        let current_document = this.hit[`document_${index}`];
        let documentIndex = index - 1;
        this.documents.push(new Document(documentIndex, current_document));
      }

      /* The array of accesses counter is initialized */
      this.elementsAccesses = new Array<number>(this.documentsAmount + this.questionnaireAmount);
      for (let index = 0; index < this.elementsAccesses.length; index++) this.elementsAccesses[index] = 1;

      /* |- HIT SEARCH ENGINE - INITIALIZATION-| */

      this.searchEngineQueries = new Array<object>(this.documentsAmount);
      for (let index = 0; index < this.searchEngineQueries.length; index++) {
        this.searchEngineQueries[index] = {};
        this.searchEngineQueries[index]["data"] = [];
        this.searchEngineQueries[index]["amount"] = 0;
      }
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
        if (this.documents[index].getGoldQuestionIndex("HIGH")!=null) this.goldIndexHigh = this.documents[index].getGoldQuestionIndex("HIGH");
        if (this.documents[index].getGoldQuestionIndex("LOW")!=null) this.goldIndexLow = this.documents[index].getGoldQuestionIndex("LOW");
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

      /* Detect changes within the DOM and update the page */
      this.changeDetector.detectChanges();

      /* The loading spinner is stopped */
      this.ngxService.stop();

    }

  }

  // |--------- SEARCH ENGINE INTEGRATION - FUNCTIONS ---------|

  /*
   * This function intercepts a <queryEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the query typed by the worker within a given document.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineUserQuery(queryData: Object) {
    /* The current document and user query are parsed from the JSON object */
    let currentDocument = parseInt(queryData['target']['id'].split("-")[3]);
    let currentUserQuery = queryData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some data for the current document already exists*/
    if (this.searchEngineQueries[currentDocument]['amount'] > 0) {
      /* The new query is pushed into current document data array along with a index used to identify such query*/
      let storedQueries = Object.values(this.searchEngineQueries[currentDocument]['data']);
      storedQueries.push({
        "index": storedQueries.length,
        "timestamp": timeInSeconds,
        "text": currentUserQuery
      });
      /* The data array within the data structure is updated */
      this.searchEngineQueries[currentDocument]['data'] = storedQueries;
      /* The total amount of query for the current document is updated */
      this.searchEngineQueries[currentDocument]['amount'] = storedQueries.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineQueries[currentDocument] = {};
      /* A new data array for the current document is created and the fist query is pushed */
      this.searchEngineQueries[currentDocument]['data'] = [{
        "index": 0,
        "timestamp": timeInSeconds,
        "text": currentUserQuery
      }];
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
    /* The current document and user search engine retrieved response are parsed from the JSON object */
    let currentDocument = parseInt(retrievedResponseData['target']['id'].split("-")[3]);
    let currentRetrievedResponse = retrievedResponseData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineRetrievedResponses[currentDocument]['amount'] > 0) {
      /* The new response is pushed into current document data array along with its query index */
      let storedResponses = Object.values(this.searchEngineRetrievedResponses[currentDocument]['data']);
      storedResponses.push({
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse,
      });
      /* The data array within the data structure is updated */
      this.searchEngineRetrievedResponses[currentDocument]['data'] = storedResponses;
      /* The total amount of retrieved responses for the current document is updated */
      this.searchEngineRetrievedResponses[currentDocument]['amount'] = storedResponses.length;
    } else {
      /* The data slot for the current document is created */
      this.searchEngineRetrievedResponses[currentDocument] = {};
      /* A new data array for the current document is created and the fist response is pushed */
      this.searchEngineRetrievedResponses[currentDocument]['data'] = [{
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "timestamp": timeInSeconds,
        "response": currentRetrievedResponse
      }];
      /* The total amount of retrieved responses for the current document is set to 1 */
      /* IMPORTANT: the index of the last retrieved response for a document will be <amount -1> */
      this.searchEngineRetrievedResponses[currentDocument]['amount'] = 1
    }
    /* The form control to set the url of the selected search result is enabled */
    this.documentsForm[currentDocument].controls["worker_url"].enable();
  }

  /*
   * This function intercepts a <selectedRowEmitter> triggered by an instance of the search engine.
   * The parameter is a JSON object which holds the selected search engine result within a given document.
   * This array CAN BE EMPTY, if the search engine does not find anything for the current query.
   * These information are parsed and stored in the corresponding data structure.
   */
  public storeSearchEngineSelectedResponse(selectedResponseData: Object) {
    /* The current document and user search engine retrieved response are parsed from the JSON object */
    let currentDocument = parseInt(selectedResponseData['target']['id'].split("-")[3]);
    let currentSelectedResponse = selectedResponseData['detail'];
    let timeInSeconds = Date.now() / 1000;
    /* If some responses for the current document already exists*/
    if (this.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
      /* The new response is pushed into current document data array along with its query index */
      let storedResponses = Object.values(this.searchEngineSelectedResponses[currentDocument]['data']);
      storedResponses.push({
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
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
        "query": this.searchEngineQueries[currentDocument]['amount'] - 1,
        "timestamp": timeInSeconds,
        "response": currentSelectedResponse
      }];
      /* The total amount of retrieved responses for the current document is set to 1 */
      /* IMPORTANT: the index of the last retrieved response for a document will be <amount -1> */
      this.searchEngineSelectedResponses[currentDocument]['amount'] = 1
    }
    this.documentsForm[currentDocument].controls["worker_url"].setValue(currentSelectedResponse['url']);
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
      if(this.stepper.selectedIndex >= this.questionnaireAmount) {
        let currentDocument = this.stepper.selectedIndex - this.questionnaireAmount;
        /* If there are data for the current document */
        if (this.searchEngineRetrievedResponses[currentDocument]) {
          let retrievedResponses = this.searchEngineRetrievedResponses[currentDocument];
          if (retrievedResponses.hasOwnProperty("data")) {
            /* The current set of responses is the total amount - 1 */
            let currentSet = retrievedResponses["amount"] - 1;
            /* The responses retrieved by search engine are selected */
            let currentResponses = retrievedResponses["data"][currentSet]["response"];
            /* Each response is scanned */
            for (let index = 0; index < currentResponses.length; index++) {
              /* As soon as an url that matches with the one selected/typed by the worker the validation is successful */
              if (workerUrlFormControl.value == currentResponses[index].url) return null;
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

  /* |--------- QUALITY CHECKS INTEGRATION - FUNCTIONS ---------| */

  /*
   * This function performs and scan of each form filled by the current worker (i.e., questionnaires + document answers)
   * to ensure that each form posses the validation step (i.e., each field is filled, the url provided as a justification
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
   *                           is lower that the value selected for the gold question obviously true
   * 3) TIME SPENT CHECK:      Verifies if the time spent by worker on each document and questionnaire is higher than
   *                           two seconds, using the <timestampsElapsed> array
   * If each check is successful, the task can end. If the worker has some tries left, the task is reset.
   */
  public async performQualityCheck() {

    /* The loading spinner is started */
    this.ngxService.start();

    /* The current try is completed and the final can shall begin */
    this.taskCompleted = true;

    /* Booleans to hold result of checks */
    let globalValidityCheck: boolean;
    let goldQuestionCheck: boolean;
    let timeSpentCheck: boolean;

    /* 1) GLOBAL VALIDITY CHECK performed here */
    globalValidityCheck = this.performGlobalValidityCheck();

    /* 2) GOLD QUESTION CHECK performed here */
    goldQuestionCheck = this.documentsForm[this.goldIndexLow].controls["worker_value"].value < this.documentsForm[this.goldIndexHigh].controls["worker_value"].value;

    /* 3) TIME SPENT CHECK performed here */
    timeSpentCheck = true;
    for (let i = 0; i < this.timestampsElapsed.length; i++) if (this.timestampsElapsed[i] < 2) timeSpentCheck = false;

    /* If each check is true, the task is successful, otherwise the task is failed (but not over if there are more tries) */
    if (globalValidityCheck && goldQuestionCheck && timeSpentCheck) {
      this.taskSuccessful = true;
      this.taskFailed = false;
    } else {
      this.taskSuccessful = false;
      this.taskFailed = true;
    }

    /* The result of quality check control for the current try is uploaded to the Amazon S3 bucket. */
    if (!(this.workerIdentifier === null)) {
      let qualityCheckData = {
        globalFormValidity: globalValidityCheck,
        goldQuestionCheck: goldQuestionCheck,
        timeSpentCheck: timeSpentCheck,
      };
      await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/checks.json`, qualityCheckData));
    }

    /* Detect changes within the DOM and stop the spinner */
    this.changeDetector.detectChanges();

    /* The browser window is scrolled to the outcome section of the page, where the outcome of the current try is shown */
    document.querySelector('.outcome-section').scrollIntoView({behavior: 'smooth', block: 'start'});

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
    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted = true;
    this.comment.setValue("");
    this.commentSent = false;

    /* Set stepper index to the first tab (i.e., bring the worker to the first document after the questionnaire) */
    this.stepper.selectedIndex = this.questionnaireAmount;

    /* Decrease the remaining tries amount*/
    this.allowedTries = this.allowedTries - 1;

    /* Increases the current try index */
    this.currentTry = this.currentTry + 1;

    /* The loading spinner is stopped */
    this.ngxService.stop();

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

    if (!(this.workerIdentifier === null)) {

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
       * and the end timestamp for the previous and vicecersa
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

          /* The full information about task setup (i.e., its document and questionnaire structures) are uploaded, only once */
          let taskData = {
            experiment_id: this.experimentId,
            current_scale: this.scale,
            use_each_scale: this.useEachScale,
            worker_id: this.workerIdentifier,
            unit_id: this.unitId,
            token_input: this.tokenInput.value,
            token_output: this.tokenOutput,
            tries_amount: this.allowedTries,
            questionnaire_amount: this.questionnaireAmount,
            documents_amount: this.documentsAmount
          };
          /* General info about task */
          await (this.upload(`${this.workerFolder}/task.json`, taskData));
          /* The parsed document contained in current worker's hit */
          await (this.upload(`${this.workerFolder}/documents.json`, this.documents));
          /* The answers of the current worker to the questionnaire */
          await (this.upload(`${this.workerFolder}/questionnaires.json`, this.questionnaires));

        }

        /* The partial data about the completed questionnaire are uploaded */

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedElement,
          element: "questionnaire"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        await (this.upload(`${this.workerFolder}/Partials/Info/Try-${this.currentTry}/info_${completedElement}_access_${accessesAmount}.json`, actionInfo));
        /* Worker's answers to the current questionnaire */
        let answers = this.questionnairesForm[completedElement].value;
        await (this.upload(`${this.workerFolder}/Partials/Answers/Questionnaires/answer_${completedElement}.json`, answers));
        /* Start, end and elapsed timestamps for the current questionnaire */
        let timestampsStart = this.timestampsStart[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/Start/Try-${this.currentTry}/start_${completedElement}_access_${accessesAmount}.json`, timestampsStart));
        let timestampsEnd = this.timestampsEnd[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/End/Try-${this.currentTry}/end_${completedElement}_access_${accessesAmount}.json`, timestampsEnd));
        let timestampsElapsed = this.timestampsElapsed[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/Elapsed/Try-${this.currentTry}/elapsed_${completedElement}_access_${accessesAmount}.json`, timestampsElapsed));
        /* Number of accesses to the current questionnaire (which must be always 1, since the worker cannot go back */
        let accesses = this.elementsAccesses[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Accesses/Try-${this.currentTry}/accesses_${completedElement}_access_${accessesAmount}.json`, accesses));

        /* If the worker has completed the last questionnaire */

        if (completedElement == this.questionnaireAmount - 1) {

          /* All questionnaire answers are uploaded, only once */
          let answers = [];
          for (let index = 0; index < this.questionnairesForm.length; index++) answers.push(this.questionnairesForm[index].value);
          await (this.upload(`${this.workerFolder}/Final/answers_questionnaires.json`, answers));

        }

        /* The amount of accesses to the current questionnaire is incremented */
        this.elementsAccesses[completedElement] = accessesAmount + 1;

        /* If the worker has completed a document */
      } else {

        /* The amount of accesses to the current document is retrieved */
        let accessesAmount = this.elementsAccesses[completedElement];

        /* The index of the completed document is the completed element minus the questionnaire amount */
        let completedDocument = completedElement - this.questionnaireAmount;

        let actionInfo = {
          action: action,
          access: accessesAmount,
          try: this.currentTry,
          index: completedElement,
          element: "document"
        };
        /* Info about the performed action ("Next"? "Back"? From where?) */
        await (this.upload(`${this.workerFolder}/Partials/Info/Try-${this.currentTry}/info_${completedElement}_access_${accessesAmount}.json`, actionInfo));
        /* Worker's truth level and justification for the current document */
        let answers = this.documentsForm[completedDocument].value;
        await (this.upload(`${this.workerFolder}/Partials/Answers/Documents/Try-${this.currentTry}/answer_${completedDocument}_access_${accessesAmount}.json`, answers));
        /* Worker's search engine queries for the current document */
        let searchEngineQueries = this.searchEngineQueries[completedDocument];
        await (this.upload(`${this.workerFolder}/Partials/Queries/Try-${this.currentTry}/queries_${completedDocument}_access_${accessesAmount}.json`, searchEngineQueries));
        /* Responses retrieved by search engine for each worker's query for the current document */
        let responsesRetrieved = this.searchEngineRetrievedResponses[completedDocument];
        await (this.upload(`${this.workerFolder}/Partials/Responses/Retrieved/Try-${this.currentTry}/retrieved_${completedDocument}_access_${accessesAmount}.json`, responsesRetrieved));
        /* Responses by search engine ordered by worker's click for the current document */
        let responsesSelected = this.searchEngineSelectedResponses[completedDocument];
        await (this.upload(`${this.workerFolder}/Partials/Responses/Selected/Try-${this.currentTry}/selected_${completedDocument}_access_${accessesAmount}.json`, responsesSelected));
        /* Start, end and elapsed timestamps for the current document */
        let timestampsStart = this.timestampsStart[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/Start/Try-${this.currentTry}/start_${completedElement}_access_${accessesAmount}.json`, timestampsStart));
        let timestampsEnd = this.timestampsEnd[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/End/Try-${this.currentTry}/end_${completedElement}_access_${accessesAmount}.json`, timestampsEnd));
        let timestampsElapsed = this.timestampsElapsed[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Timestamps/Elapsed/Try-${this.currentTry}/elapsed_${completedElement}_access_${accessesAmount}.json`, timestampsElapsed));
        /* Number of accesses to the current document (i.e., how many times the worker reached the document with a "Back" or "Next" action */
        let accesses = this.elementsAccesses[completedElement];
        await (this.upload(`${this.workerFolder}/Partials/Accesses/Try-${this.currentTry}/accesses_${completedElement}_access_${accessesAmount}.json`, accesses));

        /* If the worker has completed the last document */
        if (completedElement == this.questionnaireAmount + this.documentsAmount - 1) {

          /* All data about documents are uploaded, only once */
          let actionInfo = {
            action: action,
            current_access: accessesAmount,
            current_try: this.currentTry,
            current_document: completedElement,
          };
          /* Info about each performed action ("Next"? "Back"? From where?) */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/info.json`, actionInfo));
          /* Worker's truth level and justification for each document */
          let answers = [];
          for (let index = 0; index < this.documentsForm.length; index++) answers.push(this.documentsForm[index].value);
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/answers_documents.json`, answers));
          /* Worker's search engine queries for each document */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/queries.json`, this.searchEngineQueries));
          /* Responses retrieved by search engine for each worker's query for each document */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/responses_retrieved.json`, this.searchEngineRetrievedResponses));
          /* Responses by search engine ordered by worker's click for the current document */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/responses_selected.json`, this.searchEngineSelectedResponses));
          /* Start, end and elapsed timestamps for each document */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/timestamps_start.json`, this.timestampsStart));
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/timestamps_end.json`, this.timestampsEnd));
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/timestamps_elapsed.json`, this.timestampsElapsed));
          /* Number of accesses to each document (i.e., how many times the worker reached the document with a "Back" or "Next" action */
          await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/accesses.json`, this.elementsAccesses));

        }

        /* The amount of accesses to the current document is incremented */
        this.elementsAccesses[completedElement] = accessesAmount + 1;

      }
    }
  }

  /*
   * This function gives the possibility to the worker to provide a comment when a try is finished, successfully or not.
   * The comment can be typed in a textarea and when the worker clicks the "Send" button such comment is uploaded to an Amazon S3 bucket.
   */
  public async performCommentSaving() {
    if (!(this.workerIdentifier === null)) await (this.upload(`${this.workerFolder}/Final/Try-${this.currentTry}/comment.json`, this.commentForm.value));
    this.commentSent = true;
  }

  /*
   * This function performs a GetObject operation to Amazon S3 and returns a parsed JSON which is the requested resource.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
   */
  public async download(path: string) {
    return JSON.parse(
      (await (this.s3.getObject({
        Bucket: this.bucket,
        Key: path
      }).promise())).Body.toString('utf-8'));
  }

  /*
   * This function performs an Upload operation to Amazon S3 and returns a JSON object which contains info about the outcome.
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property
   */
  public async upload(path: string, payload: Object):
    Promise<ManagedUpload> {
    return this.s3.upload({
      Key: path,
      Bucket: this.bucket,
      Body: JSON.stringify(payload, null, "\t")
    }, function (err, data) {
    })
  }

  /* |--------- UTILITIES ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function retrieves the string associated to an error code thrown by a form field validator.
   */
  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

}
