import { Component, OnInit, ViewChild } from "@angular/core";

import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Instruction } from "src/app/models/skeleton/instructions";

@Component({
    selector: "chat-instruction-modal",
    templateUrl: "chat-instruction-modal.component.html",

    styleUrls: ["./chat-instruction-modal.component.css"],
})
export class ChatInstructionModalComponent implements OnInit {
    public instruction: Instruction;

    constructor(public activeModal: NgbActiveModal) {}
    ngOnInit() {}
}
