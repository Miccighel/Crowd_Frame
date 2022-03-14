/* Core */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
/* Models */
import {NoteLaws} from "../../../../../models/skeleton/annotators/notesLaws";
import {Note} from "../../../../../models/skeleton/annotators/notes";
import {Task} from "../../../../../models/skeleton/task";
import {NoteStandard} from "../../../../../models/skeleton/annotators/notesStandard";
/* Services */
import {DeviceDetectorService} from "ngx-device-detector";
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
/* Material Design */
import {MatRadioChange} from "@angular/material/radio";
import {MatCheckboxChange} from "@angular/material/checkbox";
/* Other */
import {doHighlight} from "@funktechno/texthighlighter/lib";

@Component({
    selector: 'app-annotator-laws',
    templateUrl: './annotator-laws.component.html',
    styleUrls: ['./annotator-laws.component.scss', '../../document.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotatorLawsComponent {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    task: Task
    @Input() documentIndex: number

    colors: string[] = ["#F36060", "#DFF652", "#FFA500", "#FFFF7B"]

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService
    ) {
        this.changeDetector = changeDetector
        this.deviceDetectorService = deviceDetectorService
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.task = sectionService.task
    }

    public performHighlighting(task: Task, changeDetector, event: Object, documentIndex: number, attributeIndex: number) {
        let domElement = null
        if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
            const selection = document.getSelection();
            if (selection) {
                domElement = document.getElementById(`document-${documentIndex}-attribute-${attributeIndex}`);
            }
        } else {
            domElement = document.getElementById(`document-${documentIndex}-attribute-${attributeIndex}`);
        }
        if (domElement) {
            let first_clone = document.querySelectorAll(`.statement-text`)[documentIndex].cloneNode(true)
            first_clone.addEventListener('mouseup', (e) => this.performHighlighting(task, changeDetector, event, documentIndex, attributeIndex))
            first_clone.addEventListener('touchend', (e) => this.performHighlighting(task, changeDetector, event, documentIndex, attributeIndex))
            doHighlight(domElement, false, {
                /* the onBeforeHighlight event is called before the creation of the yellow highlight to encase the selected text */
                onBeforeHighlight: (range: Range) => {
                    let attributeIndex = parseInt(domElement.id.split("-")[3])
                    let notesForDocument = this.task.notes[documentIndex]
                    if (range.toString().trim().length == 0)
                        return false
                    let indexes = this.utilsService.getSelectionCharacterOffsetWithin(domElement)
                    /* To detect an overlap the indexes of the current annotation are check with respect to each annotation previously created */
                    for (let note of notesForDocument) {
                        if (note.deleted == false && note.attribute_index == attributeIndex) if (indexes["start"] < note.index_end && note.index_start < indexes["end"]) return false
                    }
                    return true
                },
                /* the onAfterHighlight event is called after the creation of the yellow highlight to encase the selected text */
                onAfterHighlight: (range, highlight) => {
                    if (highlight.length > 0) {
                        if (highlight[0]["outerText"]) this.task.notes[documentIndex].push(new NoteLaws(documentIndex, attributeIndex, range, highlight))
                        return true
                    }
                }
            })
        }
    }

    public performInnerHighlighting(task: Task, changeDetector, event: Object, documentIndex: number, attributeIndex: number, noteIndex: number) {
        let domElement = null
        if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
            const selection = document.getSelection();
            if (selection) {
                domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
            }
        } else {
            domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
        }
        if (domElement) {
            let first_clone = document.getElementById(`references-${noteIndex}.${documentIndex}`).cloneNode(true)
            first_clone.addEventListener('mouseup', (e) => this.performInnerHighlighting(task, changeDetector, event, documentIndex, attributeIndex, noteIndex))
            first_clone.addEventListener('touchend', (e) => this.performInnerHighlighting(task, changeDetector, event, documentIndex, attributeIndex, noteIndex))
            doHighlight(domElement, false, {
                /* the onBeforeHighlight event is called before the creation of the yellow highlight to encase the selected text */
                onBeforeHighlight: (range: Range) => {
                    let attributeIndex = parseInt(domElement.id.split("-")[3])
                    let notesForDocument = this.task.notes[documentIndex]
                    if (range.toString().trim().length == 0)
                        return false
                    let indexes = this.utilsService.getSelectionCharacterOffsetWithin(domElement)
                    /* To detect an overlap the indexes of the current annotation are check with respect to each annotation previously created */
                    for (let note of notesForDocument) {
                        if (note.deleted == false && note.attribute_index == attributeIndex) if (indexes["start"] < note.index_end && note.index_start < indexes["end"]) return false
                    }
                    return true
                },
                /* the onAfterHighlight event is called after the creation of the yellow highlight to encase the selected text */
                onAfterHighlight: (range, highlight) => {
                    if (highlight.length > 0) {
                        if (highlight[0]["outerText"]) this.task.notes[documentIndex][noteIndex]['innerAnnotations'].push(new NoteLaws(documentIndex, attributeIndex, range, highlight))
                        return true
                    } else {
                        let element = document.getElementById(`references-${noteIndex}.${documentIndex}`)
                        element.remove()
                        document.getElementById(`note-current-${noteIndex}.${documentIndex}`).appendChild(first_clone)
                    }
                }
            })
        }
    }

    public checkIfSaved(documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            let year = (<HTMLInputElement>document.getElementById("year-" + noteIndex + "." + documentIndex)).value
            let number = (<HTMLInputElement>document.getElementById("number-" + noteIndex + "." + documentIndex)).value
            this.checkEnabledNotes(documentIndex)
            if (currentNote.year == Number(year) && currentNote.number == Number(number)) {
                return true
            } else {
                return false
            }
        }
    }

    public checkIfLast(documentIndex: number, noteIndex: number) {
        let currentNotes = this.task.notes[documentIndex]
        let currentNote = currentNotes[noteIndex]
        let index = 0
        let undeletedNotes = 0
        for (let note of currentNotes) {
            if (!note.deleted) {
                undeletedNotes += 1
            }
        }
        if (currentNotes.length > 0) {
            for (let pos = currentNotes.length - 1; pos >= 0; pos--) {
                if (!currentNotes[pos].deleted) {
                    if (currentNotes[pos].timestamp_created != currentNote.timestamp_created) {
                        index += 1
                    } else {
                        break
                    }
                }
            }
        }
        if (index == undeletedNotes - 1) {
            return true
        } else {
            return false
        }
    }

    public innerCheckIfSaved(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let mainNote = this.task.notes[documentIndex][noteIndex]
        if (mainNote instanceof NoteLaws) {
            let currentNote = mainNote.innerAnnotations[innerNoteIndex]
            let year = (<HTMLInputElement>document.getElementById("year-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
            let number = (<HTMLInputElement>document.getElementById("number-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
            this.checkEnabledNotes(documentIndex)
            if (currentNote.year == Number(year) && currentNote.number == Number(number)) {
                return true
            } else {
                return false
            }
        }
    }

    public checkNoteDeleted(note: Note) {
        return note.deleted
    }

    public checkReferenceWithoutDetails(note: Note) {
        if (note instanceof NoteLaws) {
            if (note.type == "reference") {
                if (!note.withoutDetails) {
                    return (note.year == 0 && note.number == 0)
                } else {
                    return false
                }
            }
        }
        return false
    }

    public filterNotes(notes: Note[]) {
        var result: Note[] = []
        for (let note of notes) {
            if (note instanceof NoteLaws) {
                if (note.year != 0 && note.number != 0 && note.type == "reference" && !note.withoutDetails && !note.deleted) {
                    result.push(note)
                }
            }
        }
        return result
    }


    public referenceRadioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            if ($event.value == "null") {
                this.resetDetails(currentNote)
            } else {
                let fields = $event.value.split("-")
                currentNote.year = Number(fields[0])
                currentNote.number = Number(fields[1])
            }
        }
    }

    public innerReferenceRadioChange($event: MatRadioChange, documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            currentNote = currentNote.innerAnnotations[innerNoteIndex]
            if (currentNote instanceof NoteLaws) {
                if ($event.value == "null") {
                    this.resetDetails(currentNote)
                } else {
                    let fields = $event.value.split("-")
                    currentNote.year = Number(fields[0])
                    currentNote.number = Number(fields[1])
                }
            }
        }
    }

    public detailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            if ($event.checked) {
                currentNote.withoutDetails = true
                this.resetDetails(currentNote)
                this.checkEnabledNotes(documentIndex)
            } else {
                currentNote.withoutDetails = false
                this.checkEnabledNotes(documentIndex)
            }
        }
    }

    public innerDetailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let mainNote = this.task.notes[documentIndex][noteIndex]
        if (mainNote instanceof NoteLaws) {
            let currentNote = mainNote.innerAnnotations[innerNoteIndex]
            if ($event.checked) {
                currentNote.withoutDetails = true
                this.resetDetails(currentNote)
                this.checkEnabledNotes(documentIndex)
            } else {
                currentNote.withoutDetails = false
                this.checkEnabledNotes(documentIndex)
            }
        }
    }

    public checkEnabledNotes(documentIndex: number) {
        this.task.notesDone[documentIndex] = true
        let currentNotes = this.task.notes[documentIndex]
        var notesNotDeleted: Note[] = []
        var booleans: Boolean[] = [true]
        for (let note of currentNotes) {
            if (!note.deleted) {
                notesNotDeleted.push(note)
            }
        }
        for (let note of notesNotDeleted) {
            if (note instanceof NoteLaws) {
                if (note.type == "reference") {
                    if (this.checkReferenceWithoutDetails(note)) {
                        booleans.push(false)
                    } else {
                        booleans.push(true)
                    }
                }
            }
        }
        if (booleans.length == 0) {
            this.task.notesDone[documentIndex] = false
        } else {
            let checker = array => array.every(Boolean)
            if (checker(booleans)) {
                this.task.notesDone[documentIndex] = true
            } else {
                this.task.notesDone[documentIndex] = false
            }
        }
    }

    public resetRadioButton(documentIndex: number, noteIndex: number, innerNoteIndex?: number) {
        var currentNote: NoteStandard
        if (!innerNoteIndex) {
            currentNote = this.task.notes[documentIndex][noteIndex]
        } else {
            currentNote = this.task.notes[documentIndex][noteIndex]
            if (currentNote instanceof NoteLaws) {
                currentNote = currentNote.innerAnnotations[innerNoteIndex]
            }
        }
        if (currentNote instanceof NoteLaws) {
            for (let note of this.task.notes[documentIndex]) {
                if (note instanceof NoteLaws) {
                    if (!note.deleted && note.withoutDetails) {
                        if (note.year == currentNote.year && note.number == currentNote.number) {
                            this.resetDetails(note)
                        }
                    }
                    for (let innerNote of note.innerAnnotations) {
                        if (innerNote instanceof NoteLaws) {
                            if (!innerNote.deleted && innerNote.withoutDetails) {
                                if (innerNote.year == currentNote.year && innerNote.number == currentNote.number) {
                                    this.resetDetails(innerNote)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    public performAnnotationLaws(documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            this.resetRadioButton(documentIndex, noteIndex)
            let year = (<HTMLInputElement>document.getElementById("year-" + noteIndex + "." + documentIndex)).value
            let number = (<HTMLInputElement>document.getElementById("number-" + noteIndex + "." + documentIndex)).value
            currentNote.year = Number(year)
            currentNote.number = Number(number)
            currentNote.updateNote()
            this.checkEnabledNotes(documentIndex)
        }
    }

    public performInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let mainNote = this.task.notes[documentIndex][noteIndex]
        if (mainNote instanceof NoteLaws) {
            this.resetRadioButton(documentIndex, noteIndex, innerNoteIndex)
            let currentNote = mainNote.innerAnnotations[innerNoteIndex]
            let year = (<HTMLInputElement>document.getElementById("year-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
            let number = (<HTMLInputElement>document.getElementById("number-" + innerNoteIndex + "-" + noteIndex + "." + documentIndex)).value
            currentNote.year = Number(year)
            currentNote.number = Number(number)
            currentNote.updateNote()
            this.checkEnabledNotes(documentIndex)
        }
    }

    public changeSpanColor(documentIndex: number, noteIndex: number) {
        let note = this.task.notes[documentIndex][noteIndex]
        let note_timestamp = note.timestamp_created
        document.querySelector(`[data-timestamp='${note_timestamp}']`).setAttribute("style", `background-color: ${note.color};`)
    }

    public resetDetails(note: NoteLaws) {
        note.year = 0
        note.number = 0
    }

    public radioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            switch ($event.value) {
                case "insertion": {
                    this.resetDetails(currentNote)
                    currentNote.type = "insertion"
                    currentNote.withoutDetails = true
                    currentNote.containsReferences = false
                    currentNote.innerAnnotations = []
                    currentNote.color = this.colors[1]
                    this.changeSpanColor(documentIndex, noteIndex)
                    this.checkEnabledNotes(documentIndex)
                    break
                }
                case "substitution": {
                    this.resetDetails(currentNote)
                    currentNote.type = "substitution"
                    currentNote.withoutDetails = true
                    currentNote.containsReferences = false
                    currentNote.innerAnnotations = []
                    currentNote.color = this.colors[2]
                    this.changeSpanColor(documentIndex, noteIndex)
                    this.checkEnabledNotes(documentIndex)
                    break
                }
                case "repeal": {
                    this.resetDetails(currentNote)
                    currentNote.type = "repeal"
                    currentNote.withoutDetails = true
                    currentNote.containsReferences = false
                    currentNote.innerAnnotations = []
                    currentNote.color = this.colors[0]
                    this.changeSpanColor(documentIndex, noteIndex)
                    this.checkEnabledNotes(documentIndex)
                    break
                }
                case "reference": {
                    this.resetDetails(currentNote)
                    currentNote.type = "reference"
                    currentNote.containsReferences = false
                    currentNote.innerAnnotations = []
                    currentNote.color = this.colors[3]
                    this.changeSpanColor(documentIndex, noteIndex)
                    this.checkEnabledNotes(documentIndex)
                    break
                }
            }
        }
    }

    public removeAnnotationLaws(documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        currentNote.markDeleted()
        this.resetRadioButton(documentIndex, noteIndex)
        currentNote.timestamp_deleted = Date.now()
        let element = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
        element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
        element.remove()
        this.checkEnabledNotes(documentIndex)
    }

    public removeInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let mainNote = this.task.notes[documentIndex][noteIndex]
        if (mainNote instanceof NoteLaws) {
            let currentNote = mainNote.innerAnnotations[innerNoteIndex]
            currentNote.markDeleted()
            currentNote.timestamp_deleted = Date.now()
            let element = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
            element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
            element.remove()
            this.checkEnabledNotes(documentIndex)
        }
    }

    public countInnerUndeletedNotes(note: Note) {
        var undeletedNotes = 0
        if (note instanceof NoteLaws) {
            for (let innerNote of note.innerAnnotations) {
                if (!innerNote.deleted) {
                    undeletedNotes += 1
                }
            }
        }
        return undeletedNotes
    }

    public innerReferenceRadioButtonCheck(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        var currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            currentNote = currentNote.innerAnnotations[innerNoteIndex]
            if (currentNote instanceof NoteLaws) {
                if (currentNote.year == 0 && currentNote.number == 0) {
                    return true
                }
            }
        }
        return false
    }

    public checkUndeletedNotesPresenceLaws(notes) {
        let undeletedNotes = false
        for (let note of notes) {
            if (note.deleted == false) {
                undeletedNotes = true
                break
            }
        }
        return undeletedNotes
    }

    public checkboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex]
        if (currentNote instanceof NoteLaws) {
            if ($event.checked) {
                currentNote.containsReferences = true
                this.checkEnabledNotes(documentIndex)
            } else {
                currentNote.containsReferences = false
                currentNote.innerAnnotations = []
                this.checkEnabledNotes(documentIndex)
            }
        }
    }

}