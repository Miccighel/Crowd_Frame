const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

exports.handler = async (event) => {
    for (const msg of event.Records) {
        let data = JSON.parse(msg.body); // Access 'body' directly, msg['body'] -> msg.body
        let seq = data.sequence;
        let bucket = data.bucket;
        let task = data.task;
        let batch = data.batch;
        let worker = data.worker;
        let unit_id = data.unitId;
        let try_current = data.try_current;
        let region = data.region;

        data.server_time = Date.now();
        data.details = JSON.stringify(data.details);

        // Initialize DynamoDB client with the region from event data
        const dynamodbClient = new DynamoDBClient({ region });

        await writeToDB(data, seq, 1, dynamodbClient);
    }
};

async function writeToDB(data, seq, tryNum, dynamodbClient) {
    data.sequence = tryNum.toString() + "_" + seq.toString();
    let table_name = `Crowd_Frame-${data.task}_${data.batch}_Logger`;

    try {
        // Marshall the data for DynamoDB PutItemCommand
        const params = {
            TableName: table_name,
            Item: marshall(data),
            ConditionExpression: "attribute_not_exists(worker)"
        };

        // Execute PutItemCommand
        await dynamodbClient.send(new PutItemCommand(params));
    } catch (error) {
        console.error("Error writing to DynamoDB:", error);
        // Handle retries or error handling logic here
        if (tryNum < 3) {
            await writeToDB(data, seq, tryNum + 1, dynamodbClient);
        } else {
            console.error("Max retry limit reached. Data:", data);
            throw new Error("Max retry limit reached");
        }
    }
}