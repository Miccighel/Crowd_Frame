import {Component, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {HitsService,} from "../services/hits.service";
import {S3Service} from "../services/s3.service";
import {ConfigService} from "../services/config.service";
import { NgxUiLoaderService } from 'ngx-ui-loader';
import {Document} from "../models/document";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss']
})

export class Skeleton implements OnInit{

  ngxService: NgxUiLoaderService;
  configService: ConfigService;
  hitsService: HitsService;
  S3Service: S3Service;

  crowdForm: FormGroup;
  tokenInput: FormControl;
  profession: FormControl;
  about: FormControl;
  age: FormControl;
  opinions: FormArray;

  documentsNumber: number;
  documents: Array<Document>;

  constructor(
    formBuilder: FormBuilder,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    hitsService: HitsService,
    S3Service: S3Service,
  ) {

    this.configService = configService;
    this.ngxService = ngxService;
    this.hitsService = hitsService;
    this.S3Service = S3Service;

    this.tokenInput = new FormControl('token_input_1', [Validators.required], this.hitsService.validateTokenInput(this.configService.environment.hitsPath));
    this.profession = new FormControl('', [Validators.required, Validators.minLength(5)]);
    this.about = new FormControl('', [Validators.required, Validators.minLength(20)]);
    this.age = new FormControl('', [Validators.required]);
    this.opinions = new FormArray([
      new FormControl('', [Validators.required]),
      new FormControl('', [Validators.required]),
      new FormControl('', [Validators.required]),
    ]);

    this.crowdForm = formBuilder.group({
      "tokenInput": this.tokenInput,
      "age": this.age,
      "profession": this.profession,
      "about": this.about,
      "opinions": this.opinions,
    });

  }

  ngOnInit() {}

  public checkError = (field: string, key: string): boolean => {
    return this.crowdForm.get(field).hasError(key);
  };

  public getErrorMessage(field: string, key: string): string {
    return this.crowdForm.get(field).errors[key]
  }

  public loadHits() {
    this.hitsService.loadJSON(this.configService.environment.hitsPath).subscribe(
      hits => {
        this.ngxService.start();
        let hit = null;
        for (let currentHit of hits) {
          if (this.tokenInput.value === currentHit.token_input) {
            hit = currentHit;
          }
        }
        this.documents = new Array<Document>();
        this.S3Service.retrieveDocument(hit.document_1).subscribe(document => this.documentsNumber = this.documents.push(document));
        this.S3Service.retrieveDocument(hit.document_2).subscribe(document => this.documentsNumber = this.documents.push(document));
        this.S3Service.retrieveDocument(hit.document_3).subscribe(document => this.documentsNumber = this.documents.push(document));
        this.ngxService.stop();
      }
    );
  }

}

