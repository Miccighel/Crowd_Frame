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
    value: string | null;
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

    /*
     * Available search engine sources:
     *  - BraveWebSearch        → Brave (general web search)
     *  - GoogleWebSearch       → Google Programmable Search
     *  - FakerWebSearch        → Synthetic/fake results (debug / sandbox)
     *  - PubmedSearch          → PubMed (biomedical literature)
     */
    sourceTypes: SourceType[] = [
        { value: null,              viewValue: "No search engine (disable)" },
        { value: "BraveWebSearch",  viewValue: "Brave (general web search)" },
        { value: "GoogleWebSearch", viewValue: "Google (Programmable Search)" },
        { value: "FakerWebSearch",  viewValue: "Faker (synthetic debug search)" },
        { value: "PubmedSearch",    viewValue: "PubMed (biomedical articles)" },
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
        const serializedSearchEngineSettings = this.localStorageService.getItem(
            "search-engine-settings"
        );

        if (serializedSearchEngineSettings) {
            this.dataStored = new SearchEngineSettings(
                JSON.parse(serializedSearchEngineSettings)
            );
        } else {
            this.initalizeControls();
            const rawSearchEngineSettings =
                await this.S3Service.downloadSearchEngineSettings(
                    this.configService.environment
                );
            this.dataStored = new SearchEngineSettings(rawSearchEngineSettings);
            this.localStorageService.setItem(
                "search-engine-settings",
                JSON.stringify(rawSearchEngineSettings)
            );
        }

        /*
         * Backwards compatibility:
         * If an older configuration still has BingWebSearch set,
         * map it to FakerWebSearch by default (closest behaviour).
         */
        if (this.dataStored?.source === "BingWebSearch") {
            this.dataStored.source = "FakerWebSearch";
        }

        this.formStep = this._formBuilder.group({
            source: [this.dataStored ? this.dataStored.source : ""],
            domains_filter: this._formBuilder.array([]),
        });

        if (this.dataStored?.domains_filter?.length) {
            this.dataStored.domains_filter.forEach((domain) =>
                this.addDomain(domain)
            );
        }

        this.formStep.valueChanges.subscribe(() => {
            this.serializeConfiguration();
        });

        this.serializeConfiguration();
        this.formEmitter.emit(this.formStep);
    }

    domains(): UntypedFormArray {
        return this.formStep?.get("domains_filter") as UntypedFormArray;
    }

    addDomain(domain: string | null = null) {
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
        const searchEngineJSON = JSON.parse(JSON.stringify(this.formStep.value));

        if (searchEngineJSON.source) {
            const domainsStringArray: string[] = [];
            for (const domain of searchEngineJSON.domains_filter) {
                domainsStringArray.push(domain.url);
            }
            searchEngineJSON.domains_filter = domainsStringArray;
        } else {
            // No source selected: normalize to false + empty domains
            searchEngineJSON.source = false;
            searchEngineJSON.domains_filter = [];
        }

        this.localStorageService.setItem(
            "search-engine-settings",
            JSON.stringify(searchEngineJSON)
        );
        this.configurationSerialized = JSON.stringify(searchEngineJSON);
    }
}
