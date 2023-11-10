import {BaseInstruction} from "./baseInstruction";
export class EvaluationInstruction {

    instructions: Array<BaseInstruction>
    element: BaseInstruction;

    constructor(
        data = null as JSON
    ) {
        this.instructions = new Array<BaseInstruction>()
        if (data) {
            if ('instructions' in data) {
                let instructions = data['instructions'] as Array<JSON>
                instructions.forEach((instruction, index) => {
                    this.instructions.push(new BaseInstruction(index, instruction))
                });
            }
        }
        data ? data['element'] ? this.element = new BaseInstruction(0, data['element']) : null : null
    }

}
