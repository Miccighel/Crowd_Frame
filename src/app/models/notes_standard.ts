import {Note} from "./notes";

export class NoteStandard extends Note {

  constructor(
    index: number,
    range: JSON,
    data: JSON,
    color = "#ffffff"
  ) {
    super(index, range, data, color)
  }

}
