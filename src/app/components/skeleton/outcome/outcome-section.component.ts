/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";

@Component({
    selector: 'app-outcome-section',
    templateUrl: './outcome-section.component.html',
    styleUrls: ['./outcome-section.component.scss']
})
export class OutcomeSectionComponent implements OnInit {

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;
    /* Service to track current section */
    sectionService: SectionService

    /* |--------- COMMENT ELEMENTS - DECLARATION ---------| */

    /* Final comment form reference */
    commentForm: UntypedFormGroup;
    /* Flag to check if the comment has been correctly sent to S3 */
    commentSent: boolean;

    @Input() triesAllowed: number
    @Input() tryCurrent: number
    @Input() messages: Array<string>
    @Input() tokenInput: string
    @Input() tokenOutput: string
    @Input() platform: string
    @Input() completionCode: string

    @Output() performReset: EventEmitter<boolean>;
    @Output() commentEmitter: EventEmitter<string>;

    constructor(
        formBuilder: UntypedFormBuilder,
        sectionService: SectionService
    ) {
        this.formBuilder = formBuilder
        this.sectionService = sectionService

        this.performReset = new EventEmitter<boolean>()
        this.commentEmitter = new EventEmitter<string>()

        /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

        this.commentSent = false
        this.commentForm = formBuilder.group({
            "comment": new UntypedFormControl(''),
        });

    }

    ngOnInit(): void {
    }

    public completeTask() {
        window.open(`https://app.prolific.co/submissions/complete?cc=${this.completionCode}`, "_blank");
    }

    public performCommentSaving() {
        this.commentEmitter.emit(this.commentForm.get('comment').value)
    }

}
