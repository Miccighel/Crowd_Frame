/* Core imports */
import {Injectable} from '@angular/core';
import * as AWS from "aws-sdk";

@Injectable({
    providedIn: 'root'
})

export class DynamoDBService {

    constructor() {}

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

    public async getWorker(config, worker_id, table=null) {
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

    public async insertWorker(config, worker_id, current_try) {
        let params = {
            TableName: config["table_acl_name"],
            Item: {
                identifier: {S: worker_id},
                try: {S: current_try.toString()},
                time: {S: (new Date().toUTCString())}
            }
        };
        return await this.loadDynamoDB(config).putItem(params).promise();
    }

    public async insertData(config, worker_id, unit_id, current_try, sequence_number, data) {
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
