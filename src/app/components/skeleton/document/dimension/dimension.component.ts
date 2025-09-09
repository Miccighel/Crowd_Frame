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
import {
    UntypedFormBuilder,
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
    AbstractControl
} from '@angular/forms';
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
    changeDetector: ChangeDetectorRef;
    sectionService: SectionService;
    utilsService: UtilsService;
    formBuilder: UntypedFormBuilder;

    @Input() worker: Worker;
    @Input() documentIndex: number;
    @Input() documentsForm: Array<UntypedFormGroup>;
    @Input() documentsFormsAdditional: Array<Array<UntypedFormGroup>>;
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    @Input() postAssessment: boolean;
    @Input() postAssessmentIndex: number;
    @Input() initialAssessmentFormInteraction: boolean;
    @Input() followingAssessmentAllowed: boolean;

    /* #################### LOCAL ATTRIBUTES #################### */
    task: Task;
    mostRecentDataRecord: DataRecord;

    assessmentForm: UntypedFormGroup;
    assessmentFormAdditional: UntypedFormGroup;

    /** When true, reveal errors even if untouched. Set by parent on Next/Submit. */
    submitted = false;

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

    /* ---------------------- helpers: disabled state ---------------------- */
    private isGlobalFormsDisabled(): boolean {
        return !!this.task?.countdownsExpired?.[this.documentIndex] &&
            this.task?.settings?.countdown_behavior === 'disable_forms';
    }

    private toggleCtrlEnabled(form: UntypedFormGroup, controlName: string, enabled: boolean) {
        const c = form.get(controlName);
        if (!c) return;
        if (enabled) c.enable({emitEvent: false});
        else c.disable({emitEvent: false});
    }

    /**
     * Video special-case: subscribe primary categorical and toggle secondary categorical
     * and interval controls accordingly (no template [disabled] bindings).
     */
    private setupDynamicDisableSubscriptions(form: UntypedFormGroup, suffix: string) {
        const isVideo = this.task?.settings?.attributesMain?.some(a => a.is_video);
        if (!isVideo) return;

        const primary = this.getPrimaryCategoricalDimension();
        if (!primary || !(primary.scale instanceof ScaleCategorical)) return;

        const primaryKey = `${primary.name}_value${suffix}`;
        const primaryCtrl = form.get(primaryKey);
        if (!primaryCtrl) return;

        const intervalDim = this.getIntervalDimension();
        const secondary = this.getSecondaryCategoricalDimension();

        const apply = (val: any) => {
            // Enable when the "second" option is selected (matches prior logic)
            const onValue = (primary.scale as ScaleCategorical).mapping?.[1]?.value;
            const enable = val === onValue;

            if (intervalDim) {
                this.toggleCtrlEnabled(form, `${intervalDim.name}_value${suffix}`, enable);
            }
            if (secondary && secondary.name !== primary.name) {
                this.toggleCtrlEnabled(form, `${secondary.name}_value${suffix}`, enable);
                // If secondary is multi-select, also toggle the group
                const secListKey = `${secondary.name}_list${suffix}`;
                if (form.get(secListKey)) this.toggleCtrlEnabled(form, secListKey, enable);
            }
        };

        // Initial state + subsequent changes
        apply(primaryCtrl.value);
        primaryCtrl.valueChanges.subscribe(apply);
    }

    /*
     * Initializes form controls for evaluating the task's dimensions.
     * Used by the initialization method, where controlSuffix customizes post-assessment control names.
     * For the initial assessment, the suffix is ''. Otherwise '_post_{postAssessmentIndex}'.
     */
    public initializeControls(controlSuffix: string) {
        const controlsConfig: any = {};
        const globallyDisabled = this.isGlobalFormsDisabled();

        for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
            const dimension: Dimension = this.task.dimensions[index_dimension];

            if (!this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {
                continue;
            }

            /* ───────────── NON-PAIRWISE ───────────── */
            if (!dimension.pairwise) {
                if (!this.checkIfDimensionIsEnabledForPostAssessment(dimension.name)) continue;

                if (dimension.scale) {
                    let answerValue: any = null;
                    if (this.mostRecentDataRecord) {
                        const prev = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value${controlSuffix}`];
                        answerValue = (prev === undefined) ? null : prev;
                    }

                    if (dimension.scale.type === 'categorical') {
                        if ((dimension.scale as ScaleCategorical).multipleSelection) {
                            // Checkboxes group + value control
                            const answers: any = {};
                            (dimension.scale as ScaleCategorical).mapping.forEach((_v, idx) => answers[idx] = false);
                            const listGroup = this.formBuilder.group(answers);
                            if (globallyDisabled) listGroup.disable({emitEvent: false});
                            controlsConfig[`${dimension.name}_list${controlSuffix}`] = listGroup;

                            controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                                new UntypedFormControl(
                                    {value: answerValue, disabled: globallyDisabled},
                                    [Validators.required]
                                );
                        } else {
                            controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                                new UntypedFormControl(
                                    {value: answerValue, disabled: globallyDisabled},
                                    [Validators.required]
                                );
                        }
                    }

                    if (dimension.scale.type === 'interval') {
                        if (answerValue === undefined) answerValue = null; // must choose explicitly
                        controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                            new UntypedFormControl(
                                {value: answerValue, disabled: globallyDisabled},
                                [Validators.required]
                            );
                    }

                    if (dimension.scale.type === 'magnitude_estimation') {
                        controlsConfig[`${dimension.name}_value${controlSuffix}`] =
                            new UntypedFormControl(
                                {value: answerValue, disabled: globallyDisabled},
                                [this.utilsService.numberGreaterThanValidator(((dimension.scale as ScaleMagnitude).min))]
                            );
                    }
                }

                if (dimension.justification) {
                    let answerJustification = '';
                    if (this.mostRecentDataRecord) {
                        const prevJ = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification${controlSuffix}`];
                        answerJustification = prevJ || '';
                    }
                    controlsConfig[`${dimension.name}_justification${controlSuffix}`] =
                        new UntypedFormControl(
                            {value: answerJustification, disabled: globallyDisabled},
                            [Validators.required, this.validateJustification.bind(this)]
                        );
                }

                // Optional URL (post steps only)
                if ((dimension as any).url && controlSuffix !== '') {
                    let urlPrev = '';
                    if (this.mostRecentDataRecord) {
                        const answers = this.mostRecentDataRecord.loadAnswers();
                        urlPrev = answers[`${dimension.name}_url${controlSuffix}`]
                            ?? answers[`${dimension.name}_url`]
                            ?? '';
                    }
                    controlsConfig[`${dimension.name}_url${controlSuffix}`] =
                        new UntypedFormControl({value: urlPrev, disabled: globallyDisabled});
                }

                /* ───────────── PAIRWISE ───────────── */
            } else {
                const subdocs = (this.task.documents[this.documentIndex] as any)?.subdocuments || [];
                for (let j = 0; j < subdocs.length; j++) {
                    if (dimension.scale) {
                        let answerValue: any = null;
                        if (this.mostRecentDataRecord) {
                            const prev = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value_element_${j}`];
                            answerValue = (prev === undefined) ? null : prev;
                        }

                        if (dimension.scale.type === 'categorical') {
                            controlsConfig[`${dimension.name}_value_element_${j}`] =
                                new UntypedFormControl(
                                    {value: answerValue, disabled: globallyDisabled},
                                    [Validators.required]
                                );
                        }

                        if (dimension.scale.type === 'interval') {
                            if (answerValue === undefined) answerValue = null;
                            controlsConfig[`${dimension.name}_value_element_${j}`] =
                                new UntypedFormControl(
                                    {value: answerValue, disabled: globallyDisabled},
                                    [Validators.required]
                                );
                        }

                        if (dimension.scale.type === 'magnitude_estimation') {
                            controlsConfig[`${dimension.name}_value_element_${j}`] =
                                new UntypedFormControl(
                                    {value: answerValue, disabled: globallyDisabled},
                                    [this.utilsService.numberGreaterThanValidator(((dimension.scale as ScaleMagnitude).min))]
                                );
                        }
                    }

                    if (dimension.justification) {
                        let answerJustification = '';
                        if (this.mostRecentDataRecord) {
                            const prevJ = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification_element_${j}`];
                            answerJustification = prevJ || '';
                        }
                        controlsConfig[`${dimension.name}_justification_element_${j}`] =
                            new UntypedFormControl(
                                {value: answerJustification, disabled: globallyDisabled},
                                [Validators.required, this.validateJustification.bind(this)]
                            );
                    }
                }
            }
        }
        return controlsConfig;
    }

    ngOnInit() {
        this.task = this.sectionService.task;
        this.mostRecentDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex];
        let assessForm: UntypedFormGroup | null = null;

        if (this.documentsForm[this.documentIndex]) {
            assessForm = this.documentsForm[this.documentIndex];
        } else {
            assessForm = this.formBuilder.group(this.initializeControls(''));
            assessForm.valueChanges.subscribe(value => {
                const allValuesNotEmpty = Object.values(value).every(val => val !== '' && val !== null);
                this.assessmentFormValidityEmitter.emit({
                    postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                    allValuesNotEmpty
                });
            });
        }

        this.assessmentForm = assessForm!;
        this.setupDynamicDisableSubscriptions(this.assessmentForm, '');

        this.formEmitter.emit({
            index: this.documentIndex,
            type: 'initial',
            form: this.assessmentForm
        });

        if (this.documentsFormsAdditional?.[this.documentIndex]) {
            if (this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex - 1]) {
                this.assessmentFormAdditional = this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex - 1];
                this.setupDynamicDisableSubscriptions(this.assessmentFormAdditional, `_post_${this.postAssessmentIndex}`);
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

        // Restore past answers → create post form if needed
        const mostRecentAnswersForPostAssessment =
            this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, this.postAssessmentIndex);
        if (Object.keys(mostRecentAnswersForPostAssessment).length > 0) {
            if (this.assessmentForm) {
                this.assessmentForm.disable({emitEvent: false});
                const controlsConfig = this.initializeControls(`_post_${this.postAssessmentIndex}`);
                this.assessmentFormAdditional = this.formBuilder.group(controlsConfig);

                if (this.postAssessmentIndex <= this.task.retrieveIndexOfLastPostAssessmentStep()) {
                    this.assessmentFormAdditional.disable({emitEvent: false});
                }

                this.setupDynamicDisableSubscriptions(this.assessmentFormAdditional, `_post_${this.postAssessmentIndex}`);

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

    ngOnChanges(changes: SimpleChanges) {
        if (changes['followingAssessmentAllowed']?.currentValue) {
            const controlSuffix = `_post_${this.postAssessmentIndex}`;
            const controlsConfig = this.initializeControls(controlSuffix);

            if (this.assessmentForm) {
                this.assessmentForm.disable({emitEvent: false});
                const currentForm = this.getCurrentAssessmentForm();

                Object.entries(currentForm.controls)?.forEach(([controlName, _control]) => {
                    const suffixed = controlName.concat(controlSuffix);
                    if (suffixed in controlsConfig) {
                        controlsConfig[suffixed]?.setValue(currentForm?.get(controlName)?.value);
                    }
                });

                this.assessmentFormAdditional = this.formBuilder.group(controlsConfig);
                this.setupDynamicDisableSubscriptions(this.assessmentFormAdditional, controlSuffix);

                this.assessmentFormValidityEmitter.emit({
                    postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                    allValuesNotEmpty: true
                });

                this.assessmentFormAdditional.valueChanges.subscribe(value => {
                    const allValuesNotEmpty = Object.values(value).every(val => val !== '' && val !== null);
                    this.assessmentFormValidityEmitter.emit({
                        postAssessmentIndex: this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                        allValuesNotEmpty
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

    /* #################### VALIDATION VISIBILITY #################### */
    public shouldShowValidation(form: UntypedFormGroup, controlPath: string): boolean {
        const c: AbstractControl | null = form?.get(controlPath) ?? null;
        if (!c) return false;
        return c.invalid && (c.touched || c.dirty || this.submitted);
    }

    public markGroupAsSubmitted(form: UntypedFormGroup): void {
        this.submitted = true;
        form?.markAllAsTouched();
        form?.updateValueAndValidity({onlySelf: false, emitEvent: false});
    }

    /* #################### CATEGORICAL DIMENSION CONTROLS FOR VIDEO TASKS #################### */
    public detectCategoricalDimensionOnChange(eventData: { value?: any; target?: any; }) {
        if (this.task.settings.attributesMain.some(attribute => attribute.is_video) &&
            this.task.dimensions.some(dimension => dimension.scale.type == 'interval') &&
            this.task.dimensions.filter(d => d.scale && d.scale.type === 'categorical').length > 1) {

            const currentValue = String(Object.keys(eventData).includes('value') ? eventData.value : eventData.target.value);
            const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            const previousValue = this.assessmentForm.controls[primaryCategoricalDimension.name.concat('_value')].value;

            if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
                if (currentValue == primaryCategoricalDimension.scale.mapping[0].value) {
                    const intervalDimension = this.getIntervalDimension();
                    const secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();

                    if (intervalDimension?.scale instanceof ScaleInterval) {
                        this.assessmentForm.controls[intervalDimension.name.concat('_value')].setValue(intervalDimension.scale.min);
                    }
                    if (secondaryCategoricalDimension?.scale instanceof ScaleCategorical) {
                        this.assessmentForm.controls[secondaryCategoricalDimension.name.concat('_value')].setValue(secondaryCategoricalDimension.scale.mapping[0].value);
                    }
                } else if (previousValue == primaryCategoricalDimension.scale.mapping[0].value) {
                    const intervalDimension = this.getIntervalDimension();
                    const secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();

                    if (intervalDimension?.scale instanceof ScaleInterval) {
                        this.assessmentForm.controls[intervalDimension.name.concat('_value')].setValue(null);
                    }
                    if (secondaryCategoricalDimension?.scale instanceof ScaleCategorical) {
                        this.assessmentForm.controls[secondaryCategoricalDimension.name.concat('_value')].setValue('');
                    }
                }
            }
        }
    }

    /* Returns the subdocuments array for the given document index. */
    /* Defensive: the auto-generated Document may not declare 'subdocuments'. */
    public getSubdocumentsHelper(idx: number): any[] {
        const doc: any = this.task?.documents?.[idx];
        return Array.isArray(doc?.subdocuments) ? doc.subdocuments : [];
    }

    /* #################### INTERVAL DIMENSION CONTROLS FOR VIDEO TASKS #################### */

    public isVideoTimestampInterval(): boolean {
        return this.task.settings.attributesMain.some(attribute => attribute.is_video) &&
            this.task.dimensions.some(dimension => dimension.scale.type == 'categorical');
    }

    public isVideoTypeLabelCategorical(currentCategoricalDimension: Dimension): boolean {
        if (currentCategoricalDimension.scale && currentCategoricalDimension.scale instanceof ScaleCategorical) {
            const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
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
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === 'categorical');
    }

    private getSecondaryCategoricalDimension(): Dimension {
        return this.task.dimensions.filter(dimension => dimension.scale && dimension.scale.type === 'categorical')[1];
    }

    private getIntervalDimension(): Dimension {
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === 'interval');
    }

    /* #################### POST ASSESSMENT #################### */
    public getCurrentAssessmentForm() {
        if (this.postAssessment) {
            if (this.postAssessmentIndex <= 1) {
                return this.documentsForm[this.documentIndex];
            } else {
                return this.documentsFormsAdditional[this.documentIndex][this.documentsFormsAdditional[this.documentIndex].length - 1];
            }
        } else {
            return this.documentsForm[this.documentIndex];
        }
    }

    public checkIfDimensionIsEnabledForPostAssessment(name: string) {
        let enabled = true;
        if (!this.postAssessmentIndex && this.task.getFirstPostAssessmentStepInWhichDimensionAppears(name) > 0) {
            enabled = false;
        }
        if (this.postAssessmentIndex && !this.task.getAllPostAssessmentStepsInWhichDimensionAppears(name).includes(this.postAssessmentIndex - 1)) {
            enabled = false;
        }
        return enabled;
    }

    /**
     * Returns only the dimensions valid for the CURRENT document's task type.
     * Internally relies on:
     *   task.checkCurrentTaskType(task.documents[documentIndex], dimension.task_type)
     *
     * Behavior:
     *  - For MAIN documents:     keeps dimensions whose task_type is main or both.
     *  - For TRAINING documents: keeps dimensions whose task_type is training or both.
     *
     * This is the step that ensures TRAINING dimensions render when the current
     * document is a training doc (and likewise for main docs).
     */
    public filterDimensionsAccordingToTaskType(dimensions: Array<Dimension>): Array<Dimension> {
        const filtered: Array<Dimension> = [];
        for (const dimension of dimensions) {
            if (this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {
                filtered.push(dimension);
            }
        }
        return filtered;
    }

    public getFirstMatrixDimensionWithScale(dims: Array<Dimension>): Dimension | null {
        if (!Array.isArray(dims)) return null;
        for (const d of dims) {
            const scale: any = (d as any)?.scale;
            if (scale && Array.isArray(scale.mapping) && scale.mapping.length > 0) {
                return d;
            }
        }
        return null;
    }


    /* #################### JUSTIFICATION #################### */
    public validateJustification(control: UntypedFormControl) {
        let minWords = 0;
        const words = (control.value || '').split(' ');
        const cleanedWords: Array<string> = [];
        for (const word of words) {
            const trimmedWord = word.trim();
            if (trimmedWord.length > 0) cleanedWords.push(trimmedWord);
        }
        const currentAssessmentForm = this.getCurrentAssessmentForm();
        if (currentAssessmentForm) {
            const currentDocument = this.documentIndex;

            if (this.task.searchEngineSelectedResponses[currentDocument]) {
                if (this.task.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
                    const selectedUrl: any = Object.values(this.task.searchEngineSelectedResponses[currentDocument]['data']).pop();
                    const response = selectedUrl['response'];
                    for (const word of cleanedWords) {
                        if (word == response['url']) return {'invalid': 'You cannot use the selected search engine url as part of the justification.'};
                    }
                }
            }

            const allControls = currentAssessmentForm.controls;
            const currentControl = Object.keys(allControls).find(name => control === (allControls as any)[name]);
            if (currentControl) {
                const currentDimensionName = currentControl.split('_')[0];
                for (const dimension of this.task.dimensions) {
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
    public verifyUrlSelection(position: string) {
        const positionsToCheck: Array<string> = [];
        if (position == 'top') positionsToCheck.push('top');
        if (position == 'middle') positionsToCheck.push('top', 'middle');
        if (position == 'bottom') positionsToCheck.push('top', 'middle', 'bottom');

        const currentDocument = this.task.documents[this.documentIndex];

        const dimensionsToCheck: Array<Dimension> = [];
        for (const dimension of this.task.dimensions) {
            /* Consider only dimensions in scope (layout position) */
            if ((dimension as any).style && positionsToCheck.includes((dimension as any).style.position)) {

                /* Respect current document task type (main/training) */
                if (!this.task.checkCurrentTaskType(currentDocument, (dimension as any).task_type)) continue;

                /* URL requirement: url === true OR url.enable === true */
                const urlConf: any = (dimension as any).url;
                const requiresUrl =
                    urlConf === true ||
                    (urlConf && typeof urlConf === 'object' && urlConf.enable === true);

                if (requiresUrl) {
                    dimensionsToCheck.push(dimension);
                }
            }
        }

        const currentAssessmentForm = this.getCurrentAssessmentForm();
        const suffix = (this.postAssessment && this.postAssessmentIndex) ? `_post_${this.postAssessmentIndex}` : '';

        let result = true;
        for (const dimension of dimensionsToCheck) {
            const keyBase = `${dimension.name}_url`;
            const keyStep = `${dimension.name}_url${suffix}`;
            const ctrl = currentAssessmentForm?.get(keyStep) ?? currentAssessmentForm?.get(keyBase);
            if (!ctrl || !ctrl.value) result = false;
        }
        return result;
    }


    public storeSearchEngineUrl(urlFormGroup: UntypedFormGroup, dimensionIndex: number) {
        for (const [key, _] of Object.entries(urlFormGroup.controls)) {
            const currentAssessmentForm = this.getCurrentAssessmentForm();
            if (!currentAssessmentForm) continue;

            const dimHasUrl = (this.task.dimensions[dimensionIndex] as any).url;
            if (!dimHasUrl) continue;

            const isPost = !!this.postAssessment && !!this.postAssessmentIndex;
            const suffixedKey = isPost ? `${key}_post_${this.postAssessmentIndex}` : null;

            const baseCtrl = currentAssessmentForm.get(key);
            const postCtrl = suffixedKey ? currentAssessmentForm.get(suffixedKey) : null;

            const sourceControl = (urlFormGroup as any).get(key);
            const sourceValue = sourceControl?.value;

            if (baseCtrl) {
                baseCtrl.setValue(sourceValue);
            } else if (postCtrl) {
                postCtrl.setValue(sourceValue);
            } else {
                if (!isPost) {
                    currentAssessmentForm.addControl(key, sourceControl);
                } else {
                    currentAssessmentForm.addControl(suffixedKey!, new UntypedFormControl(sourceValue));
                }
            }

            if (!this.searchEngineForms[this.documentIndex]) this.searchEngineForms[this.documentIndex] = [];
            this.searchEngineForms[this.documentIndex][dimensionIndex] = urlFormGroup;
        }
    }

    /* #################### CHECKBOX-BASED CONTROL #################### */
    public handleCheckbox(data: any, dimension: Dimension, index: number) {
        let controlValid = false;
        const currentAssessmentForm = this.getCurrentAssessmentForm();
        const formGroup = currentAssessmentForm?.get(dimension.name.concat('_list'));
        const formControl = currentAssessmentForm?.get(dimension.name.concat('_value'));
        (formGroup as any)?.get(index.toString())?.setValue(data['checked']);

        for (const [_key, value] of Object.entries((formGroup as any).value)) {
            if (value) controlValid = true;
        }

        if (!controlValid) (formControl as any).setValue('');
        else (formControl as any).setValue((formGroup as any).value);

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
