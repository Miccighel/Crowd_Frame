/* Core modules */
import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
/* Reactive forms modules */
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
/* Material design modules */
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {S3Service} from "../../services/s3.service";
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {LocalStorageService} from '../../services/local-storage.service';
/* File handling helpers */
import {ReadFile, ReadMode} from "ngx-file-helpers";
import {Question, Questionnaire} from "../../models/questionnaire";
import {Dimension, Mapping} from "../../models/dimension";
import {Instruction} from "../../models/instructions";
import {SettingsSearchEngine} from "../../models/settingsSearchEngine";
import {SettingsTask} from "../../models/settingsTask";

import { ColorPickerModule } from 'ngx-color-picker';
import {Hit} from "../../models/hit";
import {SettingsWorker} from "../../models/settingsWorker";
import {MatChipInputEvent} from "@angular/material/chips";
import {type} from "os";
import {AngularEditorConfig} from "@kolkov/angular-editor";

/*
 * The following interfaces are used to simplify data handling for each generator step.
 */

/* STEP #1 - Questionnaires */

interface QuestionnaireType {
  value: string;
  viewValue: string;
}

interface QuestionnairePosition {
  value: string;
  viewValue: string;
}

/* STEP #2 - Dimensions */

interface ScaleType {
  value: string;
  viewValue: string;
}

interface StyleType {
  value: string;
  viewValue: string;
}

interface PositionType {
  value: string;
  viewValue: string;
}

interface OrientationType {
  value: string;
  viewValue: string;
}

/* STEP #5 - Search Engine */

interface SourceType {
  value: string;
  viewValue: string;
}

/* STEP #6 - Task Settings */

interface AnnotatorType {
  value: string;
  viewValue: string;
}

interface BatchNode {
  name: string;
  batches?: BatchNode[];
}

/* Component HTML Tag definition */
@Component({
  selector: 'app-generator',
  templateUrl: './generator.component.html',
  styleUrls: ['./generator.component.scss']
})

/*
 * This class implements the generator of custom task configurations
 */
export class GeneratorComponent implements OnInit {

  /*
   * The following elements are used to define the forms to be filled for
   * each generator step and some data types to allow easier data handling
   */

  /* STEP #1 - Questionnaires */
  questionnairesForm: FormGroup;
  questionnaireTypes: QuestionnaireType[] = [
    {value: 'crt', viewValue: 'CRT'},
    {value: 'likert', viewValue: 'Likert'},
    {value: 'standard', viewValue: 'Standard'}
  ];
  questionnairePosition: QuestionnairePosition[] = [
    {value: 'start', viewValue: 'Start'},
    {value: 'end', viewValue: 'End'},
  ];

  questionnairesFetched: Array<Questionnaire>
  questionnairesSerialized: string

  /* STEP #2 - Dimensions */
  dimensionsForm: FormGroup;
  scaleTypes: ScaleType[] = [
    {value: 'categorical', viewValue: 'Categorical'},
    {value: 'interval', viewValue: 'Interval'},
    {value: 'magnitude_estimation', viewValue: 'Magnitude Estimation'}
  ];
  annotatorTypes: AnnotatorType[] = [
    {value: 'options', viewValue: 'Options'},
    {value: 'laws', viewValue: 'Laws'},
  ];
  styleTypes: StyleType[] = [
    {value: 'list', viewValue: 'List'},
    {value: 'matrix', viewValue: 'Matrix'}
  ];
  positionTypes: PositionType[] = [
    {value: 'top', viewValue: 'Top'},
    {value: 'middle', viewValue: 'Middle'},
    {value: 'bottom', viewValue: 'Bottom'}
  ];
  orientationTypes: OrientationType[] = [
    {value: 'horizontal', viewValue: 'Horizontal'},
    {value: 'vertical', viewValue: 'Vertical'}
  ];
  dimensionsFetched: Array<Dimension>
  dimensionsSerialized: string

  /* STEP #3 - General Instructions */
  generalInstructionsForm: FormGroup;
  generalInstructionsFetched: Array<Instruction>
  generalInstructionsSerialized: string

  /* STEP #4 - Evaluation Instructions */
  evaluationInstructionsForm: FormGroup;
  evaluationInstructionsFetched: Array<Instruction>
  evaluationInstructionsSerialized: string

  /* STEP #5 - Search Engine */
  searchEngineForm: FormGroup;
  sourceTypes: SourceType[] = [
    {value: null, viewValue: 'None'},
    {value: 'BingWebSearch', viewValue: 'BingWeb'},
    {value: 'FakerWebSearch', viewValue: 'FakerWeb'},
    {value: 'PubmedSearch', viewValue: 'Pubmed'}
  ];
  searchEngineFetched: SettingsSearchEngine
  searchEngineSerialized: string

  /* STEP #6 - Task Settings */
  taskSettingsForm: FormGroup;
  taskSettingsFetched: SettingsTask
  taskSettingsSerialized: string
  batchesTree: Array<Object>
  batchesTreeInitialization: boolean
  annotatorOptionColors: Array<string>
  /* Variables to handle hits file upload */
  hitsFile: ReadFile
  hitsFileName : string
  parsedHits: Array<Hit>
  hitsSize: number
  hitsDetected: number
  readMode: ReadMode

  /* STEP #7 - Worker Checks */
  workerChecksForm: FormGroup;
  workerChecksFetched
  workersChecksSerialized: string
  blacklistedWorkerId: Set<string>
  whitelistedWorkerId: Set<string>

  /* STEP #8 - Summary */

  uploadStarted: boolean
  uploadCompleted: boolean
  /* S3 Bucket base upload path */
  fullS3Path: string
  /* questionnaires.json upload path */
  questionnairesPath: string
  /* hits.json upload path */
  hitsPath: string
  /* dimensions.json upload path */
  dimensionsPath: string
  /* instructions_main.json upload path */
  taskInstructionsPath: string
  /* instructions_dimension.json upload path */
  dimensionsInstructionsPath: string
  /* search_engine.json upload path */
  searchEngineSettingsPath: string
  /* task.json upload path */
  taskSettingsPath: string
  /* workers.json upload path */
  workerChecksPath: string

  /* |--------- SERVICES & CO - DECLARATION ---------| */

  /* Loading screen service */
  ngxService: NgxUiLoaderService;
  /* Service to provide an environment-based configuration */
  configService: ConfigService;
  /* Service which wraps the interaction with S3 */
  S3Service: S3Service;
  /* Service which wraps the interaction with browser's local storage */
  localStorageService: LocalStorageService;

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  /* |--------- CONTROL FLOW & UI ELEMENTS - DECLARATION ---------| */

  editorConfig: AngularEditorConfig = {
    editable: true,
    spellcheck: true,
    height: 'auto',
    minHeight: '0',
    maxHeight: 'auto',
    width: 'auto',
    minWidth: '0',
    translate: 'yes',
    enableToolbar: true,
    showToolbar: true,
    placeholder: 'Enter text here...',
    defaultParagraphSeparator: '',
    defaultFontName: '',
    defaultFontSize: '',
    fonts: [
      {class: 'arial', name: 'Arial'},
      {class: 'times-new-roman', name: 'Times New Roman'},
      {class: 'calibri', name: 'Calibri'},
      {class: 'comic-sans-ms', name: 'Comic Sans MS'}
    ],
    customClasses: [
      {
        name: 'quote',
        class: 'quote',
      },
      {
        name: 'redText',
        class: 'redText'
      },
      {
        name: 'titleText',
        class: 'titleText',
        tag: 'h1',
      },
    ],
    sanitize: true,
    toolbarPosition: 'top',
    toolbarHiddenButtons: [
      [],
      [
        'customClasses',
        'insertImage',
        'insertVideo',
      ]
    ]
  };

  @ViewChild('generator') generator: MatStepper;

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
    localStorageService: LocalStorageService,
    private _formBuilder: FormBuilder,
  ) {

    /* |--------- SERVICES & CO. - INITIALIZATION ---------| */

    /* Service initialization */
    this.ngxService = ngxService
    this.configService = configService
    this.S3Service = S3Service
    this.changeDetector = changeDetector
    this.localStorageService = localStorageService
    this.ngxService.startLoader('generator-inner')

    this.downloadData()

    /* STEP #8 - Summary */

    this.fullS3Path = `${this.configService.environment.region}/${this.configService.environment.bucket}/${this.configService.environment.taskName}/${this.configService.environment.batchName}/`
    this.uploadStarted = false
    this.uploadCompleted = false
    this.questionnairesPath = null
    this.dimensionsPath = null
    this.taskInstructionsPath = null
    this.dimensionsInstructionsPath = null
    this.searchEngineSettingsPath = null
    this.workerChecksPath = null

    /* Read mode during hits file upload*/
    this.readMode = ReadMode.text

    this.ngxService.stopLoader('generator-inner')
  }

  downloadData() {

    /* STEP #1 - Questionnaires */

    let rawQuestionnaires = this.S3Service.downloadQuestionnaires(this.configService.environment)
    this.questionnairesFetched = new Array(rawQuestionnaires.length)
    rawQuestionnaires.forEach((data, questionnaireIndex) => {
      let questionnaire = new Questionnaire(questionnaireIndex, data)
      let identifier = `questionnaire-${questionnaireIndex}`
      let item = this.localStorageService.getItem(identifier)
      if (item) {
        this.questionnairesFetched[questionnaireIndex] = JSON.parse(item)
      } else {
        this.questionnairesFetched[questionnaireIndex] = questionnaire
        this.localStorageService.setItem(identifier, JSON.stringify(questionnaire))
      }
    })

    /* STEP #2 - Dimensions */

    let rawDimensions = this.S3Service.downloadDimensions(this.configService.environment)
    this.dimensionsFetched = new Array(rawDimensions.length)
    rawDimensions.forEach((data, dimensionIndex) => {
      let dimension = new Dimension(dimensionIndex, data)
      let identifier = `dimension-${dimensionIndex}`
      let item = this.localStorageService.getItem(identifier)
      if (item) {
        this.dimensionsFetched[dimensionIndex] = JSON.parse(item)
      } else {
        this.dimensionsFetched[dimensionIndex] = dimension
        this.localStorageService.setItem(identifier, JSON.stringify(dimension))
      }
    })

    /* STEP #3 - General Instructions */

    let rawGeneralInstructions = this.S3Service.downloadGeneralInstructions(this.configService.environment)
    this.generalInstructionsFetched = new Array(rawGeneralInstructions.length)
    rawGeneralInstructions.forEach((data, index) => {
      let instruction = new Instruction(index, data)
      let identifier = `general-instruction-${index}`
      let item = this.localStorageService.getItem(identifier)
      if (item) {
        this.generalInstructionsFetched[index] = JSON.parse(item)
      } else {
        this.generalInstructionsFetched[index] = instruction
        this.localStorageService.setItem(identifier, JSON.stringify(instruction))
      }
    })

    /* STEP #4 - Evaluation Instructions */

    let rawEvaluationInstructions = this.S3Service.downloadEvaluationInstructions(this.configService.environment)
    this.evaluationInstructionsFetched = new Array(rawEvaluationInstructions.length)
    rawEvaluationInstructions.forEach((data, index) => {
      let instruction = new Instruction(index, data)
      let identifier = `evaluation-instruction-${index}`
      let item = this.localStorageService.getItem(identifier)
      if (item) {
        this.evaluationInstructionsFetched[index] = JSON.parse(item)
      } else {
        this.evaluationInstructionsFetched[index] = instruction
        this.localStorageService.setItem(identifier, JSON.stringify(instruction))
      }
    })

    /* STEP #5 - Search Engine Settings */

    let rawSearchEngineSettings = this.S3Service.downloadSearchEngineSettings(this.configService.environment)
    this.searchEngineFetched = new SettingsSearchEngine(rawSearchEngineSettings)
    let identifier = `search-engine-settings`
    let item = this.localStorageService.getItem(identifier)
    if (item) this.searchEngineFetched = JSON.parse(item); else this.localStorageService.setItem(identifier, JSON.stringify(this.searchEngineFetched))

    /* STEP #6 - Task Settings */

    let rawTaskSettings = this.S3Service.downloadTaskSettings(this.configService.environment)
    this.taskSettingsFetched = new SettingsTask(rawTaskSettings)
    identifier = `task-settings`
    item = this.localStorageService.getItem(identifier)
    if (item) this.taskSettingsFetched = JSON.parse(item); else this.localStorageService.setItem(identifier, JSON.stringify(this.taskSettingsFetched))

    this.annotatorOptionColors = ['#FFFF7B']
    if(this.taskSettingsFetched.annotator) {
      if (this.taskSettingsFetched.annotator.type == "options") {
        if (this.taskSettingsFetched.annotator.values.length > 0) {
          this.annotatorOptionColors = []
          this.taskSettingsFetched.annotator.values.forEach((optionValue, optionValueIndex) => {
            this.annotatorOptionColors.push(optionValue['color'])
          })
        }
      }
    }
    this.batchesTreeInitialization = false

    /* STEP #7 - Worker Checks Settings */

    let rawWorkerChecks = this.S3Service.downloadWorkers(this.configService.environment)
    this.workerChecksFetched = new SettingsWorker(rawWorkerChecks)
    identifier = `worker-settings`
    item = this.localStorageService.getItem(identifier)
    if (item) this.workerChecksFetched = JSON.parse(item); else this.localStorageService.setItem(identifier, JSON.stringify(this.workerChecksFetched))

  }

  /*
   * The onInit method initializes each form when the user interface is ready
   */
  ngOnInit() {

    /* STEP #1 - Questionnaires */
    this.questionnairesForm = this._formBuilder.group({
      questionnaires: this._formBuilder.array([])
    });
    if (this.questionnairesFetched.length > 0) {
      this.questionnairesFetched.forEach((questionnaire, questionnaireIndex) => {
        this.addQuestionnaire(questionnaireIndex, questionnaire)
      })
    }
    this.questionnairesJSON()
    this.questionnairesForm.valueChanges.subscribe(value => this.questionnairesJSON())

    /* STEP #2 - Dimensions */
    this.dimensionsForm = this._formBuilder.group({
      dimensions: this._formBuilder.array([])
    });
    if (this.dimensionsFetched.length > 0) {
      this.dimensionsFetched.forEach((dimension, dimensionIndex) => {
        this.addDimension(dimensionIndex, dimension)
      })
    }
    this.dimensionsJSON()
    this.dimensionsForm.valueChanges.subscribe(value => this.dimensionsJSON())

    /* STEP #3 - General Instructions */
    this.generalInstructionsForm = this._formBuilder.group({
      generalInstructions: this._formBuilder.array([])
    });
    if (this.generalInstructionsFetched.length > 0) {
      this.generalInstructionsFetched.forEach((instruction, instructionIndex) => {
        this.addGeneralInstruction(instructionIndex, instruction)
      })
    }
    this.generalInstructionsJSON()
    this.generalInstructionsForm.valueChanges.subscribe(value => this.generalInstructionsJSON())

    /* STEP #4 - Evaluation Instructions */
    this.evaluationInstructionsForm = this._formBuilder.group({
      evaluationInstructions: this._formBuilder.array([])
    });
    if (this.evaluationInstructionsFetched.length > 0) {
      this.evaluationInstructionsFetched.forEach((instruction, instructionIndex) => {
        this.addEvaluationInstruction(instructionIndex, instruction)
      })
    }
    this.evaluationInstructionsJSON()
    this.evaluationInstructionsForm.valueChanges.subscribe(value => this.evaluationInstructionsJSON())

    /* STEP #5 - Search Engine */
    this.searchEngineForm = this._formBuilder.group({
      source: [this.searchEngineFetched ? this.searchEngineFetched.source : ''],
      domains_filter: this._formBuilder.array([])
    });
    if (this.searchEngineFetched.domains_filter.length > 0) this.searchEngineFetched.domains_filter.forEach((domain, domainIndex) => this.addDomain(domain))
    this.searchEngineJSON()
    this.searchEngineForm.valueChanges.subscribe(value => this.searchEngineJSON())

    /* STEP #6 - Task Settings */
    this.taskSettingsForm = this._formBuilder.group({
      allowed_tries: [this.taskSettingsFetched.allowed_tries ? this.taskSettingsFetched.allowed_tries : ''],
      time_check_amount: [this.taskSettingsFetched.time_check_amount ? this.taskSettingsFetched.time_check_amount : ''],
      hits: [],
      setAnnotator: [!!this.taskSettingsFetched.annotator],
      annotator: this._formBuilder.group({
        type: [this.taskSettingsFetched.annotator ? this.taskSettingsFetched.annotator.type : ''],
        values: this._formBuilder.array([]),
      }),
      setCountdownTime: [!!this.taskSettingsFetched.countdown_time],
      countdown_time: [this.taskSettingsFetched.countdown_time ? this.taskSettingsFetched.countdown_time : ''],
      blacklist_batches: this._formBuilder.array([]),
      whitelist_batches: this._formBuilder.array([]),
      messages: this._formBuilder.array([])
    });
    if (this.taskSettingsFetched.messages.length > 0) this.taskSettingsFetched.messages.forEach((message, messageIndex) => this.addMessage(message))
    if (this.taskSettingsFetched.annotator) if (this.taskSettingsFetched.annotator.type == "options") this.taskSettingsFetched.annotator.values.forEach((optionValue, optionValueIndex) => this.addOptionValue(optionValue))
    this.taskSettingsJSON()
    this.taskSettingsForm.valueChanges.subscribe(value => this.taskSettingsJSON())

    let hitsPromise = this.loadHits()
    let batchesPromise = this.loadBatchesTree()

    /* STEP #7 - Worker Checks */
    this.workerChecksForm = this._formBuilder.group({
      blacklist: [this.workerChecksFetched.blacklist ? this.workerChecksFetched.blacklist : ''],
      whitelist: [this.workerChecksFetched.whitelist ? this.workerChecksFetched.whitelist : '']
    })
    this.workerChecksJSON()
    this.workerChecksForm.valueChanges.subscribe(value => this.workerChecksJSON())

    this.whitelistedWorkerId =  new Set();
    this.blacklistedWorkerId =  new Set();
    this.workerChecksFetched.blacklist.forEach((workerId, workerIndex) => this.blacklistedWorkerId.add(workerId))
    this.workerChecksFetched.whitelist.forEach((workerId, workerIndex) => this.whitelistedWorkerId.add(workerId))

  }

  async loadHits() {
    let hits = JSON.parse(this.localStorageService.getItem('hits'))
    if(hits) {
      this.updateHitsFile(hits)
    } else {
      let hits = await this.S3Service.downloadHits(this.configService.environment)
      this.localStorageService.setItem(`hits`, JSON.stringify(hits))
      this.updateHitsFile(hits)
    }
  }

  async loadBatchesTree() {

    this.batchesTree = Array()
    let counter = 0
    let blackListedBatches = 0
    let whiteListedBatches = 0
    let tasks = await this.S3Service.listFolders(this.configService.environment)
    for (let task of tasks) {
      let taskNode = {
        "task": task['Prefix'],
        "batches": []
      }
      let batches = await this.S3Service.listFolders(this.configService.environment, task['Prefix'])
      for (let batch of batches) {
        let batchNode = {
          "batch": batch['Prefix'],
          "blacklist": false,
          "whitelist": false,
          "counter": counter
        }
        if(this.taskSettingsFetched.blacklistBatches) {
          this.taskSettingsFetched.blacklistBatches.forEach((batchName, batchIndex) => {
            blackListedBatches = blackListedBatches + 1
            batchNode['blacklist'] = batchName == batch["Prefix"];
          })
        }
        if(this.taskSettingsFetched.whitelistBatches) {
          this.taskSettingsFetched.whitelistBatches.forEach((batchName, batchIndex) => {
            whiteListedBatches = whiteListedBatches + 1
            batchNode['whitelist'] = batchName == batch["Prefix"];
          })
        }
        taskNode["batches"].push(batchNode)
        counter = counter + 1
      }
      this.batchesTree.push(taskNode)
    }
    this.batchesTreeInitialization = true

    if (blackListedBatches > 0) this.addBlacklistBatches()
    if (whiteListedBatches > 0) this.addWhitelistBatches()

    this.changeDetector.detectChanges()

  }

  /* The following functions are sorted on a per-step basis. For each step it may be present:
   * - a function which returns the filled form (i.e., questionnaires())
   * - a function which returns the values of a sub element (i.e., questions())
   * - a function called addXXX which adds a new sub element to the form (i.e., addQuestion())
   * - a function called removeXXX which removes a sub element from the form (i.e., removeQuestion())
   * - a function called updateXXX which updates an already present sub element to responds to values chosen
   *   in other fiels (i.e., updateQuestionnaire())
   * - a funcion called resetXXX which resets a single field or a sub element (i.e., resetJustification())
   * - a function called xxxJSON which outputs the values of a single step's form as a JSON dictionary (i.e., questionnairesJSON())
   * */

  /* STEP #1 - Questionnaires */

  questionnaires(): FormArray {
    return this.questionnairesForm.get('questionnaires') as FormArray;
  }

  addQuestionnaire(questionnaireIndex = null, questionnaire = null as Questionnaire) {
    this.questionnaires().push(this._formBuilder.group({
      type: [questionnaire ? questionnaire.type : ''],
      description: [questionnaire ? questionnaire.description : ''],
      position: [questionnaire ? questionnaire.position : ''],
      questions: this._formBuilder.array([]),
      mapping: this._formBuilder.array([])
    }))
    if (questionnaire) {
      questionnaire.questions.forEach((question, questionIndex) => this.addQuestion(questionnaireIndex, questionIndex, question))
    }
  }

  removeQuestionnaire(questionnaireIndex: number) {
    this.questionnaires().removeAt(questionnaireIndex);
  }

  updateQuestionnaire(questionnaireIndex) {
    let questionnaire = this.questionnaires().at(questionnaireIndex);

    questionnaire.get('description').setValue('');
    questionnaire.get('description').clearValidators();
    questionnaire.get('description').updateValueAndValidity();

    this.questions(questionnaireIndex).clear();
    this.mapping(questionnaireIndex).clear();

    this.addQuestion(questionnaireIndex);
    if (questionnaire.get('type').value == 'likert') {
      this.addMapping(questionnaireIndex);
    }
  }

  /* SUB ELEMENT: Questions */

  questions(questionnaireIndex: number): FormArray {
    return this.questionnaires().at(questionnaireIndex).get('questions') as FormArray;
  }

  addQuestion(questionnaireIndex: number, questionIndex = null as number, question = null as Question) {
    this.questions(questionnaireIndex).push(this._formBuilder.group({
      name: [question ? question.name : ''],
      text: [question ? question.text : ''],
      answers: this._formBuilder.array([])
    }));
    if (question && question.answers) for (let answer of question.answers) this.addAnswer(questionnaireIndex, questionIndex, answer)
    if (this.questionnaires().at(questionnaireIndex).get('type').value == 'standard' && this.questions(questionnaireIndex).length == 0) {
      this.addAnswer(questionnaireIndex, this.questions(questionnaireIndex).length - 1);
    }
  }

  removeQuestion(questionnaireIndex: number, questionIndex: number) {
    this.questions(questionnaireIndex).removeAt(questionIndex);
  }

  /* SUB ELEMENT: Answers */

  answers(questionnaireIndex: number, questionIndex: number): FormArray {
    return this.questions(questionnaireIndex).at(questionIndex).get('answers') as FormArray;
  }

  addAnswer(questionnaireIndex: number, questionIndex: number, answer = null as string) {
    this.answers(questionnaireIndex, questionIndex).push(this._formBuilder.group({
      answer: [answer ? answer : '']
    }))
  }

  removeAnswer(questionnaireIndex: number, questionIndex: number, answerIndex: number) {
    this.answers(questionnaireIndex, questionIndex).removeAt(answerIndex);
  }

  /* SUB ELEMENT: Mappings  */

  mapping(questionnaireIndex: number): FormArray {
    return this.questionnaires().at(questionnaireIndex).get('mapping') as FormArray;
  }

  addMapping(questionnaireIndex: number) {
    this.mapping(questionnaireIndex).push(this._formBuilder.group({
      label: [''],
      value: ['']
    }))
  }

  removeMapping(questionnaireIndex: number, mappingIndex: number) {
    this.mapping(questionnaireIndex).removeAt(mappingIndex);
  }

  /* JSON Output */

  questionnairesJSON() {
    let questionnairesJSON = JSON.parse(JSON.stringify(this.questionnairesForm.get('questionnaires').value));
    questionnairesJSON.forEach((questionnaire, questionnaireIndex) => {
      switch (questionnaire.type) {
        case 'crt':
          delete questionnaire.description;
          for (let questionIndex in questionnaire.questions) {
            delete questionnaire.questions[questionIndex].answers;
          }
          delete questionnaire.mapping;
          break;

        case 'likert':
          for (let questionIndex in questionnaire.questions) {
            delete questionnaire.questions[questionIndex].answers;
          }
          break;

        case 'standard':
          delete questionnaire.description;
          for (let questionIndex in questionnaire.questions) {
            let answersStringArray = [];
            for (let answerIndex in questionnaire.questions[questionIndex].answers) {
              answersStringArray.push(questionnaire.questions[questionIndex].answers[answerIndex].answer);
            }
            questionnaire.questions[questionIndex].answers = answersStringArray;
          }
          delete questionnaire.mapping;
          break;
        default:
          break;
      }
      this.localStorageService.setItem(`questionnaire-${questionnaireIndex}`, JSON.stringify(questionnaire))
    })
    this.questionnairesSerialized = JSON.stringify(questionnairesJSON)
  }

  /* STEP #2 - Dimensions */

  dimensions(): FormArray {
    return this.dimensionsForm.get('dimensions') as FormArray;
  }

  addDimension(dimensionIndex = null, dimension = null as Dimension) {
    let name, name_pretty, description, gold, setJustification, justification, url, setScale, scale, setStyle, style;
    name = dimension.name ? dimension.name : '';
    name_pretty = dimension.name_pretty ? dimension.name_pretty : '';
    description = dimension.description ? dimension.description : '';
    gold = dimension.gold ? dimension.gold : false;
    setJustification = dimension.justification ? dimension.justification : false;
    justification = !dimension.justification ? false : this._formBuilder.group({
      text: [dimension.justification.text],
      min_words: [dimension.justification.min_words]
    });
    url = dimension.url ? dimension.url : false;
    setScale = dimension.scale ? dimension.scale : false;
    scale = !dimension.scale ? false : this._formBuilder.group({
      type: [dimension.scale.type],
      min: [dimension.scale['min'] ? dimension.scale['min'] : dimension.scale['min'] == 0 ? '0' : ''],
      max: [dimension.scale['max'] ? dimension.scale['max'] : dimension.scale['max'] == 0 ? '0' : ''],
      step: [dimension.scale['step'] ? dimension.scale['step'] : dimension.scale['step'] == 0 ? '0' : ''],
      mapping: this._formBuilder.array([]),
      lower_bound: [dimension.scale['lower_bound'] ? dimension.scale['lower_bound'] : ''],
    });
    setStyle = dimension.style ? dimension.style : false;
    style = !dimension.style ? false : this._formBuilder.group({
      styleType: [dimension.style.type],
      position: [dimension.style.position],
      orientation: [dimension.style.orientation],
      separator: [dimension.style.separator]
    });
    this.dimensions().push(this._formBuilder.group({
      name: name,
      name_pretty: name_pretty,
      description: description,
      gold: gold,
      setJustification: setJustification,
      justification: justification,
      url: url,
      setScale: setScale,
      scale: scale,
      setStyle: setStyle,
      style: style
    }))
    if (dimension && dimension.scale) if (dimension.scale.type == 'categorical') {
      if (dimension.scale['mapping']) for (let mapping of dimension.scale['mapping']) this.addDimensionMapping(dimensionIndex, mapping)
      if (this.dimensionMapping(dimensionIndex).length == 0) this.addDimensionMapping(dimensionIndex)
    }
    if (dimension && dimension.style) {
      this.updateStyleType(dimensionIndex)
    }
  }

  removeDimension(dimensionIndex: number) {
    this.dimensions().removeAt(dimensionIndex);
  }

  resetJustification(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);

    dim.get('justification').get('text').setValue('');
    dim.get('justification').get('min_words').setValue('');

    if (dim.get('setJustification').value == false) {
      dim.get('justification').get('text').clearValidators();
      dim.get('justification').get('min_words').clearValidators();
    } else {
      dim.get('justification').get('text').setValidators(Validators.required);
      dim.get('justification').get('min_words').setValidators(Validators.required);
    }
    dim.get('justification').get('text').updateValueAndValidity();
    dim.get('justification').get('min_words').updateValueAndValidity();
  }

  resetScale(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);
    dim.get('scale').get('type').setValue('');
    this.updateScale(dimensionIndex);
    dim.get('style').get('styleType').setValue('');
    this.updateStyleType(dimensionIndex);
  }

  updateScale(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);

    if (dim.get('setScale').value == false) {
      dim.get('scale').get('type').clearValidators();
    } else {
      dim.get('scale').get('type').setValidators(Validators.required);
    }
    dim.get('scale').get('type').updateValueAndValidity();

    dim.get('scale').get('min').setValue('');
    dim.get('scale').get('min').clearValidators();
    dim.get('scale').get('min').updateValueAndValidity();

    dim.get('scale').get('max').setValue('');
    dim.get('scale').get('max').clearValidators();
    dim.get('scale').get('max').updateValueAndValidity();

    dim.get('scale').get('step').setValue('');
    dim.get('scale').get('step').clearValidators();
    dim.get('scale').get('step').updateValueAndValidity();

    this.dimensionMapping(dimensionIndex).clear();

    dim.get('scale').get('lower_bound').setValue(true);

    if (dim.get('setScale').value == true && dim.get('scale').get('type').value == 'categorical') {
      this.addDimensionMapping(dimensionIndex);
    }

    if (dim.get('setScale').value == true) {
      switch (dim.get('scale').get('type').value) {
        case "categorical":
          dim.get('style').get('styleType').enable()
          dim.get('style').get('styleType').setValue('')
          dim.get('style').get('position').enable()
          dim.get('style').get('orientation').enable()
          dim.get('style').get('orientation').setValue('')
          this.updateStyleType(dimensionIndex)
          break;
        case "interval":
          dim.get('style').get('styleType').setValue("list")
          dim.get('style').get('styleType').disable()
          dim.get('style').get('position').enable()
          dim.get('style').get('orientation').setValue("vertical")
          dim.get('style').get('orientation').disable()
          this.updateStyleType(dimensionIndex)
          break;
        case "magnitude_estimation":
          dim.get('style').get('styleType').setValue("list")
          dim.get('style').get('styleType').disable()
          dim.get('style').get('position').enable()
          dim.get('style').get('orientation').setValue("vertical")
          dim.get('style').get('orientation').disable()
          this.updateStyleType(dimensionIndex)
          break;
      }
    }
  }

  resetStyle(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);
    dim.get('style').get('styleType').setValue('');
    this.updateStyleType(dimensionIndex);
  }

  updateStyleType(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);
    let styleType = dim.get('style').get('styleType').value;

    if (dim.get('setStyle').value == false) {
      dim.get('style').get('styleType').clearValidators();
      dim.get('style').get('position').clearValidators();
      dim.get('style').get('orientation').clearValidators();
    } else {
      dim.get('style').get('styleType').setValidators(Validators.required);
      dim.get('style').get('position').setValidators(Validators.required);
      dim.get('style').get('orientation').setValidators(Validators.required);
    }

    switch (styleType) {
      case "matrix":
        dim.get('style').get('orientation').setValue('')
        dim.get('style').get('orientation').disable()
        dim.get("style").get('separator').enable()
        break;
      case "list":
        if (dim.get('scale').get('type').value == "categorical") {
          dim.get('style').get('orientation').enable()
        } else {
          dim.get('style').get('orientation').disable()
        }
        dim.get("style").get('separator').disable()
        dim.get("style").get('separator').setValue("")
        break;
      default:
        dim.get("style").get('position').disable()
        dim.get('style').get('position').setValue('')
        dim.get("style").get('orientation').disable()
        dim.get('style').get('orientation').setValue('')
        dim.get("style").get('separator').disable()
        dim.get("style").get('separator').setValue("")
    }

    dim.get('style').get('styleType').updateValueAndValidity();
    dim.get('style').get('position').updateValueAndValidity();
    dim.get('style').get('orientation').updateValueAndValidity();
    dim.get('style').get('separator').updateValueAndValidity();

  }

  /* SUB ELEMENT: Mapping */

  dimensionMapping(dimensionIndex: number): FormArray {
    return this.dimensions().at(dimensionIndex).get('scale').get('mapping') as FormArray;
  }

  addDimensionMapping(dimensionIndex: number, mapping = null as Mapping) {
    this.dimensionMapping(dimensionIndex).push(this._formBuilder.group({
      label: [mapping ? mapping.label : ''],
      description: [mapping ? mapping.description : ''],
      value: [mapping ? mapping.value : '']
    }))
  }

  removeDimensionMapping(dimensionIndex: number, dimensionMappingIndex: number) {
    this.dimensionMapping(dimensionIndex).removeAt(dimensionMappingIndex);
  }

  /* JSON Output */

  dimensionsJSON() {

    let dimensionsJSON = JSON.parse(JSON.stringify(this.dimensionsForm.get('dimensions').value));

    dimensionsJSON.forEach((dimension, dimensionIndex) => {

      if (dimension.description == '') dimension.description = false

      dimension.gold = !!dimension.gold;

      if (!dimension.setJustification) dimension.justification = false
      delete dimension.setJustification;

      dimension.url = !!dimension.url;

      if (dimension.setScale == false) {
        delete dimension.scale
        dimension.scale = false
        dimension.style = false
      } else {
        switch (dimension.scale.type) {
          case 'categorical':
            delete dimension.scale.min;
            delete dimension.scale.max;
            delete dimension.scale.step;
            delete dimension.scale.lower_bound;
            break;
          case 'interval':
            delete dimension.scale.mapping;
            delete dimension.scale.lower_bound;
            break;
          case 'magnitude_estimation':
            delete dimension.scale.mapping;
            delete dimension.scale.max;
            delete dimension.scale.step;
            delete dimension.scale.mapping;
            break;
          default:
            break;
        }
      }
      delete dimension.setScale;
      delete dimension.setStyle;

      if (dimension.style) {

        dimension.style.type = dimension.style.styleType;
        delete dimension.style.styleType;

        if (!dimension.style.type) dimension.style.type = ''
        if (!dimension.style.position) dimension.style.position = ''

        if (dimension.scale.type == 'interval' || dimension.scale.type == 'magnitude_estimation') {
          dimension.style.type = 'list'
          dimension.style.orientation = 'vertical'
        }
        if (dimension.scale.type == 'categorical' && dimension.style.type == 'matrix') dimension.style.orientation = false

        dimension.style.separator = !!dimension.style.separator;

      } else {
        dimension.style = false
      }
      this.localStorageService.setItem(`dimension-${dimensionIndex}`, JSON.stringify(dimension))
    })
    this.dimensionsSerialized = JSON.stringify(dimensionsJSON)
  }

  /* STEP #3 - General Instructions */
  generalInstructions(): FormArray {
    return this.generalInstructionsForm.get('generalInstructions') as FormArray;
  }

  addGeneralInstruction(instructionIndex = null, instruction = null as Instruction) {
    this.generalInstructions().push(this._formBuilder.group({
      caption: [instruction ? instruction.caption : ''],
      text: [instruction ? instruction.text : ''],
    }));
  }

  removeGeneralInstruction(generalInstructionIndex: number) {
    this.generalInstructions().removeAt(generalInstructionIndex);
  }

  /* JSON Output */

  generalInstructionsJSON() {
    let generalInstructionsJSON = JSON.parse(JSON.stringify(this.generalInstructionsForm.get('generalInstructions').value));
    generalInstructionsJSON.forEach((generalInstruction, generalInstructionIndex) => {
      if (generalInstruction.caption == '') generalInstruction.caption = false
      this.localStorageService.setItem(`general-instruction-${generalInstructionIndex}`, JSON.stringify(generalInstruction))
    })
    this.generalInstructionsSerialized = JSON.stringify(generalInstructionsJSON);
  }

  /* STEP #4 - Evaluation Instructions */

  evaluationInstructions(): FormArray {
    return this.evaluationInstructionsForm.get('evaluationInstructions') as FormArray;
  }

  addEvaluationInstruction(instructionIndex = null, instruction = null as Instruction) {
    this.evaluationInstructions().push(this._formBuilder.group({
      caption: [instruction ? instruction.caption : ''],
      text: [instruction ? instruction.text : ''],
    }));
  }

  removeEvaluationInstruction(evaluationInstructionIndex: number) {
    this.evaluationInstructions().removeAt(evaluationInstructionIndex);
  }

  /* JSON Output */

  evaluationInstructionsJSON() {
    let evaluationInstructionsJSON = JSON.parse(JSON.stringify(this.evaluationInstructionsForm.get('evaluationInstructions').value));
    evaluationInstructionsJSON.forEach((evaluationInstruction, instructionIndex) => {
      if (evaluationInstruction.caption == '') evaluationInstruction.caption = false
      this.localStorageService.setItem(`evaluation-instruction-${instructionIndex}`, JSON.stringify(evaluationInstruction))
    })
    this.evaluationInstructionsSerialized = JSON.stringify(evaluationInstructionsJSON);
  }

  /* STEP #5 - Search Engine */

  domains(): FormArray {
    return this.searchEngineForm.get('domains_filter') as FormArray;
  }

  addDomain(domain = null) {
    this.domains().push(this._formBuilder.group({
      url: [domain ? domain : '']
    }))
  }

  removeDomain(domainIndex: number) {
    this.domains().removeAt(domainIndex);
  }

  /* JSON OUTPUT */

  searchEngineJSON() {
    let searchEngineJSON = JSON.parse(JSON.stringify(this.searchEngineForm.value));
    if (searchEngineJSON.source) {
      let domainsStringArray = [];
      for (let domain of searchEngineJSON.domains_filter) domainsStringArray.push(domain.url);
      searchEngineJSON.domains_filter = domainsStringArray;
    } else {
      searchEngineJSON.source = false
      searchEngineJSON.domains_filter = []
    }
    this.localStorageService.setItem(`search-engine-settings`, JSON.stringify(searchEngineJSON))
    this.searchEngineSerialized = JSON.stringify(searchEngineJSON)
  }

  /* STEP #6 - Task Settings */

  updateHitsFile(hits = null) {
    if (hits) {
      this.parsedHits = hits;
    } else {
      this.parsedHits = JSON.parse(this.hitsFile.content) as Array<Hit>;
    }
    if (this.parsedHits.length > 0) {
      this.hitsDetected = ("documents" in this.parsedHits[0]) && ("token_input" in this.parsedHits[0]) && ("token_output" in this.parsedHits[0]) && ("unit_id" in this.parsedHits[0]) ? this.parsedHits.length : 0;
    } else {
      this.hitsDetected = 0
    }
    if(this.hitsDetected > 0) {
      this.localStorageService.setItem(`hits`, JSON.stringify(this.parsedHits))
    }
    if(this.hitsFile) {
      this.hitsSize = Math.round(this.hitsFile.size / 1024)
      this.hitsFileName = this.hitsFile.name
    } else {
      this.hitsSize = (new TextEncoder().encode(this.parsedHits.toString())).length
      this.hitsFileName = "hits.json"
    }
    this.taskSettingsForm.get('hits').setValue('')
    if (this.hitsDetected > 0) {
      if(hits) {
        this.taskSettingsForm.get('hits').setValue(hits)
      } else {
        this.taskSettingsForm.get('hits').setValue(this.hitsFile ? this.hitsFile.content : this.parsedHits)
      }
    } else {
      this.taskSettingsForm.get('hits').setValidators([Validators.required])
    }
    this.taskSettingsForm.get('hits').updateValueAndValidity();
  }

  blacklistBatches(): FormArray {
    return this.taskSettingsForm.get('blacklist_batches') as FormArray;
  }

  addBlacklistBatches() {
    for (let taskNode of this.batchesTree) {
      for (let batchNode of taskNode["batches"]) {
        if (batchNode['blacklist']) this.blacklistBatches().push(new FormControl(true)); else this.blacklistBatches().push(new FormControl(''))
      }
    }
  }

  removeBlacklistBatch(blacklistBatchIndex = null) {
    if (blacklistBatchIndex) {
      this.blacklistBatches().removeAt(blacklistBatchIndex);
    } else {
      while (this.blacklistBatches().length !== 0) {
        this.blacklistBatches().removeAt(0)
      }
    }
  }

  whitelistBatches(): FormArray {
    return this.taskSettingsForm.get('whitelist_batches') as FormArray;
  }

  addWhitelistBatches() {
    for (let taskNode of this.batchesTree) {
      for (let batchNode of taskNode["batches"]) {
        if (batchNode['whitelist']) this.whitelistBatches().push(new FormControl(true)); else this.whitelistBatches().push(new FormControl(''))
      }
    }
  }

  removeWhitelistBatch(whitelistBatchIndex = null) {
    if (whitelistBatchIndex) {
      this.whitelistBatches().removeAt(whitelistBatchIndex);
    } else {
      while (this.whitelistBatches().length !== 0) {
        this.whitelistBatches().removeAt(0)
      }
    }
  }

  resetCountdown() {
    this.taskSettingsForm.get('countdown_time').setValue('')
    if (this.taskSettingsForm.get('setCountdownTime').value == false) {
      this.taskSettingsForm.get('countdown_time').clearValidators();
    } else {
      this.taskSettingsForm.get('countdown_time').setValidators([Validators.required, this.positiveNumber.bind(this)]);
    }
    this.taskSettingsForm.get('countdown_time').updateValueAndValidity();
  }

  annotator() {
    return this.taskSettingsForm.get('annotator') as FormGroup
  }

  setAnnotatorType() {
    if (this.annotator().get('type').value == 'options' && this.annotatorOptionValues().length == 0) {
      this.annotatorOptionValues().push(this._formBuilder.group({
        label: [''],
        color: ['']
      }))
    }
  }

  resetAnnotator() {
    this.annotator().get('type').setValue('')
    if (this.taskSettingsForm.get('setAnnotator').value == false) {
      this.annotator().get('type').clearValidators();
    } else {
      this.annotator().get('type').setValidators([Validators.required, this.positiveNumber.bind(this)]);
    }
    this.annotator().get('type').updateValueAndValidity();
  }

  /* SUB ELEMENT: Annotator */
  annotatorOptionValues(): FormArray {
    return this.taskSettingsForm.get('annotator').get('values') as FormArray;
  }

  addOptionValue(option = null as Object) {
    this.annotatorOptionValues().push(this._formBuilder.group({
      label: [option ? option['label'] : ''],
      color: [option ? option['color'] : '']
    }))
  }

  removeAnnotatorOptionValue(valueIndex) {
    this.annotatorOptionValues().removeAt(valueIndex);
  }

  messages(): FormArray {
    return this.taskSettingsForm.get('messages') as FormArray;
  }

  addMessage(message = null) {
    this.messages().push(this._formBuilder.group({
      message: [message ? message : '']
    }))
  }

  removeMessage(messageIndex: number) {
    this.messages().removeAt(messageIndex);
  }

  /* JSON Output */

  taskSettingsJSON() {

    let taskSettingsJSON = JSON.parse(JSON.stringify(this.taskSettingsForm.value));

    taskSettingsJSON["hits"] = "..."

    if (!taskSettingsJSON.setAnnotator) taskSettingsJSON.annotator = false
    delete taskSettingsJSON.setAnnotator

    if (!taskSettingsJSON.setCountdownTime) taskSettingsJSON.countdown_time = false
    delete taskSettingsJSON.setCountdownTime

    let blacklistBatches = [];
    for (let blacklistCounter in taskSettingsJSON.blacklist_batches) {
      for (let taskNode of this.batchesTree) {
        for (let batchNode of taskNode['batches']) {
          if(blacklistCounter == batchNode['counter'] && batchNode['blacklist']) {
            blacklistBatches.push(batchNode['batch'])
          }
        }
      }
    }
    taskSettingsJSON.blacklist_batches = blacklistBatches;

    let whitelistBatches = [];
    for (let whitelistCounter in taskSettingsJSON.whitelist_batches) {
      for (let taskNode of this.batchesTree) {
        for (let batchNode of taskNode['batches']) {
          if(whitelistCounter == batchNode['counter'] && batchNode['whitelist']) {
            whitelistBatches.push(batchNode['batch'])
          }
        }
      }
    }
    taskSettingsJSON.whitelist_batches = whitelistBatches;

    if (taskSettingsJSON.messages.length == 0) {
      delete taskSettingsJSON.messages;
    } else {
      let messages = [];
      for (let messageIndex in taskSettingsJSON.messages) messages.push(taskSettingsJSON.messages[messageIndex].message);
      taskSettingsJSON.messages = messages;
    }

    this.localStorageService.setItem(`task-settings`, JSON.stringify(taskSettingsJSON))
    this.taskSettingsSerialized = JSON.stringify(taskSettingsJSON)
  }

  /* STEP #7 - Worker Checks */

  addBlacklistedId(event: MatChipInputEvent) {
    if (event.value) {
      this.blacklistedWorkerId.add(event.value);
      event.chipInput!.clear();
    }
    this.workerChecksJSON()
  }

  addWhitelistedId(event: MatChipInputEvent) {
    if (event.value) {
      this.whitelistedWorkerId.add(event.value);
      event.chipInput!.clear();
    }
    this.workerChecksJSON()
  }

  removeBlacklistedId(workerId: string) {
    this.blacklistedWorkerId.delete(workerId);
    this.workerChecksJSON()
  }

  removeWhitelistedId(workerId: string) {
    this.whitelistedWorkerId.delete(workerId);
    this.workerChecksJSON()
  }

  /* JSON Output */
  workerChecksJSON() {
    let workerChecksJSON = JSON.parse(JSON.stringify(this.workerChecksForm.value));
    if(this.blacklistedWorkerId)
      workerChecksJSON.blacklist = Array.from(this.blacklistedWorkerId.values())
    if(this.whitelistedWorkerId)
      workerChecksJSON.whitelist = Array.from(this.whitelistedWorkerId.values())
    this.localStorageService.setItem(`worker-settings`, JSON.stringify(workerChecksJSON))
    this.workersChecksSerialized = JSON.stringify(workerChecksJSON)
  }

  /* STEP 8 - Summary  */

  public updateFullPath() {
    this.fullS3Path = this.S3Service.getTaskDataS3Path(this.configService.environment, this.configService.environment.taskName, this.configService.environment.batchName)
  }

  public async uploadConfiguration() {
    this.uploadStarted = true
    this.uploadCompleted = false
    let questionnairePromise = this.S3Service.uploadQuestionnairesConfig(this.configService.environment, this.questionnairesSerialized)
    let hitsPromise = this.S3Service.uploadHitsConfig(this.configService.environment, this.parsedHits)
    let dimensionsPromise = this.S3Service.uploadDimensionsConfig(this.configService.environment, this.dimensionsSerialized)
    let taskInstructionsPromise = this.S3Service.uploadTaskInstructionsConfig(this.configService.environment, this.generalInstructionsSerialized)
    let dimensionsInstructionsPromise = this.S3Service.uploadDimensionsInstructionsConfig(this.configService.environment, this.evaluationInstructionsSerialized)
    let searchEngineSettingsPromise = this.S3Service.uploadSearchEngineSettings(this.configService.environment, this.searchEngineSerialized)
    let taskSettingsPromise = this.S3Service.uploadTaskSettings(this.configService.environment, this.taskSettingsSerialized)
    let workerChecksPromise = this.S3Service.uploadWorkersCheck(this.configService.environment, this.workersChecksSerialized)
    questionnairePromise.then(result => {
      if (!result["failed"]) {
        this.questionnairesPath = this.S3Service.getQuestionnairesConfigPath(this.configService.environment)
      } else this.questionnairesPath = "Failure"
    })
    hitsPromise.then(result => {
      if (!result["failed"]) {
        this.hitsPath = this.S3Service.getHitsConfigPath(this.configService.environment)
      } else this.hitsPath = "Failure"
    })
    dimensionsPromise.then(result => {
      if (!result["failed"]) {
        this.dimensionsPath = this.S3Service.getDimensionsConfigPath(this.configService.environment)
      } else this.dimensionsPath = "Failure"
    })
    taskInstructionsPromise.then(result => {
      if (!result["failed"]) {
        this.taskInstructionsPath = this.S3Service.getTaskInstructionsConfigPath(this.configService.environment)
      } else this.taskInstructionsPath = "Failure"
    })
    dimensionsInstructionsPromise.then(result => {
      if (!result["failed"]) {
        this.dimensionsInstructionsPath = this.S3Service.getDimensionsInstructionsConfigPath(this.configService.environment)
      } else this.dimensionsInstructionsPath = "Failure"
    })
    searchEngineSettingsPromise.then(result => {
      if (!result["failed"]) {
        this.searchEngineSettingsPath = this.S3Service.getSearchEngineSettingsConfigPath(this.configService.environment)
      } else this.searchEngineSettingsPath = "Failure"
    })
    taskSettingsPromise.then(result => {
      if (!result["failed"]) {
        this.taskSettingsPath = this.S3Service.getTaskSettingsConfigPath(this.configService.environment)
      } else this.taskSettingsPath = "Failure"
    })
    workerChecksPromise.then(result => {
      if (!result["failed"]) {
        this.workerChecksPath = this.S3Service.getWorkerChecksConfigPath(this.configService.environment)
      } else this.workerChecksPath = "Failure"
    })
    this.uploadStarted = false
    this.uploadCompleted = true
  }

  public resetConfiguration() {
    this.ngxService.startLoader('generator-inner')
    this.uploadStarted = false
    this.uploadCompleted = false
    this.questionnairesPath = null
    this.dimensionsPath = null
    this.taskInstructionsPath = null
    this.dimensionsInstructionsPath = null
    this.searchEngineSettingsPath = null
    this.workerChecksPath = null
    this.localStorageService.clear()
    this.generator.selectedIndex = 0
    this.downloadData()
    this.ngxService.stopLoader('generator-inner')
  }

  /* |--------- OTHER AMENITIES ---------| */

  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

  public positiveNumber(control: FormControl) {
    if (Number(control.value) < 1) {
      return {invalid: true};
    } else {
      return null;
    }
  }

}
