import {
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-button",
    templateUrl: "chat-input-button.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-button.component.css"],
})
export class ChatInputButtonComponent {
    @Input() public text = "N.D";
    @Input() public value = "0";
    @Input() public emitCustomEvent = true;

    @Output() public send = new EventEmitter();

    sendMessage() {
        if (this.emitCustomEvent) {
            const message = { label: this.text, value: this.value };
            this.send.emit(message);
        }
    }
}
