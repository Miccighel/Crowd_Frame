import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms'
import {S3Service} from "../s3.service";

@Component({
  templateUrl: './crowdForm.component.html',
  styleUrls: ['./crowdForm.component.scss']
})

export class CrowdFormComponent implements OnInit {

  s3Service : S3Service;
  isEditable = true;
  firstFormGroup: FormGroup;

  pagesNumber = 8;
  pages = new Array<TaskPage>();

  @ViewChild("mturkCodes", {static: false}) mturkInput: ElementRef;


  constructor(private _formBuilder: FormBuilder, s3service: S3Service) {
    this.s3Service = s3service;
    for (let i = 0; i < this.pagesNumber; i++) {
      this.s3Service.retrieveDocument("d1.json").subscribe(
        searchResponse => {
          this.pages[i] = new TaskPage(i, searchResponse.text)
        }
      );
    }

  }
  ngOnInit() {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', Validators.required]
    });
  }

  ngAfterViewInit(){

    console.log(this.mturkInput.nativeElement.children);

    console.log(this.mturkInput.nativeElement.children[0].innerHTML);

  }

}

class TaskPage {

  number: number;
  text: string;

  constructor(number: number, text: string) {
    this.number = number;
    this.text = text;
  }

}

