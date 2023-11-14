/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Models */
import {Questionnaire} from "../../../models/skeleton/questionnaires/questionnaire";
import {Task} from "../../../models/skeleton/task";
import {Question} from "../../../models/skeleton/questionnaires/question";
/* Other */
import * as TreeModel from "tree-model";
/* Material Design */
import {MatStepper} from "@angular/material/stepper";

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
    formBuilder: UntypedFormBuilder;

    @Input() questionnaireIndex: number
    @Input() questionnairesForm: UntypedFormGroup[]
    @Input() stepper: MatStepper

    task: Task
    questionnaire: Questionnaire
    questionnaireForm: UntypedFormGroup
    nodes = []

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: UntypedFormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
        this.task = this.sectionService.task
    }

    ngOnInit(): void {
        this.questionnaire = this.task.questionnaires[this.questionnaireIndex];
        if(!this.questionnairesForm[this.questionnaireIndex]){
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
        }
        else{
            this.questionnaireForm = this.questionnairesForm[this.questionnaireIndex]
        }
        
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": null
        })
    }

    public handleQuestionDependency(question: Question) {
        if (question.dependant) {
            this.questionnaire.questionDependencies[question.nameFull] = false
            this.questionnaire.treeCut.walk(function (node) {
                if (node) {
                    if (!node.isRoot()) {
                        if (node.model.name == question.target && question.indexFull.includes(node.model.indexFull)) {
                            let value = this['questionnaireForm'].get(`${node.model.nameFull}_answer`).value
                            if (value != '') {
                                let label = node.model.answers[value]
                                if (label == question.needed) {
                                    let controlName = `${question.nameFull}`
                                    let validators = []
                                    if (question.required) validators.push(Validators.required)
                                    if (question.type == 'number') validators = validators.concat([Validators.min(0), Validators.max(100)])
                                    if (question.type == 'email') validators.push(Validators.email)
                                    if (question.repeat) {
                                        validators.push(Validators.min(0))
                                        validators.push(Validators.max(question.times))
                                        if (!this['questionnaire'].questionsToRepeat.includes(question))
                                            this['questionnaire'].questionsToRepeat.push(question)
                                    }
                                    if (question.type == 'list') {
                                        let answers = {}
                                        question.answers.forEach((value, index) => {
                                            answers[index] = false
                                        });
                                        this['questionnaireForm'].addControl(`${controlName}_list`, this['formBuilder'].group(answers))
                                        this['questionnaireForm'].addControl(`${controlName}_answer`, new UntypedFormControl('', [Validators.required]))
                                    } else {
                                        this['questionnaireForm'].addControl(`${controlName}_answer`, new UntypedFormControl('', validators))
                                    }
                                    if (question.freeText) this['questionnaireForm'].addControl(`${controlName}_free_text`, new UntypedFormControl(''))
                                    this.questionnaire.questionDependencies[question.nameFull] = true
                                }
                            } else {
                                let controlName = `${question.nameFull}_answer`
                                let control = this['questionnaireForm'].get(controlName)
                                if (control)
                                    this['questionnaireForm'].get(controlName).clearValidators()
                                this.questionnaire.questionDependencies[question.nameFull] = false
                            }
                        }
                    }
                } else {
                    return false
                }
            }, this);
            for (const [questionNameFull, value] of Object.entries(this.questionnaire.questionDependencies)) {
                let controlName = `${questionNameFull}_answer`
                let control = this['questionnaireForm'].get(controlName)
                if (!value && control) {
                    this.questionnaireForm.get(controlName).clearValidators()
                    this.questionnaireForm.get(controlName).setErrors(null)
                    this.questionnaireForm.get(controlName).setValue('')
                    this.questionnaire.questionDependencies[questionNameFull] = false
                }
            }
            return this.questionnaire.questionDependencies[question.nameFull]
        } else {
            return true
        }
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
                    answers[index] = false
                });
                this.questionnaireForm.addControl(`${controlName}_list`, this.formBuilder.group(answers))
                this.questionnaireForm.addControl(`${controlName}_answer`, new UntypedFormControl('', [Validators.required]))
            } else {
                this.questionnaireForm.addControl(`${controlName}_answer`, new UntypedFormControl('', validators))
            }
            if (question.freeText) this.questionnaireForm.addControl(`${controlName}_free_text`, new UntypedFormControl(''))
        }
    }

    public handleCheckbox(question, groupName) {
        let controlValid = false
        let formGroup = this.questionnaireForm.get(groupName)
        let formControl = this.questionnaireForm.get(question.nameFull.concat('_answer'))
        for (const [key, value] of Object.entries(formGroup.value)) {
            if (value)
                controlValid = true
        }
        if (!controlValid) {
            formControl.setValue('')
        } else {
            formControl.setValue(formGroup.value)
        }
        formControl.markAsTouched()
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
                                let indexFullUpdated = targetNode.model.indexFull.slice(0, -1).concat(i + 1)
                                targetNode.walk(function (node) {
                                    if (node) {
                                        if (node.model.target == questionToRepeat.name) {
                                            if (node.model.text.includes(' nr. ')) {
                                                node.model.text = node.model.text.slice(0, -5).concat(" nr. ").concat(i + 1)
                                            } else {
                                                node.model.text = node.model.text.concat(" nr. ").concat(i + 1)
                                            }
                                        }
                                        let indexSlice = (node.model.indexFull.slice(indexFullUpdated.length, node.model.indexFull.length))
                                        let indexFullNew = indexFullUpdated.concat(indexSlice)
                                        let newQuestion = new Question(this["questionnaire"]["lastQuestionIndex"], node.model)
                                        newQuestion.indexFull = indexFullNew
                                        newQuestion.index = this["questionnaire"]["lastQuestionIndex"]
                                        let nameFullUpdated = false
                                        for (let j = 0; j <= questionToRepeat.times; j++) {
                                            let addition = "_".concat(j.toString())
                                            if (newQuestion.nameFull.includes(addition)) {
                                                nameFullUpdated = true
                                            }
                                        }
                                        if (nameFullUpdated)
                                            newQuestion.nameFull = newQuestion.nameFull.slice(0, -2).concat("_").concat(i.toString())
                                        else {
                                            newQuestion.nameFull = newQuestion.nameFull.concat("_").concat(i.toString())
                                        }
                                        newQuestion.indexFull = indexFullNew
                                        node.model.index = this["questionnaire"]["lastQuestionIndex"]
                                        node.model.indexFull = indexFullNew
                                        node.model.nameFull = newQuestion.nameFull
                                        node.model.dropped = newQuestion.dropped
                                        this["questionnaire"]["lastQuestionIndex"] = this["questionnaire"]["lastQuestionIndex"] + 1
                                        this["questionnaire"]["questions"].push(newQuestion)
                                    } else {
                                        return false
                                    }
                                }, this);
                                parentNode.addChild(treeModel.parse(JSON.parse(JSON.stringify(targetNode.model))))

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
                                        if (question.index == node.model.index) {
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
                                this.questionnaireForm.removeControl(`${question.nameFull}_list`)
                                delete this.questionnaire.questionDependencies[question.nameFull]
                                delete this.questionnaire.questionsToRepeat[question.nameFull]
                                this.questionnaire.questions = this.questionnaire.questions.filter(questionStored => questionStored.index != question.index);
                            }
                        }
                    }
                }
            }
        }
    }

    public handleQuestionnaireCompletion(action: string) {
        if(action=="Back")
            this.sectionService.stepIndex -= 1
        else
            this.sectionService.stepIndex += 1
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": action
        })
    }

}
