import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";

@Component({
    selector: 'app-outcome-section',
    templateUrl: './outcome-section.component.html',
    styleUrls: ['./outcome-section.component.scss']
})
export class OutcomeSectionComponent implements OnInit {

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: FormBuilder;

    /* |--------- COMMENT ELEMENTS - DECLARATION ---------| */

    /* Final comment form reference */
    commentForm: FormGroup;
    /* Flag to check if the comment has been correctly sent to S3 */
    commentSent: boolean;

    @Input() taskAllowed: boolean
    @Input() taskSuccessful: boolean
    @Input() taskCompleted: boolean
    @Input() taskFailed: boolean
    @Input() triesAllowed: number
    @Input() tryCurrent: number
    @Input() messages: Array<string>
    @Input() tokenOutput: string

    @Output() performReset: EventEmitter<boolean>;
    @Output() commentEmitter: EventEmitter<string>;

    constructor(formBuilder: FormBuilder) {

        this.formBuilder = formBuilder;

        this.performReset = new EventEmitter<boolean>()
        this.commentEmitter = new EventEmitter<string>()

        /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

        this.commentSent = false
        this.commentForm = formBuilder.group({
            "comment": new FormControl(''),
        });

    }

    ngOnInit(): void {}

    public performCommentSaving() {
        this.commentEmitter.emit(this.commentForm.get('comment').value)
    }

}
