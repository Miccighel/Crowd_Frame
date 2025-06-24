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
    SimpleChanges,
} from "@angular/core";
import { Subject } from "rxjs";

@Component({
    selector: "chat-input-url",
    templateUrl: "chat-input-url.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-url.component.css"],
    standalone: false
})
export class ChatUrlInputComponent implements OnInit, OnChanges, OnDestroy {
    @ViewChild("urlValueInput", { static: true }) urlValueInput!: ElementRef;
    @Input() public readValue = new EventEmitter();
    @Output() public updateValue = new EventEmitter<string>();
    @Input() public urlToRead!: string;
    @Input() public readOnly!: boolean;

    private readonly unsubscribeAll: Subject<void> = new Subject<void>();
    public urlValue: string;

    ngOnInit() {
        this.readValue.subscribe(() => {
            this.updateValue.emit(this.urlValue);
        });
    }
    ngOnChanges(changes: SimpleChanges) {
        this.urlValue = changes.urlToRead.currentValue;
        this.urlValueInput.nativeElement.disabled = this.readOnly;
    }

    ngOnDestroy(): void {
        this.unsubscribeAll.next();
        this.unsubscribeAll.complete();
    }
}
