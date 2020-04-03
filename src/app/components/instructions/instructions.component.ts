/* Core modules*/
import {Component, Inject, Input, OnInit} from '@angular/core';
/* Material design modules */
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
/* Data inteface for the underlying dialog component */
export interface DialogData {}

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

  /* |---------  ELEMENTS - DECLARATION ---------| */

  /* Ground truth  of the current scale of the current instance of the task */
  /* @INPUT: Received form Skeleton component */
  @Input() scale: string;
  /* Instruction of the current scale of the current instance of the task */
  /* @INPUT: Received form Skeleton component */
  @Input() instructions: string;

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialog: MatDialog) {}

  /* |--------- ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function inits an instance of the instruction modal after main view init.
   */
  ngOnInit(): void {
    this.openDialog(
      this.scale,
      this.instructions
      )
  }

  /*
   * This function opens the modal and loads its look&feel and content.
   */
  openDialog(scale: string, instructions: string): void {
    this.dialog.open(InstructionsDialog, {
      width: '80%',
      minHeight: '86%',
      data: {
        scale: scale,
        instructions: instructions
      }
    });
  }
}

/* Component HTML Tag definition */
@Component({
  selector: 'app-instructions-dialog',
  styleUrls: ['instructions-dialog.component.scss'],
  templateUrl: 'instructions-dialog.component.html',
})

/*
 * This class implements the content of the instruction modal of the skeleton for Crowdsourcing tasks.
 */
export class InstructionsDialog {

  /* |---------  ELEMENTS - DECLARATION ---------| */

  scale: string;
  instructions: string;

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialogRef: MatDialogRef<InstructionsDialog>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.scale = data["scale"];
    this.instructions = data["instructions"];
  }

  /* |--------- ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function closes the modal previously opened.
   */
  closeInstructions(): void {
    this.dialogRef.close();
  }

}
