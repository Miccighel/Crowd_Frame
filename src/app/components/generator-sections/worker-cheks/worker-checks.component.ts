import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {MatChipInputEvent} from "@angular/material/chips";
import {FormBuilder, FormGroup} from "@angular/forms";
import {COMMA, ENTER} from "@angular/cdk/keycodes";
import {SettingsWorker} from "../../../models/settingsWorker";
import {LocalStorageService} from "../../../services/localStorage.service";
import {ConfigService} from "../../../services/config.service";
import {S3Service} from 'src/app/services/s3.service';

@Component({
    selector: 'app-worker-cheks',
    templateUrl: './generator-stepsworker-cheks.component.html',
    styleUrls: ['./worker-cheks.component.scss']
})

export class WorkerChecksComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* STEP #7 - Worker Checks */

    formStep: FormGroup;

    dataStored = new SettingsWorker()

    blacklistedWorkerId: Set<string>
    whitelistedWorkerId: Set<string>
    readonly separatorKeysCodes = [ENTER, COMMA] as const;

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;
    @Output() resultEmitter: EventEmitter<string>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.dataStored = new SettingsWorker()
        this.formStep = this._formBuilder.group({
            blacklist: '',
            whitelist: ''
        })
        this.formEmitter = new EventEmitter<FormGroup>();
        this.resultEmitter = new EventEmitter<string>();
    }

    public async ngOnInit() {

        /* STEP #7 - Worker Checks Settings */

        let serializedWorkerChecks = this.localStorageService.getItem("worker-settings")
        console.log(serializedWorkerChecks)
        if (serializedWorkerChecks) {
            this.dataStored = new SettingsWorker(JSON.parse(serializedWorkerChecks))
        } else {
            let rawWorkerChecks = await this.S3Service.downloadWorkers(this.configService.environment)
            this.dataStored = new SettingsWorker(rawWorkerChecks)
            this.localStorageService.setItem(`worker-settings`, JSON.stringify(rawWorkerChecks))
        }
        this.formStep = this._formBuilder.group({
            blacklist: [this.dataStored.blacklist ? this.dataStored.blacklist : ''],
            whitelist: [this.dataStored.whitelist ? this.dataStored.whitelist : '']
        })
        this.whitelistedWorkerId = new Set();
        this.blacklistedWorkerId = new Set();
        this.dataStored.blacklist.forEach((workerId, workerIndex) => this.blacklistedWorkerId.add(workerId))
        this.dataStored.whitelist.forEach((workerId, workerIndex) => this.whitelistedWorkerId.add(workerId))
    }

    public ngAfterViewInit() {
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    /* STEP #7 - Worker Checks */

    addBlacklistedId(event: MatChipInputEvent) {
        if (event.value) {
            this.blacklistedWorkerId.add(event.value);
            event.chipInput!.clear();
            this.serializeConfiguration()
        }
    }

    addWhitelistedId(event: MatChipInputEvent) {
        if (event.value) {
            this.whitelistedWorkerId.add(event.value);
            event.chipInput!.clear();
            this.serializeConfiguration()
        }
    }

    removeBlacklistedId(workerId: string) {
        this.blacklistedWorkerId.delete(workerId);
        this.serializeConfiguration()
    }

    removeWhitelistedId(workerId: string) {
        this.whitelistedWorkerId.delete(workerId);
        this.serializeConfiguration()
    }

    /* JSON Output */
    serializeConfiguration() {
        let configurationRaw = JSON.parse(JSON.stringify(this.formStep.value));
        if (this.blacklistedWorkerId)
            configurationRaw.blacklist = Array.from(this.blacklistedWorkerId.values())
        if (this.whitelistedWorkerId)
            configurationRaw.whitelist = Array.from(this.whitelistedWorkerId.values())
        this.localStorageService.setItem(`worker-settings`, JSON.stringify(configurationRaw))
        this.configurationSerialized = JSON.stringify(configurationRaw)
        this.resultEmitter.emit(this.configurationSerialized)
    }

}
