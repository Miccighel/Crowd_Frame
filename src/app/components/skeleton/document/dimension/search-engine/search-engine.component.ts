/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from "@angular/forms";
/* Material Design */
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {SectionService} from "../../../../../services/section.service";
import {UtilsService} from "../../../../../services/utils.service";
/* Models */
import {Task} from "../../../../../models/skeleton/task";
import {Worker} from "../../../../../models/worker/worker";
import {Dimension} from "../../../../../models/skeleton/dimension";
import {Document} from "../../../../../../../data/build/skeleton/document";
/* Components */
import {ConfigService} from "../../../../../services/config.service";

@Component({
    selector: 'app-search-engine',
    templateUrl: './search-engine.component.html',
    styleUrls: ['./search-engine.component.scss'],
    standalone: false
})
export class SearchEngineComponent implements OnInit {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;
    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    @Input() worker: Worker
    @Input() documentIndex: number
    @Input() dimensionIndex: number
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task
    dimension: Dimension
    searchEngineForm: UntypedFormGroup
    @ViewChild('stepper') stepper: MatStepper;

    /* #################### EMITTERS #################### */

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;
    @Output() urlSelectedEmitter: EventEmitter<boolean>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        configService: ConfigService,
        formBuilder: UntypedFormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.configService = configService
        this.formBuilder = formBuilder
        this.task = this.sectionService.task
        this.urlSelectedEmitter = new EventEmitter<boolean>();
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    ngOnInit() {
        this.dimension = this.task.dimensions[this.dimensionIndex]
        let mostRecentDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex]
        if (!this.searchEngineForms[this.documentIndex] || !this.searchEngineForms[this.documentIndex][this.dimensionIndex]) {
            let controlsConfig = {};
            if (this.dimension.url) {
                let urlValue = ''
                if (mostRecentDataRecord)
                    urlValue = mostRecentDataRecord.loadAnswers()[`${this.dimension.name}_url`]
                controlsConfig[`${this.dimension.name}_url`] = new UntypedFormControl(urlValue, [Validators.required, this.validateSearchEngineUrl.bind(this)]);
            }
            this.searchEngineForm = this.formBuilder.group(controlsConfig)
            this.searchEngineForm.valueChanges.subscribe(values => {
                this.formEmitter.emit(this.searchEngineForm)
            })
        } else {
            this.searchEngineForm = this.searchEngineForms[this.documentIndex][this.dimensionIndex]
        }
        this.formEmitter.emit(this.searchEngineForm)
    }

    /*
     * This function performs a validation of the worker url field each time the current worker types or pastes in its inside
     * or when he selects one of the responses retrieved by the search engine. If the url present in the field is not equal
     * to an url retrieved by the search engine an <invalidSearchEngineUrl> error is raised.
     * IMPORTANT: the <return null> part means: THE FIELD IS VALID
     */
    public validateSearchEngineUrl(workerUrlFormControl: UntypedFormControl) {
        /* If the stepped is initialized to something the task is started */
        if (this.stepper) {
            const idx = this.stepper?.selectedIndex ?? 0;
            if (idx >= this.task.questionnaireAmountStart &&
                idx < this.task.questionnaireAmountStart + this.task.documentsAmount) {
                /* If the worker has interacted with the form control of a dimension */
                if (this.task.currentDimension) {
                    let currentDocument = this.stepper.selectedIndex - this.task.questionnaireAmountStart;
                    /* If there are data for the current document */
                    if (this.task.searchEngineRetrievedResponses[currentDocument]) {
                        let retrievedResponses = this.task.searchEngineRetrievedResponses[currentDocument];
                        if (retrievedResponses.hasOwnProperty("data")) {
                            /* The current set of responses is the total amount - 1 */
                            let currentSet = retrievedResponses["data"].length - 1;
                            /* The responses retrieved by search engine are selected */
                            let currentResponses = retrievedResponses["data"][currentSet]["response"];
                            let currentDimension = retrievedResponses["data"][currentSet]["dimension"];
                            /* Each response is scanned */
                            for (let index = 0; index < currentResponses.length; index++) {
                                /* As soon as an url that matches with the one selected/typed by the worker for the current dimension the validation is successful */
                                if (workerUrlFormControl.value == currentResponses[index].url && this.task.currentDimension == currentDimension) return null;
                            }
                            /* If no matching url has been found, raise the error */
                            return {invalidSearchEngineUrl: "Select (or copy & paste) one of the URLs shown above."}
                        }
                        return null
                    }
                    return null
                }
                return null
            }
            return null
        }
        return null
    }

    public handleSearchEngineRetrievedResponse(retrievedResponseData, documentCurrent: Document, dimension: Dimension) {
        this.task.storeSearchEngineRetrievedResponse(retrievedResponseData, documentCurrent, dimension)
        this.searchEngineForm?.get(dimension.name.concat("_url"))?.enable();
    }

    public handleSearchEngineSelectedResponse(selectedResponseData, document: Document, dimension: Dimension) {
        this.task.storeSearchEngineSelectedResponse(selectedResponseData, document, dimension)
        this.searchEngineForm?.get(dimension.name.concat("_url"))?.setValue(selectedResponseData['url']);
        this.urlSelectedEmitter.emit(true)
        this.formEmitter.emit(this.searchEngineForm)
    }

    public handleSearchEngineVisitedResponse(visitedResponseDate, document: Document, dimension: Dimension) {
        this.task.storeSearchEngineVisitedResponse(visitedResponseDate, document, dimension)
    }
}
