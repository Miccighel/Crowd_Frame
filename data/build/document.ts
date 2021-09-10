/*
 * This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
 * The attribute <document_index> is additional and should not be touched and passed in the constructor.
 * Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.
 */

export class Document {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;
  countdownExpired: boolean;

  id: string;
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

  /* ATTRIBUTES FOR GOLD QUESTIONS CHECK */

  gold_type: string[];
  gold_text: string[];
  gold_number: number[];
  gold_year: number[];
  gold_inner_notes: Array<Array<Array<number>>>;
  gold_inner_texts: Array<Array<string>>;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index =          index;

    this.id =                     data["article_id"];
    this.article_number =         data["article_number"];
    this.type =                   data["type"];
    this.title =                  data["title"];
    this.subject =                data["subject"];
    this.article_text =           data["article_text"][0];
    this.article_text = this.article_text.replace(/  +/g, ' ');
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
    
    if (this.id.includes("GOLD")) {
      this.gold_type = data["gold_type"];
      this.gold_text = data["gold_text"];
      this.gold_number = data["gold_number"];
      this.gold_year = data["gold_year"];
      this.gold_inner_notes = data["gold_inner_notes"];
      this.gold_inner_texts = data["gold_inner_texts"];
    }
  }

}

export class Span {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;

  start: number;
  end: number;
  text: string;

  constructor(
    index: number,
    data: JSON
  ) {
    this.start = data["start"]
    this.end = data["end"]
    this.text = data["text"].trim()
  }

}
