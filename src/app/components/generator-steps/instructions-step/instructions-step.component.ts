import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ConfigService} from "../../../services/config.service";
import {LocalStorageService} from "../../../services/localStorage.service";
import {S3Service} from "../../../services/s3.service";
import {FormArray, FormBuilder, FormGroup} from "@angular/forms";
import {Instruction} from "../../../models/instructions";

@Component({
    selector: 'app-instructions-step',
    templateUrl: './instructions-step.component.html',
    styleUrls: ['./instructions-step.component.scss']
})
export class InstructionsStepComponent implements OnInit {

    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    @Input() type: string
    @Input() editorConfig

    dataStored: Array<Instruction>

    formStep: FormGroup;

    configurationSerialized: string

    @Output() formEmitter: EventEmitter<FormGroup>;
    @Output() resultEmitter: EventEmitter<string>;

    constructor(
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
        private _formBuilder: FormBuilder,
    ) {
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService
        this.dataStored = []
        this.formStep = this._formBuilder.group({
            instructions: this._formBuilder.array([])
        });
        this.formEmitter = new EventEmitter<FormGroup>();
        this.resultEmitter = new EventEmitter<string>();
    }

    public async ngOnInit() {

        console.log(this.type)

        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith(`${this.type}-instruction-`))
        if (serializedInstructions.length > 0) {
            serializedInstructions.forEach(key => {
                let index = key.split("-")[2]
                let item = this.localStorageService.getItem(`${this.type}-instruction-${index}`)
                this.dataStored.push(JSON.parse(item))
            })
        } else {
            let rawInstructions = null
            if(this.type=='general') {
                rawInstructions = await this.S3Service.downloadGeneralInstructions(this.configService.environment)
            } else {
                rawInstructions = await this.S3Service.downloadEvaluationInstructions(this.configService.environment)
            }
            rawInstructions.forEach((data, index) => {
                let instruction = new Instruction(index, data)
                this.dataStored.push(instruction)
                this.localStorageService.setItem(`${this.type}-instruction-${index}`, JSON.stringify(instruction))
            })
        }
        if (this.dataStored.length > 0) {
            this.dataStored.forEach((instruction, instructionIndex) => {
                this.addInstruction(instructionIndex, instruction)
            })
        }
    }

    public ngAfterViewInit() {
        this.formStep.valueChanges.subscribe(form => {
            this.serializeConfiguration()
        })
        this.serializeConfiguration()
        this.formEmitter.emit(this.formStep)
    }

    /* STEP #3 - General Instructions */
    instructions(): FormArray {
        return this.formStep.get(`instructions`) as FormArray;
    }

    addInstruction(instructionIndex = null, instruction = null as Instruction) {
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
        let serializedInstructions = Object.keys(localStorage).filter((key) => key.startsWith(`${this.type}-instruction-`))
        if (serializedInstructions.length > 0) serializedInstructions.forEach(key => this.localStorageService.removeItem(key))
        let instructionsJSON = JSON.parse(JSON.stringify(this.formStep.get(`instructions`).value));
        instructionsJSON.forEach((instruction, instructionIndex) => {
            if (instruction.caption == '') instruction.caption = false
            this.localStorageService.setItem(`${this.type}-instruction-${instructionIndex}`, JSON.stringify(instruction))
        })
        this.configurationSerialized = JSON.stringify(instructionsJSON);
        this.resultEmitter.emit(this.configurationSerialized)
    }

}
