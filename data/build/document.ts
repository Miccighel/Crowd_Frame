/*
 * This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
 * The attribute <document_index> is additional and should not be touched and passed in the constructor.
 * Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.
 * Take care also in providing an implementation of the function; it is used to define if a document represents the high and low gold question.
 */
import {Mapping} from "../../src/app/models/skeleton/dimension";

export class Document {

  /* DO NOT REMOVE THIS ATTRIBUTE */
  index: number;
  countdownExpired: boolean;

  id: string;
  text: string;
  adr_spans: Array<Span>;
  adr_texts: Array<string>;
  drug_spans: Array<Span>;
  drug_texts: Array<string>;
  url: string;

  constructor(
    index: number,
    data: JSON
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;

    this.id = data['id']
    this.text = data["text"];
    this.adr_spans = new Array<Span>();
    for (let index = 0; index < data["adr_spans"].length; index++) this.adr_spans.push(new Span(index, data["adr_spans"][index]))
    this.adr_texts = new Array<string>();
    for (let index = 0; index < data["adr_text"].length; index++) this.adr_texts.push(data["adr_text"][index])
    this.drug_spans = new Array<Span>();
    for (let index = 0; index < data["drug_spans"].length; index++) this.drug_spans.push(new Span(index, data["drug_spans"][index]))
    this.drug_texts = new Array<string>();
    for (let index = 0; index < data["drug_text"].length; index++) this.drug_texts.push(data["drug_text"][index])

    this.url = data["url"];
  }

  public getGoldQuestionIndex(kind: string) {
    if (this.id.includes(kind)) {
      return this.index
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
