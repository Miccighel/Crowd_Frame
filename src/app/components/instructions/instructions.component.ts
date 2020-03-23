import {Component, Inject, Input, OnInit} from '@angular/core';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';

export interface DialogData {}

@Component({
  selector: 'app-instructions',
  templateUrl: 'instructions.component.html',
  styleUrls: ['instructions.component.scss'],
})

export class InstructionsComponent implements OnInit{

  @Input() scale: string;

  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {
    this.openDialog(this.scale)
  }

  openDialog(scale: string): void {
    this.dialog.open(InstructionsDialog, {
      width: '80%',
      minHeight: '86%',
      data: {scale: scale}
    });
  }
}

@Component({
  selector: 'app-instructions-dialog',
  styleUrls: ['instructions-dialog.component.scss'],
  templateUrl: 'instructions-dialog.component.html',
})

export class InstructionsDialog {

  scale: string;

  constructor(public dialogRef: MatDialogRef<InstructionsDialog>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.scale = data["scale"]
  }

  closeInstructions(): void {
    this.dialogRef.close();
  }

}
