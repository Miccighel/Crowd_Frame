import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Mapping, Question, Questionnaire} from "../../../models/questionnaire";
import {AbstractControl, FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {Task} from "../../../models/task";
import * as TreeModel from "tree-model";
import {combineAll} from "rxjs";

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
    questionnaireControls: {}
    questionnaireQuestionsRepeat = []
    questionnaireQuestionsDependant = {}

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
        this.questionnaireControls = {}
        if (this.questionnaire.type == "standard" || this.questionnaire.type == "likert") {
            this.questionnaire.root.walk(function (node) {
                if (node) {
                    if (!node.isRoot()) {
                        if (!('position' in node.model)) {
                            if (node.hasChildren()) {
                                for (let child of node.children) {
                                    // Perform things
                                    let currentQuestion = new Question(child.model.index, child.model)
                                    if (currentQuestion.type != 'section') {
                                        let controlName = `${currentQuestion.nameFull}`
                                        let validators = []
                                        if (currentQuestion.required) validators.push(Validators.required)
                                        if (currentQuestion.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                        if (currentQuestion.type == 'email') validators.push(Validators.email)
                                        if (currentQuestion.repeat) {
                                            validators.push(Validators.min(0))
                                            validators.push(Validators.max(currentQuestion.times))
                                            if (!this['questionnaireQuestionsRepeat'].includes(currentQuestion))
                                                this['questionnaireQuestionsRepeat'].push(currentQuestion)
                                        }
                                        if (currentQuestion.type == 'list') {
                                            let answers = {}
                                            currentQuestion.answers.forEach((value, index) => {
                                                answers[index] = ''
                                            });
                                            this['questionnaireControls'][`${controlName}_answer`] = this.formBuilder.group(answers)
                                        } else {
                                            this['questionnaireControls'][`${controlName}_answer`] = new FormControl('', validators)
                                        }
                                        if (currentQuestion.freeText) this[`${controlName}_free_text`] = new FormControl('')
                                    }
                                }
                            } else {
                                // Perform things
                                let currentQuestion = new Question(node.model.index, node.model)
                                if (currentQuestion.type != 'section') {
                                    let controlName = `${currentQuestion.nameFull}`
                                    let validators = []
                                    if (currentQuestion.required) validators.push(Validators.required)
                                    if (currentQuestion.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                    if (currentQuestion.type == 'email') validators.push(Validators.email)
                                    if (currentQuestion.repeat) {
                                        validators.push(Validators.min(0))
                                        validators.push(Validators.max(currentQuestion.times))
                                        if (!this['questionnaireQuestionsRepeat'].includes(currentQuestion))
                                            this['questionnaireQuestionsRepeat'].push(currentQuestion)
                                    }
                                    if (currentQuestion.dependant) {
                                        if (!this['questionnaireQuestionsDependant'].includes(currentQuestion))
                                            this['questionnaireQuestionsDependant'].push(currentQuestion)
                                    }
                                    if (currentQuestion.type == 'list') {
                                        let answers = {}
                                        currentQuestion.answers.forEach((value, index) => {
                                            answers[index] = ''
                                        });
                                        this['questionnaireControls'][`${controlName}_answer`] = this.formBuilder.group(answers)
                                    } else {
                                        this['questionnaireControls'][`${controlName}_answer`] = new FormControl('', validators)
                                    }
                                    if (currentQuestion.freeText) this['questionnaireControls'][`${controlName}_free_text`] = new FormControl('')
                                }
                            }

                        }
                    }
                } else {
                    return false
                }
            }, this);
            let treeModel = new TreeModel({"childrenPropertyName": 'questions'})
            this.questionnaireForm = this.formBuilder.group(this.questionnaireControls)
            this.questionnaireForm.valueChanges.subscribe(formUpdated => {
                for (let question of this.questionnaireQuestionsRepeat) {
                    let updatedValue = formUpdated[`${question.nameFull}_answer`]
                    for (let questionDropped of this.questionnaire.questionsDropped) {
                        if (questionDropped.target == question.name) {
                            let targetNode = this.questionnaire.root.first(function (node) {
                                return node.model.name === questionDropped.target;
                            });
                            let childNodes = this.questionnaire.root.all(function (node) {
                                return node.model.name == questionDropped.name;
                            });
                            if (updatedValue > childNodes.length) {
                                for (let i = childNodes.length; i < updatedValue; i++) {
                                    if (childNodes.length < question.times) {
                                        let newNode = treeModel.parse(JSON.parse(JSON.stringify(questionDropped)))
                                        newNode.model.indexFull = newNode.model.indexFull.slice(0, -1).concat(childNodes.length + 1)
                                        newNode.model.nameFull = newNode.model.nameFull.concat("_").concat(childNodes.length + 1)
                                        newNode.model.text = newNode.model.text.concat(" ").concat(i + 1)
                                        newNode.walk(function (node) {
                                            if (node) {
                                                if (node.hasChildren()) {
                                                    for (let child of node.children) {
                                                        child.model.indexFull = `${node.model.indexFull}.${(child.model.index + 1)}`
                                                        child.model.nameFull = `${node.model.nameFull}_${child.model.name}`
                                                        let controlName = `${child.model.nameFull}`
                                                        let validators = []
                                                        if (child.model.required) validators.push(Validators.required)
                                                        if (child.model.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                                        if (child.model.type == 'email') validators.push(Validators.email)
                                                        this[`${controlName}_answer`] = new FormControl('', validators)
                                                        if (child.model.type == 'list') {
                                                            let answers = {}
                                                            child.model.answers.forEach((value, index) => {
                                                                answers[index] = ''
                                                            });
                                                            this['questionnaireControls'][`${controlName}_answer`] = this.formBuilder.group(answers)
                                                        } else {
                                                            this['questionnaireControls'][`${controlName}_answer`] = new FormControl('', validators)
                                                        }
                                                        if (child.model.freeText) this['questionnaireControls'][`${controlName}_free_text`] = new FormControl('')
                                                    }
                                                }
                                            } else {
                                                return false
                                            }
                                        }, this);
                                        Object.entries(this.questionnaireControls).forEach(
                                            ([key, value]) => this.questionnaireForm.addControl(key, value as AbstractControl, {emitEvent: false})
                                        );
                                        targetNode.addChild(newNode)
                                        childNodes = this.questionnaire.root.all(function (node) {
                                            return node.model.name == questionDropped.name;
                                        });
                                    }
                                    this.changeDetector.detectChanges()
                                }
                            } else {
                                if (childNodes.length > 0 && updatedValue <= question.times && updatedValue < childNodes.length) {
                                    let nodeToDrop = childNodes.pop()
                                    nodeToDrop.drop()
                                    let controls = this.questionnaireForm.controls
                                    Object.entries(controls).forEach(
                                        ([key, value]) => {
                                            if (key.includes(nodeToDrop.model.nameFull)) {
                                                this.questionnaireForm.removeControl(key, {emitEvent: false})
                                            }
                                        }
                                    );
                                    childNodes = this.questionnaire.root.all(function (node) {
                                        return node.model.name == questionDropped.name;
                                    });
                                    this.changeDetector.detectChanges()
                                }
                            }
                        }
                    }
                }
            });
        } else {
            /* If the questionnaire is a CRT one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user; required, max and min validators are needed */
            let controlsConfig = {};
            for (let index_question = 0; index_question < this.questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaire.questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
            this.questionnaireControls = controlsConfig
            this.questionnaireForm = this.formBuilder.group(this.questionnaireControls)
        }
        this.questionnaire.questions = this.questionnaire.questions['questions']
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": null
        })
    }

    public handleQuestionDependency(question: Question) {
        this.questionnaireQuestionsDependant[question.nameFull] = true
        if (question.dependant) {
            this.questionnaire.root.walk(function (node) {
                if (node) {
                    if (!node.isRoot()) {
                        if (node.model.name == question.target) {
                            let value = this['questionnaireForm'].get(`${node.model.nameFull}_answer`).value
                            if (value) {
                                let label = node.model.answers[value]
                                if (label == question.needed) {
                                    this.questionnaireQuestionsDependant[question.nameFull] = true
                                    let controlName = `${question.nameFull}_answer`
                                    let validators = []
                                    if (question.required) validators.push(Validators.required)
                                    if (question.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                    if (question.type == 'email') validators.push(Validators.email)
                                    if (question.freeText) this['questionnaireControls'][`${controlName}_free_text`] = new FormControl('')
                                    this.questionnaireForm.get(controlName).setValidators(validators)
                                } else {
                                    let controlName = `${question.nameFull}_answer`
                                    this.questionnaireForm.get(controlName).clearValidators()
                                    this.questionnaireQuestionsDependant[question.nameFull] = false
                                }
                            } else {
                                let controlName = `${question.nameFull}_answer`
                                this.questionnaireForm.get(controlName).clearValidators()
                                this.questionnaireQuestionsDependant[question.nameFull] = false
                            }
                        }
                    }
                } else {
                    return false
                }
            }, this);
        }
        return this.questionnaireQuestionsDependant[question.nameFull]
    }

    public handleQuestionnaireCompletion(action: string) {
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": action
        })
    }

}
