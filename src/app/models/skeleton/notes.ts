import { Annotator } from "./settings";

export class Note {

  index: number;
  version: number;
  deleted: boolean;
  color: string;
  container_id: number;
  start_offset: number;
  end_offset: number;
  timestamp_created: number;
  timestamp_deleted?: number;
  baseURI: string;
  current_text: string
  option: string
  text_not_annotated_left: string
  text_not_annotated_right: string
  existing_notes: Array<String>

  annotator: Annotator;

  constructor(
    index: number,
    range: JSON,
    data: JSON,
    color = "#ffffff"
  ) {
    /* DO NOT REMOVE THIS LINE */
    this.index = index;
    this.version = 0
    this.deleted = false
    this.color = color
    this.container_id = range["commonAncestorContainer"]["id"]
    this.start_offset = parseInt(range["startOffset"])
    this.end_offset = parseInt(range["endOffset"])
    this.timestamp_created = parseInt(data[0]["dataset"]["timestamp"])
    this.timestamp_deleted = null
    this.baseURI = data[0]["baseURI"]
    this.current_text = data[0]["outerText"]
    this.option = "not_selected"
    if(range["endContainer"]) {
      if(range["endContainer"]["firstChild"])
        if(range["endContainer"]["firstChild"]["data"])
          this.text_not_annotated_left = range["endContainer"]["firstChild"]["data"]
      if(range["endContainer"]["lastChild"])
        if(range["endContainer"]["lastChild"]["data"])
          this.text_not_annotated_right = range["endContainer"]["lastChild"]["data"]
      if(range["endContainer"]["children"]) {
        this.existing_notes = new Array<String>()
        Array.from(range["endContainer"]["children"]).forEach((element: HTMLElement) => {
          if (element.innerText != this.current_text) {
            this.existing_notes.push(element.innerText)
          }
        });
      }
    }

  }

  public checkEquality(note: Note) {
    return (this.current_text == note.current_text)
  }

  public updateNote(data) {
    this.version = this.version + 1
  }

  public markDeleted() {
    this.deleted = true
  }

}
