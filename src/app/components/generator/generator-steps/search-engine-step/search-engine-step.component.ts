// TODO(strict-forms): auto-guarded by codemod – review if needed.
/* Core */
import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import {
    UntypedFormArray,
    UntypedFormBuilder,
    UntypedFormGroup,
    Validators,
} from "@angular/forms";
/* Services */
import { ConfigService } from "../../../../services/config.service";
import { LocalStorageService } from "../../../../services/localStorage.service";
/* Models */
import { SearchEngineSettings } from "../../../../models/searchEngine/searchEngineSettings";
import { S3Service } from "../../../../services/aws/s3.service";

interface SourceType {
    value: string;
    viewValue: string;
}

@Component({
    selector: "app-search-engine-step",
    templateUrl: "./search-engine-step.component.html",
    styleUrls: ["../../generator.component.scss"],
    standalone: false
})
export class SearchEngineStepComponent implements OnInit {
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* STEP #5 - Search Engine */

    dataStored: SearchEngineSettings;

    formStep: UntypedFormGroup;

    sourceTypes: SourceType[] = [
        { value: null, viewValue: "None" },
        { value: "BingWebSearch", viewValue: "BingWeb" },
        { value: "FakerWebSearch", viewValue: "FakerWeb" },
        { value: "PubmedSearch", viewValue: "Pubmed" },
    ];

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    configurationSerialized: string;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: UntypedFormBuilder
    ) {
        this.configService = configService;
        this.S3Service = S3Service;
        this.localStorageService = localStorageService;
        this.initalizeControls();
    }

    public initalizeControls() {
        this.dataStored = new SearchEngineSettings();
        this.formStep = this._formBuilder.group({
            source: [""],
            domains_filter: this._formBuilder.array([]),
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {
        let serializedSearchEngineSettings = this.localStorageService.getItem(
            "search-engine-settings"
        );
        if (serializedSearchEngineSettings) {
            this.dataStored = new SearchEngineSettings(
                JSON.parse(serializedSearchEngineSettings)
            );
        } else {
            this.initalizeControls();
            let rawSearchEngineSettings =
                await this.S3Service.downloadSearchEngineSettings(
                    this.configService.environment
                );
            this.dataStored = new SearchEngineSettings(rawSearchEngineSettings);
            this.localStorageService.setItem(
                `search-engine-settings`,
                JSON.stringify(rawSearchEngineSettings)
            );
        }
        this.formStep = this._formBuilder.group({
            source: [this.dataStored ? this.dataStored.source : ""],
            domains_filter: this._formBuilder.array([]),
        });
        if (this.dataStored)
            if (this.dataStored.domains_filter)
                if (this.dataStored.domains_filter.length > 0)
                    this.dataStored.domains_filter.forEach(
                        (domain, domainIndex) => this.addDomain(domain)
                    );
        this.formStep.valueChanges.subscribe((form) => {
            this.serializeConfiguration();
        });
        this.serializeConfiguration();
        this.formEmitter.emit(this.formStep);
    }

    domains(): UntypedFormArray {
        return this.formStep?.get("domains_filter") as UntypedFormArray;
    }

    addDomain(domain = null) {
        this.domains().push(
            this._formBuilder.group({
                url: [domain ? domain : "", Validators.required],
            })
        );
    }

    removeDomain(domainIndex: number) {
        this.domains().removeAt(domainIndex);
    }

    /* JSON OUTPUT */

    serializeConfiguration() {
        let searchEngineJSON = JSON.parse(JSON.stringify(this.formStep.value));
        if (searchEngineJSON.source) {
            let domainsStringArray = [];
            for (let domain of searchEngineJSON.domains_filter)
                domainsStringArray.push(domain.url);
            searchEngineJSON.domains_filter = domainsStringArray;
        } else {
            searchEngineJSON.source = false;
            searchEngineJSON.domains_filter = [];
        }
        this.localStorageService.setItem(
            `search-engine-settings`,
            JSON.stringify(searchEngineJSON)
        );
        this.configurationSerialized = JSON.stringify(searchEngineJSON);
    }
}
