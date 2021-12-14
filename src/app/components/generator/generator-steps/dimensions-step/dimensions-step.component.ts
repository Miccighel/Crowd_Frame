import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {S3Service} from 'src/app/services/s3.service';
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Dimension, Mapping} from 'src/app/models/dimension';

interface ScaleType {
    value: string;
    viewValue: string;
}

interface StyleType {
    value: string;
    viewValue: string;
}

interface PositionType {
    value: string;
    viewValue: string;
}

interface OrientationType {
    value: string;
    viewValue: string;
}

interface AnnotatorType {
    value: string;
    viewValue: string;
}

@Component({
    selector: 'app-dimensions-step',
    templateUrl: './dimensions-step.component.html',
    styleUrls: ['../../generator.component.scss']
})

export class DimensionsStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    /* STEP #2 - Dimensions */

    dataStored: Array<Dimension>

    formStep: FormGroup;

    scaleTypes: ScaleType[] = [
        {value: 'categorical', viewValue: 'Categorical'},
        {value: 'interval', viewValue: 'Interval'},
        {value: 'magnitude_estimation', viewValue: 'Magnitude Estimation'}
    ];
    annotatorTypes: AnnotatorType[] = [
        {value: 'options', viewValue: 'Options'},
        {value: 'laws', viewValue: 'Laws'},
    ];
    styleTypes: StyleType[] = [
        {value: 'list', viewValue: 'List'},
        {value: 'matrix', viewValue: 'Matrix'}
    ];
    positionTypes: PositionType[] = [
        {value: 'top', viewValue: 'Top'},
        {value: 'middle', viewValue: 'Middle'},
        {value: 'bottom', viewValue: 'Bottom'}
    ];
    orientationTypes: OrientationType[] = [
        {value: 'horizontal', viewValue: 'Horizontal'},
        {value: 'vertical', viewValue: 'Vertical'}
    ];

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.initializeControls()
    }

    public initializeControls() {
        this.dataStored = []
        this.formStep = this._formBuilder.group({
            dimensions: this._formBuilder.array([])
        });
        this.formEmitter = new EventEmitter<FormGroup>();
    }

    public async ngOnInit() {
        let serializedDimensions = Object.keys(localStorage).filter((key) => key.startsWith('dimension-'))
        if (serializedDimensions.length > 0) {
            serializedDimensions.forEach(key => {
                let index = key.split("-")[1]
                let item = this.localStorageService.getItem(`dimension-${index}`)
                this.dataStored.push(JSON.parse(item))
            })
        } else {
            this.initializeControls()
            let rawDimensions = await this.S3Service.downloadDimensions(this.configService.environment)
            rawDimensions.forEach((data, index) => {
                let dimension = new Dimension(index, data)
                this.dataStored.push(dimension)
                this.localStorageService.setItem(`dimension-${index}`, JSON.stringify(dimension))
            })
        }
        this.formStep = this._formBuilder.group({
            dimensions: this._formBuilder.array([])
        });
        if (this.dataStored.length > 0) {
            this.dataStored.forEach((dimension, dimensionIndex) => {
                this.addDimension(dimensionIndex, dimension)
            })
        }
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    dimensions(): FormArray {
        return this.formStep.get('dimensions') as FormArray;
    }

    addDimension(dimensionIndex = null, dimension = null as Dimension) {
        let name, name_pretty, description, gold, setJustification, justification, url, setScale, scale, setStyle, style;
        name = dimension ? dimension.name ? dimension.name : '' : '';
        name_pretty = dimension ? dimension.name_pretty ? dimension.name_pretty : '' : '';
        description = dimension ? dimension.description ? dimension.description : '' : '';
        gold = dimension ? dimension.gold ? dimension.gold : false : false
        setJustification = dimension ? dimension.justification ? dimension.justification : false : false;
        justification = this._formBuilder.group({text: '', min_words: ''})
        if (dimension) {
            if (dimension.justification) {
                justification = this._formBuilder.group({
                    text: [dimension.justification.text],
                    min_words: [dimension.justification.min_words]
                })
            }
        }
        url = dimension ? dimension.url ? dimension.url : false : false
        setScale = dimension ? dimension.scale ? dimension.scale : false : false
        scale = this._formBuilder.group({
            type: '',
            min: '',
            max: '',
            step: '',
            mapping: this._formBuilder.array([]),
            lower_bound: '',
        })
        if (dimension) {
            if (dimension.scale) {
                scale = this._formBuilder.group({
                    type: [dimension.scale.type],
                    min: [dimension.scale['min'] ? dimension.scale['min'] : dimension.scale['min'] == 0 ? 0 : ''],
                    max: [dimension.scale['max'] ? dimension.scale['max'] : dimension.scale['max'] == 0 ? 0 : ''],
                    step: [dimension.scale['step'] ? dimension.scale['step'] : dimension.scale['step'] == 0 ? 0 : ''],
                    mapping: this._formBuilder.array([]),
                    lower_bound: [dimension.scale['lower_bound'] ? dimension.scale['lower_bound'] : '']
                })
            }
        }
        setStyle = dimension ? dimension.style ? dimension.style : false : false
        style = this._formBuilder.group({
            styleType: '',
            position: '',
            orientation: '',
            separator: ''
        })
        if (dimension) {
            if (dimension.style) {
                style = this._formBuilder.group({
                    styleType: [dimension.style.type],
                    position: [dimension.style.position],
                    orientation: [dimension.style.orientation],
                    separator: [dimension.style.separator]
                })
            }
        }
        this.dimensions().push(this._formBuilder.group({
            name: name,
            name_pretty: name_pretty,
            description: description,
            gold: gold,
            setJustification: setJustification,
            justification: justification,
            url: url,
            setScale: setScale,
            scale: scale,
            setStyle: setStyle,
            style: style
        }))
        if (dimension) {
            if (dimension.scale) if (dimension.scale.type == 'categorical') {
                if (dimension.scale['mapping']) for (let mapping of dimension.scale['mapping']) this.addDimensionMapping(dimensionIndex, mapping)
                if (this.dimensionMapping(dimensionIndex).length == 0) this.addDimensionMapping(dimensionIndex)
            }
            if (dimension.style)
                this.updateStyleType(dimensionIndex)
        }
    }

    removeDimension(dimensionIndex: number) {
        this.dimensions().removeAt(dimensionIndex);
    }

    resetJustification(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);

        dim.get('justification').get('text').setValue('');
        dim.get('justification').get('min_words').setValue('');

        if (dim.get('setJustification').value == false) {
            dim.get('justification').get('text').clearValidators();
            dim.get('justification').get('min_words').clearValidators();
        } else {
            dim.get('justification').get('text').setValidators(Validators.required);
            dim.get('justification').get('min_words').setValidators(Validators.required);
        }
        dim.get('justification').get('text').updateValueAndValidity();
        dim.get('justification').get('min_words').updateValueAndValidity();
    }

    resetScale(dimensionIndex) {
        this.updateScale(dimensionIndex);
        this.updateStyleType(dimensionIndex);
    }

    updateScale(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);

        if (dim.get('setScale').value == false) {
            dim.get('scale').get('type').clearValidators();
            dim.get("setStyle").setValue(false)
            dim.get("setStyle").disable()
        } else {
            dim.get('scale').get('type').setValidators(Validators.required);
        }

        dim.get('scale').get('min').setValue('');
        dim.get('scale').get('min').clearValidators();
        dim.get('scale').get('min').updateValueAndValidity();

        dim.get('scale').get('max').setValue('');
        dim.get('scale').get('max').clearValidators();
        dim.get('scale').get('max').updateValueAndValidity();

        dim.get('scale').get('step').setValue('');
        dim.get('scale').get('step').clearValidators();
        dim.get('scale').get('step').updateValueAndValidity();

        dim.get('scale').get('lower_bound').setValue(true);
        dim.get('scale').get('lower_bound').clearValidators();
        dim.get('scale').get('lower_bound').updateValueAndValidity();

        this.dimensionMapping(dimensionIndex).clear();

        if (dim.get('setScale').value == true && dim.get('scale').get('type').value == 'categorical') {
            this.addDimensionMapping(dimensionIndex);
        }

        if (dim.get('setScale').value == true) {
            switch (dim.get('scale').get('type').value) {
                case "categorical":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').enable()
                    dim.get('style').get('styleType').setValue('list')
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').enable()
                    dim.get('style').get('orientation').setValue('vertical')
                    this.updateStyleType(dimensionIndex)
                    break;
                case "interval":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').setValue("list")
                    dim.get('style').get('styleType').disable()
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    this.updateStyleType(dimensionIndex)
                    break;
                case "magnitude_estimation":
                    dim.get('setStyle').enable()
                    dim.get('style').get('styleType').setValue("list")
                    dim.get('style').get('styleType').disable()
                    dim.get('style').get('position').enable()
                    dim.get('style').get('position').setValue('middle')
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    this.updateStyleType(dimensionIndex)
                    break;
                default:
                    dim.get('setStyle').disable()
            }
        }
    }

    resetStyle(dimensionIndex) {
        this.updateStyleType(dimensionIndex);
    }

    updateStyleType(dimensionIndex) {
        let dim = this.dimensions().at(dimensionIndex);
        let styleType = dim.get('style').get('styleType').value;
        if (dim.get('setStyle').value == true) {
            dim.get('style').get('styleType').setValidators(Validators.required);
            dim.get('style').get('position').setValidators(Validators.required);
            dim.get('style').get('orientation').setValidators(Validators.required);
            dim.get('style').get('separator').setValidators(Validators.required);
            switch (styleType) {
                case "matrix":
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get('style').get('orientation').disable()
                    dim.get("style").get('separator').enable()
                    break;
                case "list":
                    if (dim.get('scale').get('type')) {
                        if (dim.get('scale').get('type').value == "categorical") {
                            dim.get('style').get('orientation').enable()
                        } else {
                            dim.get('style').get('orientation').disable()
                        }
                    }
                    dim.get("style").get('separator').disable()
                    dim.get("style").get('separator').setValue(false)
                    break;
                default:
                    dim.get('style').get('position').setValue('middle')
                    dim.get("style").get('orientation').disable()
                    dim.get('style').get('orientation').setValue('vertical')
                    dim.get("style").get('separator').disable()
                    dim.get("style").get('separator').setValue(false)
            }
            dim.get('style').get('styleType').updateValueAndValidity();
            dim.get('style').get('position').updateValueAndValidity();
            dim.get('style').get('orientation').updateValueAndValidity();
            dim.get('style').get('separator').updateValueAndValidity();
        }

    }

    /* SUB ELEMENT: Mapping */

    dimensionMapping(dimensionIndex: number): FormArray {
        return this.dimensions().at(dimensionIndex).get('scale').get('mapping') as FormArray;
    }

    addDimensionMapping(dimensionIndex: number, mapping = null as Mapping) {
        this.dimensionMapping(dimensionIndex).push(this._formBuilder.group({
            label: mapping ? mapping.label ? mapping.label : '' : '',
            description: mapping ? mapping.description ? mapping.description : '' : '',
            value: mapping ? mapping.value ? mapping.value : '' : ''
        }))
    }

    removeDimensionMapping(dimensionIndex: number, dimensionMappingIndex: number) {
        this.dimensionMapping(dimensionIndex).removeAt(dimensionMappingIndex);
    }

    /* JSON Output */

    serializeConfiguration() {

        let serializedDimensions = Object.keys(localStorage).filter((key) => key.startsWith('dimension-'))
        if (serializedDimensions.length > 0) serializedDimensions.forEach(key => this.localStorageService.removeItem(key))

        let dimensionsJSON = JSON.parse(JSON.stringify(this.formStep.get('dimensions').value));

        dimensionsJSON.forEach((dimension, dimensionIndex) => {

            if (dimension.description == '') dimension.description = false

            dimension.gold = !!dimension.gold;

            if (!dimension.setJustification) dimension.justification = false
            delete dimension.setJustification;

            dimension.url = !!dimension.url;

            if (dimension.setScale == false) {
                delete dimension.scale
                dimension.scale = false
                dimension.style = false
            } else {
                switch (dimension.scale.type) {
                    case 'categorical':
                        delete dimension.scale.min;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        delete dimension.scale.lower_bound;
                        break;
                    case 'interval':
                        delete dimension.scale.mapping;
                        delete dimension.scale.lower_bound;
                        break;
                    case 'magnitude_estimation':
                        delete dimension.scale.mapping;
                        delete dimension.scale.max;
                        delete dimension.scale.step;
                        delete dimension.scale.mapping;
                        break;
                    default:
                        break;
                }
            }
            delete dimension.setScale;

            if (dimension.style) {

                if (dimension.setStyle) {
                    dimension.style.type = dimension.style.styleType;
                    delete dimension.style.styleType;

                    if (!dimension.style.type) dimension.style.type = ''
                    if (!dimension.style.position) dimension.style.position = ''

                    if (dimension.scale.type == 'interval' || dimension.scale.type == 'magnitude_estimation') {
                        dimension.style.type = 'list'
                        dimension.style.orientation = 'vertical'
                    }
                    if (dimension.scale.type == 'categorical' && dimension.style.type == 'matrix') dimension.style.orientation = false

                    dimension.style.separator = !!dimension.style.separator;
                } else {
                    dimension.style = false
                }


            } else {
                dimension.style = false
            }
            delete dimension.setStyle;

            this.localStorageService.setItem(`dimension-${dimensionIndex}`, JSON.stringify(dimension))
        })
        this.configurationSerialized = JSON.stringify(dimensionsJSON)
    }

}
