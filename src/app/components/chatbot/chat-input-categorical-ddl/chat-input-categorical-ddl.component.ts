import {
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
    ViewEncapsulation,
} from "@angular/core";

@Component({
    selector: "chat-input-categorical-ddl",
    templateUrl: "chat-input-categorical-ddl.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-categorical-ddl.component.css"],
})
export class ChatInputCategoricalDDLComponent implements OnInit {
    @Input() public options: { label: string; value: any }[];
    @Input() public value = "0";

    @Input() public message = null;
    @Output() public send = new EventEmitter();
    public selected: { label: string; value: any } = {
        label: "test",
        value: null,
    };

    @Input() public readOnly!: boolean;

    ngOnInit() {}

    onSubmit() {
        this.message = this.selected;
        this.send.emit(this.message);
    }

    ngOnChanges() {
        this.selected = this.options[0];
    }
}
