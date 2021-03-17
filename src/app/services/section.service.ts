import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root',
})
export class SectionService{
  private _taskAllowed: boolean;
  private _taskStarted: boolean;
  private _taskCompleted: boolean;
  private _taskSuccessful: boolean;
  private _taskFailed: boolean;
  private _checkCompleted: boolean;
  private _taskInstructionsRead: boolean;
  private _documentIndex: number;
  private _questionnaireAmount: number;
  private _documentsAmount: number;
  private _allowedTries: number;

  constructor() {
    this._taskAllowed = true;
    this._taskStarted = false;
    this._taskCompleted = false;
    this._taskSuccessful = false;
    this._taskFailed = false;
    this._checkCompleted = false;
    this._taskInstructionsRead = false;
  }

  set taskAllowed(value: boolean) {
    this._taskAllowed = value;
  }

  set taskStarted(value: boolean) {
    this._taskStarted = value;
  }

  set taskCompleted(value: boolean) {
    this._taskCompleted = value;
  }

  set taskSuccessful(value: boolean) {
    this._taskSuccessful = value;
  }

  set taskFailed(value: boolean) {
    this._taskFailed = value;
  }

  set checkCompleted(value: boolean) {
    this._checkCompleted = value;
  }

  set taskInstructionsRead(value: boolean) {
    this._taskInstructionsRead = value;
  }

  set documentIndex(value: number) {
    this._documentIndex = value;
  }

  set questionnaireAmount(value: number) {
    this._questionnaireAmount = value;
  }

  set documentsAmount(value: number) {
    this._documentsAmount = value;
  }

  set allowedTries(value: number) {
    this._allowedTries = value;
  }

  get taskAllowed(): boolean {
    return this._taskAllowed;
  }

  get taskStarted(): boolean {
    return this._taskStarted;
  }

  get taskCompleted(): boolean {
    return this._taskCompleted;
  }

  get taskSuccessful(): boolean {
    return this._taskSuccessful;
  }

  get taskFailed(): boolean {
    return this._taskFailed;
  }

  get checkCompleted(): boolean {
    return this._checkCompleted;
  }

  get taskInstructionsRead(): boolean {
    return this._taskInstructionsRead;
  }

  get documentIndex(): number {
    return this._documentIndex;
  }

  get questionnaireAmount(): number {
    return this._questionnaireAmount;
  }

  get documentsAmount(): number {
    return this._documentsAmount;
  }

  get allowedTries(): number {
    return this._allowedTries;
  }

  updateAmounts(questionnaireAmount: number, documentsAmount: number, allowedTries: number){
    this.questionnaireAmount = questionnaireAmount
    this.documentsAmount = documentsAmount
    this.allowedTries = allowedTries
  }

  decreaseAllowedTries() {
    this.allowedTries = this._allowedTries - 1
  }

  increaseIndex() {
    this.documentIndex = this._documentIndex + 1
  }

  decreaseIndex() {
    this.documentIndex = this._documentIndex - 1
  }

  getSection(){
    if(this._taskAllowed && this._checkCompleted && !this._taskInstructionsRead) {
      return 'instructions-section'
    } else if (!this._taskStarted && this._taskAllowed && this._checkCompleted && this._taskInstructionsRead) {
      return 'token-section'
    } else if (!this._taskAllowed) {
      return 'already-started-section'
    } else if (this._taskStarted && this._documentIndex < this._questionnaireAmount) {
      return 'questionnaire-section-'+this._documentIndex
    } else if (this._taskStarted) {
      return 'document-section-'+(this._documentIndex - this._questionnaireAmount)
    } else if (this._taskCompleted && this._taskSuccessful){
      return 'success-section'
    } else if (this._taskCompleted && this._taskSuccessful && this._allowedTries > 0) {
      return 'retry-section'
    } else {
      return 'fail-section'
    }
  }
}
