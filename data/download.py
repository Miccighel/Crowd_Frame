#!/usr/bin/env python
# coding: utf-8

import json
import os
import shutil
from glob import glob
import ipinfo
import re
import ipapi
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
import collections
import warnings

pd.set_option('display.max_columns', None)

warnings.simplefilter(action='ignore', category=FutureWarning)
warnings.simplefilter(action='ignore', category=pd.errors.PerformanceWarning)

console = Console()
pp = pprint.PrettyPrinter(indent=4)

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

mail_contact = os.getenv('mail_contact')
profile_name = os.getenv('profile_name')
task_name = os.getenv('task_name')
batch_name = os.getenv('batch_name')
batch_prefix = os.getenv('batch_prefix')
admin_user = os.getenv('admin_user')
admin_password = os.getenv('admin_password')
deploy_config = os.getenv('deploy_config')
server_config = os.getenv('server_config')
deploy_config = strtobool(deploy_config) if deploy_config is not None else False
aws_region = os.getenv('aws_region')
aws_private_bucket = os.getenv('aws_private_bucket')
aws_deploy_bucket = os.getenv('aws_deploy_bucket')
prolific_completion_code = os.getenv('prolific_completion_code')
budget_limit = os.getenv('budget_limit')
bing_api_key = os.getenv('bing_api_key')
ip_info_token = os.getenv('ip_info_token')
ip_geolocation_api_key = os.getenv('ip_geolocation_api_key')
ip_api_api_key = os.getenv('ip_api_api_key')
user_stack_token = os.getenv('user_stack_token')
fake_json_token = os.getenv('fake_json_token')
debug_mode = os.getenv('debug_mode')

folder_result_path = f"result/{task_name}/"
models_path = f"result/{task_name}/Dataframe/"
resources_path = f"result/{task_name}/Resources/"
data_path = f"result/{task_name}/Data/"
df_log_partial_folder_path = f"{models_path}Logs-Partial/"
task_config_folder = f"{folder_result_path}/Task/"
df_mturk_data_path = f"{models_path}workers_mturk_data.csv"
df_acl_path = f"{models_path}workers_acl.csv"
df_info_path = f"{models_path}workers_info.csv"
df_log_path = f"{models_path}workers_logs.csv"
df_quest_path = f"{models_path}workers_questionnaire.csv"
df_comm_path = f"{models_path}workers_comments.csv"
df_data_path = f"{models_path}workers_answers.csv"
df_dim_path = f"{models_path}workers_dimensions_selection.csv"
df_url_path = f"{models_path}workers_urls.csv"


def serialize_json(folder, filename, data):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    with open(f"{folder}{filename}", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, default=str, separators=(',', ':'))
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


def flatten(d, parent_key='', sep='_'):
    items = []
    for k, v in d.items():
        new_key = parent_key + sep + k if parent_key else k
        if isinstance(v, collections.abc.MutableMapping):
            items.extend(flatten(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


console.rule("0 - Initialization")

os.chdir("../data/")

console.print("[bold]Download.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

os.makedirs(folder_result_path, exist_ok=True)
os.makedirs(models_path, exist_ok=True)
os.makedirs(resources_path, exist_ok=True)
os.makedirs(data_path, exist_ok=True)

if profile_name is None:
    profile_name = 'default'

boto_session = boto3.Session(profile_name='mturk-user')
mturk = boto_session.client('mturk', region_name='us-east-1')
boto_session = boto3.Session(profile_name='config-user')
s3 = boto_session.client('s3', region_name=aws_region)
s3_resource = boto_session.resource('s3')
bucket = s3_resource.Bucket(aws_private_bucket)
boto_session = boto3.Session(profile_name=profile_name)
dynamo_db = boto_session.client('dynamodb', region_name=aws_region)
dynamo_db_resource = boto3.resource('dynamodb', region_name=aws_region)

if batch_prefix is None:
    batch_prefix = ''

next_token = ''
hit_counter = 0
token_counter = 0

task_data_tables = []
task_log_tables = []
task_acl_tables = []
task_batch_names = []

dynamo_db_tables = dynamo_db.list_tables()['TableNames']
for table_name in dynamo_db_tables:
    if task_name in table_name and 'Data' in table_name and batch_prefix in table_name:
        task_data_tables.append(table_name)
    if task_name in table_name and 'Logger' in table_name and batch_prefix in table_name:
        task_log_tables.append(table_name)
    if task_name in table_name and 'ACL' in table_name and batch_prefix in table_name:
        task_acl_tables.append(table_name)

response = s3.list_objects(Bucket=aws_private_bucket, Prefix=f"{task_name}/", Delimiter='/')
for path in response['CommonPrefixes']:
    current_batch_name = path.get('Prefix').split("/")[1]
    if batch_prefix in current_batch_name:
        task_batch_names.append(current_batch_name)

console.print(f"Batch names: [white on black]{', '.join(task_batch_names)}")
console.print(f"Tables data: [white on black]{', '.join(task_data_tables)}")
console.print(f"Tables log: [white on black]{', '.join(task_log_tables)}")
console.print(f"Tables ACL: [white on black]{', '.join(task_acl_tables)}")

if not prolific_completion_code:

    console.rule("1 - Fetching MTurk Data")

    with console.status(f"Downloading HITs, Token: {next_token}, Total: {token_counter}", spinner="aesthetic") as status:
        status.start()

        if not os.path.exists(df_mturk_data_path):

            console.print(f"[yellow]HITs data[/yellow] file not detected, creating it.")
            hit_df = pd.DataFrame(columns=[
                "HITId", "HITTypeId", "Title", "Description", "Keywords", "Reward", "CreationTime", "MaxAssignments",
                "RequesterAnnotation", "AssignmentDurationInSeconds", "AutoApprovalDelayInSeconds", "Expiration",
                "NumberOfSimilarHITs", "LifetimeInSeconds", "AssignmentId", "WorkerId", "AssignmentStatus", "AcceptTime",
                "SubmitTime", "AutoApprovalTime", "ApprovalTime", "RejectionTime", "RequesterFeedback", "WorkTimeInSeconds",
                "LifetimeApprovalRate", "Last30DaysApprovalRate", "Last7DaysApprovalRate"
            ])

            while next_token != '' or next_token is not None:

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
                    hit_df.to_csv(df_mturk_data_path, index=False)
                except KeyError:
                    console.print(f"Found tokens: {token_counter}, HITs: {hit_counter}")
                    break
        else:
            hit_df = pd.read_csv(df_mturk_data_path)

console.print(f"HITs data available at path: [cyan on white]{df_mturk_data_path}")

console.rule(f"2 - Fetching [green]{task_name}[/green] Configuration")

prefix = f"{task_name}/"
for current_batch_name in task_batch_names:
    if not os.path.exists(f"{task_config_folder}{current_batch_name}/"):
        response_batch = s3.list_objects(Bucket=aws_private_bucket, Prefix=f"{prefix}{current_batch_name}/Task/", Delimiter='/')
        os.makedirs(f"{task_config_folder}{current_batch_name}/", exist_ok=True)
        for path_batch in response_batch['Contents']:
            file_key = path_batch['Key']
            file_name = file_key.split('/')[-1]
            destination_path = f"{task_config_folder}{current_batch_name}/{file_name}"
            if not os.path.exists(destination_path):
                console.print(f"Source: [cyan on white]{file_key}[/cyan on white], Destination: [cyan on white]{destination_path}[/cyan on white]")
                s3.download_file(aws_private_bucket, file_key, f"{destination_path}")
            else:
                console.print(f"Source: [cyan on white]{file_key}[/cyan on white] [yellow]already detected[/yellow], skipping download")
    else:
        console.print(f"Task configuration for batch [green]{current_batch_name}[/green] [yellow]already detected[/yellow], skipping download")

console.rule("3 - Fetching Workers Snapshots")

worker_identifiers = []
paginator = dynamo_db.get_paginator('scan')
for table_acl in task_acl_tables:
    for page in paginator.paginate(TableName=table_acl, Select='ALL_ATTRIBUTES'):
        for item in page['Items']:
            worker_id = item['identifier']['S']
            if worker_id not in worker_identifiers:
                worker_identifiers.append(worker_id)
console.print(f"Unique worker identifiers found: [green]{len(worker_identifiers)}")

worker_counter = 0

with console.status(f"Workers Amount: {len(worker_identifiers)}", spinner="aesthetic") as status:
    status.start()

    for worker_id in worker_identifiers:

        worker_snapshot = []
        worker_snapshot_path = f"result/{task_name}/Data/{worker_id}.json"
        worker_folder_s3 = f"{aws_private_bucket}/{task_name}/Data/{worker_id}/"

        status.update(f"Downloading worker data, Identifier: {worker_id}, Total: {worker_counter}/{len(worker_identifiers)}")

        if not os.path.exists(worker_snapshot_path):

            worker_data = {}
            for table_name in task_data_tables:
                worker_data[table_name] = []
            for table_name in task_data_tables:
                paginator = dynamo_db.get_paginator('query')
                for page in paginator.paginate(
                    TableName=table_name,
                    KeyConditionExpression="identifier = :worker",
                    ExpressionAttributeValues={
                        ":worker": {'S': worker_id}
                    }, Select='ALL_ATTRIBUTES'
                ):
                    for item in page['Items']:
                        worker_data[table_name].append(item)

            worker_snapshot = []

            for data_source, worker_session in worker_data.items():

                table_base_name = "_".join(data_source.split("_")[:-1])

                acl_data_source = None
                for table_name in task_acl_tables:
                    if table_base_name in table_name:
                        acl_data_source = table_name
                log_data_source = None
                for table_name in task_log_tables:
                    if table_base_name in table_name:
                        log_data_source = table_name

                snapshot = {
                    "source_data": data_source,
                    "source_acl": acl_data_source,
                    "source_log": log_data_source,
                    "source_path": worker_snapshot_path,
                    "task": {
                        "worker_id": worker_id,
                        "try_last": 0,
                    },
                    "checks": [],
                    "dimensions": {},
                    "data_partial": {
                        "questionnaires_answers": [],
                        "documents_answers": []
                    },
                    "comments": [],
                    "documents": {},
                    "questionnaires": {},
                    "logs": [],
                }

                for element in worker_session:

                    sequence = element['sequence']['S'].split("-")
                    data = json.loads(element['data']['S'])
                    time = element['time']['S']

                    worker_id = sequence[0]
                    unit_id = sequence[1]
                    current_try = sequence[2]
                    snapshot['task']['try_last'] = max(int(snapshot['task']['try_last']), int(current_try))

                    if data:

                        if data['info']['element'] == 'data':
                            for attribute, value in data['task'].items():
                                snapshot['task'][attribute] = value
                            snapshot['dimensions'] = data.pop('dimensions')
                            snapshot['documents'] = data.pop('documents')
                            snapshot['questionnaires'] = data.pop('questionnaires')
                            snapshot['worker'] = data.pop('worker')
                        elif data['info']['element'] == 'document':
                            snapshot['data_partial']['documents_answers'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        elif data['info']['element'] == 'questionnaire':
                            snapshot['data_partial']['questionnaires_answers'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        elif data['info']['element'] == 'checks':
                            snapshot['checks'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        elif data['info']['element'] == 'comment':
                            snapshot['comments'].append({
                                "time_submit": time,
                                "serialization": data
                            })
                        else:
                            print(data)
                            assert False

                if log_data_source:
                    paginator = dynamo_db.get_paginator('query')
                    for page in paginator.paginate(
                        TableName=log_data_source,
                        KeyConditionExpression="worker = :worker",
                        ExpressionAttributeValues={
                            ":worker": {'S': worker_id}
                        }, Select='ALL_ATTRIBUTES'
                    ):
                        for item in page['Items']:
                            data = {
                                'worker': item['worker']['S'],
                                'task': item['task']['S'],
                                'batch': item['batch']['S'],
                                'unit_id': item['unitId']['S'] if 'unitId' in item else None,
                                'sequence': item['sequence']['S'].split("_")[1],
                                'type': item['type']['S'],
                                'time_server': item['server_time']['N'],
                                'time_client': item['client_time']['N'],
                                'details': json.loads(item['details']['S']) if 'S' in item['details'] else None
                            }
                            snapshot['logs'].append(data)

                if len(snapshot['data_partial']['documents_answers']) > 0 or len(snapshot['data_partial']['questionnaires_answers']) > 0:
                    worker_snapshot.append(snapshot)

            with open(worker_snapshot_path, 'w', encoding='utf-8') as f:
                json.dump(worker_snapshot, f, ensure_ascii=False, separators=(',', ':'))

        worker_counter += 1

    if worker_counter > 0:
        console.print(f"Data fetching for {worker_counter} workers [green]completed")

workers_snapshot_paths = glob(f"{data_path}/*")

console.print(f"Workers Snapshots serialized at path: [cyan on white]{data_path}")

console.rule("4 - Fetching Workers ACL")

if not os.path.exists(df_acl_path):

    df_acl = pd.DataFrame()

    for worker_id in tqdm(worker_identifiers):

        worker_snapshot_path = None

        for snapshot_path in workers_snapshot_paths:
            if worker_id in snapshot_path:
                worker_snapshot_path = snapshot_path

        for table_acl in task_acl_tables:

            acl_presence = False

            row = {'worker_id': worker_id}

            paginator = dynamo_db.get_paginator('query')
            for page in paginator.paginate(
                TableName=table_acl,
                KeyConditionExpression="identifier = :worker",
                ExpressionAttributeValues={
                    ":worker": {'S': worker_id},
                }, Select='ALL_ATTRIBUTES'
            ):
                if len(page['Items']) > 0:
                    acl_presence = True
                    for item in page['Items']:
                        for attribute, value in item.items():
                            if attribute != 'identifier':
                                value = value['S']
                                if 'false' in value or 'true' in value:
                                    value = bool(strtobool(value))
                                row[attribute] = value

            if acl_presence and worker_snapshot_path:
                worker_snapshots = load_json(worker_snapshot_path)
                for worker_snapshot in worker_snapshots:
                    task = worker_snapshot['task']
                    if task['task_id'] == row['task_name'] and task['batch_name'] == row['batch_name']:
                        row['source_acl'] = worker_snapshot['source_acl']
                        row['source_data'] = worker_snapshot['source_data']
                        row['source_log'] = worker_snapshot['source_log']
                        row['source_path'] = worker_snapshot['source_path']
                        for attribute, value in task.items():
                            if attribute != 'settings' and attribute != 'logger_server_endpoint' and attribute != 'messages':
                                row[attribute] = value

            if acl_presence:
                df_acl = df_acl.append(row, ignore_index=True)

    if len(df_acl) > 0:
        df_acl.to_csv(df_acl_path, index=False)
        console.print(f"Dataframe shape: {df_acl.shape}")
        console.print(f"Workers info dataframe serialized at path: [cyan on white]{df_acl_path}")

else:
    df_acl = pd.read_csv(df_acl_path)
    console.print(f"Workers ACL [yellow]already detected[/yellow], skipping download")

console.rule("5 - Building [cyan on white]workers_info[/cyan on white] Dataframe")


def fetch_uag_data(worker_id, worker_uag):
    data = {}
    if worker_uag:
        uag_file = f"{resources_path}{worker_id}_uag.json"
        if os.path.exists(uag_file):
            ua_data = load_json(uag_file)
        else:
            ua_data = {}
            if user_stack_token:
                url = f"http://api.userstack.com/detect?access_key={user_stack_token}&ua={worker_uag}"
                data_fetched = flatten(requests.get(url).json())
                ua_data = data_fetched | ua_data
                temp = {val: key for key, val in ua_data.items()}
                ua_data = {val: key for key, val in temp.items()}
            if ip_geolocation_api_key:
                url = f"https://api.ipgeolocation.io/user-agent?apiKey={ip_geolocation_api_key}"
                data_fetched = flatten(requests.get(url, headers={'User-Agent': worker_uag}).json())
                ua_data = data_fetched | ua_data
                temp = {val: key for key, val in ua_data.items()}
                ua_data = {val: key for key, val in temp.items()}
            with open(uag_file, 'w', encoding='utf-8') as f:
                json.dump(ua_data, f, ensure_ascii=False, indent=4)
        for attribute, value in ua_data.items():
            if type(value) == dict:
                for attribute_sub, value_sub in value.items():
                    data[f"{attribute}_{attribute_sub}"] = value_sub
            else:
                data[attribute] = value
    return data


def fetch_ip_data(worker_id, worker_ip):
    data = {}
    if worker_ip:
        ip_file = f"{resources_path}{worker_id}_ip.json"
        if os.path.exists(ip_file):
            ip_data = load_json(ip_file)
        else:
            ip_data = {}
            if ip_info_token:
                ip_info_handler = ipinfo.getHandler(ip_info_token)
                data_fetched = ip_info_handler.getDetails(worker_ip).all
                ip_data = data_fetched | ip_data
                temp = {val: key for key, val in ip_data.items()}
                ip_data = {val: key for key, val in temp.items()}
            if ip_geolocation_api_key:
                url = f"https://api.ipgeolocation.io/ipgeo?apiKey={ip_geolocation_api_key}&ip={worker_ip}"
                data_fetched = flatten(requests.get(url).json())
                ip_data = data_fetched | ip_data
                temp = {val: key for key, val in ip_data.items()}
                ip_data = {val: key for key, val in temp.items()}
                url = f"https://api.ipgeolocation.io/timezone?apiKey={ip_geolocation_api_key}&ip={worker_ip}"
                data_fetched = flatten(requests.get(url).json())
                ip_data = data_fetched | ip_data
                temp = {val: key for key, val in ip_data.items()}
                ip_data = {val: key for key, val in temp.items()}
                url = f"https://api.ipgeolocation.io/astronomy?apiKey={ip_geolocation_api_key}&ip={worker_ip}"
                data_fetched = flatten(requests.get(url).json())
                ip_data = data_fetched | ip_data
                temp = {val: key for key, val in ip_data.items()}
                ip_data = {val: key for key, val in temp.items()}
            if ip_api_api_key:
                url = f"http://api.ipapi.com/{worker_ip}?access_key={ip_api_api_key}"
                data_fetched = flatten(requests.get(url).json())
                if 'location_languages' in data_fetched:
                    location_languages = data_fetched.pop('location_languages')
                    for index, lang_data in enumerate(location_languages):
                        for key, value in lang_data.items():
                            ip_data[f"location_language_{index}_{key}"] = value
                ip_data = data_fetched | ip_data
                temp = {val: key for key, val in ip_data.items()}
                ip_data = {val: key for key, val in temp.items()}
            with open(ip_file, 'w', encoding='utf-8') as f:
                json.dump(ip_data, f, ensure_ascii=False, indent=4)
        for attribute, value in ip_data.items():
            data[attribute] = value
    return data


def find_snapshot_for_record(acl_record):
    if acl_record['source_path'] is not np.nan:
        snapshots = load_json(acl_record['source_path'])
        for snapshot in snapshots:
            if 'task' in snapshot:
                if snapshot['task']['worker_id'] == acl_record['worker_id'] and \
                    snapshot['task']['task_id'] == acl_record['task_name'] and \
                    snapshot['task']['batch_name'] == acl_record['batch_name'] and \
                    snapshot['task']['unit_id'] == acl_record['unit_id']:
                    return snapshot
    return {}


def find_snapshost_for_task(acl_record):
    snapshots_found = []
    if acl_record['source_path'] is not np.nan:
        snapshots = load_json(acl_record['source_path'])
        for snapshot in snapshots:
            if 'task' in snapshot:
                if snapshot['task']['worker_id'] == acl_record['worker_id'] and \
                    snapshot['task']['task_id'] == acl_record['task_name']:
                    snapshots_found.append(snapshot)
        return snapshots_found
    return []


def update_local_snapshot(acl_record, snapshot):
    if acl_record['source_path'] is not np.nan:
        snapshots = load_json(acl_record['source_path'])
        position = None
        for index, snapshot_candidate in enumerate(snapshots):
            if snapshot['task']['worker_id'] == snapshot_candidate['task']['worker_id'] and \
                snapshot['task']['task_id'] == snapshot_candidate['task']['task_id'] and \
                snapshot['task']['batch_name'] == snapshot_candidate['task']['batch_name'] and \
                snapshot['task']['unit_id'] == snapshot_candidate['task']['unit_id']:
                position = index
        if position:
            snapshots[position] = snapshot
            with open(snapshot['source_path'], 'w', encoding='utf-8') as f:
                json.dump(snapshot, f, ensure_ascii=False)


if not os.path.exists(df_info_path):

    df_info = pd.DataFrame()

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        snapshot = find_snapshot_for_record(acl_record)

        snapshot['uag'] = {}
        snapshot['ip'] = {}

        snapshot['uag'].update(fetch_uag_data(worker_id, acl_record['user_agent']))
        snapshot['ip'].update(fetch_ip_data(worker_id, acl_record['ip_address']))

        temp = {val: key for key, val in snapshot['ip'].items()}
        snapshot['ip'] = {val: key for key, val in temp.items()}
        temp = {val: key for key, val in snapshot['uag'].items()}
        snapshot['uag'] = {val: key for key, val in temp.items()}

        update_local_snapshot(acl_record, snapshot)

        row = {
            'worker_id': worker_id,
            'paid': acl_record['paid'],
            'task_name': acl_record['task_name'],
            'batch_name': acl_record['batch_name'],
            'unit_id': acl_record['unit_id'],
        }

        if 'worker' in snapshot:
            for attribute, value in snapshot['worker']['propertiesFetched'].items():
                row[attribute] = value
        for attribute, value in snapshot['ip'].items():
            row[f"ip_{attribute}"] = value
        for attribute, value in snapshot['uag'].items():
            row[f"uag_{attribute}"] = value

        df_info = df_info.append(row, ignore_index=True)

    if len(df_info) > 0:
        df_info.to_csv(df_info_path, index=False)
        console.print(f"Dataframe shape: {df_info.shape}")
        console.print(f"Workers info dataframe serialized at path: [cyan on white]{df_info_path}")
else:
    console.print(f"Workers info dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_info_path}")

console.rule("6 - Building [cyan on white]workers_logs[/cyan on white] Dataframe")

column_names = [
    "worker_id",
    "paid",
    "batch_name",
    "unit_id",
    "task_started",
    "sequence",
    "type",
    "time_server",
    "time_client",
]
counter = 0

if not os.path.exists(df_log_path):

    os.makedirs(df_log_partial_folder_path, exist_ok=True)

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        snapshots = find_snapshost_for_task(acl_record)

        log_df_partial_path = f"{df_log_partial_folder_path}{worker_id}.csv"

        if not os.path.exists(log_df_partial_path):

            dataframe = pd.DataFrame(columns=column_names)

            for snapshot in snapshots:

                if 'logs' in snapshot:

                    logs = snapshot['logs']

                    if len(logs) > 0:

                        task = snapshot['task']
                        task_started = False

                        if len(snapshot['data_partial']['documents_answers']) or len(snapshot['data_partial']['questionnaires_answers']) > 0:
                            task_started = True

                        for data_log in logs:

                            row = {
                                'worker_id': worker_id,
                                'paid': acl_record['paid'],
                                'task_name': data_log['task'],
                                'batch_name': data_log['batch'],
                                'unit_id': data_log['unit_id'],
                                'task_started': task_started,
                                'sequence': data_log['sequence'],
                                'time_server': data_log['time_server'],
                                'time_client': data_log['time_client'],
                                'type': data_log['type'],
                            }

                            log_details = data_log['details']

                            if data_log['type'] == 'keySequence':
                                if 'section' not in dataframe.columns:
                                    dataframe['section'] = np.nan
                                if 'key_sequence_index' not in dataframe.columns:
                                    dataframe['key_sequence_index'] = np.nan
                                if 'key_sequence_timestamp' not in dataframe.columns:
                                    dataframe['key_sequence_timestamp'] = np.nan
                                if 'key_sequence_key' not in dataframe.columns:
                                    dataframe['key_sequence_key'] = np.nan
                                if 'sentence' not in dataframe.columns:
                                    dataframe['sentence'] = np.nan
                                row['section'] = log_details['section']
                                row['sentence'] = log_details['sentence']
                                for index, key_sequence in enumerate(log_details['keySequence']):
                                    row['key_sequence_index'] = index
                                    row['key_sequence_timestamp'] = key_sequence['timeStamp']
                                    row['key_sequence_key'] = key_sequence['key'] if 'key' in key_sequence else np.nan
                                    dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'movements':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    attribute_parsed = f"{attribute_parsed}"
                                    if type(value) != dict and type(value) != list:
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        row[attribute_parsed] = value
                                for movement_data in log_details['points']:
                                    for attribute, value in movement_data.items():
                                        attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                        if type(value) == dict:
                                            for attribute_sub, value_sub in value.items():
                                                attribute_sub_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute_sub).lower()
                                                attribute_sub_parsed = f"point_{attribute_parsed}_{attribute_sub_parsed}"
                                                if attribute_sub_parsed not in dataframe.columns:
                                                    dataframe[attribute_sub_parsed] = np.nan
                                                row[attribute_sub_parsed] = value_sub
                                        else:
                                            attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                            attribute_parsed = f"point_{attribute_parsed}"
                                            if attribute_parsed not in dataframe.columns:
                                                dataframe[attribute_parsed] = np.nan
                                            row[attribute_parsed] = value
                                    dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'click':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    attribute_parsed = f"{attribute_parsed}"
                                    if type(value) != dict and type(value) != list:
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        row[attribute_parsed] = value
                                for attribute, value in log_details['target'].items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    attribute_parsed = f"target_{attribute_parsed}"
                                    if attribute_parsed not in dataframe.columns:
                                        dataframe[attribute_parsed] = np.nan
                                    row[attribute_parsed] = value
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'queryResults':
                                if 'section' not in dataframe.columns:
                                    dataframe['section'] = np.nan
                                if 'url_amount' not in dataframe.columns:
                                    dataframe['url_amount'] = np.nan
                                row['section'] = log_details['section']
                                row['url_amount'] = log_details['urlAmount']
                            elif data_log['type'] == 'copy' or data_log['type'] == 'cut':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    if attribute_parsed not in dataframe.columns:
                                        dataframe[attribute_parsed] = np.nan
                                    if attribute_parsed == 'target':
                                        row[attribute_parsed] = value.replace("\n", '')
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'context':
                                for detail_kind, detail_val in log_details.items():
                                    detail_kind_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', detail_kind).lower()
                                    if detail_kind_parsed not in dataframe.columns:
                                        dataframe[detail_kind_parsed] = np.nan
                                    if type(detail_val) == str:
                                        detail_val.replace('\n', '')
                                    row[detail_kind_parsed] = detail_val
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'init' or \
                                data_log['type'] == 'window_blur' or \
                                data_log['type'] == 'window_focus' or \
                                data_log['type'] == 'resize' or \
                                data_log['type'] == 'button' or \
                                data_log['type'] == 'unload' or \
                                data_log['type'] == 'shortcut' or \
                                data_log['type'] == 'radioChange' or \
                                data_log['type'] == 'scroll':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    if attribute_parsed not in dataframe.columns:
                                        dataframe[attribute_parsed] = np.nan
                                    row[attribute_parsed] = value
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'selection':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    if attribute_parsed not in dataframe.columns:
                                        dataframe[attribute_parsed] = np.nan
                                    if attribute_parsed == 'selected':
                                        row[attribute_parsed] = value.replace("\n", '')
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'paste' or data_log['type'] == 'text':
                                for attribute, value in log_details.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    if attribute_parsed not in dataframe.columns:
                                        dataframe[attribute_parsed] = np.nan
                                    if attribute_parsed == 'text':
                                        row[attribute_parsed] = value.replace("\n", '')
                                dataframe.loc[len(dataframe)] = row
                            elif data_log['type'] == 'query':
                                if 'section' not in dataframe.columns:
                                    dataframe['section'] = np.nan
                                if 'query' not in dataframe.columns:
                                    dataframe['query'] = np.nan
                                row['section'] = log_details['section']
                                row['query'] = log_details['query'].replace("\n", '')
                                dataframe.loc[len(dataframe)] = row
                            else:
                                print(data_log['type'])
                                print(log_details)
                                assert False

                    if len(dataframe) > 0:
                        dataframe.to_csv(log_df_partial_path, index=False)

    dataframes_partial = []
    df_partials_paths = glob(f"{df_log_partial_folder_path}/*")

    console.print(f"Merging together {len(df_partials_paths)} partial log dataframes")

    for df_partial_path in tqdm(df_partials_paths):
        partial_df = pd.read_csv(df_partial_path)
        if partial_df.shape[0] > 0:
            dataframes_partial.append(partial_df)
    if len(dataframes_partial) > 0:
        dataframe = pd.concat(dataframes_partial, ignore_index=True)
        dataframe.sort_values(by=['worker_id', 'sequence'], ascending=True, inplace=True)
        console.print(f"Log data found: [green]{len(dataframe)}")
        dataframe.to_csv(df_log_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Log data file serialized at path: [cyan on white]{df_log_path}")
    else:
        console.print(f"Log dataframe [yellow]empty[/yellow], dataframe not serialized.")

    if os.path.exists(df_log_path):
        shutil.make_archive(f"{models_path}Logs-Partial", 'zip', df_log_partial_folder_path)
        if os.path.exists(f"{models_path}Logs-Partial.zip"):
            shutil.rmtree(df_log_partial_folder_path)

    file_count = 0
    try:
        _, _, files = next(os.walk(df_log_partial_folder_path))
        file_count = len(files)
        if file_count <= 0:
            shutil.rmtree(df_log_partial_folder_path)
    except StopIteration:
        pass

else:
    console.print(f"Logs dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_log_path}")

console.rule("7 - Building [cyan on white]workers_comments[/cyan on white] dataframe")

def load_comment_col_names():
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("time_submit")
    columns.append("try_current")
    columns.append("sequence_number")
    columns.append("text")

    return columns

dataframe = pd.DataFrame()

if not os.path.exists(df_comm_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            worker_id = acl_record['worker_id']
            worker_paid = acl_record['paid']
            task_name = acl_record['task_name']
            batch_name = acl_record['batch_name']
            unit_id = acl_record['unit_id']

            data_partial = worker_snapshot['data_partial']

            column_names = load_comment_col_names()

            for column in column_names:
                if column not in dataframe:
                    dataframe[column] = np.nan


            row = {}
            row['worker_id'] = worker_id
            row['paid'] = worker_paid
            row['task_name'] = task_name
            row['batch_name'] = batch_name
            row['unit_id'] = unit_id

            if 'comments' in worker_snapshot:

                comments = worker_snapshot['comments']

                for comment in comments:

                    if len(comment['serialization']['comment'])>0:
                        row['try_current'] = comment['serialization']['info']['try']
                        row['time_submit'] = comment['time_submit']
                        row['sequence_number'] = comment['serialization']['info']['sequence']
                        row['text'] = sanitize_string(comment['serialization']['comment'])
                        dataframe = dataframe.append(row, ignore_index=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe.to_csv(df_comm_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers comments dataframe serialized at path: [cyan on white]{df_comm_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers comments dataframe [yellow]empty[/yellow], dataframe not serialized.")
else:
    console.print(f"Workers comments dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_comm_path}")


console.rule("8 - Building [cyan on white]workers_questionnaire[/cyan on white] dataframe")

def load_quest_col_names(questionnaires):
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_current")
    columns.append("time_submit")

    for questionnaire in questionnaires:
        for attribute, value in questionnaire.items():
            if type(value) != list:
                column_name = f"questionnaire_{attribute}"
                if column_name not in columns:
                    columns.append(column_name)
    columns.append(f"questionnaire_time_elapsed")
    columns.append(f"questionnaire_accesses")
    for questionnaire in questionnaires:
        for question in questionnaire['questions']:
            if not question['dropped']:
                for attribute, value in question.items():
                    if type(value) != list:
                        column_name = f"question_attribute_{attribute}"
                        if column_name not in columns:
                            columns.append(column_name)
        columns.append(f"question_answer_value")
        columns.append(f"question_answer_text")
        columns.append(f"question_free_text_value")
        if questionnaire['type'] == 'likert':
            columns.append(f"question_answer_mapping_index")
            columns.append(f"question_answer_mapping_key")
            columns.append(f"question_answer_mapping_label")
            columns.append(f"question_answer_mapping_value")

    return columns


def parse_answers(row, questionnaire, question, answers):
    answer_value = None
    answer_free_text = None
    question_name_full = None

    for control_name, answer_current in answers.items():
        if '_answer' in control_name:
            question_name_parsed = control_name.replace("_answer", "")
            if question_name_parsed == question["nameFull"] or question["nameFull"] in question_name_parsed:
                if type(answer_current)==dict:
                    selected_options = ""
                    for option, selected in answer_current.items():
                        if selected:
                            selected_options = f"{selected_options}{option};"
                    if len(selected_options)>0:
                        selected_options = selected_options[:-1]
                    answer_value = selected_options
                else:
                    answer_value = answer_current
        if '_free_text' in control_name:
            question_name_parsed = control_name.replace("_free_text", "")
            if question_name_parsed == question["nameFull"] or question["nameFull"] in question_name_parsed:
                answer_free_text = answer_current

    for attribute, value in question.items():
        if type(value) != list:
            row[f"question_attribute_{attribute}"] = value
    row[f"question_answer_value"] = answer_value
    row[f"question_free_text_value"] = answer_free_text

    if questionnaire['type'] == 'standard':
        if question['type'] == 'mcq':
            if answer_value is not None:
                try:
                    row[f"question_answer_text"] = question['answers'][int(answer_value)]
                except ValueError:
                    row[f"question_answer_text"] = ''
        if question['type'] == 'list':
            if answer_value is not None:
                selected_options = answer_value.split(";")
                selected_options_text = ""
                for option in selected_options:
                    try:
                        option_text = question['answers'][int(option)]
                        selected_options_text = f"{selected_options_text}{option_text};"
                    except ValueError:
                        selected_options_text = ''
                if len(selected_options_text) > 0:
                    selected_options_text = selected_options_text[:-1]
                    row[f"question_answer_text"] = selected_options_text

    elif questionnaire['type'] == 'likert':
        mapping = questionnaire['mappings'][int(answer_value)]
        row[f"question_answer_mapping_index"] = mapping['index']
        row[f"question_answer_mapping_key"] = mapping['key'] if "key" in mapping else None
        row[f"question_answer_mapping_label"] = mapping['label']
        row[f"question_answer_mapping_value"] = mapping['value']
    return row


dataframe = pd.DataFrame()

if not os.path.exists(df_quest_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            source_data = worker_snapshot['source_data']

            worker_id = acl_record['worker_id']
            worker_paid = acl_record['paid']
            task_name = acl_record['task_name']
            batch_name = acl_record['batch_name']
            unit_id = acl_record['unit_id']

            task = worker_snapshot['task']
            questionnaires = worker_snapshot['questionnaires']
            data_partial = worker_snapshot['data_partial']

            column_names = load_quest_col_names(questionnaires)

            for column in column_names:
                if column not in dataframe:
                    dataframe[column] = np.nan

            if len(data_partial) > 0:

                for questionnaire_data in data_partial['questionnaires_answers']:

                    row = {}
                    row['worker_id'] = worker_id
                    row['paid'] = worker_paid
                    row['task_name'] = task_name
                    row['batch_name'] = batch_name
                    row['unit_id'] = unit_id
                    row['time_submit'] = questionnaire_data['time_submit']

                    questionnaire = questionnaires[questionnaire_data['serialization']['info']['index']]
                    current_answers = questionnaire_data['serialization']['answers']
                    timestamps_elapsed = questionnaire_data['serialization']["timestamps_elapsed"]
                    info = questionnaire_data['serialization']["info"]
                    accesses = questionnaire_data['serialization']["accesses"]

                    row['try_current'] = info['try']

                    data = dataframe.loc[
                        (dataframe['worker_id'] == row['worker_id']) &
                        (dataframe['task_name'] == row['task_name']) &
                        (dataframe['batch_name'] == row['batch_name']) &
                        (dataframe['unit_id'] == row['unit_id']) &
                        (dataframe['try_current'] == row['try_current']) &
                        (dataframe['questionnaire_index'] == questionnaire['index'])
                        ]

                    if data.shape[0] <= 0:

                        for attribute, value in questionnaire.items():
                            if type(value) != list:
                                row[f"questionnaire_{attribute}"] = value
                        row[f"questionnaire_time_elapsed"] = round(timestamps_elapsed, 2)
                        row[f"questionnaire_accesses"] = accesses

                        for index_sub, question in enumerate(questionnaire["questions"]):
                            if not question['dropped']:
                                row = parse_answers(row, questionnaire, question, current_answers)
                                dataframe = dataframe.append(row, ignore_index=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["questionnaire_allow_back"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["questionnaire_allow_back"] = dataframe["questionnaire_allow_back"].astype(bool)
        dataframe["question_attribute_required"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["question_attribute_required"] = dataframe["question_attribute_required"].astype(bool)
        dataframe["question_attribute_freeText"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["question_attribute_freeText"] = dataframe["question_attribute_freeText"].astype(bool)
        dataframe["question_attribute_dropped"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["question_attribute_dropped"] = dataframe["question_attribute_dropped"].astype(bool)
        dataframe["question_attribute_showDetail"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["question_attribute_showDetail"] = dataframe["question_attribute_showDetail"].astype(bool)
        dataframe.to_csv(df_quest_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers questionnaire dataframe serialized at path: [cyan on white]{df_quest_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers questionnaire dataframe [yellow]empty[/yellow], dataframe not serialized.")
else:
    console.print(f"Workers questionnaire dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_quest_path}")

console.rule("9 - Building [cyan on white]workers_data[/cyan on white] dataframe")


def load_data_col_names(dimensions, documents):
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_id")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_last")
    columns.append("try_current")
    columns.append("time_submit")

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

    columns.append("global_outcome")
    columns.append("global_form_validity")
    columns.append("gold_checks")
    columns.append("time_spent_check")
    columns.append("time_check_amount")

    return columns


dataframe = pd.DataFrame()

if not os.path.exists(df_data_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_paid = acl_record['paid']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            task = worker_snapshot['task']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            questionnaires = worker_snapshot['questionnaires']
            logs = worker_snapshot['logs']
            comments = worker_snapshot['comments']
            checks = worker_snapshot['checks']
            worker = worker_snapshot['worker']
            data_partial = worker_snapshot['data_partial']

            column_names = load_data_col_names(dimensions, documents)

            for column in column_names:
                if column not in dataframe:
                    dataframe[column] = np.nan

            if len(data_partial) > 0:

                row = {}
                row['worker_id'] = worker_id
                row['paid'] = worker_paid

                for attribute, value in task.items():
                    if attribute in column_names:
                        row[attribute] = value

                last_full_try = 0
                most_rec_try = 1
                dataframe_worker = dataframe.loc[dataframe['worker_id'] == worker_id]

                if dataframe_worker.shape[0] > 0:
                    most_rec_try = dataframe_worker.loc[dataframe_worker['try_current'].idxmax()]['try_current']
                    last_full_try = dataframe_worker.loc[dataframe_worker['try_last'].idxmax()]['try_last']

                for document_data in data_partial['documents_answers']:

                    row['try_current'] = document_data['serialization']['info']['try']
                    row['time_submit'] = document_data['time_submit']

                    if (int(last_full_try) > int(most_rec_try)) and (int(row['try_current']) > int(most_rec_try)) or last_full_try == 0:

                        if len(checks) > 0:
                            for check_data in checks:
                                if check_data['serialization']["info"]['try'] == row['try_current']:
                                    row["global_outcome"] = check_data['serialization']["checks"]["globalOutcome"]
                                    row["global_form_validity"] = check_data['serialization']["checks"]["globalFormValidity"]
                                    row["gold_checks"] = any(check_data['serialization']["checks"]["goldChecks"])
                                    row["time_check_amount"] = check_data['serialization']["checks"]["timeCheckAmount"]
                                    row["time_spent_check"] = check_data['serialization']["checks"]["timeSpentCheck"]
                        else:
                            row["global_outcome"] = False
                            row["global_form_validity"] = False
                            row["gold_checks"] = False
                            row["time_check_amount"] = np.nan
                            row["time_spent_check"] = False

                        row["doc_accesses"] = document_data['serialization']['accesses']

                        row["doc_countdown_time_start"] = document_data['serialization']['countdowns_times_start'][0] if len(document_data['serialization']['countdowns_times_start']) > 0 else np.nan
                        row["doc_countdown_time_value"] = document_data['serialization']['countdowns_times_left']['value'] if len(document_data['serialization']['countdowns_times_left']) > 0 else np.nan
                        row["doc_countdown_time_text"] = document_data['serialization']['countdowns_times_left']['text'] if len(document_data['serialization']['countdowns_times_left']) > 0 else np.nan
                        row["doc_countdown_time_expired"] = document_data['serialization']["countdowns_expired"][document_data['serialization']['info']['index']] if len(
                            document_data['serialization']["countdowns_expired"]) > 0 else np.nan

                        current_attributes = documents[document_data['serialization']['info']['index']].keys()
                        current_answers = document_data['serialization']['answers']
                        for current_attribute in current_attributes:
                            current_attribute_value = documents[document_data['serialization']['info']['index']][current_attribute]
                            if type(current_attribute_value) == str:
                                current_attribute_value = re.sub('\n', '', current_attribute_value)
                            row[f"doc_{current_attribute}"] = current_attribute_value
                        for dimension in dimensions:
                            if dimension['scale'] is not None:
                                value = current_answers[f"{dimension['name']}_value"]
                                if type(value) == str:
                                    value = value.strip()
                                    value = re.sub('\n', '', value)
                                row[f"doc_{dimension['name']}_value"] = value
                                if dimension["scale"]["type"] == "categorical":
                                    for mapping in dimension["scale"]['mapping']:
                                        label = mapping['label'].lower().split(" ")
                                        label = '-'.join([str(c) for c in label])
                                        if mapping['value'] == value:
                                            row[f"doc_{dimension['name']}_label"] = label
                                            row[f"doc_{dimension['name']}_index"] = mapping['index']
                                            row[f"doc_{dimension['name']}_description"] = mapping['description']
                                else:
                                    row[f"doc_{dimension['name']}_value"] = np.nan
                                    row[f"doc_{dimension['name']}_label"] = np.nan
                                    row[f"doc_{dimension['name']}_index"] = np.nan
                                    row[f"doc_{dimension['name']}_description"] = np.nan
                            if dimension['justification']:
                                justification = current_answers[f"{dimension['name']}_justification"].strip()
                                justification = re.sub('\n', '', justification)
                                row[f"doc_{dimension['name']}_justification"] = justification
                            else:
                                row[f"doc_{dimension['name']}_justification"] = np.nan
                            if dimension['url']:
                                row[f"doc_{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                            else:
                                row[f"doc_{dimension['name']}_url"] = np.nan

                        row["doc_accesses"] = document_data['serialization']['accesses']

                        if document_data['serialization']['timestamps_start'] is None:
                            row["doc_time_start"] = np.nan
                        else:
                            row["doc_time_start"] = round(document_data['serialization']['timestamps_start'][0], 2)

                        if document_data['serialization']['timestamps_end'] is None:
                            row["doc_time_end"] = np.nan
                        else:
                            row["doc_time_end"] = round(document_data['serialization']['timestamps_end'][0], 2)

                        if document_data['serialization']['timestamps_elapsed'] is None:
                            row["doc_time_elapsed"] = np.nan
                        else:
                            row["doc_time_elapsed"] = round(document_data['serialization']['timestamps_elapsed'], 2)

                        if ('time_submit') in row:
                            dataframe = dataframe.append(row, ignore_index=True)

    empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
    dataframe.drop(empty_cols, axis=1, inplace=True)
    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["global_outcome"] = dataframe["gold_checks"].astype(bool)
        dataframe["global_form_validity"] = dataframe["gold_checks"].astype(bool)
        dataframe["time_spent_check"] = dataframe["gold_checks"].astype(bool)
        dataframe["time_check_amount"] = dataframe["gold_checks"].astype(bool)
        dataframe["gold_checks"] = dataframe["gold_checks"].astype(bool)
        dataframe.rename(columns={'paid': 'worker_paid'}, inplace=True)
        dataframe.drop_duplicates(inplace=True)
        dataframe.to_csv(df_data_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers data dataframe serialized at path: [cyan on white]{df_data_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers data dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"Workers dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_data_path}")

console.rule("10 - Building [cyan on white]workers_dimensions_selection[/cyan on white] dataframe")

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

dataframe = pd.DataFrame(columns=[
    "worker_id",
    "worker_paid",
    "task_id",
    "batch_name",
    "unit_id",
    'try_last',
    'try_current',
    'dimension_index',
    'dimension_name',
    'timestamp_start',
    'selection_index',
    'selection_value',
    'selection_label',
    'selection_timestamp',
    'selection_time_elapsed',
    'timestamp_end',
    'document_index',
    'document_id'
])
dataframe['try_last'] = dataframe['try_last'].astype(float)
dataframe['try_current'] = dataframe['try_current'].astype(float)


def parse_dimensions_selected(df, worker_id, worker_paid, task, info, documents, dimensions, dimensions_selected_data, timestamp_start, timestamp_end):
    for index_current, dimensions_selected in enumerate(dimensions_selected_data):

        for dimension_current in dimensions_selected['data']:

            dimension_data = dimensions[dimension_current['dimension']]

            label = np.nan
            if dimension_data['scale']['type'] == 'categorical':
                for mapping in dimension_data['scale']['mapping']:
                    if mapping['value'] == dimension_current['value']:
                        label = mapping['label']

            timestamp_selection = float(dimension_current['timestamp'])
            timestamp_selection_parsed = datetime.datetime.fromtimestamp(timestamp_selection)
            timestamp_parsed_previous = timestamps_found[counter - 1]
            time_elapsed = (timestamp_selection_parsed - timestamp_parsed_previous).total_seconds()
            if time_elapsed < 0:
                time_elapsed = (timestamp_parsed_previous - timestamp_selection_parsed).total_seconds()
            timestamps_found.append(timestamp_selection_parsed)

            row = {
                'worker_id': worker_id,
                'worker_paid': worker_paid,
                'task_id': task['task_id'],
                'batch_name': task['batch_name'],
                'unit_id': task['unit_id'],
                'try_last': task['try_last'],
                'try_current': info['try'],
                'document_index': dimension_current['document'],
                'document_id': documents[dimension_current['document']]['id'],
                'dimension_index': dimension_current['dimension'],
                'dimension_name': dimension_data['name'],
                'timestamp_start': timestamp_start,
                'selection_index': dimension_current['index'],
                'selection_value': dimension_current['value'],
                'selection_label': label,
                'selection_timestamp': dimension_current['timestamp'],
                'selection_time_elapsed': time_elapsed,
                'timestamp_end': timestamp_end
            }
            df = df.append(row, ignore_index=True)

    return df


if not os.path.exists(df_dim_path) and os.path.exists(df_data_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_paid = acl_record['paid']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            task = worker_snapshot['task']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            questionnaires = worker_snapshot['questionnaires']
            data_partial = worker_snapshot['data_partial']

            worker_data = df_data.loc[df_data['worker_id'] == worker_id]
            timestamp_start = worker_data['doc_time_start'].min()
            timestamp_end = worker_data['doc_time_start'].max()

            if len(data_partial) > 0:

                last_full_try = 1
                most_rec_try = 1
                dataframe_worker = dataframe.loc[dataframe['worker_id'] == worker_id]
                if dataframe_worker.shape[0] > 0:
                    most_rec_try = dataframe_worker.loc[dataframe_worker['try_current'].idxmax()]['try_current']
                    last_full_try = dataframe_worker.loc[dataframe_worker['try_last'].idxmax()]['try_last']

                timestamps_found = []

                for document_data in data_partial['documents_answers']:
                    timestamps_elapsed = document_data['serialization']["timestamps_elapsed"]
                    timestampsStart = document_data['serialization']["timestamps_start"]
                    timestampsEnd = document_data['serialization']["timestamps_end"]
                    info = document_data['serialization']["info"]

                    if (int(last_full_try) > int(most_rec_try)) and (int(info['try']) > int(most_rec_try)):
                        timestamp_first = timestamp_start
                        timestamp_first_parsed = datetime.datetime.fromtimestamp(timestamp_first)
                        timestamps_found = [timestamp_first_parsed]

                        counter = 0

                        dimensions_selected_data = [document_data['serialization']["dimensions_selected"]]

                        dataframe = parse_dimensions_selected(dataframe, worker_id, worker_paid, task, info, documents, dimensions, dimensions_selected_data, timestamp_start, timestamp_end)

    dataframe.drop_duplicates(inplace=True)

    if dataframe.shape[0] > 0:
        dataframe.to_csv(df_dim_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Dimension analysis dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Dimension analysis dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"Dimensions analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_dim_path}")

console.rule("11 - Building [cyan on white]workers_urls[/cyan on white] dataframe")

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

dataframe = pd.DataFrame(columns=[
    "worker_id",
    "worker_paid",
    "try_last",
    "try_current",
    "document_index",
    "document_id",
    "dimension_index",
    "dimension_name",
    "query_index",
    "query_text",
    "query_timestamp",
    "response_index",
    "response_url",
    "response_name",
    "response_snippet",
    "index_selected"
])
dataframe['try_last'] = dataframe['try_last'].astype(float)
dataframe['try_current'] = dataframe['try_current'].astype(float)


def parse_responses(df, worker_id, worker_paid, task, info, queries, responses_retrieved, responses_selected):
    for index_current, responses_retrieved_document in enumerate(responses_retrieved):
        for index_current_sub, response_retrieved in enumerate(responses_retrieved_document["data"]):

            row = {
                "worker_id": worker_id,
                "worker_paid": worker_paid,
                "try_last": task['try_last'],
                "try_current": info['try'],
                "document_index": response_retrieved['document'],
                "document_id": documents[response_retrieved['document']]['id'],
                "dimension_index": response_retrieved['dimension'],
                "dimension_name": dimensions[response_retrieved['dimension']]['name'],
                "query_index": response_retrieved['query']
            }
            query_text = np.nan

            if type(queries) == list:
                for query in queries[int(response_retrieved['document'])]["data"]:
                    if response_retrieved["query"] == query['index']:
                        query_text = query["text"]
            else:
                for query in queries["data"]:
                    if response_retrieved["query"] == query['index']:
                        query_text = query["text"]
            row['query_text'] = query_text
            row['query_timestamp'] = response_retrieved['timestamp']
            for response_index, response in enumerate(response_retrieved['response']):

                row["response_index"] = response_index
                row["response_url"] = response["url"]
                row["response_name"] = response["name"]
                row["response_snippet"] = response["snippet"]
                row["index_selected"] = -1
                row_check = df.loc[
                    (df["worker_id"] == row["worker_id"]) &
                    (df["try_last"] == task['try_last']) &
                    (df["try_current"] == row["try_current"]) &
                    (df["document_index"] == row["document_index"]) &
                    (df["dimension_index"] == row["dimension_index"]) &
                    (df["query_index"] == row["query_index"]) &
                    (df["query_timestamp"] == row["query_timestamp"]) &
                    (df["response_index"] == response_index)
                    ]
                if len(row_check) == 0:
                    df.loc[len(df)] = row

    for index_current, responses_selected_document in enumerate(responses_selected):
        for response_index, response_selected in enumerate(responses_selected_document["data"]):
            row = df.loc[
                (df["worker_id"] == worker_id) &
                (df["try_last"] == task['try_last']) &
                (df["try_current"] == info['try']) &
                (df["document_index"] == response_selected["document"]) &
                (df["dimension_index"] == response_selected["dimension"]) &
                (df["query_index"] == response_selected["query"]) &
                (df["response_url"] == response_selected["response"]['url']) &
                (df["response_name"] == response_selected["response"]['name']) &
                (df["response_snippet"] == response_selected["response"]['snippet'])
                ]
            df.at[row.index.values[0], 'index_selected'] = response_index

    return df


if not os.path.exists(df_url_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_paid = acl_record['paid']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            worker_id = worker_snapshot['task']['worker_id']
            worker_paid = bool(strtobool(worker_snapshot['worker']['paramsFetched']['paid']))

            task = worker_snapshot['task']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            data_partial = worker_snapshot['data_partial']

            if len(data_partial) > 0:

                last_full_try = 1
                most_rec_try = 1
                dataframe_worker = dataframe.loc[dataframe['worker_id'] == worker_id]
                if dataframe_worker.shape[0] > 0:
                    most_rec_try = dataframe_worker.loc[dataframe_worker['try_current'].idxmax()]['try_current']
                    last_full_try = dataframe_worker.loc[dataframe_worker['try_last'].idxmax()]['try_last']

                for document_data in data_partial['documents_answers']:
                    info = document_data['serialization']['info']
                    queries = document_data['serialization']['queries']
                    responses_retrieved = [document_data['serialization']['responses_retrieved']]
                    responses_selected = [document_data['serialization']['responses_selected']]

                    if (int(last_full_try) > int(most_rec_try)) and (int(info['try']) > int(most_rec_try)):
                        dataframe = parse_responses(dataframe, worker_id, worker_paid, task, info, queries, responses_retrieved, responses_selected)

    dataframe.drop_duplicates(inplace=True)

    if dataframe.shape[0] > 0:
        dataframe.to_csv(df_url_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Worker urls dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Worker urls dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"URL analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_url_path}")

# console.rule("12 - Checking missing HITs")

# hits_missing = []
# hits = load_json(f"{task_config_folder}{batch_name}/hits.json")
# if os.path.exists(df_data_path):
#     df = pd.read_csv(df_data_path)
#     df = df.loc[df['worker_paid'] == True]
#     for hit in hits:
#         unit_data = df.loc[df['unit_id'] == hit['unit_id']]
#         if len(unit_data) <= 0:
#             hits_missing.append(hit)
#     if len(hits_missing) > 0:
#         console.print(f"Missing HITs: {len(hits_missing)}")
#         path_missing = f"{task_config_folder}{batch_name}/hits_missing.json"
#         with open(path_missing, 'w', encoding='utf-8') as f:
#             json.dump(hits_missing, f, ensure_ascii=False, indent=4)
#         console.print(f"Serialized at path: [cyan on white]{path_missing}")
#     else:
#         console.print(f"There aren't missing HITS for task [cyan on white]{task_name}")
