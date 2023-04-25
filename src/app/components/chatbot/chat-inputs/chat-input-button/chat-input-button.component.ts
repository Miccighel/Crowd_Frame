import {
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-button",
    templateUrl: "chat-input-button.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-button.component.css"],
})
export class ChatInputButtonComponent implements OnInit {
    @Input() public text = "N.D";
    @Input() public value = "0";
    @Output() public send = new EventEmitter();

    ngOnInit() {}

    sendMessage() {
        const message = { label: this.text, value: this.value };

        this.send.emit(message);

        // invio il messaggio
    }
}
