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
from dotenv import load_dotenv
from IPython.display import display
import datetime
from rich.console import Console
from tqdm import tqdm

console = Console()

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
        x = re.sub(' +', ' ', x)
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

folder_result_path = f"result/{task_name}/"
os.makedirs(folder_result_path, exist_ok=True)

boto_session = boto3.Session(profile_name='mturk-user')
mturk = boto_session.client('mturk', region_name='us-east-1')
boto_session = boto3.Session(profile_name='config-user')
s3 = boto_session.client('s3', region_name=aws_region)
s3_resource = boto_session.resource('s3')
bucket = s3_resource.Bucket(aws_private_bucket)
dynamo_db = boto3.client('dynamodb', region_name=aws_region)

console.print("[bold]Download.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

console.rule("1 - Fetching HITs")

console.print(f"Task: [cyan on white]{task_name}")

hit_data_path = f"result/{task_name}/Models/hits_data.csv"

next_token = ''
hit_counter = 0
token_counter = 0

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
                    hit_status.pop('Question')
                    hit_status.pop('QualificationRequirements')

                    for hit_status_attribute, hit_status_value in hit_status.items():
                        row[hit_status_attribute] = hit_status_value

                    hit_assignments = mturk.list_assignments_for_hit(HITId=hit_id, AssignmentStatuses=['Approved'])
                    for hit_assignment in hit_assignments['Assignments']:

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

def obj_last_modified(myobj):
    return myobj.last_modified

task_config_folder = f"{folder_result_path}/Task/"
if not os.path.exists(task_config_folder):
    os.makedirs(task_config_folder, exist_ok=True)
    for bucket_object in sorted(bucket.objects.filter(Prefix=prefix), key=obj_last_modified, reverse=False)[:8]:
        if "Task" in bucket_object.key:
            file_name = bucket_object.key.split("/")[-1]
            destination_path = f"{task_config_folder}{file_name}"
            if not os.path.exists(destination_path):
                console.print(f"Source: [cyan on white]{bucket_object.key}[/cyan on white], Destination: [cyan on white]{task_config_folder}{file_name}[/cyan on white]")
                s3.download_file(aws_private_bucket, bucket_object.key, f"{task_config_folder}{file_name}")
            else:
                console.print(f"Source: [cyan on white]{bucket_object.key}[/cyan on white] [yellow]already detected[/yellow], skipping download")
else:
    console.print(f"Task configuration [yellow]already detected[/yellow], skipping download")

console.rule("3 - Fetching worker data")

worker_counter = 0
worker_amount = len(np.unique(hit_df['WorkerId'].values))

with console.status(f"Workers Amount: {worker_amount}", spinner="aesthetic") as status:
    status.start()

    for worker_id in hit_df['WorkerId'].values:

        worker_folder = f"result/{task_name}/Data/{worker_id}/"

        dynamo_db_tables = dynamo_db.list_tables()['TableNames']
        task_tables = []
        for table_name in dynamo_db_tables:
            if task_name in table_name and 'Data' in table_name:
                task_tables.append(table_name)

        if not os.path.exists(worker_folder):

            status.update(f"Downloading worker data, Identifier: {worker_id}, Total: {worker_counter}/{worker_amount}")

            items = []

            for table_name in task_tables:
                if len(items)<=0:
                    response = dynamo_db.query(
                        TableName=table_name,
                        KeyConditionExpression="identifier = :worker",
                        ExpressionAttributeValues={
                            ":worker": {'S': worker_id}
                        }
                    )['Items']
                    items = response

            for element in items:

                sequence = element['sequence']['S'].split("-")
                data = json.loads(element['data']['S'])
                time = element['time']['S']

                worker_id = sequence[0]
                unit_id = sequence[1]
                current_try = sequence[2]
                sequence_number = sequence[3]

                unit_path = f"{worker_folder}{unit_id}/"

                os.makedirs(unit_path, exist_ok=True)

                if 'task' in data:
                    if 'documents_answers' in data:
                        serialize_json(unit_path, f"data_try_{current_try}.json", data)
                    else:
                        serialize_json(unit_path, "task_data.json", data)
                elif 'info' in data:
                    if 'questionnaire' in data['info']['element']:
                        index = data['info']['index']
                        access = data['info']['access']
                        serialize_json(unit_path, f"quest_{index}_try_{current_try}_acc_{access}_seq_{sequence_number}.json", data)
                    elif 'document' in data['info']['element']:
                        index = data['info']['index']
                        access = data['info']['access']
                        serialize_json(unit_path, f"doc_{index}_try_{current_try}_acc_{access}_seq_{sequence_number}.json", data)
                    else:
                        serialize_json(unit_path, f"comment_try_{current_try}.json", data)

                elif 'checks' in data:
                    serialize_json(unit_path, f'checks_try_{current_try}.json', data)
                else:
                    console.print(data)

        else:

            status.update(f"Worker data found, Identifier: {worker_id}, Total: {worker_counter}/{worker_amount}")

        worker_counter += 1

    console.print(f"Data fetching for {worker_counter} workers [green]completed")


console.rule("4 - Building results dataframe")

ipInfoHandler = ipinfo.getHandler(ipInfoToken)

models_path = f"result/{task_name}/Models/"
ip_folder = f"{models_path}worker-ip/"
uag_folder = f"{models_path}worker-uag/"
os.makedirs(models_path, exist_ok=True)
os.makedirs(ip_folder, exist_ok=True)
os.makedirs(uag_folder, exist_ok=True)

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

            if "cloudflareProperties" in worker.keys() and 'ip' in worker["cloudflareProperties"].keys():
                workerIp = worker['cloudflareProperties']['ip']
                if os.path.exists(ipFile):
                    decodedData = load_json(ipFile)
                else:
                    decodedData = ipInfoHandler.getDetails(workerIp).all
                    with open(ipFile, 'w', encoding='utf-8') as f:
                        json.dump(decodedData, f, ensure_ascii=False, indent=4)
                workerCity = decodedData['city']
                workerHostname = decodedData['hostname'] if "hostname" in decodedData else None
                workerRegion = decodedData['region']
                workerCountryCode = decodedData['country']
                workerCountryName = decodedData['country_name']
                workerLatitude = decodedData['latitude']
                workerLongitude = decodedData['longitude']
                workerPostal = decodedData['postal'] if "postal" in decodedData else None
                workerTimezone = decodedData['timezone']
                workerOrg = decodedData['org']
            else:
                workerIp = np.nan
                decodedData = np.nan
                workerCity = np.nan
                workerHostname = np.nan
                workerRegion = np.nan
                workerCountryCode = np.nan
                workerCountryName = np.nan
                workerLatitude = np.nan
                workerLongitude = np.nan
                workerPostal = np.nan
                workerTimezone = np.nan
                workerOrg = np.nan

            if "cloudflareProperties" in worker.keys() and 'uag' in worker["cloudflareProperties"].keys():
                workerUag = worker['cloudflareProperties']['uag']
                url = f"http://api.userstack.com/detect?access_key={userStackToken}&ua={workerUag}"
                if os.path.exists(uagFile):
                    uaData = load_json(uagFile)
                else:
                    uaData = requests.get(url).json()
                    with open(uagFile, 'w', encoding='utf-8') as f:
                        json.dump(uaData, f, ensure_ascii=False, indent=4)
                uaType = uaData["type"]
                uaBrand = uaData["brand"]
                uaName = uaData["name"]
                uaUrl = uaData["url"]
                osName = uaData["os"]["name"]
                osCode = uaData["os"]["code"]
                osUrl = uaData["os"]["url"]
                osFamily = uaData["os"]["family"]
                osFamilyCode = uaData["os"]["family_code"]
                osFamilyVendor = uaData["os"]["family_vendor"]
                osIcon = uaData["os"]["icon"]
                osIconLarge = uaData["os"]["icon_large"]
                deviceIsMobile = uaData["device"]["is_mobile_device"]
                deviceType = uaData["device"]["type"]
                deviceBrand = uaData["device"]["brand"]
                deviceBrandCode = uaData["device"]["brand_code"]
                deviceBrandUrl = uaData["device"]["brand_url"]
                deviceName = uaData["device"]["name"]
                browserName = uaData["browser"]["name"]
                browserVersion = uaData["browser"]["version"]
                browserVersionMajor = uaData["browser"]["version_major"]
                browserEngine = uaData["browser"]["engine"]
            else:
                workerUag = np.nan
                uaType = np.nan
                uaBrand = np.nan
                uaName = np.nan
                uaUrl = np.nan
                osName = np.nan
                osCode = np.nan
                osUrl = np.nan
                osFamily = np.nan
                osFamilyCode = np.nan
                osFamilyVendor = np.nan
                osIcon = np.nan
                osIconLarge = np.nan
                deviceIsMobile = np.nan
                deviceType = np.nan
                deviceBrand = np.nan
                deviceBrandCode = np.nan
                deviceBrandUrl = np.nan
                deviceName = np.nan
                browserName = np.nan
                browserVersion = np.nan
                browserVersionMajor = np.nan
                browserEngine = np.nan

            currentTry = 0
            for aTry in range(0, triesAmount + 1):
                if os.path.exists(f"{folder}data_try_{aTry + 1}.json"):
                    currentTry = aTry + 1

                    row["task_id"] = task_name
                    row["batch_name"] = batch_name_current
                    row["worker_id"] = workerId
                    row["worker_paid"] = workerPaid
                    row["worker_ip"] = workerIp
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
                                if (currentAttribute == 'product_title'):
                                    row[f"doc_{currentAttribute}"] = sanitize_string(documents[index][currentAttribute])
                                else:
                                    row[f"doc_{currentAttribute}"] = documents[index][currentAttribute]
                            for dimension in dimensions:
                                if dimension['scale'] is not None:
                                    value = currentAnswers[f"{dimension['name']}_value"].strip()
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
    hit_df = hit_df.add_prefix('mturk_',)
    hit_df.columns = [col.replace('h_i_t', 'hit') for col in hit_df.columns]
    hit_df.rename(columns={'mturk_worker_id':'worker_id'}, inplace=True)

    df.worker_id = df.worker_id.astype(str)
    hit_df.worker_id = hit_df.worker_id.astype(str)

    res = df.merge(hit_df, on='worker_id')

    res.to_csv(dataframe_path, index=False)
    console.print(f"Dataframe serialized at path: [cyan on white]{dataframe_path}")

else:

    console.print(f"Dataframe [green]detected[/green], skipping creation")


console.rule("4 - Building [cyan on white]dimensions_analysis[/cyan on white] dataframe")

columns=[
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

        dimDf=pd.DataFrame(columns=columns)
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

                    firstTimestamp = timestampsStart[questionnaireAmount-1][0]

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
                            previousTimestampParsed = foundTimestamps[counter-1]
                            elapsedTime = (currentTimestampParsed - previousTimestampParsed).total_seconds()
                            if elapsedTime<0:
                                elapsedTime = (previousTimestampParsed - currentTimestampParsed).total_seconds()
                            foundTimestamps.append(currentTimestampParsed)
                            dimensionRow = {
                                'worker_id': workerId,
                                'worker_paid': workerPaid,
                                'unit_id': unitId,
                                'current_try': currentTry+1,
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
