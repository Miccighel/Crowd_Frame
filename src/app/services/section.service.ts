import {Injectable} from "@angular/core";

@Injectable({
    providedIn: 'root',
})
export class SectionService {

    private _currentSection: string;

    private _instructionsAllowed: boolean

    /* Variables to handle the control flow of the task */
    private _taskAllowed: boolean;
    private _taskStarted: boolean;
    private _taskCompleted: boolean;
    private _taskSuccessful: boolean;
    private _taskFailed: boolean;
    private _taskOverbooking: boolean;

    private _checkCompleted: boolean;
    private _taskInstructionsRead: boolean;

    private _stepIndex: number;
    private _questionnaireIndex: number;
    private _questionnaireAmount: number;
    private _questionnaireAmountStart: number;
    private _questionnaireAmountEnd: number;
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

        this._stepIndex = 0;

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

    set taskOverbooking(value: boolean) {
        this._taskOverbooking = value;
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

    set stepIndex(value: number) {
        this._stepIndex = value - this.questionnaireAmount;
        this.updateSection()
    }

    set questionnaireIndex(value: number) {
        this._questionnaireIndex = value;
        this.updateSection()
    }

    set questionnaireAmount(value: number) {
        this._questionnaireAmount = value;
    }

    set questionnaireAmountStart(value: number) {
        this._questionnaireAmountStart = value;
    }

    set questionnaireAmountEnd(value: number) {
        this._questionnaireAmountEnd = value;
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

    get taskOverbooking(): boolean {
        return this._taskOverbooking;
    }

    get checkCompleted(): boolean {
        return this._checkCompleted;
    }

    get taskInstructionsRead(): boolean {
        return this._taskInstructionsRead;
    }

    get stepIndex(): number {
        return this._stepIndex;
    }

    get questionnaireAmount(): number {
        return this._questionnaireAmount;
    }

    get questionnaireAmountStart(): number {
        return this._questionnaireAmount;
    }

    get questionnaireAmountEnd(): number {
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

    get instructionsAllowed(): boolean {
        return this._instructionsAllowed;
    }

    decreaseAllowedTries() {
        this.allowedTries = this._allowedTries - 1
    }

    increaseIndex() {
        this.stepIndex = this._stepIndex + 1
    }

    decreaseIndex() {
        if (this._stepIndex > 0) {
            this.stepIndex = this._stepIndex - 1
        }
    }

    private updateSection() {
        if (this.taskAllowed && this.checkCompleted && !this.taskInstructionsRead) {
            this.currentSection = 'instructions-section'
        } else if (!this.taskStarted && this.taskAllowed && this.checkCompleted && this.taskInstructionsRead) {
            this.currentSection = 'token-section'
        } else if (!this.taskAllowed) {
            this.currentSection = 'already-started-section'
        } else if (this.taskStarted && this.stepIndex < this.questionnaireAmountStart || this.stepIndex > this.documentsAmount + this.questionnaireAmountStart) {
            this.currentSection = 'questionnaire-section-' + this.stepIndex
        } else if (this.taskStarted && this.stepIndex < this.documentsAmount + this.questionnaireAmountStart) {
            this.currentSection = 'document-section-' + String(this.stepIndex - this.questionnaireAmountStart)
        } else if (this.taskCompleted && this.taskSuccessful) {
            this.currentSection = 'success-section'
        } else if (this.taskCompleted && !this.taskSuccessful && this.allowedTries > 0) {
            this.currentSection = 'retry-section'
        } else {
            this.currentSection = 'fail-section'
        }
        console.log(this.currentSection)
        this.instructionsAllowed = this.taskAllowed && this.checkCompleted && this.taskInstructionsRead;
    }
}
