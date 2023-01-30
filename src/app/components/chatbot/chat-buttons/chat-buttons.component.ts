import { I } from "@angular/cdk/keycodes";
import {
    Component,
    OnInit,
    Input,
    Output,
    ViewChild,
    ElementRef,
    EventEmitter,
} from "@angular/core";

@Component({
    selector: "app-chat-buttons",
    templateUrl: "./chat-buttons.component.html",
    styleUrls: ["./chat-buttons.component.scss"],
})
export class ChatButtonsComponent implements OnInit {
    @Output() public send = new EventEmitter();
    @ViewChild("buttons") buttons!: ElementRef;

    constructor() {}

    ngOnInit(): void {
        this.buttons.nativeElement.style.display = "none";
    }

    onSubmitButton(button: boolean) {
        // prendo il msg, se è vuoto non faccio nulla
        let message = "";
        if (button) {
            message = "Yes";
        } else {
            message = "No";
        }
        // invio il messaggio
        this.send.emit({ message });
    }
}
