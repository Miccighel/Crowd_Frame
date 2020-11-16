import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {S3Service} from "../../services/s3.service";
import * as crypto from 'crypto-js';
import {AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class LoaderComponent {

  /* Name of the current task */
  taskName: string;

  /* Change detector to manually intercept changes on DOM */
  changeDetector: ChangeDetectorRef;

  /* Sub name of the current task */
  batchName: string;

  /* Unique identifier of the current worker */
  workerIdentifier: string;

  adminAccess: boolean;

  /* |--------- GENERAL ELEMENTS - DECLARATION ---------| */

  /* Service to provide an environment-based configuration */
  configService: ConfigService;
  /* Service to provide loading screens */
  /* Service to provide loading screens */
  ngxService: NgxUiLoaderService;
  S3Service: S3Service;

  selectionPerformed: boolean
  actionChosen: string
  loginSuccessful: boolean

  loginForm: FormGroup;
  username: FormControl;
  password: FormControl;

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
    formBuilder: FormBuilder,
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.changeDetector = changeDetector;
    this.configService = configService;
    this.ngxService = ngxService;
    this.S3Service = S3Service;

    this.selectionPerformed = false

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.adminAccess = false
    this.loginSuccessful = false
    this.actionChosen = null
    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    let url = new URL(window.location.href);
    this.workerIdentifier = url.searchParams.get("workerID");
    this.adminAccess = url.pathname.indexOf("admin") != -1;

    this.username = new FormControl('kevin_roitero', [Validators.required]);
    this.password = new FormControl('', [Validators.required]);
    this.loginForm = formBuilder.group({
      "username": this.username,
      "password": this.password
    });

  }

  public async loadAction(actionChosen: string) {

    this.actionChosen = actionChosen
    this.selectionPerformed = true

  }

  public async checkAdmin() {
    let loginOutcome = false
    if (this.loginForm.valid) {
      let admins = await this.S3Service.downloadAdministrators(this.configService.environment)
      for (let admin of admins) {
        let decrypted = crypto.AES.decrypt(admin["crypt"], this.password.value)
        let decryptedData = decrypted.toString(crypto.enc.Utf8)
        if (decryptedData != "") {
          let adminData = JSON.parse(decryptedData)
          if (adminData['username'] == this.username.value) {
            this.loginSuccessful = true
            break;
          }
        }
      }
      this.changeDetector.detectChanges()
    }
  }

  /* |--------- UTILITIES ELEMENTS - FUNCTIONS ---------| */

  /*
   * This function retrieves the string associated to an error code thrown by a form field validator.
   */
  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

}

