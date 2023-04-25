import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
    ViewEncapsulation,
} from "@angular/core";
import { Subject } from "rxjs";

@Component({
    selector: "chat-input-url",
    templateUrl: "chat-input-url.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-url.component.css"],
})
export class ChatUrlInputComponent implements OnInit, OnChanges, OnDestroy {
    // @Input() public urlValueSubject: BehaviorSubject<string>;
    @Input() public readValue = new EventEmitter();
    @Output() public updateValue = new EventEmitter<string>();
    @Input() public urlPlaceholder!: string;
    public urlValue: string;
    @Input() public readOnly!: boolean;

    private readonly unsubscribeAll: Subject<void> = new Subject<void>();

    @ViewChild("urlValueInput", { static: true }) urlValueInput!: ElementRef;

    ngOnInit() {
        this.readValue.subscribe(() => {
            this.updateValue.emit(this.urlValue);
        });
    }

    ngOnChanges() {
        this.urlValue = this.urlPlaceholder;
        this.urlValueInput.nativeElement.disabled = this.readOnly;
    }

    ngOnDestroy(): void {
        this.unsubscribeAll.next();
        this.unsubscribeAll.complete();
    }
}
