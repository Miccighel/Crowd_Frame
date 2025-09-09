/* Core */
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';

/* Models */
import {BaseInstruction} from '../../../models/skeleton/instructions/baseInstruction';

/* Instruction-like shape accepted by this component (extends project base) */
type InstructionLike = BaseInstruction & {
    id?: string | number | null;
    caption?: string | false;
    text?: string | false;          /* HTML is bound via [innerHTML]; ensure it is already sanitized upstream */
    task_type?: string | string[] | null;
};

/* Optional header payload for the instruction block */
type ElementHeader =
    | {
    label?: string | false;
    caption?: string | false;
    text?: string | false;      /* HTML is bound via [innerHTML]; ensure it is already sanitized upstream */
    labelRepetition?: string | false;
    captionRepetition?: string | false;
}
    | null;

@Component({
    selector: 'app-instruction-list',
    templateUrl: './instruction-list.component.html',
    styleUrls: ['./instruction-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class InstructionListComponent implements OnInit {
    /* Optional header for the whole instruction block */
    @Input() element: ElementHeader = null;

    /* List of instruction items (optional) */
    @Input() instructions: InstructionLike[] = [];

    /* Current task type used to filter items by 'instruction.task_type' (optional) */
    @Input() currentTaskType?: string | null;

    /* Extra CSS classes for wrapper and body (optional) */
    @Input() wrapperClass: string | string[] | { [klass: string]: any } | null = null;
    @Input() bodyClass: string | string[] | { [klass: string]: any } | null = null;

    /* Rendering mode:
       - 'styled' : cards + numbering
       - 'legacy' : classic block layout
       Defaults to 'legacy' when not provided. */
    @Input() instructionsMode?: 'styled' | 'legacy';

    /* Lifecycle hook kept intentionally for symmetry; no initialization required */
    ngOnInit(): void {
    }

    /* Resolved mode with back-compat mapping */
    get mode(): 'styled' | 'legacy' {
        return this.instructionsMode ?? 'legacy';
    }

    /* Header is considered present when any of the header fields is truthy */
    get hasElementHeader(): boolean {
        const headerCandidate = this.element as any;
        return !!(headerCandidate?.label || headerCandidate?.caption || headerCandidate?.text);
    }

    /* Instruction list filtered by currentTaskType when provided */
    get visibleInstructions(): InstructionLike[] {
        const allInstructions = this.instructions ?? [];
        if (!this.currentTaskType) return allInstructions;

        const selectedTaskType = String(this.currentTaskType).toLowerCase();
        return allInstructions.filter((instructionItem) => {
            const itemTaskType = instructionItem?.task_type;
            if (!itemTaskType) return true;

            if (Array.isArray(itemTaskType)) {
                return itemTaskType.some((taskType) => String(taskType).toLowerCase() === selectedTaskType);
            }

            return String(itemTaskType).toLowerCase() === selectedTaskType;
        });
    }
}
