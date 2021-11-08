import os
import gzip
import json


def deserializeDynamoJson(dynamoJson: dict):
    record: dict
    deserialized = {}
    record = dynamoJson['Item']
    for finalKey, intermediateValue in record.items():
        for intermediateKey, finalValue in intermediateValue.items():
            if finalKey == 'details':
                finalValue = json.loads(finalValue)
            deserialized[finalKey] = finalValue
    return deserialized


def unzip():
    for index, file in enumerate(os.listdir("data/zipped")):
        print(file)
        with gzip.open(f'data/zipped/{file}', 'r') as content:
            with open(f'data/json/part_{index}.json', 'w') as out:
                recordList = []
                records = content.readlines()
                for line in records:
                    parsed = json.loads(line)
                    recordList.append(deserializeDynamoJson(parsed))
                out.write(json.dumps(recordList, indent=4, sort_keys=True))
