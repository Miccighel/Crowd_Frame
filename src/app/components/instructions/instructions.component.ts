/* Core modules*/
import {Component, Inject, Input, Output, OnInit, ViewEncapsulation, EventEmitter} from '@angular/core';
/* Material design modules */
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import * as AWS from "aws-sdk";
/* Debug config import */
import * as localRawInstructionsMain from '../../../../data/debug/instructions_main.json';
/* Task models*/
import {Instruction} from "../../models/shared/instructions";
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
  /* @INPUT: Received from Skeleton component */
  @Input() scale: string;
  /* Reference to check if the local debug config should be used */
  /* @INPUT: Received form Skeleton component */
  @Input() configurationLocal: boolean;
  /* Reference to the S3 component of AWS SDK */
  /* @INPUT: Received form Skeleton component */
  @Input() s3: AWS.S3;
  /* Reference to the current bucket identifier */
  /* @INPUT: Received form Skeleton component */
  @Input() bucket: string;
  /* Reference to the file where task instructions are stored */
  /* @INPUT: Received form Skeleton component */
  @Input() instructionsFile: string;

  /* |--- TASK GENERATOR ---| */
  @Input() public generator: boolean;
  @Input() public taskStarted: boolean;
  @Output() private toggleGenerator: EventEmitter<boolean>;

  /* Instructions to perform the task */
  instructions: Array<Instruction>;
  /* Amount of instructions sentences */
  instructionsAmount: number;

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialog: MatDialog) {

    /* |--- TASK GENERATOR ---| */
    this.toggleGenerator = new EventEmitter<boolean>();
  }

  /* |--- TASK GENERATOR ---| */
  onToggleGenerator(event) {
    this.toggleGenerator.emit(this.generator);
  }

  /* |--------- ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function inits an instance of the instruction modal after main view init.
   */
  ngOnInit(): void {
    this.performInstructionsLoading().then(outcome => {
      this.openDialog(this.instructions)
    })
  }

  /*
   * This function opens the modal and loads its look&feel and content.
   */
  openDialog(instructions: Array<Instruction>): void {
    this.dialog.open(InstructionsDialog, {
      width: '80%',
      minHeight: '86%',
      data: {instructions: instructions}
    });
  }

  /*
   * This function interacts with an Amazon S3 bucket to retrieve the instructions for the current task.
   * It performs a download operation using the references received from the main component.
   */
  public async performInstructionsLoading() {
    let rawInstructions = (this.configurationLocal) ? localRawInstructionsMain["default"] : await this.download(this.instructionsFile);
    this.instructionsAmount = rawInstructions.length;
    /* The instructions are parsed using the Instruction class */
    this.instructions = new Array<Instruction>();
    for (let index = 0; index < this.instructionsAmount; index++){
      this.instructions.push(new Instruction(index, rawInstructions[index]));
    }
  }

  /*
   * This function performs a GetObject operation to Amazon S3 and returns a raw HTML string which is the requested resource.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
   * */
  public async download(path: string) {
    return JSON.parse(
      (await (this.s3.getObject({
        Bucket: this.bucket,
        Key: path
      }).promise())).Body.toString('utf-8')
    );
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

  /* |---------  ELEMENTS - DECLARATION ---------| */

  scale: string;
  instructions: string;

  /* |--------- CONSTRUCTOR ---------| */

  constructor(public dialogRef: MatDialogRef<InstructionsDialog>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
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
