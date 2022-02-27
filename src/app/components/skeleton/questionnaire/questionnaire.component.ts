import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Mapping, Question, Questionnaire} from "../../../models/questionnaire";
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
            this.exploreSubQuestions(this.questionnaire.questions)
        } else {
            /* If the questionnaire is a CRT one it means that it has only one question where the answer must be a number between 0 and 100 chosen by user; required, max and min validators are needed */
            let controlsConfig = {};
            for (let index_question = 0; index_question < this.questionnaire.questions.length; index_question++) controlsConfig[`${this.questionnaire.questions[index_question].name}`] = new FormControl('', [Validators.max(100), Validators.min(0), Validators.required])
            this.questionnaireForm = this.formBuilder.group(controlsConfig)
        }
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": null
        })
    }

    public exploreSubQuestions(obj: Array<Question>) {
        Object.entries(obj).forEach(
            ([index, question]) => {
                if ('questions' in question) {
                    if (question['questions']) {
                        console.log(question.name)
                        // Perform things
                        // let currentQuestion = this.questionnaire.questions[indexQuestion]
                        // if (currentQuestion.type != 'section') {
                        //     let controlName = `${currentQuestion.name}`
                        //     let validators = []
                        //     if (currentQuestion.required) validators = [Validators.required]
                        //     if (currentQuestion.type == 'number') validators.concat([Validators.min(0), Validators.max(100)])
                        //     if (currentQuestion.type == 'email') validators.push(Validators.email)
                        //     controlsConfig[`${controlName}_answer`] = new FormControl('', validators)
                        //     if (currentQuestion.freeText) controlsConfig[`${controlName}_free_text`] = new FormControl('')
                        // }
                        this.exploreSubQuestions(question['questions'])
                    }
                } else {
                    // Perform things
                    console.log(question.name)
                }
            }
        );
    }

    public handleQuestionnaireCompletion(action: string) {
        this.formEmitter.emit({
            "form": this.questionnaireForm,
            "action": action
        })
    }

}
