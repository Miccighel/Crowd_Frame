import {Instruction} from "./instructions";

export class InstructionEvaluation {

    instructions: Array<Instruction>
    element: Instruction;

    constructor(
        data = null as JSON
    ) {
        this.instructions = new Array<Instruction>()
        if (data) {
            if ('instructions' in data) {
                let instructions = data['instructions'] as Array<JSON>
                instructions.forEach((instruction, index) => {
                    this.instructions.push(new Instruction(index, instruction))
                });
            }
        }
        data ? data['element'] ? this.element = new Instruction(0, data['element']) : null : null
    }

}
