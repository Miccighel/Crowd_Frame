import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Questionnaire} from "../../../models/questionnaire";
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {Task} from "../../../models/task";

@Component({
    selector: 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.scss']
})

export class QuestionnaireComponent implements OnInit {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: FormBuilder;

    @Input() questionnaireIndex: number

    task: Task
    questionnaire: Questionnaire
    questionnaireForm: FormGroup

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: FormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<FormGroup>();
        this.task = this.sectionService.task
    }

    ngOnInit(): void {
        this.questionnaire = this.task.questionnaires[this.questionnaireIndex];
        if (this.questionnaire.type == "standard" || this.questionnaire.type == "likert") {
            let controlsConfig = {};
            for (let indexQuestion = 0; indexQuestion < this.questionnaire.questions.length; indexQuestion++) {
                let currentQuestion = this.questionnaire.questions[indexQuestion]
                if (currentQuestion.type != 'section') {
                    let controlName = `${currentQuestion.name}`
                    let validators = []
                    if (currentQuestion.required) validators = [Validators.required]
                    if (currentQuestion.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                    if (currentQuestion.type == 'email') validators.push(Validators.email)
                    controlsConfig[`${controlName}_answer`] = new FormControl('', validators)
                    if (currentQuestion.freeText) controlsConfig[`${controlName}_free_text`] = new FormControl('')
                }
                if (currentQuestion.questions) {
                    for (let indexQuestionSub = 0; indexQuestionSub < currentQuestion.questions.length; indexQuestionSub++) {
                        let currentQuestionSub = currentQuestion.questions[indexQuestionSub]
                        if (currentQuestionSub.type != 'section') {
                            let controlNameSub = `${currentQuestion.nameFull}_${currentQuestionSub.name}`
                            let validators = []
                            if (currentQuestionSub.required) validators = [Validators.required]
                            if (currentQuestionSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                            if (currentQuestionSub.type == 'email') validators.push(Validators.email)
                            controlsConfig[`${controlNameSub}_answer`] = new FormControl('', validators)
                            if (currentQuestionSub.freeText) controlsConfig[`${controlNameSub}_free_text`] = new FormControl('')
                        }
                        if (currentQuestionSub.questions) {
                            for (let indexQuestionSubSub = 0; indexQuestionSubSub < currentQuestionSub.questions.length; indexQuestionSubSub++) {
                                let currentQuestionSubSub = currentQuestionSub.questions[indexQuestionSubSub]
                                if (currentQuestionSubSub.type != 'section') {
                                    let controlNameSubSub = `${currentQuestionSub.nameFull}_${currentQuestionSubSub.name}`
                                    let validators = []
                                    if (currentQuestionSubSub.required) validators = [Validators.required]
                                    if (currentQuestionSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                    if (currentQuestionSubSub.type == 'email') validators.push(Validators.email)
                                    controlsConfig[`${controlNameSubSub}_answer`] = new FormControl('', validators)
                                    if (currentQuestionSubSub.freeText) controlsConfig[`${controlNameSubSub}_free_text`] = new FormControl('')
                                }
                                if (currentQuestionSubSub.questions) {
                                    for (let indexQuestionSubSubSub = 0; indexQuestionSubSubSub < currentQuestionSubSub.questions.length; indexQuestionSubSubSub++) {
                                        let currentQuestionSubSubSub = currentQuestionSubSub.questions[indexQuestionSubSubSub]
                                        if (currentQuestionSubSubSub.type != 'section') {
                                            let controlNameSubSubSub = `${currentQuestionSubSub.nameFull}_${currentQuestionSubSubSub.name}`
                                            let validators = []
                                            if (currentQuestionSubSubSub.required) validators = [Validators.required]
                                            if (currentQuestionSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                            if (currentQuestionSubSubSub.type == 'email') validators.push(Validators.email)
                                            controlsConfig[`${controlNameSubSubSub}_answer`] = new FormControl('', validators)
                                            if (currentQuestionSubSubSub.freeText) controlsConfig[`${controlNameSubSubSub}_free_text`] = new FormControl('')
                                        }
                                        if (currentQuestionSubSubSub.questions) {
                                            for (let indexQuestionSubSubSubSub = 0; indexQuestionSubSubSubSub < currentQuestionSubSubSub.questions.length; indexQuestionSubSubSubSub++) {
                                                let currentQuestionSubSubSubSub = currentQuestionSubSubSub.questions[indexQuestionSubSubSubSub]
                                                if (currentQuestionSubSubSubSub.type != 'section') {
                                                    let controlNameSubSubSubSub = `${currentQuestionSubSubSub.nameFull}_${currentQuestionSubSubSubSub.name}`
                                                    let validators = []
                                                    if (currentQuestionSubSubSubSub.required) validators = [Validators.required]
                                                    if (currentQuestionSubSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                    if (currentQuestionSubSubSubSub.type == 'email') validators.push(Validators.email)
                                                    controlsConfig[`${controlNameSubSubSubSub}_answer`] = new FormControl('', validators)
                                                    if (currentQuestionSubSubSubSub.freeText) controlsConfig[`${controlNameSubSubSubSub}_free_text`] = new FormControl('')
                                                }
                                                if (currentQuestionSubSubSubSub.questions) {
                                                    for (let indexQuestionSubSubSubSubSub = 0; indexQuestionSubSubSubSubSub < currentQuestionSubSubSubSub.questions.length; indexQuestionSubSubSubSubSub++) {
                                                        let currentQuestionSubSubSubSubSub = currentQuestionSubSubSubSub.questions[indexQuestionSubSubSubSubSub]
                                                        if (currentQuestionSubSubSubSubSub.type != 'section') {
                                                            let controlNameSubSubSubSubSub = `${currentQuestionSubSubSubSub.nameFull}_${currentQuestionSubSubSubSubSub.name}`
                                                            let validators = []
                                                            if (currentQuestionSubSubSubSubSub.required) validators = [Validators.required]
                                                            if (currentQuestionSubSubSubSubSub.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                            if (currentQuestionSubSubSubSubSub.type == 'email') validators.push(Validators.email)
                                                            controlsConfig[`${controlNameSubSubSubSubSub}_answer`] = new FormControl('', validators)
                                                            if (currentQuestionSubSubSubSubSub.freeText) controlsConfig[`${controlNameSubSubSubSubSub}_free_text`] = new FormControl('')
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            this.questionnaireForm = this.formBuilder.group(controlsConfig)
        } else {
            /* If the questionnaire is a CRT one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user; required, max and min validators are needed */
            let controlsConfig = {};
            for (let index_question = 0; index_question < this.questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaire.questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
            this.questionnaireForm = this.formBuilder.group(controlsConfig)
        }
    }

    public handleQuestionnaireCompletion(action: string){
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": action
        })
    }

}
