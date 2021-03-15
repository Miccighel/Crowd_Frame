/*
 * This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
 * The attribute <index> is additional and should not be touched and passed in the constructor.
 * Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.
 * Take care also in providing an implementation of the function; it is used to define if a document represents the high and low gold question.
 */
export class Document {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;
  countdownExpired: boolean;

  id: string;
  text: string;
  law_quotes: string;
  law_years: Number;
  law_numbers: Number;
  inner_law_quotes: [[String]];
  inner_law_years: [[number]];
  inner_law_numbers: [[number]];

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index =          index;

    this.id =             data["id"]
    this.text =           data["text"];
    this.law_quotes =     data["law_quote"];
    this.law_years =      data["law_year"];
    this.law_numbers =    data["law_number"];
    this.inner_law_quotes = data["inner_law_quotes"];
    this.inner_law_years = data["inner_law_years"];
    this.inner_law_numbers = data["inner_law_numbers"];
  }

  /*
   * This function determines if the current document is a gold question.
   * Possible values for the parameter: HIGH or LOW. (CAPS LOCK MANDATORY).
   * In this case, for example, if the id_par field is HIGH (LOW) then
   * the document is the HIGH (LOW) gold question
   */
  public getGoldQuestionIndex() {
    if (this.id.includes("GOLD")) {
      return this.index
    } else {
      return null
    }
  }

}
