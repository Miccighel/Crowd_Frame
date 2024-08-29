/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
/* Services */
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
import {DeviceDetectorService} from "ngx-device-detector";
/* Models */
import {Task} from "../../../../../models/skeleton/task";
import {AttributeMain, AttributePost} from "../../../../../models/skeleton/taskSettings";

@Component({
    selector: 'app-element-pointwise',
    templateUrl: './element-pointwise.component.html',
    styleUrls: ['./element-pointwise.component.scss', '../../document.component.scss']
})

export class ElementPointwiseComponent implements OnInit {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    /* #################### INPUTS #################### */

    @Input() documentIndex: number
    @Input() postAssessment: boolean
    @Input() postAssessmentIndex: number
    @Input() initialAssessmentFormInteraction: boolean

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task
    attributeForPostAssessment: AttributePost
    followingAssessmentAllowed: boolean
    hasNonVideos : boolean

    /* #################### EMITTERS #################### */

    @Output() followingAssessmentAllowedEmitter: EventEmitter<Object>;

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
        this.hasNonVideos = this.task.settings.attributesMain.some(attr => !attr.is_video)
    }

    ngOnInit() {
        this.attributeForPostAssessment = this.task.getAttributeForPostAssessmentStep(this.postAssessmentIndex - 1)
        if (this.postAssessment) {
            this.followingAssessmentAllowed = this.task.followingAssessmentAllowed[this.documentIndex][this.postAssessmentIndex]
        }
        let mostRecentAnswersForPostAssessment = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, this.postAssessmentIndex - 1)
        if (Object.keys(mostRecentAnswersForPostAssessment).length > 0) {
            this.unlockNextRepetition(this.followingAssessmentAllowed)
        }
        if (this.postAssessmentIndex == 1) {
            if (Object.keys(this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, 1)).length > 0) {
                this.unlockNextRepetition(this.followingAssessmentAllowed)
            }
        }
    }

    public unlockNextRepetition(value: boolean) {
        this.followingAssessmentAllowed = true
        this.followingAssessmentAllowedEmitter.emit({
            "postAssessmentIndex": this.postAssessmentIndex - 1,
            "followingAssessmentAllowed": this.followingAssessmentAllowed
        });
    }

    public isAttributeVideo(attr: AttributeMain){
        return attr.is_video;
    }


}
