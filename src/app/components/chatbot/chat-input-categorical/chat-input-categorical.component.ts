import {
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-categorical",
    templateUrl: "chat-input-categorical.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-categorical.component.css"],
})
export class ChatInputCategorialComponent implements OnInit {
    @Input() public text = "N.D";
    @Input() public value = "0";
    @Output() public send = new EventEmitter();

    ngOnInit() {}

    buttonInput() {
        const message = this.value;

        if (!!message.trim()) {
            return;
        } else {
            this.send.emit(message);
        }
        // invio il messaggio
    }
}
