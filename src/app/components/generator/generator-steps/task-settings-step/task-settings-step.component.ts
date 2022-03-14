/* Core */
import {Component, EventEmitter, OnInit, Output} from '@angular/core'
import {FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms"
import {ReadFile, ReadMode} from "ngx-file-helpers"
/* Services */
import {S3Service} from 'src/app/services/aws/s3.service'
import {ConfigService} from "../../../../services/config.service"
import {LocalStorageService} from "../../../../services/localStorage.service"
import {UtilsService} from "../../../../services/utils.service"
/* Models */
import {Attribute, TaskSettings} from "../../../../models/skeleton/taskSettings"
import {Hit} from "../../../../models/skeleton/hit"

interface AnnotatorType {
    value: string;
    viewValue: string;
}

interface ModalityType {
    value: string;
    viewValue: string;
}

interface BatchNode {
    name: string;
    batches?: BatchNode[];
}

@Component({
    selector: 'app-task-settings-step',
    templateUrl: './task-settings-step.component.html',
    styleUrls: ['../../generator.component.scss']
})

export class TaskSettingsStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;
    utilsService: UtilsService;

    /* STEP #6 - Task Settings */

    dataStored: TaskSettings
    formStep: FormGroup;

    annotatorTypes: AnnotatorType[] = [
        {value: 'options', viewValue: 'Options'},
        {value: 'laws', viewValue: 'Laws'},
    ];
    modalityTypes: ModalityType[] = [
        {value: 'pointwise', viewValue: 'Pointwise'},
        {value: 'pairwise', viewValue: 'Pairwise'},
    ];
    countdownBehavior: ModalityType[] = [
        {value: 'disable_form', viewValue: 'Disable Forms'},
        {value: 'hide_attributes', viewValue: 'Hide Attributes'},
    ];
    additionalTimeModalities: ModalityType[] = [
        {value: 'attribute', viewValue: 'Attribute'},
        {value: 'position', viewValue: 'Position'},
    ];

    batchesTree: Array<JSON>
    batchesTreeInitialization: boolean
    batchesTreeSerialized: Array<JSON>
    annotatorOptionColors: Array<string>
    /* Variables to handle hits file upload */
    hitsFile: ReadFile
    hitsFileName: string
    hitsParsed: Array<Hit>
    hitsParsedString: string
    hitsAttributes: Array<string>
    hitsAttributesValues: Object
    hitsPositions: number
    hitsSize: number
    hitsDetected: number
    readMode: ReadMode

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;
    @Output() modalityEmitter: EventEmitter<string>;

    constructor(
        localStorageService: LocalStorageService,
        configService: ConfigService,
        S3Service: S3Service,
        utilsService: UtilsService,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.utilsService = utilsService
        this.initializeControls()
    }

    public initializeControls() {
        this.dataStored = new TaskSettings()
        this.formStep = this._formBuilder.group({
            modality: '',
            allowed_tries: '',
            time_check_amount: '',
            attributes: this._formBuilder.array([]),
            setAnnotator: false,
            annotator: this._formBuilder.group({
                type: '',
                values: this._formBuilder.array([]),
            }),
            setCountdownTime: '',
            countdown_time: '',
            countdown_behavior: '',
            setAdditionalTimes: '',
            countdown_modality: '',
            countdown_attribute: '',
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: false,
            logger_option: false,
            serverEndpoint: ''
        });
        /* Read mode during hits file upload*/
        this.readMode = ReadMode.text
        this.formEmitter = new EventEmitter<FormGroup>();
        this.modalityEmitter = new EventEmitter<string>();
    }

    public async ngOnInit() {
        let serializedTaskSettings = this.localStorageService.getItem("task-settings")
        if (serializedTaskSettings) {
            this.dataStored = new TaskSettings(JSON.parse(serializedTaskSettings))
        } else {
            this.initializeControls()
            let rawTaskSettings = await this.S3Service.downloadTaskSettings(this.configService.environment)
            this.dataStored = new TaskSettings(rawTaskSettings)
            this.localStorageService.setItem(`task-settings`, JSON.stringify(rawTaskSettings))
        }
        this.annotatorOptionColors = ['#FFFF7B']
        if (this.dataStored.annotator) {
            if (this.dataStored.annotator.type == "options") {
                if (this.dataStored.annotator.values.length > 0) {
                    this.annotatorOptionColors = []
                    this.dataStored.annotator.values.forEach((optionValue, optionValueIndex) => {
                        this.annotatorOptionColors.push(optionValue['color'])
                    })
                }
            }
        }
        this.formStep = this._formBuilder.group({
            modality: this.dataStored ? this.dataStored.modality ? this.dataStored.modality : '' : '',
            allowed_tries: this.dataStored ? this.dataStored.allowed_tries ? this.dataStored.allowed_tries : '' : '',
            time_check_amount: this.dataStored ? this.dataStored.time_check_amount ? this.dataStored.time_check_amount : '' : '',
            attributes: this._formBuilder.array([]),
            setAnnotator: !!this.dataStored.annotator,
            annotator: this._formBuilder.group({
                type: this.dataStored.annotator ? this.dataStored.annotator.type ? this.dataStored.annotator.type : '' : '',
                values: this._formBuilder.array([]),
            }),
            setCountdownTime: this.dataStored.countdown_time >= 0 ? true : '',
            countdown_time: this.dataStored.countdown_time >= 0 ? this.dataStored.countdown_time : '',
            countdown_behavior: this.dataStored.countdown_behavior ? this.dataStored.countdown_behavior : '',
            setAdditionalTimes: this.dataStored.countdown_modality ? true : '',
            countdown_modality: this.dataStored.countdown_modality ? this.dataStored.countdown_modality ? this.dataStored.countdown_modality : '' : '',
            countdown_attribute: this.dataStored.countdown_attribute ? this.dataStored.countdown_attribute ? this.dataStored.countdown_attribute : '' : '',
            countdown_attribute_values: this._formBuilder.array([]),
            countdown_position_values: this._formBuilder.array([]),
            messages: this._formBuilder.array([]),
            logger: !!this.dataStored.logger_enable,
            logger_option: this.dataStored.logger_options,
            server_endpoint: this.dataStored.logger_server_endpoint
        });
        if(this.dataStored.modality) this.emitModality(this.dataStored.modality)
        if (this.dataStored.messages) if (this.dataStored.messages.length > 0) this.dataStored.messages.forEach((message, messageIndex) => this.addMessage(message))
        if (this.dataStored.annotator) if (this.dataStored.annotator.type == "options") this.dataStored.annotator.values.forEach((optionValue, optionValueIndex) => this.addOptionValue(optionValue))
        if (this.dataStored.countdown_time >= 0) {
            if (this.dataStored.countdown_modality == 'attribute') {
                if (this.dataStored.countdown_attribute_values) {
                    for (let countdownAttribute of this.dataStored.countdown_attribute_values) {
                        this.updateCountdownAttribute(countdownAttribute)
                    }
                }
            }
        }
        if (this.dataStored.countdown_time >= 0) {
            if (this.dataStored.countdown_modality == 'position') {
                if (this.dataStored.countdown_position_values) {
                    for (let countdownPosition of this.dataStored.countdown_position_values) {
                        this.updateCountdownPosition(countdownPosition)
                    }
                }
            }
        }
        let hitsPromise = this.loadHits()
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    async loadHits() {
        let hits = JSON.parse(this.localStorageService.getItem('hits'))
        if (hits) {
            this.updateHitsFile(hits)
            this.localStorageService.setItem(`hits`, JSON.stringify(hits))
        } else {
            let hits = []
            try {
                hits = await this.S3Service.downloadHits(this.configService.environment)
            } catch (exception) {
            }
            this.localStorageService.setItem(`hits`, JSON.stringify(hits))
            this.updateHitsFile(hits)
        }
    }

    emitModality(data) {
        this.modalityEmitter.emit(data['value'])
    }

    updateLoggerOption(el: string, action: string) {
        let truthValue = this.formStep.get('logger_option').value[el][action] != true;
        if (action == 'general') {
            for (let key in this.formStep.get('logger_option').value[el]) {
                let value = this.formStep.get('logger_option').value
                value[el][key] = truthValue
                this.formStep.get('logger_option').setValue(value)
            }
        } else {
            let value = this.formStep.get('logger_option').value
            value[el][action] = truthValue
            this.formStep.get('logger_option').setValue(value)
        }
    }

    updateServerEndpoint() {
        return this.formStep.get('server_endpoint').value
    }

    updateHitsFile(hits = null) {
        this.hitsParsed = hits ? hits : JSON.parse(this.hitsFile.content) as Array<Hit>;
        this.hitsParsedString = JSON.stringify(this.hitsParsed)
        if (!hits) {
            this.localStorageService.setItem(`hits`, JSON.stringify(this.hitsParsed))
        }
        if (this.hitsParsed.length > 0) {
            this.hitsDetected = ("documents" in this.hitsParsed[0]) && ("token_input" in this.hitsParsed[0]) && ("token_output" in this.hitsParsed[0]) && ("unit_id" in this.hitsParsed[0]) ? this.hitsParsed.length : 0;
        } else {
            this.hitsDetected = 0
        }
        this.hitsAttributes = []
        this.hitsAttributesValues = {}

        if (this.hitsDetected > 0) {
            let hits = JSON.parse(JSON.stringify(this.hitsParsed))
            let document = hits[0]['documents'][0]
            this.hitsPositions = hits[0]['documents'].length
            if (this.hitsPositions > 0) {
                if ('statements' in document) {
                    for (let attribute in document['statements'][0]) {
                        if (!(attribute in this.hitsAttributes)) {
                            this.hitsAttributes.push(attribute)
                            this.hitsAttributesValues[attribute] = []
                        }
                    }
                } else {
                    for (let attribute in document) {
                        if (!(attribute in this.hitsAttributes)) {
                            this.hitsAttributes.push(attribute)
                            this.hitsAttributesValues[attribute] = []
                        }
                    }
                }
            }

            for (let hit of hits) {
                for (let document of hit['documents']) {
                    if ('statements' in document) {
                        Object.entries(document['statements'][0]).forEach(
                            ([attribute, value]) => {
                                if (!this.hitsAttributesValues[attribute].includes(value)) this.hitsAttributesValues[attribute].push(value)
                            }
                        )
                    } else {
                        Object.entries(document).forEach(
                            ([attribute, value]) => {
                                if (!this.hitsAttributesValues[attribute].includes(value)) this.hitsAttributesValues[attribute].push(value)
                            }
                        );
                    }
                }
            }
        }
        this.hitAttributes().clear({emitEvent: true})
        for (let attributeIndex in this.hitsAttributes) {
            if (attributeIndex in this.dataStored.attributes) {
                this.addHitAttribute(this.hitsAttributes[attributeIndex], this.dataStored.attributes[attributeIndex])
            } else {
                this.addHitAttribute(this.hitsAttributes[attributeIndex])
            }
        }
        if (this.hitsFile) {
            this.hitsSize = Math.round(this.hitsFile.size / 1024)
            this.hitsFileName = this.hitsFile.name
        } else {
            this.hitsSize = (new TextEncoder().encode(this.hitsParsed.toString())).length
            this.hitsFileName = "hits.json"
        }
    }

    hitAttributes() {
        return this.formStep.get('attributes') as FormArray;
    }

    addHitAttribute(name: string, attribute = null as Attribute) {
        this.hitAttributes().push(this._formBuilder.group({
            name: attribute ? attribute.name : name,
            name_pretty: attribute ? attribute.name_pretty ? attribute.name_pretty : '' : '',
            show: attribute ? attribute.show : true,
            annotate: attribute ? this.formStep.get('setAnnotator').value ? attribute.annotate : false : false,
            required: attribute ? this.formStep.get('setAnnotator').value ? attribute.required : false : false,
        }))
        this.resetHitAttributes()
    }

    resetHitAttributes() {
        for (let attribute of this.hitAttributes().controls) {
            if (this.formStep.get('setAnnotator').value == false) {
                attribute.get("annotate").disable()
                attribute.get("annotate").setValue(false)
                attribute.get("required").disable()
                attribute.get("required").setValue(false)
            } else {
                attribute.get("annotate").enable()
                attribute.get("required").enable()
            }
        }
    }

    updateHitAttribute(attributeIndex) {
        let attribute = this.hitAttributes().at(attributeIndex)
        if (attribute.get("show").value == true) {
            attribute.get("annotate").enable()
            attribute.get("required").enable()
        } else {
            attribute.get("annotate").disable()
            attribute.get("required").disable()
            attribute.get("annotate").setValue(false)
            attribute.get("required").setValue(false)
        }
        if (attribute.get("annotate").value == true) {
            attribute.get("required").enable()
        } else {
            attribute.get("required").disable()
            attribute.get("required").setValue(false)
        }
        this.resetHitAttributes()
    }

    resetCountdown() {
        if (this.formStep.get('setCountdownTime').value == false) {
            this.formStep.get('countdown_time').setValue(false)
            this.formStep.get('countdown_time').clearValidators();
            this.formStep.get('countdown_time').updateValueAndValidity();
        } else {
            this.formStep.get('countdown_time').setValidators([Validators.required, this.utilsService.positiveOrZeroNumber.bind(this)]);
            this.formStep.get('countdown_time').updateValueAndValidity();
        }
        this.resetAdditionalTimes()
    }

    resetAdditionalTimes() {
        if (this.formStep.get('setAdditionalTimes').value == false) {
            this.formStep.get('countdown_modality').setValue(false)
            this.formStep.get('countdown_modality').clearValidators();
            this.formStep.get('countdown_modality').updateValueAndValidity();
            this.formStep.get('countdown_attribute').setValue(false)
            this.formStep.get('countdown_attribute').clearValidators()
            this.formStep.get('countdown_attribute').updateValueAndValidity()
            this.countdownAttributeValues().clear()
            this.countdownAttributeValues().updateValueAndValidity()
            this.countdownPositionValues().clear()
            this.countdownPositionValues().updateValueAndValidity()
        } else {
            this.formStep.get('countdown_modality').setValidators([Validators.required]);
            if (this.formStep.get('countdown_modality').value == 'attribute')
                this.formStep.get('countdown_attribute').setValidators([Validators.required]);
        }
    }

    countdownAttributeValues() {
        return this.formStep.get('countdown_attribute_values') as FormArray;
    }

    updateCountdownModality() {
        if (this.formStep.get('countdown_modality').value == "attribute") {
            this.countdownPositionValues().clear()
        } else {
            this.formStep.get('countdown_attribute').setValue(false)
            this.formStep.get('countdown_attribute').clearValidators()
            this.countdownAttributeValues().clear()
            this.countdownAttributeValues().updateValueAndValidity()
            this.updateCountdownPosition()
        }
    }

    updateCountdownAttribute(countdownAttribute = null) {
        if (countdownAttribute) {
            let control = this._formBuilder.group({
                name: countdownAttribute['name'],
                time: countdownAttribute['time']
            })
            this.countdownAttributeValues().push(control)
        } else {
            this.countdownAttributeValues().clear()
            let chosenAttribute = this.formStep.get('countdown_attribute').value
            let values = this.hitsAttributesValues[chosenAttribute]
            for (let value of values) {
                let control = this._formBuilder.group({
                    name: value,
                    time: '',
                })
                this.countdownAttributeValues().push(control)
            }
        }

    }

    countdownPositionValues() {
        return this.formStep.get('countdown_position_values') as FormArray;
    }

    updateCountdownPosition(countdownPosition = null) {
        if (countdownPosition) {
            let control = this._formBuilder.group({
                position: countdownPosition['name'],
                time: countdownPosition['time']
            })
            this.countdownPositionValues().push(control)
        } else {
            this.countdownPositionValues().clear()
            for (let index = 0; index < this.hitsPositions; index++) {
                let control = this._formBuilder.group({
                    position: index,
                    time: '',
                })
                this.countdownPositionValues().push(control)
            }
        }

    }

    annotator() {
        return this.formStep.get('annotator') as FormGroup
    }

    setAnnotatorType() {
        if (this.annotator().get('type').value == 'options' && this.annotatorOptionValues().length == 0) {
            this.annotatorOptionValues().push(this._formBuilder.group({
                label: '',
                color: ''
            }))
        }
    }

    resetAnnotator() {
        for (let attributeControl of this.hitAttributes().controls) {
            attributeControl.get('annotate').setValue(false)
        }
        if (this.formStep.get('setAnnotator').value == false) {
            this.annotator().get('type').clearValidators();
            this.annotator().get('type').clearAsyncValidators();
            this.annotatorOptionValues().clear()
        } else {
            this.annotator().get('type').setValidators([Validators.required, this.utilsService.positiveNumber.bind(this)]);
        }
        this.annotator().get('type').updateValueAndValidity()
        this.annotatorOptionValues().updateValueAndValidity()
        this.setAnnotatorType()
        this.resetHitAttributes()
    }

    /* SUB ELEMENT: Annotator */
    annotatorOptionValues(): FormArray {
        return this.formStep.get('annotator').get('values') as FormArray;
    }

    addOptionValue(option = null as Object) {
        this.annotatorOptionValues().push(this._formBuilder.group({
            label: option ? option['label'] ? option['label'] : '' : '',
            color: option ? option['color'] ? option['color'] : '' : ''
        }))
        if (!option) {
            this.annotatorOptionColors.push("")
        }
    }

    updateOptionColor(color, optionIndex) {
        this.annotatorOptionColors[optionIndex] = color
    }

    removeAnnotatorOptionValue(valueIndex) {
        this.annotatorOptionValues().removeAt(valueIndex);
    }

    messages(): FormArray {
        return this.formStep.get('messages') as FormArray;
    }

    addMessage(message = null) {
        this.messages().push(this._formBuilder.group({
            message: message ? message : ''
        }))
    }

    removeMessage(messageIndex: number) {
        this.messages().removeAt(messageIndex);
    }

    /* JSON Output */

    serializeConfiguration() {

        let taskSettingsJSON = JSON.parse(JSON.stringify(this.formStep.value));

        if (!taskSettingsJSON.setAnnotator) taskSettingsJSON.annotator = false
        delete taskSettingsJSON.setAnnotator

        if (taskSettingsJSON.annotator.type == "options") {
            taskSettingsJSON.annotator.values.forEach((option, index) => {
                option["color"] = this.annotatorOptionColors[index]
            });
        }

        if (!taskSettingsJSON.setCountdownTime) {
            taskSettingsJSON.countdown_time = false
            taskSettingsJSON.additional_times = false
            taskSettingsJSON.countdown_modality = false
            taskSettingsJSON.countdown_attribute = false
            taskSettingsJSON.countdown_attribute_values = []
            taskSettingsJSON.countdown_position_values = []
        }
        if (!taskSettingsJSON.setAdditionalTimes) {
            taskSettingsJSON.additional_times = false
            taskSettingsJSON.countdown_modality = false
            taskSettingsJSON.countdown_attribute = false
            taskSettingsJSON.countdown_attribute_values = []
            taskSettingsJSON.countdown_position_values = []
        } else {
            taskSettingsJSON.additional_times = taskSettingsJSON.setAdditionalTimes
        }
        delete taskSettingsJSON.setCountdownTime
        delete taskSettingsJSON.setAdditionalTimes

        if ('attributes' in taskSettingsJSON) {
            for (let attributeIndex in taskSettingsJSON['attributes']) {
                let attribute = taskSettingsJSON['attributes'][attributeIndex]
                attribute['name'] = this.hitsAttributes[attributeIndex]
                if (!attribute['show']) {
                    attribute['annotate'] = false
                    attribute['required'] = false
                }
                if (!attribute['annotate']) {
                    attribute['required'] = false
                }
                if (!taskSettingsJSON.annotator) {
                    attribute['annotate'] = false
                    attribute['required'] = false
                }
                taskSettingsJSON['attributes'][attributeIndex] = attribute
            }
        }

        if (taskSettingsJSON.messages.length == 0) {
            delete taskSettingsJSON.messages;
        } else {
            let messages = [];
            for (let messageIndex in taskSettingsJSON.messages) messages.push(taskSettingsJSON.messages[messageIndex].message);
            taskSettingsJSON.messages = messages;
        }

        this.localStorageService.setItem(`task-settings`, JSON.stringify(taskSettingsJSON))
        this.configurationSerialized = JSON.stringify(taskSettingsJSON)
    }

}
