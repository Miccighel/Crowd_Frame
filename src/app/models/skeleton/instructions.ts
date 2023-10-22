/*
 * This class provides a representation of the general task instructions stored in the Amazon S3 bucket.
 * Each field of such instructions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Instruction {

    /* DO NOT REMOVE THIS ATTRIBUTE */
    index: number;
    caption?: string;
    label?: string;
    text: string;
    task_type: Array<string>;

    constructor(
        index: number,
        data: JSON
    ) {
        /* DO NOT REMOVE THIS LINE */
        this.index = index;
        this.label = data['label'] ? data["label"] : null;
        this.caption = data['caption'] ? data["caption"] : null;
        if (data['steps']) {
            let stepText: Array<string> = data['steps']
            this.text = stepText.join("\r\n")
            delete data['steps']
        } else {
            this.text = data['text'] ? data["text"] : null;
        }
        this.task_type = data['task_type'] ? data["task_type"] : null;
    }

}
