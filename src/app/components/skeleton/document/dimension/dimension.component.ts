/* Core */
import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators} from "@angular/forms";
/* Material Design */
import {MatStepper} from "@angular/material/stepper";
/* Services */
import {SectionService} from "../../../../services/section.service";
import {UtilsService} from "../../../../services/utils.service";
/* Models */
import {Task} from "../../../../models/skeleton/task";
import {ScaleCategorical, ScaleInterval, ScaleMagnitude} from "../../../../models/skeleton/dimension";
/* Components */
import {SearchEngineComponent} from "./search-engine/search-engine.component";
import {Worker} from "../../../../models/worker/worker";
import {DataRecord} from "../../../../models/skeleton/dataRecord";

@Component({
    selector: 'app-dimension',
    templateUrl: './dimension.component.html',
    styleUrls: ['./dimension.component.scss', '../document.component.scss']
})
export class DimensionComponent implements OnInit {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;
    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: UntypedFormBuilder;

    @Input() task: Task
    @Input() worker: Worker
    @Input() documentIndex: number
    @Input() documentsForm: UntypedFormGroup[]
    @Input() searchEngineForms: Array<Array<UntypedFormGroup>>;
    @Input() resultsRetrievedForms: Array<Array<Object>>;

    previousDataRecord: DataRecord
    assessmentForm: UntypedFormGroup

    @Output() formEmitter: EventEmitter<Object>;

    /* References to task stepper and token forms */
    @ViewChild('stepper') stepper: MatStepper;
    @ViewChildren(SearchEngineComponent) searchEngines: QueryList<SearchEngineComponent>;

    constructor(
        changeDetector: ChangeDetectorRef,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: UntypedFormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<Object>();
    }

    ngOnInit() {
        this.task = this.sectionService.task
        this.previousDataRecord = this.task.mostRecentDataRecordsForDocuments[this.documentIndex]
        let assessForm = null
        /* A form for each the current HIT element is initialized */
        if (!this.documentsForm[this.documentIndex]) {
            let controlsConfig = {};
            for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
                let dimension = this.task.dimensions[index_dimension];
                if (this.task.isCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type)) {
                    if (!dimension.pairwise) {
                        if (dimension.scale) {
                            let answerValue: string = ''
                            if (this.previousDataRecord)
                                answerValue = this.previousDataRecord.loadAnswers()[`${dimension.name}_value`]
                            if (dimension.scale.type == "categorical") {
                                if ((<ScaleCategorical>dimension.scale).multipleSelection) {
                                    let answers = {}
                                    let scale = (<ScaleCategorical>dimension.scale)
                                    scale.mapping.forEach((value, index) => {
                                        answers[index] = false
                                    });
                                    controlsConfig[`${dimension.name}_list`] = this.formBuilder.group(answers)
                                    controlsConfig[`${dimension.name}_value`] = new UntypedFormControl(answerValue, [Validators.required])
                                } else {
                                    controlsConfig[`${dimension.name}_value`] = new UntypedFormControl(answerValue, [Validators.required]);
                                }
                            }

                            if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value`] = new UntypedFormControl(answerValue, [Validators.required]);
                            if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleInterval>dimension.scale).min))])
                            if (dimension.scale.type == "magnitude_estimation") controlsConfig[`${dimension.name}_value`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleMagnitude>dimension.scale).min))]);
                        }
                        if (dimension.justification) {
                            let answerJustification: string = ''
                            if (this.previousDataRecord)
                                answerJustification = this.previousDataRecord.loadAnswers()[`${dimension.name}_justification`]
                            controlsConfig[`${dimension.name}_justification`] = new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)])
                        }
                    } else {
                        for (let j = 0; j < this.task.documents[this.documentIndex]['pairwise'].length; j++) {
                            if (dimension.scale) {
                                let answerValue: string = ''
                                if (this.previousDataRecord)
                                    answerValue = this.previousDataRecord.loadAnswers()[`${dimension.name}_value_element_${j}`]
                                if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [Validators.required]);
                                if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleInterval>dimension.scale).min))])
                                if (dimension.scale.type == "magnitude_estimation") controlsConfig[`${dimension.name}_value_element_${j}`] = new UntypedFormControl(answerValue, [this.utilsService.numberGreaterThanValidator(((<ScaleMagnitude>dimension.scale).min))]);
                            }
                            if (dimension.justification) {
                                let answerJustification: string = ''
                                if (this.previousDataRecord)
                                    answerJustification = this.previousDataRecord.loadAnswers()[`${dimension.name}_justification_element_${j}`]
                                controlsConfig[`${dimension.name}_justification_element_${j}`] = new UntypedFormControl(answerJustification, [Validators.required, this.validateJustification.bind(this)])
                            }
                        }
                    }
                }
            }
            assessForm = this.formBuilder.group(controlsConfig)
        } else {
            assessForm = this.documentsForm[this.documentIndex]
        }
        this.assessmentForm = assessForm
        this.formEmitter.emit({
            "index": this.documentIndex,
            "form": assessForm
        })
    }

    public filterDimensionsCurrent(dimensions) {
        let filteredDimensions = [];
        for (let dimension of dimensions) {
            if (this.task.isCurrentTaskType(this.task.documents[this.documentIndex], dimension.task_type))
                filteredDimensions.push(dimension);
        }
        return filteredDimensions;
    }

    /*
     * This function performs a validation of the worker justification field each time the current worker types or pastes in its inside
     * if the worker types the selected url as part of the justification an <invalid> error is raised
     * if the worker types a justification which has lesser than 15 words a <longer> error is raised
     * IMPORTANT: the <return null> part means: THE FIELD IS VALID
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
        if (this.assessmentForm) {
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
            const allControls = this.assessmentForm.controls;
            let currentControl = Object.keys(allControls).find(name => control === allControls[name])
            if (currentControl) {
                let currentDimensionName = currentControl.split("_")[0]
                for (let dimension of this.task.dimensions) if (dimension.name == currentDimensionName) if (dimension.justification.min_words) minWords = dimension.justification.min_words
                return cleanedWords.length > minWords ? null : {"longer": "This is not valid."};
            }
        }
    }

    public storeSearchEngineUrl(urlFormGroup, dimensionIndex) {
        for (const [key, value] of Object.entries(urlFormGroup.controls)) {
            if (!this.assessmentForm.get(key) && this.task.dimensions[dimensionIndex].url) {
                this.assessmentForm.addControl(key, urlFormGroup.get(key))

                if (!this.searchEngineForms[this.documentIndex]) this.searchEngineForms[this.documentIndex] = []
                this.searchEngineForms[this.documentIndex][dimensionIndex] = urlFormGroup
            }
        }
    }

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
                let dimensionForm = this.assessmentForm
                if (dimensionForm.get(dimension.name.concat("_url"))) {
                    let value = dimensionForm.get(dimension.name.concat("_url")).value
                    if (!value)
                        result = false
                }
            }
        }
        return result
    }

    public handleCheckbox(data, dimension, index) {
        let controlValid = false
        let formGroup = this.assessmentForm.get(dimension.name.concat('_list'))
        let formControl = this.assessmentForm.get(dimension.name.concat('_value'))
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
        this.task.storeDimensionValue(Object({'value': formControl.value}), this.documentIndex, dimension.index)
    }

    /* |--------- PAIRWISE ---------| */

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