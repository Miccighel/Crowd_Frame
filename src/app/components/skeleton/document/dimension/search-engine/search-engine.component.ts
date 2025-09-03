/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from '@angular/forms';
/* Material Design */
import {MatStepper} from '@angular/material/stepper';
/* Services */
import {SectionService} from '../../../../../services/section.service';
import {UtilsService} from '../../../../../services/utils.service';
/* Models */
import {Task} from '../../../../../models/skeleton/task';
import {Worker} from '../../../../../models/worker/worker';
import {Dimension} from '../../../../../models/skeleton/dimension';
import {Document} from '../../../../../../../data/build/skeleton/document';
/* Components */
import {ConfigService} from '../../../../../services/config.service';

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
    utilsService: UtilsService;
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() dimensionIndex: number;
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task;
    dimension: Dimension;
    searchEngineForm: UntypedFormGroup;
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
        this.changeDetector = changeDetector;
        this.sectionService = sectionService;
        this.utilsService = utilsService;
        this.configService = configService;
        this.formBuilder = formBuilder;
        this.task = this.sectionService.task;
        this.urlSelectedEmitter = new EventEmitter<boolean>();
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    ngOnInit() {
        this.dimension = this.task.dimensions[this.dimensionIndex];
        const mostRecentDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex];

        if (!this.searchEngineForms[this.documentIndex] || !this.searchEngineForms[this.documentIndex][this.dimensionIndex]) {
            const controlsConfig: Record<string, UntypedFormControl> = {};
            if ((this.dimension as any).url) {
                let urlValue = '';
                if (mostRecentDataRecord) {
                    urlValue = mostRecentDataRecord.loadAnswers()[`${this.dimension.name}_url`];
                }
                // NOTE: URL is optional (no Validators.required). Keep only semantic validator.
                controlsConfig[`${this.dimension.name}_url`] =
                    new UntypedFormControl(urlValue, [this.validateSearchEngineUrl.bind(this)]);
            }
            this.searchEngineForm = this.formBuilder.group(controlsConfig);
            this.searchEngineForm.valueChanges.subscribe(_values => {
                this.formEmitter.emit(this.searchEngineForm);
            });
        } else {
            this.searchEngineForm = this.searchEngineForms[this.documentIndex][this.dimensionIndex];
        }
        // Emit once so the parent can wire/sync base or suffixed controls
        this.formEmitter.emit(this.searchEngineForm);
    }

    /*
     * Validates the worker URL each time the user types/pastes or selects a result.
     * If the URL isn't among the results retrieved by the search engine for the current dimension,
     * an <invalidSearchEngineUrl> error is raised.
     * IMPORTANT: return null => field is valid.
     */
    public validateSearchEngineUrl(workerUrlFormControl: UntypedFormControl) {
        /* If the stepper is initialized, the task is started */
        if (this.stepper) {
            const idx = this.stepper?.selectedIndex ?? 0;
            if (idx >= this.task.questionnaireAmountStart &&
                idx < this.task.questionnaireAmountStart + this.task.documentsAmount) {
                /* If the worker has interacted with a dimension */
                if (this.task.currentDimension) {
                    const currentDocument = this.stepper.selectedIndex - this.task.questionnaireAmountStart;
                    /* If there are data for the current document */
                    if (this.task.searchEngineRetrievedResponses[currentDocument]) {
                        const retrievedResponses = this.task.searchEngineRetrievedResponses[currentDocument];
                        if (retrievedResponses.hasOwnProperty('data')) {
                            /* The current set of responses is the last one */
                            const currentSet = retrievedResponses['data'].length - 1;
                            const currentResponses = retrievedResponses['data'][currentSet]['response'];
                            const currentDimension = retrievedResponses['data'][currentSet]['dimension'];
                            /* Scan responses */
                            for (let index = 0; index < currentResponses.length; index++) {
                                /* If a URL matches for the current dimension the validation is successful */
                                if (workerUrlFormControl.value == currentResponses[index].url &&
                                    this.task.currentDimension == currentDimension) {
                                    return null;
                                }
                            }
                            /* No matching url found -> raise error */
                            return {invalidSearchEngineUrl: 'Select (or copy & paste) one of the URLs shown above.'};
                        }
                        return null;
                    }
                    return null;
                }
                return null;
            }
            return null;
        }
        return null;
    }

    public handleSearchEngineRetrievedResponse(retrievedResponseData: any, documentCurrent: Document, dimension: Dimension) {
        this.task.storeSearchEngineRetrievedResponse(retrievedResponseData, documentCurrent, dimension);
        this.searchEngineForm?.get(dimension.name.concat('_url'))?.enable();
    }

    public handleSearchEngineSelectedResponse(selectedResponseData: any, document: Document, dimension: Dimension) {
        this.task.storeSearchEngineSelectedResponse(selectedResponseData, document, dimension);
        this.searchEngineForm?.get(dimension.name.concat('_url'))?.setValue(selectedResponseData['url']);
        this.urlSelectedEmitter.emit(true);
        this.formEmitter.emit(this.searchEngineForm);
    }

    public handleSearchEngineVisitedResponse(visitedResponseDate: any, document: Document, dimension: Dimension) {
        this.task.storeSearchEngineVisitedResponse(visitedResponseDate, document, dimension);
    }
}
