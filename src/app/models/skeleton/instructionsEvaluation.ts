import {Instruction} from "./instructions";

export class InstructionEvaluation {

    general: Array<Instruction>
    element: Instruction;
    url: Instruction;
    scale: Instruction;

    constructor(
        data: JSON
    ) {
        this.general = new Array<Instruction>()
        data['general'].forEach((instruction, index) => {
            this.general.push(new Instruction(index, instruction))
        });
        data['element'] ? this.element = new Instruction(0, data['element']) : this.element = null
        data['url'] ? this.url = new Instruction(0, data['url']) : this.url = null
        data['scale'] ? this.scale = new Instruction(0, data['scale']) : this.scale = null
    }

}
