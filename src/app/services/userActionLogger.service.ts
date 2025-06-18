import { HttpClient, HttpHeaders } from "@angular/common/http";
import {Injectable} from "@angular/core";
import {SectionService} from "./section.service";
import {S3Service} from "./aws/s3.service";
import {ConfigService} from "./config.service";

/*
* This class offers a logging system for the platform. As a Service, the class is instanced as a Singleton in skeleton.component.ts
*/

@Injectable({
    providedIn: 'root',
})
export class ActionLogger {
    private _opt: Object;
    private _isActive: boolean;
    private sectionService: SectionService;
    private loggerSection: string;
    private sequenceNumber: number;
    private readonly initTime: number;
    private _unitId: string;
    private bucket: string;
    private workerID: string;
    private taskName: string;
    private batchName: string;
    private regionName: string;
    private _endpoint: string;
    private logOnConsole: boolean;
    private http: HttpClient;
    private s3Service: S3Service;
    private configService: ConfigService


    /*
     * Default constructor
     * Initialize the sequence number to 0 and the initialization time of the logger
     */
    constructor(sectionService: SectionService, s3Service: S3Service, configService: ConfigService) {
        this.sectionService = sectionService;
        this.loggerSection = this.findSection();
        this.sequenceNumber = 0;
        this.initTime = new Date().getTime() / 1000;
        this.s3Service = s3Service;
        this.configService = configService
    }

    async downloadOpt() {
        return await this.s3Service.downloadTaskSettings(this.configService.environment)
    }

    /**
     * Construct a payload for the http request from given details
     * @param type of the action that generated the log
     * @param details of the event
     */
    buildPayload(type: string, details: object) {
        let payload = {
            type: type,
            bucket: this.bucket,
            worker: this.workerID,
            task: this.taskName,
            batch: this.batchName,
            region: this.regionName,
            client_time: new Date().getTime(),
            sequence: this.sequenceNumber++,
            details: details
        }
        if (this.unitId != null)
            payload['unitId'] = this.unitId
        return payload
    }

    /**
     * Send the POST request to the gateway to log the event
     * @param type of the action that generated the log
     * @param details of the event
     */
    log(type: string, details: object) {
        let payload = this.buildPayload(type, details);

        if (payload.worker != null) {
            if (this.logOnConsole) {
                console.log(payload)
            } else {

                // SQS requires MessageBody as a string, so we wrap our payload in it
                const body = new URLSearchParams();
                body.set("MessageBody", JSON.stringify(payload)); // Must be a string

                this.http.post(
                    this.endpoint,
                    body.toString(), // Ensure URL-encoded format
                    {
                        responseType: "text",
                        headers: new HttpHeaders().set("Content-Type", "application/x-www-form-urlencoded") // Required by SQS
                    }
                ).subscribe();
            }
        }
    }


    /**
     * This function is called once to log the context information of the session
     */
    logContext() {
        let details = {
            ua: navigator.userAgent
        }
        this.http.get('https://api.ipify.org/?format=json').subscribe(res => {
            details['ip'] = res['ip']
            this.log('context', details)
        })
    }

    /**
     * First log function called. Sets session-bounded variables, calls logContext and logs basic information about the session
     * @param workerID
     * @param taskName
     * @param batchName
     * @param regionName
     * @param http client initialized by the skeleton
     * @param logOnConsole true to log events only on console
     */
    logInit(bucket: string, workerID: string, taskName: string, batchName: string, regionName: string, http: HttpClient, logOnConsole: boolean) {
        this.http = http;
        this.workerID = workerID;
        this.bucket = bucket;
        this.taskName = taskName;
        this.batchName = batchName;
        this.regionName = regionName;
        this.logOnConsole = logOnConsole;

        let details = this.getCurrentSize()

        this.logContext()
        this.log('init', details)
    }

    /**
     * Log a button click
     * @param obj mapped event object {buttonName, timeStamp, x, y}
     */
    buttonClick(obj) {
        let section = this.loggerSection
        this.loggerSection = this.findSection()
        if (section != this.loggerSection) {
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
    windowClick(obj) {
        let details = {
            section: this.findSection(),
            mouseButton: obj.mouseButton,
            startTime: obj.startTime,
            endTime: obj.endTime,
            x: obj.x,
            y: obj.y,
            target: obj.target,
            clicks: obj.clicks
        }
        this.log('click', details)
    }

    /**
     * Log an array of mouse movements
     * @param positionBuffer array of objects {timeStamp, x, y}
     */
    mouseMove(positionBuffer) {
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
    onCopy(obj) {
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
    onCut(obj) {
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
    onPaste(obj) {
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
    windowResize(obj) {
        let details = this.getCurrentSize()
        details['timeStamp'] = obj.timeStamp
        this.log('resize', details)
    }

    /**
     * Log window focus
     * @param obj mapped event object {timeStamp}
     */
    windowFocus(obj) {
        let details = {
            section: this.findSection(),
            timeStamp: obj.timeStamp
        }
        this.windowResize(obj)
        this.log('window_focus', details)
    }

    /**
     * Log window blur
     * @param obj mapped event object {timeStamp}
     */
    windowBlur(obj) {
        let details = {
            section: this.findSection(),
            timeStamp: obj.timeStamp
        }
        this.log('window_blur', details)
    }

    /**
     * Log text selection
     * @param obj mapped event object {startTime, endTime}
     */
    onSelect(obj) {
        let details = {
            section: this.findSection(),
            startTime: obj.startTime,
            endTime: obj.endTime,
            selected: document.getSelection().focusNode.textContent.toString()
        }
        this.log('selection', details)
    }

    /**
     * Log scroll info
     * @param obj mapped event object {startTime, endTime}
     */
    onScroll(obj) {
        let details = {
            section: this.findSection(),
            startTimestamp: obj.startTimeStamp,
            endTimestamp: obj.endTimeStamp,
            x: window.scrollX,
            y: window.scrollY
        }
        this.log('scroll', details)
    }

    /**
     * Log unload event
     * @param obj mapped event object {timeStamp}
     */
    beforeUnload(obj) {
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
    textLog(obj) {
        let details = {
            section: this.findSection(),
            timeStamp: obj.timeStamp,
            text: obj.target
        }
        this.log('text', details)
    }

    /**
     * Log radio button changes
     * @param obj mapped event object {timeStamp, group, value}
     */
    radioChange(obj) {
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
    shortcut(obj) {
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
    keypress(obj) {
        let details = {
            section: this.findSection(),
            keySequence: obj.keySequence,
            sentence: obj.sentence
        }
        this.log('keySequence', details)
    }

    /* ----- SEARCH ENGINE BODY ----- */
    onQuery(query) {
        let details = {
            section: this.findSection(),
            query: query
        }
        this.log('query', details)
    }

    onVisited(result) {
        let details = {
            section: this.findSection()
        }
        this.log('linkVisited', details)
    }
    
    onResult(results) {
        let urlArray = [];
        results['decodedResponses'].forEach((result) => {
            urlArray.push(result['url'])
        })
        let details = {
            section: this.findSection(),
            urlAmount: urlArray.length
        }
        this.log('queryResults', details)
    }

    /* ----- UTILITIES ----- */
    getCurrentSize() {
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

    findSection() {
        return this.sectionService.currentSection
    }

    get opt(): Object {
        return this._opt;
    }

    set opt(value: Object) {
        this._opt = value;
    }


    get isActive(): boolean {
        return this._isActive;
    }

    set isActive(value: boolean) {
        this._isActive = value;
    }

    get endpoint(): string {
        return this._endpoint;
    }

    set endpoint(value: string) {
        this._endpoint = value;
    }

    get unitId(): string {
        return this._unitId;
    }

    set unitId(value: string) {
        this._unitId = value;
    }
}
