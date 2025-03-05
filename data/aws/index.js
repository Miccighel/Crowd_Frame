const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const querystring = require("querystring");

exports.handler = async (event) => {
    console.log("🚀 Lambda invoked with", event.Records.length, "messages");

    for (const msg of event.Records) {
        let data;

        try {
            let rawBody = msg.body;

            // Decode URL-encoded MessageBody if needed
            if (rawBody.includes("=")) {
                rawBody = querystring.parse(rawBody).MessageBody;
            }

            // Parse JSON payload
            data = JSON.parse(rawBody);
        } catch (error) {
            console.error("❌ Failed to parse message. Skipping.", "\nError:", error);
            continue;
        }

        let { sequence: seq, region } = data;

        data.server_time = Date.now();
        data.details = JSON.stringify(data.details);

        // Initialize DynamoDB client
        const dynamodbClient = new DynamoDBClient({ region });

        await writeToDB(data, seq, 1, dynamodbClient);
    }
};

async function writeToDB(data, seq, tryNum, dynamodbClient) {
    data.sequence = `${tryNum}_${seq}`;
    let table_name = `Crowd_Frame-${data.task}_${data.batch}_Logger`;

    try {
        const params = {
            TableName: table_name,
            Item: marshall(data)
        };

        await dynamodbClient.send(new PutItemCommand(params));
    } catch (error) {
        console.error(`❌ DynamoDB Error (Attempt ${tryNum}):`, error.name);

        // Retry on transient errors
        if (tryNum < 3 && error.name === "ProvisionedThroughputExceededException") {
            console.warn(`🔁 Retrying (Attempt ${tryNum + 1})...`);
            await writeToDB(data, seq, tryNum + 1, dynamodbClient);
        } else {
            console.error("⛔ Max retry limit reached. Skipping.");
        }
    }
}
