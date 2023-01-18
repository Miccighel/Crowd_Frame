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
import { BehaviorSubject, Observable, Subject, takeUntil } from "rxjs";

@Component({
    selector: "chat-url-input",
    templateUrl: "chat-url-input.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-url-input.component.css"],
})
export class ChatUrlInputComponent implements OnInit, OnChanges, OnDestroy {
    @Input() public urlValueSubject: BehaviorSubject<string>;
    @Input() public urlPlaceHolder: string;
    @Input() public readonly!: boolean;
    public urlValue: string;
    public urlValue$: Observable<string>;
    private readonly unsubscribeAll: Subject<void> = new Subject<void>();

    @ViewChild("urlValueInput", { static: true }) urlValueInput!: ElementRef;

    ngOnInit() {
        this.urlValue$ = this.urlValueSubject.asObservable();
        this.urlValue$
            .pipe(takeUntil(this.unsubscribeAll))
            .subscribe((value) => {
                this.urlValue = value;
            });
    }

    ngOnChanges() {
        this.urlValueInput.nativeElement.disabled = this.readonly;
    }

    ngOnDestroy(): void {
        this.unsubscribeAll.next();
        this.unsubscribeAll.complete();
    }
}
