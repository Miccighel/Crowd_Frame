/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";
import {StatusCodes} from "../../../services/section.service";
import {ConfigService} from "../../../services/config.service";
import {Worker} from "../../../models/worker/worker";
import {UtilsService} from "../../../services/utils.service";

@Component({
    selector: 'app-outcome-section',
    templateUrl: './outcome-section.component.html',
    styleUrls: ['./outcome-section.component.scss'],
    standalone: false
})
export class OutcomeSectionComponent implements OnInit {

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;
    /* Service to track current section */
    sectionService: SectionService
    utilsService: UtilsService
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
    wordsRequired = 5

    constructor(
        formBuilder: UntypedFormBuilder,
        sectionService: SectionService,
        utilsService: UtilsService,
        configService: ConfigService
    ) {
        this.formBuilder = formBuilder
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.configService = configService

        this.performReset = new EventEmitter<boolean>()
        this.commentEmitter = new EventEmitter<string>()

        /* |--------- COMMENT ELEMENTS - INITIALIZATION ---------| */
        this.commentSent = false
        this.commentForm = formBuilder.group({
            "comment": new UntypedFormControl('', [this.validateComment.bind(this)]),
        });
    }

    ngOnInit(): void {
        this.sectionService.updateSection()
    }

    public completeTask() {
        window.open(`https://app.prolific.com/submissions/complete?cc=${this.configService.environment.prolific_completion_code}`, "_blank");
    }

    public performCommentSaving() {
        if (this.commentForm?.get('comment').valid) {
            this.commentEmitter?.emit(this.commentForm?.get('comment').value)
        }
        this.commentForm?.get('comment')?.markAsTouched()
    }

    public validateComment(control: UntypedFormControl) {
        let words = control.value.split(' ')
        let cleanedWords = new Array<string>()
        for (let word of words) {
            let trimmedWord = word.trim()
            if (trimmedWord.length > 0) {
                cleanedWords.push(trimmedWord)
            }
        }
        if (cleanedWords.length < this.wordsRequired) {
            return {"required": true};
        } else {
            return null
        }
    }

}
