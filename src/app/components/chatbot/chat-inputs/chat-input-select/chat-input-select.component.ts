import {
    Component,
    EventEmitter,
    Input,
    Output,
    ViewEncapsulation, OnInit
} from "@angular/core";

@Component({
    selector: "chat-input-select",
    templateUrl: "chat-input-select.component.html",
    encapsulation: ViewEncapsulation.None,
    styleUrls: ["./chat-input-select.component.css"],
    standalone: false
})
export class ChatInputSelectComponent implements OnInit {
    @Input() public options: { label: string; value: any }[];
    @Input() public readOnly!: boolean;
    @Output() public send = new EventEmitter();
    public selected: { label: string; value: any } | undefined;
    public inputComponent;

    onSubmit() {
        const message = this.selected;
        this.send.emit({ message });
    }
    ngOnInit() {
        this.inputComponent = document.getElementById("select-component");
        this.inputComponent.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                this.onSubmit()
            }
        });
    }

}
