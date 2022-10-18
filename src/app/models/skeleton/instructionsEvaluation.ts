import {Instruction} from "./instructions";

export class InstructionEvaluation {

    general: Array<Instruction>
    element: Instruction;

    constructor(
        data: JSON
    ) {
        this.general = new Array<Instruction>()
        data['general'].forEach((instruction, index) => {
            this.general.push(new Instruction(index, instruction))
        });
        data['element'] ? this.element = new Instruction(0, data['element']) : this.element = null
    }

}
