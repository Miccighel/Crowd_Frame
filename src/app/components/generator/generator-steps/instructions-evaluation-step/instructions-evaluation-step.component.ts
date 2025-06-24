// TODO(strict-forms): auto-guarded by codemod – review if needed.
/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../services/config.service";
import {S3Service} from "../../../../services/aws/s3.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
/* Models */
import {BaseInstruction} from "../../../../models/skeleton/instructions/baseInstruction";
import {EvaluationInstruction} from "../../../../models/skeleton/instructions/evaluationInstruction";
import {SearchEngineSettings} from "../../../../models/searchEngine/searchEngineSettings";

@Component({
    selector: 'app-instructions-evaluation-step',
    templateUrl: './instructions-evaluation-step.component.html',
    styleUrls: ['../../generator.component.scss'],
    standalone: false
})

export class InstructionsEvaluationStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    @Input() editorConfig

    dataStored: EvaluationInstruction

    formStep: UntypedFormGroup;

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<UntypedFormGroup>;

    constructor(
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
        private _formBuilder: UntypedFormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.initializeControls()
    }

    public initializeControls() {
        this.dataStored = new EvaluationInstruction()
        this.formStep = this._formBuilder.group({
            instructions: this._formBuilder.array([]),
            setElement: false,
            element: this._formBuilder.group({
                caption: '',
                label: '',
                text: '',
            })
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {

        let serializedInstructions = this.localStorageService.getItem("instructions-evaluation")
        if (serializedInstructions) {
            this.dataStored = new EvaluationInstruction(JSON.parse(serializedInstructions))
            this.dataStored.instructions.sort((a, b) => (a.index > b.index) ? 1 : -1)
        } else {
            this.initializeControls()
            let rawInstructions = await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
            this.dataStored = new EvaluationInstruction(rawInstructions)
            this.localStorageService.setItem(`instructions-evaluation`, JSON.stringify(rawInstructions))
        }
        let elementConfig = this._formBuilder.group({
            caption: '',
            label: '',
            text: ''
        })
        if (this.dataStored.element) {
            elementConfig = this._formBuilder.group({
                caption: this.dataStored.element.caption,
                label: this.dataStored.element.label,
                text: this.dataStored.element.text
            })
        }
        this.formStep = this._formBuilder.group({
            setElement: this.dataStored.element ? !!this.dataStored.element : false,
            element: elementConfig,
            instructions: this._formBuilder.array([]),
        })
        if (this.dataStored.instructions.length > 0) {
            this.dataStored.instructions.forEach((instruction, instructionIndex) => {
                this.addInstruction(instructionIndex, instruction)
            })
        }
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    element(): UntypedFormGroup {
        return this.formStep?.get('element') as UntypedFormGroup;
    }

    resetElement() {
        this.formStep?.get('element')?.get('label')?.setValue('')
        this.formStep?.get('element')?.get('caption')?.setValue('')
        this.formStep?.get('element')?.get('text')?.setValue('')
        this.formStep?.get('element')?.get('text')?.updateValueAndValidity()
    }

    /* STEP #4 - Evaluation Instructions */
    instructions(): UntypedFormArray {
        return this.formStep?.get(`instructions`) as UntypedFormArray;
    }

    addInstruction(instructionIndex = null, instruction = null as BaseInstruction) {
        this.instructions().push(this._formBuilder.group({
            caption: instruction ? instruction.caption ? instruction.caption : '' : '',
            text: instruction ? instruction.text ? instruction.text : '' : '',
        }));
    }

    removeInstruction(generalInstructionIndex: number) {
        this.instructions().removeAt(generalInstructionIndex);
    }

    /* JSON Output */

    serializeConfiguration() {
        let instructionsEvaluationJSON = JSON.parse(JSON.stringify(this.formStep.value));
        if (!instructionsEvaluationJSON.setElement) instructionsEvaluationJSON.element = false
        delete instructionsEvaluationJSON.setElement
        instructionsEvaluationJSON.instructions.forEach((instruction, instructionIndex) => {
            if (instruction.caption == '') instruction.caption = false
        })
        if (instructionsEvaluationJSON.element.caption == '') instructionsEvaluationJSON.element.caption = false
        if (instructionsEvaluationJSON.element.label == '') instructionsEvaluationJSON.element.label = false
        if (instructionsEvaluationJSON.element.text == '') instructionsEvaluationJSON.element.text = false
        this.localStorageService.setItem(`instructions-evaluation`, JSON.stringify(instructionsEvaluationJSON))
        this.configurationSerialized = JSON.stringify(instructionsEvaluationJSON);
    }

}
