import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';

import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'

import {MatFormField} from "@angular/material/form-field";
import {MatStepper} from "@angular/material/stepper";

import {NgxUiLoaderService} from 'ngx-ui-loader';
import {ConfigService} from "../../services/config.service";

import {Document} from "../../models/skeleton/document";
import {Hit} from "../../models/skeleton/hit";

import * as AWS from 'aws-sdk';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

/*
* This class implements a skeleton for Crowdsourcing tasks. If you want to use this code to launch a Crowdsourcing task you will find some points in this code that you can edit.
* Such editing points are labelled with a comment like this:
* // EDIT: <<explanation>>
* And they will allow you to use your own document attributes, for example.
* */

export class SkeletonComponent {

  // |--------- GENERAL ELEMENTS - DECLARATION ---------|

  /* Name of the current task */
  experimentId: string;

  /* Unique identifier of the current worker */
  workerID: string;

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

  /* // EDIT: Set the following attributes accordingly */
  /* Rating scale to be used */
  scale: string;
  /* Flag to launch a batch of experiments for multiple rating scales */
  useEachModality: boolean;

  /* References to task stepper and token forms */
  @ViewChild('stepper', {static: false}) stepper: MatStepper;
  @ViewChild('urlField', {static: false}) urlField: MatFormField;
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

  // |--------- AMAZON AWS INTEGRATION - DECLARATION ---------|

  /* // EDIT: Set these fields within each environment in ../environments/ folder */
  /* AWS S3 Integration*/
  s3: AWS.S3;
  /* Region identifier */
  region: string;
  /* Bucket identifier */
  bucket: string;
  /* Folder to use within the bucket */
  folder: string;
  /* File where each worker identifier is stored */
  workersFile: string;
  /* File where each hit is stored */
  hitsFile: string;

  // |--------- QUESTIONNAIRE ELEMENTS - DECLARATION ---------|
  /* Attributes to handle the questionnaire part of a Crowdsourcing task */

  /* Number of different questionnaires inserted within task's body
  * (i.e., a standard questionnaire and two cognitive questionnaires  */
  questionnaireOffset: number;

  /* // EDIT: Add your own questionnaires and their fields here */
  /* Form controls */
  questionnaireForm: FormGroup;
  age: FormControl;
  degree: FormControl;
  money: FormControl;

  // |--------- HIT ELEMENTS - DECLARATION ---------|
  /* Attributes to handle each Hit of a Crowdsourcing task */

  /* Array of form references, one for each document within a Hit */
  documentsForm: FormGroup[];

  /* Amount of documents within a hit */
  documentsAmount: number;
  /* Array of documents */
  documents: Array<Document>;

  // |--------- SEARCH ENGINE INTEGRATION - DECLARATION ---------|
  /* https://github.com/Miccighel/Binger */

  /* Array to store search engine queries and responses, one for each document within a Hit */
  searchEngineQueries: Array<object>;
  searchEngineResponses: Array<object>;
  /* Flag to check if the query returned some results */
  resultsFound: boolean;

  // |--------- QUALITY CHECKS - DECLARATION ---------|

  /* Indexes of the gold questions within a Hit */
  goldIndexHigh: number;
  goldIndexLow: number;

  /* Arrays to record timestamps, one for each document within a Hit */
  timestampsStart: Array<Array<number>>;
  timestampsEnd: Array<Array<number>>;
  timestampsElapsed: Array<number>;

  // |--------- COMMENT ELEMENTS - DECLARATION ---------|
  /* Attributes to handle the final comments part of a Crowdsourcing task */

  /* Comment form reference */
  commentForm: FormGroup;
  /* Comment textarea */
  comment: FormControl;
  /* Flag to check if the comment has been correctly sent */
  commentSent: boolean;

  // |--------- CONSTRUCTOR ---------|
  /* */

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    formBuilder: FormBuilder,
  ) {

    // |--------- GENERAL ELEMENTS - INITIALIZATION ---------|

    this.experimentId = "CrowdsourcingSkeleton";

    let url = new URL(window.location.href);
    this.workerID = url.searchParams.get("workerID");

    this.changeDetector = changeDetector;
    this.ngxService = ngxService;
    this.configService = configService;
    this.formBuilder = formBuilder;

    this.taskAllowed = true;

    this.taskStarted = false;
    this.taskCompleted = false;
    this.taskSuccessful = false;
    this.taskFailed = false;

    /* // EDIT: Set the two following attributes accordingly */
    this.scale="S3";
    this.useEachModality = false;

    this.tokenInput = new FormControl('', [Validators.required], this.validateTokenInput.bind(this));
    this.tokenForm = formBuilder.group({
      "tokenInput":  new FormControl('', [Validators.required], this.validateTokenInput.bind(this))
    });
    this.tokenInputValid = false;

    this.allowedTries = 10;

    // |--------- AMAZON AWS INTEGRATION - INITIALIZATION ---------|

    this.region = 'eu-west-1';
    this.bucket = 'crowdsourcing-tasks';
    this.folder = `${this.experimentId}/`;
    this.workersFile = `${this.folder}workers.json`;
    this.hitsFile = `${this.folder}hits.json`;
    this.s3 = new AWS.S3({
      region: this.region,
      params: {Bucket: this.bucket},
      credentials: new AWS.Credentials(this.configService.environment.aws_id_key, this.configService.environment.aws_secret_key)
    });

    if (!(this.workerID === null)) {
      this.performWorkerStatusCheck().then(outcome => {
        this.taskAllowed = outcome;
        this.changeDetector.detectChanges()
      })
    }

    // |--------- QUESTIONNAIRE ELEMENTS - INITIALIZATION ---------|

    this.age = new FormControl('', [Validators.required]);
    this.degree = new FormControl('', [Validators.required]);
    this.money = new FormControl('', [Validators.required]);
    this.questionnaireForm = formBuilder.group({
      "age": this.age,
      "degree": this.degree,
      "money": this.money
    });

    // |--------- SEARCH ENGINE INTEGRATION - INITIALIZATION ---------|

    this.resultsFound = false;

  }

  // |--------- GENERAL ELEMENTS - FUNCTIONS ---------|

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

  // |--------- AMAZON AWS INTEGRATION - FUNCTIONS ---------|

  public async download(path: string): Promise<Array<Hit>> {
    return JSON.parse(
      (await (this.s3.getObject({
        Bucket: this.bucket,
        Key: path
      }).promise())).Body.toString('utf-8'));
  }


  public async performWorkerStatusCheck() {
    if (this.useEachModality) {
      let workers = JSON.parse((await (this.s3.getObject({
        Bucket: this.bucket,
        Key: this.workersFile
      }).promise())).Body.toString('utf-8'));
      let already_present = false;
      if (!already_present) {
        workers['started'].push(this.workerID);
        this.s3.upload({
          Key: this.workersFile,
          Bucket: this.bucket,
          Body: JSON.stringify(workers)
        }, function (err, data) {
        });
        return true
      } else {
        return false
      }
    } else {
      let workers = await this.download(this.workersFile);
      let taskAlreadyStarted = false;
      for (let currentWorker of workers['started']) if (currentWorker == this.workerID) taskAlreadyStarted = true;
      if (!taskAlreadyStarted) {
        workers['started'].push(this.workerID);
        this.s3.upload({
          Key: this.workersFile,
          Bucket: this.bucket,
          Body: JSON.stringify(workers)
        }, function (err, data) {
        });
        return true
      } else {
        return false
      }
    }
  }

  /* Function to lookup the input token of the current worker; if it exists, the custom setup of the task shall begin */
  public async performCheckAndLoad() {
    if (this.tokenForm.valid) {

      /* Start the spinner */
      this.ngxService.start();

      let hits = JSON.parse((await (this.s3.getObject({
        Bucket: this.bucket,
        Key: this.hitsFile
      }).promise())).Body.toString('utf-8'));

      /* Scan each entry for the token input */
      for (let currentHit of hits) {
        if (this.tokenInput.value === currentHit.token_input) {
          this.hit = currentHit;
          this.tokenOutput = currentHit.token_output;
          this.unitId = currentHit.unit_id
        }
      }

      /* Control variables to handle to start the task*/
      this.tokenInput.disable();
      this.taskStarted = true;

      this.documents = new Array<Document>();
      this.documentsAmount = this.hit.documents_number;
      this.searchEngineQueries = new Array<object>(this.documentsAmount);
      this.searchEngineResponses = new Array<object>(this.documentsAmount);
      this.timestampsStart = new Array<Array<number>>(this.documentsAmount + 1);
      for (let i = 0; i < this.timestampsStart.length; i++) {
        this.timestampsStart[i] = []
      }
      this.timestampsStart[0].push(Math.round(Date.now() / 1000));
      this.timestampsEnd = new Array<Array<number>>(this.documentsAmount + 1);
      for (let i = 0; i < this.timestampsEnd.length; i++) {
        this.timestampsEnd[i] = []
      }
      this.timestampsElapsed = new Array<number>(this.documentsAmount + 1);
      this.documentsForm = new Array<FormGroup>();
      for (let index = 0; index < this.documentsAmount; index++) {
        if (this.scale == "S100") {
          let workerValue = new FormControl(50, [Validators.required]);
          let workerUrl = new FormControl({value: ''}, [Validators.required, this.validateBingerURL.bind(this)]);
          this.documentsForm[index] = this.formBuilder.group({
            "workerValue": workerValue,
            "workerUrl": workerUrl,
          })
        } else {
          let workerValue = new FormControl('', [Validators.required]);
          let workerUrl = new FormControl('', [Validators.required, this.validateBingerURL.bind(this)]);
          this.documentsForm[index] = this.formBuilder.group({
            "workerValue": workerValue,
            "workerUrl": workerUrl,
          })
        }
      }

      for (let index = 1; index <= this.documentsAmount; index++) {
        let current_document = this.hit[`document_${index}`];
        this.documents.push(
          new Document(
            current_document["id_par"],
            current_document["name_unique"],
            current_document["statement"],
            current_document["speaker"],
            current_document["job"],
            current_document["context"],
            current_document["year"],
            current_document["party"],
            current_document["source"],
          )
        );
        if (current_document["id_par"] == "HIGH") {
          this.goldIndexHigh = index - 1
        }
        if (current_document["id_par"] == "LOW") {
          this.goldIndexLow = index - 1
        }
      }
    }

    /* Detect changes within the DOM and stop the spinner */
    this.changeDetector.detectChanges();


    /* Stop the spinner */
    this.ngxService.stop();

  }

  public saveBingerQuery(bingerData: string) {

    let currentDocument = parseInt(bingerData['target']['id'].split("-")[1]);
    let currentQuery = bingerData['detail'];
    let entry = {"documentNumber": currentDocument, "query": currentQuery.trim()};
    this.searchEngineQueries[currentDocument] = entry;

    /* console.log(this.searchEngineQueries) */

  }

  public saveBingerResponse(bingerData: Object) {

    let currentDocument = parseInt(bingerData['target']['id'].split("-")[1]);
    let currentResponse = bingerData['detail'];
    let entry = {"document": currentDocument, "response": currentResponse};
    this.searchEngineResponses[currentDocument] = entry;
    this.documentsForm[this.stepper.selectedIndex - 1].controls["workerUrl"].enable();
  }

  public saveBingerSelectedResult(bingerData: Object) {
    let currentDocument = parseInt(bingerData['target']['id'].split("-")[1]);
    this.searchEngineResponses[currentDocument]["selectedUrl"] = bingerData["detail"]["url"];
    this.documentsForm[currentDocument].controls["workerUrl"].setValue(bingerData["detail"]["url"])
  }

  public validateBingerURL(c: FormControl) {
    let workerUrl = c.value;
    if (typeof this.stepper !== "undefined") {
      if (typeof this.searchEngineResponses[this.stepper.selectedIndex - 1] !== "undefined") {
        if (this.searchEngineResponses[this.stepper.selectedIndex - 1].hasOwnProperty("response")) {
          let currentResults = this.searchEngineResponses[this.stepper.selectedIndex - 1]["response"];
          for (let index = 0; index < currentResults.length; index++) {
            if (workerUrl == currentResults[index].url) {
              return null;
            }
          }
          return {invalidBingerUrl: "Select (or copy & paste) one of the URLs shown above."}
        } else {
          return null
        }
      } else {
        return null
      }
    } else {
      return null
    }
  }

  /* Function to log worker's work to an external server */
  public performLogging(action: string, isFinal: boolean) {

    /* Every value inserted by worker can be found in these variables */

    let timeInSeconds = Date.now() / 1000;
    switch (action) {
      case "Next":
        this.timestampsStart[this.stepper.selectedIndex].push(timeInSeconds);
        this.timestampsEnd[this.stepper.selectedIndex - 1].push(timeInSeconds);
        break;
      case "Back":
        this.timestampsStart[this.stepper.selectedIndex].push(timeInSeconds);
        this.timestampsEnd[this.stepper.selectedIndex + 1].push(timeInSeconds);
        break;
      case "Finish":
        this.timestampsEnd[this.stepper.selectedIndex].push(timeInSeconds);
        break;
    }

    for (let i = 0; i < this.documentsAmount + 1; i++) {
      let totalSecondsElapsed = 0;
      for (let k = 0; k < this.timestampsEnd[i].length; k++) {
        if (this.timestampsStart[i][k] !== null && this.timestampsEnd[i][k] !== null) {
          totalSecondsElapsed = totalSecondsElapsed + (Number(this.timestampsEnd[i][k]) - Number(this.timestampsStart[i][k]))
        }
      }
      this.timestampsElapsed[i] = totalSecondsElapsed
    }

    let taskData = {
      experiment_id: this.experimentId,
      current_modality: this.scale,
      all_modalities: this.useEachModality,
      worker_id: this.workerID,
      unit_id: this.unitId,
      token_input: this.tokenInput.value,
      token_output: this.tokenOutput,
      amount_try: this.allowedTries,
      current_item: this.stepper.selectedIndex,
      documents: [],
      action: action,
      isFinal: isFinal
    };
    let bingerData = {};
    /* console.log(data) */
    for (let index = 0; index < this.documentsForm.length; index++) {
      let answers = this.documentsForm[index].value;
      answers["document_number"] = index;
      answers["id_par"] = this.documents[index].id_par;
      if (this.documents[index].hasOwnProperty("name_unique")) {
        answers["name_unique"] = this.documents[index].name_unique;
      } else {
        answers["name_unique"] = this.documents[index].id_par;
      }
      answers["speaker"] = this.documents[index].speaker;
      answers["job"] = this.documents[index].job;
      answers["context"] = this.documents[index].context;
      answers["year"] = this.documents[index].year;
      answers["party"] = this.documents[index].party;
      answers["source"] = this.documents[index].source;
      answers["statement"] = this.documents[index].statement;
      taskData["documents"].push(answers)
    }
    taskData["timestamps_start"] = this.timestampsStart;
    taskData["timestamps_end"] = this.timestampsEnd;
    taskData["timestamps_elapsed"] = this.timestampsElapsed;
    bingerData["queries"] = this.searchEngineQueries;
    bingerData["responses"] = this.searchEngineResponses;
    if (!(this.workerID === null)) {
      let taskDataKey = isFinal ? `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-ITEM-${this.stepper.selectedIndex}-TIMESTAMP-${Date.now()}-HIT-FINAL.json` : `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-ITEM-${this.stepper.selectedIndex}-TIMESTAMP-${Date.now()}-HIT.json`;
      let bingerDataKey = isFinal ? `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-ITEM-${this.stepper.selectedIndex}-TIMESTAMP-${Date.now()}-BINGER-FINAL.json` : `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-ITEM-${this.stepper.selectedIndex}-TIMESTAMP-${Date.now()}-BINGER.json`;
      this.s3.upload({
        Key: taskDataKey,
        Bucket: this.bucket,
        Body: JSON.stringify(taskData)
      }, function (err, data) {
        console.log(err);
      });
      this.s3.upload({
        Key: bingerDataKey,
        Bucket: this.bucket,
        Body: JSON.stringify(bingerData)
      }, function (err, data) {
        console.log(err);
      });
    }

  }

  performCommentSaving() {

    /* console.log(this.commentForm.value); */
    if (!(this.workerID === null)) {
      this.s3.upload({
        Key: `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-COMMENT.json`,
        Bucket: this.bucket,
        Body: JSON.stringify(this.commentForm.value)
      }, function (err, data) {

      });
    }
    this.commentSent = true;

  }

  public performGlobalValidityCheck() {
    let documentsFormValidity = true;
    for (let index = 0; index < this.documentsForm.length; index++) {
      if (this.documentsForm[index].valid == false) {
        documentsFormValidity = false
      }
    }
    return (this.questionnaireForm.valid && documentsFormValidity)
  }

  // Function to perform the final check on the current HIT and handle success/failure of the task
  public performFinalCheck() {

    /* Start the spinner */
    this.ngxService.start();

    /* Control variables to start final check */
    this.taskCompleted = true;

    let goldQuestionCheck: boolean;
    let timeSpentCheck: boolean;

    goldQuestionCheck = this.documentsForm[this.goldIndexLow].controls["workerValue"].value < this.documentsForm[this.goldIndexHigh].controls["workerValue"].value;

    timeSpentCheck = true;
    for (let i = 0; i < this.timestampsElapsed.length; i++) {
      if (this.timestampsElapsed[i] < 2) {
        timeSpentCheck = false
      }
    }

    let data = {
      tokenInputFormValid: this.tokenForm.valid,
      questionnaireForm: this.questionnaireForm.valid,
      globalFormValidity: this.performGlobalValidityCheck(),
      goldQuestionCheck: goldQuestionCheck,
      timeSpentCheck: timeSpentCheck
    };

    if (!(this.workerID === null)) {
      let key: string;
      key = `${this.folder}hits/${this.workerID}/TRIES-${this.allowedTries}-CHECKS.json`;
      this.s3.upload({
        Key: key,
        Bucket: this.bucket,
        Body: JSON.stringify(data)
      }, function (err, data) {
        console.log(err);
      });
    }

    /* console.log("Global Validity Check: " + this.performGlobalValidityCheck()); */
    /* console.log("Gold Question Check: " + goldQuestionCheck); */
    /* console.log("Time Spent Check: " + timeSpentCheck); */

    if (this.performGlobalValidityCheck() && goldQuestionCheck && timeSpentCheck) {
      this.taskSuccessful = true;
      this.taskFailed = false;
    } else {
      this.taskFailed = true;
      this.taskSuccessful = false;
    }

    /* Detect changes within the DOM and stop the spinner */
    this.changeDetector.detectChanges();

    document.querySelector('.outcome-section').scrollIntoView({behavior: 'smooth', block: 'start'});

    /* Stop the spinner */
    this.ngxService.stop();

  }

  /* Function to restore the status of the task while keeping the token input saved */
  public performReset() {

    /* Start the spinner */
    this.ngxService.start();

    /* Control variables to restore the task */
    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted = true;

    /* Set stepper index to the first tab*/
    this.stepper.selectedIndex = 1;


    /* Decrease the remaining tries amount*/
    this.allowedTries = this.allowedTries - 1;

    /* Stop the spinner */
    this.ngxService.stop();

  }

  /* Utility functions */

  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

}

