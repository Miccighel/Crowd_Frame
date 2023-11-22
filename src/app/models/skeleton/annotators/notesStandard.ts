import {Note} from "./notes";

export class NoteStandard extends Note {

  constructor(
    document_index: number,
    attribute_index: number,
    range: JSON,
    data: JSON,
    serialization: string,
    color = "#ffffff",
  ) {
    super(document_index, attribute_index, range, data, serialization, color)
  }

}
