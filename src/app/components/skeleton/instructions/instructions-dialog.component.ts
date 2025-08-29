/* Core */
import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
    TemplateRef,
    ViewChild
} from '@angular/core';
/* Material */
import {MatDialog} from '@angular/material/dialog';
/* Models */
import {BaseInstruction} from '../../../models/skeleton/instructions/baseInstruction';
import {Task} from '../../../models/skeleton/task';
import {Worker} from '../../../models/worker/worker';
/* Services */
import {ConfigService} from '../../../services/config.service';

/*
 * Implements the instruction launcher for crowdsourcing tasks.
 * Renders a toolbar button and opens a Material dialog using a local <ng-template>.
 * Keeps rendering logic DRY by delegating the list to <app-instruction-list>.
 */
@Component({
    selector: 'app-instructions',
    templateUrl: 'instructions-dialog.component.html',
    styleUrls: ['instructions-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class InstructionsDialogComponent implements OnInit {
    /* Inputs */
    @Input() task: Task;
    @Input() worker: Worker;

    /* Reference to the dialog template */
    @ViewChild('instructionsDialogTpl', {static: true})
    instructionsDialogTpl!: TemplateRef<unknown>;

    /* Amount of instruction sentences (exposed for UI if needed) */
    instructionsAmount = 0;

    /* Backing data for the dialog template */
    instructionsForDialog: BaseInstruction[] = [];

    /* Services */
    constructor(public dialog: MatDialog, public configService: ConfigService) {
    }

    /* Initializes the modal launcher after main view init. */
    ngOnInit(): void {
        this.instructionsAmount = this.task.instructionsGeneralAmount;
    }

    /* Opens the modal and passes content (no extra component class needed). */
    openDialog(instructions: BaseInstruction[]): void {
        this.instructionsForDialog = instructions ?? [];
        this.dialog.open(this.instructionsDialogTpl, {
            width: '60%',
            minHeight: '85%'
        });
    }
}
