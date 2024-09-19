/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, QueryList, SimpleChanges, ViewChild, ViewChildren} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from "@angular/forms";
/* Material Design */
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {SectionService} from "../../../../services/section.service";
import {UtilsService} from "../../../../services/utils.service";
/* Models */
import {Task} from "../../../../models/skeleton/task";
import {Dimension, ScaleCategorical, ScaleInterval, ScaleMagnitude} from "../../../../models/skeleton/dimension";
/* Components */
import {SearchEngineComponent} from "./search-engine/search-engine.component";
import {Worker} from "../../../../models/worker/worker";
import {DataRecord} from "../../../../models/skeleton/dataRecord";

@Component({
    selector: 'app-dimension',
    templateUrl: './dimension.component.html',
    styleUrls: ['./dimension.component.scss', '../document.component.scss']
})

export class DimensionComponent implements OnInit, OnChanges {

    /* #################### SERVICES & CORE STUFF #################### */

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;
    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    @Input() worker: Worker
    @Input() documentIndex: number
    @Input() documentsForm: Array<UntypedFormGroup>
    @Input() documentsFormsAdditional: Array<Array<UntypedFormGroup>>
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;
    /* Used to understand if the current document is being assessed for a second time */
    @Input() postAssessment: boolean
    @Input() postAssessmentIndex: number
    @Input() initialAssessmentFormInteraction: boolean
    @Input() followingAssessmentAllowed: boolean

    /* #################### LOCAL ATTRIBUTES #################### */

    task: Task
    mostRecentDataRecord: DataRecord
    /* Base assessment form of the document */
    assessmentForm: UntypedFormGroup;
    /* Additional assessment forms for the document, one for each post-assessment step */
    assessmentFormAdditional: UntypedFormGroup

    /* #################### EMITTERS #################### */

    @Output() formEmitter: EventEmitter<Object>;
    @Output() assessmentFormValidityEmitter: EventEmitter<Object>;
    @Output() followingAssessmentAllowedEmitter: EventEmitter<boolean>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: UntypedFormBuilder,
    ) {
        this.sectionService = sectionService
        this.changeDetector = changeDetector
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.task = this.sectionService.task
        this.formEmitter = new EventEmitter<Object>();
        this.assessmentFormValidityEmitter = new EventEmitter<boolean>();
        this.followingAssessmentAllowedEmitter = new EventEmitter<boolean>();
    }

    /* Initializes form controls for evaluating the task's dimensions.
     * Used by the initialization method, where controlSuffix customizes post-assessment control names.
     * For the initial assessment, the suffix is set to ''. Otherwise, it will be '_post_{postAssessmentIndex}'. */
    public initializeControls(controlSuffix: string) {
        let controlsConfig = {};
        for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
            let dimension = this.task.dimensions[index_dimension];
            if (this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {
                if (!dimension.pairwise) {
                    if (this.checkIfDimensionIsEnabledForPostAssessment(dimension.name)) {
                        if (dimension.scale) {
                            let answerValue: string = ''
                            if (this.mostRecentDataRecord)
                                answerValue = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value${controlSuffix}`]
                            if (dimension.scale.type == "categorical") {
                                if ((<ScaleCategorical>dimension.scale).multipleSelection) {
                                    let answers = {}
                                    let scale = (<ScaleCategorical>dimension.scale)
                                    scale.mapping.forEach((value, index) => {
                                        answers[index] = false
                                    });
                                    controlsConfig[`${dimension.name}_list${controlSuffix}`] = this.formBuilder.group(answers)
                                    controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required])
                                } else {
                                    controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required]);
                                }
                            }

                            if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required]);
                            if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [Validators.required])
                            if (dimension.scale.type == "magnitude_estimation") controlsConfig[`${dimension.name}_value${controlSuffix}`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleMagnitude>dimension.scale).min))]);
                        }
                        if (dimension.justification) {
                            let answerJustification: string = ''
                            if (this.mostRecentDataRecord)
                                answerJustification = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification${controlSuffix}`]
                            controlsConfig[`${dimension.name}_justification${controlSuffix}`] = new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)])
                        }
                    }
                } else {
                    for (let j = 0; j < this.task.documents[this.documentIndex]['pairwise'].length; j++) {
                        if (dimension.scale) {
                            let answerValue: string = ''
                            if (this.mostRecentDataRecord)
                                answerValue = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_value_element_${j}`]
                            if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [Validators.required]);
                            if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [Validators.required])
                            if (dimension.scale.type == "magnitude_estimation") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleMagnitude>dimension.scale).min))]);
                        }
                        if (dimension.justification) {
                            let answerJustification: string = ''
                            if (this.mostRecentDataRecord)
                                answerJustification = this.mostRecentDataRecord.loadAnswers()[`${dimension.name}_justification_element_${j}`]
                            controlsConfig[`${dimension.name}_justification_element_${j}`] = new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)])
                        }
                    }
                }
            }
        }
        return controlsConfig
    }

    ngOnInit() {
        this.task = this.sectionService.task
        this.mostRecentDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex]
        let assessForm = null
        /* Initialize the initial form if it does not already exist. */
        if (this.documentsForm[this.documentIndex]) {
            assessForm = this.documentsForm[this.documentIndex]
        } else {
            /* Notice the control initialization with an empty string as suffix, meaning they will retain the base name */
            assessForm = this.formBuilder.group(this.initializeControls(''))
            assessForm.valueChanges.subscribe(value => {
                const allValuesNotEmpty = Object.values(value).every(val => val !== '');
                this.assessmentFormValidityEmitter.emit({
                    "postAssessmentIndex": this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                    "allValuesNotEmpty": allValuesNotEmpty
                });
            });
        }
        this.assessmentForm = assessForm
        this.formEmitter.emit({
            "index": this.documentIndex,
            "type": "initial",
            "form": assessForm
        })
        if (this.documentsFormsAdditional) {
            if (this.documentsFormsAdditional[this.documentIndex]) {
                if (this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex- 1]) {
                    this.assessmentFormAdditional = this.documentsFormsAdditional[this.documentIndex][this.postAssessmentIndex - 1]
                    this.formEmitter.emit({
                        "index": this.documentIndex,
                        "type": "post",
                        "postAssessmentIndex": this.postAssessmentIndex,
                        "form": this.assessmentFormAdditional
                    })
                }
                this.followingAssessmentAllowed = true
                this.followingAssessmentAllowedEmitter.emit(this.followingAssessmentAllowed);
            }
        }
        /* Restore past answers from post-assessment steps in the form controls if they exist. */
        let mostRecentAnswersForPostAssessment = this.task.retrieveMostRecentAnswersForPostAssessment(this.documentIndex, this.postAssessmentIndex)
        if (Object.keys(mostRecentAnswersForPostAssessment).length > 0) {
            if (this.assessmentForm) {
                this.assessmentForm.disable()
                /* Notice the control initialization with a string as suffix that depends on the current post assessment index */
                let controlsConfig = this.initializeControls(`_post_${this.postAssessmentIndex}`)
                this.assessmentFormAdditional = this.formBuilder.group(controlsConfig)
                if (this.postAssessmentIndex <= this.task.retrieveIndexOfLastPostAssessmentStep())
                    this.assessmentFormAdditional.disable()
                this.formEmitter.emit({
                    "index": this.documentIndex,
                    "type": "post",
                    "postAssessmentIndex": this.postAssessmentIndex,
                    "form": this.assessmentFormAdditional
                })
                this.followingAssessmentAllowed = true
                this.followingAssessmentAllowedEmitter.emit(this.followingAssessmentAllowed);
            }
        }
    }

    /* Change detection behavior is necessary to enable the following step and initialize required form controls
       when the initial assessment or a post-assessment step is completed. */
    ngOnChanges(changes: SimpleChanges) {
        if (changes.followingAssessmentAllowed) {
            let followingAssessmentAllowedChange = changes.followingAssessmentAllowed
            if (followingAssessmentAllowedChange.currentValue) {
                let controlSuffix = `_post_${this.postAssessmentIndex}`
                let controlsConfig = this.initializeControls(controlSuffix)
                if (this.assessmentForm) {
                    this.assessmentForm.disable()
                    let currentForm = this.getCurrentAssessmentForm()
                    Object.entries(currentForm.controls).forEach(([controlName, control], index) => {
                        if (controlName.concat(controlSuffix) in controlsConfig)
                            controlsConfig[controlName.concat(controlSuffix)].setValue(currentForm.get(controlName).value);
                    });
                    this.assessmentFormAdditional = this.formBuilder.group(controlsConfig)
                    this.assessmentFormValidityEmitter.emit({
                        "postAssessmentIndex": this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                        "allValuesNotEmpty": true
                    });
                    this.assessmentFormAdditional.valueChanges.subscribe(value => {
                        const allValuesNotEmpty = Object.values(value).every(val => val !== '');
                        this.assessmentFormValidityEmitter.emit({
                            "postAssessmentIndex": this.postAssessmentIndex ? this.postAssessmentIndex : 0,
                            "allValuesNotEmpty": allValuesNotEmpty
                        });
                    });
                    this.formEmitter.emit({
                        "index": this.documentIndex,
                        "type": "post",
                        "postAssessmentIndex": this.postAssessmentIndex,
                        "form": this.assessmentFormAdditional
                    })
                }
            }
        }
    }

    /* #################### CATEGORICAL DIMENSION CONTROLLS FOR VIDEO TASKS #################### */
    public detectCategoricalDimensionOnChange(eventData: { value?: any; target?: any; }) {
        if (this.task.settings.attributesMain.some(attribute => attribute.is_video) && 
            this.task.dimensions.some(dimension => dimension.scale.type == "interval") &&
            this.task.dimensions.filter(dimension => dimension.scale && dimension.scale.type === "categorical").length > 1) {
            let currentValue = String(Object.keys(eventData).includes('value') ? eventData.value : eventData.target.value)
            let primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            let previousValue = this.assessmentForm.controls[primaryCategoricalDimension.name.concat('_value').concat('')].value;
            if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
                if (currentValue == primaryCategoricalDimension.scale.mapping[0].value) {  
                    let intervalDimension = this.getIntervalDimension();
                    let secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();
                    
                    if (intervalDimension.scale instanceof ScaleInterval) {
                        this.assessmentForm.controls[intervalDimension.name.concat('_value').concat('')].setValue(intervalDimension.scale.min);
                    }
                    if (secondaryCategoricalDimension.scale instanceof ScaleCategorical) {
                        this.assessmentForm.controls[secondaryCategoricalDimension.name.concat('_value').concat('')].setValue(secondaryCategoricalDimension.scale.mapping[0].value);
                    }            
                }
                else if (previousValue == primaryCategoricalDimension.scale.mapping[0].value) {
                    let intervalDimension = this.getIntervalDimension();
                    let secondaryCategoricalDimension = this.getSecondaryCategoricalDimension();
                    
                    if (intervalDimension.scale instanceof ScaleInterval) {
                        this.assessmentForm.controls[intervalDimension.name.concat('_value').concat('')].setValue('');
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
        return this.task.settings.attributesMain.some(attribute => attribute.is_video) && this.task.dimensions.some(dimension => dimension.scale.type == "categorical");
    }

    public isVideoTypeLabelCategorical(currentCategoricalDimension : Dimension): boolean {
        console.log(currentCategoricalDimension.name)
        if (currentCategoricalDimension.scale && currentCategoricalDimension.scale instanceof ScaleCategorical) {
            let primaryCategoricalDimension = this.getPrimaryCategoricalDimension();

            /* Debug Test */
            let test = this.task.settings.attributesMain.some(attribute => attribute.is_video) && currentCategoricalDimension.name != primaryCategoricalDimension.name;
            //console.log(currentCategoricalDimension.name)
            console.log(test);

            return this.task.settings.attributesMain.some(attribute => attribute.is_video) && currentCategoricalDimension.name != primaryCategoricalDimension.name;
        }
        return false;
    }

    public videoTimestampVisualization(timestamp: number): string {
        const time = String(timestamp).split('.')
        const seconds = time[0].padStart(2, '0')
        const milliseconds = time[1] ? time[1].padEnd(2, '0') : '00'
        return `00:${seconds}.${milliseconds}`
    }

    private getPrimaryCategoricalDimension(): Dimension {
        /* Get the first categorical dimension - the master categorical dimension */
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === "categorical");
    }

    private getSecondaryCategoricalDimension(): Dimension {
        /* Get the second categorical dimension */
        return this.task.dimensions.filter(dimension => dimension.scale && dimension.scale.type === "categorical")[1];
    }

    private getIntervalDimension(): Dimension {
        return this.task.dimensions.find(dimension => dimension.scale && dimension.scale.type === "interval")
    }

    public sliderDisabled(): boolean {
        const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
        if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
            return this.assessmentForm.controls[(primaryCategoricalDimension.name).concat('_value').concat('')].value !== primaryCategoricalDimension.scale.mapping[1].value
        }
    }

    public categoricalDimensionDisabled(currentDimension : Dimension): boolean {
        if (currentDimension.scale instanceof ScaleCategorical) {
            const primaryCategoricalDimension = this.getPrimaryCategoricalDimension();
            if (primaryCategoricalDimension.scale instanceof ScaleCategorical) {
                return this.assessmentForm.controls[(primaryCategoricalDimension.name).concat('_value').concat('')].value !== primaryCategoricalDimension.scale.mapping[1].value && currentDimension.name != primaryCategoricalDimension.name
            }
        }
    }

    /* #################### POST ASSESSMENT #################### */

    /* This function retrieves the current assessment form, depending on whether post assessment is enabled or not. */
    public getCurrentAssessmentForm() {
        if (this.postAssessment) {
            /* The initial assessment involves a postAssessmentIndex lower than 1 */
            if (this.postAssessmentIndex <= 1) {
                return this.documentsForm[this.documentIndex]
            } else {
                return this.documentsFormsAdditional[this.documentIndex][this.documentsFormsAdditional[this.documentIndex].length - 1]
            }
        } else {
            return this.documentsForm[this.documentIndex]
        }
    }

    /* This function checks if a dimension should be reassessed withing a given post assessment step */
    public checkIfDimensionIsEnabledForPostAssessment(name) {
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
    public filterDimensionsAccordingToTaskType(dimensions) {
        let filteredDimensions = [];
        for (let dimension of dimensions) {
            if (this.task.checkCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type))
                filteredDimensions.push(dimension);
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
        let minWords = 0
        let words = control.value.split(' ')
        let cleanedWords = new Array<string>()
        for (let word of words) {
            let trimmedWord = word.trim()
            if (trimmedWord.length > 0) {
                cleanedWords.push(trimmedWord)
            }
        }
        let currentAssessmentForm = this.getCurrentAssessmentForm()
        if (currentAssessmentForm) {
            /* The current document document_index is selected */
            let currentDocument = this.documentIndex;
            /* If the user has selected some search engine responses for the current document */
            if (this.task.searchEngineSelectedResponses[currentDocument]) {
                if (this.task.searchEngineSelectedResponses[currentDocument]['amount'] > 0) {
                    let selectedUrl = Object.values(this.task.searchEngineSelectedResponses[currentDocument]["data"]).pop()
                    let response = selectedUrl["response"]
                    /* The controls are performed */
                    for (let word of cleanedWords) {
                        if (word == response["url"]) return {"invalid": "You cannot use the selected search engine url as part of the justification."}
                    }
                }
            }
            const allControls = currentAssessmentForm.controls;
            let currentControl = Object.keys(allControls).find(name => control === allControls[name])
            if (currentControl) {
                let currentDimensionName = currentControl.split("_")[0]
                for (let dimension of this.task.dimensions) {
                    if (dimension.name == currentDimensionName) if (dimension.justification.min_words) minWords = dimension.justification.min_words
                }
                return cleanedWords.length > minWords ? null : {"longer": "This is not valid."};
            }
        }
    }

    /* #################### SEARCH ENGINE INTERACTION #################### */

    /* Checks if a URL has been selected using the search engine within a given layout position. */
    public verifyUrlSelection(position) {
        let positionsToCheck = []
        if (position == 'top') {
            positionsToCheck.push('top')
        }
        if (position == 'middle') {
            positionsToCheck.push('top')
            positionsToCheck.push('middle')
        }
        if (position == 'bottom') {
            positionsToCheck.push('top')
            positionsToCheck.push('middle')
            positionsToCheck.push('bottom')
        }
        let dimensionsToCheck = []
        for (let dimension of this.task.dimensions) {
            if (positionsToCheck.includes(dimension.style.position)) {
                dimensionsToCheck.push(dimension)
            }
        }
        let result = true
        for (let dimension of dimensionsToCheck) {
            if (dimension.url) {
                let currentAssessmentForm = this.getCurrentAssessmentForm()
                if (currentAssessmentForm.get(dimension.name.concat("_url"))) {
                    let value = currentAssessmentForm.get(dimension.name.concat("_url")).value
                    if (!value)
                        result = false
                }
            }
        }
        return result
    }

    public storeSearchEngineUrl(urlFormGroup, dimensionIndex) {
        for (const [key, value] of Object.entries(urlFormGroup.controls)) {
            let currentAssessmentForm = this.getCurrentAssessmentForm()
            if (!currentAssessmentForm.get(key) && this.task.dimensions[dimensionIndex].url) {
                currentAssessmentForm.addControl(key, urlFormGroup.get(key))
                if (!this.searchEngineForms[this.documentIndex]) this.searchEngineForms[this.documentIndex] = []
                this.searchEngineForms[this.documentIndex][dimensionIndex] = urlFormGroup
            }
        }
    }

    /* #################### CHECKBOX-BASED CONTROL #################### */

    /* This function handles checkbox-based controls where multiple checkboxes can be selected, not natively supported by Angular Material.
     * TODO: Improve the usage of storeDimensionValue for better clarity or handle specific scenarios. */
    public handleCheckbox(data, dimension, index) {
        let controlValid = false
        let currentAssessmentForm = this.getCurrentAssessmentForm()
        let formGroup = currentAssessmentForm.get(dimension.name.concat('_list'))
        let formControl = currentAssessmentForm.get(dimension.name.concat('_value'))
        formGroup.get(index.toString()).setValue(data['checked'])
        for (const [key, value] of Object.entries(formGroup.value)) {
            if (value)
                controlValid = true
        }
        if (!controlValid) {
            formControl.setValue('')
        } else {
            formControl.setValue(formGroup.value)
        }
        formControl.markAsTouched()
        this.task.storeDimensionValue(Object({'value': formControl.value}), this.documentIndex, dimension.index, this.postAssessmentIndex, false)
    }

    /* #################### PAIRWISE ASSESSMENT #################### */

    public unlockNextDimension(documentIndex: number, dimensionIndex: number) {
        if (dimensionIndex == 0) {
            return this.task.documentsPairwiseSelection[documentIndex][0] == true || this.task.documentsPairwiseSelection[documentIndex][1] == true;
        } else {
            return this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex - 1][0] == true && this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex - 1][1] == true;
        }
    }

    public updateDimensionValueSelection(documentIndex: number, dimensionIndex: number, elementIndex: number) {
        if (dimensionIndex < this.task.dimensionsAmount)
            this.task.dimensionsPairwiseSelection[documentIndex][dimensionIndex][elementIndex] = true
    }
}