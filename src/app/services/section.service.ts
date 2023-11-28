import {Injectable} from "@angular/core";
import {Task} from "../models/skeleton/task";

export enum StatusCodes {
    IP_INFORMATION_MISSING = '100',
    TASK_SUCCESSFUL = '200',
    TASK_ALREADY_COMPLETED = '201',
    TASK_HIT_ASSIGNED = '202',
    TASK_FAILED_WITH_TRIES = '300',
    TASK_FAILED_NO_TRIES = '301',
    TASK_TIME_EXPIRED = '400',
    TASK_OVERBOOKING = '401',
    TASK_COMPLETED_BY_OTHERS = '402',
    WORKER_RETURNING_BLOCK = '500',
    WORKER_BLACKLIST_CURRENT = '501',
    WORKER_BLACKLIST_PREVIOUS = '503',
    WORKER_WHITELIST_CURRENT = '503',
    WORKER_WHITELIST_PREVIOUS = '504',
    CODE_UNKNOWN = '999',
}

@Injectable({
    providedIn: 'root',
})

export class SectionService {

    private _currentSection: string;
    private _instructionsAllowed: boolean
    /* Variables to handle the control flow of the task */
    private _taskStarted: boolean;

    private _taskAllowed: boolean;
    private _taskCompleted: boolean;
    private _taskSuccessful: boolean;
    private _taskFailed: boolean;
    private _taskAlreadyCompleted: boolean;
    private _taskOverbooking: boolean;

    private _errorStatusCode: number

    private _checkCompleted: boolean;
    private _taskInstructionsRead: boolean;
    private _stepIndex: number;

    private _task: Task

    constructor() {
        this._currentSection = 'instructions-section';
        this._instructionsAllowed = false;
        this._taskAllowed = true
        this._taskStarted = false
        this._taskCompleted = false
        this._taskSuccessful = false
        this._taskFailed = false
        this._taskAlreadyCompleted = false
        this._taskOverbooking = false

        this._errorStatusCode = 0

        this._stepIndex = 0
    }

    get currentSection(): string {
        return this._currentSection;
    }

    set currentSection(value: string) {
        this._currentSection = value;
    }

    get instructionsAllowed(): boolean {
        return this._instructionsAllowed
    }

    set instructionsAllowed(value: boolean) {
        this._instructionsAllowed = value;
    }

    get taskAllowed(): boolean {
        return this._taskAllowed;
    }

    set taskAllowed(value: boolean) {
        this._taskAllowed = value;
        this.updateSection()
    }

    get taskStarted(): boolean {
        return this._taskStarted;
    }

    set taskStarted(value: boolean) {
        this._taskStarted = value;
        this.updateSection()
    }

    get taskCompleted(): boolean {
        return this._taskCompleted;
    }

    set taskCompleted(value: boolean) {
        this._taskCompleted = value;
        this.updateSection()
    }

    get taskSuccessful(): boolean {
        return this._taskSuccessful;
    }

    set taskSuccessful(value: boolean) {
        this._taskSuccessful = value;
        this.updateSection()
    }

    get taskFailed(): boolean {
        return this._taskFailed;
    }

    set taskFailed(value: boolean) {
        this._taskFailed = value;
        this.updateSection()
    }

    get taskAlreadyCompleted(): boolean {
        return this._taskAlreadyCompleted;
    }

    set taskAlreadyCompleted(value: boolean) {
        this._taskAlreadyCompleted = value;
        this.updateSection()
    }

    get taskOverbooking(): boolean {
        return this._taskOverbooking;
    }

    set taskOverbooking(value: boolean) {
        this._taskOverbooking = value;
        this.updateSection()
    }

    get taskInstructionsRead(): boolean {
        return this._taskInstructionsRead;
    }

    set taskInstructionsRead(value: boolean) {
        this._taskInstructionsRead = value;
        this.updateSection()
    }

    get stepIndex(): number {
        return this._stepIndex;
    }

    set stepIndex(value: number) {
        this._stepIndex = value
        this.updateSection()
    }

    get checkCompleted(): boolean {
        return this._checkCompleted;
    }

    set checkCompleted(value: boolean) {
        this._checkCompleted = value
        this.updateSection()
    }

    set task(value: Task) {
        this._task = value;
    }

    get task(): Task {
        return this._task;
    }

    public stepIndexes() {
        let steps = []
        for (let i = 0; i < this.task.questionnaireAmount + this.task.documentsAmount; i++) steps[i] = i
        return steps
    }

    public updateSection() {
        if (this.taskAllowed && this.checkCompleted && !this.taskInstructionsRead) {
            this.currentSection = 'instructions-section'
        } else if (!this.taskStarted && this.taskAllowed && this.checkCompleted && this.taskInstructionsRead) {
            this.currentSection = 'token-section'
        } else if (!this.taskStarted && !this.taskAllowed) {
            this.currentSection = 'already-started-section'
        } else if (this.taskStarted && this.stepIndex < this.task.questionnaireAmountStart) {
            this.currentSection = 'questionnaire-start-section-' + this.stepIndex
        } else if (this.taskStarted && this.stepIndex >= this.task.questionnaireAmountStart + this.task.documentsAmount) {
            this.currentSection = 'questionnaire-end-section-' + this.stepIndex
        } else if (this.taskStarted && this.stepIndex >= this.task.questionnaireAmountStart && this.stepIndex < this.task.questionnaireAmountStart + this.task.documentsAmount) {
            let currentDocument = this.stepIndex - this.task.questionnaireAmountStart
            let currentTaskType = this.task.documents[currentDocument]["params"]["task_type"]

            let countDifferentTaskType = 0
            for (let i = 0; i < currentDocument; i++)
                if(this.task.documents[i]["params"]["task_type"].toLowerCase() != currentTaskType.toLowerCase())
                    countDifferentTaskType += 1
            
            this.currentSection = currentTaskType.toLowerCase() + '-section-' + String(currentDocument-countDifferentTaskType)
        } else if (this.taskCompleted && this.taskSuccessful) {
            this.currentSection = 'success-section'
        } else if (this.taskCompleted && !this.taskSuccessful && this.task.settings.allowed_tries > 0) {
            this.currentSection = 'retry-section'
        } else if (this.taskCompleted && this.taskFailed) {
            this.currentSection = 'fail-section'
        } else {
            this.currentSection = 'loading-section'
        }
        this.instructionsAllowed = this.taskAllowed && this.checkCompleted && this.taskInstructionsRead;
    }
}
