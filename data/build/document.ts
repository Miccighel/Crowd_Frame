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
  text: string;
  adr_spans: Array<JSON>;
  adr_texts: Array<JSON>;
  drug_spans: Array<JSON>;
  drug_texts: Array<JSON>;
  url: string;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.id = data['id']
    this.text = data["text"];
    this.adr_spans = new Array<JSON>();
    for (let index = 0; index < data["adr_spans"].length; index++) this.adr_spans.push(data["adr_spans"][index])
    this.adr_texts = new Array<JSON>();
    for (let index = 0; index < data["adr_text"].length; index++) this.adr_texts.push(data["adr_text"][index])
    this.drug_spans = new Array<JSON>();
    for (let index = 0; index < data["drug_spans"].length; index++) this.drug_spans.push(data["drug_spans"][index])
    this.drug_texts = new Array<JSON>();
    for (let index = 0; index < data["drug_text"].length; index++) this.drug_texts.push(data["drug_text"][index])

    this.url = data["url"];
  }

}
