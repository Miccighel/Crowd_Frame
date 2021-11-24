import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {MatChipInputEvent} from "@angular/material/chips";
import {FormArray, FormBuilder, FormGroup} from "@angular/forms";
import {COMMA, ENTER} from "@angular/cdk/keycodes";
import {SettingsWorker} from "../../../../models/settingsWorker";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {ConfigService} from "../../../../services/config.service";
import {S3Service} from 'src/app/services/s3.service';

@Component({
    selector: 'app-worker-checks',
    templateUrl: './worker-checks-step.component.html',
    styleUrls: ['../../generator.component.scss']
})

export class WorkerChecksStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;
    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* STEP #7 - Worker Checks */

    @Input() batchesTree: Array<JSON>
    @Input() batchesTreeInitialized: boolean

    formStep: FormGroup;

    dataStored = new SettingsWorker()

    blacklistedWorkerId: Set<string>
    whitelistedWorkerId: Set<string>
    readonly separatorKeysCodes = [ENTER, COMMA] as const;

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;

    constructor(
        changeDetector: ChangeDetectorRef,
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: FormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.dataStored = new SettingsWorker()
        this.formStep = this._formBuilder.group({
            block: '',
            analysis: '',
            blacklist: '',
            whitelist: '',
            batches: this._formBuilder.array([]),
        })
        this.formEmitter = new EventEmitter<FormGroup>();
    }

    public async ngOnInit() {

        /* STEP #7 - Worker Checks Settings */

        let serializedWorkerChecks = this.localStorageService.getItem("worker-settings")
        if (serializedWorkerChecks) {
            this.dataStored = new SettingsWorker(JSON.parse(serializedWorkerChecks))
        } else {
            let rawWorkerChecks = await this.S3Service.downloadWorkers(this.configService.environment)
            this.dataStored = new SettingsWorker(rawWorkerChecks)
            this.localStorageService.setItem(`worker-settings`, JSON.stringify(rawWorkerChecks))
        }
        this.formStep = this._formBuilder.group({
            block: [this.dataStored.block ? this.dataStored.block : true],
            analysis: [this.dataStored.block ? this.dataStored.block : true],
            blacklist: [this.dataStored.blacklist ? this.dataStored.blacklist : ''],
            whitelist: [this.dataStored.whitelist ? this.dataStored.whitelist : ''],
            batches: this._formBuilder.array([]),
        })
        this.whitelistedWorkerId = new Set();
        this.blacklistedWorkerId = new Set();
        this.dataStored.blacklist.forEach((workerId, workerIndex) => this.blacklistedWorkerId.add(workerId))
        this.dataStored.whitelist.forEach((workerId, workerIndex) => this.whitelistedWorkerId.add(workerId))
        for (let taskNode of this.batchesTree) {
            for (let batchNode of taskNode["batches"]) {
                this.addBatch(batchNode)
            }
        }
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

    batches(): FormArray {
        return this.formStep.get('batches') as FormArray;
    }

    addBatch(batchNode) {
        let control = this._formBuilder.group({
            name: batchNode ? batchNode['batch'] : '',
            counter: batchNode ? batchNode['counter'] : '',
            blacklist: batchNode ? batchNode['blacklist'] ? batchNode['blacklist'] : '' : '',
            whitelist: batchNode ? batchNode['whitelist'] ? batchNode['whitelist'] : '' : '',
        })
        if (batchNode['blacklist']) {
            control.get('whitelist').setValue(false)
            control.get('whitelist').disable()
        }
        if (batchNode['whitelist']) {
            control.get('blacklist').setValue(false)
            control.get('blacklist').disable()
        }
        this.batches().push(control, {emitEvent: false})
    }

    resetBlacklist(batchIndex) {
        let batch = this.batches().at(batchIndex)
        if (batch.get('blacklist').value == true) {
            batch.get('whitelist').setValue(false)
            batch.get('whitelist').disable()
        } else {
            batch.get('whitelist').enable()
        }
        this.batchesTree.forEach((taskNode, taskIndex) => {
            taskNode["batches"].forEach((batchNode, batchIndex) => {
                if (batch.get('name').value == batchNode['batch']) {
                    this.batchesTree[taskIndex]["batches"][batchIndex]['blacklist'] = batch.get('blacklist').value
                    this.localStorageService.setItem("batches-tree", JSON.stringify(this.batchesTree))
                    this.serializeConfiguration()
                }
            });
        });
    }

    resetWhitelist(batchIndex) {
        let batch = this.batches().at(batchIndex)
        if (batch.get('whitelist').value == true) {
            batch.get('blacklist').setValue(false)
            batch.get('blacklist').disable()
        } else {
            batch.get('blacklist').enable()
        }
        this.batchesTree.forEach((taskNode, taskIndex) => {
            taskNode["batches"].forEach((batchNode, batchIndex) => {
                if (batch.get('name').value == batchNode['batch']) {
                    this.batchesTree[taskIndex]["batches"][batchIndex]['whitelist'] = batch.get('whitelist').value
                    this.localStorageService.setItem("batches-tree", JSON.stringify(this.batchesTree))
                    this.serializeConfiguration()
                }
            });
        });
    }

    /* JSON Output */
    serializeConfiguration() {
        let configurationRaw = JSON.parse(JSON.stringify(this.formStep.value));
        if (this.blacklistedWorkerId)
            configurationRaw.blacklist = Array.from(this.blacklistedWorkerId.values())
        if (this.whitelistedWorkerId)
            configurationRaw.whitelist = Array.from(this.whitelistedWorkerId.values())
        if (this.batchesTree) {
            let blacklist_batches = []
            let whitelist_batches = []
            for (let batch of configurationRaw.batches) {
                if (batch.blacklist) {
                    blacklist_batches.push(batch.name)
                }
                if (batch.whitelist) {
                    whitelist_batches.push(batch.name)
                }

            }
            configurationRaw["blacklist_batches"] = blacklist_batches
            configurationRaw["whitelist_batches"] = whitelist_batches
        }
        this.localStorageService.setItem(`worker-settings`, JSON.stringify(configurationRaw))
        delete configurationRaw['batches']
        this.configurationSerialized = JSON.stringify(configurationRaw)
    }

}
