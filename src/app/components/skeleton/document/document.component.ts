import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren} from '@angular/core';
import {SectionService} from "../../../services/section.service";
import {UtilsService} from "../../../services/utils.service";
import {FormBuilder, FormGroup} from "@angular/forms";
import {Task} from "../../../models/task";
import {DeviceDetectorService} from "ngx-device-detector";
import {Document} from "../../../../../data/build/skeleton/document";
import {AnnotatorOptionsComponent} from "./elements/annotator-options/annotator-options.component";
import {DimensionComponent} from "./dimension/dimension.component";
import {CountdownComponent} from "ngx-countdown";

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
    formBuilder: FormBuilder;

    @Input() documentIndex: number

    /* Reference to the outcome section component */
    @ViewChildren(AnnotatorOptionsComponent) annotatorOptions: QueryList<AnnotatorOptionsComponent>;
    @ViewChildren(DimensionComponent) dimensionsPointwise: QueryList<DimensionComponent>;
    @ViewChildren('countdownElement') countdown: CountdownComponent;

    /* |--------- COUNTDOWN HANDLING ---------| */

    /* Available options to label an annotation */
    annotationOptions: FormGroup;

    task: Task
    document: Document
    documentForm: FormGroup

    @Output() formEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: FormBuilder
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<Object>();
        this.task = this.sectionService.task
    }

    ngOnInit(): void {
        this.document = this.task.documents[this.documentIndex];
        /* If there are no questionnaires and the countdown time is set, enable the first countdown */
        if (this.task.settings.countdown_time >= 0 && this.task.questionnaireAmountStart == 0) {
            this.countdown.begin();
        }
    }

    /* |--------- DIMENSIONS ---------| */

    public updateDocumentForm(form) {
        if (this.documentForm) {
            let controlsConfig = {}
            let previousControls = this.documentForm.controls
            for (const [name, control] of Object.entries(previousControls)) controlsConfig[name] = control
            for (const [name, control] of Object.entries(form.controls)) controlsConfig[name] = control
            this.documentForm = this.formBuilder.group(controlsConfig)
            this.documentForm.setErrors(form.errors)
        } else {
            this.documentForm = form
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

    public handleDocumentCompletion(action: string){
        this.formEmitter.emit({
            "form": this.documentForm,
            "action": action
        })
    }

    public nextStep() {
        this.sectionService.stepIndex += -1
        let stepper = document.getElementById('stepper');
        stepper.scrollIntoView();
    }

    public previousStep() {
        this.sectionService.stepIndex += -1
        let stepper = document.getElementById('stepper');
        stepper.scrollIntoView();
    }

}
