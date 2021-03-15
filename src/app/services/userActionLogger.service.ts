import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Injectable} from "@angular/core";

/*
* This class offers a logging system for the platform. As a Service, the class is instanced as a Singleton in skeleton.component.ts
*/

@Injectable({
  providedIn: 'root',
})
export class ActionLogger {
  private sequenceNumber: number;
  private readonly initTime: number;
  private workerID: string;
  private taskName: string;
  private batchName: string;
  private http: HttpClient;
  private init = false;  // This variable is only needed to not send double request on ngInit

  /**
   * Default constructor
   * Initialize the sequence number to 0 and the initialization time of the logger
   */
  constructor(){
    this.sequenceNumber = 0;
    this.initTime = new Date().getTime()/1000;
  }

  /**
   * Construct a payload for the http request from given details
   * @param type of the action that generated the log
   * @param details of the event
   */
  buildPayload(type: string, details: object){
    return {
      type : type,
      worker : this.workerID,
      task : this.taskName,
      batch : this.batchName,
      action_time : new Date().getTime(),
      sequence : this.sequenceNumber++,
      details: details
    }
  }

  /**
   * Send the POST request to the gateway to log the event
   * @param type of the action that generated the log
   * @param details of the event
   */
  log(type: string, details: object) {
    let payload = this.buildPayload(type, details)

    // this.http.post(
    //   'https://8vd1uyg771.execute-api.us-east-1.amazonaws.com/logger/log',
    //   payload,
    //   {
    //     responseType: 'text',
    //     headers: new HttpHeaders()
    //       .set('content-type', 'text/plain')
    //   }).subscribe()
  }

  /**
   * This function is called once to log the context information of the session
   */
  logContext(){
    let payload = this.buildPayload('context', null)

    //this.http.post('https://8vd1uyg771.execute-api.us-east-1.amazonaws.com/logger/stats', payload).subscribe(data => console.log(data))
  }

  /**
   * First log function called. Sets session-bounded variables, calls logContext and logs basic information about the session
   * @param workerID
   * @param taskName
   * @param batchName
   * @param http client initialized by the skeleton
   */
  logInit(workerID: string, taskName: string, batchName: string, http: HttpClient){
    if(!this.init) {
      this.init = true

      this.http = http;
      this.workerID = workerID;
      this.taskName = taskName;
      this.batchName = batchName;

      let details = {
        screen_size : {width : window.screen.width, height : window.screen.height},
        window_size : {width : window.innerWidth, height: window.innerHeight}
      }

      this.logContext()
      this.log('init', details)
    }
  }

  buttonClick(event){
    console.log(event.type)
  }

  windowClick(event){
    console.log(event.type)
  }

  onCopy(event){
    console.log(event)
  }

  onPaste(event){
    console.log(event.clipboardData.getData('text'))
  }

  onCut(event){
    console.log(event)
  }
}
