import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { S3Service } from 'src/app/services/s3.service';
import {ConfigService} from "../../../services/config.service";
import {LocalStorageService} from "../../../services/localStorage.service";
import {SettingsSearchEngine} from "../../../models/settingsSearchEngine";
import {FormArray, FormBuilder, FormGroup} from "@angular/forms";

interface SourceType {
    value: string;
    viewValue: string;
}

@Component({
    selector: 'app-search-engine-step',
    templateUrl: './search-engine-step.component.html',
    styleUrls: ['./search-engine-step.component.scss']
})
export class SearchEngineStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* STEP #5 - Search Engine */

    dataStored: SettingsSearchEngine

    formStep: FormGroup;

    sourceTypes: SourceType[] = [
        {value: null, viewValue: 'None'},
        {value: 'BingWebSearch', viewValue: 'BingWeb'},
        {value: 'FakerWebSearch', viewValue: 'FakerWeb'},
        {value: 'PubmedSearch', viewValue: 'Pubmed'}
    ];

    @Output() formEmitter: EventEmitter<FormGroup>;
    @Output() resultEmitter: EventEmitter<string>;

    configurationSerialized: string


    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.dataStored = new SettingsSearchEngine()
        this.formStep = this._formBuilder.group({
            source: [''],
            domains_filter: this._formBuilder.array([])
        });
        this.formEmitter = new EventEmitter<FormGroup>();
        this.resultEmitter = new EventEmitter<string>();
    }

    public async ngOnInit() {
        let serializedSearchEngineSettings = this.localStorageService.getItem("search-engine-settings")
        if (serializedSearchEngineSettings) {
            this.dataStored = new SettingsSearchEngine(JSON.parse(serializedSearchEngineSettings))
        } else {
            let rawSearchEngineSettings = await this.S3Service.downloadSearchEngineSettings(this.configService.environment)
            this.dataStored = new SettingsSearchEngine(rawSearchEngineSettings)
            this.localStorageService.setItem(`search-engine-settings`, JSON.stringify(rawSearchEngineSettings))
        }
        this.formStep = this._formBuilder.group({
            source: [this.dataStored ? this.dataStored.source : ''],
            domains_filter: this._formBuilder.array([])
        });
        if (this.dataStored) if (this.dataStored.domains_filter) if (this.dataStored.domains_filter.length > 0) this.dataStored.domains_filter.forEach((domain, domainIndex) => this.addDomain(domain))
    }

    public ngAfterViewInit() {
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    domains(): FormArray {
        return this.formStep.get('domains_filter') as FormArray;
    }

    addDomain(domain = null) {
        this.domains().push(this._formBuilder.group({
            url: domain ? domain : ''
        }))
    }

    removeDomain(domainIndex: number) {
        this.domains().removeAt(domainIndex);
    }

    /* JSON OUTPUT */

    serializeConfiguration() {
        let searchEngineJSON = JSON.parse(JSON.stringify(this.formStep.value));
        if (searchEngineJSON.source) {
            let domainsStringArray = [];
            for (let domain of searchEngineJSON.domains_filter) domainsStringArray.push(domain.url);
            searchEngineJSON.domains_filter = domainsStringArray;
        } else {
            searchEngineJSON.source = false
            searchEngineJSON.domains_filter = []
        }
        this.localStorageService.setItem(`search-engine-settings`, JSON.stringify(searchEngineJSON))
        this.configurationSerialized = JSON.stringify(searchEngineJSON)
    }

}
