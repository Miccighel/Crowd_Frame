import {Component, OnInit} from '@angular/core';
import * as AWS from "aws-sdk";
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})

export class LoaderComponent {

  /* Name of the current task */
  taskName: string;

  /* Sub name of the current task */
  batchName: string;

  /* Unique identifier of the current worker */
  workerIdentifier: string;

  /* Unique identifier of the current admin */
  adminIdentifier: string;

  /* |--------- GENERAL ELEMENTS - DECLARATION ---------| */

  /* Service to provide an environment-based configuration */
  configService: ConfigService;
  /* Service to provide loading screens */
  ngxService: NgxUiLoaderService;

  selectionPerformed: boolean
  actionChosen: string

  /* |--------- AMAZON AWS INTEGRATION - DECLARATION ---------| */

  /* AWS S3 Integration*/
  s3: AWS.S3;
  /* Region identifier */
  region: string;
  /* Bucket identifier */
  bucket: string;
  /* Folder to use within the bucket */
  folder: string;
  /* File where some general settings are stored */
  settingsFile: string;
  /* File where task instructions are stored */
  taskInstructionsFile: string;
  /* File where each worker identifier is stored */
  workersFile: string;
  /* File where each questionnaire is stored */
  questionnairesFile: string;
  /* File where each instruction for dimension assessing is stored */
  dimensionsInstructionsFile: string;
  /* File where each dimension to assess is stored */
  dimensionsFile: string;
  /* File where each hit is stored */
  hitsFile: string;
  /* Folder in which upload data produced within the task by current worker */
  workerFolder: string;

  constructor(
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.configService = configService;
    this.ngxService = ngxService;

    this.selectionPerformed = false

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    let url = new URL(window.location.href);
    this.workerIdentifier = url.searchParams.get("workerID");
    this.adminIdentifier = url.searchParams.get("adminID");

    /* |--------- AMAZON AWS INTEGRATION - INITIALIZATION ---------| */

    this.region = this.configService.environment.region;
    this.bucket = this.configService.environment.bucket;
    if (this.configService.environment.batchName) {
      this.folder = `${this.taskName}/${this.batchName}`
    } else {
      this.folder = `${this.taskName}/`
    }
    this.settingsFile = `${this.folder}/Task/task.json`;
    this.taskInstructionsFile = `${this.folder}/Task/instructions_main.json`;
    this.workersFile = `${this.folder}/Task/workers.json`;
    this.questionnairesFile = `${this.folder}/Task/questionnaires.json`;
    this.dimensionsInstructionsFile = `${this.folder}/Task/instructions_dimensions.json`;
    this.dimensionsFile = `${this.folder}/Task/dimensions.json`;
    this.hitsFile = `${this.folder}/Task/hits.json`;
    this.workerFolder = `${this.folder}/Data/${this.workerIdentifier}`;
    this.s3 = new AWS.S3({
      region: this.region,
      params: {Bucket: this.bucket},
      credentials: new AWS.Credentials(this.configService.environment.aws_id_key, this.configService.environment.aws_secret_key)
    });

  }

  public loadAction(actionChosen: string) {

    this.ngxService.start()

    this.actionChosen = actionChosen
    this.selectionPerformed = true

    if (this.actionChosen == "perform") {
      this.loadSkeleton()
    } else {
      this.ngxService.stop()
    }


  }

  public async loadSkeleton() {
    let settings = await this.download(this.settingsFile);
    console.log(settings)
    this.ngxService.stop()
  }

  /*
   * This function performs a GetObject operation to Amazon S3 and returns a parsed JSON which is the requested resource.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
   */
  public async download(path: string) {
    return JSON.parse(
      (await (this.s3.getObject({
        Bucket: this.bucket,
        Key: path
      }).promise())).Body.toString('utf-8')
    );
  }

}
