import {Component} from '@angular/core';
import {ConfigService} from "../../services/config.service";
import {NgxUiLoaderService} from "ngx-ui-loader";
import {S3Service} from "../../services/s3.service";

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
  S3Service: S3Service;

  selectionPerformed: boolean
  actionChosen: string

  constructor(
    ngxService: NgxUiLoaderService,
    configService: ConfigService,
    S3Service: S3Service,
  ) {

    /* |--------- SERVICES - INITIALIZATION ---------| */

    this.configService = configService;
    this.ngxService = ngxService;
    this.S3Service = S3Service;

    this.selectionPerformed = false

    /* |--------- GENERAL ELEMENTS - INITIALIZATION ---------| */

    this.taskName = this.configService.environment.taskName;
    this.batchName = this.configService.environment.batchName;

    let url = new URL(window.location.href);
    this.workerIdentifier = url.searchParams.get("workerID");

  }

  public loadAction(actionChosen: string) {

    this.ngxService.start()

    this.actionChosen = actionChosen
    this.selectionPerformed = true

    if (this.actionChosen == "perform") {
      this.ngxService.stop()
    } else {
      this.ngxService.stop()
    }

  }


}
