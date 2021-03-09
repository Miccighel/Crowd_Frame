import {Note} from "../../src/app/models/skeleton/notes";
import {Dimension} from "../../src/app/models/skeleton/dimension";

export class GoldChecker {

  static performGoldElementsCheck(

    documentsGold: Array<Document>,
    dimensionsGold: Array<Dimension>,
    selectedValuesGold: Array<Object>,
    notesGold: Array<Note>,

  ) {

    let goldChecks = new Array<boolean>()
    goldChecks.push(true)

    return goldChecks

  }

}
