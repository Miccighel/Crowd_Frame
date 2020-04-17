/*
 * This class provides a representation of a single dimension which must be asked to each worker stored in the Amazon S3 bucket.
 * Each field of such dimensions must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Dimension {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  name: string;
  description: string;
  justification: boolean;
  url: boolean;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.name =           data["name"];
    this.description =    data["description"];
    this.justification =  data["justification"];
    this.url =            data["url"]
  }

}
