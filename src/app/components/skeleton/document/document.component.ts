/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren, ViewChild} from '@angular/core';
import {AbstractControl, UntypedFormBuilder, UntypedFormGroup} from "@angular/forms";
/* Services */
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Models */
import {Task} from "../../../models/skeleton/task";
import {Document} from "../../../../../data/build/skeleton/document";
import { GoldChecker } from "../../../../../data/build/skeleton/goldChecker";
/* Components */
import {AnnotatorOptionsComponent} from "./elements/annotator-options/annotator-options.component";
import {DimensionComponent} from "./dimension/dimension.component";
import {CountdownComponent} from "ngx-countdown";
import {Worker} from "../../../models/worker/worker";
/* Material Design */
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatStepper } from "@angular/material/stepper";

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

    /* Reference to the outcome section component */
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(DimensionComponent) dimensionsPointwise: QueryList<DimensionComponent>;
    @ViewChildren('countdownElement') countdown: CountdownComponent;

    /* |--------- COUNTDOWN HANDLING ---------| */

    /* Available options to label an annotation */
    annotationOptions: UntypedFormGroup;

    task: Task
    document: Document
    assessmentForm: UntypedFormGroup

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
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
        /* If there are no questionnaires and the countdown time is set, enable the first countdown */
        if (this.task.settings.countdown_time >= 0 && this.task.questionnaireAmountStart == 0) {
            this.countdown.begin();
        }
    }

    /* |--------- DIMENSIONS ---------| */


    public storeAssessmentForm(data) {
        let documentIndex = data['index'] as number
        let form = data['form']
        if (!this.assessmentForm && this.documentIndex == documentIndex) {
            if(!this.documentsForm[this.documentIndex]){
                this.assessmentForm = form
            }
            else{
                this.assessmentForm = this.documentsForm[this.documentIndex]
            }
        }
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

        this.sectionService.stepIndex = this.stepper.selectedIndex

        if((action=="Next" || action=="Finish") && typeof this.document.params["check_gold_with_msg"] === 'string'){
            let docsForms = this.documentsForm.slice()
            docsForms.push(this.assessmentForm)

            let goldConfiguration = this.utilsService.generateGoldConfiguration(this.task.goldDocuments,this.task.goldDimensions, docsForms, this.task.notes);
            let goldChecks = GoldChecker.performGoldCheck(goldConfiguration, this.document.params['task_type']);

            if(goldChecks.every(Boolean)){
                this.stepper.next();
                this.sectionService.stepIndex += 1
            }
            else{
                this.snackBar.open(this.document.params["check_gold_with_msg"], "Dismiss", {duration: 10000});
                action=null
            }
        }
        else{
            if(action=="Back"){
                this.stepper.previous();
                this.sectionService.stepIndex -= 1
            }
            else{
                this.stepper.next();
                this.sectionService.stepIndex += 1
            }
        }
        this.formEmitter.emit({
            "form": this.assessmentForm,
            "action": action
        })
    }

    public getDocTypeNumber() {
        let count=0
        for (let index = 0; index <= this.documentIndex; index++) {
            if (this.document.params['task_type'] == this.task.documents[index].params['task_type']) 
                count++;
        }
        return count;
    }

    }
