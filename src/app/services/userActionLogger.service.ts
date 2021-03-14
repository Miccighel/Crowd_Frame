import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Injectable} from "@angular/core";

/*
* This class offers a logging system for the platform. As a Service, the class is instanced as a Singleton in skeleton.component.ts
*/

@Injectable({
  providedIn: 'root',
})
export class ActionLogger {
  private logSeq: number;
  private readonly initTime: Date;
  private workerID: string;
  private taskName: string;
  private batchName: string;
  private http: HttpClient;
  private init = false;  // This variable is only needed to not send double request on ngInit

  constructor(){
    this.logSeq = 0;
  }

  logAction(type, details){
    let payload = {
      type : type,
      worker : this.workerID,
      task : this.taskName,
      batch : this.batchName,
      timestamp : new Date(),
      sequence : this.logSeq++,
      details: details
    }

    console.log(payload)

    // this.http.post(
    //   'https://8vd1uyg771.execute-api.us-east-1.amazonaws.com/logger/log',
    //   payload,
    //   {
    //     responseType: 'text',
    //     headers: new HttpHeaders()
    //       .set('content-type', 'text/plain')
    //   }).subscribe()
  }

  logInit(workerID, taskName, batchName, http){
    this.workerID = workerID;
    this.taskName = taskName;
    this.batchName = batchName;
    this.http = http;

    let details = {
      screen_size : {width : window.screen.width, height : window.screen.height},
      window_size : {width : window.innerWidth, height: window.innerHeight}
    }

    if(!this.init) {
      this.init = true;
      this.logAction('init', details)
    }
  }

  onClick(event){
    this.logAction('click', event)
  }
}
