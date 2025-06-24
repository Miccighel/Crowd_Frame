/* Core */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnInit, Renderer2} from '@angular/core';
/* Highlighter */
import {doHighlight, deserializeHighlights, serializeHighlights, removeHighlights, TextHighlighter} from "@funktechno/texthighlighter/lib";
/* Models */
import {Task} from "../../../../../models/skeleton/task";
import {Note} from "../../../../../models/skeleton/annotators/notes";
import {NoteStandard} from "../../../../../models/skeleton/annotators/notesStandard";
/* Services */
import {SectionService} from "../../../../../services/section.service";
import {DeviceDetectorService} from "ngx-device-detector";
import {UtilsService} from "../../../../../services/utils.service";

@Component({
    selector: 'app-annotator-options',
    templateUrl: './annotator-options.component.html',
    styleUrls: ['./annotator-options.component.scss', '../../document.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AnnotatorOptionsComponent implements OnInit {

    /* Angular Renderer class that allows manipulating the DOM */
    renderer: Renderer2
    domElement: ElementRef

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;
    /* Service to detect user's device */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService

    @Input() documentIndex: number

    highlighter: any
    task: Task

    constructor(
        renderer: Renderer2,
        domElement: ElementRef,
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
    ) {
        this.renderer = renderer
        this.domElement = domElement
        this.changeDetector = changeDetector
        this.deviceDetectorService = deviceDetectorService
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.task = sectionService.task
    }

    public ngOnInit() {
        this.utilsService.waitForElementInitialization('body').then((element) => {
            this.highlighter = new TextHighlighter(this.domElement.nativeElement.ownerDocument.body, {
                /* This instance of the highlighter intercepts events on the whole body, but it is only needed to
                 * deserialize previous highlights, which are being parsed from the database, and serialize those that are new.
                 * Thus, this instance DOES NOT have to trigger any new highlights on the rest of the DOM. */
                onBeforeHighlight: (range: Range) => false
            });
            let mostRecentDataRecord = this.task.retrieveMostRecentDataRecord('document', this.documentIndex)
            if (mostRecentDataRecord) {
                let notesPrevious = mostRecentDataRecord.loadNotes();
                let notesParsed = []
                let existingSerializations = []
                for (let notesSerialized of notesPrevious) {
                    let noteParsed = new NoteStandard(notesSerialized['document_index'], notesSerialized['attribute_index'],null, null, null)
                    noteParsed.restoreData(notesSerialized)
                    notesParsed.push(noteParsed)
                }
                for (let noteParsed of notesParsed) {
                    let existingSerialization = JSON.parse(noteParsed.serialization)
                    existingSerializations.push(existingSerialization)
                }
                this.task.notes[this.documentIndex] = notesParsed
                this.highlighter.deserializeHighlights(JSON.stringify(existingSerializations))
                for (let [noteIndex, noteParsed] of this.task.notes[this.documentIndex].entries()) {
                    if (noteParsed.deleted)
                        this.removeAnnotation(this.documentIndex, noteIndex, this.changeDetector);
                    else
                        this.restoreAnnotationColor(noteParsed)
                }
                this.changeDetector.detectChanges()
            }
        });
    }

    /*
     * This function intercepts the annotation event triggered by a worker by selecting a substring of the document's text.
     * It first cleans up any previously not-finalized notes and checks if the new note, about to be created, overlaps with
     * a previously finalized note. If there is no overlap, the new note is created and pushed into the corresponding data structure.
     * After this step, the annotation button is enabled, and the worker is allowed to choose the type of the created annotation.
     */
    public performAnnotation(documentIndex: number, attributeIndex: number, notes: Array<Array<Note>>, changeDetector: ChangeDetectorRef) {
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
                        if (note.deleted == false && note.attribute_index == attributeIndex){
                            if (indexes["start"] < note.index_end && note.index_start < indexes["end"])
                                return false
                        }
                    }
                    return true
                },
                /* the onAfterHighlight event is called after the creation of the yellow highlight to encase the selected text */
                onAfterHighlight: (range, highlight) => {
                    if (highlight.length > 0) {
                        let existingHighlightsSerialized = JSON.parse(this.highlighter.serializeHighlights(highlight))
                        let currentSerialization = null
                        for (let existingHighlightSerialized of existingHighlightsSerialized) {
                            if (highlight[0]["outerText"] == existingHighlightSerialized['textContent'])
                                currentSerialization = existingHighlightSerialized
                        }
                        let noteCreated = new NoteStandard(documentIndex, attributeIndex, range, highlight, JSON.stringify(currentSerialization))
                        if (highlight[0]["outerText"]) notes[documentIndex].push(noteCreated)
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
    public removeAnnotation(documentIndex: number, noteIndex: number, changeDetector: ChangeDetectorRef) {
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
     * This function (along with the subsequent ones) finds the domElement of each note in a document
     * using the timestamp of the note itself and sets the CSS styles for the chosen option.
     */
    public handleAnnotationOption(label: string, color: string, documentIndex: number) {
        const notes = this.task.notes[documentIndex];
        notes.forEach((note, index) => {
            if (index === notes.length - 1 && !note.deleted) {
                this.updateNoteElement(note, label, color);
            }
        });
        /* The annotation option button of the current document is disabled; the processing is terminated  */
        this.task.annotationsDisabled[documentIndex] = true;
        this.changeDetector.detectChanges();
    }

    private updateNoteElement(note: Note, label: string, color: string) {
        note.color = color;
        note.option = label;
        const noteElement = <HTMLElement>document.querySelector(`[data-timestamp='${note.timestamp_created}']`);
        this.applyStylesToNoteElement(note, noteElement);
    }

    private applyStylesToNoteElement(note: Note, domElement: HTMLElement) {
        if (!note.deleted) {
            domElement.style.backgroundColor = note.color;
            domElement.style.userSelect = "none";
            domElement.style.pointerEvents = "none";
            domElement.style.touchAction = "none";
            domElement.style.cursor = "no-drop";
            this.changeDetector.detectChanges();
        }
    }

    public restoreAnnotationColor(note: Note) {
        if (!note.deleted) {
            const domElement = <HTMLElement>document.querySelector(`[data-timestamp='${note.timestamp_created}']`);
            this.applyStylesToNoteElement(note, domElement);
        }
    }

}
