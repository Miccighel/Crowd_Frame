import {
    Component,
    EventEmitter,
    ElementRef,
    Input,
    OnInit,
    ViewChild,
    Output,
    ViewEncapsulation,
} from "@angular/core";
import { MagnitudeDimensionInfo } from "src/app/models/conversational/common.model";

@Component({
    selector: "chat-input-magnitude",
    templateUrl: "chat-input-magnitude.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-magnitude.component.css"],
    standalone: false
})
export class ChatInputMagnitudeComponent implements OnInit {
    public lowerBound = false;
    public value = 0;
    public min = 0;
    @Input() public magnitudeInfo: MagnitudeDimensionInfo = null;
    @ViewChild("message", { static: true }) message!: ElementRef;
    @Output() public send = new EventEmitter();
    @Input() public readOnly!: boolean;

    ngOnInit() {
        if (!!this.magnitudeInfo) {
            this.lowerBound = this.magnitudeInfo.lowerBound;
            this.min = this.magnitudeInfo.min;
            this.value = this.magnitudeInfo.value ?? 0;
        }
    }
    public getMessage() {
        return this.message.nativeElement.value;
    }

    public clearMessage() {
        this.message.nativeElement.value = "";
    }

    onSubmit() {
        const message = this.getMessage();
        if (message.trim() === "") {
            return;
        }
        this.send.emit({ message });
        this.clearMessage();
    }
}
