/* Core modules*/
import {Component, Inject, Input, OnInit} from '@angular/core';
/* Material design modules */
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import * as AWS from "aws-sdk";

/* Data inteface for the underlying dialog component */
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

  /* |---------  ELEMENTS - DECLARATION ---------| */

  /* Ground truth  of the current scale of the current instance of the task */
  /* @INPUT: Received form Skeleton component */
  @Input() scale: string;
  /* Instruction of the current scale of the current instance of the task */
  /* @INPUT: Received form Skeleton component */
  /* Reference to the S3 component of AWS SDK */
  @Input() s3: AWS.S3;
  /* Reference to the current bucket identifier */
  /* @INPUT: Received form Skeleton component */
  @Input() bucket: string;
  /* Reference to the file where task instructions are stored */
  /* @INPUT: Received form Skeleton component */
  @Input() instructionsFile: string;
  /* Raw HTML instructions downloaded from S3 bucket */
  instructions: string;

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialog: MatDialog) {}

  /* |--------- ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function inits an instance of the instruction modal after main view init.
   */
  ngOnInit(): void {
    this.performInstructionsLoading().then(outcome => {
      this.instructions = outcome;
      this.openDialog(
        this.scale,
        this.instructions
      )
    })
  }

  /*
   * This function opens the modal and loads its look&feel and content.
   */
  openDialog(scale: string, instructions: string): void {
    this.dialog.open(InstructionsDialog, {
      width: '80%',
      minHeight: '86%',
      data: {scale: scale, instructions: instructions}
    });
  }

  /*
   * This function interacts with an Amazon S3 bucket to retrieve the instructions for the current task.
   * It performs a download operation using the references received from the main component.
   */
  public async performInstructionsLoading() {
    return await this.download(this.instructionsFile);
  }

  /*
   * This function performs a GetObject operation to Amazon S3 and returns a raw HTML string which is the requested resource.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
   * */
  public async download(path: string) {
    return (await (this.s3.getObject({
      Bucket: this.bucket,
      Key: path
    }).promise())).Body.toString('utf-8');
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
