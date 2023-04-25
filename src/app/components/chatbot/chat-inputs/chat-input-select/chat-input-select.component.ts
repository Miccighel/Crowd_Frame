import {
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-select",
    templateUrl: "chat-input-select.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-select.component.css"],
})
export class ChatInputSelectComponent {
    @Input() public options: { label: string; value: any }[];
    @Input() public readOnly!: boolean;
    @Output() public send = new EventEmitter();
    public selected: { label: string; value: any } = {
        label: null,
        value: null,
    };

    onSubmit() {
        const message = this.selected;
        this.send.emit({ message });
    }

    ngOnChanges() {
        this.selected = this.options[0];
    }
}
