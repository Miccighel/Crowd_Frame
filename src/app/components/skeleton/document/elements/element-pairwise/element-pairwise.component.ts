/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from "@angular/forms";
/* Services */
import {DeviceDetectorService} from "ngx-device-detector";
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
/* Models */
import {Task} from "../../../../../models/skeleton/task";

@Component({
    selector: 'app-element-pairwise',
    templateUrl: './element-pairwise.component.html',
    styleUrls: ['./element-pairwise.component.scss', '../../document.component.scss'],
    standalone: false
})
export class ElementPairwiseComponent implements OnInit {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;
    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    selectionForms: UntypedFormGroup[]

    @Input() documentIndex: number

    task: Task
    documentLeftSelection: boolean
    documentRightSelection: boolean

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: UntypedFormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.deviceDetectorService = deviceDetectorService
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.task = this.sectionService.task
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    ngOnInit(): void {
        /* A form for each HIT's element is initialized */
        this.selectionForms = new Array<UntypedFormGroup>(this.task.documentsAmount);
        for (let index = 0; index < this.task.documentsAmount; index++) {
            let controlsConfig = {};
            controlsConfig[`element_0_selected`] = new UntypedFormControl(this.task.documentsPairwiseSelection[index][0], [Validators.required]);
            controlsConfig[`element_1_selected`] = new UntypedFormControl(this.task.documentsPairwiseSelection[index][1], [Validators.required]);
            let selectionForm = this.formBuilder.group(controlsConfig)
            selectionForm.valueChanges.subscribe(values => {
                this.formEmitter.emit(selectionForm)
            })
            this.selectionForms[index] = selectionForm
        }
    }

    public selectElement(documentIndex: number, elementIndex: number) {
        let element = document.getElementById(`element-${documentIndex}-${elementIndex}`)
        if (element.hasAttribute('style')) {
            element.removeAttribute('style')
            this.task.documentsPairwiseSelection[documentIndex][elementIndex] = false
            this.selectionForms[documentIndex]?.get(`element_${elementIndex}_selected`)?.setValue(false)
        } else {
            element.style.backgroundColor = "#B6BDE2"
            this.task.documentsPairwiseSelection[documentIndex][elementIndex] = true
            this.selectionForms[documentIndex]?.get(`element_${elementIndex}_selected`)?.setValue(true)
        }
        if (!this.task.checkAtLeastOneDocumentSelected(documentIndex)) {
            this.selectionForms[documentIndex].setErrors({'invalid': true})
        } else {
             this.selectionForms[documentIndex].setErrors(null)
        }
        this.task.documentsPairwiseSelection[documentIndex][0] = true
        this.task.documentsPairwiseSelection[documentIndex][1] = true
        this.formEmitter.emit(this.selectionForms[documentIndex])
    }

    public handleCheckbox(documentIndex: number, elementIndex: number) {
        let elementSelection = this.selectionForms[documentIndex]?.get(`element_${elementIndex}_selected`).value
        let element = document.getElementById(`element-${documentIndex}-${elementIndex}`)
        if (elementSelection) {
            this.task.documentsPairwiseSelection[documentIndex][elementIndex] = true
            element.style.backgroundColor = "#B6BDE2"
        } else {
            this.task.documentsPairwiseSelection[documentIndex][elementIndex] = false
            element.removeAttribute('style')
        }
        if (!this.task.checkAtLeastOneDocumentSelected(documentIndex)) {
            this.selectionForms[documentIndex].setErrors({'invalid': true})
        } else {
             this.selectionForms[documentIndex].setErrors(null)
        }
        this.task.documentsPairwiseSelection[documentIndex][0] = true
        this.task.documentsPairwiseSelection[documentIndex][1] = true
        this.formEmitter.emit(this.selectionForms[documentIndex])
    }

}
