/*
 * This class provides a representation of a single mapping of the dimension which must be asked to each worker stored in the Amazon S3 bucket.
 * Each field of such mapping must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */
export class Mapping {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  label: string;
  description: string;
  value: string;


  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.label =          data["label"];
    this.description =    data["description"];
    this.value =          data["value"];

  }

}
