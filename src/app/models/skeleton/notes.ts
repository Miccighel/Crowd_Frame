import { Annotator } from "./settings";

export class Note {

  index: number;
  version: number;
  timestamp_created: number;
  timestamp_deleted?: number;
  deleted: boolean;
  color: string;

  range: Object
  data: Object

  quote: string

  option: string

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
    this.range = range
    this.color = color
    this.data = data
    this.timestamp_created = parseInt(data[0]["dataset"]["timestamp"])
    this.timestamp_deleted = null
    this.quote = data[0]["outerText"]
    this.option = "not_selected"
  }

  public checkEquality(note: Note) {
    return (this.quote == note.quote)
  }

  public updateNote(data) {
    this.version = this.version + 1
  }

  public markDeleted() {
    this.deleted = true
  }

}
