import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root',
})
export class SectionService{
  private _currentSection: string;
  private _previousSection: string;

  private _instructionsAllowed: boolean

  /* Variables to handle the control flow of the task */
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

    this._documentIndex = 0;

    this._previousSection = 'instructions-section';
    this._currentSection = 'instructions-section';

    this._instructionsAllowed = false;
  }

  set taskAllowed(value: boolean) {
    this._taskAllowed = value;
    this.updateSection()
  }

  set taskStarted(value: boolean) {
    this._taskStarted = value;
  }

  set taskCompleted(value: boolean) {
    this._taskCompleted = value;
    this.updateSection()
  }

  set taskSuccessful(value: boolean) {
    this._taskSuccessful = value;
    this.updateSection()
  }

  set taskFailed(value: boolean) {
    this._taskFailed = value;
    this.updateSection()
  }

  set checkCompleted(value: boolean) {
    this._checkCompleted = value;
    this.updateSection()
  }

  set taskInstructionsRead(value: boolean) {
    this._taskInstructionsRead = value;
    this.updateSection()
  }

  set documentIndex(value: number) {
    this._documentIndex = value;
    this.updateSection()
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

  set currentSection(value: string) {
    this._currentSection = value;
  }

  set previousSection(value: string) {
    this._previousSection = value;
  }

  set instructionsAllowed(value: boolean) {
    this._instructionsAllowed = value;
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

  get currentSection(): string {
    return this._currentSection;
  }

  get previousSection(): string {
    return this._previousSection;
  }

  get instructionsAllowed(): boolean {
    return this._instructionsAllowed;
  }

  updateAmounts(questionnaireAmount: number, documentsAmount: number, allowedTries: number){
    this.questionnaireAmount = questionnaireAmount
    this.documentsAmount = documentsAmount
    this.allowedTries = allowedTries
    this.updateSection()
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

  private updateSection(){
    if(this._taskAllowed && this._checkCompleted && !this._taskInstructionsRead) {
      this.previousSection = this.currentSection
      this.currentSection = 'instructions-section'
    } else if (!this._taskStarted && this._taskAllowed && this._checkCompleted && this._taskInstructionsRead) {
      this.previousSection = this.currentSection
      this.currentSection = 'token-section'
    } else if (!this._taskAllowed) {
      this.previousSection = this.currentSection
      this.currentSection = 'already-started-section'
    } else if (this._taskStarted && this._documentIndex < this._questionnaireAmount) {
      this.previousSection = this.currentSection
      this.currentSection = 'questionnaire-section-' + this._documentIndex
    } else if (this._taskStarted) {
      this.previousSection = this.currentSection
      this.currentSection = 'document-section-' + String(this._documentIndex - this._questionnaireAmount)
    } else if (this._taskCompleted && this._taskSuccessful){
      this.previousSection = this.currentSection
      this.currentSection = 'success-section'
    } else if (this._taskCompleted && this._taskSuccessful && this._allowedTries > 0) {
      this.previousSection = this.currentSection
      this.currentSection = 'retry-section'
    } else {
      this.previousSection = this.currentSection
      this.currentSection = 'fail-section'
    }

    this.instructionsAllowed = this.taskAllowed && this.checkCompleted && this.taskInstructionsRead;
  }
}
