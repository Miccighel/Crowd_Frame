/*
 * This class provides a representation of the general task instructions stored in the Amazon S3 bucket.
 * Each field of such instructions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Instruction {

  caption: string;
  steps: Array<string>;

  constructor(
    data: JSON
  ) {
    this.caption =    data["caption"];
    this.steps = new Array<string>();
    for (const [_, step] of data["steps"].entries()) this.steps.push(step)
  }

}
