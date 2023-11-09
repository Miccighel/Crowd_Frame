/* Core */
import {Component, Inject, Input, OnInit, ViewEncapsulation} from '@angular/core';
/* Material Design */
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
/* Task models*/
import {BaseInstruction} from "../../../models/skeleton/instructions/baseInstruction";
import {Task} from "../../../models/skeleton/task";
import {Worker} from "../../../models/worker/worker";
/* Services */
import {ConfigService} from "../../../services/config.service";

/* Interfaces */
export interface DialogData {
}

/* Component HTML Tag definition */
@Component({
    selector: 'app-instructions',
    templateUrl: 'instructions.component.html',
    styleUrls: ['instructions.component.scss'],
})

/*
 * This class implements the instruction dialog of the skeleton for Crowdsourcing tasks.
 */
export class InstructionsComponent implements OnInit {

    /* |--------- SERVICES & CO. - DECLARATION ---------| */

    configService: ConfigService

    /* |---------  INSTRUCTIONS ELEMENTS - DECLARATION ---------| */

    /* Instructions to perform the task */
    @Input() task: Task;
    @Input() worker: Worker;
    /* Amount of instructions sentences */
    instructionsAmount: number;

    /* |--------- CONSTRUCTOR ---------| */

    constructor(
        public dialog: MatDialog,
        configService: ConfigService
    ) {
        this.configService = configService
    }

    /*
     * This function inits an instance of the instruction modal after main view init.
     */
    ngOnInit(): void {
        this.instructionsAmount = this.task.instructionsGeneralAmount
    }

    /*
     * This function opens the modal and loads its look&feel and content.
     */
    openDialog(instructions: Array<BaseInstruction>): void {
        this.dialog.open(InstructionsDialog, {
            width: '60%',
            minHeight: '85%',
            data: {instructions: instructions}
        });
    }

}

/* Component HTML Tag definition */
@Component({
    selector: 'app-instructions-dialog',
    styleUrls: ['instructions-dialog.component.scss'],
    templateUrl: 'instructions-dialog.component.html',
    encapsulation: ViewEncapsulation.None
})

/*
 * This class implements the content of the instruction modal of the skeleton for Crowdsourcing tasks.
 */
export class InstructionsDialog {

    /* |--------- DIALOG ELEMENTS - DECLARATION ---------| */

    scale: string;
    instructions: string;

    /* |--------- CONSTRUCTOR ---------| */

    constructor(public dialogRef: MatDialogRef<InstructionsDialog>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
        this.instructions = data["instructions"];
    }

    /*
     * This function closes the modal previously opened.
     */
    closeInstructions(): void {
        this.dialogRef.close();
    }

}
