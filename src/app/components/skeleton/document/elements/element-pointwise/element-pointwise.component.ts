import {ChangeDetectorRef, Component, Input, OnInit, SimpleChanges} from '@angular/core';
import {DeviceDetectorService} from "ngx-device-detector";
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
import {Task} from "../../../../../models/task";
import {Object} from "aws-sdk/clients/customerprofiles";

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
    }


}
