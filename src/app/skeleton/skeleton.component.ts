import {Component} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {HitsService} from "../services/data.service";
import {S3Service} from "../services/s3.service";
import {ConfigService} from "../services/config.service";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss']
})

export class Skeleton {

  // SERVICES

  configService: ConfigService;
  hitsService: HitsService;
  S3Service: S3Service;

  // FORM ATTRIBUTES

  isEditable = true;
  crowdForm: FormGroup;
  firstName = new FormControl('', Validators.required);

  // MODEL ATTRIBUTES

  documentsNumber = 3;
  documents = new Array<Document>();

  constructor(
    formBuilder: FormBuilder,
    configService: ConfigService,
    hitsService: HitsService,
    S3Service: S3Service
  ) {

    this.configService = configService;
    this.hitsService = hitsService;
    this.S3Service = S3Service;

    this.hitsService.loadJSON(this.configService.environment.hitsPath).subscribe(
      response => {
        console.log(response[0].unit_id)
      }
    );

    this.crowdForm = formBuilder.group({
      "firstName": this.firstName,
    });


    for (let number = 0; number < this.documentsNumber; number++) {
      this.S3Service.retrieveDocument(`d${number + 1}.json`).subscribe(
        response => {
        }
      );
    }

  }
  
}
