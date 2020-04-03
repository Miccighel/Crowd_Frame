/*
 * This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
 * The attribute <index> is additional and should no be touched and passed in the constructor.
 * Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.
 * Take care also in providing an implementation of the function; it is used to define if a document represents the high and low gold question.
 */
export class Document {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  id_par: string;
  name_unique: string;
  statement: string;
  speaker: string;
  job: string;
  context: string;
  year: string;
  party: string;
  source: string;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index =        index;

    this.id_par =       data["id_par"];
    this.name_unique =  data["name_unique"];
    this.statement =    data["statement"];
    this.speaker =      data["speaker"];
    this.job =          data["job"];
    this.context =      data["context"];
    this.year =         data["year"];
    this.party =        data["party"];
    this.source =       data["source"];
  }

  /*
   * This function determines if the current document is a gold question.
   * Possible values for the parameter: HIGH or LOW. (CAPS LOCK MANDATORY).
   * In this case, for example, if the id_par field is HIGH (LOW) then
   * the document is the HIGH (LOW) gold question
   */
  public getGoldQuestionIndex(kind: string) {
    if (this.id_par == kind) return this.index
  }

}
