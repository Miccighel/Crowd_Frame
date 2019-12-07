import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
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

  @ViewChild('stepper', {static:false}) stepper;

  changeDetector: ChangeDetectorRef;

  ngxService: NgxUiLoaderService;
  configService: ConfigService;
  hitsService: HitsService;
  S3Service: S3Service;

  taskStarted: boolean;
  taskCompleted: boolean;
  taskSuccessful: boolean;

  hit: Hit;

  crowdForm: FormGroup;
  tokenInput: FormControl;
  profession: FormControl;
  about: FormControl;
  age: FormControl;
  opinions: FormArray;

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

    this.configService = configService;
    this.ngxService = ngxService;
    this.hitsService = hitsService;
    this.S3Service = S3Service;

    this.taskStarted = false;
    this.taskCompleted = false;
    this.taskSuccessful = false;


    this.tokenInput = new FormControl('token_input_1', [Validators.required], this.hitsService.validateTokenInput(this.configService.environment.hitsPath));
    this.profession = new FormControl('This is the profession', [Validators.required, Validators.minLength(5)]);
    this.about = new FormControl('This is the about', [Validators.required, Validators.minLength(10)]);
    this.age = new FormControl('20+', [Validators.required]);
    this.opinions = new FormArray([
      new FormControl('This is the first opinion', [Validators.required]),
      new FormControl('This is the second opinion', [Validators.required]),
      new FormControl('This is the third opinion', [Validators.required]),
    ]);

    this.crowdForm = formBuilder.group({
      "tokenInput": this.tokenInput,
      "age": this.age,
      "profession": this.profession,
      "about": this.about,
      "opinions": this.opinions,
    });

  }

  public checkError(field: string, key: string): boolean {
    return this.crowdForm.get(field).hasError(key);
  }

  public getErrorMessage(field: string, key: string): string {
    return this.crowdForm.get(field).errors[key]
  }

  public loadHit(): void {
    this.hitsService.loadJSON(this.configService.environment.hitsPath).subscribe(
      hits => {
        this.ngxService.start();
        for (let currentHit of hits) {
          if (this.tokenInput.value === currentHit.token_input) {
            this.hit = currentHit;
          }
        }
        this.documents = new Array<Document>();
        this.S3Service.retrieveDocument(this.hit.document_1).subscribe(document => this.documents.push(document));
        this.S3Service.retrieveDocument(this.hit.document_2).subscribe(document => this.documents.push(document));
        this.S3Service.retrieveDocument(this.hit.document_3).subscribe(document => this.documents.push(document));
        this.ngxService.stop();
        this.taskStarted = true;
        this.changeDetector.detectChanges();
      }
    );
  }

  public performFinalCheck() {

    this.ngxService.start();

    this.taskCompleted = true;

    console.log("---------- CHECKING QUESTIONNAIRE ----------");
    console.log(`AGE: ${this.crowdForm.value}`);
    console.log(this.crowdForm.value["age"]);
    console.log(`PROFESSION: ${this.crowdForm.value}`);
    console.log(this.crowdForm.value["profession"]);
    console.log(`ABOUT: ${this.crowdForm.value}`);
    console.log(this.crowdForm.value["about"]);

    console.log("---------- CHECKING DOCUMENTS ----------");


    this.taskSuccessful = true;

    this.ngxService.stop();

    this.changeDetector.detectChanges();

  }

}

