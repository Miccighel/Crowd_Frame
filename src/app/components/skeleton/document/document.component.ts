/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
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
/* Material Design */
import {MatSnackBar} from "@angular/material/snack-bar";
import {MatStepper} from "@angular/material/stepper";
/* Browser */
import {Title} from "@angular/platform-browser";
import {ConfigService} from "../../../services/config.service";

@Component({
    selector: 'app-document',
    templateUrl: './document.component.html',
    styleUrls: ['./document.component.scss']
})

export class DocumentComponent implements OnInit {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    titleService: Title
    configService: ConfigService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;
    /* Snackbar reference */
    snackBar: MatSnackBar;

    /* #################### INPUTS #################### */

    /* Reference to the current worker performing the task */
    @Input() worker: Worker;

    /* Index of the current document */
    @Input() documentIndex: number;
    /* Array of assessment forms, one for each document */
    @Input() documentsForm: Array<UntypedFormGroup>;
    /* Array of additional assessment forms, one for each document.
     * These forms are used when the configuration requires one or more post-assessment steps.
     * Thus, if the post-assessment steps required are two, there will be two additional forms in addition to the base one. */
    @Input() documentsFormsAdditional: Array<Array<UntypedFormGroup>>;

    /* Array of search engine forms, one for each document */
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    /* Array of forms for results retrieved, one for each document */
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    /* MatStepper input for the component */
    @Input() stepper: MatStepper;

    /* #################### LOCAL ATTRIBUTES #################### */

    /* Reference to the business logic of the entire task */
    task: Task;
    /* Reference to the document model */
    document: Document;

    /* Base assessment form of the document */
    assessmentForm: UntypedFormGroup;
    /* Additional assessment forms for the document, one for each post-assessment step */
    assessmentFormsAdditional: Array<UntypedFormGroup>;

    /* Available options to label an annotation */
    annotationOptions: UntypedFormGroup;
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions: QueryList<AnnotatorOptionsComponent>;

    /* Reference to the dimensions initialized for the current document. Used to handle countdown events. */
    @ViewChildren(DimensionComponent) dimensionsPointwise: QueryList<DimensionComponent>;
    /* Reference to the countdown element itself for the current document */
    @ViewChildren('countdownElement') countdown: CountdownComponent;

    /* #################### EMITTERS #################### */

    /* Emitter used to bounce back the base assessment form or the additional ones to the parent component */
    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        titleService: Title,
        configService: ConfigService,
        snackBar: MatSnackBar,
        formBuilder: UntypedFormBuilder
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.titleService = titleService
        this.configService = configService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<Object>();
        this.task = this.sectionService.task
        this.snackBar = snackBar;
    }

    ngOnInit(): void {
        this.document = this.task.documents[this.documentIndex];
        this.assessmentFormsAdditional = this.documentsFormsAdditional[this.documentIndex]
        /* The index of the stepper component must be set to the position where the worker eventually left off in the past. */
        this.stepper.selectedIndex = this.worker.getPositionCurrent()
        this.sectionService.stepIndex = this.worker.getPositionCurrent()
        /* Since the worker might be coming back from a previous try, each post assessment configuration must be scanned to restore
         * the boolean flags if there exist previous answers provided by the worker */
        for (let attributePostAssessment of this.task.settings.attributesPost) {
            let mostRecentAnswersForPostAssessment = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, attributePostAssessment.index + 1)
            if (Object.keys(mostRecentAnswersForPostAssessment).length > 0) {
                if (attributePostAssessment.index == 0) {
                    this.task.initialAssessmentFormInteraction[this.documentIndex][0] = true
                    this.task.followingAssessmentAllowed[this.documentIndex][0] = true
                }
                this.task.initialAssessmentFormInteraction[this.documentIndex][attributePostAssessment.index + 1] = true
                this.task.followingAssessmentAllowed[this.documentIndex][attributePostAssessment.index + 1] = true
            }
        }
        /* Enable the first countdown if there are no questionnaires and the countdown time is set. */
        if (this.task.settings.countdownTime >= 0 && this.task.questionnaireAmountStart == 0) {
            this.countdown.begin();
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
        if(this.assessmentFormsAdditional) {
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

    /* Intercept the event triggered when the time left to evaluate a document reaches 0, setting the corresponding flag to false. */
    public handleCountdown(event, i) {
        if (event['left'] == 0) {
            this.task.countdownsExpired[i] = true
            this.annotatorOptions.toArray()[i].changeDetector.detectChanges()
            this.dimensionsPointwise.toArray()[i].changeDetector.detectChanges()
        }
    }

    /* #################### DOCUMENT COMPLETION #################### */

    public handleAssessmentCompletion(action: string) {
        let documentCheckGold = this.document.params["check_gold"]
        let okMessage = documentCheckGold && typeof documentCheckGold["message"] === 'string'
        let okJump = documentCheckGold && typeof documentCheckGold["jump"] === 'string'
        if ((action == "Next" || action == "Finish") && (okMessage || okJump)) {
            let documentsForm = this.documentsForm.slice()
            documentsForm.push(this.assessmentForm)

            let goldConfiguration = this.task.generateGoldConfiguration(this.task.goldDocuments, this.task.goldDimensions, documentsForm, this.task.notes);
            let goldChecks = GoldChecker.performGoldCheck(goldConfiguration, this.document.params['task_type']);

            if (goldChecks.every(Boolean)) {
                for (let i = 0; i <= this.documentIndex; i++) {
                    this.task.showMessageFailGoldCheck[i] = null
                }
                this.stepper.next();
                this.sectionService.stepIndex = this.stepper.selectedIndex
            } else {
                if (okJump) {
                    let jumpIndex = this.task.questionnaireAmountStart
                    for (let i = 0; i < this.task.documents.length; i++) {
                        const doc = this.task.documents[i];
                        if (doc["id"] == documentCheckGold["jump"]) {
                            jumpIndex += doc["index"]
                            if (okMessage)
                                this.task.showMessageFailGoldCheck[doc["index"]] = documentCheckGold["message"]
                            break
                        }
                    }
                    this.stepper.selectedIndex = jumpIndex
                    this.sectionService.stepIndex = jumpIndex
                } else {
                    if (okMessage)
                        this.snackBar.open(documentCheckGold["message"], "Dismiss", {duration: 10000});
                }
                action = "Jump"
            }
            this.titleService.setTitle(`${this.configService.environment.taskName}: ${this.task.getElementIndex(this.sectionService.stepIndex)['elementType']}${this.sectionService.stepIndex}`);
        } else {
            if (action == "Back") {
                this.stepper.previous();
                this.sectionService.stepIndex = this.stepper.selectedIndex
            } else {
                this.stepper.next();
                this.sectionService.stepIndex = this.stepper.selectedIndex
            }
            this.titleService.setTitle(`${this.configService.environment.taskName}: ${this.task.getElementIndex(this.sectionService.stepIndex)['elementType']}${this.sectionService.stepIndex}`);
        }
        this.formEmitter.emit({
            "form": this.assessmentForm,
            "action": action
        })
    }

}
