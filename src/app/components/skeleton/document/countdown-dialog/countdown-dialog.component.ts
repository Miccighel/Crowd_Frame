import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DialogData {
  timeAllowed: number;
}

@Component({
    selector: 'app-countdown-dialog',
    templateUrl: './countdown-dialog.component.html',
    styleUrls: ['./countdown-dialog.component.scss'],
    standalone: false
})
export class CountdownDialogComponent {
    constructor(private dialogRef: MatDialogRef<CountdownDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {}

    onConfirm(): void {
      this.dialogRef.close('confirmed');
    }

       /* Used to format the time available for the next document in the message at the bottom of the page */
    formatTime(seconds: number): string {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      const minutePart = minutes > 0 ? `${minutes} min` : "";
      const secondPart = remainingSeconds > 0 ? `${remainingSeconds} sec` : "";

      return [minutePart, secondPart].filter(Boolean).join(' ');
    }

}
