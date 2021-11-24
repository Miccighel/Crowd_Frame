import {Annotator} from "../settingsTask";

export abstract class Note {

  document_index: number;
  attribute_index: number;
  version: number;
  deleted: boolean;
  ignored: boolean;
  color: string;
  container_id: number;
  index_start: number;
  index_end: number;
  timestamp_created: number;
  timestamp_deleted?: number;
  base_uri: string;
  current_text: string
  raw_text: string
  option: string
  text_left: string
  text_right: string
  existing_notes: Array<String>

  annotator: Annotator;

  constructor(
    document_index: number,
    attribute_index: number,
    range: JSON,
    data: JSON,
    color = "#ffffff"
  ) {

    this.document_index = document_index;
    this.attribute_index = attribute_index;
    this.deleted = false
    this.ignored = false
    this.color = color
    this.container_id = range["commonAncestorContainer"]["id"]
    this.index_start = 0
    this.index_end = 0
    this.timestamp_created = parseInt(data[0]["dataset"]["timestamp"])
    this.timestamp_deleted = 0
    this.base_uri = data[0]["baseURI"]
    this.current_text = data[0]["outerText"]
    this.raw_text = this.removeSpecialChars()
    this.option = "not_selected"
    this.text_left = ""
    this.text_right = ""
    this.existing_notes = Array<String>()
    let pieces = []
    if (range["endContainer"]) {
      Array.from(range["endContainer"]["childNodes"]).forEach((element: HTMLElement) => {
        if (element.childNodes.length > 0) {
          for (let i = 0; i < element.childNodes.length; i++) {
            let childElement: ChildNode = element.childNodes[i]
            let timestampCreated = parseInt(childElement.parentElement.getAttribute("data-timestamp"))
            if (this.timestamp_created == timestampCreated) {
              for (let piece of pieces) this.text_left = this.text_left.concat(piece)
              pieces = []
            } else {
              this.existing_notes.push(childElement.textContent)
              pieces.push(childElement.textContent)
            }
          }
        } else {
          pieces.push(element.textContent)
        }
      })
      for (let piece of pieces) this.text_right = this.text_right.concat(piece)
    }
    this.index_start = this.text_left.length
    this.index_end = this.text_left.length + this.current_text.length

  }

  public updateNote() {
    this.version = this.version + 1
  }

  public markDeleted() {
    this.deleted = true
  }

  public removeSpecialChars () {
    let raw_string = this.current_text;
    raw_string = raw_string.replace(/\n|\r/g, " ");
    raw_string = raw_string.replace(/[^a-zA-Z0-9,.'()\[\] ]/g, "");
    let raw_string_single_whitespaces: string = "";
    for (let c = 0; c < raw_string.length; c++) {
      if (c > 0) {
        if (raw_string.charAt(c - 1) == " ") {
          if (raw_string.charAt(c) != " ") {
            raw_string_single_whitespaces += raw_string.charAt(c)
          }
        } else {
          raw_string_single_whitespaces += raw_string.charAt(c)
        }
      } else {
        raw_string_single_whitespaces += raw_string.charAt(c)
      }
    }
    return raw_string_single_whitespaces
  }
}
