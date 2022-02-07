import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Questionnaire} from "../../../models/questionnaire";
import {FormGroup} from "@angular/forms";

@Component({
    selector: 'app-questionnaire',
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.scss']
})
export class QuestionnaireComponent implements OnInit {

    @Input() step: number
    @Input() position: string
    @Input() documentsAmount: number
    @Input() questionnaire: Questionnaire
    @Input() questionnaireAmount: number
    @Input() questionnaireAmountStart: number
    @Input() questionnaireAmountEnd: number
    @Input() questionnaireForm: FormGroup

    @Input() taskCompleted: boolean

    @Output() questionnaireFilled: EventEmitter<Object>;

    constructor() {
        this.questionnaireFilled = new EventEmitter<Object>()
    }

    ngOnInit(): void {
    }

    public emitQuestionnaireFilled(action, step) {
        this.questionnaireFilled.emit({
            "questionnaireForm": this.questionnaireForm,
            "action": action,
            "step": step
        });
    }

    /*
       * This function retrieves the string associated to an error code thrown by a form field validator.
       */
    public checkFormControl(form: FormGroup, field: string, key: string): boolean {
        return form.get(field).hasError(key);
    }

}
