import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {MatStepper} from "@angular/material/stepper";
import {S3Service} from "../../services/s3.service";
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {ReadFile, ReadMode} from "ngx-file-helpers";

/*
 * STEP #1 - Questionnaires
 */
interface QuestionnaireType {
  value: string;
  viewValue: string;
}

/*
 * STEP #2 - Dimensions
 */
interface ScaleType {
  value: string;
  viewValue: string;
}

interface AnnotatorType {
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

/*
 * STEP #5 - Search Engine
 */
interface SourceType {
  value: string;
  viewValue: string;
}

interface BatchNode {
  name: string;
  batches?: BatchNode[];
}

@Component({
  selector: 'app-generator',
  templateUrl: './generator.component.html',
  styleUrls: ['./generator.component.scss']
})
export class GeneratorComponent implements OnInit {

  /*
   * STEP #1 - Questionnaires
   */
  questionnairesForm: FormGroup;
  questionnaireTypes: QuestionnaireType[] = [
    {value: 'crt', viewValue: 'CRT'},
    {value: 'likert', viewValue: 'Likert'},
    {value: 'standard', viewValue: 'Standard'}
  ];

  /*
   * STEP #2 - Dimensions
   */
  dimensionsForm: FormGroup;
  scaleTypes: ScaleType[] = [
    {value: 'categorical', viewValue: 'Categorical'},
    {value: 'interval', viewValue: 'Interval'},
    {value: 'magnitude_estimation', viewValue: 'Magnitude Estimation'}
  ];
  annotatorTypes: AnnotatorType[] = [
    {value: 'free_text', viewValue: 'Free Text'},
    {value: 'tags', viewValue: 'Tags'},
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

  /*
   * STEP #3 - General Instructions
   */
  generalInstructionsForm: FormGroup;

  /*
   * STEP #4 - Evaluation Instructions
   */
  evaluationInstructionsForm: FormGroup;

  /*
   * STEP #5 - Search Engine
   */
  searchEngineForm: FormGroup;
  sourceTypes: SourceType[] = [
    {value: 'BingWebSearch', viewValue: 'BingWeb'},
    {value: 'FakerWebSearch', viewValue: 'FakerWeb'},
    {value: 'PubmedSearch', viewValue: 'Pubmed'}
  ];

  /*
   * STEP #6 - Task Settings
   */
  taskSettingsForm: FormGroup;

  /*
   * STEP #7 - Worker Checks
   */
  workerChecksForm: FormGroup;

  /* Service to provide loading screens */
  ngxService: NgxUiLoaderService;
  configService: ConfigService
  S3Service: S3Service

  batchesList: Array<string>
  taskNames: Array<string>
  batchesTree

  @ViewChild('generator') generator: MatStepper;

  fullS3Path: string

  uploadStarted: boolean
  uploadCompleted: boolean
  questionnairesPath: string
  hitsPath: string
  dimensionsPath: string
  taskInstructionsPath: string
  dimensionsInstructionsPath: string
  searchEngineSettingsPath: string
  taskSettingsPath: string
  workerChecksPath: string

  localHitsFile: ReadFile
  hitsDetected: number
  localHistFileSize: number
  parsedHits: Array<JSON>
  readMode: ReadMode

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  constructor(
    changeDetector: ChangeDetectorRef,
    private _formBuilder: FormBuilder,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service
  ) {
    this.changeDetector = changeDetector
    this.ngxService = ngxService
    this.configService = configService
    this.S3Service = S3Service

    this.ngxService.startLoader('generator')

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


    this.fullS3Path = "&lt;region&gt;/&lt;bucket&gt;/&lt;task_name&gt;/&lt;bucket_name&gt;"
    this.questionnairesPath = null
    this.uploadCompleted = false
    this.uploadStarted = false

    this.readMode = ReadMode.text
  }

  ngOnInit() {


    /*
     * STEP #1 - Questionnaires
     */
    this.questionnairesForm = this._formBuilder.group({
      questionnaires: this._formBuilder.array([])
    });

    /*
     * STEP #2 - Dimensions
     */
    this.dimensionsForm = this._formBuilder.group({
      dimensions: this._formBuilder.array([])
    });

    /*
     * STEP #3 - General Instructions
     */
    this.generalInstructionsForm = this._formBuilder.group({
      generalInstructions: this._formBuilder.array([])
    });

    /*
     * STEP #4 - Evaluation Instructions
     */
    this.evaluationInstructionsForm = this._formBuilder.group({
      evaluationInstructions: this._formBuilder.array([])
    });

    /*
     * STEP #5 - Search Engine
     */
    this.searchEngineForm = this._formBuilder.group({
      source: [''],
      domains_to_filter: this._formBuilder.array([])
    });

    /*
     * STEP #6 - Task Settings
     */
    this.taskSettingsForm = this._formBuilder.group({
      task_name: [''],
      batch_name: [''],
      allowed_tries: [''],
      time_check_amount: [''],
      hits: [''],
      setAnnotator: [''],
      annotator: this._formBuilder.group({
        type: [''],
      }),
      setCountdownTime: [''],
      countdown_time: [''],
      blacklist_batches: this._formBuilder.array([]),
      whitelist_batches: this._formBuilder.array([]),
      messages: this._formBuilder.array([])
    });

    /*
     * STEP #7 - Worker Checks
     */
    this.workerChecksForm = this._formBuilder.group({
      blacklist: [''],
      whitelist: ['']
    })

    this.changeDetector.detectChanges()

  }

  /*
   * STEP #1 - Questionnaires
   */
  questionnaires(): FormArray {
    return this.questionnairesForm.get('questionnaires') as FormArray;
  }

  addQuestionnaire() {
    this.questionnaires().push(this._formBuilder.group({
      type: [''],
      description: [''],
      questions: this._formBuilder.array([]),
      mapping: this._formBuilder.array([])
    }))
  }

  removeQuestionnaire(questionnaireIndex: number) {
    this.questionnaires().removeAt(questionnaireIndex);
  }

  /* Questions */
  questions(questionnaireIndex: number): FormArray {
    return this.questionnaires().at(questionnaireIndex).get('questions') as FormArray;
  }

  addQuestion(questionnaireIndex: number) {
    this.questions(questionnaireIndex).push(this._formBuilder.group({
      name: [''],
      text: [''],
      answers: this._formBuilder.array([])
    }));
    if (this.questionnaires().at(questionnaireIndex).get('type').value == 'standard') {
      this.addAnswer(questionnaireIndex, this.questions(questionnaireIndex).length - 1);
    }
  }

  removeQuestion(questionnaireIndex: number, questionIndex: number) {
    this.questions(questionnaireIndex).removeAt(questionIndex);
  }

  /* Answers */
  answers(questionnaireIndex: number, questionIndex: number): FormArray {
    return this.questions(questionnaireIndex).at(questionIndex).get('answers') as FormArray;
  }

  addAnswer(questionnaireIndex: number, questionIndex: number) {
    this.answers(questionnaireIndex, questionIndex).push(this._formBuilder.group({
      answer: ['']
    }))
  }

  removeAnswer(questionnaireIndex: number, questionIndex: number, answerIndex: number) {
    this.answers(questionnaireIndex, questionIndex).removeAt(answerIndex);
  }

  /* Mapping */
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

  /* Other Functions */
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

  questionnairesJSON() {
    let questionnairesJSON = JSON.parse(JSON.stringify(this.questionnairesForm.get('questionnaires').value));
    for (let questionnaireIndex in questionnairesJSON) {
      switch (questionnairesJSON[questionnaireIndex].type) {

        case 'crt':
          delete questionnairesJSON[questionnaireIndex].description;
          for (let questionIndex in questionnairesJSON[questionnaireIndex].questions) {
            delete questionnairesJSON[questionnaireIndex].questions[questionIndex].answers;
          }
          delete questionnairesJSON[questionnaireIndex].mapping;
          break;

        case 'likert':
          for (let questionIndex in questionnairesJSON[questionnaireIndex].questions) {
            delete questionnairesJSON[questionnaireIndex].questions[questionIndex].answers;
          }
          break;

        case 'standard':
          delete questionnairesJSON[questionnaireIndex].description;
          for (let questionIndex in questionnairesJSON[questionnaireIndex].questions) {
            let answersStringArray = [];
            for (let answerIndex in questionnairesJSON[questionnaireIndex].questions[questionIndex].answers) {
              answersStringArray.push(questionnairesJSON[questionnaireIndex].questions[questionIndex].answers[answerIndex].answer);
            }
            questionnairesJSON[questionnaireIndex].questions[questionIndex].answers = answersStringArray;
          }
          delete questionnairesJSON[questionnaireIndex].mapping;
          break;

        default:
          break;
      }
    }
    return JSON.stringify(questionnairesJSON, null, 1);
  }

  /*
   * STEP #2 - Dimensions
   */
  dimensions(): FormArray {
    return this.dimensionsForm.get('dimensions') as FormArray;
  }

  addDimension() {
    this.dimensions().push(this._formBuilder.group({
      name: [''],
      description: [''],
      setJustification: [''],
      justification: this._formBuilder.group({
        text: [''],
        min_words: ['']
      }),
      url: [''],
      setScale: [''],
      scale: this._formBuilder.group({
        type: [''],
        min: [''],
        max: [''],
        step: [''],
        mapping: this._formBuilder.array([]),
        include_lower_bound: [true],
        include_upper_bound: [true]
      }),
      gold_question_check: [''],
      style: this._formBuilder.group({
        styleType: [{value: '', disabled: true}],
        position: [{value: '', disabled: true}],
        orientation: [{value: '', disabled: true}],
        separator: [{value: '', disabled: true}]
      })
    }))
  }

  removeDimension(dimensionIndex: number) {
    this.dimensions().removeAt(dimensionIndex);
  }

  /* Mapping */
  dimensionMapping(dimensionIndex: number): FormArray {
    return this.dimensions().at(dimensionIndex).get('scale').get('mapping') as FormArray;
  }

  addDimensionMapping(dimensionIndex: number) {
    this.dimensionMapping(dimensionIndex).push(this._formBuilder.group({
      label: [''],
      description: [''],
      value: ['']
    }))
  }

  removeDimensionMapping(dimensionIndex: number, dimensionMappingIndex: number) {
    this.dimensionMapping(dimensionIndex).removeAt(dimensionMappingIndex);
  }

  /* Other Functions */
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

    if (dim.get('setScale').value == false) {
      dim.get('scale').get('type').clearValidators();
    } else {
      dim.get('scale').get('type').setValidators(Validators.required);
    }
    dim.get('scale').get('type').updateValueAndValidity();

    this.updateScale(dimensionIndex);
  }

  updateScale(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);

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

    dim.get('scale').get('include_lower_bound').setValue(true);
    dim.get('scale').get('include_upper_bound').setValue(true);

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
    } else {
      dim.get('style').get('position').disable()
      dim.get('style').get('orientation').disable()
      dim.get('style').get('separator').disable()
      dim.get('style').get('styleType').disable()
    }
  }

  updateStyleType(dimensionIndex) {
    let dim = this.dimensions().at(dimensionIndex);
    let styleType = dim.get('style').get('styleType').value;
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
    }
  }


  dimensionsJSON() {

    let dimensionsJSON = JSON.parse(JSON.stringify(this.dimensionsForm.get('dimensions').value));


    for (let dimensionIndex in dimensionsJSON) {

      if (dimensionsJSON[dimensionIndex].description == '') {
        dimensionsJSON[dimensionIndex].description = false
      }

      if (dimensionsJSON[dimensionIndex].setJustification == false) {
        dimensionsJSON[dimensionIndex].justification = false
      }
      delete dimensionsJSON[dimensionIndex].setJustification;

      if (dimensionsJSON[dimensionIndex].url == '') {
        dimensionsJSON[dimensionIndex].url = false
      } else {
        switch (dimensionsJSON[dimensionIndex].url) {
          case 'true':
            dimensionsJSON[dimensionIndex].url = true;
            break;
          case 'false':
            dimensionsJSON[dimensionIndex].url = false;
            break;
          default:
            break;
        }
      }

      if (dimensionsJSON[dimensionIndex].setScale == false) {
        dimensionsJSON[dimensionIndex].scale = false
      } else {
        switch (dimensionsJSON[dimensionIndex].scale.type) {
          case 'categorical':
            delete dimensionsJSON[dimensionIndex].scale.mapping;
            delete dimensionsJSON[dimensionIndex].scale.include_lower_bound;
            delete dimensionsJSON[dimensionIndex].scale.include_upper_bound;
            break;
          case 'interval':
            delete dimensionsJSON[dimensionIndex].scale.min;
            delete dimensionsJSON[dimensionIndex].scale.max;
            delete dimensionsJSON[dimensionIndex].scale.step;
            delete dimensionsJSON[dimensionIndex].scale.include_lower_bound;
            delete dimensionsJSON[dimensionIndex].scale.include_upper_bound;
            break;
          case 'magnitude_estimation':
            if (dimensionsJSON[dimensionIndex].scale.min == null) {
              dimensionsJSON[dimensionIndex].scale.min = '';
            }
            if (dimensionsJSON[dimensionIndex].scale.max == null) {
              dimensionsJSON[dimensionIndex].scale.max = '';
            }
            delete dimensionsJSON[dimensionIndex].scale.step;
            delete dimensionsJSON[dimensionIndex].scale.mapping;
            if (dimensionsJSON[dimensionIndex].scale.min == '') {
              dimensionsJSON[dimensionIndex].scale.include_lower_bound = true;
            }
            if (dimensionsJSON[dimensionIndex].scale.max == '') {
              dimensionsJSON[dimensionIndex].scale.include_upper_bound = true;
            }
            break;
          default:
            break;
        }
      }
      delete dimensionsJSON[dimensionIndex].setScale;

      if (dimensionsJSON[dimensionIndex].gold_question_check == '') {
        dimensionsJSON[dimensionIndex].gold_question_check = false
      } else {
        switch (dimensionsJSON[dimensionIndex].gold_question_check) {
          case 'true':
            dimensionsJSON[dimensionIndex].gold_question_check = true;
            break;
          case 'false':
            dimensionsJSON[dimensionIndex].gold_question_check = false;
            break;
          default:
            break;
        }
      }

      if (dimensionsJSON[dimensionIndex].hasOwnProperty('style')) {
        dimensionsJSON[dimensionIndex].style.type = dimensionsJSON[dimensionIndex].style.styleType;
        delete dimensionsJSON[dimensionIndex].style.styleType;

        if (!dimensionsJSON[dimensionIndex].style.type) {
          dimensionsJSON[dimensionIndex].style.type = ''
        }

        if (!dimensionsJSON[dimensionIndex].style.position) {
          dimensionsJSON[dimensionIndex].style.position = ''
        }

        if (dimensionsJSON[dimensionIndex].scale.type == 'interval' || dimensionsJSON[dimensionIndex].scale.type == 'magnitude_estimation') {
          dimensionsJSON[dimensionIndex].style.type = 'list'
          dimensionsJSON[dimensionIndex].style.orientation = 'vertical'
        }
        if (dimensionsJSON[dimensionIndex].scale.type == 'categorical' && dimensionsJSON[dimensionIndex].style.type == 'matrix') {
          dimensionsJSON[dimensionIndex].style.orientation = false
        }

        if (!dimensionsJSON[dimensionIndex].style.separator) {
          dimensionsJSON[dimensionIndex].style.separator = false
        }
        if (dimensionsJSON[dimensionIndex].style.separator == '') {
          dimensionsJSON[dimensionIndex].style.separator = false
        } else {
          switch (dimensionsJSON[dimensionIndex].style.separator) {
            case 'true':
              dimensionsJSON[dimensionIndex].style.separator = true;
              break;
            case 'false':
              dimensionsJSON[dimensionIndex].style.separator = false;
              break;
            default:
              break;
          }
        }
      } else {
        dimensionsJSON[dimensionIndex].style = {}
        dimensionsJSON[dimensionIndex].style.type = ''
        dimensionsJSON[dimensionIndex].style.position = ''
        dimensionsJSON[dimensionIndex].style.orientation = false
        dimensionsJSON[dimensionIndex].style.separator = false;
      }
    }

    return JSON.stringify(dimensionsJSON, null, 1);
  }

  /*
   * STEP #3 - General Instructions
   */
  generalInstructions(): FormArray {
    return this.generalInstructionsForm.get('generalInstructions') as FormArray;
  }

  addGeneralInstruction() {
    this.generalInstructions().push(this._formBuilder.group({
      caption: [''],
      steps: this._formBuilder.array([])
    }));
    this.addGeneralInstructionStep(this.generalInstructions().length - 1);
  }

  removeGeneralInstruction(generalInstructionIndex: number) {
    this.generalInstructions().removeAt(generalInstructionIndex);
  }

  /* Steps */
  generalInstructionSteps(generalInstructionIndex: number): FormArray {
    return this.generalInstructions().at(generalInstructionIndex).get('steps') as FormArray;
  }

  addGeneralInstructionStep(generalInstructionIndex: number) {
    this.generalInstructionSteps(generalInstructionIndex).push(this._formBuilder.group({
      step: ['']
    }))
  }

  removeGeneralInstructionStep(generalInstructionIndex: number, generalInstructionStepIndex: number) {
    this.generalInstructionSteps(generalInstructionIndex).removeAt(generalInstructionStepIndex);
  }

  /* Other Functions */
  generalInstructionsJSON() {
    let generalInstructionsJSON = JSON.parse(JSON.stringify(this.generalInstructionsForm.get('generalInstructions').value));
    for (let generalInstructionIndex in generalInstructionsJSON) {

      if (generalInstructionsJSON[generalInstructionIndex].caption == '') {
        generalInstructionsJSON[generalInstructionIndex].caption = false
      }

      let stepsStringArray = [];
      for (let generalInstructionStepIndex in generalInstructionsJSON[generalInstructionIndex].steps) {
        stepsStringArray.push(generalInstructionsJSON[generalInstructionIndex].steps[generalInstructionStepIndex].step);
      }
      generalInstructionsJSON[generalInstructionIndex].steps = stepsStringArray;
    }

    return JSON.stringify(generalInstructionsJSON, null, 1);
  }

  /*
   * STEP #4 - Evaluation Instructions
   */
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

  /* Steps */
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

  /* Other Functions */
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

  /*
   * STEP #5 - Search Engine
   */

  /* Domains To Filter */
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

  /* Other Functions */
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

  /*
   * STEP #6 - Task Settings
   */

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

  /* Blacklist Batches */
  blacklistBatches(): FormArray {
    return this.taskSettingsForm.get('blacklist_batches') as FormArray;
  }

  /* Countdown Time */

  resetCountdown() {
    this.taskSettingsForm.get('countdown_time').setValue('')
    if (this.taskSettingsForm.get('setCountdownTime').value == false) {
      this.taskSettingsForm.get('countdown_time').clearValidators();
    } else {
      this.taskSettingsForm.get('countdown_time').setValidators([Validators.required, this.positiveNumber.bind(this)]);
    }
    this.taskSettingsForm.get('countdown_time').updateValueAndValidity();
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

  /* Whitelist Batches */
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

  /* Messages */
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


  /* Other Functions */
  taskSettingsJSON(verbose = true) {
    let taskSettingsJSON = JSON.parse(JSON.stringify(this.taskSettingsForm.value));

    if (!verbose) {
      taskSettingsJSON["hits"] = "..."
    }

    if (taskSettingsJSON.setAnnotator == false) {
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

  /*
   * STEP #7 - Worker Checks
   */

  /* Other Functions */
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

  public updateFullPath() {
    this.fullS3Path = this.S3Service.getTaskDataS3Path(this.configService.environment, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
  }

  public uploadConfiguration() {
    this.uploadStarted = true
    let questionnairePromise = this.S3Service.uploadQuestionnairesConfig(this.configService.environment, this.questionnairesJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let hitsPromise = this.S3Service.uploadHitsConfig(this.configService.environment, this.taskSettingsForm.get('hits').value, this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let dimensionsPromise = this.S3Service.uploadDimensionsConfig(this.configService.environment, this.dimensionsJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
    let taskInstructionsPromise = this.S3Service.uploadTaskInstructionsConfig(this.configService.environment, this.generalInstructionsJSON(), this.taskSettingsForm.get('task_name').value, this.taskSettingsForm.get('batch_name').value)
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
