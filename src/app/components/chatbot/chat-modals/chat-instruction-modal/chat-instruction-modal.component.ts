import { Component, OnInit } from "@angular/core";

import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Instruction } from "src/app/models/skeleton/instructions";
import { InstructionEvaluation } from "src/app/models/skeleton/instructionsEvaluation";

@Component({
    selector: "chat-instruction-modal",
    templateUrl: "chat-instruction-modal.component.html",

    styleUrls: ["./chat-instruction-modal.component.css"],
})
export class ChatInstructionModalComponent {
    public instructions: Instruction[];
    public instructionsEvaluation: InstructionEvaluation;

    constructor(public activeModal: NgbActiveModal) {}
}
