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

  article_id: string;
  article_number: string;
  type: string;
  title: string;
  subject: string;
  article_text: string;
  number: string;
  year: string;
  editorial_code: string;
  gazette_reference: string;
  publication_date: string;
  gazette_date: string;
  valid_from: string;
  last_updated: string;
  link_gazette: string;
  link_urn_nir: string;
  link_eli_id: string;
  link_eli_type: string;
  /* law_quotes: string;
  law_years: Number;
  law_numbers: Number;
  inner_law_quotes: [[String]];
  inner_law_years: [[number]];
  inner_law_numbers: [[number]]; */

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index =          index;

    this.article_id =             data["article_id"];
    this.article_number =         this.articleNumber();
    this.type =                   data["type"];
    this.title =                  data["title"];
    this.subject =                data["subject"];
    this.article_text =           data["article_text"];
    this.number =                 data["number"];
    this.year =                   data["year"];
    this.editorial_code =         data["editorial_code"];
    this.gazette_reference =      data["gazette_reference"];
    this.publication_date =       data["publication_date"];
    this.gazette_date =           data["gazette_date"];
    this.valid_from =             data["valid_from"];
    this.last_updated =           data["last_updated"];
    this.link_gazette =           data["link_gazette"];
    this.link_urn_nir =           data["link_urn_nir"];
    this.link_eli_id =            data["link_eli_id"];
    this.link_eli_type =          data["link_eli_type"];
    /* this.law_quotes =     data["law_quote"];
    this.law_years =      data["law_year"];
    this.law_numbers =    data["law_number"];
    this.inner_law_quotes = data["inner_law_quotes"];
    this.inner_law_years = data["inner_law_years"];
    this.inner_law_numbers = data["inner_law_numbers"]; */
  }

  /*
   * This function determines if the current document is a gold question.
   * Possible values for the parameter: HIGH or LOW. (CAPS LOCK MANDATORY).
   * In this case, for example, if the id_par field is HIGH (LOW) then
   * the document is the HIGH (LOW) gold question
   */

  public articleNumber() {
    var art_id = this.article_id;
    if (art_id.charAt(5) != "_") {
      return art_id.substr(4,2)
    } else {
      return art_id.charAt(4)
    }
  }

  public getGoldQuestionIndex() {
    /* if (this.id.includes("GOLD")) {
      return this.index
    } else {
      return null
    }
    */
   return null
  }

}
