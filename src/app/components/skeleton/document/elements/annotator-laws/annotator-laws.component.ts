/* Core */
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Input} from '@angular/core';
/* Models */
import {NoteLaws} from '../../../../../models/skeleton/annotators/notesLaws';
import {Note} from '../../../../../models/skeleton/annotators/notes';
import {Task} from '../../../../../models/skeleton/task';
import {NoteStandard} from '../../../../../models/skeleton/annotators/notesStandard';
/* Services */
import {DeviceDetectorService} from 'ngx-device-detector';
import {SectionService} from '../../../../../services/section.service';
import {UtilsService} from '../../../../../services/utils.service';
/* Material Design */
import {MatRadioChange} from '@angular/material/radio';
import {MatCheckboxChange} from '@angular/material/checkbox';
/* Other */
import {doHighlight} from '@funktechno/texthighlighter/lib';

@Component({
    selector: 'app-annotator-laws',
    templateUrl: './annotator-laws.component.html',
    styleUrls: ['./annotator-laws.component.scss', '../../document.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class AnnotatorLawsComponent {
    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Services */
    deviceDetectorService: DeviceDetectorService;
    sectionService: SectionService;
    utilsService: UtilsService;

    task: Task;
    @Input({required: true}) documentIndex!: number;

    colors: string[] = ['#F36060', '#DFF652', '#FFA500', '#FFFF7B'];

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService
    ) {
        this.changeDetector = changeDetector;
        this.deviceDetectorService = deviceDetectorService;
        this.sectionService = sectionService;
        this.utilsService = utilsService;
        this.task = sectionService.task;
    }

    get notes(): NoteLaws[] {
        return this.task.notes[this.documentIndex] as NoteLaws[];
    }

    public performHighlighting(
        task: Task,
        changeDetector: ChangeDetectorRef,
        event: Event,
        documentIndex: number,
        attributeIndex: number
    ) {
        let domElement: HTMLElement | null = null;
        if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
            const selection = document.getSelection();
            if (selection) domElement = document.getElementById(`document-${documentIndex}-attribute-${attributeIndex}`);
        } else {
            domElement = document.getElementById(`document-${documentIndex}-attribute-${attributeIndex}`);
        }
        if (!domElement) return;

        const attrTexts = document.querySelectorAll('.attribute-text');
        const attrEl = attrTexts.item(documentIndex);
        const first_clone = attrEl ? (attrEl.cloneNode(true) as HTMLElement) : null;
        if (first_clone) {
            first_clone.addEventListener('mouseup', (_e) =>
                this.performHighlighting(task, changeDetector, event, documentIndex, attributeIndex)
            );
            first_clone.addEventListener('touchend', (_e) =>
                this.performHighlighting(task, changeDetector, event, documentIndex, attributeIndex)
            );
        }

        doHighlight(domElement, false, {
            /* called before the creation of the yellow highlight */
            onBeforeHighlight: (range: Range) => {
                const attributeIdx = parseInt(domElement!.id.split('-')[3]);
                const notesForDocument = this.task.notes[documentIndex];
                if (range.toString().trim().length === 0) return false;
                const indexes = this.utilsService.getSelectionCharacterOffsetWithin(domElement!);
                /* prevent overlap with existing annotations on same attribute */
                for (const note of notesForDocument) {
                    if (note.deleted === false && note.attribute_index === attributeIdx) {
                        if (indexes['start'] < note.index_end && note.index_start < indexes['end']) return false;
                    }
                }
                return true;
            },
            /* called after the creation of the yellow highlight */
            onAfterHighlight: (range, highlight) => {
                if (highlight.length > 0) {
                    const noteLaws = new NoteLaws(documentIndex, attributeIndex, range, highlight, '', '#FFFF7B');
                    if (highlight[0]['outerText']) this.task.notes[documentIndex].push(noteLaws);
                    return true;
                }
                return false;
            }
        });
    }

    public performInnerHighlighting(
        task: Task,
        changeDetector: ChangeDetectorRef,
        event: Event,
        documentIndex: number,
        attributeIndex: number,
        noteIndex: number
    ) {
        let domElement: HTMLElement | null = null;
        if (this.deviceDetectorService.isMobile() || this.deviceDetectorService.isTablet()) {
            const selection = document.getSelection();
            if (selection) domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
        } else {
            domElement = document.getElementById(`references-${noteIndex}.${documentIndex}`);
        }
        if (!domElement) return;

        const original = document.getElementById(`references-${noteIndex}.${documentIndex}`);
        const first_clone = original ? (original.cloneNode(true) as HTMLElement) : null;
        if (first_clone) {
            first_clone.addEventListener('mouseup', (_e) =>
                this.performInnerHighlighting(task, changeDetector, event, documentIndex, attributeIndex, noteIndex)
            );
            first_clone.addEventListener('touchend', (_e) =>
                this.performInnerHighlighting(task, changeDetector, event, documentIndex, attributeIndex, noteIndex)
            );
        }

        doHighlight(domElement, false, {
            onBeforeHighlight: (range: Range) => {
                const attributeIdx = parseInt(domElement!.id.split('-')[3]);
                const notesForDocument = this.task.notes[documentIndex];
                if (range.toString().trim().length === 0) return false;
                const indexes = this.utilsService.getSelectionCharacterOffsetWithin(domElement!);
                for (const note of notesForDocument) {
                    if (note.deleted === false && note.attribute_index === attributeIdx) {
                        if (indexes['start'] < note.index_end && note.index_start < indexes['end']) return false;
                    }
                }
                return true;
            },
            onAfterHighlight: (range, highlight) => {
                if (highlight.length > 0) {
                    if (highlight[0]['outerText']) {
                        (this.task.notes[documentIndex][noteIndex] as NoteLaws).innerAnnotations.push(
                            new NoteLaws(documentIndex, attributeIndex, range, highlight, '')
                        );
                    }
                    return true;
                } else {
                    const el = document.getElementById(`references-${noteIndex}.${documentIndex}`);
                    const holder = document.getElementById(`note-current-${noteIndex}.${documentIndex}`);
                    if (el && holder && first_clone) {
                        el.remove();
                        holder.appendChild(first_clone);
                    }
                    return true;
                }
            }
        });
    }

    public checkIfSaved(documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            const year = (document.getElementById('year-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            const number = (document.getElementById('number-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            this.checkEnabledNotes(documentIndex);
            return currentNote.year === Number(year) && currentNote.number === Number(number);
        }
        return false;
    }

    public checkIfLast(documentIndex: number, noteIndex: number) {
        const currentNotes = this.task.notes[documentIndex];
        const currentNote = currentNotes[noteIndex];
        let index = 0;
        let undeletedNotes = 0;
        for (const note of currentNotes) {
            if (!note.deleted) undeletedNotes += 1;
        }
        if (currentNotes.length > 0) {
            for (let pos = currentNotes.length - 1; pos >= 0; pos--) {
                if (!currentNotes[pos].deleted) {
                    if (currentNotes[pos].timestamp_created !== currentNote.timestamp_created) {
                        index += 1;
                    } else {
                        break;
                    }
                }
            }
        }
        return index === undeletedNotes - 1;
    }

    public innerCheckIfSaved(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        const mainNote = this.task.notes[documentIndex][noteIndex];
        if (mainNote instanceof NoteLaws) {
            const currentNote = mainNote.innerAnnotations[innerNoteIndex];
            const year = (document.getElementById('year-' + innerNoteIndex + '-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            const number = (document.getElementById('number-' + innerNoteIndex + '-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            this.checkEnabledNotes(documentIndex);
            return currentNote.year === Number(year) && currentNote.number === Number(number);
        }
        return false;
    }

    public checkNoteDeleted(note: Note) {
        return note.deleted;
    }

    public checkReferenceWithoutDetails(note: Note) {
        if (note instanceof NoteLaws) {
            if (note.type === 'reference') {
                if (!note.withoutDetails) {
                    return note.year === 0 && note.number === 0;
                } else {
                    return false;
                }
            }
        }
        return false;
    }

    public filterNotes(notes: NoteLaws[]) {
        const result: NoteLaws[] = [];
        for (const note of notes) {
            if (note instanceof NoteLaws) {
                if (note.year !== 0 && note.number !== 0 && note.type === 'reference' && !note.withoutDetails && !note.deleted) {
                    result.push(note);
                }
            }
        }
        return result;
    }

    public referenceRadioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            if ($event.value === 'null') {
                this.resetDetails(currentNote);
            } else {
                const fields = ($event.value as string).split('-');
                currentNote.year = Number(fields[0]);
                currentNote.number = Number(fields[1]);
            }
        }
    }

    public innerReferenceRadioChange($event: MatRadioChange, documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            currentNote = currentNote.innerAnnotations[innerNoteIndex];
            if (currentNote instanceof NoteLaws) {
                if ($event.value === 'null') {
                    this.resetDetails(currentNote);
                } else {
                    const fields = ($event.value as string).split('-');
                    currentNote.year = Number(fields[0]);
                    currentNote.number = Number(fields[1]);
                }
            }
        }
    }

    public detailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            if ($event.checked) {
                currentNote.withoutDetails = true;
                this.resetDetails(currentNote);
                this.checkEnabledNotes(documentIndex);
            } else {
                currentNote.withoutDetails = false;
                this.checkEnabledNotes(documentIndex);
            }
        }
    }

    public innerDetailsCheckboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        const mainNote = this.task.notes[documentIndex][noteIndex];
        if (mainNote instanceof NoteLaws) {
            const currentNote = mainNote.innerAnnotations[innerNoteIndex];
            if ($event.checked) {
                currentNote.withoutDetails = true;
                this.resetDetails(currentNote);
                this.checkEnabledNotes(documentIndex);
            } else {
                currentNote.withoutDetails = false;
                this.checkEnabledNotes(documentIndex);
            }
        }
    }

    public checkEnabledNotes(documentIndex: number) {
        this.task.notesDone[documentIndex] = true;
        const currentNotes = this.task.notes[documentIndex];
        const notesNotDeleted: Note[] = [];
        const booleans: boolean[] = [true];

        for (const note of currentNotes) {
            if (!note.deleted) notesNotDeleted.push(note);
        }

        for (const note of notesNotDeleted) {
            if (note instanceof NoteLaws) {
                if (note.type === 'reference') {
                    if (this.checkReferenceWithoutDetails(note)) {
                        booleans.push(false);
                    } else {
                        booleans.push(true);
                    }
                }
            }
        }

        if (booleans.length === 0) {
            this.task.notesDone[documentIndex] = false;
        } else {
            const allTrue = (arr: boolean[]) => arr.every(Boolean);
            this.task.notesDone[documentIndex] = allTrue(booleans);
        }
    }

    public resetRadioButton(documentIndex: number, noteIndex: number, innerNoteIndex?: number) {
        let currentNote: NoteStandard;
        if (innerNoteIndex == null) {
            currentNote = this.task.notes[documentIndex][noteIndex];
        } else {
            currentNote = this.task.notes[documentIndex][noteIndex];
            if (currentNote instanceof NoteLaws) {
                currentNote = currentNote.innerAnnotations[innerNoteIndex];
            }
        }
        if (currentNote instanceof NoteLaws) {
            for (const note of this.task.notes[documentIndex]) {
                if (note instanceof NoteLaws) {
                    if (!note.deleted && note.withoutDetails) {
                        if (note.year === currentNote.year && note.number === currentNote.number) {
                            this.resetDetails(note);
                        }
                    }
                    for (const innerNote of note.innerAnnotations) {
                        if (innerNote instanceof NoteLaws) {
                            if (!innerNote.deleted && innerNote.withoutDetails) {
                                if (innerNote.year === currentNote.year && innerNote.number === currentNote.number) {
                                    this.resetDetails(innerNote);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    public performAnnotationLaws(documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            this.resetRadioButton(documentIndex, noteIndex);
            const year = (document.getElementById('year-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            const number = (document.getElementById('number-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            currentNote.year = Number(year);
            currentNote.number = Number(number);
            currentNote.updateNote();
            this.checkEnabledNotes(documentIndex);
        }
    }

    public performInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        const mainNote = this.task.notes[documentIndex][noteIndex];
        if (mainNote instanceof NoteLaws) {
            this.resetRadioButton(documentIndex, noteIndex, innerNoteIndex);
            const currentNote = mainNote.innerAnnotations[innerNoteIndex];
            const year = (document.getElementById('year-' + innerNoteIndex + '-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            const number = (document.getElementById('number-' + innerNoteIndex + '-' + noteIndex + '.' + documentIndex) as HTMLInputElement)?.value;
            currentNote.year = Number(year);
            currentNote.number = Number(number);
            currentNote.updateNote();
            this.checkEnabledNotes(documentIndex);
        }
    }

    public changeSpanColor(documentIndex: number, noteIndex: number) {
        const note = this.task.notes[documentIndex][noteIndex];
        const note_timestamp = note.timestamp_created;
        const el = document.querySelector<HTMLElement>(`[data-timestamp='${note_timestamp}']`);
        if (el) el.setAttribute('style', `background-color: ${note.color};`);
    }

    public resetDetails(note: NoteLaws) {
        note.year = 0;
        note.number = 0;
    }

    public radioChange($event: MatRadioChange, documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            switch ($event.value) {
                case 'insertion': {
                    this.resetDetails(currentNote);
                    currentNote.type = 'insertion';
                    currentNote.withoutDetails = true;
                    currentNote.containsReferences = false;
                    currentNote.innerAnnotations = [];
                    currentNote.color = this.colors[1];
                    this.changeSpanColor(documentIndex, noteIndex);
                    this.checkEnabledNotes(documentIndex);
                    break;
                }
                case 'substitution': {
                    this.resetDetails(currentNote);
                    currentNote.type = 'substitution';
                    currentNote.withoutDetails = true;
                    currentNote.containsReferences = false;
                    currentNote.innerAnnotations = [];
                    currentNote.color = this.colors[2];
                    this.changeSpanColor(documentIndex, noteIndex);
                    this.checkEnabledNotes(documentIndex);
                    break;
                }
                case 'repeal': {
                    this.resetDetails(currentNote);
                    currentNote.type = 'repeal';
                    currentNote.withoutDetails = true;
                    currentNote.containsReferences = false;
                    currentNote.innerAnnotations = [];
                    currentNote.color = this.colors[0];
                    this.changeSpanColor(documentIndex, noteIndex);
                    this.checkEnabledNotes(documentIndex);
                    break;
                }
                case 'reference': {
                    this.resetDetails(currentNote);
                    currentNote.type = 'reference';
                    currentNote.withoutDetails = false;
                    currentNote.containsReferences = true;
                    currentNote.innerAnnotations = [];
                    currentNote.color = this.colors[3];
                    this.changeSpanColor(documentIndex, noteIndex);
                    this.checkEnabledNotes(documentIndex);
                    break;
                }
            }
        }
    }

    public removeAnnotationLaws(documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        currentNote.markDeleted();
        this.resetRadioButton(documentIndex, noteIndex);
        currentNote.timestamp_deleted = Date.now();
        const element = document.querySelector<HTMLElement>(`[data-timestamp='${currentNote.timestamp_created}']`);
        if (element?.parentNode) {
            element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
            element.remove();
        }
        this.checkEnabledNotes(documentIndex);
    }

    public removeInnerAnnotationLaws(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        const mainNote = this.task.notes[documentIndex][noteIndex];
        if (mainNote instanceof NoteLaws) {
            const currentNote = mainNote.innerAnnotations[innerNoteIndex];
            currentNote.markDeleted();
            currentNote.timestamp_deleted = Date.now();
            const element = document.querySelector<HTMLElement>(`[data-timestamp='${currentNote.timestamp_created}']`);
            if (element?.parentNode) {
                element.parentNode.insertBefore(document.createTextNode(currentNote.current_text), element);
                element.remove();
            }
            this.checkEnabledNotes(documentIndex);
        }
    }

    public countInnerUndeletedNotes(note: Note) {
        let undeletedNotes = 0;
        if (note instanceof NoteLaws) {
            for (const innerNote of note.innerAnnotations) {
                if (!innerNote.deleted) undeletedNotes += 1;
            }
        }
        return undeletedNotes;
    }

    public innerReferenceRadioButtonCheck(documentIndex: number, noteIndex: number, innerNoteIndex: number) {
        let currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            currentNote = currentNote.innerAnnotations[innerNoteIndex];
            if (currentNote instanceof NoteLaws) {
                if (currentNote.year === 0 && currentNote.number === 0) return true;
            }
        }
        return false;
    }

    public checkUndeletedNotesPresenceLaws(notes: Note[]) {
        for (const note of notes) {
            if (note.deleted === false) return true;
        }
        return false;
    }

    public checkboxChange($event: MatCheckboxChange, documentIndex: number, noteIndex: number) {
        const currentNote = this.task.notes[documentIndex][noteIndex];
        if (currentNote instanceof NoteLaws) {
            if ($event.checked) {
                currentNote.containsReferences = true;
                this.checkEnabledNotes(documentIndex);
            } else {
                currentNote.containsReferences = false;
                currentNote.innerAnnotations = [];
                this.checkEnabledNotes(documentIndex);
            }
        }
    }

    protected readonly NoteLaws = NoteLaws;
}
