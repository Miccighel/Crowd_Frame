import {Injectable} from '@angular/core';

/* ---------- AWS SDK v3 ---------- */
import {
    S3Client,
    GetObjectCommand,
    ListObjectsV2Command
} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';

/* ---------- Local debug JSON (default imports) ---------- */
import localRawDimensions from '../../../../data/build/task/dimensions.json';
import localRawHits from '../../../../data/build/task/hits.json';
import localRawInstructionsDimensions from '../../../../data/build/task/instructions_evaluation.json';
import localRawQuestionnaires from '../../../../data/build/task/questionnaires.json';
import localRawTaskSettings from '../../../../data/build/task/task.json';
import localRawSearchEngineSettings from '../../../../data/build/task/search_engine.json';
import localRawWorkers from '../../../../data/build/task/workers.json';
import localRawInstructionsMain from '../../../../data/build/task/instructions_general.json';
import localRawAdmin from '../../../../data/build/config/admin.json';
/* ---------- Domain models ---------- */
import {Worker} from "../../models/worker/worker";

@Injectable({providedIn: 'root'})
export class S3Service {

    /* Build a thin v3 client */
    private buildClient(cfg) {
        return new S3Client({
            region: cfg.region,
            credentials: {
                accessKeyId: cfg.aws_id_key,
                secretAccessKey: cfg.aws_secret_key
            }
        });
    }

    /* ---------- BASIC CRUD ---------- */

    /** Download & JSON-parse a file from S3 */
    async download(cfg, key: string) {
        const s3 = this.buildClient(cfg);
        const {Body} = await s3.send(
            new GetObjectCommand({Bucket: cfg.bucket, Key: key})
        );
        return JSON.parse(await new Response(Body as any).text());
    }

    /** Multipart-aware upload (uses @aws-sdk/lib-storage) */
    async upload(cfg, key: string, payload: unknown) {
        const s3 = this.buildClient(cfg);
        const uploader = new Upload({
            client: s3,
            params: {
                Bucket: cfg.bucket,
                Key: key,
                Body: typeof payload === 'string' ? payload : JSON.stringify(payload),
                ContentType: 'application/json'
            }
        });
        return uploader.done();
    }

    /** List “folders” (CommonPrefixes) under a given prefix */
    async listFolders(cfg, prefix: string = '') {
        const s3 = this.buildClient(cfg);
        const {CommonPrefixes} = await s3.send(
            new ListObjectsV2Command({
                Bucket: cfg.bucket,
                Prefix: prefix || undefined,
                Delimiter: '/'
            })
        );
        return CommonPrefixes ?? [];
    }

    /* ---------- PATH HELPERS ---------- */

    getTaskDataS3Path(cfg, name, batch) {
        return `${cfg.region}/${cfg.bucket}/${name}/${batch}`;
    }

    getFolder(cfg) {
        return cfg.batchName ? `${cfg.taskName}/${cfg.batchName}/`
            : `${cfg.taskName}/`;
    }

    getWorkerFolder(cfg, worker: Worker) {
        return `${this.getFolder(cfg)}Data/${worker.identifier}/`;
    }

    getWorkersFile(cfg) {
        return `${this.getFolder(cfg)}Task/workers.json`;
    }

    /* ---------- FILE DOWNLOADERS ---------- */

    downloadAdministrators(cfg) {
        const file = `${this.getFolder(cfg)}Generator/admin.json`;
        return cfg.configuration_local ? localRawAdmin : this.download(cfg, file);
    }

    downloadTaskSettings(cfg) {
        const file = `${this.getFolder(cfg)}Task/task.json`;
        return cfg.configuration_local ? localRawTaskSettings : this.download(cfg, file);
    }

    downloadSearchEngineSettings(cfg) {
        const file = `${this.getFolder(cfg)}Task/search_engine.json`;
        return cfg.configuration_local ? localRawSearchEngineSettings : this.download(cfg, file);
    }

    downloadHits(cfg) {
        const file = `${this.getFolder(cfg)}Task/hits.json`;
        return cfg.configuration_local ? localRawHits : this.download(cfg, file);
    }

    downloadGeneralInstructions(cfg) {
        const file = `${this.getFolder(cfg)}Task/instructions_general.json`;
        return cfg.configuration_local ? localRawInstructionsMain : this.download(cfg, file);
    }

    /* Keep the original strict method (throws on 404 when not local) */
    downloadEvaluationInstructions(cfg) {
        const file = `${this.getFolder(cfg)}Task/instructions_evaluation.json`;
        return cfg.configuration_local ? localRawInstructionsDimensions : this.download(cfg, file);
    }

    downloadDimensions(cfg) {
        const file = `${this.getFolder(cfg)}Task/dimensions.json`;
        return cfg.configuration_local ? localRawDimensions : this.download(cfg, file);
    }

    downloadQuestionnaires(cfg) {
        const file = `${this.getFolder(cfg)}Task/questionnaires.json`;
        return cfg.configuration_local ? localRawQuestionnaires : this.download(cfg, file);
    }

    downloadWorkers(cfg, batch = null): Promise<any> {
        const file = batch
            ? `${batch}Task/workers.json`
            : `${this.getFolder(cfg)}Task/workers.json`;

        return batch || !cfg.configuration_local
            ? this.download(cfg, file)
            : Promise.resolve(localRawWorkers);
    }

    /* ---------- STATIC PATH HELPERS ---------- */

    getQuestionnairesConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/questionnaires.json`;
    }

    getHitsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/hits.json`;
    }

    getDimensionsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/dimensions.json`;
    }

    getTaskInstructionsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/instructions_general.json`;
    }

    getDimensionsInstructionsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/instructions_evaluation.json`;
    }

    getSearchEngineSettingsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/search_engine.json`;
    }

    getTaskSettingsConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/task.json`;
    }

    getWorkerChecksConfigPath(cfg) {
        return `${cfg.taskName}/${cfg.batchName}/Task/workers.json`;
    }

    /* ---------- CONFIG UPLOADERS ---------- */

    uploadQuestionnairesConfig(cfg, data) {
        return this.upload(cfg, this.getQuestionnairesConfigPath(cfg), data);
    }

    uploadHitsConfig(cfg, data) {
        return this.upload(cfg, this.getHitsConfigPath(cfg), data);
    }

    uploadDimensionsConfig(cfg, data) {
        return this.upload(cfg, this.getDimensionsConfigPath(cfg), data);
    }

    uploadTaskInstructionsConfig(cfg, data) {
        return this.upload(cfg, this.getTaskInstructionsConfigPath(cfg), data);
    }

    uploadDimensionsInstructionsConfig(cfg, data) {
        return this.upload(cfg, this.getDimensionsInstructionsConfigPath(cfg), data);
    }

    uploadSearchEngineSettings(cfg, data) {
        return this.upload(cfg, this.getSearchEngineSettingsConfigPath(cfg), data);
    }

    uploadTaskSettings(cfg, data) {
        return this.upload(cfg, this.getTaskSettingsConfigPath(cfg), data);
    }

    uploadWorkersCheck(cfg, data) {
        return this.upload(cfg, this.getWorkerChecksConfigPath(cfg), data);
    }

    /* ---------- RUNTIME DATA UPLOADERS ---------- */

    uploadWorkers(cfg, data) {
        return this.upload(cfg, this.getWorkersFile(cfg), data);
    }

    uploadTaskData(cfg, worker: Worker, unit, data) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/task_data.json`, data);
    }

    uploadQualityCheck(cfg, worker: Worker, unit, data, currentTry) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/checks_try_${currentTry}.json`, data);
    }

    uploadQuestionnaire(cfg, worker: Worker, unit, data,
                        currentTry = null, completedElement = null,
                        accessesAmount = null, sequenceNumber = null) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/quest_${completedElement}_try_${currentTry}_acc_${accessesAmount}_seq_${sequenceNumber}.json`,
            data);
    }

    uploadDocument(cfg, worker: Worker, unit, data, currentTry,
                   completedElement = null, accessesAmount = null,
                   sequenceNumber = null) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/doc_${completedElement}_try_${currentTry}_acc_${accessesAmount}_seq_${sequenceNumber}.json`,
            data);
    }

    uploadFinalData(cfg, worker: Worker, unit, data, currentTry) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/data_try_${currentTry}.json`,
            data);
    }

    uploadComment(cfg, worker: Worker, unit, data, currentTry) {
        return this.upload(cfg,
            `${this.getWorkerFolder(cfg, worker)}${unit}/comment_try_${currentTry}.json`,
            data);
    }
}
