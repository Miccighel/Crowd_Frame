#!/usr/bin/env python
# coding: utf-8
import json
import os
from glob import glob
import ipinfo
import re
import numpy as np
import random
import requests
import shutil
import textwrap
import time
from distutils.util import strtobool
from pathlib import Path
from shutil import copy2
import boto3
import pandas as pd
from botocore.exceptions import ClientError
from botocore.exceptions import ProfileNotFound
from dotenv import load_dotenv
from mako.template import Template
from IPython.display import display
from rich.console import Console
from rich.panel import Panel
from rich.progress import track
from tqdm import tqdm

pd.set_option('display.max_columns', None)

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
table_logging_name = f"Crowd_Frame-{task_name}_{batch_name}_Logger"
table_acl_name = f"Crowd_Frame-{task_name}_{batch_name}_ACL"

console.rule("0 - Initialization")

folder_result_path = f"result/{task_name}/{batch_name}/"
os.makedirs(folder_result_path, exist_ok=True)

boto_session = boto3.Session(profile_name='mturk-user')
mturk = boto_session.client('mturk', region_name='us-east-1')
boto_session = boto3.Session(profile_name='config-user')
s3 = boto_session.client('s3', region_name=aws_region)
s3_resource = boto_session.resource('s3')
bucket = s3_resource.Bucket(aws_private_bucket)

console.print("[bold]Download.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

console.rule("1 - Fetching HITs details")

hit_df = pd.DataFrame()
hit_data_path = f"{folder_result_path}batch_result.csv"

if not os.path.exists(hit_data_path):

    for item in tqdm(mturk.list_hits()['HITs']):

        row = {}

        hit_id = item['HITId']
        hit_status = mturk.get_hit(HITId=hit_id)['HIT']
        hit_status.pop('Question')
        hit_status.pop('QualificationRequirements')

        if hit_status['Title']=='Assessment of reviews':

            for hit_status_attribute, hit_status_value in hit_status.items():
                row[hit_status_attribute] = hit_status_value

            for hit_assignment in mturk.list_assignments_for_hit(HITId=hit_id)['Assignments']:

                hit_assignment.pop('Answer')

                for hit_assignment_attribute, hit_assignment_value in hit_assignment.items():
                    row[hit_assignment_attribute] = hit_assignment_value

                hit_df = hit_df.append(row, ignore_index=True)

    hit_df.to_csv(hit_data_path)

else:

    hit_df = pd.read_csv(hit_data_path)

console.rule("2 - Downloading task configuration")

prefix = f"{task_name}/{batch_name}/Task/"

for bucket_object in bucket.objects.filter(Prefix=prefix):
    task_config_folder = "/".join(bucket_object.key.split("/")[:-1])
    task_config_folder = f"result/{task_config_folder}/"
    if not os.path.exists(task_config_folder):
        os.makedirs(task_config_folder, exist_ok=True)
        file_name = bucket_object.key.split("/")[-1]
        s3.download_file(aws_private_bucket, bucket_object.key, f"{task_config_folder}{file_name}")

console.rule("3 - Downloading worker data")

boto_session = boto3.Session(profile_name='config-user')
s3 = boto_session.client('s3', region_name=aws_region)
s3_resource = boto_session.resource('s3')

bucket = s3_resource.Bucket(aws_private_bucket)

for worker_id in tqdm(hit_df['WorkerId']):

    prefix = f"{task_name}/{batch_name}/Data/{worker_id}/"

    for bucket_object in bucket.objects.filter(Prefix=prefix):
        unit_folder = "/".join(bucket_object.key.split("/")[:-1])
        unit_folder = f"result/{unit_folder}/"
        if not os.path.exists(unit_folder):
            os.makedirs(unit_folder, exist_ok=True)
            file_name = bucket_object.key.split("/")[-1]
            s3.download_file(aws_private_bucket, bucket_object.key, f"{unit_folder}{file_name}")


taskName = task_name
batchesFullPaths = glob(f"result/{taskName}/*")
batchesName = []
for batch_full_path in batchesFullPaths:
    batch_name = batch_full_path.split('\\')[-1]
    if "Models" not in batch_name:
        batchesName.append(batch_name)

ipInfoToken = "fa8ac3a2ed1ac4"
ipInfoHandler = ipinfo.getHandler(ipInfoToken)
userStackToken = "a5c31ecd7171e421ebe21df5c3ac040d"

resultPath = f"result/{taskName}/Models/"
ipFolder = f"{resultPath}worker-ip/"
uagFolder = f"{resultPath}worker-uag/"
os.makedirs(resultPath, exist_ok=True)
os.makedirs(ipFolder, exist_ok=True)
os.makedirs(uagFolder, exist_ok=True)

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
        x = re.sub(r'[^\w\s]','',x)
        x = re.sub(' [^0-9a-zA-Z]+', '', x)
        x = re.sub(' +', ' ', x)
        return x
    except TypeError:
        return np.nan
def sanitize_statement(x):
    try:
        x = re.sub(' +', ' ', x)
        x = x.replace("'", "")
        x = x.replace('"', '')
        x = x.replace('\n', '')
        x = x.rstrip()
        x = re.sub(r'[^\w\s]','',x)
        x = re.sub(' [^0-9a-zA-Z]+', '', x)
        x = re.sub(' +', ' ', x)
        return x
    except TypeError:
        return np.nan
def load_column_names(questionnaires, dimensions, documents):

    columns=[
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


paidWorkers = {}
spuriousWorkers = []
dataframe = []
batchResults = pd.DataFrame(columns=["HITId","HITTypeId","Title","Description","Keywords","Reward","CreationTime","MaxAssignments","RequesterAnnotation","AssignmentDurationInSeconds","AutoApprovalDelayInSeconds","Expiration","NumberOfSimilarHITs","LifetimeInSeconds","AssignmentId","WorkerId","AssignmentStatus","AcceptTime","SubmitTime","AutoApprovalTime","ApprovalTime","RejectionTime","RequesterFeedback","WorkTimeInSeconds","LifetimeApprovalRate","Last30DaysApprovalRate","Last7DaysApprovalRate","Input.token_input","Input.token_output","Answer.token_output","Approve","Reject"])

for batchName in batchesName:
    paidWorkers[batchName] = []
for batchName in batchesName:
    print(f"Processing batch {batchName}")
    path = f"result/{task_name}/{batchName}/"
    batchResult = pd.read_csv(f"{path}batch_result.csv")
    for index, currentBatchResult in batchResult.iterrows():

        workerFolderPath = f"{path}/Data/{currentBatchResult['WorkerId']}"
        hits = load_json(f"{path}Task/hits.json")

        units_paths = glob(f"{workerFolderPath}/*")
        units = []
        for unit_path in units_paths:
            unit_name = unit_path.split('\\')[-1]
            units.append(unit_name)

        paidWorkers[batchName].append(
            {
                "worker_id":currentBatchResult['WorkerId'],
                "unit_ids": units,
                "paid": True
            })
        batchResults = batchResults.append(currentBatchResult)
    print(f"Found {len(paidWorkers[batchName])} paid workers for batch {batchName}")


allWorkers = {}
for batchName in batchesName:
    unpaidWorkers = {}
    unpaidWorkers[batchName] = []
    allWorkers[batchName] = []
    for paidWorker in paidWorkers[batchName]:
        allWorkers[batchName].append(paidWorker)
    for unpaidWorker in unpaidWorkers[batchName]:
        allWorkers[batchName].append(unpaidWorker)

for batchName in batchesName:

    print(f"Processing batch {batchName}")
    path = f"result/{task_name}/{batchName}/"

    for workerIndex, worker in enumerate(tqdm(allWorkers[batchName])):

        workerId = worker['worker_id']
        workerUnits = worker['unit_ids']
        workerPaid = worker['paid']

        for unit_id in workerUnits:

            try:

                folder = f"{path}Data/{workerId}/{unit_id}/"
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

                ipFile = f"{ipFolder}{workerId}_ip.json"
                uagFile = f"{uagFolder}{workerId}_uag.json"

                taskName = task["task_id"]
                batchName = batchName
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

                currentTry=0
                for aTry in range(0, triesAmount+1):
                    if os.path.exists(f"{folder}data_try_{aTry+1}.json"):
                        currentTry=aTry+1

                        row["task_id"] = taskName
                        row["batch_name"] = batchName
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
                                    row[f"q_{questionnaires[index_main]['index']}_{question}_question"] =  questionnaires[index_main]["questions"][index_sub]["text"]
                                    row[f"q_{questionnaires[index_main]['index']}_{question}_value"] = currentAnswers[question]
                                    if questionnaires[index_main]["type"]=="standard":
                                        row[f"q_{questionnaires[index_main]['index']}_{question}_answer"] = questionnaires[index_main]["questions"][index_sub]["answers"][int(currentAnswers[question])]
                                    else:
                                         row[f"q_{questionnaires[index_main]['index']}_{question}_answer"] = np.nan
                                    row[f"q_{questionnaires[index_main]['index']}_time_elapsed"] = round(timestampsElapsed[questionnaires[index_main]['index']],2)
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
                                        value =  currentAnswers[f"{dimension['name']}_value"].strip()
                                        value = re.sub('\n','',value)
                                        row[f"doc_{dimension['name']}_value"] = value
                                        if dimension["scale"]["type"]=="categorical":
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
                                        justification =  currentAnswers[f"{dimension['name']}_justification"].strip()
                                        justification = re.sub('\n','',justification)
                                        row[f"doc_{dimension['name']}_justification"] = justification
                                    else:
                                        row[f"doc_{dimension['name']}_justification"] = np.nan
                                    if dimension['url']:
                                        row[f"doc_{dimension['name']}_url"] = currentAnswers[f"{dimension['name']}_url"]
                                    else:
                                        row[f"doc_{dimension['name']}_url"] = np.nan

                                row["doc_accesses"] = accesses[index]

                                if timestampsElapsed[index+questionnaireAmount] is None:
                                     row["doc_time_elapsed"] = np.nan
                                else:
                                    row["doc_time_elapsed"] = round(timestampsElapsed[index+questionnaireAmount],2)

                                row["global_form_validity"] = checks["globalFormValidity"]
                                row["gold_checks"] = checks["goldChecks"]
                                row["time_check_amount"] = checks["timeCheckAmount"]
                                row["time_spent_check"] = checks["timeSpentCheck"]

                                if "comment" in comments.keys():
                                    if(comments["comment"])!="":
                                        row["comment"] = sanitize_statement(comments["comment"])
                                    else:
                                        row["comment"] = np.nan
                                else:
                                    row["comment"] = np.nan

                                df.loc[(workerIndex+index)] = row

                if len(df)>0:
                    dataframe.append(df)
            except IndexError:
                print(workerId)
                continue

df = pd.concat(dataframe, ignore_index=True)
empty_cols = [col for col in df.columns if df[col].isnull().all()]
# Drop these columns from the dataframe
df.drop(empty_cols,axis=1,inplace=True)

df.to_csv(f"{resultPath}workers_data_{batchesName[0].lower()}.csv", index=False)

print(f"Dataframe serialized at path {resultPath}workers_data.csv")
