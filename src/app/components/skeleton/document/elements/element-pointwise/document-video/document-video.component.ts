import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnInit,
    Output
} from '@angular/core';

@Component({
    selector: 'app-document-video',
    templateUrl: './document-video.component.html',
    styleUrls: ['./document-video.component.scss'],
    standalone: false
})
export class DocumentVideoComponent implements OnInit {
    /* #################### INPUTS #################### */
    @Input() src!: string;                  // Video source URL
    @Input() docIndex!: number;            // Index of the document
    @Input() attrName!: string;            // Attribute identifier
    @Input() portrait = false;             // Whether to apply portrait styles

    /* #################### OUTPUTS #################### */
    @Output() metadataLoaded = new EventEmitter<{
        docIndex: number;
        attrName: string;
        isPortrait: boolean;
        src: string;
    }>();

    /* #################### LOCAL FLAGS #################### */
    loaded = true;                         // Video element should always load immediately
    videoReady = false;                    // True when the video can play
    private emittedMetadata = false;       // Prevents multiple metadata emissions

    constructor(private elRef: ElementRef) {
    }

    ngOnInit(): void {
        // No lazy loading needed with CloudFront delivery
    }

    /** Emits video metadata when available (e.g. dimensions) */
    handleMetadata(video: HTMLVideoElement): void {
        if (this.emittedMetadata) return;
        this.emittedMetadata = true;

        const isPortrait = video.videoHeight > video.videoWidth;
        this.metadataLoaded.emit({
            docIndex: this.docIndex,
            attrName: this.attrName,
            isPortrait,
            src: this.src
        });
    }

    /** Called when the video is ready to play */
    onCanPlay(): void {
        this.videoReady = true;
    }
}
