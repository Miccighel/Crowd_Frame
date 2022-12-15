import {
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewEncapsulation,
} from "@angular/core";
import { MagnitudeDimensionInfo } from "src/app/models/conversational/common.model";

@Component({
    selector: "chat-input-magnitude",
    templateUrl: "chat-input-magnitude.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-magnitude.component.css"],
})
export class ChatInputMagnitudeComponent implements OnInit {
    public lowerBound = false;
    public value = 0;
    public min = 0;
    @Input() public magnitudeInfo: MagnitudeDimensionInfo = null;
    @Output() public send = new EventEmitter();

    ngOnInit() {
        if (!!this.magnitudeInfo) {
            this.lowerBound = this.magnitudeInfo.lowerBound;
            this.min = this.magnitudeInfo.min;
            this.value = this.magnitudeInfo.value ?? 0;
        }
    }

    sendMessage() {
        const message = this.value;

        this.send.emit(message);
    }
}
