/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
/* Services */
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Models */
import {Task} from "../../../../../models/skeleton/task";
import {AbstractControl, UntypedFormGroup} from "@angular/forms";

@Component({
    selector: 'app-element-pointwise',
    templateUrl: './element-pointwise.component.html',
    styleUrls: ['./element-pointwise.component.scss', '../../document.component.scss']
})
export class ElementPointwiseComponent {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    @Input() documentIndex: number
    /* Used to understand if the current element is being assessed again */
    @Input() postAssessment: boolean
    @Input() initialAssessmentFormInteraction: boolean
    @Input() documentForm: UntypedFormGroup

    @Output() followingAssessmentAllowedEmitter: EventEmitter<boolean>;

    task: Task

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService
    ) {
        this.changeDetector = changeDetector
        this.deviceDetectorService = deviceDetectorService
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.task = sectionService.task
        this.followingAssessmentAllowedEmitter = new EventEmitter<boolean>();
    }

    public unlockNextRepetition(value: boolean) {
        this.followingAssessmentAllowedEmitter.emit(value)
    }

}
