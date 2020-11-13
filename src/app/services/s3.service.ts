import {Inject, Injectable} from '@angular/core';
import * as AWS from "aws-sdk";
/* Debug config import */
import * as localRawDimensions from '../../../data/debug/dimensions.json';
import * as localRawHits from '../../../data/debug/hits.json';
import * as localRawInstructionsDimensions from '../../../data/debug/instructions_dimensions.json';
import * as localRawQuestionnaires from '../../../data/debug/questionnaires.json';
import * as localRawTaskSettings from '../../../data/debug/task.json';
import * as localRawSearchEngineSettings from '../../../data/debug/search_engine.json';
import * as localRawWorkers from '../../../data/debug/workers.json';
import * as localRawInstructionsMain from '../../../data/debug/instructions_main.json';
import {ManagedUpload} from "aws-sdk/clients/s3";
import {Worker} from "../models/skeleton/worker";

@Injectable({
  providedIn: 'root'
})
export class S3Service {

  constructor() {
  }

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

  public getWorkerPartialsFolder(config, worker: Worker, currentTry: number) {
    return `${this.getFolder(config)}Data/${worker.identifier}/Partials/Try-${currentTry}/`;
  }

  public getWorkerFinalFolder(config, worker: Worker, currentTry = null) {
    if (currentTry) {
      return `${this.getFolder(config)}Data/${worker.identifier}/Final/Try-${currentTry}/`
    } else {
      return `${this.getFolder(config)}Data/${worker.identifier}/Final/`;
    }
  }

  public getWorkersFile(config) {
    return `${this.getFolder(config)}Task/workers.json`
  }

  public downloadTaskSettings(config) {
    let taskSettingsFile = `${this.getFolder(config)}Task/settings.json`;
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

  public downloadTaskInstructions(config) {
    let taskInstructionsFile = `${this.getFolder(config)}Task/instructions_main.json`;
    return (config["configuration_local"]) ? localRawInstructionsMain["default"] : this.download(config, taskInstructionsFile);
  }

  public downloadDimensionsInstructions(config) {
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

  public uploadWorkers(config, data) {
    return this.upload(config, this.getWorkersFile(config), data)
  }

  public uploadTaskData(config, worker, data) {
    return this.upload(config, `${this.getWorkerFolder(config, worker)}task_data.json`, data)
  }

  public uploadQualityCheck(config, worker, data, currentTry) {
    return this.upload(config, `${this.getWorkerFinalFolder(config, worker, currentTry)}checks.json`, data)
  }

  public uploadQuestionnaire(config, worker, data, isFinal, currentTry = null, completedElement = null, accessesAmount = null) {
    if (isFinal) {
      return this.upload(config, `${this.getWorkerFinalFolder(config, worker)}questionnaires.json`, data)
    } else {
      return this.upload(config, `${this.getWorkerPartialsFolder(config, worker, currentTry)}questionnaire_${completedElement}_accesses_${accessesAmount}.json`, data)
    }
  }

  public uploadDocument(config, worker, data, isFinal, currentTry, completedElement = null, accessesAmount = null) {
    if (isFinal) {
      return this.upload(config, `${this.getWorkerFinalFolder(config, worker, currentTry)}documents.json`, data)
    } else {
      return this.upload(config, `${this.getWorkerPartialsFolder(config, worker, currentTry)}document_${completedElement}_accesses_${accessesAmount}.json`, data)
    }
  }

  public uploadComment(config, worker, data, currentTry) {
    return this.upload(config, `${this.getWorkerFinalFolder(config, worker, currentTry)}comment.json`, data)
  }

}