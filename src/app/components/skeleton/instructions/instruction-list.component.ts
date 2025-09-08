/* Core */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
/* Models */
import { BaseInstruction } from '../../../models/skeleton/instructions/baseInstruction';

type InstructionLike = BaseInstruction & {
  id?: string | number | null;
  caption?: string | false;
  text?: string | false;
  task_type?: string | string[] | null;
};

type ElementHeader = {
  label?: string | false;
  caption?: string | false;
  text?: string | false;
  // optional repetition fields may exist on payloads, ignored here
  labelRepetition?: string | false;
  captionRepetition?: string | false;
} | null;

@Component({
  selector: 'app-instruction-list',
  templateUrl: './instruction-list.component.html',
  styleUrls: ['./instruction-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class InstructionListComponent {
  /** Optional header payload */
  @Input() element: ElementHeader = null;

  /** Instruction items (optional) */
  @Input() instructions: InstructionLike[] = [];

  /** Current task type used to filter items with instruction.task_type */
  @Input() currentTaskType?: string | null;

  /** Extra classes for the root container (e.g., "evaluation-instructions") */
  @Input() wrapperClass: string | string[] | { [klass: string]: any } | null = null;

  /** Extra classes for the element text node (e.g., "evaluation-instructions-body") */
  @Input() bodyClass: string | string[] | { [klass: string]: any } | null = null;

  get hasElementHeader(): boolean {
    const el = this.element as any;
    return !!(el?.label || el?.caption || el?.text);
  }

  get visibleInstructions(): InstructionLike[] {
    const list = this.instructions ?? [];
    if (!this.currentTaskType) return list;

    const cur = String(this.currentTaskType).toLowerCase();
    return list.filter((it) => {
      const t = it?.task_type;
      if (!t) return true;
      if (Array.isArray(t)) return t.some(x => String(x).toLowerCase() === cur);
      return String(t).toLowerCase() === cur;
    });
  }
}
