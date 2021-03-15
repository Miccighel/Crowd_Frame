import { Annotator } from "./settings";

export class Note {

  index: number;
  version: number;
  timestamp_created: number;
  timestamp_deleted?: number;
  deleted: boolean;
  color: string;
  container_id: number;
  start_offset: number;
  end_offset: number;
  year: number
  number: number
  type: String;
  containsReferences: boolean;
  innerAnnotations: Array<Note>
  baseURI: string;
  current_text: string;
  text_not_annotated_left: string
  text_not_annotated_right: string
  existing_notes: Array<String>

  annotator: Annotator;

  constructor(
    index: number,
    range: JSON,
    data: JSON,
    color = "#ffff7b"
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;
    this.version = 0
    this.deleted = false
    this.color = color
    this.container_id = range["commonAncestorContainer"]["id"]
    this.start_offset = parseInt(range["startOffset"])
    this.end_offset = parseInt(range["endOffset"])
    this.baseURI = data[0]["baseURI"]
    this.current_text = data[0]["outerText"]
    this.timestamp_created = parseInt(data[0]["dataset"]["timestamp"])
    this.timestamp_deleted = null
    this.year = 0
    this.number = 0
    this.type = "reference"
    this.containsReferences = true
    this.innerAnnotations = []
    if (range["endContainer"]["firstChild"] != null) {
      this.text_not_annotated_left = range["endContainer"]["firstChild"]["data"]
    } else {
      this.text_not_annotated_left = ""
    }
    if (range["endContainer"]["lastChild"] != null) {
      this.text_not_annotated_right = range["endContainer"]["lastChild"]["data"]
    } else {
      this.text_not_annotated_right = ""
    }
    this.existing_notes = new Array<String>()
    /*
    Array.from(range["endContainer"]["children"]).forEach((element: HTMLElement) => {
      if (element.innerText != this.current_text) {
        this.existing_notes.push(element.innerText)
      }
    });
    */
  }

  public checkEquality(note: Note) {
    return (this.current_text == note.current_text)
  }

  public updateNote() {
    this.version = this.version + 1
  }

  public markDeleted() {
    this.deleted = true
  }

}
