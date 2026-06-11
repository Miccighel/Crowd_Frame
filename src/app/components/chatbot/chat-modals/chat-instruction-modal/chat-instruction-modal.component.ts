import { Component, ChangeDetectionStrategy } from "@angular/core";

import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { BaseInstruction } from "app/models/skeleton/instructions/baseInstruction";
import { EvaluationInstruction } from "app/models/skeleton/instructions/evaluationInstruction";

@Component({
    selector: "chat-instruction-modal",
    templateUrl: "chat-instruction-modal.component.html",
    styleUrls: ["./chat-instruction-modal.component.css"],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ChatInstructionModalComponent {
    public instructions: BaseInstruction[];
    public instructionsEvaluation: EvaluationInstruction;

    constructor(public activeModal: NgbActiveModal) {}
}
