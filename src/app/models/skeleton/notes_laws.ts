import {Note} from "./notes";

export class NoteLaws extends Note {

  year: number
  number: number
  type: String;
  withoutDetails: boolean;
  containsReferences: boolean;
  innerAnnotations: Array<NoteLaws>

  constructor(
    index: number,
    range: JSON,
    data: JSON,
    color = "#ffffff"
  ) {
    super(index, range, data, color)
    this.year = 0;
    this.number = 0;
    this.type = "reference";
    this.withoutDetails = false;
    this.containsReferences = true;
    this.innerAnnotations = [];
  }

}
