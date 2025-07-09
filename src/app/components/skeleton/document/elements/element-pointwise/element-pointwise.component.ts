/* Core */
import {
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnInit,
    Output, SimpleChanges, ViewChild
} from '@angular/core';

/* Services */
import {SectionService} from '../../../../../services/section.service';
import {UtilsService} from '../../../../../services/utils.service';
import {DeviceDetectorService} from 'ngx-device-detector';

/* Compoonents */
import {DocumentVideoComponent} from './document-video/document-video.component';

/* Models */
import {Task} from '../../../../../models/skeleton/task';
import {AttributeMain, AttributePost} from '../../../../../models/skeleton/taskSettings';
import {Worker} from '../../../../../models/worker/worker';


@Component({
    selector: 'app-element-pointwise',
    templateUrl: './element-pointwise.component.html',
    styleUrls: ['./element-pointwise.component.scss', '../../document.component.scss'],
    standalone: false
})
export class ElementPointwiseComponent implements OnInit {
    /* #################### SERVICES & CORE STUFF #################### */
    changeDetector: ChangeDetectorRef;
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService;

    /* #################### INPUTS #################### */
    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() postAssessment: boolean;
    @Input() postAssessmentIndex: number;
    @Input() initialAssessmentFormInteraction: boolean;
    @Input() navigationSignal: { action: 'Next' | 'Back' | 'Finish', trigger: number };


    /* #################### LOCAL ATTRIBUTES #################### */
    task: Task;
    attributeForPostAssessment: AttributePost;
    followingAssessmentAllowed: boolean;
    hasNonVideos: boolean;
    isPortraitVideo: { [key: string]: boolean } = {};
    @ViewChild('container', {static: true}) container!: ElementRef;

    /* #################### EMITTERS #################### */
    @Output() followingAssessmentAllowedEmitter: EventEmitter<Object>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        private elementRef: ElementRef
    ) {
        this.changeDetector = changeDetector;
        this.deviceDetectorService = deviceDetectorService;
        this.sectionService = sectionService;
        this.utilsService = utilsService;
        this.task = sectionService.task;
        this.followingAssessmentAllowedEmitter = new EventEmitter<boolean>();
        this.hasNonVideos = this.task.settings.attributesMain.some(attr => !attr.is_video);
    }

    ngOnInit(): void {
        console.log("Loaded attributes:", this.task.settings.attributesMain);

        this.attributeForPostAssessment = this.task.getAttributeForPostAssessmentStep(this.postAssessmentIndex - 1);

        if (this.postAssessment) {
            this.followingAssessmentAllowed = this.task.followingAssessmentAllowed[this.documentIndex][this.postAssessmentIndex];
        }

        const mostRecentAnswers = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, this.postAssessmentIndex - 1);
        if (Object.keys(mostRecentAnswers).length > 0) {
            this.unlockNextRepetition(this.followingAssessmentAllowed);
        }

        if (this.postAssessmentIndex === 1) {
            const secondAnswers = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, 1);
            if (Object.keys(secondAnswers).length > 0) {
                this.unlockNextRepetition(this.followingAssessmentAllowed);
            }
        }

    }

    public unlockNextRepetition(value: boolean): void {
        this.followingAssessmentAllowed = true;
        this.followingAssessmentAllowedEmitter.emit({
            postAssessmentIndex: this.postAssessmentIndex - 1,
            followingAssessmentAllowed: this.followingAssessmentAllowed
        });
    }

    public isAttributeVideo(attr: AttributeMain): boolean {
        return attr.is_video;
    }

    public hasRenderableNonVideoAttributes(documentIndex: number): boolean {
        return this.task.settings.attributesMain
            .filter(attr => !attr.is_video)
            .some(attr =>
                this.task.checkCurrentTaskType(this.task.documents[documentIndex], attr.show)
            );
    }

    public onVideoMetadataLoadedFromChild(event: {
        docIndex: number;
        attrName: string;
        isPortrait: boolean;
        src: string;
    }): void {
        const key = `${event.docIndex}-${event.attrName}`;
        this.isPortraitVideo[key] = event.isPortrait;

        if (event.isPortrait) {
            const wrapper = this.elementRef.nativeElement.querySelector(
                `[data-video-key="${key}"]`
            )?.closest('.video-wrapper') as HTMLElement;

            if (wrapper) {
                wrapper.style.setProperty('--bg-url', `url('${event.src}')`);
            }
        }
    }


}
