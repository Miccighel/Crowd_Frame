/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren, ViewChild} from '@angular/core';
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
import {DataRecord} from "../../../models/skeleton/dataRecord";

@Component({
    selector: 'app-document',
    templateUrl: './document.component.html',
    styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;
    /* Snackbar reference */
    snackBar: MatSnackBar;

    @Input() worker: Worker
    @Input() documentIndex: number
    @Input() documentsForm: UntypedFormGroup[]
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    @Input() stepper: MatStepper

    task: Task
    document: Document
    mostRecentDataRecord: DataRecord;

    /* Available options to label an annotation */
    annotationOptions: UntypedFormGroup;
    assessmentForm: UntypedFormGroup

    initialAssessmentFormValidity: boolean;
    followingAssessmentAllowed: boolean;

    /* Reference to the outcome section component */
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(DimensionComponent) dimensionsPointwise: QueryList<DimensionComponent>;
    @ViewChildren('countdownElement') countdown: CountdownComponent;

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        snackBar: MatSnackBar,
        formBuilder: UntypedFormBuilder
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<Object>();
        this.task = this.sectionService.task
        this.snackBar = snackBar;
    }

    ngOnInit(): void {
        this.document = this.task.documents[this.documentIndex];
        this.initialAssessmentFormValidity = false;
        this.followingAssessmentAllowed = false;
        this.stepper.selectedIndex = this.worker.getPositionCurrent()
        this.sectionService.stepIndex = this.worker.getPositionCurrent()
        this.mostRecentDataRecord = this.task.retrieveMostRecentDataRecord('document', this.documentIndex)
        /* If there are no questionnaires and the countdown time is set, enable the first countdown */
        if (this.task.settings.countdownTime >= 0 && this.task.questionnaireAmountStart == 0) {
            this.countdown.begin();
        }
    }

    /* |--------- DIMENSIONS ---------| */

    public storeAssessmentForm(data) {
        let documentIndex = data['index'] as number
        let form = data['form']
        if (!this.assessmentForm && this.documentIndex == documentIndex) {
            if (!this.documentsForm[this.documentIndex]) {
                this.assessmentForm = form
            } else {
                this.assessmentForm = this.documentsForm[this.documentIndex]
            }
            this.formEmitter.emit({
                "form": this.assessmentForm,
            })
        }
    }

    public handleTopLevelFormValidityForRepetition(validity: boolean) {
        this.initialAssessmentFormValidity = validity
    }

    public unlockNextRepetition(value: boolean) {
        this.followingAssessmentAllowed = value
    }

    /* |--------- COUNTDOWN ---------| */

    /*
     * This function intercept the event triggered when the time left to evaluate a document reaches 0
     * and it simply sets the corresponding flag to false
     */
    public handleCountdown(event, i) {
        if (event['left'] == 0) {
            this.task.countdownsExpired[i] = true
            this.annotatorOptions.toArray()[i].changeDetector.detectChanges()
            this.dimensionsPointwise.toArray()[i].changeDetector.detectChanges()
        }
    }

    public handleDocumentCompletion(action: string) {
        let documentCheckGold = this.document.params["check_gold"]
        let okMessage = documentCheckGold && typeof documentCheckGold["message"] === 'string'
        let okJump = documentCheckGold && typeof documentCheckGold["jump"] === 'string'
        if ((action == "Next" || action == "Finish") && (okMessage || okJump)) {
            let docsForms = this.documentsForm.slice()
            docsForms.push(this.assessmentForm)

            let goldConfiguration = this.task.generateGoldConfiguration(this.task.goldDocuments, this.task.goldDimensions, docsForms, this.task.notes);
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
                }
                else{
                    if (okMessage)
                        this.snackBar.open(documentCheckGold["message"], "Dismiss", {duration: 10000});
                }


                action = null
            }
        } else {
            if (action == "Back") {
                this.stepper.previous();
                this.sectionService.stepIndex = this.stepper.selectedIndex
            } else {
                this.stepper.next();
                this.sectionService.stepIndex = this.stepper.selectedIndex
            }
        }
        this.formEmitter.emit({
            "form": this.assessmentForm,
            "action": action
        })

    }

}
