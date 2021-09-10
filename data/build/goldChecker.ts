/*
 * This class provides a stub to implement the gold elements check. If there are no gold elements, the check is considered true automatically.
 * The following codes provides answers, notes and attributes for each gold element. Those three corresponding data structures should be used
 * to implement the check.
 */
import {NoteLaws} from "../../src/app/models/skeleton/notes_laws";

export class GoldChecker {

  static performGoldCheck(goldConfiguration : Array<Object>) {

    let goldChecks = new Array<boolean>()

    /* If there are no gold elements there is nothing to be checked */
    if(goldConfiguration.length<=0) {
      goldChecks.push(true)
      return goldChecks
    }

    for (let goldElement of goldConfiguration) {

      /* Element attributes */
      let document = goldElement["document"]
      /* Worker's answers for each gold dimensions */
      let answers = goldElement["answers"]
      /* Worker's notes*/
      let notes = goldElement["notes"]

      let goldCheck = false

      /* CONTROL IMPLEMENTATION STARTS HERE */
      /* Write your code; the check for the current element holds if goldCheck is set to true */

      var goldNotesArray: goldNote[] = [];

      for (var p = 0; p < document.gold_type.length; p++) {
        var newGoldNote: goldNote = {
          type: document.gold_type[p],
          text: document.gold_text[p],
          number: document.gold_number[p],
          year: document.gold_year[p],
          inner_notes: document.gold_inner_notes[p],
          inner_texts: document.gold_inner_texts[p],
          found: false,
        }
        goldNotesArray[p] = newGoldNote
      }

      console.log(goldNotesArray)

      for (let note of notes) {
        for (var goldNotesPosition = 0; goldNotesPosition < goldNotesArray.length; goldNotesPosition++) {
          let actualGoldNote = goldNotesArray[goldNotesPosition]
          console.log("CONTROLLO ANNOTAZIONI:\n")
          console.log("Anno nota utente: " + note.year)
          console.log("Anno nota gold: " + actualGoldNote.year)
          console.log("Numero nota utente: " + note.number)
          console.log("Numero nota gold: " + actualGoldNote.number)
          console.log("Testo nota utente: " + note.current_text)
          console.log("Testo nota gold: " + actualGoldNote.text)
          console.log("Type nota utente: " + note.type)
          console.log("Type nota gold: " + actualGoldNote.type)
          if (
            note.year == actualGoldNote.year && 
            note.number == actualGoldNote.number && 
            note.current_text == actualGoldNote.text.replace(/  +/g, ' ') && 
            note.type == actualGoldNote.type && 
            this.internalNoteChecker(note, actualGoldNote)
          ) {
            goldNotesArray[goldNotesPosition].found = true
          }
        }
      }

      var notFoundGoldNotesArray: goldNote[] = [];

      for (let gnote of goldNotesArray) {
        if (gnote.found == false) {
          notFoundGoldNotesArray.push(gnote)
        }
      }
      
      if (notFoundGoldNotesArray.length == 0) {
        goldCheck = true
      }

      /* CONTROL IMPLEMENTATION ENDS HERE */

      /* Push goldCheck inside goldChecks array for the current gold element */
      goldChecks.push(goldCheck)

    }

    return goldChecks

  }

  static internalNoteChecker(note: NoteLaws, goldNote: goldNote): boolean {
    var found = 0
    for (let innerNote of note.innerAnnotations) {
      if (goldNote.inner_texts.length != 0) {
        for (var innerGoldNotePosition = 0; innerGoldNotePosition < goldNote.inner_texts.length; innerGoldNotePosition++) {
          let actualInnerNoteYear = goldNote.inner_notes[innerGoldNotePosition][0]
          let actualInnerNoteNumber = goldNote.inner_notes[innerGoldNotePosition][1]
          let actualInnerNoteText = goldNote.inner_texts[innerGoldNotePosition].replace(/  +/g, ' ')
          if (actualInnerNoteYear == note.year && actualInnerNoteNumber == note.number && actualInnerNoteText == note.current_text) {
              found += 1
          }
        }
      }
    }
    if (goldNote.inner_texts.length == found) {
      return true
    } else {
      return false
    }
  }

}

type goldNote = {
      	type: string;
	      text: string;
        number: number;
        year: number;
        inner_notes: Array<Array<number>>;
        inner_texts: Array<string>;
        found: boolean;
      }