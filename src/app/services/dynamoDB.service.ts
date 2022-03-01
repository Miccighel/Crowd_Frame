/* Core imports */
import {Injectable} from '@angular/core';
import * as AWS from "aws-sdk";
import {Worker} from "../models/worker";
import {Task} from "../models/task";

@Injectable({
    providedIn: 'root'
})

export class DynamoDBService {

    constructor() {
    }

    public loadDynamoDB(config) {
        let region = config["region"];
        let bucket = config["bucket"];
        let aws_id_key = config["aws_id_key"];
        let aws_secret_key = config["aws_secret_key"];
        return new AWS.DynamoDB({
            region: region,
            params: {Bucket: bucket},
            credentials: new AWS.Credentials(aws_id_key, aws_secret_key)
        });
    }

    public loadDynamoDBDocumentClient(config) {
        let region = config["region"];
        let bucket = config["bucket"];
        let aws_id_key = config["aws_id_key"];
        let aws_secret_key = config["aws_secret_key"];
        return new AWS.DynamoDB.DocumentClient({
            region: region,
            params: {Bucket: bucket},
            credentials: new AWS.Credentials(aws_id_key, aws_secret_key)
        });
    }

    public async listTables(config) {
        let client = this.loadDynamoDB(config)
        let params = {};
        return await client.listTables(params).promise()
    }

    public async getACLRecordWorkerId(config, worker_id, table = null) {
        let docClient = this.loadDynamoDBDocumentClient(config)
        let params = {
            TableName: table ? table : config["table_acl_name"],
            KeyConditionExpression: "#identifier = :identifier",
            ExpressionAttributeNames: {
                "#identifier": "identifier"
            },
            ExpressionAttributeValues: {
                ":identifier": worker_id
            }
        };
        return await docClient.query(params).promise()
    }

    public async getACLRecordUnitId(config, unit_id, table = null) {
        let docClient = this.loadDynamoDBDocumentClient(config)
        /* Secondary index defined on unit_id attribute of ACL table */
        let params = {
            TableName: table ? table : config["table_acl_name"],
            IndexName: 'unit_id-index',
            ScanIndexForward: true,
            KeyConditionExpression: "unit_id = :unit_id",
            ExpressionAttributeValues: {":unit_id": unit_id},
        };
        return await docClient.query(params).promise()
    }

    public async scanACLRecordUnitId(config, table = null, lastEvaluatedKey = null) {
        let docClient = this.loadDynamoDBDocumentClient(config)
        /* Secondary index defined on unit_id attribute of ACL table */
        let params = {
            TableName: table ? table : config["table_acl_name"],
            IndexName: 'unit_id-index',
            ScanIndexForward: true,
        };
        if (lastEvaluatedKey)
            params['ExclusiveStartKey'] = lastEvaluatedKey
        return await docClient.scan(params).promise()
    }

    public async insertACLRecordWorkerID(config, worker, updateArrivalTime) {
        let params = {
            TableName: config["table_acl_name"],
            Item: {}
        };
        for (const [param, value] of Object.entries(worker.paramsFetched)) {
            params["Item"][param] = {}
            params["Item"][param]['S'] = value
        }
        if (updateArrivalTime) {
            params["Item"]['time_arrival'] = {}
            params["Item"]['time_arrival']['S'] = new Date().toUTCString()
        }
        return await this.loadDynamoDB(config).putItem(params).promise();
    }

    public async insertACLRecordUnitId(config, entry, current_try, updateArrivalTime = false, updateRemovalTime = false) {
        let params = {
            TableName: config["table_acl_name"],
            Item: {}
        };
        for (const [param, value] of Object.entries(entry)) {
            params["Item"][param] = {}
            params["Item"][param]['S'] = value
        }
        if (updateArrivalTime)
            params["Item"]['time_arrival']['S'] = new Date().toUTCString()
        if (updateRemovalTime) {
            params["Item"]['time_removal'] = {}
            params["Item"]['time_removal']['S'] = {}
            params["Item"]['time_removal']['S'] = new Date().toUTCString()
        }
        return await this.loadDynamoDB(config).putItem(params).promise();
    }

    public async insertDataRecord(config, worker: Worker, task: Task, data) {
        let params = {
            TableName: config["table_data_name"],
            Item: {
                identifier: {S: worker.identifier},
                sequence: {S: `${worker.identifier}-${task.unitId}-${task.tryCurrent}-${task.sequenceNumber}`},
            }
        };
        for (const [key, value] of Object.entries(data['info'])) {
            if (key == 'sequence') {
                params['Item']['sequence_number'] = {}
                params['Item']['sequence_number']['S'] = {}
                params['Item']['sequence_number']['S'] = value.toString()
            } else {
                params['Item']['sequence_number'] = {}
                params['Item']['sequence_number']['S'] = {}
                params['Item']['sequence_number']['S'] = value.toString()
            }
        }
        params['Item']['time'] = {}
        params['Item']['time']['S'] = {}
        params['Item']['data'] = {}
        params['Item']['data']['S'] = {}
        params['Item']['time']['S'] = (new Date().toUTCString())
        params['Item']['data']['S'] = JSON.stringify(data)
        task.sequenceNumber = task.sequenceNumber + 1
        return await this.loadDynamoDB(config).putItem(params).promise();
    }


}
