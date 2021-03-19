import {HttpClient, HttpHeaders} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {SectionService} from "./section.service";

/*
* This class offers a logging system for the platform. As a Service, the class is instanced as a Singleton in skeleton.component.ts
*/

@Injectable({
  providedIn: 'root',
})
export class ActionLogger {
  private sectionService: SectionService;
  private loggerSection: string;
  private sequenceNumber: number;
  private readonly initTime: number;
  private workerID: string;
  private taskName: string;
  private batchName: string;
  private http: HttpClient;
  private init = false;  // This variable is only needed to not send double request on ngInit

  /*
   * Default constructor
   * Initialize the sequence number to 0 and the initialization time of the logger
   */
  constructor(sectionService: SectionService){
    this.sectionService = sectionService;
    this.loggerSection = this.findSection();
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
      client_time : new Date().getTime(),
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

  /**
   * This function is called once to log the context information of the session
   */
  logContext(){
    let payload = this.buildPayload('context', null)
    console.log(payload)
    this.http.post('https://8vd1uyg771.execute-api.us-east-1.amazonaws.com/logger/stats', payload).subscribe()
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

      console.log(navigator)

      let details = {
        screen_size : {
          width : window.screen.width,
          height : window.screen.height
        },
        window_size: this.getCurrentSize()
      }

      this.logContext()
      this.log('init', details)
    }
  }

  /**
   * Log a button click
   * @param obj mapped event object {buttonName, timeStamp, x, y}
   */
  buttonClick(obj){
    let section = this.loggerSection
    this.loggerSection = this.findSection()
    if(section != this.loggerSection){
      this.windowResize(obj)
    }
    let details = {
      section: section,
      button: obj.buttonName,
      timeStamp: obj.timeStamp,
      x: obj.x,
      y: obj.y
    }
    this.log('button', details)
  }

  /**
   * Log a generic click on the skeleton
   * @param obj mapped event object {timeStamp, x, y, target}
   */
  windowClick(obj){
    if (document.getSelection().toString() !== ""){
      this.onSelect(obj.timeStamp)
    } else {
      let details = {
        section: this.findSection(),
        timeStamp: obj.timeStamp,
        mouseButton: obj.mouseButton,
        x: obj.x,
        y: obj.y,
        target: obj.target
      }
      this.log('click', details)
    }
  }

  /**
   * Log an array of mouse movements
   * @param positionBuffer array of objects {timeStamp, x, y}
   */
  mouseMove(positionBuffer){
    let details = {
      section: this.findSection(),
      points: positionBuffer
    }
    this.log('movements', details)
  }

  /**
   * Log a copy event
   * @param obj mapped event object {timeStamp, target}
   */
  onCopy(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      target: document.getSelection().toString()
    }
    this.log('copy', details)
  }

  /**
   * Log a cut event
   * @param obj mapped event object {timeStamp, target}
   */
  onCut(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      target: document.getSelection().toString()
    }
    this.log('cut', details)
  }

  /**
   * Log a paste event on an textarea element
   * @param obj mapped event object {timeStamp, text}
   */
  onPaste(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      text: obj.text
    }
    this.log('paste', details)
  }

  /**
   * Log window dimensions after a resize
   * Call aux function getCurrentSize()
   * @param obj mapped event object {timeStamp}
   */
  windowResize(obj){
    let details = this.getCurrentSize()
    details['timeStamp'] = obj.timeStamp
    this.log('resize', details)
  }

  /**
   * Log window focus
   * @param obj mapped event object {timeStamp}
   */
  windowFocus(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.time
    }
    this.windowResize(obj)
    this.log('window_focus', details)
  }

  /**
   * Log window blur
   * @param obj mapped event object {timeStamp}
   */
  windowBlur(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.time
    }
    this.log('window_blur', details)
  }

  /**
   * Log text selection
   * @param timeStamp
   */
  onSelect(timeStamp){
    let details = {
      section: this.findSection(),
      timeStamp: timeStamp,
      selected: document.getSelection().toString()
    }
    this.log('select', details)
  }

  /**
   * Log scroll info
   * @param obj mapped event object {startTime, endTime}
   */
  onScroll(obj){
    let details = {
      section: this.findSection(),
      startTimeStamp: obj.startTimeStamp,
      endTimeStamp: obj.endTimeStamp,
      x: window.pageXOffset,
      y: window.pageYOffset
    }
    this.log('scroll', details)
  }

  /**
   * Log unload event
   * @param obj mapped event object {timeStamp}
   */
  beforeUnload(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp
    }
    this.log('unload', details)
  }

  /**
   * Log text selection
   * @param obj mapped event object {timeStamp, target}
   */
  textLog(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      value: obj.target
    }
    this.log('text', details)
  }

  /**
   * Log radio button changes
   * @param obj mapped event object {timeStamp, group, value}
   */
  radioChange(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      group: obj.group,
      value: obj.value
    }
     this.log('radioChange', details)
  }

  /**
   * Log keys shortcut
   * @param obj mapped event object {timeStamp, ctrl, alt, key}
   */
  shortcut(obj){
    let details = {
      section: this.findSection(),
      timeStamp: obj.timeStamp,
      ctrl: obj.ctrl,
      alt: obj.alt,
      key: obj.key
    }
    this.log('shortcut', details)
  }

  /**
   * Log consecutive keypress
   * @param obj mapped event object {keySequence, sentence}
   */
  keypress(obj){
    let details = {
      section: this.findSection(),
      keySequence: obj.keySequence,
      sentence: obj.sentence
    }
    this.log('keySequence', details)
  }

  /* ----- UTILITIES ----- */
  getCurrentSize(){
    let scrollWidth = Math.max(
      document.body.scrollWidth, document.documentElement.scrollWidth,
      document.body.offsetWidth, document.documentElement.offsetWidth,
      document.body.clientWidth, document.documentElement.clientWidth
    );
    let scrollHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    );
    return {
      section: this.findSection(),
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      scrollWidth: scrollWidth,
      scrollHeight: scrollHeight
    }
  }

  findSection(){
    return this.sectionService.currentSection
  }
}

//TODO log del motore di ricerca: tutte le richieste, scaricare le pagine dove avviene il click
