/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, Validators} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../services/config.service";
import {S3Service} from "../../../../services/aws/s3.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
/* Models */
import {Instruction} from "../../../../models/skeleton/instructions";
import {InstructionEvaluation} from "../../../../models/skeleton/instructionsEvaluation";
import {SearchEngineSettings} from "../../../../models/search_engine/searchEngineSettings";

@Component({
    selector: 'app-instructions-evaluation-step',
    templateUrl: './instructions-evaluation-step.component.html',
    styleUrls: ['../../generator.component.scss']
})

export class InstructionsEvaluationStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    @Input() editorConfig

    dataStored: InstructionEvaluation

    formStep: FormGroup;

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;

    constructor(
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.initializeControls()
    }

    public initializeControls() {
        this.formStep = this._formBuilder.group({
            general: this._formBuilder.array([]),
            setElement: false,
            element: this._formBuilder.group({
                caption: '',
                label: '',
                text: '',
            }),
            setUrl: false,
            url: this._formBuilder.group({
                caption: '',
                label: '',
                text: '',
            }),
            setScale: false,
            scale: this._formBuilder.group({
                caption: '',
                label: '',
                text: '',
            })
        });
        this.formEmitter = new EventEmitter<FormGroup>();
    }

    public async ngOnInit() {

        let serializedInstructions = this.localStorageService.getItem("instructions-evaluation")
        if (serializedInstructions) {
            this.dataStored = new InstructionEvaluation(JSON.parse(serializedInstructions))
        } else {
            this.initializeControls()
            let rawInstructions = await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
            this.dataStored = new InstructionEvaluation(rawInstructions)
        }
        if (this.dataStored.general.length > 0) {
            this.dataStored.general.forEach((instruction, instructionIndex) => {
                this.addInstructionGeneral(instructionIndex, instruction)
            })
        }
        if (this.dataStored.element) {
            this.formStep.get('setElement').setValue(true)
            this.resetInstructionElement(this.dataStored.element)
        }
        if (this.dataStored.url) {
            this.formStep.get('setUrl').setValue(true)
            this.resetInstructionUrl(this.dataStored.url)
        }
        if (this.dataStored.scale) {
            this.formStep.get('setScale').setValue(true)
            this.resetInstructionScale(this.dataStored.scale)
        }
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }


    /* STEP #3 - General Instructions */

    instructionsGeneral(): FormArray {
        return this.formStep.get(`general`) as FormArray;
    }

    addInstructionGeneral(instructionIndex = null, instruction = null as Instruction) {
        let newInstruction = this._formBuilder.group({
            caption: instruction ? instruction.caption ? instruction.caption : '' : '',
            text:  [instruction ? instruction.text ? instruction.text : '' : '', [Validators.required]],
        })
        newInstruction.get('text').setValidators([Validators.required])
        this.instructionsGeneral().push(newInstruction);
    }

    removeInstructionGeneral(generalInstructionIndex: number) {
        this.instructionsGeneral().removeAt(generalInstructionIndex);
    }

    instructionsElement(): FormGroup {
        return this.formStep.get(`element`) as FormGroup;
    }

    resetInstructionElement(instruction = null) {
        if (this.formStep.get('setElement').value == false) {
            this.instructionsElement().get('label').setValue('')
            this.instructionsElement().get('caption').setValue('')
            this.instructionsElement().get('text').setValue('')
            this.formStep.clearValidators()
        } else {
            this.instructionsElement().get('label').setValue(instruction ? instruction.label : '')
            this.instructionsElement().get('caption').setValue(instruction ? instruction.caption : '')
            this.instructionsElement().get('text').setValue(instruction ? instruction.text : '')
            this.instructionsElement().get('text').addValidators([Validators.required])
            this.instructionsElement().get('text').updateValueAndValidity()
        }
    }

    instructionsUrl(): FormGroup {
        return this.formStep.get(`url`) as FormGroup;
    }

    resetInstructionUrl(instruction = null) {
        if (this.formStep.get('setUrl').value == false) {
            this.instructionsUrl().get('label').setValue('')
            this.instructionsUrl().get('caption').setValue('')
            this.instructionsUrl().get('text').setValue('')
            this.formStep.clearValidators()
        } else {
            this.instructionsUrl().get('label').setValue(instruction ? instruction.label : '')
            this.instructionsUrl().get('caption').setValue(instruction ? instruction.caption : '')
            this.instructionsUrl().get('text').setValue(instruction ? instruction.text : '')
            this.instructionsUrl().get('text').addValidators([Validators.required])
            this.instructionsUrl().get('text').updateValueAndValidity()
        }
    }

    instructionsScale(): FormGroup {
        return this.formStep.get(`scale`) as FormGroup;
    }

    resetInstructionScale(instruction = null) {
        if (this.formStep.get('setScale').value == false) {
            this.instructionsScale().get('label').setValue('')
            this.instructionsScale().get('caption').setValue('')
            this.instructionsScale().get('text').setValue('')
            this.formStep.clearValidators()
        } else {
            this.instructionsScale().get('label').setValue(instruction ? instruction.label : '')
            this.instructionsScale().get('caption').setValue(instruction ? instruction.caption : '')
            this.instructionsScale().get('text').setValue(instruction ? instruction.text : '')
            this.instructionsScale().get('text').addValidators([Validators.required])
            this.instructionsScale().get('text').updateValueAndValidity()
        }
    }


    /* JSON Output */

    serializeConfiguration() {
        let instructionsJSON = JSON.parse(JSON.stringify(this.formStep.value));
        instructionsJSON['general'].forEach((instruction, instructionIndex) => {
            if (instruction.caption == '') instruction.caption = false
            if (instruction.label == '') instruction.label = false
        })
        if (!instructionsJSON.setElement) {
            instructionsJSON['element'] = false
        } else {
            instructionsJSON['element']['caption'] = instructionsJSON['element']['caption'] == '' ? false : instructionsJSON['element']['caption']
            instructionsJSON['element']['label'] = instructionsJSON['element']['label'] == '' ? false : instructionsJSON['element']['label']
        }
        delete instructionsJSON.setElement
        if (!instructionsJSON.setUrl) {
            instructionsJSON['url'] = false
        } else {
            instructionsJSON['url']['caption'] = instructionsJSON['url']['caption'] == '' ? false : instructionsJSON['url']['caption']
            instructionsJSON['url']['label'] = instructionsJSON['url']['label'] == '' ? false : instructionsJSON['url']['label']
        }
        delete instructionsJSON.setUrl
        if (!instructionsJSON.setScale) {
            instructionsJSON['scale'] = false
        } else {
            instructionsJSON['scale']['caption'] = instructionsJSON['scale']['caption'] == '' ? false : instructionsJSON['scale']['caption']
            instructionsJSON['scale']['label'] = instructionsJSON['scale']['label'] == '' ? false : instructionsJSON['scale']['label']
        }
        delete instructionsJSON.setScale
        this.localStorageService.setItem(`instructions-evaluation`, JSON.stringify(instructionsJSON))
        this.configurationSerialized = JSON.stringify(instructionsJSON);
    }

}
