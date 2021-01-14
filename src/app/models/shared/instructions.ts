/*
 * This class provides a representation of the general task instructions stored in the Amazon S3 bucket.
 * Each field of such instructions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Instruction {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  caption?: string;
  title?: string;
  steps: Array<string>;
  steps2: Array<string>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.caption = data['caption'] ? data["caption"] : null;
    this.title = data['title'] ? data["title"] : null

    this.steps = new Array<string>();
    for (const [_, step] of data["steps"].entries()) this.steps.push(step)

    this.steps2 = new Array<string>()
    for (const [_, step2] of data["steps2"].entries()) this.steps2.push(step2)
  }

}
