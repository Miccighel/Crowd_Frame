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
  }

  /*
   * STEP #1 - Questionnaires
   */
  questionnaires(): FormArray {
    return this.questionnairesForm.get('questionnaires') as FormArray;
  }

  addQuestionnaire() {
    this.questionnaires().push(this._formBuilder.group({
      type: [null],
      description: [null],
      questions: this._formBuilder.array([]),
      mappings: this._formBuilder.array([])
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
      name: [null],
      text: [null],
      answers: this._formBuilder.array([])
    }))
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
      answer: [null]
    }))
  }

  removeAnswer(questionnaireIndex: number, questionIndex: number, answerIndex:number) {
    this.answers(questionnaireIndex, questionIndex).removeAt(answerIndex);
  }

  /* Mappings */
  mappings(questionnaireIndex: number): FormArray {
    return this.questionnaires().at(questionnaireIndex).get('mappings') as FormArray;
  }

  addMapping(questionnaireIndex: number) {
    this.mappings(questionnaireIndex).push(this._formBuilder.group({
      label: [null],
      value: [null]
    }))
  }

  removeMapping(questionnaireIndex: number, mappingIndex: number) {
    this.mappings(questionnaireIndex).removeAt(mappingIndex);
  }

  /* Other Functions */
  updateQuestionnaire(questionnaireIndex) {
    let questionnaire = this.questionnaires().at(questionnaireIndex);
    questionnaire.get('description').reset();
    questionnaire.get('description').clearValidators();
    questionnaire.get('description').updateValueAndValidity();
    this.questions(questionnaireIndex).clear();
    this.mappings(questionnaireIndex).clear();
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
          delete questionnairesJSON[questionnaireIndex].mappings;
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
          delete questionnairesJSON[questionnaireIndex].mappings;
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

}
