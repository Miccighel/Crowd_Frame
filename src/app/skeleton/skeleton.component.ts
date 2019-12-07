import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {HitsService,} from "../services/hits.service";
import {S3Service} from "../services/s3.service";
import {ConfigService} from "../services/config.service";
import {NgxUiLoaderService} from 'ngx-ui-loader';
import {Document} from "../models/document";
import {Hit} from "../models/hit";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class Skeleton {

  // CHANGE DETECTOR

  changeDetector: ChangeDetectorRef;

  // PROVIDER SERVICES

  ngxService: NgxUiLoaderService;
  configService: ConfigService;
  hitsService: HitsService;
  S3Service: S3Service;

  // CONTROL BOOLEANS

  tokenInputFound: boolean;
  taskStarted: boolean;
  taskCompleted: boolean;
  taskSuccessful: boolean;
  taskFailed: boolean;

  // TOKEN INPUT ELEMENTS

  tokenForm: FormGroup;
  tokenInput: FormControl;

  // HIT ATTRIBUTES AND ELEMENTS

  hit: Hit;
  amountTry: number;

  hitForm: FormGroup;
  profession: FormControl;
  about: FormControl;
  age: FormControl;
  opinions: FormArray;

  // MODELS

  documentsNumber: number;
  documents: Array<Document>;

  // TOKEN OUTPUT ELEMENTS

  tokenOutput: string;

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

    this.amountTry = 2;

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

  // FINAL CHECK FUNCTION

  public performFinalCheck() {

    this.ngxService.start();
    this.taskStarted = false;
    this.taskCompleted = true;

    console.log(this.tokenForm.value);
    console.log(this.hitForm.value);

    this.taskSuccessful = true;
    //this.taskFailed = true;

    this.changeDetector.detectChanges();
    this.ngxService.stop();

  }

  // RESET FUNCTION

  public performReset() {

    this.ngxService.start();

    this.amountTry = this.amountTry - 1;

    this.taskFailed = false;
    this.taskSuccessful = false;
    this.taskCompleted = false;
    this.taskStarted=true;

    this.hitForm.reset();

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

