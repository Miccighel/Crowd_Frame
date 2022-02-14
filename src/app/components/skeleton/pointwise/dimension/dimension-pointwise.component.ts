import {ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {SectionService} from "../../../../services/section.service";
import {UtilsService} from "../../../../services/utils.service";
import {Task} from "../../../../models/task";
import {DeviceDetectorService} from "ngx-device-detector";
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {ScaleInterval, ScaleMagnitude} from "../../../../models/dimension";
import {Object} from "aws-sdk/clients/customerprofiles";
import {MatStepper} from "@angular/material/stepper";
import {AnnotatorOptionsComponent} from "../elements/annotator-options/annotator-options.component";
import {SearchEngineComponent} from "./search-engine/search-engine.component";

@Component({
    selector: 'app-dimension-pointwise',
    templateUrl: './dimension-pointwise.component.html',
    styleUrls: ['./dimension-pointwise.component.scss', './dimension.shared.component.scss', '../../skeleton.shared.component.scss']
})
export class DimensionPointwiseComponent implements OnInit {

    /* Change detector to manually intercept changes on DOM */
    changeDetector: ChangeDetectorRef;

    /* Service to detect user's device */
    sectionService: SectionService;
    utilsService: UtilsService
    /* Angular Reactive Form builder (see https://angular.io/guide/reactive-forms) */
    formBuilder: FormBuilder;

    @Input() task: Task
    @Input() documentIndex: number

    assessmentForms: FormGroup[]

    @Output() formEmitter: EventEmitter<FormGroup>;

    /* References to task stepper and token forms */
    @ViewChild('stepper') stepper: MatStepper;
    @ViewChildren(SearchEngineComponent) searchEngines: QueryList<SearchEngineComponent>;

    constructor(
        changeDetector: ChangeDetectorRef,
        deviceDetectorService: DeviceDetectorService,
        sectionService: SectionService,
        utilsService: UtilsService,
        formBuilder: FormBuilder,
    ) {
        this.changeDetector = changeDetector
        this.sectionService = sectionService
        this.utilsService = utilsService
        this.formBuilder = formBuilder
        this.formEmitter = new EventEmitter<FormGroup>();
    }

    ngOnInit() {
        /* A form for each HIT's element is initialized */
        this.assessmentForms = new Array<FormGroup>(this.task.documentsAmount);

        for (let index = 0; index < this.task.documentsAmount; index++) {
            let controlsConfig = {};
            for (let index_dimension = 0; index_dimension < this.task.dimensions.length; index_dimension++) {
                let dimension = this.task.dimensions[index_dimension];
                if (dimension.scale) {
                    if (dimension.scale.type == "categorical") controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.required]);
                    if (dimension.scale.type == "interval") controlsConfig[`${dimension.name}_value`] = new FormControl(((<ScaleInterval>dimension.scale).min), [Validators.required]);
                    if (dimension.scale.type == "magnitude_estimation") {
                        if ((<ScaleMagnitude>dimension.scale).lower_bound) {
                            controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min), Validators.required]);
                        } else {
                            controlsConfig[`${dimension.name}_value`] = new FormControl('', [Validators.min((<ScaleMagnitude>dimension.scale).min + 1), Validators.required]);
                        }
                    }
                }
                if (dimension.justification) controlsConfig[`${dimension.name}_justification`] = new FormControl('', [Validators.required, this.validateJustification.bind(this)])
            }
            let assessmentForm = this.formBuilder.group(controlsConfig)
            assessmentForm.valueChanges.subscribe(form => {
                this.formEmitter.emit(assessmentForm)
            })
            this.assessmentForms[index] = assessmentForm
        }

    }

    /*
     * This function performs a validation of the worker justification field each time the current worker types or pastes in its inside
     * if the worker types the selected url as part of the justification an <invalid> error is raised
     * if the worker types a justification which has lesser than 15 words a <longer> error is raised
     * IMPORTANT: the <return null> part means: THE FIELD IS VALID
     */
    public validateJustification(control: FormControl) {
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
        if (this.stepper) {
            /* If at least the first document has been reached */
            if (this.stepper.selectedIndex >= this.task.questionnaireAmountStart && this.stepper.selectedIndex < this.task.getElementsNumber()) {
                /* The current document document_index is selected */
                let currentDocument = this.stepper.selectedIndex - this.task.questionnaireAmountStart;
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
                const allControls = this.utilsService.getControlGroup(control).controls;
                let currentControl = Object.keys(allControls).find(name => control === allControls[name])
                let currentDimensionName = currentControl.split("_")[0]
                for (let dimension of this.task.dimensions) if (dimension.name == currentDimensionName) if (dimension.justification.min_words) minWords = dimension.justification.min_words
            }
            return cleanedWords.length > minWords ? null : {"longer": "This is not valid."};
        }
    }

    public storeSearchEngineUrl(urlFormGroup, dimensionIndex) {
        for (const [key, value] of Object.entries(urlFormGroup.controls)) {
            this.assessmentForms[dimensionIndex].addControl(key, urlFormGroup.get(key))
        }
    }

}
