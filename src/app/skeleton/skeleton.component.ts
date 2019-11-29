import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms'
import {S3Service} from "../s3.service";

@Component({
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss']
})

export class Skeleton implements OnInit {

  S3Service: S3Service;

  isEditable = true;
  documentsNumber = 3;
  documents = new Array<Document>();

  crowdForm: FormGroup;
  firstName = new FormControl('', Validators.required);


  //@ViewChild("mturkCodes", {static: false}) mturkInput: ElementRef;

  constructor(formBuilder: FormBuilder, S3Service: S3Service) {

    this.crowdForm = formBuilder.group({
      "firstName": this.firstName,
    });

    this.S3Service = S3Service;
    for (let number = 0; number < this.documentsNumber; number++) {
      this.S3Service.retrieveDocument(`d${number+1}.json`).subscribe(
        response => {
          this.documents[number] = new Document(number, response.text)
        }
      );
    }

  }

  ngOnInit() {}

  ngAfterViewInit() {
    // console.log(this.mturkInput.nativeElement.children[0]);
  }

}

class Document {

  number: number;
  text: string;

  constructor(number: number, text: string) {
    this.number = number;
    this.text = text;
  }

}

