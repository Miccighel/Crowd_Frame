/*
 * This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
 * The attribute <document_index> is additional and should not be touched and passed in the constructor.
 * Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */

export class Document {

  /* DO NOT REMOVE THESE ATTRIBUTE */
  index: number;
  countdownExpired: boolean;

  id: string;
  name: string;
  statement: string;
  claimant: string;
  date: string;
  originated_from: string;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.id = data['id_par']
    this.name = data["name"];
    this.statement = data["statement"];
    this.claimant = data["claimant"];
    this.originated_from = data["originated-from"];

  }

}
