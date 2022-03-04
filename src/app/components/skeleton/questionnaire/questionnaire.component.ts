import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Mapping, Questionnaire} from "../../../models/questionnaire";
import {AbstractControl, FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {Task} from "../../../models/task";
import * as TreeModel from "tree-model";
import {Question} from "../../../models/question";

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
    nodes = []

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
        this.questionnaireForm = this.formBuilder.group({})
        this.questionnaire.treeCut.walk(function (node) {
            if (node) {
                if (!node.isRoot()) {
                    if (!('position' in node.model)) {
                        if (node.hasChildren()) {
                            for (let child of node.children) {
                                this['nodes'].push(child)
                                if (child.repeat)
                                    return false
                            }
                        } else {
                            this['nodes'].push(node)
                            if (node.repeat)
                                return false
                        }

                    }
                }
            } else {
                return false
            }
        }, this);
        for (let node of this.nodes) {
            for (let question of this.questionnaire.questions) {
                if (node.model.nameFull == question.nameFull && !question.dropped) {
                    this.initializeFormControl(question)
                }
            }

        }

        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": null
        })
    }

    public handleQuestionDependency(question: Question) {
        this.questionnaire.questionDependencies[question.nameFull] = true
        if (question.dependant) {
            this.questionnaire.treeCut.walk(function (node) {
                if (node) {
                    if (!node.isRoot()) {
                        if (node.model.name == question.target) {
                            let value = this['questionnaireForm'].get(`${node.model.nameFull}_answer`).value
                            if (value != '') {
                                let label = node.model.answers[value]
                                if (label == question.needed) {
                                    let controlName = `${question.nameFull}_answer`
                                    this.questionnaire.questionDependencies[question.nameFull] = true
                                    let validators = []
                                    if (question.required) validators.push(Validators.required)
                                    if (question.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                                    if (question.type == 'email') validators.push(Validators.email)
                                    this.questionnaireForm.get(controlName).setValidators(validators)
                                } else {
                                    this.questionnaire.questionDependencies[question.nameFull] = false
                                }
                            } else {
                                this.questionnaire.questionDependencies[question.nameFull] = false
                            }
                        }
                    }
                } else {
                    return false
                }
            }, this);
        }
        for (const [questionNameFull, value] of Object.entries(this.questionnaire.questionDependencies)) {
            let controlName = `${questionNameFull}_answer`
            if (!value) {
                this.questionnaireForm.get(controlName).clearValidators()
                this.questionnaireForm.get(controlName).setErrors(null)
            }
        }
        return this.questionnaire.questionDependencies[question.nameFull]
    }

    public initializeFormControl(question) {
        if (question.type != 'section' && !question.dependant) {
            let controlName = `${question.nameFull}`
            let validators = []
            if (question.required) validators.push(Validators.required)
            if (question.type == 'number') validators = validators.concat([Validators.min(0), Validators.max(100)])
            if (question.type == 'email') validators.push(Validators.email)
            if (question.repeat) {
                validators.push(Validators.min(0))
                validators.push(Validators.max(question.times))
                if (!this.questionnaire.questionsToRepeat.includes(question))
                    this.questionnaire.questionsToRepeat.push(question)
            }
            if (question.type == 'list') {
                let answers = {}
                question.answers.forEach((value, index) => {
                    answers[index] = ''
                });
                this.questionnaireForm.addControl(`${controlName}_answer`, this.formBuilder.group(answers))
            } else {
                this.questionnaireForm.addControl(`${controlName}_answer`, new FormControl('', validators))
            }
            if (question.freeText) this.questionnaireForm.addControl(`${controlName}_free_text`, new FormControl(''))
        }
    }

    public handleQuestionRepetition(question) {
        let formControl = this.questionnaireForm.get(`${question.nameFull}_answer`)
        let treeModel = new TreeModel({"childrenPropertyName": 'questions'})
        for (let questionToRepeat of this.questionnaire.questionsToRepeat) {
            let updatedValue = formControl.value
            for (let questionCurrent of this.questionnaire.questions) {
                if (questionCurrent.target == questionToRepeat.name) {
                    if (updatedValue <= questionToRepeat.times) {
                        let targetNode = this.questionnaire.treeOriginal.first(function (node) {
                            return node.model.target === questionToRepeat.name;
                        });
                        let childNodes = this.questionnaire.treeCut.all(function (node) {
                            return node.model.target == questionToRepeat.name;
                        });
                        let parentNode = this.questionnaire.treeCut.first(function (node) {
                            return node.model.name == questionToRepeat.name;
                        });
                        if (updatedValue >= childNodes.length) {
                            for (let i = childNodes.length; i < updatedValue; i++) {
                                if (childNodes.length < question.times) {
                                    let indexFullUpdated = targetNode.model.indexFull.slice(0, -1).concat(i + 1)
                                    targetNode.walk(function (node) {
                                        if (node) {
                                            let indexSlice = (node.model.indexFull.slice(indexFullUpdated.length, node.model.indexFull.length))
                                            let indexFullNew = indexFullUpdated.concat(indexSlice)
                                            let newQuestion = new Question(this["questionnaire"]["questionIndex"], node.model)
                                            newQuestion.indexFull = indexFullNew
                                            newQuestion.index = this["questionnaire"]["questionIndex"]
                                            newQuestion.nameFull = newQuestion.nameFull.concat("_").concat(i.toString())
                                            newQuestion.indexFull = node.model.indexFull
                                            node.model.index = this["questionnaire"]["questionIndex"]
                                            node.model.indexFull = indexFullNew
                                            node.model.nameFull = newQuestion.nameFull
                                            node.model.dropped = newQuestion.dropped
                                            this["questionnaire"]["questionIndex"] = this["questionnaire"]["questionIndex"] + 1
                                            this["questionnaire"]["questions"].push(newQuestion)
                                        } else {
                                            return false
                                        }
                                    }, this);
                                    parentNode.addChild(treeModel.parse(JSON.parse(JSON.stringify(targetNode.model))))
                                }
                                for (let question of this.questionnaire.questions) {
                                    if (!question.dropped) {
                                        this.initializeFormControl(question)
                                    }
                                }
                                this.changeDetector.detectChanges()
                            }
                        } else {
                            let droppedNode = childNodes[childNodes.length - 1].drop()
                            let questionsToRemove = []
                            droppedNode.walk(function (node) {
                                if (node) {
                                    for (let question of this["questions"]) {
                                        if (node.model.index == question.index) {
                                            this["questionsToRemove"].push(question)
                                        }
                                    }
                                } else {
                                    return false
                                }
                            }, {questions: this.questionnaire.questions, questionsToRemove: questionsToRemove});
                            for (let question of questionsToRemove) {
                                this.questionnaireForm.removeControl(`${question.nameFull}_answer`)
                                this.questionnaireForm.removeControl(`${question.nameFull}_free_text`)
                            }
                        }
                    }
                }
            }
        }
    }

    public handleQuestionnaireCompletion(action: string) {
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": action
        })
    }

}
