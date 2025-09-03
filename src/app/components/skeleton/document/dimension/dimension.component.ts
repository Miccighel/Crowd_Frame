/* Core */
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges
} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
/* Services */
import {SectionService} from '../../../../services/section.service';
import {UtilsService} from '../../../../services/utils.service';
/* Models */
import {Task} from '../../../../models/skeleton/task';
import {Dimension, ScaleCategorical, ScaleInterval, ScaleMagnitude} from '../../../../models/skeleton/dimension';
/* Components */
import {Worker} from '../../../../models/worker/worker';
import {DataRecord} from '../../../../models/skeleton/dataRecord';

@Component({
    selector: 'app-dimension',
    templateUrl: './dimension.component.html',
    styleUrls: ['./dimension.component.scss', '../document.component.scss'],
    standalone: false
})
export class DimensionComponent implements OnInit, OnChanges {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;

    /* Utility service */
    utilsService: UtilsService;

    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() documentsForm: Array<UntypedFormGroup>;
    @Input() documentsFormsAdditional: Array<Array<UntypedFormGroup>>;
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    /* Used to understand if the current document is being assessed for a second time */
    @Input() postAssessment: boolean;
    @Input() postAssessmentIndex: number;
    @Input() initialAssessmentFormInteraction: boolean;
    @Input() followingAssessmentAllowed: boolean;

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task;
    mostRecentDataRecord: DataRecord;

    /* Base assessment form of the document */
    assessmentForm: UntypedFormGroup;

    /* Additional assessment forms for the document, one for each post-assessment step */
    assessmentFormAdditional: UntypedFormGroup;

    /* #################### EMITTERS #################### */

    @Output() formEmitter: EventEmitter<Object>;
    @Output() assessmentFormValidityEmitter: EventEmitter<Object>;
    @Output() followingAssessmentAllowedEmitter: EventEmitter<boolean>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: UntypedFormBuilder
    ) {
        this.sectionService = sectionService;
        this.changeDetector = changeDetector;
        this.utilsService = utilsService;
        this.formBuilder = formBuilder;
        this.task = this.sectionService.task;
        this.formEmitter = new EventEmitter<Object>();
        this.assessmentFormValidityEmitter = new EventEmitter<boolean>();
        this.followingAssessmentAllowedEmitter = new EventEmitter<boolean>();
    }

    /*
 * Initializes form controls for evaluating the task's dimensions.
 * Used by the initialization method, where controlSuffix customizes post-assessment control names.
 * For the initial assessment, the suffix is set to ''. Otherwise, it will be '_post_{postAssessmentIndex}'.
 * NOTE: Interval sliders now start as null (no pre-filled min) to ensure validators trigger properly.
 */
    public initializeControls(controlSuffix: string) {
        let controlsConfig: any = {};
        for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
            let dimension: Dimension = this.task.dimensions[index_dimension];

            if (this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {

                /* ───────────── NON-PAIRWISE ───────────── */
                if (!dimension.pairwise) {
                    if (this.checkIfDimensionIsEnabledForPostAssessment(dimension.name)) {

                        if (dimension.scale) {
                            let answerValue: any = null;
                            if (this.mostRecentDataRecord) {
                                const prev = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value${controlSuffix}`];
                                answerValue = (prev === undefined) ? null : prev;
                            }

                            if (dimension.scale.type == 'categorical') {
                                if ((dimension.scale as ScaleCategorical).multipleSelection) {
                                    /* Multiple selection: a group of checkboxes + a value control */
                                    let answers: any = {};
                                    const scale = (dimension.scale as ScaleCategorical);
                                    scale.mapping.forEach((_value: any, idx: number) => {
                                        answers[idx] = false;
                                    });
                                    controlsConfig[`${dimension.name}_list${controlSuffix}`] = this.formBuilder.group(answers);
                                    controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required]);
                                } else {
                                    controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required]);
                                }
                            }

                            if (dimension.scale.type == 'interval') {
                                /* Start as null so worker must select an explicit value */
                                if (answerValue === undefined) answerValue = null;
                                controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                                    new UntypedFormControl(answerValue, [Validators.required]);
                            }

                            if (dimension.scale.type == 'magnitude_estimation') {
                                controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                                    new UntypedFormControl(
                                        answerValue,
                                        [this.utilsService.numberGreaterThanValidator(((dimension.scale as ScaleMagnitude).min))]
                                    );
                            }
                        }

                        if (dimension.justification) {
                            let answerJustification: string = '';
                            if (this.mostRecentDataRecord) {
                                const prevJ = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification${controlSuffix}`];
                                answerJustification = prevJ || '';
                            }
                            controlsConfig[`${dimension.name}_justification${controlSuffix}`] =
                                new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)]);
                        }

                        /* ───────────── URL (Search Engine) COPY FOR POST-ASSESSMENT ─────────────
                         * In post-assessment steps (controlSuffix !== ''), expose an optional URL control:
                         *   - Name: "<dimension>_url" + controlSuffix  (e.g., _post_1)
                         *   - No Validators.required (additional source, not mandatory)
                         *   - Prefill from most recent answers if available (suffixed first, then base)
                         * We do NOT create the base "<dimension>_url" at initial step here to preserve the
                         * current search-UI → form reference behavior handled by storeSearchEngineUrl().
                         */
                        if ((dimension as any).url && controlSuffix !== '') {
                            let urlPrev = '';
                            if (this.mostRecentDataRecord) {
                                const answers = this.mostRecentDataRecord.loadAnswers();
                                urlPrev = answers[`${dimension.name}_url${controlSuffix}`]
                                    ?? answers[`${dimension.name}_url`]
                                    ?? '';
                            }
                            controlsConfig[`${dimension.name}_url${controlSuffix}`] = new UntypedFormControl(urlPrev);
                        }
                    }

                    /* ───────────── PAIRWISE ───────────── */
                } else {
                    /* Iterate using subdocuments length, aligned to new Document interface */
                    const subdocs = (this.task.documents[this.documentIndex] as any)?.subdocuments || [];
                    for (let j = 0; j < subdocs.length; j++) {

                        if (dimension.scale) {
                            let answerValue: any = null;
                            if (this.mostRecentDataRecord) {
                                const prev = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value_element_${j}`];
                                answerValue = (prev === undefined) ? null : prev;
                            }

                            if (dimension.scale.type == 'categorical') {
                                controlsConfig[`${dimension.name}_value_element_${j}`] =
                                    new UntypedFormControl(answerValue, [Validators.required]);
                            }

                            if (dimension.scale.type == 'interval') {
                                /* Start as null so worker must select an explicit value */
                                if (answerValue === undefined) answerValue = null;
                                controlsConfig[`${dimension.name}_value_element_${j}`] =
                                    new UntypedFormControl(answerValue, [Validators.required]);
                            }

                            if (dimension.scale.type == 'magnitude_estimation') {
                                controlsConfig[`${dimension.name}_value_element_${j}`] =
                                    new UntypedFormControl(
                                        answerValue,
                                        [this.utilsService.numberGreaterThanValidator(((dimension.scale as ScaleMagnitude).min))]
                                    );
                            }
                        }

                        if (dimension.justification) {
                            let answerJustification: string = '';
                            if (this.mostRecentDataRecord) {
                                const prevJ = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification_element_${j}`];
                                answerJustification = prevJ || '';
                            }
                            controlsConfig[`${dimension.name}_justification_element_${j}`] =
                                new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)]);
                        }
                    }
                }
            }
        }
        return controlsConfig;
    }


    ngOnInit() {
        this.task = this.sectionService.task;
        this.mostRecentDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex];
        let assessForm: UntypedFormGroup = null;

        /* Initialize the initial form if it does not already exist. */
        if (this.documentsForm[this.documentIndex]) {
            assessForm = this.documentsForm[this.documentIndex];
        } else {
            /* Notice the control initialization with an empty string as suffix, meaning they will retain the base name */
            assessForm = this.formBuilder.group(this.initializeControls(''));
            assessForm.valueChanges.subscribe(value => {
                /* Treat null as empty to require explicit user action */
                const allValuesNotEmpty = Object.values(value).every(val => val !== '' && val !== null);
                this.assessmentFormValidityEmitter.emit({
                    postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                    allValuesNotEmpty: allValuesNotEmpty
                });
            });
        }

        this.assessmentForm = assessForm;

        this.formEmitter.emit({
            index: this.documentIndex,
            type: 'initial',
            form: assessForm
        });

        if (this.documentsFormsAdditional) {
            if (this.documentsFormsAdditional[this.documentIndex]) {
                if (this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex - 1]) {
                    this.assessmentFormAdditional = this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex - 1];
                    this.formEmitter.emit({
                        index: this.documentIndex,
                        type: 'post',
                        postAssessmentIndex: this.postAssessmentIndex,
                        form: this.assessmentFormAdditional
                    });
                }
                this.followingAssessmentAllowed = true;
                this.followingAssessmentAllowedEmitter.emit(this.followingAssessmentAllowed);
            }
        }

        /* Restore past answers from post-assessment steps in the form controls if they exist. */
        let mostRecentAnswersForPostAssessment = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, this.postAssessmentIndex);
        if (Object.keys(mostRecentAnswersForPostAssessment).length > 0) {
            if (this.assessmentForm) {
                this.assessmentForm.disable();
                /* Notice the control initialization with a string as suffix that depends on the current post assessment index */
                let controlsConfig = this.initializeControls(`_post_${this.postAssessmentIndex}`);
                this.assessmentFormAdditional = this.formBuilder.group(controlsConfig);
                if (this.postAssessmentIndex <= this.task.retrieveIndexOfLastPostAssessmentStep()) {
                    this.assessmentFormAdditional.disable();
                }
                this.formEmitter.emit({
                    index: this.documentIndex,
                    type: 'post',
                    postAssessmentIndex: this.postAssessmentIndex,
                    form: this.assessmentFormAdditional
                });
                this.followingAssessmentAllowed = true;
                this.followingAssessmentAllowedEmitter.emit(this.followingAssessmentAllowed);
            }
        }
    }

    /*
     * Change detection behavior is necessary to enable the following step and initialize required form controls
     * when the initial assessment or a post-assessment step is completed.
     */
    ngOnChanges(changes: SimpleChanges) {
        if (changes['followingAssessmentAllowed']) {
            let followingAssessmentAllowedChange = changes['followingAssessmentAllowed'];
            if (followingAssessmentAllowedChange.currentValue) {
                let controlSuffix = `_post_${this.postAssessmentIndex}`;
                let controlsConfig = this.initializeControls(controlSuffix);
                if (this.assessmentForm) {
                    this.assessmentForm.disable();
                    let currentForm = this.getCurrentAssessmentForm();
                    Object.entries(currentForm.controls)?.forEach(([controlName, _control], _index) => {
                        if (controlName.concat(controlSuffix) in controlsConfig) {
                            controlsConfig[controlName.concat(controlSuffix)]?.setValue(currentForm?.get(controlName).value);
                        }
                    });
                    this.assessmentFormAdditional = this.formBuilder.group(controlsConfig);
                    this.assessmentFormValidityEmitter.emit({
                        postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                        allValuesNotEmpty: true
                    });
                    this.assessmentFormAdditional.valueChanges.subscribe(value => {
                        /* Treat null as empty to require explicit user action */
                        const allValuesNotEmpty = Object.values(value).every(val => val !== '' && val !== null);
                        this.assessmentFormValidityEmitter.emit({
                            postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                            allValuesNotEmpty: allValuesNotEmpty
                        });
                    });
                    this.formEmitter.emit({
                        index: this.documentIndex,
                        type: 'post',
                        postAssessmentIndex: this.postAssessmentIndex,
                        form: this.assessmentFormAdditional
                    });
                }
            }
        }
    }

    /* #################### CATEGORICAL DIMENSION CONTROLLS FOR VIDEO TASKS #################### */
    public detectCategoricalDimensionOnChange(eventData: { value?: any; target?: any; }) {
        if (this.task.settings.attributesMain.some(attribute => attribute.is_video) &&
            this.task.dimensions.some(dimension => dimension.scale.type == 'interval') &&
            this.task.dimensions.filter(d => d.scale && d.scale.type === 'categorical').length > 1) {

            let currentValue = String(Object.keys(eventData).includes('value') ? eventData.value : eventData.target.value);
            let primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            let previousValue = this.assessmentForm.controls[primaryCategoricalDimension.name.concat('_value').concat('')].value;

            if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
                if (currentValue == primaryCategoricalDimension.scale.mapping[0].value) {
                    let intervalDimension = this.getIntervalDimension();
                    let secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();

                    if (intervalDimension.scale instanceof ScaleInterval) {
                        /* When selecting the first mapping option, lock interval to its min */
                        this.assessmentForm.controls[intervalDimension.name.concat('_value').concat('')].setValue(intervalDimension.scale.min);
                    }
                    if (secondaryCategoricalDimension.scale instanceof ScaleCategorical) {
                        this.assessmentForm.controls[secondaryCategoricalDimension.name.concat('_value').concat('')].setValue(secondaryCategoricalDimension.scale.mapping[0].value);
                    }
                } else if (previousValue == primaryCategoricalDimension.scale.mapping[0].value) {
                    let intervalDimension = this.getIntervalDimension();
                    let secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();

                    if (intervalDimension.scale instanceof ScaleInterval) {
                        /* When moving away, clear the interval selection */
                        this.assessmentForm.controls[intervalDimension.name.concat('_value').concat('')].setValue(null);
                    }
                    if (secondaryCategoricalDimension.scale instanceof ScaleCategorical) {
                        this.assessmentForm.controls[secondaryCategoricalDimension.name.concat('_value').concat('')].setValue('');
                    }
                }
            }
        }
    }

    /* #################### INTERVAL DIMENSION CONTROLLS FOR VIDEO TASKS #################### */
    public isVideoTimestampInterval(): boolean {
        return this.task.settings.attributesMain.some(attribute => attribute.is_video) &&
            this.task.dimensions.some(dimension => dimension.scale.type == 'categorical');
    }

    public isVideoTypeLabelCategorical(currentCategoricalDimension: Dimension): boolean {
        if (currentCategoricalDimension.scale && currentCategoricalDimension.scale instanceof ScaleCategorical) {
            let primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            return this.task.settings.attributesMain.some(attribute => attribute.is_video) &&
                currentCategoricalDimension.name != primaryCategoricalDimension.name;
        }
        return false;
    }

    public videoTimestampVisualization(timestamp: number): string {
        const time = String(timestamp).split('.');
        const seconds = time[0]?.padStart(2, '0') ?? '00';
        const milliseconds = time[1] ? time[1].padEnd(2, '0') : '00';
        return `00:${seconds}.${milliseconds}`;
    }

    private getPrimaryCategoricalDimension(): Dimension {
        /* Get the first categorical dimension - the master categorical dimension */
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === 'categorical');
    }

    private getSecondaryCategoricalDimension(): Dimension {
        /* Get the second categorical dimension */
        return this.task.dimensions.filter(dimension => dimension.scale && dimension.scale.type === 'categorical')[1];
    }

    private getIntervalDimension(): Dimension {
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === 'interval');
    }

    public sliderDisabled(): boolean {
        const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
        if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
            return this.assessmentForm.controls[(primaryCategoricalDimension.name).concat('_value').concat('')].value !== primaryCategoricalDimension.scale.mapping[1].value;
        }
        return false;
    }

    public categoricalDimensionDisabled(currentDimension: Dimension): boolean {
        if (currentDimension.scale instanceof ScaleCategorical) {
            const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
                return this.assessmentForm.controls[(primaryCategoricalDimension.name).concat('_value').concat('')].value !== primaryCategoricalDimension.scale.mapping[1].value &&
                    currentDimension.name != primaryCategoricalDimension.name;
            }
        }
        return false;
    }

    /* #################### POST ASSESSMENT #################### */

    /* This function retrieves the current assessment form, depending on whether post assessment is enabled or not. */
    public getCurrentAssessmentForm() {
        if (this.postAssessment) {
            /* The initial assessment involves a postAssessmentIndex lower than 1 */
            if (this.postAssessmentIndex <= 1) {
                return this.documentsForm[this.documentIndex];
            } else {
                return this.documentsFormsAdditional[this.documentIndex][this.documentsFormsAdditional[this.documentIndex].length - 1];
            }
        } else {
            return this.documentsForm[this.documentIndex];
        }
    }

    /* This function checks if a dimension should be reassessed within a given post assessment step */
    public checkIfDimensionIsEnabledForPostAssessment(name: string) {
        let enabled = true;

        /* If the post assessment is not set (not initialized yet) and the dimension is not required in the initial assessment, it is not enabled. */
        if (!this.postAssessmentIndex && this.task.getFirstPostAssessmentStepInWhichDimensionAppears(name) > 0) {
            enabled = false;
        }

        /* If the dimension is not required in the current post-assessment step, it is not enabled. */
        if (this.postAssessmentIndex && !this.task.getAllPostAssessmentStepsInWhichDimensionAppears(name).includes(this.postAssessmentIndex - 1)) {
            enabled = false;
        }
        return enabled;
    }

    /* #################### MAIN AND TRAINING TASK #################### */

    /* This function filters the evaluation dimensions according to the task type (Main or Training) in which they are involved. */
    public filterDimensionsAccordingToTaskType(dimensions: Array<Dimension>) {
        let filteredDimensions: Array<Dimension> = [];
        for (let dimension of dimensions) {
            if (this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {
                filteredDimensions.push(dimension);
            }
        }
        return filteredDimensions;
    }

    /* #################### JUSTIFICATION #################### */

    /*
     * Validates the worker justification field each time the worker types or pastes inside it.
     * - Raises an <invalid> error if the worker types the selected URL as part of the justification.
     * - Raises a <longer> error if the justification has fewer than "min_words" words.
     * IMPORTANT: The <return null> part indicates that the field is valid.
     */
    public validateJustification(control: UntypedFormControl) {
        /* The justification is divided into words and cleaned */
        let minWords = 0;
        let words = (control.value || '').split(' ');
        let cleanedWords: Array<string> = [];
        for (let word of words) {
            let trimmedWord = word.trim();
            if (trimmedWord.length > 0) {
                cleanedWords.push(trimmedWord);
            }
        }
        let currentAssessmentForm = this.getCurrentAssessmentForm();
        if (currentAssessmentForm) {
            /* The current document document_index is selected */
            let currentDocument = this.documentIndex;

            /* If the user has selected some search engine responses for the current document */
            if (this.task.searchEngineSelectedResponses[currentDocument]) {
                if (this.task.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
                    let selectedUrl: any = Object.values(this.task.searchEngineSelectedResponses[currentDocument]['data']).pop();
                    let response = selectedUrl['response'];
                    /* The controls are performed */
                    for (let word of cleanedWords) {
                        if (word == response['url']) return {'invalid': 'You cannot use the selected search engine url as part of the justification.'};
                    }
                }
            }

            const allControls = currentAssessmentForm.controls;
            let currentControl = Object.keys(allControls).find(name => control === (allControls as any)[name]);
            if (currentControl) {
                let currentDimensionName = currentControl.split('_')[0];
                for (let dimension of this.task.dimensions) {
                    if (dimension.name == currentDimensionName) {
                        if ((dimension as any).justification?.min_words) {
                            minWords = (dimension as any).justification.min_words;
                        }
                    }
                }
                return cleanedWords.length > minWords ? null : {'longer': 'This is not valid.'};
            }
        }
        return null;
    }

    /* #################### SEARCH ENGINE INTERACTION #################### */

    /* Checks if a URL has been selected using the search engine within a given layout position. */
    public verifyUrlSelection(position: string) {
        let positionsToCheck: Array<string> = [];
        if (position == 'top') positionsToCheck.push('top');
        if (position == 'middle') {
            positionsToCheck.push('top');
            positionsToCheck.push('middle');
        }
        if (position == 'bottom') {
            positionsToCheck.push('top');
            positionsToCheck.push('middle');
            positionsToCheck.push('bottom');
        }

        let dimensionsToCheck: Array<Dimension> = [];
        for (let dimension of this.task.dimensions) {
            if ((dimension as any).style && positionsToCheck.includes((dimension as any).style.position)) {
                dimensionsToCheck.push(dimension);
            }
        }

        /* Require a URL control with a non-empty value for the current step (base or suffixed). */
        const currentAssessmentForm = this.getCurrentAssessmentForm();
        const suffix = (this.postAssessment && this.postAssessmentIndex) ? `_post_${this.postAssessmentIndex}` : '';

        let result = true;
        for (let dimension of dimensionsToCheck) {
            if ((dimension as any).url) {
                const keyBase = `${dimension.name}_url`;
                const keyStep = `${dimension.name}_url${suffix}`;
                const ctrl = currentAssessmentForm?.get(keyStep) ?? currentAssessmentForm?.get(keyBase);
                if (!ctrl || !ctrl.value) {
                    result = false;
                }
            }
        }
        return result;
    }


    /* #################### SEARCH ENGINE INTERACTION #################### */

    /*
     * Adds or syncs URL controls coming from the search engine UI.
     * - Initial assessment: keep the existing behavior (add the base "<dimension>_url" by reference).
     * - Post assessment: if a suffixed control exists ("<dimension>_url_post_i"), sync that instead of
     *   injecting the base control into the post form. This avoids duplicating base + suffixed URLs.
     * - If neither exists in post, create the suffixed control (value copy) to keep forms consistent.
     */
    public storeSearchEngineUrl(urlFormGroup: UntypedFormGroup, dimensionIndex: number) {
        for (const [key, _] of Object.entries(urlFormGroup.controls)) {
            const currentAssessmentForm = this.getCurrentAssessmentForm();
            if (!currentAssessmentForm) continue;

            /* Guard: only act for dimensions that declare a URL field */
            const dimHasUrl = (this.task.dimensions[dimensionIndex] as any).url;
            if (!dimHasUrl) continue;

            /* Detect post-assessment suffix target for this step, if any */
            const isPost = !!this.postAssessment && !!this.postAssessmentIndex;
            const suffixedKey = isPost ? `${key}_post_${this.postAssessmentIndex}` : null;

            const baseCtrl = currentAssessmentForm.get(key);
            const postCtrl = suffixedKey ? currentAssessmentForm.get(suffixedKey) : null;

            const sourceControl = (urlFormGroup as any).get(key);
            const sourceValue = sourceControl?.value;

            if (baseCtrl) {
                /* Base control exists in the active form → sync from search UI */
                baseCtrl.setValue(sourceValue);
            } else if (postCtrl) {
                /* Post-assessment copy exists → sync the suffixed control */
                postCtrl.setValue(sourceValue);
            } else {
                if (!isPost) {
                    /*
                     * Initial assessment:
                     * Add the base control by reference to preserve two-way binding with the search UI group.
                     */
                    currentAssessmentForm.addControl(key, sourceControl);
                } else {
                    /*
                     * Post assessment and neither control is present:
                     * Create the suffixed control as a value copy (no direct reference available from the search UI).
                     * This keeps the post form self-contained and avoids mixing base and post URLs.
                     */
                    currentAssessmentForm.addControl(suffixedKey!, new UntypedFormControl(sourceValue));
                }
            }

            /* Track the search engine form group per document/dimension (unchanged behavior) */
            if (!this.searchEngineForms[this.documentIndex]) this.searchEngineForms[this.documentIndex] = [];
            this.searchEngineForms[this.documentIndex][dimensionIndex] = urlFormGroup;
        }
    }


    /* #################### CHECKBOX-BASED CONTROL #################### */

    /*
     * This function handles checkbox-based controls where multiple checkboxes can be selected,
     * not natively supported by Angular Material.
     */
    public handleCheckbox(data: any, dimension: Dimension, index: number) {
        let controlValid = false;
        let currentAssessmentForm = this.getCurrentAssessmentForm();
        let formGroup = currentAssessmentForm?.get(dimension.name.concat('_list'));
        let formControl = currentAssessmentForm?.get(dimension.name.concat('_value'));
        (formGroup as any)?.get(index.toString())?.setValue(data['checked']);

        for (const [_key, value] of Object.entries((formGroup as any).value)) {
            if (value) controlValid = true;
        }

        if (!controlValid) {
            (formControl as any).setValue('');
        } else {
            (formControl as any).setValue((formGroup as any).value);
        }

        (formControl as any).markAsTouched();
        this.task.storeDimensionValue(Object({'value': (formControl as any).value}), this.documentIndex, (dimension as any).index, this.postAssessmentIndex, false);
    }

    /* #################### PAIRWISE ASSESSMENT #################### */

    public unlockNextDimension(documentIndex: number, dimensionIndex: number) {
        if (dimensionIndex == 0) {
            return this.task.documentsPairwiseSelection[documentIndex][0] == true ||
                this.task.documentsPairwiseSelection[documentIndex][1] == true;
        } else {
            return this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex - 1][0] == true &&
                this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex - 1][1] == true;
        }
    }

    public updateDimensionValueSelection(documentIndex: number, dimensionIndex: number, elementIndex: number) {
        if (dimensionIndex < this.task.dimensionsAmount) {
            this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex][elementIndex] = true;
        }
    }

}
