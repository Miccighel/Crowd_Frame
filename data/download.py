#!/usr/bin/env python
# coding: utf-8

import json
import os
from glob import glob
import ipinfo
import re
import numpy as np
import requests
from distutils.util import strtobool
from pathlib import Path
import boto3
import pandas as pd
import pprint
from dotenv import load_dotenv
import datetime
import xml.etree.ElementTree as Xml
from rich.console import Console
from tqdm import tqdm
from botocore.errorfactory import ClientError

console = Console()
pp = pprint.PrettyPrinter(indent=4)

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

mail_contact = os.getenv('mail_contact')
profile_name = os.getenv('profile_name')
task_name = os.getenv('task_name')
batch_name = os.getenv('batch_name')
admin_user = os.getenv('admin_user')
admin_password = os.getenv('admin_password')
deploy_config = os.getenv('deploy_config')
server_config = os.getenv('server_config')
deploy_config = strtobool(deploy_config) if deploy_config is not None else False
aws_region = os.getenv('aws_region')
aws_private_bucket = os.getenv('aws_private_bucket')
aws_deploy_bucket = os.getenv('aws_deploy_bucket')
budget_limit = os.getenv('budget_limit')
bing_api_key = os.getenv('bing_api_key')

ipInfoToken = "fa8ac3a2ed1ac4"
userStackToken = "a5c31ecd7171e421ebe21df5c3ac040d"


def serialize_json(folder, filename, data):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    with open(f"{folder}{filename}", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4, default=str)
        f.close()


def load_json(p):
    if os.path.exists(p):
        with open(p, "r", encoding="latin1") as f:
            d = json.load(f)
        return d
    else:
        return {}


def load_file_names(p):
    files = []
    for r, d, f in os.walk(p):
        for caf in f:
            files.append(caf)
    return files


def sanitize_string(x):
    try:
        x = x.replace("'", "")
        x = x.replace('"', '')
        x = x.replace('\n', '')
        x = x.rstrip()
        x = re.sub(r'[^\w\s]', '', x)
        x = re.sub(' [^0-9a-zA-Z]+', '', x)
        x = re.sub(' +', ' ', x)
        return x
    except TypeError:
        return np.nan


def load_column_names(questionnaires, dimensions, documents):
    columns = [
        "task_id",
        "batch_name",
        "worker_id",
        "worker_paid",
        "worker_ip",
        "worker_hostname",
        "worker_city",
        "worker_postal",
        "worker_region",
        "worker_country_code",
        "worker_country_name",
        "worker_latitude",
        "worker_longitude",
        "worker_timezone",
        "worker_org",
        "worker_uag",
        "ua_type",
        "ua_brand",
        "ua_name",
        "ua_url",
        "os_name",
        "os_code",
        "os_url",
        "os_family",
        "os_family_code",
        "os_family_vendor",
        "os_icon",
        "os_icon_large",
        "device_is_mobile",
        "device_type",
        "device_brand",
        "device_brand_code",
        "device_brand_url",
        "device_name",
        "browser_name",
        "browser_version",
        "browser_version_major",
        "browser_engine",
        "unit_id",
        "token_input",
        "token_output",
        "tries_amount",
        "questionnaire_amount",
        "dimensions_amount",
        "document_amount",
        "current_try"
    ]

    for questionnaire in questionnaires:
        for question in questionnaire["questions"]:
            columns.append(f"q_{questionnaire['index']}_{question['name']}_question")
            columns.append(f"q_{questionnaire['index']}_{question['name']}_answer")
            columns.append(f"q_{questionnaire['index']}_{question['name']}_value")
        columns.append(f"q_{questionnaire['index']}_time_elapsed")
        columns.append(f"q_{questionnaire['index']}_accesses")

    for document in documents:
        currentAttributes = document.keys()
        for currentAttribute in currentAttributes:
            if f"doc_{currentAttribute}" not in columns:
                columns.append(f"doc_{currentAttribute}")

    for dimension in dimensions:
        if f"doc_{dimension['name']}_value" not in columns:
            columns.append(f"doc_{dimension['name']}_value")
        if f"doc_{dimension['name']}_label" not in columns:
            columns.append(f"doc_{dimension['name']}_label")
        if f"doc_{dimension['name']}_index" not in columns:
            columns.append(f"doc_{dimension['name']}_index")
        if f"doc_{dimension['name']}_description" not in columns:
            columns.append(f"doc_{dimension['name']}_description")
        if f"doc_{dimension['name']}_justification" not in columns:
            columns.append(f"doc_{dimension['name']}_justification")
        if f"doc_{dimension['name']}_url" not in columns:
            columns.append(f"doc_{dimension['name']}_url")

    columns.append("doc_countdown_time_start")
    columns.append("doc_countdown_time_value")
    columns.append("doc_countdown_time_text")
    columns.append("doc_countdown_time_expired")

    columns.append("doc_accesses")

    columns.append("doc_time_elapsed")
    columns.append("doc_time_start")
    columns.append("doc_time_end")

    columns.append("global_form_validity")
    columns.append("gold_checks")
    columns.append("time_spent_check")
    columns.append("time_check_amount")

    columns.append("comment")

    return columns


console.rule("0 - Initialization")

os.chdir("../data/")

console.print("[bold]Download.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

folder_result_path = f"result/{task_name}/"
os.makedirs(folder_result_path, exist_ok=True)

boto_session = boto3.Session(profile_name='mturk-user')
mturk = boto_session.client('mturk', region_name='us-east-1')
boto_session = boto3.Session(profile_name='config-user')
s3 = boto_session.client('s3', region_name=aws_region)
s3_resource = boto_session.resource('s3')
bucket = s3_resource.Bucket(aws_private_bucket)
dynamo_db = boto3.client('dynamodb', region_name=aws_region)
dynamo_db_resource = boto3.resource('dynamodb', region_name=aws_region)
ip_info_handler = ipinfo.getHandler(ipInfoToken)

next_token = ''
hit_counter = 0
token_counter = 0

task_data_tables = []
task_log_tables = []
task_acl_tables = []
task_batch_names = []

dynamo_db_tables = dynamo_db.list_tables()['TableNames']
for table_name in dynamo_db_tables:
    if task_name in table_name and 'Data' in table_name:
        task_data_tables.append(table_name)
    if task_name in table_name and 'Logger' in table_name:
        task_log_tables.append(table_name)
    if task_name in table_name and 'ACL' in table_name:
        task_acl_tables.append(table_name)

response = s3.list_objects(Bucket=aws_private_bucket, Prefix=f"{task_name}/", Delimiter='/')
for path in response['CommonPrefixes']:
    batch_name = path.get('Prefix').split("/")[1]
    task_batch_names.append(batch_name)

console.print(f"Batch names: [white on black]{', '.join(task_batch_names)}")
console.print(f"Tables data: [white on black]{', '.join(task_data_tables)}")
console.print(f"Tables log: [white on black]{', '.join(task_log_tables)}")
console.print(f"Tables ACL: [white on black]{', '.join(task_acl_tables)}")

console.rule("1 - Fetching HITs")

models_path = f"result/{task_name}/Models/"
resources_path = f"result/{task_name}/Resources/"
data_path = f"result/{task_name}/Data/"
hit_data_path = f"result/hits_data.csv"
workers_acl_path = f"result/workers_acl.csv"

os.makedirs(models_path, exist_ok=True)
os.makedirs(resources_path, exist_ok=True)
os.makedirs(data_path, exist_ok=True)

with console.status(f"Downloading HITs, Token: {next_token}, Total: {token_counter}", spinner="aesthetic") as status:
    status.start()

    while next_token != '' or next_token is not None:

        if not os.path.exists(hit_data_path):
            console.print(f"[yellow]HITs data[/yellow] file not detected, creating it.")
            hit_df = pd.DataFrame(columns=[
                'HITId', 'HITTypeId', 'HITGroupId', 'HITLayoutId', 'CreationTime', 'Title', 'Description', 'Keywords', 'HITStatus', 'MaxAssignments',
                'Reward', 'AutoApprovalDelayInSeconds', 'Expiration', 'AssignmentDurationInSeconds', 'RequesterAnnotation', 'HITReviewStatus',
                'NumberOfAssignmentsPending', 'NumberOfAssignmentsAvailable', 'NumberOfAssignmentsCompleted', 'AssignmentId', 'WorkerId', 'AssignmentStatus',
                'AutoApprovalTime', 'AcceptTime', 'SubmitTime', 'ApprovalTime'
            ])
        else:
            hit_df = pd.read_csv(hit_data_path)

        if next_token == '':
            response = mturk.list_hits()
        else:
            response = mturk.list_hits(NextToken=next_token)

        try:

            next_token = response['NextToken']
            num_results = response['NumResults']
            hits = response['HITs']

            status.update(f"Downloading HITs, Token: {next_token}, Total: {token_counter}")

            for item in hits:

                row = {}
                hit_id = item['HITId']
                available_records = hit_df.loc[hit_df['HITId'] == hit_id]

                status.update(f"HIT Id: {hit_id}, Available Records: {len(available_records)}, Total: {hit_counter}")

                if len(available_records) <= 0:

                    hit_status = mturk.get_hit(HITId=hit_id)['HIT']
                    token_input = None
                    token_output = None
                    question_parsed = Xml.fromstring(hit_status['Question'])
                    for child in question_parsed:
                        for string_splitted in child.text.split("\n"):
                            string_sanitized = sanitize_string(string_splitted)
                            if len(string_sanitized) > 0:
                                if 'tokenInputtext' in string_sanitized:
                                    token_input = string_sanitized.replace('tokenInputtext', '')
                                if 'tokenOutputonchangeiftokenOutputval' in string_sanitized:
                                    token_output = string_sanitized.replace('tokenOutputonchangeiftokenOutputval', '').split(" ")[0]
                    hit_status[f"Input.token_input"] = token_input
                    hit_status[f"Input.token_output"] = token_output
                    hit_status.pop('Question')
                    hit_status.pop('QualificationRequirements')

                    for hit_status_attribute, hit_status_value in hit_status.items():
                        row[hit_status_attribute] = hit_status_value

                    hit_assignments = mturk.list_assignments_for_hit(HITId=hit_id, AssignmentStatuses=['Approved'])
                    for hit_assignment in hit_assignments['Assignments']:

                        answer_parsed = Xml.fromstring(hit_assignment['Answer'])[0]
                        tag_title = None
                        tag_value = None
                        for child in answer_parsed:
                            if 'QuestionIdentifier' in child.tag:
                                tag_title = child.text
                            if 'FreeText' in child.tag:
                                tag_value = child.text
                        hit_assignment[f"Answer.{tag_title}"] = tag_value
                        hit_assignment.pop('Answer')

                        for hit_assignment_attribute, hit_assignment_value in hit_assignment.items():
                            row[hit_assignment_attribute] = hit_assignment_value

                        hit_df = hit_df.append(row, ignore_index=True)

                hit_counter = hit_counter + 1

            token_counter += 1
            hit_df.to_csv(hit_data_path, index=False)
        except KeyError:
            console.print(f"HITs data download completed, Tokens: {token_counter}, HITs: {hit_counter}")
            break

console.print(f"HITs data file serialized at path: [cyan on white]{hit_data_path}")

console.rule("2 - Fetching task configuration")

hit_df = pd.read_csv(hit_data_path)

prefix = f"{task_name}/"
task_config_folder = f"{folder_result_path}/Task/"
if not os.path.exists(task_config_folder):
    response = s3.list_objects(Bucket=aws_private_bucket, Prefix=prefix, Delimiter='/')
    for batch_name in task_batch_names:
        response_batch = s3.list_objects(Bucket=aws_private_bucket, Prefix=f"{prefix}{batch_name}/Task/", Delimiter='/')
        os.makedirs(f"{task_config_folder}{batch_name}/", exist_ok=True)
        for path_batch in response_batch['Contents']:
            file_key = path_batch['Key']
            file_name = file_key.split('/')[-1]
            destination_path = f"{task_config_folder}{batch_name}/{file_name}"
            if not os.path.exists(destination_path):
                console.print(f"Source: [cyan on white]{file_key}[/cyan on white], Destination: [cyan on white]{destination_path}[/cyan on white]")
                s3.download_file(aws_private_bucket, file_key, f"{destination_path}")
            else:
                console.print(f"Source: [cyan on white]{file_key}[/cyan on white] [yellow]already detected[/yellow], skipping download")
else:
    console.print(f"Task configuration [yellow]already detected[/yellow], skipping download")

console.rule("3 - Fetching worker data")

worker_df = pd.DataFrame(columns=[
    'worker_id', 'worker_time_acl', 'worker_try'
])
paginator = dynamo_db.get_paginator('scan')
for table_acl in task_acl_tables:
    for page in paginator.paginate(TableName=table_acl, Select='ALL_ATTRIBUTES'):
        for item in page['Items']:
            worker_id = item['identifier']['S']
            worker_try = item['try']['S']
            worker_time = item['time']['S']
            worker_df = worker_df.append({
                "worker_id": worker_id,
                "worker_time_acl": worker_time,
                "worker_try": worker_try
            }, ignore_index=True)
worker_df.to_csv(workers_acl_path, index=False)

worker_identifiers = np.unique(worker_df['worker_id'].values)
console.print(f"Unique worker identifiers found: [green]{len(worker_identifiers)}")
console.print(f"Workers ACL data file serialized at path: [cyan on white]{workers_acl_path}")

worker_counter = 0

allowed_ip_properties = ['city', 'hostname', 'region', 'country', 'country_name', 'latitude', 'longitude', 'postal', 'timezone', 'org']
allowed_ua_properties = ['name', 'url', 'code', 'url', 'family', 'family_code', 'family_vendor', 'icon', 'icon_large', 'is_mobile_device', 'type', 'brand', 'brand_code', 'brand_url', 'version', 'version_major', 'engine']
allowed_ua_os_properties = []
allowed_ua_device_properties = []
allowed_ua_browser_properties = []

with console.status(f"Workers Amount: {len(worker_identifiers)}", spinner="aesthetic") as status:
    status.start()

    for worker_id in worker_identifiers:

        worker_snapshot = []
        worker_snapshot_path = f"result/{task_name}/Data/{worker_id}.json"
        worker_folder_s3 = f"{aws_private_bucket}/{task_name}/Data/{worker_id}/"

        if not os.path.exists(worker_snapshot_path):

            status.update(f"Downloading worker data, Identifier: {worker_id}, Total: {worker_counter}/{len(worker_identifiers)}")

            worker_data = {}
            for table_name in task_data_tables:
                worker_data[table_name] = []
            for table_name in task_data_tables:
                response = dynamo_db.query(
                    TableName=table_name,
                    KeyConditionExpression="identifier = :worker",
                    ExpressionAttributeValues={
                        ":worker": {'S': worker_id}
                    }
                )['Items']
                for item in response:
                    worker_data[table_name].append(item)

            worker_snapshot = []

            for data_source, worker_session in worker_data.items():

                acl_data_source = None
                for table_name in task_acl_tables:
                    if f"{task_name}_{batch_name}" in table_name:
                        acl_data_source = table_name
                log_data_source = None
                for table_name in task_log_tables:
                    if f"{task_name}_{batch_name}" in table_name:
                        log_data_source = table_name

                worker_object = {
                    "task": {
                        "worker_id": worker_id,
                        "try_last": 0,
                        "paid": False,

                    },
                    "checks": [],
                    "dimensions": {},
                    "data_full": [],
                    "data_partial": {
                        "questionnaires": [],
                        "documents": []
                    },
                    "comments": [],
                    "documents": {},
                    "questionnaires": {},
                    "logs": [],
                    "ip": {},
                    "uag": {}
                }

                for element in worker_session:

                    sequence = element['sequence']['S'].split("-")
                    data = json.loads(element['data']['S'])
                    time = element['time']['S']

                    worker_id = sequence[0]
                    unit_id = sequence[1]
                    current_try = sequence[2]
                    worker_object['task']['try_last'] = max(int(worker_object['task']['try_last']), int(current_try))

                    uag_file = f"{resources_path}{worker_id}_uag.json"
                    ip_file = f"{resources_path}{worker_id}_ip.json"

                    if 'task' in data:
                        for attribute, value in data['task'].items():
                            worker_object['task'][attribute] = value
                        if data['info']['element'] == 'data':
                            worker_object['dimensions'] = data.pop('dimensions')
                            worker_object['documents'] = data.pop('documents')
                            worker_object['questionnaires'] = data.pop('questionnaires')
                        if data['info']['element'] == 'all':
                            data.pop('dimensions')
                            data.pop('documents')
                            data.pop('questionnaires')
                            data.pop('task')
                            worker_object['data_full'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                    else:
                        if data['info']['element'] == 'document':
                            worker_object['data_partial']['documents'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        if data['info']['element'] == 'questionnaire':
                            worker_object['data_partial']['questionnaires'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        if data['info']['element'] == 'comment':
                            worker_object['comments'].append({
                                "time_submit": time,
                                "serialization": data
                            })

                    if 'worker' in data:
                        worker_object['task']['folder'] = data['worker']['folder']
                        if "cloudflareProperties" in data['worker'].keys() and 'uag' in data['worker']["cloudflareProperties"].keys() and len(worker_object['uag']) <= 0:
                            workerUag = data['worker']['cloudflareProperties']['uag']
                            url = f"http://api.userstack.com/detect?access_key={userStackToken}&ua={workerUag}"
                            if os.path.exists(uag_file):
                                ua_data = load_json(uag_file)
                            else:
                                ua_data = requests.get(url).json()
                                with open(uag_file, 'w', encoding='utf-8') as f:
                                    json.dump(ua_data, f, ensure_ascii=False, indent=4)
                            for attribute, value in ua_data.items():
                                if type(value) == dict:
                                    for attribute_sub, value_sub in value.items():
                                        if attribute_sub in allowed_ua_properties:
                                            worker_object['uag'][attribute_sub] = value_sub
                                else:
                                    if attribute in allowed_ua_properties:
                                        worker_object['uag'][attribute] = value
                        if "cloudflareProperties" in data['worker'].keys() and 'ip' in data['worker']["cloudflareProperties"].keys() and len(worker_object['ip']) <= 0:
                            worker_ip = data['worker']['cloudflareProperties']['ip']
                            if os.path.exists(ip_file):
                                ip_data = load_json(ip_file)
                            else:
                                ip_data = ip_info_handler.getDetails(worker_ip).all
                                with open(ip_file, 'w', encoding='utf-8') as f:
                                    json.dump(ip_data, f, ensure_ascii=False, indent=4)
                            for attribute, value in ip_data.items():
                                if attribute in allowed_ip_properties:
                                    worker_object['ip'][attribute] = value
                        data.pop('worker')

                        try:
                            check_for_try = None
                            for check_data in worker_object['checks']:
                                if check_data['serialization']['try']==current_try:
                                    check_for_try = check_data
                            if not check_for_try:
                                data = json.loads(
                                    s3_resource.Object(aws_private_bucket, f"{task_name}/{worker_object['task']['batch_name']}/Data/{worker_id}/{worker_object['task']['unit_id']}/checks_try_{current_try}.json").get()['Body'].read())
                                data_parsed = {}
                                for attribute, value in data.items():
                                    attribute_parsed = re.sub('(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    data_parsed[attribute_parsed] = value
                                data_parsed['try'] = current_try
                                final_object = {
                                    # "time_submit": time,
                                    "serialization": data_parsed
                                }
                                worker_object['checks'].append(final_object)
                        except ClientError as e:
                            continue
                        except KeyError as e:
                            continue

                if log_data_source:
                    paginator = dynamo_db.get_paginator('query')
                    for page in paginator.paginate(
                      TableName=log_data_source,
                      KeyConditionExpression="worker = :worker",
                      ExpressionAttributeValues={
                          ":worker": {'S': worker_id}
                      }
                    ):
                        for item in page['Items']:
                            data = {
                                'time_server': item['server_time']['N'],
                                'time_client': item['client_time']['N'],
                                'type': item['type']['S'],
                                'try': item['sequence']['S'].split("_")[0],
                                'sequence': item['sequence']['S'].split("_")[1],
                                'details': json.loads(item['details']['S'])
                            }
                            worker_object['logs'].append(data)

                worker_paid = False
                check_final_data = None
                for check_data in worker_object['checks']:
                    if int(check_data['serialization']['try']) == int(worker_object['task']['try_last']):
                        check_final_data = check_data
                if check_final_data:
                    if check_final_data['serialization']['global_form_validity']==True and check_final_data['serialization']['time_spent_check'] == True and any(check_final_data['serialization']['gold_checks']):
                        worker_paid = True
                else:
                    worker_paid = False

                worker_object['task']['paid'] = worker_paid

                worker_snapshot.append(worker_object)

        with open(worker_snapshot_path, 'w', encoding='utf-8') as f:
            json.dump(worker_snapshot, f, ensure_ascii=False, indent=4)
        worker_counter += 1

    console.print(f"Data fetching for {worker_counter} workers [green]completed")

console.rule("4 - Building results dataframe")

paid_workers = []
spuriousWorkers = []

models_path = f"result/{task_name}/Models/"

for index, row in hit_df.iterrows():

    worker_folder_path = f"{folder_result_path}Data/{row['WorkerId']}/"
    hits = load_json(f"{folder_result_path}Task/hits.json")

    units_paths = glob(f"{worker_folder_path}*")

    units = []
    for unit_path in units_paths:
        unit_name = unit_path.split('\\')[-1]
        units.append(unit_name)

    paid_workers.append({
        "worker_id": row['WorkerId'],
        "unit_ids": units,
        "paid": True
    })

console.print(f"Found {len(paid_workers)} paid workers")

dataframe = []

data_path = f"result/{task_name}/Data/"
dataframe_path = f"{models_path}workers_data.csv"

if not os.path.exists(dataframe_path):

    console.print(f"Dataframe [yellow]not detected[/yellow], building it")

    for workerIndex, worker in enumerate(tqdm(paid_workers)):

        workerId = worker['worker_id']
        workerUnits = worker['unit_ids']
        workerPaid = worker['paid']

        for unit_id in workerUnits:

            folder = f"{data_path}{workerId}/{unit_id}/"
            taskDataFile = f"{folder}task_data.json"
            taskData = load_json(taskDataFile)

            task = taskData["task"]
            worker = taskData["worker"]
            questionnaires = taskData["questionnaires"]
            dimensions = taskData["dimensions"]
            documents = taskData["documents"]

            columns = load_column_names(questionnaires, dimensions, documents)
            row = {}
            df = pd.DataFrame(columns=columns)

            folderFinal = f"{folder}Final/"

            ipFile = f"{ip_folder}{workerId}_ip.json"
            uagFile = f"{uag_folder}{workerId}_uag.json"

            task_name = task["task_id"]
            batch_name_current = task['batch_name']
            unitId = task["unit_id"]
            tokenInput = task["token_input"]
            tokenOutput = task["token_output"]
            triesAmount = int(task["tries_amount"])
            questionnaireAmount = int(task["questionnaire_amount"])
            dimensionsAmount = int(task["dimensions_amount"])
            documentsAmount = int(task["documents_amount"])

            currentTry = 0
            for aTry in range(0, triesAmount + 1):
                if os.path.exists(f"{folder}data_try_{aTry + 1}.json"):
                    currentTry = aTry + 1

                    row["task_id"] = task_name
                    row["batch_name"] = batch_name_current
                    row["worker_id"] = workerId
                    row["worker_paid"] = workerPaid
                    row["worker_ip"] = worker_ip
                    row["worker_hostname"] = workerHostname
                    row["worker_city"] = workerCity
                    row["worker_region"] = workerRegion
                    row["worker_country_code"] = workerCountryCode
                    row["worker_country_name"] = workerCountryName
                    row["worker_latitude"] = workerLatitude
                    row["worker_longitude"] = workerLongitude
                    row["worker_postal"] = workerPostal
                    row["worker_timezone"] = workerTimezone
                    row["worker_org"] = workerOrg
                    row["worker_uag"] = workerUag
                    row["ua_type"] = uaType
                    row["ua_brand"] = uaBrand
                    row["ua_name"] = uaName
                    row["ua_url"] = uaUrl
                    row["os_name"] = osName
                    row["os_code"] = osCode
                    row["os_url"] = osUrl
                    row["os_family"] = osFamily
                    row["os_family_code"] = osFamilyCode
                    row["os_family_vendor"] = osFamilyVendor
                    row["os_icon"] = osIcon
                    row["os_icon_large"] = osIconLarge
                    row["device_is_mobile"] = deviceIsMobile
                    row["device_type"] = deviceType
                    row["device_brand"] = deviceBrand
                    row["device_brand_code"] = deviceBrandCode
                    row["device_brand_url"] = deviceBrandCode
                    row["device_name"] = deviceName
                    row["browser_name"] = browserName
                    row["browser_version"] = browserVersion
                    row["browser_version_major"] = browserVersionMajor
                    row["browser_engine"] = browserEngine
                    row["unit_id"] = unitId
                    row["token_input"] = tokenInput
                    row["token_output"] = tokenOutput
                    row["tries_amount"] = triesAmount
                    row["questionnaire_amount"] = questionnaireAmount
                    row["dimensions_amount"] = dimensionsAmount
                    row["document_amount"] = documentsAmount
                    row["current_try"] = currentTry

                    currentTryPath = f"{folder}data_try_{currentTry}.json"
                    currentCheckPath = f"{folder}checks_try_{currentTry}.json"
                    currentCommentPath = f"{folder}comment_try_{currentTry}.json"

                    if os.path.exists(currentTryPath):

                        tryData = load_json(currentTryPath)
                        checksData = load_json(currentCheckPath)
                        commentsData = load_json(currentCommentPath)

                        accesses = tryData["accesses"]
                        timestampsElapsed = tryData["timestamps_elapsed"]
                        timestampsStart = tryData["timestamps_start"]
                        timestampsEnd = tryData["timestamps_end"]
                        questionnaireAnswers = tryData["questionnaires_answers"]
                        documentAnswers = tryData["documents_answers"]
                        countdownsStart = tryData["countdowns_times_start"]
                        countdownsLeft = tryData["countdowns_times_left"]
                        countdownsExpired = tryData["countdowns_expired"]
                        checks = checksData
                        comments = commentsData

                        for index_main, currentAnswers in enumerate(questionnaireAnswers):
                            questions = currentAnswers.keys()
                            for index_sub, question in enumerate(questions):
                                row[f"q_{questionnaires[index_main]['index']}_{question}_question"] = questionnaires[index_main]["questions"][index_sub]["text"]
                                row[f"q_{questionnaires[index_main]['index']}_{question}_value"] = currentAnswers[question]
                                if questionnaires[index_main]["type"] == "standard":
                                    row[f"q_{questionnaires[index_main]['index']}_{question}_answer"] = questionnaires[index_main]["questions"][index_sub]["answers"][int(currentAnswers[question])]
                                else:
                                    row[f"q_{questionnaires[index_main]['index']}_{question}_answer"] = np.nan
                                row[f"q_{questionnaires[index_main]['index']}_time_elapsed"] = round(timestampsElapsed[questionnaires[index_main]['index']], 2)
                                row[f"q_{questionnaires[index_main]['index']}_accesses"] = accesses[questionnaires[index_main]['index']]

                        for index, data in enumerate(countdownsStart):
                            row["doc_countdown_time_start"] = data

                        for index, data in enumerate(countdownsLeft):
                            row["doc_countdown_time_value"] = data['value']
                            row["doc_countdown_time_text"] = data['text']
                            row["doc_countdown_time_expired"] = countdownsExpired[index]

                        for index, currentAnswers in enumerate(documentAnswers):
                            currentAttributes = documents[index].keys()
                            for currentAttribute in currentAttributes:
                                row[f"doc_{currentAttribute}"] = documents[index][currentAttribute]
                            for dimension in dimensions:
                                if dimension['scale'] is not None:
                                    value = currentAnswers[f"{dimension['name']}_value"]
                                    if type(value) == str:
                                        value = value.strip()
                                        value = re.sub('\n', '', value)
                                    row[f"doc_{dimension['name']}_value"] = value
                                    if dimension["scale"]["type"] == "categorical":
                                        for mapping in dimension["scale"]['mapping']:
                                            label = mapping['label'].lower().split(" ")
                                            label = '-'.join([str(c) for c in label])
                                            if int(mapping['value']) == (int(value)):
                                                row[f"doc_{dimension['name']}_label"] = label
                                                row[f"doc_{dimension['name']}_index"] = mapping['index']
                                                row[f"doc_{dimension['name']}_description"] = mapping['description']
                                    else:
                                        row[f"doc_{dimension['name']}_value"] = np.nan
                                        row[f"doc_{dimension['name']}_label"] = np.nan
                                        row[f"doc_{dimension['name']}_index"] = np.nan
                                        row[f"doc_{dimension['name']}_description"] = np.nan
                                if dimension['justification']:
                                    justification = currentAnswers[f"{dimension['name']}_justification"].strip()
                                    justification = re.sub('\n', '', justification)
                                    row[f"doc_{dimension['name']}_justification"] = justification
                                else:
                                    row[f"doc_{dimension['name']}_justification"] = np.nan
                                if dimension['url']:
                                    row[f"doc_{dimension['name']}_url"] = currentAnswers[f"{dimension['name']}_url"]
                                else:
                                    row[f"doc_{dimension['name']}_url"] = np.nan

                            row["doc_accesses"] = accesses[index]

                            if timestampsElapsed[index + questionnaireAmount] is None:
                                row["doc_time_elapsed"] = np.nan
                            else:
                                row["doc_time_elapsed"] = round(timestampsElapsed[index + questionnaireAmount], 2)

                            try:
                                row["global_form_validity"] = checks['checks']["globalFormValidity"]
                                row["gold_checks"] = checks['checks']["goldChecks"]
                                row["time_check_amount"] = checks['checks']["timeCheckAmount"]
                                row["time_spent_check"] = checks['checks']["timeSpentCheck"]
                            except KeyError:
                                row["global_form_validity"] = True
                                row["gold_checks"] = [True]
                                row["time_check_amount"] = 3
                                row["time_spent_check"] = True

                            if "value" in comments:
                                if (comments['value']["comment"]) != "":
                                    row["comment"] = sanitize_string(comments['value']["comment"])
                                else:
                                    row["comment"] = np.nan
                            else:
                                row["comment"] = np.nan

                            df.loc[(workerIndex + index)] = row

            if len(df) > 0:
                dataframe.append(df)

    df = pd.concat(dataframe, ignore_index=True)
    empty_cols = [col for col in df.columns if df[col].isnull().all()]
    df.drop(empty_cols, axis=1, inplace=True)

    hit_df.columns = hit_df.columns.str.replace('[\W]', '', regex=True).str.replace('(?<!^)([A-Z])', r'_\1', regex=True).str.lower()
    hit_df = hit_df.add_prefix('mturk_', )
    hit_df.columns = [col.replace('h_i_t', 'hit') for col in hit_df.columns]
    hit_df.rename(columns={'mturk_worker_id': 'worker_id'}, inplace=True)

    df.worker_id = df.worker_id.astype(str)
    hit_df.worker_id = hit_df.worker_id.astype(str)

    res = df.merge(hit_df, on='worker_id')

    res.to_csv(dataframe_path, index=False)
    console.print(f"Dataframe serialized at path: [cyan on white]{dataframe_path}")

else:

    console.print(f"Dataframe [green]detected[/green], skipping creation")

console.rule("4 - Building [cyan on white]dimensions_analysis[/cyan on white] dataframe")

columns = [
    "worker_id",
    "worker_paid",
    "unit_id",
    'current_try',
    'document_index',
    'dimension_index',
    'dimension_name',
    'selection_index',
    'selection_value',
    'selection_label',
    'selection_timestamp',
    'selection_timestamp_elapsed',
    'document_statement'
]

dataframe = []
df = pd.read_csv(dataframe_path)
dim_df_path = f"{models_path}dimensions_analysis.csv"

if not os.path.exists(dim_df_path):

    console.print(f"Dataframe [yellow]not detected[/yellow], building it")

    for index, row in tqdm(df.iterrows(), total=df.shape[0]):

        dimDf = pd.DataFrame(columns=columns)
        indexUrl = 0

        workerId = row['worker_id']
        unit_id = row['unit_id']

        workerPaid = row['worker_paid']
        unitId = row['unit_id']
        task_path = f"{folder_result_path}Task/"
        data_path = f"{folder_result_path}Data/{workerId}/{unitId}/"

        task = load_json(f"{data_path}task_data.json")

        triesAmount = int(task['task']["tries_amount"])
        documentsAmount = int(task['task']['documents_amount'])
        questionnaireAmount = int(task['task']['questionnaire_amount'])
        dimensions = task['dimensions']

        currentTry = 0
        for aTry in range(0, triesAmount + 1):
            if os.path.exists(f"{data_path}data_try_{aTry + 1}.json"):
                currentTry = aTry + 1

                currentTryPath = f"{data_path}data_try_{currentTry}.json"

                if os.path.exists(currentTryPath):

                    tryData = load_json(currentTryPath)

                    timestampsStart = tryData["timestamps_start"]
                    dimensionsSelected = tryData["dimensions_selected"]

                    firstTimestamp = timestampsStart[questionnaireAmount - 1][0]

                    firstTimestampParsed = datetime.datetime.fromtimestamp(firstTimestamp)

                    foundTimestamps = [firstTimestampParsed]
                    counter = 0

                    for documentIndex, selectedDimensions in enumerate(dimensionsSelected):

                        for dimension in selectedDimensions['data']:

                            label = ""
                            for mapping in dimensions[dimension['dimension']]['scale']['mapping']:
                                if mapping['value'] == dimension['value']:
                                    label = mapping['label']

                            currentTimestamp = float(dimension['timestamp'])
                            currentTimestampParsed = datetime.datetime.fromtimestamp(currentTimestamp)
                            previousTimestampParsed = foundTimestamps[counter - 1]
                            elapsedTime = (currentTimestampParsed - previousTimestampParsed).total_seconds()
                            if elapsedTime < 0:
                                elapsedTime = (previousTimestampParsed - currentTimestampParsed).total_seconds()
                            foundTimestamps.append(currentTimestampParsed)
                            dimensionRow = {
                                'worker_id': workerId,
                                'worker_paid': workerPaid,
                                'unit_id': unitId,
                                'current_try': currentTry + 1,
                                'document_index': documentIndex,
                                'dimension_index': dimension['dimension'],
                                'dimension_name': dimensions[dimension['dimension']]['name'],
                                'selection_index': dimension['index'],
                                'selection_value': dimension['value'],
                                'selection_label': label,
                                'selection_timestamp': dimension['timestamp'],
                                'selection_timestamp_elapsed': elapsedTime,
                            }

                            dimDf = dimDf.append(dimensionRow, ignore_index=True)

        dataframe.append(dimDf)

    res = pd.concat(dataframe)
    res.to_csv(dim_df_path, index=False)
    console.print(f"Dataframe serialized at path: [cyan on white]{dim_df_path}")

else:

    console.print(f"Dataframe [green]detected[/green], skipping creation")

console.rule("4 - Checking missing HITs")

hits_missing = []
hits = load_json(f"result/{task_name}/Task/hits.json")
df = pd.read_csv(dataframe_path)
for hit in hits:
    unit_data = df.loc[df['unit_id'] == hit['unit_id']]
    if len(unit_data) <= 0:
        hits_missing.append(hit)

if len(hits_missing) > 0:
    console.print(f"Missing HITs: {len(hits_missing)}")
    path_missing = f"{models_path}hits_missing.json"
    with open(path_missing, 'w', encoding='utf-8') as f:
        json.dump(hits_missing, f, ensure_ascii=False, indent=4)
    console.print(f"Serialized at path: [cyan on white]{path_missing}")
else:
    console.print(f"There aren't missing HITS for task [cyan on white]{task_name}")
