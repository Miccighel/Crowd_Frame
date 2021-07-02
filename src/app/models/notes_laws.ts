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
