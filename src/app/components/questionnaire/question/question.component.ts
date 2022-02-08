import {Component, Input, OnInit} from '@angular/core';
import {FormGroup} from "@angular/forms";
import {Question} from "../../../models/questionnaire";

@Component({
    selector: 'app-question',
    templateUrl: './question.component.html',
    styleUrls: ['../questionnaire.component.scss']
})

export class QuestionComponent implements OnInit {

    @Input() questionForm: FormGroup
    @Input() question: Question
    @Input() index: string

    constructor() {}

    ngOnInit(): void {}

    /*
     * This function retrieves the string associated to an error code thrown by a form field validator.
     */
    public checkFormControl(form: FormGroup, field: string, key: string): boolean {
        return form.get(field).hasError(key);
    }


}
