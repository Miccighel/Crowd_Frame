import {
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-ddl",
    templateUrl: "chat-input-ddl.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-ddl.component.css"],
})
export class ChatInputDropdownComponent {
    @Input() public options: { label: string; value: any }[];
    @Input() public value = "0";
    @Input() public readOnly!: boolean;
    @Input() public message = null;
    @Output() public send = new EventEmitter();
    public selected: { label: string; value: any } = {
        label: "test",
        value: null,
    };

    onSubmit() {
        this.message = this.selected;
        this.send.emit(this.message);
    }

    ngOnChanges() {
        this.selected = this.options[0];
    }
}
