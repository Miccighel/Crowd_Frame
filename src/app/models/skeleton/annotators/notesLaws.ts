import {Note} from "./notes";

export class NoteLaws extends Note {

  year: number
  number: number
  type: String;
  withoutDetails: boolean;
  containsReferences: boolean;
  innerAnnotations: Array<NoteLaws>

  constructor(
    document_index: number,
    attribute_index: number,
    range: JSON,
    data: JSON,
    serialization: string,
    color = "#ffffff"
  ) {
    super(document_index, attribute_index, range, data, serialization, color)
    this.year = 0;
    this.number = 0;
    this.type = "reference";
    this.withoutDetails = false;
    this.containsReferences = true;
    this.innerAnnotations = [];
  }

  public restoreData(previousData: Object) {
    super.restoreData(previousData)
    this.year = parseInt(previousData['year'])
    this.number = parseInt(previousData['number'])
    this.type = previousData['type']
    this.withoutDetails = JSON.parse(previousData['withoutDetails'])
    this.containsReferences = JSON.parse(previousData['containsReferences'])
    this.innerAnnotations = previousData['innerAnnotations']
  }

}
