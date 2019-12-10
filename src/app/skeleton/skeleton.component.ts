import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {HitsService,} from "../services/hits.service";
import {S3Service} from "../services/s3.service";
import {ConfigService} from "../services/config.service";
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {Document} from "../models/document";
import {Hit} from "../models/hit";
import {MatStepper} from "@angular/material/stepper";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class Skeleton {

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
      new FormControl('', [Validators.required]),
      new FormControl('', [Validators.required]),
      new FormControl('', [Validators.required]),
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

    this.amountTry = 2;

  }

  // HIT FETCHING FUNCTION

  public performCheckAndLoad(): void {

    this.hitsService.loadJSON(this.configService.environment.hitsPath).subscribe(
      hits => {

        this.ngxService.start();

        let allowed = true;

        for (let currentHit of hits) {
          if (this.tokenInput.value === currentHit.token_input) {
            this.hit = currentHit;
            this.tokenOutput = currentHit.token_output;
          }
        }

        // HTTP GET TO CHECK

        if (allowed) {
          this.documents = new Array<Document>();
          this.S3Service.retrieveDocument(this.hit.document_1).subscribe(document => this.documents.push(document));
          this.S3Service.retrieveDocument(this.hit.document_2).subscribe(document => this.documents.push(document));
          this.S3Service.retrieveDocument(this.hit.document_3).subscribe(document => this.documents.push(document));
          this.tokenInputFound = true;
          this.taskStarted = true;
        } else {
          this.tokenInputFound = true;
          this.taskStarted = false;
          this.taskCompleted = true;
          this.taskSuccessful = false;
          this.taskFailed = true;
        }

        this.changeDetector.detectChanges();
        this.ngxService.stop();

      }
    );

  }

  // LOGGING FUNCTION

  public performLogging() {

    console.log(this.tokenForm.value);
    console.log(this.hitForm.value);

  }

  // Function to perform the final check on the current HIT and handle success/failure of the task
  public performFinalCheck() {

    /* Start the spinner */

    this.ngxService.start();

    /* Control variables to start final check */

    this.taskStarted = false;
    this.taskCompleted = true;

    /* The final check on the variables must be performed here */

    console.log(this.tokenForm.value);
    console.log(this.hitForm.value);

    /* Control variables to handle final check outcome */

    this.taskSuccessful = false;
    this.taskFailed = true;

    /* Detect changes within the DOM and stop the spinner */

    this.changeDetector.detectChanges();
    this.ngxService.stop();

  }

  // RESET FUNCTION

  public performReset() {

    this.ngxService.start();

    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted = true;
    
    this.stepper.selectedIndex=1;

    this.amountTry = this.amountTry - 1;

    this.ngxService.stop();

  }

  // UTILITY FUNCTIONS

  public checkError(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

  public getErrorMessage(form: FormGroup, field: string, key: string): string {
    return form.get(field).errors[key]
  }

}

