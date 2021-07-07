/* Core imports */
import {Injectable} from '@angular/core';
import * as AWS from "aws-sdk";
/* Debug config import */
import * as localRawDimensions from '../../../data/build/task/dimensions.json';
import * as localRawHits from '../../../data/build/task/hits.json';
import * as localRawInstructionsDimensions from '../../../data/build/task/instructions_dimensions.json';
import * as localRawQuestionnaires from '../../../data/build/task/questionnaires.json';
import * as localRawTaskSettings from '../../../data/build/task/task.json';
import * as localRawSearchEngineSettings from '../../../data/build/task/search_engine.json';
import * as localRawWorkers from '../../../data/build/task/workers.json';
import * as localRawInstructionsMain from '../../../data/build/task/instructions_main.json';
import * as localRawAdmin from '../../../data/build/config/admin.json';
import {ManagedUpload} from "aws-sdk/clients/s3";
import {Worker} from "../models/worker";

@Injectable({
  providedIn: 'root'
})

export class S3Service {

  constructor() {}

  public loadS3(config) {
    let region = config["region"];
    let bucket = config["bucket"];
    let aws_id_key = config["aws_id_key"];
    let aws_secret_key = config["aws_secret_key"];
    return new AWS.S3({
      region: region,
      params: {Bucket: bucket},
      credentials: new AWS.Credentials(aws_id_key, aws_secret_key)
    });
  }

  /*
   * This function performs a GetObject operation to Amazon S3 and returns a parsed JSON which is the requested resource.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html
   */
  public async download(config, path) {
    let s3 = this.loadS3(config)
      return JSON.parse(
        (await (s3.getObject({
          Bucket: config["bucket"],
          Key: path
        }).promise())).Body.toString('utf-8')
      );
  }

  /*
   * This function performs an Upload operation to Amazon S3 and returns a JSON object which contains info about the outcome.
   * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property
   */
  public async upload(config, path: string, payload: Object): Promise<ManagedUpload> {
    let s3 = this.loadS3(config)
    return s3.upload({
      Key: path,
      Bucket: config["bucket"],
      Body: JSON.stringify(payload, null, "\t")
    }, function (err, data) {
    })
  }

  /*
   * This function performs an Upload operation to Amazon S3 and returns a JSON object which contains info about the outcome.
   * https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
   */
  public async listFolders(config, key = null) {
    let s3 = this.loadS3(config)
    if(key) {
      return Object(
        (await (s3.listObjectsV2({
          Bucket: config["bucket"],
          Prefix: `${key}`,
          Delimiter: '/'
        }).promise())).CommonPrefixes
      );
    } else {
      return Object(
        (await (s3.listObjectsV2({
          Bucket: config["bucket"],
          Delimiter: '/'
        }).promise())).CommonPrefixes
      );
    }

  }

  /*
   * The following functions are used to retrieve some base path names on the S3 bucket
   */

  public getTaskDataS3Path(config, name, batch) {
    return `${config["region"]}/${config["bucket"]}/${name}/${batch}`
  }

  public getFolder(config) {
    if (config["batchName"]) {
      return `${config["taskName"]}/${config["batchName"]}/`
    } else {
      return `${config["taskName"]}/`
    }
  }

  public getWorkerFolder(config, worker: Worker, identifier = null) {
    if (identifier) {
      return `${this.getFolder(config)}Data/${identifier}/`;
    } else {
      return `${this.getFolder(config)}Data/${worker.identifier}/`;
    }
  }

  public getWorkersFile(config) {
    return `${this.getFolder(config)}Task/workers.json`
  }

  /*
   * The following functions are used to download the files used by the rest of the application from the S3 bucket
   */

  public downloadAdministrators(config) {
    let administratorsFile = `${this.getFolder(config)}Generator/admin.json`;
    return (config["configuration_local"]) ? localRawAdmin["default"] : this.download(config, administratorsFile);
  }

  public downloadTaskSettings(config) {
    let taskSettingsFile = `${this.getFolder(config)}Task/task.json`;
    return (config["configuration_local"]) ? localRawTaskSettings["default"] : this.download(config, taskSettingsFile);
  }

  public downloadSearchEngineSettings(config) {
    let searchEngineSettingsFile = `${this.getFolder(config)}Task/search_engine.json`;
    return (config["configuration_local"]) ? localRawSearchEngineSettings["default"] : this.download(config, searchEngineSettingsFile);
  }

  public downloadHits(config) {
    let hitsFile = `${this.getFolder(config)}Task/hits.json`;
    return (config["configuration_local"]) ? localRawHits["default"] : this.download(config, hitsFile);
  }

  public downloadGeneralInstructions(config) {
    let taskInstructionsFile = `${this.getFolder(config)}Task/instructions_main.json`;
    return (config["configuration_local"]) ? localRawInstructionsMain["default"] : this.download(config, taskInstructionsFile);
  }

  public downloadEvaluationInstructions(config) {
    let dimensionsInstructionsFile = `${this.getFolder(config)}Task/instructions_dimensions.json`;
    return (config["configuration_local"]) ? localRawInstructionsDimensions["default"] : this.download(config, dimensionsInstructionsFile);
  }

  public downloadDimensions(config) {
    let dimensionsFile = `${this.getFolder(config)}Task/dimensions.json`;
    return (config["configuration_local"]) ? localRawDimensions["default"] : this.download(config, dimensionsFile);
  }

  public downloadQuestionnaires(config) {
    let questionnairesFile = `${this.getFolder(config)}Task/questionnaires.json`;
    return (config["configuration_local"]) ? localRawQuestionnaires["default"] : this.download(config, questionnairesFile);
  }

  public downloadWorkers(config, batch = null) {
    if (batch == null) {
      let workersFile = `${this.getFolder(config)}Task/workers.json`;
      return (config["configuration_local"]) ? localRawWorkers["default"] : this.download(config, workersFile);
    } else {
      let workersFile = `${batch}/Task/workers.json`;
      return this.download(config, workersFile);
    }
  }

  /*
   * The following functions are used to retrieve the paths to the configuration files of the current task on the S3 bucket
   */

  public getQuestionnairesConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/questionnaires.json`
  }

  public getHitsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/hits.json`
  }

  public getDimensionsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/dimensions.json`
  }

  public getTaskInstructionsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/instructions_main.json`
  }

  public getDimensionsInstructionsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/instructions_dimensions.json`
  }

  public getSearchEngineSettingsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/search_engine.json`
  }

  public getTaskSettingsConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/task.json`
  }

  public getWorkerChecksConfigPath(config) {
    return `${config.taskName}/${config.batchName}/Task/workers.json`
  }

  /*
   * The following functions are used to upload the configuration files of the current task on the S3 bucket
   */

  public uploadQuestionnairesConfig(config, data) {
    console.log(config)
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/questionnaires.json`, data)
  }

  public uploadHitsConfig(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/hits.json`, data)
  }

  public uploadDimensionsConfig(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/dimensions.json`, data)
  }

  public uploadTaskInstructionsConfig(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/instructions_main.json`, data)
  }

  public uploadDimensionsInstructionsConfig(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/instructions_dimensions.json`, data)
  }

  public uploadSearchEngineSettings(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/search_engine.json`, data)
  }

  public uploadTaskSettings(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/task.json`, data)
  }

  public uploadWorkersCheck(config, data) {
    return this.upload(config, `${config.taskName}/${config.batchName}/Task/workers.json`, data)
  }

  /*
   * The following functions are used upload the data produced during the task's executions
   */

  public uploadWorkers(config, data) {
    return this.upload(config, this.getWorkersFile(config), data)
  }

  public uploadTaskData(config, worker, data) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}task_data.json`, data)
  }

  public uploadQualityCheck(config, worker, data, currentTry) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}checks_try_${currentTry}.json`, data)
  }

  public uploadQuestionnaire(config, worker, data, currentTry = null, completedElement = null, accessesAmount = null, sequenceNumber = null) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}quest_${completedElement}_try_${currentTry}_acc_${accessesAmount}_seq_${sequenceNumber}.json`, data)
  }

  public uploadDocument(config, worker, data, currentTry, completedElement = null, accessesAmount = null, sequenceNumber = null) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}doc_${completedElement}_try_${currentTry}_acc_${accessesAmount}_seq_${sequenceNumber}.json`, data)
  }

  public uploadFinalData(config, worker, data, currentTry) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}data_try_${currentTry}.json`, data)
  }

  public uploadComment(config, worker, data, currentTry) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}comment_try_${currentTry}.json`, data)
  }

}
