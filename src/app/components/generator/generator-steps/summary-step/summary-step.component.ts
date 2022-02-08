import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {S3Service} from 'src/app/services/s3.service';
import {ConfigService} from "../../../../services/config.service";
import {LocalStorageService} from "../../../../services/localStorage.service";
import {QuestionnaireStepComponent} from "../questionnaire-step/questionnaire-step.component";
import {DimensionsStepComponent} from "../dimensions-step/dimensions-step.component";
import {InstructionsStepComponent} from "../instructions-step/instructions-step.component";
import {SearchEngineStepComponent} from "../search-engine-step/search-engine-step.component";
import {TaskSettingsStepComponent} from "../task-settings-step/task-settings-step.component";
import {WorkerChecksStepComponent} from "../worker-checks-step/worker-checks-step.component";

@Component({
    selector: 'app-summary-step',
    templateUrl: './summary-step.component.html',
    styleUrls: ['../../generator.component.scss']
})
export class SummaryStepComponent implements OnInit {

    /* Service to provide an environment-based configuration */
    configService: ConfigService;
    /* Service which wraps the interaction with S3 */
    S3Service: S3Service;
    /* Service which wraps the interaction with browser's local storage */
    localStorageService: LocalStorageService;

    @Input() questionnaireStep: QuestionnaireStepComponent
    @Input() dimensionsStep: DimensionsStepComponent
    @Input() generalInstructionsStep: InstructionsStepComponent
    @Input() evaluationInstructionsStep: InstructionsStepComponent
    @Input() searchEngineStep: SearchEngineStepComponent
    @Input() taskSettingsStep: TaskSettingsStepComponent
    @Input() workerChecksStep: WorkerChecksStepComponent

    uploadStarted: boolean
    uploadCompleted: boolean
    /* S3 Bucket base upload path */
    fullS3Path: string
    /* questionnaires.json upload path */
    questionnairesPath: string
    /* hits.json upload path */
    hitsPath: string
    /* dimensions.json upload path */
    dimensionsPath: string
    /* instructions_main.json upload path */
    taskInstructionsPath: string
    /* instructions_dimension.json upload path */
    dimensionsInstructionsPath: string
    /* search_engine.json upload path */
    searchEngineSettingsPath: string
    /* task.json upload path */
    taskSettingsPath: string
    /* workers.json upload path */
    workerChecksPath: string

    @Output() resetEmitter: EventEmitter<boolean>;

    constructor(
        configService: ConfigService,
        S3Service: S3Service,
        localStorageService: LocalStorageService,
    ) {
        /* Service initialization */
        this.configService = configService
        this.S3Service = S3Service
        this.localStorageService = localStorageService

        this.fullS3Path = `${this.configService.environment.region}/${this.configService.environment.bucket}/${this.configService.environment.taskName}/${this.configService.environment.batchName}/`
        this.uploadStarted = false
        this.uploadCompleted = false
        this.questionnairesPath = null
        this.dimensionsPath = null
        this.taskInstructionsPath = null
        this.dimensionsInstructionsPath = null
        this.searchEngineSettingsPath = null
        this.workerChecksPath = null

        this.resetEmitter = new EventEmitter<boolean>();
    }

    ngOnInit(): void {
    }

    public updateFullPath() {
        this.fullS3Path = this.S3Service.getTaskDataS3Path(this.configService.environment, this.configService.environment.taskName, this.configService.environment.batchName)
    }

    public async uploadConfiguration() {
        this.uploadStarted = true
        this.uploadCompleted = false
        this.configService.environment['taskName'] = this.configService.environment['taskNameInitial']
        this.configService.environment['batchName'] = this.configService.environment['batchNameInitial']
        let questionnairePromise = this.S3Service.uploadQuestionnairesConfig(this.configService.environment, this.questionnaireStep.configurationSerialized)
        let hitsPromise = this.S3Service.uploadHitsConfig(this.configService.environment, this.taskSettingsStep.hitsParsed)
        let dimensionsPromise = this.S3Service.uploadDimensionsConfig(this.configService.environment, this.dimensionsStep.configurationSerialized)
        let taskInstructionsPromise = this.S3Service.uploadTaskInstructionsConfig(this.configService.environment, this.generalInstructionsStep.configurationSerialized)
        let dimensionsInstructionsPromise = this.S3Service.uploadDimensionsInstructionsConfig(this.configService.environment, this.evaluationInstructionsStep.configurationSerialized)
        let searchEngineSettingsPromise = this.S3Service.uploadSearchEngineSettings(this.configService.environment, this.searchEngineStep.configurationSerialized)
        let taskSettingsPromise = this.S3Service.uploadTaskSettings(this.configService.environment, this.taskSettingsStep.configurationSerialized)
        let workerChecksPromise = this.S3Service.uploadWorkersCheck(this.configService.environment, this.workerChecksStep.configurationSerialized)
        questionnairePromise.then(result => {
            if (!result["failed"]) {
                this.questionnairesPath = this.S3Service.getQuestionnairesConfigPath(this.configService.environment)
            } else this.questionnairesPath = "Failure"
        })
        hitsPromise.then(result => {
            if (!result["failed"]) {
                this.hitsPath = this.S3Service.getHitsConfigPath(this.configService.environment)
            } else this.hitsPath = "Failure"
        })
        dimensionsPromise.then(result => {
            if (!result["failed"]) {
                this.dimensionsPath = this.S3Service.getDimensionsConfigPath(this.configService.environment)
            } else this.dimensionsPath = "Failure"
        })
        taskInstructionsPromise.then(result => {
            if (!result["failed"]) {
                this.taskInstructionsPath = this.S3Service.getTaskInstructionsConfigPath(this.configService.environment)
            } else this.taskInstructionsPath = "Failure"
        })
        dimensionsInstructionsPromise.then(result => {
            if (!result["failed"]) {
                this.dimensionsInstructionsPath = this.S3Service.getDimensionsInstructionsConfigPath(this.configService.environment)
            } else this.dimensionsInstructionsPath = "Failure"
        })
        searchEngineSettingsPromise.then(result => {
            if (!result["failed"]) {
                this.searchEngineSettingsPath = this.S3Service.getSearchEngineSettingsConfigPath(this.configService.environment)
            } else this.searchEngineSettingsPath = "Failure"
        })
        taskSettingsPromise.then(result => {
            if (!result["failed"]) {
                this.taskSettingsPath = this.S3Service.getTaskSettingsConfigPath(this.configService.environment)
            } else this.taskSettingsPath = "Failure"
        })
        workerChecksPromise.then(result => {
            if (!result["failed"]) {
                this.workerChecksPath = this.S3Service.getWorkerChecksConfigPath(this.configService.environment)
            } else this.workerChecksPath = "Failure"
        })
        this.uploadCompleted = true
    }

    public resetConfiguration() {
        this.resetEmitter.emit(true)
    }

}
