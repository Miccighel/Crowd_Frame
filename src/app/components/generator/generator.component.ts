import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

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
   {value: 'continue', viewValue: 'Continue'},
   {value: 'discrete', viewValue: 'Discrete'}
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
     {value: 'BingWebSearch', viewValue: 'BingWebSearch'},
     {value: 'FakerWebSearch', viewValue: 'FakerWebSearch'},
     {value: 'PubmedSearch', viewValue: 'PubmedSearch'}
   ];

   /*
    * STEP #6 - Task Settings
    */


  constructor(private _formBuilder: FormBuilder) {}

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
    this.searchEngineForm.get('source').markAsTouched();

    /*
     * STEP #6 - Task Settings
     */

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

  removeAnswer(questionnaireIndex: number, questionIndex: number, answerIndex:number) {
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
    return JSON.stringify(questionnairesJSON);
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
       dimensionDescription: [''],
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
           mapping: this._formBuilder.array([])
         }),
       gold_question_check: [''],
       style: this._formBuilder.group({
           styleType: [''],
           position: [''],
           orientation: [''],
           separator: ['']
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

     if (dim.get('setScale').value == true && dim.get('scale').get('type').value == 'discrete') {
       this.addDimensionMapping(dimensionIndex);
     }
   }

  dimensionsJSON() {
    let dimensionsJSON = JSON.parse(JSON.stringify(this.dimensionsForm.get('dimensions').value));
    for (let dimensionIndex in dimensionsJSON) {

      if (dimensionsJSON[dimensionIndex].dimensionDescription == '') {
       delete dimensionsJSON[dimensionIndex].dimensionDescription;
      } else {
       dimensionsJSON[dimensionIndex].description = dimensionsJSON[dimensionIndex].dimensionDescription;
       delete dimensionsJSON[dimensionIndex].dimensionDescription;
      }

      if (dimensionsJSON[dimensionIndex].setJustification == false) {
       delete dimensionsJSON[dimensionIndex].justification;
      }
      delete dimensionsJSON[dimensionIndex].setJustification;

      if (dimensionsJSON[dimensionIndex].url == '') {
       delete dimensionsJSON[dimensionIndex].url;
      }

      if (dimensionsJSON[dimensionIndex].setScale == false) {
        delete dimensionsJSON[dimensionIndex].scale;
      } else {
        switch (dimensionsJSON[dimensionIndex].scale.type) {
          case 'continue':
            delete dimensionsJSON[dimensionIndex].scale.mapping;
            break;
          case 'discrete':
            delete dimensionsJSON[dimensionIndex].scale.min;
            delete dimensionsJSON[dimensionIndex].scale.max;
            delete dimensionsJSON[dimensionIndex].scale.step;
            break;
          default:
            break;
        }
      }
      delete dimensionsJSON[dimensionIndex].setScale;

      if (dimensionsJSON[dimensionIndex].gold_question_check == '') {
       delete dimensionsJSON[dimensionIndex].gold_question_check;
      }

      dimensionsJSON[dimensionIndex].style.type = dimensionsJSON[dimensionIndex].style.styleType;
      delete dimensionsJSON[dimensionIndex].style.styleType;

      if (dimensionsJSON[dimensionIndex].style.orientation == '') {
       delete dimensionsJSON[dimensionIndex].style.orientation;
      }

      if (dimensionsJSON[dimensionIndex].style.separator == '') {
       delete dimensionsJSON[dimensionIndex].style.separator;
      }
    }

    return JSON.stringify(dimensionsJSON);
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
       delete generalInstructionsJSON[generalInstructionIndex].caption;
      }

      let stepsStringArray = [];
      for (let generalInstructionStepIndex in generalInstructionsJSON[generalInstructionIndex].steps) {
        stepsStringArray.push(generalInstructionsJSON[generalInstructionIndex].steps[generalInstructionStepIndex].step);
      }
      generalInstructionsJSON[generalInstructionIndex].steps = stepsStringArray;
    }

    return JSON.stringify(generalInstructionsJSON);
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
       delete evaluationInstructionsJSON[evaluationInstructionIndex].caption;
      }

      let stepsStringArray = [];
      for (let evaluationInstructionStepIndex in evaluationInstructionsJSON[evaluationInstructionIndex].steps) {
        stepsStringArray.push(evaluationInstructionsJSON[evaluationInstructionIndex].steps[evaluationInstructionStepIndex].step);
      }
      evaluationInstructionsJSON[evaluationInstructionIndex].steps = stepsStringArray;
    }

    return JSON.stringify(evaluationInstructionsJSON);
  }

  /*
   * STEP #5 - Search Engine
   */
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

    let domainsStringArray = [];
    for (let domainIndex in searchEngineJSON.domains_to_filter) {
      domainsStringArray.push(searchEngineJSON.domains_to_filter[domainIndex].url);
    }
    searchEngineJSON.domains_to_filter = domainsStringArray;

    return JSON.stringify(searchEngineJSON);
  }

  /*
   * STEP #6 - Task Settings
   */

}
