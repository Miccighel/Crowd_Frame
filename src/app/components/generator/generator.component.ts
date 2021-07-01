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
import {Question, Questionnaire} from "../../models/skeleton/questionnaire";
import {Dimension, Justification, Mapping} from "../../models/skeleton/dimension";
import {Instruction} from "../../models/shared/instructions";

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

  /* STEP #5 - Search Engine */
  searchEngineForm: FormGroup;
  sourceTypes: SourceType[] = [
    {value: 'BingWebSearch', viewValue: 'BingWeb'},
    {value: 'FakerWebSearch', viewValue: 'FakerWeb'},
    {value: 'PubmedSearch', viewValue: 'Pubmed'}
  ];

  /* STEP #6 - Task Settings */
  taskSettingsForm: FormGroup;
  taskNames: Array<string>
  batchesList: Array<string>
  batchesTree
  /* Variables to handle hits file upload */
  localHitsFile: ReadFile
  localHistFileSize: number
  hitsDetected: number
  parsedHits: Array<JSON>
  readMode: ReadMode

  /* STEP #7 - Worker Checks */
  workerChecksForm: FormGroup;

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
    this.ngxService.startLoader('generator')

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

    /* STEP #3 - Instructions */

    let rawGeneralInstructions = this.S3Service.downloadTaskInstructions(this.configService.environment)
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

    /* The following code lists the folders which are present inside task's main folder.
     * In other words, it lists every batch name for the current task to build a nodeList
     * which is then shown to the user during step #6 */
    this.batchesTree = {}
    let tasksPromise = this.S3Service.listFolders(this.configService.environment)
    let nodes = []
    let completeList = []
    tasksPromise.then(tasks => {
      for (let task of tasks) {
        let taskName = task["Prefix"].split("/")[0]
        let batches = this.S3Service.listFolders(this.configService.environment, task["Prefix"])
        batches.then(batches => {
          if (batches.length > 0) {
            let node = {}
            node["name"] = taskName
            node["batches"] = []
            for (let batch of batches) {
              completeList.push(batch["Prefix"])
              node["batches"].push(batch["Prefix"])
            }
            nodes.push(node)
          }
        })
      }
      this.ngxService.stopLoader('generator')
    })
    this.batchesTree = nodes
    this.batchesList = completeList

    /* A sample full S3 path is shown */
    this.fullS3Path = "&lt;region&gt;/&lt;bucket&gt;/&lt;task_name&gt;/&lt;bucket_name&gt;"
    this.questionnairesPath = null

    /* Some booleans to handle final upload */
    this.uploadCompleted = false
    this.uploadStarted = false

    /* Read mode during hits file upload*/
    this.readMode = ReadMode.text
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

    /* STEP #5 - Search Engine */
    this.searchEngineForm = this._formBuilder.group({
      source: [''],
      domains_to_filter: this._formBuilder.array([])
    });

    /* STEP #6 - Task Settings */
    this.taskSettingsForm = this._formBuilder.group({
      task_name: [''],
      batch_name: [''],
      allowed_tries: [''],
      time_check_amount: [''],
      hits: [''],
      setAnnotator: [''],
      annotator: this._formBuilder.group({
        type: [''],
        values: this._formBuilder.array([]),
      }),
      setCountdownTime: [''],
      countdown_time: [''],
      blacklist_batches: this._formBuilder.array([]),
      whitelist_batches: this._formBuilder.array([]),
      messages: this._formBuilder.array([])
    });

    /* STEP #7 - Worker Checks */
    this.workerChecksForm = this._formBuilder.group({
      blacklist: [''],
      whitelist: ['']
    })


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
    let scale = null
    this.dimensions().push(this._formBuilder.group({
      name: [dimension ? dimension.name : ''],
      description: [dimension ? dimension.description : ''],
      gold: [dimension ? dimension.gold : ''],
      setJustification: [dimension ? dimension.justification : ''],
      justification: this._formBuilder.group({
        text: [dimension ? dimension.justification ? dimension.justification.text : '' : ''],
        min_words: [dimension ? dimension.justification ? dimension.justification.minWords : '' : '']
      }),
      url: [dimension ? dimension.url : ''],
      setScale: [dimension ? dimension.scale : ''],
      scale: this._formBuilder.group({
        type: [dimension ? dimension.scale ? dimension.scale.type : '' : ''],
        min: [dimension ? dimension.scale ? dimension.scale['min'] : '' : ''],
        max: [dimension ? dimension.scale ? dimension.scale['max'] : '' : ''],
        step: [dimension ? dimension.scale ? dimension.scale['step'] : '' : ''],
        mapping: this._formBuilder.array([]),
        lower_bound: [dimension ? dimension.scale ? dimension.scale['lower_bound'] : '' : ''],
      }),
      setStyle: [dimension ? dimension.style : ''],
      style: this._formBuilder.group({
        styleType: [dimension ? dimension.style.type : ''],
        position: [dimension ? dimension.style.position : ''],
        orientation: [dimension ? dimension.style.orientation : ''],
        separator: [dimension ? dimension.style.separator : '']
      })
    }))
    if (dimension && dimension.scale) if (dimension.scale.type == 'categorical') {
      if(dimension.scale['mapping']) for (let mapping of dimension.scale['mapping']) this.addDimensionMapping(dimensionIndex, mapping)
      if(this.dimensionMapping(dimensionIndex).length == 0) this.addDimensionMapping(dimensionIndex)
    }
    if(dimension && dimension.style) {
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
      steps: this._formBuilder.array([])
    }));
    if (instruction && instruction.steps) for (let step of instruction.steps) this.addGeneralInstructionStep(instructionIndex, step)
    if (this.generalInstructions().length == 0) {
      this.addGeneralInstructionStep(this.generalInstructions().length - 1);
    }
  }

  removeGeneralInstruction(generalInstructionIndex: number) {
    this.generalInstructions().removeAt(generalInstructionIndex);
  }

  /* SUB ELEMENT: Steps */

  generalInstructionSteps(generalInstructionIndex: number): FormArray {
    return this.generalInstructions().at(generalInstructionIndex).get('steps') as FormArray;
  }

  addGeneralInstructionStep(generalInstructionIndex: number, generalInstructionStep = null) {
    this.generalInstructionSteps(generalInstructionIndex).push(this._formBuilder.group({
      step: [generalInstructionStep ? generalInstructionStep : '']
    }))
  }

  removeGeneralInstructionStep(generalInstructionIndex: number, generalInstructionStepIndex: number) {
    this.generalInstructionSteps(generalInstructionIndex).removeAt(generalInstructionStepIndex);
  }

  /* JSON Output */

  generalInstructionsJSON() {
    let generalInstructionsJSON = JSON.parse(JSON.stringify(this.generalInstructionsForm.get('generalInstructions').value));
    generalInstructionsJSON.forEach((generalInstruction, generalInstructionIndex) => {
      if (generalInstruction.caption == '') generalInstruction.caption = false
      let stepsStringArray = [];
      for (let generalInstructionStepIndex in generalInstruction.steps) stepsStringArray.push(generalInstruction.steps[generalInstructionStepIndex].step);
      generalInstruction.steps = stepsStringArray;
      this.localStorageService.setItem(`general-instruction-${generalInstructionIndex}`, JSON.stringify(generalInstruction))
    })
    this.generalInstructionsSerialized = JSON.stringify(generalInstructionsJSON);
  }

  /* STEP #4 - Evaluation Instructions */

  evaluationInstructions(): FormArray {
    return this.evaluationInstructionsForm.get('evaluationInstructions') as FormArray;
  }

  addEvaluationInstruction() {
    this.evaluationInstructions().push(this._formBuilder.group({
      caption: [''],
      steps: this._formBuilder.array([])
    }));
    this.addEvaluationInstructionStep(this.evaluationInstructions().length - 1);
  }

  removeEvaluationInstruction(evaluationInstructionIndex: number) {
    this.evaluationInstructions().removeAt(evaluationInstructionIndex);
  }

  /* SUB ELEMENT: Steps */

  evaluationInstructionSteps(evaluationInstructionIndex: number): FormArray {
    return this.evaluationInstructions().at(evaluationInstructionIndex).get('steps') as FormArray;
  }

  addEvaluationInstructionStep(evaluationInstructionIndex: number) {
    this.evaluationInstructionSteps(evaluationInstructionIndex).push(this._formBuilder.group({
      step: ['']
    }))
  }

  removeEvaluationInstructionStep(evaluationInstructionIndex: number, evaluationInstructionStepIndex: number) {
    this.evaluationInstructionSteps(evaluationInstructionIndex).removeAt(evaluationInstructionStepIndex);
  }

  /* JSON Output */

  evaluationInstructionsJSON() {
    let evaluationInstructionsJSON = JSON.parse(JSON.stringify(this.evaluationInstructionsForm.get('evaluationInstructions').value));
    for (let evaluationInstructionIndex in evaluationInstructionsJSON) {

      if (evaluationInstructionsJSON[evaluationInstructionIndex].caption == '') {
        evaluationInstructionsJSON[evaluationInstructionIndex].caption = false
      }

      let stepsStringArray = [];
      for (let evaluationInstructionStepIndex in evaluationInstructionsJSON[evaluationInstructionIndex].steps) {
        stepsStringArray.push(evaluationInstructionsJSON[evaluationInstructionIndex].steps[evaluationInstructionStepIndex].step);
      }
      evaluationInstructionsJSON[evaluationInstructionIndex].steps = stepsStringArray;
    }

    return JSON.stringify(evaluationInstructionsJSON, null, 1);
  }

  /* STEP #5 - Search Engine */

  domains(): FormArray {
    return this.searchEngineForm.get('domains_to_filter') as FormArray;
  }

  addDomain() {
    this.domains().push(this._formBuilder.group({
      url: ['']
    }))
  }

  removeDomain(domainIndex: number) {
    this.domains().removeAt(domainIndex);
  }

  /* JSON OUTPUT */

  searchEngineJSON() {
    let searchEngineJSON = JSON.parse(JSON.stringify(this.searchEngineForm.value));

    if (searchEngineJSON.source == undefined) {
      searchEngineJSON.source = false;
    }

    let domainsStringArray = [];
    for (let domainIndex in searchEngineJSON.domains_to_filter) {
      domainsStringArray.push(searchEngineJSON.domains_to_filter[domainIndex].url);
    }
    searchEngineJSON.domains_to_filter = domainsStringArray;

    return JSON.stringify(searchEngineJSON, null, 1);
  }

  /* STEP #6 - Task Settings */

  updateHitsFile() {
    this.parsedHits = JSON.parse(this.localHitsFile.content)
    if (this.parsedHits.length > 0) {
      console.log(this.parsedHits[0])
      if (("documents" in this.parsedHits[0]) && ("token_input" in this.parsedHits[0]) && ("token_output" in this.parsedHits[0]) && ("unit_id" in this.parsedHits[0])) {
        this.hitsDetected = this.parsedHits.length
      } else {
        this.hitsDetected = 0
      }
    } else {
      this.hitsDetected = 0
    }
    this.localHistFileSize = Math.round(this.localHitsFile.size / 1024)
    this.taskSettingsForm.get('hits').setValue('')
    if (this.hitsDetected > 0) {
      this.taskSettingsForm.get('hits').setValue(this.localHitsFile.content)
    } else {
      this.taskSettingsForm.get('hits').setValidators([Validators.required])
    }
    this.taskSettingsForm.get('hits').updateValueAndValidity();
  }

  blacklistBatches(): FormArray {
    return this.taskSettingsForm.get('blacklist_batches') as FormArray;
  }

  addBlacklistBatch() {
    for (let item of this.batchesList) {
      this.blacklistBatches().push(this._formBuilder.group({
        blacklist_batch: ['']
      }))
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

  addWhitelistBatch() {
    for (let item of this.batchesList) {
      this.whitelistBatches().push(this._formBuilder.group({
        whitelist_batch: ['']
      }))
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

  setAnnotatorType() {
    if (this.taskSettingsForm.get('annotator').get('type').value == 'options') {
      this.annotatorOptionValues().push(this._formBuilder.group({
        label: [''],
        color: ['']
      }))
    }
  }

  resetAnnotator() {
    this.taskSettingsForm.get('annotator').get('type').setValue('')
    if (this.taskSettingsForm.get('setAnnotator').value == false) {
      this.taskSettingsForm.get('annotator').get('type').clearValidators();
    } else {
      this.taskSettingsForm.get('annotator').get('type').setValidators([Validators.required, this.positiveNumber.bind(this)]);
    }
    this.taskSettingsForm.get('annotator').get('type').updateValueAndValidity();
  }

  /* SUB ELEMENT: Annotator */
  annotatorOptionValues(): FormArray {
    return this.taskSettingsForm.get('annotator').get('values') as FormArray;
  }

  addOptionValue() {
    this.annotatorOptionValues().push(this._formBuilder.group({
      label: [''],
      color: ['']
    }))
  }

  removeAnnotatorOptionValue(valueIndex) {
    this.annotatorOptionValues().removeAt(valueIndex);
  }

  messages(): FormArray {
    return this.taskSettingsForm.get('messages') as FormArray;
  }

  addMessage() {
    this.messages().push(this._formBuilder.group({
      message: ['']
    }))
  }

  removeMessage(messageIndex: number) {
    this.messages().removeAt(messageIndex);
  }

  /* JSON Output */

  taskSettingsJSON(verbose = true) {
    let taskSettingsJSON = JSON.parse(JSON.stringify(this.taskSettingsForm.value));

    if (!verbose) {
      taskSettingsJSON["hits"] = "..."
    }

    if (taskSettingsJSON.setAnnotator == false || taskSettingsJSON.setAnnotator == null) {
      taskSettingsJSON.annotator = false
    }
    delete taskSettingsJSON.setAnnotator

    if (taskSettingsJSON.setCountdownTime == false) {
      taskSettingsJSON.countdown_time = false
    }
    delete taskSettingsJSON.setCountdownTime

    let blacklistBatchesStringArray = [];
    for (let blacklistBatchIndex in taskSettingsJSON.blacklist_batches) {
      if (taskSettingsJSON.blacklist_batches[blacklistBatchIndex].blacklist_batch)
        blacklistBatchesStringArray.push(this.batchesList[blacklistBatchIndex]);
    }
    taskSettingsJSON.blacklist_batches = blacklistBatchesStringArray;

    let whitelistBatchesStringArray = [];
    for (let whitelistBatchIndex in taskSettingsJSON.whitelist_batches) {
      if (taskSettingsJSON.whitelist_batches[whitelistBatchIndex].whitelist_batch)
        whitelistBatchesStringArray.push(this.batchesList[whitelistBatchIndex]);
    }
    taskSettingsJSON.whitelist_batches = whitelistBatchesStringArray;

    if (taskSettingsJSON.messages.length == 0) {
      delete taskSettingsJSON.messages;
    } else {
      let messagesStringArray = [];
      for (let messageIndex in taskSettingsJSON.messages) {
        messagesStringArray.push(taskSettingsJSON.messages[messageIndex].message);
      }
      taskSettingsJSON.messages = messagesStringArray;
    }

    return JSON.stringify(taskSettingsJSON, null, 1);
  }

  /* STEP #7 - Worker Checks */

  /* JSON Output */
  workerChecksJSON() {
    let workerChecksJSON = JSON.parse(JSON.stringify(this.workerChecksForm.value));

    if (workerChecksJSON.blacklist == '') {
      workerChecksJSON.blacklist = [];
    } else {
      workerChecksJSON.blacklist = workerChecksJSON.blacklist.split(";");
    }

    if (workerChecksJSON.whitelist == '') {
      workerChecksJSON.whitelist = [];
    } else {
      workerChecksJSON.whitelist = workerChecksJSON.whitelist.split(";");
    }

    return JSON.stringify(workerChecksJSON, null, 1);
  }

  /* STEP 8 - Summary  */

  public updateFullPath() {
    this.fullS3Path = this.S3Service.getTaskDataS3Path(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
  }

  public uploadConfiguration() {
    this.uploadStarted = true
    let questionnairePromise = this.S3Service.uploadQuestionnairesConfig(this.configService.environment, this.questionnairesSerialized, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let hitsPromise = this.S3Service.uploadHitsConfig(this.configService.environment, this.taskSettingsForm.get('hits').value, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let dimensionsPromise = this.S3Service.uploadDimensionsConfig(this.configService.environment, this.dimensionsSerialized, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let taskInstructionsPromise = this.S3Service.uploadTaskInstructionsConfig(this.configService.environment, this.generalInstructionsSerialized, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let dimensionsInstructionsPromise = this.S3Service.uploadDimensionsInstructionsConfig(this.configService.environment, this.evaluationInstructionsJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let searchEngineSettingsPromise = this.S3Service.uploadSearchEngineSettings(this.configService.environment, this.searchEngineJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let taskSettingsPromise = this.S3Service.uploadTaskSettings(this.configService.environment, this.taskSettingsJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let workerChecksPromise = this.S3Service.uploadWorkersCheck(this.configService.environment, this.workerChecksJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    questionnairePromise.then(result => {
      if (!result["failed"]) {
        this.questionnairesPath = this.S3Service.getQuestionnairesConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.questionnairesPath = "Failure"
    })
    hitsPromise.then(result => {
      if (!result["failed"]) {
        this.hitsPath = this.S3Service.getHitsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.hitsPath = "Failure"
    })
    dimensionsPromise.then(result => {
      if (!result["failed"]) {
        this.dimensionsPath = this.S3Service.getDimensionsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.dimensionsPath = "Failure"
    })
    taskInstructionsPromise.then(result => {
      if (!result["failed"]) {
        this.taskInstructionsPath = this.S3Service.getTaskInstructionsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.taskInstructionsPath = "Failure"
    })
    dimensionsInstructionsPromise.then(result => {
      if (!result["failed"]) {
        this.dimensionsInstructionsPath = this.S3Service.getDimensionsInstructionsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.dimensionsInstructionsPath = "Failure"
    })
    searchEngineSettingsPromise.then(result => {
      if (!result["failed"]) {
        this.searchEngineSettingsPath = this.S3Service.getSearchEngineSettingsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.searchEngineSettingsPath = "Failure"
    })
    taskSettingsPromise.then(result => {
      if (!result["failed"]) {
        this.taskSettingsPath = this.S3Service.getTaskSettingsConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.taskSettingsPath = "Failure"
    })
    workerChecksPromise.then(result => {
      if (!result["failed"]) {
        this.workerChecksPath = this.S3Service.getWorkerChecksConfigPath(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
      } else this.workerChecksPath = "Failure"
    })
    this.uploadCompleted = true
  }

  public resetConfiguration() {
    this.uploadStarted = false
    this.uploadCompleted = false
    this.generator.selectedIndex = 0
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
