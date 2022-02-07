/* Core imports */
import {Injectable} from '@angular/core';
import * as AWS from "aws-sdk";

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

    public async insertACLRecordWorkerID(config, worker, current_try, updateArrivalTime, updateCompletionTime) {
        let params = {
            TableName: config["table_acl_name"],
            Item: {
                try: {S: current_try.toString()}
            }
        };
        if (updateArrivalTime) {
            params["Item"]['time_arrival'] = {}
            params["Item"]['time_arrival']['S'] = new Date().toUTCString()
        }

        if (updateCompletionTime) {
            params["Item"]['time_completion'] = {}
            params["Item"]['time_completion']['S'] = new Date().toUTCString()
        }
        for (const [param, value] of Object.entries(worker.paramsFetched)) {
            params["Item"][param] = {}
            params["Item"][param]['S'] = value
        }
        return await this.loadDynamoDB(config).putItem(params).promise();
    }

    public async insertACLRecordUnitId(config, entry, current_try, updateArrivalTime = false) {
        let params = {
            TableName: config["table_acl_name"],
            Item: {}
        };
        for (const [param, value] of Object.entries(entry)) {
            params["Item"][param] = {}
            params["Item"][param]['S'] = value
        }
        params["Item"]['try']['S'] = current_try.toString()
        if (updateArrivalTime)
            params["Item"]['time_arrival']['S'] = new Date().toUTCString()
        return await this.loadDynamoDB(config).putItem(params).promise();
    }

    public async insertDataRecord(config, worker_id, unit_id, current_try, sequence_number, data) {
        let params = {
            TableName: config["table_data_name"],
            Item: {
                identifier: {S: worker_id},
                sequence: {S: `${worker_id}-${unit_id}-${current_try}-${sequence_number}`},
                data: {S: JSON.stringify(data)},
                time: {S: (new Date().toUTCString())}
            }
        };
        return await this.loadDynamoDB(config).putItem(params).promise();
    }


}
