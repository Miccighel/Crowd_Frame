/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";
import {StatusCodes} from "../../../services/section.service";
import {ConfigService} from "../../../services/config.service";
import {Worker} from "../../../models/worker/worker";

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
    configService: ConfigService

    /* |--------- COMMENT ELEMENTS - DECLARATION ---------| */

    /* Final comment form reference */
    commentForm: UntypedFormGroup;
    /* Flag to check if the comment has been correctly sent to S3 */
    commentSent: boolean;

    @Input() worker: Worker
    @Input() triesAllowed: number
    @Input() tryCurrent: number
    @Input() messages: Array<string>
    @Input() tokenInput: string
    @Input() tokenOutput: string

    @Output() performReset: EventEmitter<boolean>;
    @Output() commentEmitter: EventEmitter<string>;

    statusCodes = StatusCodes

    constructor(
        formBuilder: UntypedFormBuilder,
        sectionService: SectionService,
        configService: ConfigService
    ) {

        console.log("here")

        this.formBuilder = formBuilder
        this.sectionService = sectionService
        this.configService = configService

        this.performReset = new EventEmitter<boolean>()
        this.commentEmitter = new EventEmitter<string>()

        /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */

        this.commentSent = false
        this.commentForm = formBuilder.group({
            "comment": new UntypedFormControl(''),
        });

        console.log(this.statusCodes)

    }

    ngOnInit(): void {
    }

    public completeTask() {
        window.open(`https://app.prolific.co/submissions/complete?cc=${this.configService.environment.prolific_completion_code}`, "_blank");
    }

    public performCommentSaving() {
        this.commentEmitter.emit(this.commentForm.get('comment').value)
    }

}
