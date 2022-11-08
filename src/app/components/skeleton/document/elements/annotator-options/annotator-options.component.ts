/* Core */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
/* Models */
import {Task} from "../../../../../models/skeleton/task";
import {Note} from "../../../../../models/skeleton/annotators/notes";
import {NoteStandard} from "../../../../../models/skeleton/annotators/notesStandard";
/* Services */
import {SectionService} from "../../../../../services/section.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {UtilsService} from "../../../../../services/utils.service";
/* Other */
import {doHighlight} from "@funktechno/texthighlighter/lib";

@Component({
    selector: 'app-annotator-options',
    templateUrl: './annotator-options.component.html',
    styleUrls: ['./annotator-options.component.scss', '../../document.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotatorOptionsComponent {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    task: Task
    @Input() documentIndex: number

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

    /*
     * This function intercepts the annotation event triggered by a worker by selecting a substring of the document's text.
     * It cleans previous not finalized notes and checks if the new note which is about to be created overlaps with a previous finalized note;
     * if it is not an overlap the new note is finally created and pushed inside the corresponding data structure. After such step
     * the annotation button is enabled and the worker is allowed to choose the type of the created annotation
     */
    public performAnnotation(documentIndex: number, attributeIndex: number, notes: Array<Array<Note>>, changeDetector) {

        /* If there is a leftover note (i.e., its type was not selected by current worker [it is "yellow"]) it is marked as deleted */
        for (let note of notes[documentIndex]) {
            if (note.option == "not_selected" && !note.deleted) {
                note.ignored = true
                this.removeAnnotation(documentIndex, notes[documentIndex].length - 1, changeDetector)
            }
        }

        /* The hit element which triggered the annotation event is detected */
        let domElement = null
        let noteIdentifier = `document-${documentIndex}-attribute-${attributeIndex}`
        if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
            const selection = document.getSelection();
            if (selection) domElement = document.getElementById(noteIdentifier);
        } else domElement = document.getElementById(noteIdentifier);

        if (domElement) {

            /* The container of the annotated element is cloned and the event bindings are attached again */
            let elementContainerClone = domElement.cloneNode(true)
            elementContainerClone.addEventListener('mouseup', () => this.performAnnotation(documentIndex, attributeIndex, notes, changeDetector))
            elementContainerClone.addEventListener('touchend', () => this.performAnnotation(documentIndex, attributeIndex, notes, changeDetector))

            /* the doHighlight function of the library is called and the flow is handled within two different callback */
            doHighlight(domElement, false, {
                /* the onBeforeHighlight event is called before the creation of the yellow highlight to encase the selected text */
                onBeforeHighlight: (range: Range) => {
                    let attributeIndex = parseInt(domElement.id.split("-")[3])
                    let notesForDocument = notes[documentIndex]
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
                        if (highlight[0]["outerText"]) notes[documentIndex].push(new NoteStandard(documentIndex, attributeIndex, range, highlight))
                        return true
                    }
                }
            })

        }

        /* The annotation option button is enabled if there is an highlighted but not annotated note
         * and is disabled if all the notes of the current document are annotated */
        let notSelectedNotesCheck = false
        for (let note of this.task.notes[documentIndex]) {
            if (note.option == "not_selected" && note.deleted == false) {
                notSelectedNotesCheck = true
                this.task.annotationsDisabled[documentIndex] = false
                break
            }
        }
        if (!notSelectedNotesCheck) this.task.annotationsDisabled[documentIndex] = true

        this.changeDetector.detectChanges()
    }

    /*
     * This function removes a particular annotation when the worker clicks on the "Delete" button
     * The corresponding object is not truly deleted, to preserve annotation behavior. It is simply marked as "deleted".
     */
    public removeAnnotation(documentIndex: number, noteIndex: number, changeDetector) {
        /* The wanted note is selected and marked as deleted at the current timestamp */
        let currentNote = this.task.notes[documentIndex][noteIndex]
        currentNote.markDeleted()
        currentNote.timestamp_deleted = Date.now()
        /* The corresponding HTML element is selected by using note timestamp; its text is preserved
         * and inserted back in DOM as a simple text node and the HTML is deleted */
        let domElement = document.querySelector(`[data-timestamp='${currentNote.timestamp_created}']`)
        let textNode = document.createTextNode(currentNote.current_text)
        domElement.parentNode.insertBefore(textNode, domElement);
        domElement.remove()
        /* The element is then normalized to join each text node */
        //document.querySelector(`.statement-${documentIndex}`).normalize()
        changeDetector.detectChanges()
    }

    /* The yellow leftover notes are marked as deleted */
    public handleNotes() {
        if (this.task.settings.annotator) {
            if (this.task.notes[this.documentIndex]) {
                if (this.task.notes[this.documentIndex].length > 0) {
                    let element = this.task.notes[this.documentIndex][this.task.notes[this.documentIndex].length - 1]
                    if (element.option == "not_selected" && !element.deleted) {
                        this.removeAnnotation(this.documentIndex, this.task.notes[this.documentIndex].length - 1, this.changeDetector)
                    }
                }
            }
        }
    }

    /*
     * This function finds the domElement of each note of a document using the timestamp of
     * the note itself and sets the CSS styles of the chosen option
     */
    public handleAnnotationOption(value, documentIndex: number) {
        this.task.notes[documentIndex].forEach((element, index) => {
            if (index === this.task.notes[documentIndex].length - 1) {
                if (!element.deleted) {
                    element.color = value.color
                    element.option = value.label
                    let noteElement = <HTMLElement>document.querySelector(`[data-timestamp='${element.timestamp_created}']`)
                    noteElement.style.backgroundColor = value.color
                    noteElement.style.userSelect = "none"
                    noteElement.style.pointerEvents = "none"
                    noteElement.style.touchAction = "none"
                    noteElement.style.cursor = "no-drop"
                }
            }
        })
        /* The annotation option button of the current document is disabled; the processing is terminated  */
        this.task.annotationsDisabled[documentIndex] = true
        this.changeDetector.detectChanges()
    }

    public capitalize(word: string) {
        if (!word) return word;
        let text = word.split("-")
        let str = ""
        for (word of text) str = str + " " + word[0].toUpperCase() + word.substr(1).toLowerCase();
        return str.trim()
    }



}
