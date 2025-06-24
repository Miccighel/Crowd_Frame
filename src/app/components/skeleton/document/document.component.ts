// TODO(strict-forms): auto-guarded by codemod – review if needed.
/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren, ViewChild, ElementRef} from '@angular/core';
import {UntypedFormBuilder, UntypedFormGroup} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
/* Models */
import {Task} from "../../../models/skeleton/task";
import {Document} from "../../../../../data/build/skeleton/document";
import {GoldChecker} from "../../../../../data/build/skeleton/goldChecker";
/* Components */
import {AnnotatorOptionsComponent} from "./elements/annotator-options/annotator-options.component";
import {DimensionComponent} from "./dimension/dimension.component";
import {CountdownComponent} from "ngx-countdown";
import {Worker} from "../../../models/worker/worker";
import {CountdownDialogComponent} from './countdown-dialog/countdown-dialog.component';
import {ElementPointwiseComponent} from "./elements/element-pointwise/element-pointwise.component";
/* Material Design */
import {MatSnackBar} from "@angular/material/snack-bar";
import {MatStepper} from "@angular/material/stepper";
import {MatProgressBar} from '@angular/material/progress-bar';
import {MatDialog} from '@angular/material/dialog';

/* Browser */
import {Title} from "@angular/platform-browser";
import {ConfigService} from "../../../services/config.service";
/* DynamoDB */
import {DynamoDBService} from "../../../services/aws/dynamoDB.service";

@Component({
    selector: 'app-document',
    templateUrl: './document.component.html',
    styleUrls: ['./document.component.scss'],
    standalone: false
})
export class DocumentComponent implements OnInit {

    /* #################### SERVICES & CORE STUFF #################### */

    changeDetector: ChangeDetectorRef;
    sectionService: SectionService;
    dynamoDBService: DynamoDBService;
    utilsService: UtilsService
    titleService: Title
    configService: ConfigService
    formBuilder: UntypedFormBuilder;
    snackBar: MatSnackBar;
    dialog: MatDialog;

    /* #################### INPUTS #################### */

    @Input() worker!: Worker;
    @Input() documentIndex!: number;
    @Input() documentsForm!: Array<UntypedFormGroup>;
    @Input() documentsFormsAdditional!: Array<Array<UntypedFormGroup>>;
    @Input() searchEngineForms!: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms!: Array<Array<Object>>;
    @Input() stepper!: MatStepper;                       // may arrive after ngOnInit

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task;
    document!: Document;

    assessmentForm!: UntypedFormGroup;
    assessmentFormsAdditional!: Array<UntypedFormGroup>;

    annotationOptions!: UntypedFormGroup;
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions!: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(ElementPointwiseComponent) pointwiseComponents!: QueryList<ElementPointwiseComponent>;

    @ViewChildren(DimensionComponent) dimensionsPointwise!: QueryList<DimensionComponent>;
    @ViewChild('countdownElement') countdown!: CountdownComponent;
    countdownInterval!: number;
    @ViewChild('countdownProgressBar') countdownProgressBar!: MatProgressBar;

    /* #################### EMITTERS #################### */

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        titleService: Title,
        configService: ConfigService,
        snackBar: MatSnackBar,
        dialog: MatDialog,
        formBuilder: UntypedFormBuilder,
        dynamoDBService: DynamoDBService,
        private elementRef: ElementRef
    ) {
        this.changeDetector = changeDetector;
        this.sectionService = sectionService;
        this.utilsService = utilsService;
        this.titleService = titleService;
        this.dynamoDBService = dynamoDBService;
        this.configService = configService;
        this.formBuilder = formBuilder;
        this.formEmitter = new EventEmitter<Object>();
        this.task = this.sectionService.task;
        this.snackBar = snackBar;
        this.dialog = dialog;
    }

    /* #################### LIFE-CYCLE #################### */

    ngOnInit(): void {

        this.document = this.task.documents[this.documentIndex];
        this.assessmentFormsAdditional = this.documentsFormsAdditional[this.documentIndex];

        /* Guard for stepper not yet injected */
        if (this.stepper) {
            this.stepper.selectedIndex = this.worker.getPositionCurrent();
        }
        this.sectionService.stepIndex = this.worker.getPositionCurrent();

        /* Restore previous post assessments if any */
        for (let attributePostAssessment of this.task.settings.attributesPost) {
            const mostRecent = this.task.retrieveMostRecentAnswersForPostAssessment(
                this.documentIndex,
                attributePostAssessment.index + 1
            );
            if (Object.keys(mostRecent).length > 0) {
                if (attributePostAssessment.index === 0) {
                    this.task.initialAssessmentFormInteraction[this.documentIndex][0] = true;
                    this.task.followingAssessmentAllowed[this.documentIndex][0] = true;
                }
                this.task.initialAssessmentFormInteraction[this.documentIndex][attributePostAssessment.index + 1] = true;
                this.task.followingAssessmentAllowed[this.documentIndex][attributePostAssessment.index + 1] = true;
            }
        }

        this.countdownInterval = 0;
    }

    ngAfterViewInit() {

        /* Start / handle countdowns */
        const currentElement = this.task.getElementIndex(this.worker.getPositionCurrent());
        if (currentElement.elementType === 'S'
            && this.documentIndex === currentElement.elementIndex
            && this.countdown) {

            if (this.task.countdownsStarted[this.documentIndex]) {
                this.countdown.begin();
            } else {
                this.openCountdownDialog();
            }
        }

        /* Subscribe only when the stepper is available */
        if (this.stepper) {
            this.stepper.selectionChange.subscribe(event => {
                const element = this.task.getElementIndex(event.selectedIndex);
                if (element.elementType === 'S'
                    && this.documentIndex === element.elementIndex
                    && this.countdown
                    && !this.task.countdownsStarted[this.documentIndex]) {
                    this.openCountdownDialog();
                }
            });
        }

        if (this.task.settings.countdown_modality && this.countdownProgressBar) {
            this.countdownProgressBar.value =
                (this.task.documentsCountdownTime[this.documentIndex] /
                    this.task.documentsStartCountdownTime[this.documentIndex]) * 100;
        }
    }

    /* #################### ANSWERS, ASSESSMENT FORMS, & POST ASSESSMENT #################### */

    /* This function stores the last assessment form used by the worker. The payload can have four attributes:
     * - index (of the document)
     * - type (of the assessment form): initial, post
     * - postAssessmentIndex: self-explanatory
     * It is called when the underlying dimension component emits the answers provided for each instantiated dimension. */
    public storeAssessmentForm(data) {
        let documentIndex = data['index'] as number
        let form = data['form']
        let type = data['type']
        /* The form received is the initial one, so it is stored in the base attribute */
        if (type == 'initial') {
            if (!this.assessmentForm && this.documentIndex == documentIndex) {
                if (!this.documentsForm[this.documentIndex]) {
                    this.assessmentForm = form
                } else {
                    this.assessmentForm = this.documentsForm[this.documentIndex]
                }
                this.formEmitter.emit({
                    "form": this.assessmentForm,
                    "type": type
                })
            }
        } else {
            /* Store the received post-assessment form at the specified index position,
             * adjusting for the fact that indexes in the markup start from 1. */
            let postAssessmentIndex = data['postAssessmentIndex'] as number
            if (!this.assessmentFormsAdditional[postAssessmentIndex - 1] && this.documentIndex == documentIndex) {
                this.assessmentFormsAdditional[postAssessmentIndex - 1] = form
                this.formEmitter.emit({
                    "form": this.assessmentFormsAdditional[postAssessmentIndex - 1],
                    "postAssessmentIndex": postAssessmentIndex,
                    "type": type
                })
            }
        }
        /* The forms for the current documents are emitted to the skeleton each time, so that they can be collected and their data uploaded to the database. */
    }

    /* Mark interaction with the current assessment form when all values are valid and not empty, whether it's the initial or a post-assessment form. */
    public handleInitialAssessmentFormInteracted(data: Object) {
        let postAssessmentIndex = data['postAssessmentIndex'] as number
        let allValuesNotEmpty = data['allValuesNotEmpty'] as boolean
        if (allValuesNotEmpty)
            this.task.initialAssessmentFormInteraction[this.documentIndex][postAssessmentIndex] = allValuesNotEmpty
    }

    /* Unlocks the following post assessment when the assessment form for the previous one is valid. */
    public unlockNextAssessmentRepetition(data: Object) {
        let postAssessmentIndex = data['postAssessmentIndex'] as number
        this.task.followingAssessmentAllowed[this.documentIndex][postAssessmentIndex] = data['followingAssessmentAllowed'] as boolean
        if (postAssessmentIndex > 0) {
            this.assessmentFormsAdditional[postAssessmentIndex - 1].disable()
        }
    }

    /* Checks for successful interaction with all assessment forms, including the initial one. */
    public checkInitialAssessmentFormInteraction() {
        return this.task.initialAssessmentFormInteraction[this.documentIndex].every((element: boolean) => {
            return element;
        });
    }

    /* Checks if the initial assessment form is valid and not disabled. Skip this check when there are post-assessment steps. */
    public checkAssessmentFormValidity(): boolean {
        if (!this.assessmentForm) {
            return false;
        }
        if (this.task.settings.post_assessment) {
            return true;
        }
        return this.assessmentForm.valid && this.assessmentForm.status !== 'DISABLED';
    }

    /* Checks if every post-assessment form is valid and not disabled. Note: This function is called only when post-assessment is enabled. */
    public checkAdditionalAssessmentFormsValidity() {
        if (this.assessmentFormsAdditional) {
            const arrayLength = this.assessmentFormsAdditional.length;

            /* If post-assessment is not enabled, return true to avoid blocking the "Next" button */
            if (!this.task.settings.post_assessment) {
                return true;
            }

            /* If the post-assessment form array is not initialized instantly, consider it as invalid */
            if (arrayLength === 0) {
                return false;
            }

            /* Check the validity of each post-assessment form */
            return this.assessmentFormsAdditional.every((assessmentFormAdditional, index) => {
                /* Check if the last form is valid */
                if (index === arrayLength - 1) {
                    return assessmentFormAdditional && assessmentFormAdditional.valid && assessmentFormAdditional.status === "VALID";
                } else {
                    /* Check if previous forms are either valid or disabled */
                    return assessmentFormAdditional && (assessmentFormAdditional.valid || assessmentFormAdditional.status === "DISABLED");
                }
            });
        } else {
            return true
        }
    }

    /* Checks if post-assessments are allowed within every step. */
    public checkFollowingAssessmentAllowed() {
        return this.task.followingAssessmentAllowed[this.documentIndex].every((followingAssessment) => followingAssessment);
    }

    /* #################### COUNTDOWNS #################### */

    /* Handles the event triggered by the ngx-countdown component while it's running or when it expires. */
    public async handleCountdown(event) {
        if (!this.task.countdownsExpired[this.documentIndex] && event.action === 'done') {
            this.task.countdownsExpired[this.documentIndex] = true;
            this.task.countdownExpiredTimestamp[this.documentIndex] = Date.now() / 1000;
            this.sendCountdownPayload(0);
            if (this.task.settings.modality == 'pointwise') {
                if (this.task.settings.annotator)
                    this.annotatorOptions?.forEach(ann => ann.changeDetector.detectChanges());
                else
                    this.dimensionsPointwise?.forEach(dim => dim.changeDetector.detectChanges());
            }

        }

        if (event.action === 'notify') {
            if (this.countdownProgressBar)
                this.countdownProgressBar.value = (event.left / (this.task.documentsStartCountdownTime[this.documentIndex] * 1000)) * 100
            this.countdownInterval++;
            if (this.countdownInterval === 3) {
                this.sendCountdownPayload(event.left);
                this.countdownInterval = 0;
            }
        }

    }

    /* Called by handleCountdown to log an entry in the database every 3 seconds. This helps track the worker's time spent on the current document while also saving potential answers and search engine results.
     The mechanism prevents workers from having unlimited time. */
    private async sendCountdownPayload(timeLeft) {
        const currentElement = this.task.getElementIndex(this.worker.getPositionCurrent());
        let additionalAnswers = {}
        for (let assessmentFormAdditional of this.documentsFormsAdditional[currentElement['elementIndex']]) {
            Object.keys(assessmentFormAdditional.controls)?.forEach(controlName => {
                additionalAnswers[controlName] = assessmentFormAdditional?.get(controlName).value
            });
        }
        let documentPayload = this.task.buildTaskDocumentPayload(currentElement, this.documentsForm[currentElement['elementIndex']].value, additionalAnswers, Math.round(Number(timeLeft) / 1000), "Update");
        documentPayload['update_type'] = "countdown_update";
        await this.dynamoDBService.insertDataRecord(this.configService.environment, this.worker, this.task, documentPayload, true);
    }

    /* Dialog that shows up when there's a countdown and the worker accesses the document for the first time */
    private openCountdownDialog() {
        const dialogRef = this.dialog.open(CountdownDialogComponent, {
            disableClose: true,
            backdropClass: 'countdown-dialog-backdrop',
            width: '450px',
            minHeight: '85%',
            data: {timeAllowed: this.task.documentsStartCountdownTime[this.documentIndex]}
        });
        dialogRef.afterClosed().subscribe((response) => {
            if (response === 'confirmed') {
                this.countdown.begin();
                this.task.countdownsStarted[this.documentIndex] = true;
            }
        });
    }

    /* #################### DOCUMENT COMPLETION #################### */

    public handleAssessmentCompletion(action: string) {

        const documentCheckGold = this.document.params["check_gold"];
        const okMessage = documentCheckGold && typeof documentCheckGold["message"] === 'string';
        const okJump = documentCheckGold && typeof documentCheckGold["jump"] === 'string';

        const videos = this.elementRef.nativeElement.querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
        videos.forEach(video => {
            video.pause();
        });

        if ((action === "Next" || action === "Finish") && (okMessage || okJump)) {
            const documentsForm = this.documentsForm.slice();
            documentsForm.push(this.assessmentForm);

            const goldConfiguration = this.task.generateGoldConfiguration(
                this.task.goldDocuments,
                this.task.goldDimensions,
                documentsForm,
                this.task.notes
            );

            const goldChecks = GoldChecker.performGoldCheck(goldConfiguration, this.document.params['task_type']);

            if (goldChecks.every(Boolean)) {
                for (let i = 0; i <= this.documentIndex; i++) {
                    this.task.showMessageFailGoldCheck[i] = null;
                }
                this.stepper.next();
                this.sectionService.stepIndex = this.stepper.selectedIndex;
            } else {
                if (okJump) {
                    let jumpIndex = this.task.questionnaireAmountStart;
                    for (let i = 0; i < this.task.documents.length; i++) {
                        const doc = this.task.documents[i];
                        if (doc["id"] === documentCheckGold["jump"]) {
                            jumpIndex += doc["index"];
                            if (okMessage) {
                                this.task.showMessageFailGoldCheck[doc["index"]] = documentCheckGold["message"];
                            }
                            break;
                        }
                    }
                    this.stepper.selectedIndex = jumpIndex;
                    this.sectionService.stepIndex = jumpIndex;
                } else if (okMessage) {
                    this.snackBar.open(documentCheckGold["message"], "Dismiss", {duration: 10000});
                }
                action = "Jump";
            }

        } else {
            if (action === "Back") {
                this.stepper.previous();
                this.sectionService.stepIndex = this.stepper.selectedIndex;
            } else {
                this.stepper.next();
                this.sectionService.stepIndex = this.stepper.selectedIndex;
            }
        }

        // 2. Play the new video's component after DOM updates
        const newIndex = this.sectionService.stepIndex;

        // 3. Update the document title
        const titleBase = this.configService.environment.taskTitle !== 'none'
            ? this.configService.environment.taskTitle
            : this.configService.environment.taskName;

        const elementIndex = this.task.getElementIndex(newIndex)['elementType'];
        this.titleService.setTitle(`${titleBase}: ${elementIndex}${newIndex}`);

        // 4. Emit the form result
        this.formEmitter.emit({
            form: this.assessmentForm,
            action
        });
    }


}
