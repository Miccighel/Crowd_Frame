//TODO init for the moment is static (HORRIBLE) and used to check if the logger object was instanced. A major fix in the framework is needed (double constructor instancing and ngOnInit call)
/*
* TODO
* TODO
* TODO
*/
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Injectable} from "@angular/core";

/*
* This class offers a logging system for the platform. As a Service, the class is instanced as a Singleton in skeleton.component.ts
* */

@Injectable()
export class ActionLogger {
  private logSeq: number;
  private readonly initTime: Date;
  private workerID: string;
  private taskName: string;
  private batchName: string;
  static init = false;
  private headers : HttpHeaders

  constructor(private http: HttpClient){
    this.logSeq = 0;
    this.initTime = new Date();
    this.headers = new HttpHeaders();
    this.headers.append('content-type', 'application/json')
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

    this.http.post('https://8vd1uyg771.execute-api.us-east-1.amazonaws.com/logger/log', payload)
  }

  logInit(workerID, taskName, batchName){
    if(!ActionLogger.init) {
      ActionLogger.init = true;
      this.workerID = workerID;
      this.taskName = taskName;
      this.batchName = batchName;

      let details = {
        screen_size : {width : window.screen.width, height : window.screen.height},
        window_size : {width : window.innerWidth, height: window.innerHeight}
      }
      this.logAction('test', details)
    }
  }

  onClick(){
    console.log(this.initTime)
  }
}
