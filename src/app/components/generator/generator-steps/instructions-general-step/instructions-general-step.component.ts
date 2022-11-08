/* Core */
import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators} from "@angular/forms";
/* Services */
import {ConfigService} from "../../../../services/config.service";
import {S3Service} from "../../../../services/aws/s3.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
/* Models */
import {Instruction} from "../../../../models/skeleton/instructions";
import {Questionnaire} from "../../../../models/skeleton/questionnaires/questionnaire";

@Component({
    selector: 'app-instructions-step',
    templateUrl: './instructions-general-step.component.html',
    styleUrls: ['../../generator.component.scss']
})
export class InstructionsGeneralStep implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    @Input() editorConfig

    dataStored: Array<Instruction>

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
        this.dataStored = []
        this.formStep = this._formBuilder.group({
            instructions: this._formBuilder.array([])
        });
        this.formEmitter = new EventEmitter<UntypedFormGroup>();
    }

    public async ngOnInit() {

        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith(`instruction-general-`))
        if (serializedInstructions.length > 0) {
            serializedInstructions.forEach(key => {
                let index = key.split("-")[2]
                let item = this.localStorageService.getItem(`instruction-general-${index}`)
                this.dataStored.push(new Instruction(parseInt(index), JSON.parse(item)))
            })
            this.dataStored.sort((a, b) => (a.index > b.index) ? 1 : -1)
        } else {
            this.initializeControls()
            let rawInstructions = null
            rawInstructions = await this.S3Service.downloadGeneralInstructions(this.configService.environment)
            rawInstructions.forEach((data, index) => {
                let instruction = new Instruction(index, data)
                this.dataStored.push(instruction)
                this.localStorageService.setItem(`instruction-general-${index}`, JSON.stringify(instruction))
            })
        }
        if (this.dataStored.length > 0) {
            this.dataStored.forEach((instruction, instructionIndex) => {
                this.addInstruction(instructionIndex, instruction)
            })
        }
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }


    /* STEP #3 - General Instructions */
    instructions(): UntypedFormArray {
        return this.formStep.get(`instructions`) as UntypedFormArray;
    }

    addInstruction(instructionIndex = null, instruction = null as Instruction) {
        this.instructions().push(this._formBuilder.group({
            caption: instruction ? instruction.caption ? instruction.caption : '' : '',
            text: [instruction ? instruction.text ? instruction.text : '' : '', [Validators.required]],
        }));
    }

    removeInstruction(generalInstructionIndex: number) {
        this.instructions().removeAt(generalInstructionIndex);
    }

    /* JSON Output */

    serializeConfiguration() {
        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith(`instruction-general-`))
        if (serializedInstructions.length > 0) serializedInstructions.forEach(key => this.localStorageService.removeItem(key))
        let instructionsJSON = JSON.parse(JSON.stringify(this.formStep.get(`instructions`).value));
        instructionsJSON.forEach((instruction, instructionIndex) => {
            if (instruction.caption == '') instruction.caption = false
            this.localStorageService.setItem(`instruction-general-${instructionIndex}`, JSON.stringify(instruction))
        })
        this.configurationSerialized = JSON.stringify(instructionsJSON);
    }

}
