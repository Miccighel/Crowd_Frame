import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from "@angular/core";
@Component({
    selector: "chat-input-text",
    templateUrl: "chat-input-text.component.html",
    styleUrls: ["./chat-input-text.component.scss"],
    standalone: false
})
export class ChatInputTextComponent {
    @Output() public send = new EventEmitter();
    @Input() public pholder!: string;
    @Input() public readOnly!: boolean;
    @Input() public canSend: boolean = true;

    @ViewChild("message", { static: true }) message!: ElementRef;
    @ViewChild("buttons") buttons!: ElementRef;

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

    ngOnChanges() {

        this.message.nativeElement.disabled = this.readOnly;
        if (this.pholder) {
            this.message.nativeElement.value = this.pholder;
            this.message.nativeElement.focus();
        }
    }
}
