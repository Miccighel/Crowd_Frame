/* Core */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
/* Models */
import { BaseInstruction } from '../../../models/skeleton/instructions/baseInstruction';

/*
 * Renders a list of task instructions.
 * Designed as a pure, reusable view component.
 */
@Component({
  selector: 'app-instruction-list',
  templateUrl: './instruction-list.component.html',
  styleUrls: ['./instruction-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class InstructionListComponent {
  /* List of instructions to display */
  @Input() instructions: BaseInstruction[] = [];
}
