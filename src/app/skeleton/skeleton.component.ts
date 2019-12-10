import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {MatStepper} from "@angular/material/stepper";
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {ConfigService} from "../services/config.service";
import {HitsService,} from "../services/hits.service";
import {S3Service} from "../services/s3.service";
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {Document} from "../models/document";
import {Hit} from "../models/hit";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SkeletonComponent {

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  /*
   Services to provide:
   - A loader
   - An environment-based configuration
   - A models for Crowdsourcing hits
   - A model to query Amazon S3
   */
  ngxService: NgxUiLoaderService;
  configService: ConfigService;
  hitsService: HitsService;
  S3Service: S3Service;

  /* Variables to handle the control flow of the task */
  tokenInputFound: boolean;
  taskStarted: boolean;
  taskCompleted: boolean;
  taskSuccessful: boolean;
  taskFailed: boolean;

  /* References to the stepper of the task and to each form element */
  @ViewChild('stepper', {static: false}) stepper: MatStepper;
  tokenForm: FormGroup;
  tokenInput: FormControl;
  hitForm: FormGroup;
  profession: FormControl;
  about: FormControl;
  age: FormControl;
  opinions: FormArray;
  tokenOutput: string;

  /* Number of allowed tries and reference to the current hit */
  amountTry: number;
  hit: Hit;

  /* Task-specific attributes */
  documentsNumber: number;
  documents: Array<Document>;

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    hitsService: HitsService,
    S3Service: S3Service,
    formBuilder: FormBuilder,
  ) {

    this.changeDetector = changeDetector;

    this.ngxService = ngxService;
    this.configService = configService;
    this.hitsService = hitsService;
    this.S3Service = S3Service;

    this.tokenInputFound = false;
    this.taskStarted = false;
    this.taskCompleted = false;
    this.taskSuccessful = false;

    this.tokenInput = new FormControl('', [Validators.required], this.hitsService.validateTokenInput(this.configService.environment.hitsPath));
    this.profession = new FormControl('', [Validators.required, Validators.minLength(5)]);
    this.about = new FormControl('', [Validators.required, Validators.minLength(10)]);
    this.age = new FormControl('', [Validators.required]);
    this.opinions = new FormArray([
      new FormControl('', [Validators.required, Validators.minLength(10)]),
      new FormControl('', [Validators.required, Validators.minLength(10)]),
      new FormControl('', [Validators.required, Validators.minLength(10)]),
    ]);

    this.tokenForm = formBuilder.group({
      "tokenInput": this.tokenInput
    });

    this.hitForm = formBuilder.group({
      "age": this.age,
      "profession": this.profession,
      "about": this.about,
      "opinions": this.opinions,
    });

    this.amountTry = 3;

  }

  /* Function to lookup the input token of the current worker; if it exists, the custom setup of the task shall begin */
  public performCheckAndLoad(): void {

    /* The local JSON file is checked */
    this.hitsService.loadJSON(this.configService.environment.hitsPath).subscribe(
      hits => {

        /* Start the spinner */
        this.ngxService.start();

        /* Scan each entry for the token input */
        let allowed = false;
        for (let currentHit of hits) {
          if (this.tokenInput.value === currentHit.token_input) {
            this.hit = currentHit;
            this.tokenOutput = currentHit.token_output;
            allowed = true;
          }
        }

        /* If the token input is found, the custom setup shall begin, else the worker cannot proceed further */
        if (allowed) {

          /* Control variables to handle to start the task*/
          this.tokenInputFound = true;
          this.tokenInput.disable();
          this.taskStarted = true;

          /* THE CUSTOM SETUP MUST BE PERFORMED HERE*/
          this.documents = new Array<Document>();
          this.S3Service.retrieveDocument(this.hit.document_1).subscribe(document => this.documents.push(document));
          this.S3Service.retrieveDocument(this.hit.document_2).subscribe(document => this.documents.push(document));
          this.S3Service.retrieveDocument(this.hit.document_3).subscribe(document => this.documents.push(document));

        } else {

          /* Control variables to handle to block the task*/
          this.tokenInputFound = true;
          this.taskStarted = false;
          this.taskCompleted = true;
          this.taskSuccessful = false;
          this.taskFailed = true;

        }

        /* Detect changes within the DOM and stop the spinner */
        this.changeDetector.detectChanges();

        /* Stop the spinner */
        this.ngxService.stop();

      }
    );

  }

  /* Function to log worker's work to an external server */
  public performLogging() {

    /* Every value inserted by worker can be found in these two variables */
    console.log(this.tokenForm.value);
    console.log(this.hitForm.value);

  }

  // Function to perform the final check on the current HIT and handle success/failure of the task
  public performFinalCheck() {

    /* Start the spinner */
    this.ngxService.start();

    /* Control variables to start final check */
    this.taskCompleted = true;

    /* THE FINAL CHECK ON THE VARIABLES MUST BE PERFORMED HERE... */
    console.log(this.tokenForm.value);
    console.log(this.hitForm.value);
    /* ...AND SET THE CONTROL VARIABLES ACCORDINGLY */
    this.taskSuccessful = false;
    this.taskFailed = true;

    /* Detect changes within the DOM and stop the spinner */
    this.changeDetector.detectChanges();

    /* Stop the spinner */
    this.ngxService.stop();

  }

  /* Function to restore the status of the task while keeping the token input saved */
  public performReset() {

    /* Start the spinner */
    this.ngxService.start();

    /* Control variables to restore the task */
    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted = true;

    /* Set stepper index to the first tab*/
    this.stepper.selectedIndex = 1;

    /* Decrease the remaining tries amount*/
    this.amountTry = this.amountTry - 1;

    /* Stop the spinner */
    this.ngxService.stop();

  }

  /* Utility functions */

  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

  public formControlErrorMessage(form: FormGroup, field: string, key: string): string {
    let message = "";
    let error = form.get(field).errors[key];
    switch (key) {
      case "minlength": {
        message = `The actual length is ${error['actualLength']}, but it should be at least ${error['requiredLength']}`;
        break;
      }
      case "required": {
        message = `This field is required`;
        break;
      }
    }
    return message
  }

  public checkFormArray(form: FormGroup, field: string, key: string, index: number) {
    let array = form.get(field) as FormArray;
    return array.controls[index].hasError(key)
  }

  public forArrayErrorMessage(form: FormGroup, field: string, key: string, index: number) {
    let message = "";
    let array = form.get(field) as FormArray;
    let error = array.controls[index].errors[key];
    switch (key) {
      case "minlength": {
        message = `The actual length is ${error['actualLength']}, but it should be at least ${error['requiredLength']}`;
        break;
      }
      case "required": {
        message = `This field is required`;
        break;
      }
    }
    return message
  }


}

