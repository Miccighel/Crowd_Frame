const AWS = require('aws-sdk');

let dynamodb = new AWS.DynamoDB.DocumentClient();

let bucket = ''
let task = '';
let batch = '';
let worker = '';
let unit_id = '';
let try_current = '';

exports.handler = (event) => {
    for (const msg of event.Records) {
        let data = JSON.parse(msg['body']);
        let seq = data['sequence']
        bucket = data['bucket'];
        task = data['task'];
        batch = data['batch'];
        worker = data['worker'];
        unit_id = data['unitId'];
        try_current = data['try_current'];
        data['server_time'] = Date.now();
        data['details'] = JSON.stringify(data['details'])
        writeToDB(data, seq, 1);
    }
}

function writeToDB(data, seq, tryNum) {
    data['sequence'] = tryNum.toString() + "_" + seq.toString()
    let table_name = "Crowd_Frame-" + task + "_" + batch + "_Logger";
    dynamodb.put({
        Item: data,
        TableName: table_name,
        ConditionExpression: "attribute_not_exists(worker)"
    }, (error) => {
        if (error) {
            writeToDB(data, seq, ++tryNum)
        }
    });
}