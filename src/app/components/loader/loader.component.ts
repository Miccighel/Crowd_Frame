import {ChangeDetectionStrategy, ChangeDetectorRef, Component} from '@angular/core';
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {S3Service} from "../../services/s3.service";
import * as crypto from 'crypto-js';
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Instruction} from "../../models/shared/instructions";

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
  ngxService: NgxUiLoaderService;
  S3Service: S3Service;

  selectionPerformed: boolean
  actionChosen: string
  loginPerformed: boolean
  loginSuccessful: boolean
  instructionsRead: boolean

  loginForm: FormGroup;
  username: FormControl;
  password: FormControl;

  snackBar: MatSnackBar

  /* Instructions to perform the task */
  instructions: Array<Instruction>;
  /* Amount of instructions sentences */
  instructionsAmount: number;

  constructor(
    changeDetector: ChangeDetectorRef,
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
    formBuilder: FormBuilder,
    snackBar: MatSnackBar
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.changeDetector = changeDetector;
    this.configService = configService;
    this.ngxService = ngxService;
    this.S3Service = S3Service;

    this.selectionPerformed = false

    this.snackBar = snackBar

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.adminAccess = false
    this.loginSuccessful = false
    this.loginPerformed = false
    this.actionChosen = null
    this.instructionsRead = false
    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    let url = new URL(window.location.href);
    this.workerIdentifier = url.searchParams.get("workerID");
    this.adminAccess = url.pathname.indexOf("admin") != -1;

    this.username = new FormControl('kevin_roitero', [Validators.required]);
    this.password = new FormControl('DBegSUGED5zmXb9J', [Validators.required]);
    this.loginForm = formBuilder.group({
      "username": this.username,
      "password": this.password
    });

  }

  public async loadAction(actionChosen: string) {
    this.actionChosen = actionChosen
    this.selectionPerformed = true
  }

  public async performAdminCheck() {
    //let res = crypto.AES.encrypt(JSON.stringify({"username": "kevin_roitero"}), "DBegSUGED5zmXb9J")
    if (this.loginForm.valid) {
      let admins = await this.S3Service.downloadAdministrators(this.configService.environment)
      for (let admin of admins) {
        let decrypted = crypto.AES.decrypt(admin["crypt"], this.password.value)
        let decryptedData = decrypted.toString()
        if (decryptedData != "") {
          let adminData = JSON.parse(decryptedData)
          if (adminData['username'] == this.username.value) {
            admin = adminData['username']
            this.loginSuccessful = true
            break;
          }
        }
      }
      this.loginPerformed = true
      this.changeDetector.detectChanges()
      if (this.loginSuccessful) {
        this.showSnackbar(`Login successful. Welcome back, ${this.username.value}.`, "Dismiss", 5000)
      } else {
        this.showSnackbar("Login unsuccessful. Please, review your credentials and try again.", "Dismiss", 5000)
      }
      this.changeDetector.detectChanges()
    }
  }

  /* |--------- UTILITIES ELEMENTS - FUNCTIONS ---------| */

  public showSnackbar(message, action, duration) {
    this.snackBar.open(message, action, {
      duration: duration,
    });
  }

  /*
   * This function retrieves the string associated to an error code thrown by a form field validator.
   */
  public checkFormControl(form: FormGroup, field: string, key: string): boolean {
    return form.get(field).hasError(key);
  }

}

