#!/usr/bin/env python
# coding: utf-8

import json
import os
import shutil
import sys
import pprint
from pathlib import Path
from glob import glob
from json import JSONDecodeError
import time as time_mod
import asyncio
import aiohttp
import numpy
from aiohttp import ClientSession, ClientConnectorError, ClientResponseError, ClientOSError, ServerDisconnectedError, TooManyRedirects, ClientPayloadError, ClientConnectorCertificateError
import tqdm
import ipinfo
import re
import numpy as np
import requests
from distutils.util import strtobool
from pathlib import Path
import boto3
import re
import pandas as pd
import pprint
import uuid
import toloka.client as toloka
from datetime import datetime
from bs4 import BeautifulSoup
import datefinder
from dotenv import load_dotenv
import xml.etree.ElementTree as Xml
from rich.console import Console
import collections
import warnings

pd.set_option('display.max_columns', None)

warnings.simplefilter(action='ignore', category=FutureWarning)
pd.options.mode.chained_assignment = None  # default='warn'
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
server_config = os.getenv('server_config')
enable_solver = strtobool(os.getenv('enable_solver')) if os.getenv('enable_solver') is not None else False
enable_crawling = strtobool(os.getenv('enable_crawling')) if os.getenv('enable_crawling') is not None else False
aws_region = os.getenv('aws_region')
aws_private_bucket = os.getenv('aws_private_bucket')
aws_deploy_bucket = os.getenv('aws_deploy_bucket')
toloka_oauth_token = os.getenv('toloka_oauth_token')
prolific_completion_code = os.getenv('prolific_completion_code')
prolific_api_token = os.getenv('prolific_api_token')
budget_limit = os.getenv('budget_limit')
bing_api_key = os.getenv('bing_api_key')
ip_info_token = os.getenv('ip_info_token')
ip_geolocation_api_key = os.getenv('ip_geolocation_api_key')
ip_api_api_key = os.getenv('ip_api_api_key')
user_stack_token = os.getenv('user_stack_token')
fake_json_token = os.getenv('fake_json_token')

folder_result_path = f"result/{task_name}/"
models_path = f"result/{task_name}/Dataframe/"
resources_path = f"result/{task_name}/Resources/"
data_path = f"result/{task_name}/Data/"
crawling_path = f"result/{task_name}/Crawling/"
crawling_path_source = f"result/{task_name}/Crawling/Source/"
crawling_path_metadata = f"result/{task_name}/Crawling/Metadata/"
df_log_partial_folder_path = f"{models_path}Logs-Partial/"
task_config_folder = f"{folder_result_path}/Task/"
df_mturk_data_path = f"{models_path}workers_mturk_data.csv"
df_toloka_data_path = f"{models_path}workers_toloka_data.csv"
df_prolific_data_path = f"{models_path}workers_prolific_data.csv"
df_acl_path = f"{models_path}workers_acl.csv"
df_info_path = f"{models_path}workers_info.csv"
df_log_path = f"{models_path}workers_logs.csv"
df_quest_path = f"{models_path}workers_questionnaire.csv"
df_comm_path = f"{models_path}workers_comments.csv"
df_data_path = f"{models_path}workers_answers.csv"
df_notes_path = f"{models_path}workers_notes.csv"
df_dim_path = f"{models_path}workers_dimensions_selection.csv"
df_url_path = f"{models_path}workers_urls.csv"
df_crawl_path = f"{models_path}workers_crawling.csv"
filename_hits_config = "hits.json"
filename_dimensions_config = "dimensions.json"
filename_instructions_general_config = "instructions_general.json"
filename_instructions_evaluation_config = "instructions_evaluation.json"
filename_questionnaires_config = "questionnaires.json"
filename_search_engine_config = "search_engine.json"
filename_task_settings_config = "task.json"
filename_workers_settings_config = "workers.json"

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


def camel_to_snake(name):
    return '_'.join(
        re.sub('([A-Z][a-z]+)', r' \1',
               re.sub('([A-Z]+)', r' \1',
                      name.replace('-', ' '))).split()).lower()


def find_date_string(date, seconds=False):
    if type(date) == int or type(date) == float or type(date) == numpy.float64 or type(date) == numpy.float32:
        if seconds:
            date_raw = str(datetime.fromtimestamp(date))
        else:
            date_raw = str(datetime.fromtimestamp(date // 1000))
    else:
        date_raw = date
    date_parsed = datefinder.find_dates(date_raw)
    for date_current in date_parsed:
        date_string = str(date_current)
        if '+' in date_string:
            date_parts = date_string.split("+")
            date_string = ' '.join(date_parts)
        return date_string


step_index = 1

console.rule(f"{step_index} - Initialization")
step_index = step_index + 1

os.chdir("../data/")

console.print("[bold]Download.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

os.makedirs(folder_result_path, exist_ok=True)
os.makedirs(models_path, exist_ok=True)
os.makedirs(resources_path, exist_ok=True)
os.makedirs(data_path, exist_ok=True)
os.makedirs(crawling_path, exist_ok=True)
os.makedirs(crawling_path_source, exist_ok=True)
os.makedirs(crawling_path_metadata, exist_ok=True)

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
ec2_client = boto_session.client('ec2', region_name=aws_region)
aws_region_names = []
for region_data in ec2_client.describe_regions()['Regions']:
    aws_region_names.append(region_data['RegionName'])

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

console.print(f"Batch names: [cyan]{', '.join(task_batch_names)}")
console.print(f"Tables data: [cyan]{', '.join(task_data_tables)}")
console.print(f"Tables log: [cyan]{', '.join(task_log_tables)}")
console.print(f"Tables ACL: [cyan]{', '.join(task_acl_tables)}")

console.rule(f"{step_index} - Fetching [green]{task_name}[/green] Configuration")
step_index = step_index + 1

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

console.rule(f"{step_index}  - Fetching Workers Snapshots")
step_index = step_index + 1

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

    for worker_id in tqdm.tqdm(worker_identifiers):

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

console.rule(f"{step_index} - Fetching Workers ACL")
step_index = step_index + 1

if not os.path.exists(df_acl_path):

    df_acl = pd.DataFrame()

    for worker_id in tqdm.tqdm(worker_identifiers):

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
                    paid = False
                    if len(worker_snapshot['checks']) > 0:
                        check = worker_snapshot['checks'][-1:][0]['serialization']['checks']
                        paid = check['timeSpentCheck'] and check['globalFormValidity'] and any(check['goldChecks'])
                    task = worker_snapshot['task']
                    row['task_name'] = task['task_id']
                    row['batch_name'] = task['batch_name']
                    row['unit_id'] = task['unit_id']
                    row['paid'] = paid
                    row['source_acl'] = worker_snapshot['source_acl']
                    row['source_data'] = worker_snapshot['source_data']
                    row['source_log'] = worker_snapshot['source_log']
                    row['source_path'] = worker_snapshot['source_path']
                    for attribute, value in task.items():
                        if attribute != 'settings' and attribute != 'logger_server_endpoint' and attribute != 'messages':
                            row[attribute] = value
                    if 'time_arrival' in row:
                        row['time_arrival_parsed'] = find_date_string(row['time_arrival'])
                    if 'time_completion' in row:
                        row['time_completion_parsed'] = find_date_string(row['time_completion'])
                    if 'time_removal' in row:
                        row['time_removal_parsed'] = find_date_string(row['time_removal'])

            if acl_presence:
                df_acl = df_acl.append(row, ignore_index=True)
                break

    if len(df_acl) > 0:
        df_acl.to_csv(df_acl_path, index=False)
        console.print(f"Dataframe shape: {df_acl.shape}")
        console.print(f"Workers info dataframe serialized at path: [cyan on white]{df_acl_path}")

else:
    df_acl = pd.read_csv(df_acl_path)
    console.print(f"Workers ACL [yellow]already detected[/yellow], skipping download")

platforms = np.unique(df_acl['platform'].values)

console.rule(f"{step_index} - Checking Missing Units")
step_index = step_index + 1

hits = load_json(f"{task_config_folder}{batch_name}/{filename_hits_config}")
units = []
for hit in tqdm.tqdm(hits):
    hit_completed = False
    for index, acl_record in df_acl.iterrows():
        if hit['unit_id'] == acl_record['unit_id'] and acl_record['paid']==True:
            hit_completed = True
    if not hit_completed:
        units.append(hit['unit_id'])
console.print(f"There are [cyan on white]{len(units)}/{len(hits)}[/cyan on white] units not yet evaluated")

if 'mturk' in platforms:

    console.rule(f"{step_index} - Fetching MTurk Data")
    step_index = step_index + 1

    with console.status(f"Downloading HITs, Token: {next_token}, Total: {token_counter}", spinner="aesthetic") as status:

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

    console.print(f"MTurk HITs data available at path: [cyan on white]{df_mturk_data_path}")

if 'toloka' in platforms:

    column_names = [
        "worker_id",
        "project_id",
        "project_name",
        "project_description",
        "project_comment",
        "pool_id",
        "pool_requester_id",
        "pool_requester_myself",
        "pool_name",
        "pool_description",
        "pool_comment",
        "pool_status",
        "pool_creation_date",
        "pool_expiration_date",
        "pool_last_started",
        "pool_last_stopped",
        "pool_last_close_reason",
        "pool_speed_quality_balance_type",
        "pool_speed_quality_balance_percent",
        "pool_assignment_reward",
        "pool_assignment_max_duration_seconds",
        "pool_priority",
        "pool_auto_close_after_complete_delay_seconds",
        "pool_auto_accept_solutions",
        "pool_auto_accept_period_day",
        "pool_issue_task_suite_in_creation_order",
        "task_suite_id",
        "task_suite_creation_date",
        "task_suite_remaining_overlap",
        "task_suite_mixed",
        "task_suite_latitude",
        "task_suite_longitude",
        "assignment_id",
        "assignment_user_id",
        "assignment_comment",
        "assignment_status",
        "assignment_creation_date",
        "assignment_accept_date",
        "assignment_submit_date",
        "assignment_expire_date",
        "assignment_skip_date",
        "assignment_reject_date",
        "assignment_token_input",
        "assignment_token_input_final",
        "assignment_token_output",
        "assignment_reward",
        "assignment_rejected",
        "assignment_automerged",
        "assignment_mixed",
        "user_id",
        "user_country",
        "user_languages",
        "user_country_by_phone",
        "user_country_by_ip",
        "user_client_type",
        "user_agent_type",
        "user_device_category",
        "user_os_family",
        "user_os_version",
        "user_os_version_major",
        "user_os_version_minor",
        "user_os_version_bugfix",
        "user_adult_allowed",
    ]

    console.rule(f"{step_index} - Fetching Toloka Data")
    step_index = step_index + 1

    if not os.path.exists(df_toloka_data_path):

        df_toloka = pd.DataFrame(columns=column_names)

        toloka_client = toloka.TolokaClient(toloka_oauth_token, 'PRODUCTION')

        df_acl_copy = df_acl.copy()
        tokens_input = []
        tokens_output = []
        for batch_current in np.unique(df_acl_copy['batch_name'].values):
            hits = load_json(f"{task_config_folder}{batch_current}/hits.json")
            for hit in hits:
                tokens_input.append(hit['token_input'])
                tokens_output.append(hit['token_output'])
        tokens_input = list(set(sorted(tokens_input)))
        tokens_output = list(set(sorted(tokens_output)))

        tokens_input_deployed = None
        tokens_output_deployed = None

        project_data = None
        for project in toloka_client.get_projects():
            for input_field, data in project.task_spec.input_spec.items():
                if input_field == 'token_input' and data.allowed_values:
                    tokens_input_deployed = list(set(sorted(data.allowed_values)))
            for output_field, data in project.task_spec.output_spec.items():
                if output_field == 'token_output' and data.allowed_values:
                    tokens_output_deployed = list(set(sorted(data.allowed_values)))
            if tokens_input == tokens_input_deployed and tokens_output == tokens_output_deployed:
                console.print(f"Toloka project with name [cyan]{project.public_name}[/cyan] and ID [cyan]{project.id}[/cyan] found")
                project_data = project
                break

        row = {
            'project_id': project_data.id,
            'project_name': project_data.public_name.strip(),
            'project_description': project_data.public_description.strip(),
            'project_comment': project_data.private_comment.strip(),
        }

        pool_counter = 0
        task_suites_counter = 0
        assignments_counter = 0

        for pool in toloka_client.find_pools(project_id=project_data.id, sort=['last_started']).items:
            row['pool_id'] = pool.id
            row['pool_requester_id'] = pool.owner.id
            row['pool_requester_myself'] = pool.owner.myself
            row['pool_name'] = pool.private_name
            row['pool_description'] = pool.public_description
            row['pool_comment'] = pool.private_comment
            row['pool_status'] = pool.status.value
            row['pool_creation_date'] = pool.created.strftime("%Y-%m-%d %H:%M:%S")
            row['pool_expiration_date'] = pool.will_expire.strftime("%Y-%m-%d %H:%M:%S")
            row['pool_last_started'] = pool.last_started.strftime("%Y-%m-%d %H:%M:%S") if pool.last_started else np.nan
            row['pool_last_stopped'] = pool.last_stopped.strftime("%Y-%m-%d %H:%M:%S") if pool.last_stopped else np.nan
            row['pool_last_close_reason'] = pool.last_close_reason.value if pool.last_close_reason else np.nan
            row['pool_speed_quality_balance_type'] = pool.speed_quality_balance.type
            row['pool_speed_quality_balance_percent'] = pool.speed_quality_balance.percent
            row['pool_assignment_reward'] = pool.reward_per_assignment
            row['pool_assignment_max_duration_seconds'] = pool.assignment_max_duration_seconds
            row['pool_priority'] = pool.priority
            row['pool_auto_close_after_complete_delay_seconds'] = pool.auto_close_after_complete_delay_seconds
            row['pool_auto_accept_solutions'] = pool.auto_accept_solutions
            row['pool_auto_accept_period_day'] = pool.auto_accept_period_day
            row['pool_issue_task_suite_in_creation_order'] = pool.assignments_issuing_config.issue_task_suites_in_creation_order
            pool_counter = pool_counter + 1
            task_suites = []
            for task_suite in toloka_client.find_task_suites(pool_id=pool.id, sort=['created']).items:
                task_suites.append(task_suite)
            for task_suite in tqdm.tqdm(task_suites, desc=f"Processing task suites for pool {pool.id}:"):
                row['task_suite_id'] = task_suite.id
                row['task_suite_creation_date'] = task_suite.created.strftime("%Y-%m-%d %H:%M:%S")
                row['task_suite_remaining_overlap'] = task_suite.remaining_overlap
                row['task_suite_mixed'] = task_suite.mixed
                row['task_suite_latitude'] = task_suite.latitude
                row['task_suite_longitude'] = task_suite.longitude
                task_suites_counter = task_suites_counter + 1
                for assignment in toloka_client.find_assignments(task_suite_id=task_suite.id, sort=['created']).items:
                    row['assignment_id'] = assignment.id
                    row['assignment_user_id'] = assignment.user_id
                    row['assignment_comment'] = assignment.public_comment
                    row['assignment_status'] = assignment.status.value
                    row['assignment_creation_date'] = assignment.created.strftime("%Y-%m-%d %H:%M:%S")
                    row['assignment_accept_date'] = assignment.accepted.strftime("%Y-%m-%d %H:%M:%S") if assignment.accepted else np.nan
                    row['assignment_submit_date'] = assignment.submitted.strftime("%Y-%m-%d %H:%M:%S") if assignment.submitted else np.nan
                    row['assignment_expire_date'] = assignment.expired.strftime("%Y-%m-%d %H:%M:%S") if assignment.expired else np.nan
                    row['assignment_skip_date'] = assignment.skipped.strftime("%Y-%m-%d %H:%M:%S") if assignment.skipped else np.nan
                    row['assignment_reject_date'] = assignment.rejected.strftime("%Y-%m-%d %H:%M:%S") if assignment.rejected else np.nan
                    if assignment.tasks:
                        if assignment.tasks[0].input_values:
                            row['assignment_token_input'] = assignment.tasks[0].input_values['token_input'] if 'token_input' in assignment.tasks[0].input_values else np.nan
                        else:
                            row['assignment_token_input'] = np.nan
                    else:
                        row['assignment_token_input'] = np.nan
                    if assignment.solutions:
                        if assignment.solutions[0].output_values:
                            row['assignment_token_input_final'] = assignment.solutions[0].output_values['token_input'] if 'token_input' in assignment.solutions[0].output_values else np.nan
                        else:
                            row['assignment_token_input_final'] = np.nan
                    else:
                        row['assignment_token_output'] = np.nan
                    if assignment.solutions:
                        if assignment.solutions[0].output_values:
                            row['assignment_token_output'] = assignment.solutions[0].output_values['token_output'] if 'token_output' in assignment.solutions[0].output_values else np.nan
                        else:
                            row['assignment_token_output'] = np.nan
                    else:
                        row['assignment_token_output'] = np.nan
                    row['assignment_reward'] = assignment.reward
                    row['assignment_rejected'] = assignment.rejected
                    row['assignment_automerged'] = assignment.automerged
                    row['assignment_mixed'] = assignment.mixed
                    user_metadata = requests.get(f"https://toloka.yandex.com/api/v1/user-metadata/{assignment.user_id}", headers={'Authorization': f"OAuth {toloka_oauth_token}"}).json()
                    row['user_id'] = assignment.user_id
                    row['user_country'] = user_metadata['country']
                    row['user_languages'] = ':::'.join(user_metadata['languages'])
                    row['user_country_by_phone'] = user_metadata['attributes']['country_by_phone'] if 'country_by_phone' in user_metadata['attributes'] else np.nan
                    row['user_country_by_ip'] = user_metadata['attributes']['country_by_ip'] if 'country_by_ip' in user_metadata['attributes'] else np.nan
                    row['user_client_type'] = user_metadata['attributes']['client_type'] if 'client_type' in user_metadata['attributes'] else np.nan
                    row['user_agent_type'] = user_metadata['attributes']['user_agent_type'] if 'user_agent_type' in user_metadata['attributes'] else np.nan
                    row['user_device_category'] = user_metadata['attributes']['device_category'] if 'device_category' in user_metadata['attributes'] else np.nan
                    row['user_os_family'] = user_metadata['attributes']['os_family']  if 'os_family' in user_metadata['attributes'] else np.nan
                    row['user_os_version'] = user_metadata['attributes']['os_version'] if 'os_version' in user_metadata['attributes'] else np.nan
                    row['user_os_version_major'] = user_metadata['attributes']['os_version_major'] if 'os_version_major' in user_metadata['attributes'] else np.nan
                    row['user_os_version_minor'] = user_metadata['attributes']['os_version_minor'] if 'os_version_minor' in user_metadata['attributes'] else np.nan
                    row['user_os_version_bugfix'] = user_metadata['attributes']['os_version_bugfix'] if 'os_version_bugfix' in user_metadata['attributes'] else np.nan
                    row['user_adult_allowed'] = user_metadata['adult_allowed']
                    acl_rows = df_acl_copy.loc[(df_acl_copy['token_output'] == row['assignment_token_output']) & (df_acl_copy['platform'] == 'toloka')  & (df_acl_copy['generated'] == True)]
                    if len(acl_rows) > 1:
                        acl_rows = acl_rows.sort_values(by='time_arrival', ascending=False)
                        acl_rows = acl_rows.head(1)
                        row['worker_id'] = acl_rows['worker_id'].values[0]
                        df_acl_copy.at[acl_rows.index.values[0], 'generated'] = False
                    else:
                        if len(acl_rows['worker_id'].values) > 0:
                            row['worker_id'] = acl_rows['worker_id'].values[0]
                        else:
                            row['worker_id'] = np.nan
                    assignments_counter = assignments_counter + 1
                    df_toloka.loc[len(df_toloka)] = row

        df_toloka.to_csv(df_toloka_data_path, index=False)

        console.print(f"Pools found for the current task: [green]{pool_counter}[/green]")
        console.print(f"Task suites found for the current task: [green]{task_suites_counter}[/green]")
        console.print(f"Assignments found for the current task: [green]{assignments_counter}[/green]")

        console.print(f"Dataframe shape: {df_toloka.shape}")
        console.print(f"Toloka data file serialized at path: [cyan on black]{df_toloka_data_path}")

    else:
        toloka_data_df = pd.read_csv(df_toloka_data_path)
        console.print(f"Toloka dataframe [yellow]already detected[/yellow], skipping creation")
        console.print(f"Serialized at path: [cyan on black]{df_toloka_data_path}")

if 'prolific' in platforms:

    console.rule(f"{step_index} - Fetching Prolific Data")
    step_index = step_index + 1

    column_names = [
        "workspace_id",
        "project_id",
        "study_id",
        "study_date_created",
        "study_date_created_parsed",
        "study_date_published",
        "study_date_published_parsed",
        "study_name",
        "study_name_internal",
        "study_completion_code",
        "study_completion_option",
        "study_completion_option_id",
        "study_status",
        "study_type",
        "study_share_id",
        "study_participant_eligible_count",
        "study_participant_pool_total",
        "study_number_of_submissions",
        "study_places_taken",
        "study_places_total_available",
        "study_places_total_cost",
        "study_fees_per_submission",
        "study_fees_percentage",
        "study_fees_percentage_service_margin",
        "study_fees_percentage_vat",
        "study_fees_discount_from_coupon",
        "study_fees_stars_remaining",
        "study_receipt",
        "study_currency_code",
        "study_reward",
        "study_reward_average_per_hour",
        "study_reward_average_per_hour_without_adjustment",
        "study_reward_level_below_original_estimate",
        "study_reward_level_below_prolific_min",
        "study_reward_has_had_adjustment",
        "study_time_allowed_maximum",
        "study_time_average_taken",
        "study_time_completion_estimated",
        "study_time_allowed_maximum",
        "study_is_reallocated",
        "study_is_underpaying",
        "study_privacy_notice",
        "study_device_compatibility",
        "study_peripheral_requirements",
        "study_url_external",
        'submission_id',
        'submission_status',
        'submission_study_code',
        'submission_date_started',
        'submission_date_started_parsed',
        'submission_date_completed',
        'submission_date_completed_parsed',
        'submission_is_complete',
        'submission_time_elapsed_seconds',
        'submission_reward',
        'submission_star_awarded',
        'participant_id',
        'participant_ip',
        'participant_date_birth',
        'participant_ethnicity_simplified',
        'participant_sex'
    ]

    if not os.path.exists(df_prolific_data_path):

        df_prolific = pd.DataFrame(columns=column_names)

        study_list = requests.get(f"https://api.prolific.co/api/v1/studies/", headers={'Authorization': f"Token {prolific_api_token}"}).json()['results']

        study_counter = 0
        submissions_counter = 0

        for study_data in study_list:

            if task_name in study_data['internal_name']:
                study_current = None
                if batch_prefix is not None:
                    if batch_prefix in study_data['internal_name']:
                        study_current = study_data
                else:
                    study_current = study_data
                if study_current is not None:

                    console.print(f"Processing study [cyan]{study_current['internal_name']}")

                    submissions_counter+=1

                    if int(study_current['number_of_submissions']) > 0:

                        study_current_add = requests.get(f"https://api.prolific.co/api/v1/studies/{study_current['id']}/", headers={'Authorization': f"Token {prolific_api_token}"}).json()
                        del study_current_add['eligibility_requirements']
                        del study_current_add['description']

                        submissions_list=[]
                        submissions_list_response = None
                        while submissions_list_response is None or 'next' in submissions_list_response['_links']:
                            if not submissions_list_response:
                                submissions_list_response = requests.get(f"https://api.prolific.co/api/v1/studies/{study_current['id']}/submissions/", headers={'Authorization': f"Token {prolific_api_token}"}).json()
                                for submission_current in submissions_list_response['results']:
                                    submissions_list.append(submission_current)
                            else:
                                submission_page_next = submissions_list_response['_links']['next']['href']
                                if submission_page_next is None:
                                    break
                                else:
                                    submissions_list_response = requests.get(submission_page_next, headers={'Authorization': f"Token {prolific_api_token}"}).json()
                                    for submission_current in submissions_list_response['results']:
                                        submissions_list.append(submission_current)

                        row = {
                            "workspace_id": study_current_add['workspace'],
                            "project_id": study_current_add['project'],
                            "study_id": study_current['id'],
                            "study_date_created": study_current['date_created'],
                            "study_date_created_parsed": find_date_string(study_current['date_created']),
                            "study_date_published": study_current_add['published_at'] if study_current_add['published_at'] else np.nan,
                            "study_date_published_parsed": find_date_string(study_current_add['published_at']) if study_current_add['published_at'] else np.nan,
                            "study_name": study_current['name'],
                            "study_name_internal": study_current['internal_name'],
                            "study_completion_code": study_current_add['completion_code'],
                            "study_completion_option": study_current_add['completion_option'],
                            "study_completion_option_id": study_current_add['prolific_id_option'],
                            "study_status": study_current['status'],
                            "study_type": study_current['study_type'],
                            "study_share_id": study_current_add['share_id'],
                            "study_participant_eligible_count": int(study_current_add['eligible_participant_count']),
                            "study_participant_pool_total": int(study_current_add['total_participant_pool']),
                            "study_number_of_submissions": int(study_current['number_of_submissions']),
                            "study_places_taken": int(study_current['places_taken']),
                            "study_places_total_available": int(study_current['total_available_places']),
                            "study_places_total_cost": float(study_current['total_cost']),
                            "study_fees_per_submission": float(study_current_add['fees_per_submission']),
                            "study_fees_percentage": float(study_current_add['fees_percentage']),
                            "study_fees_percentage_service_margin": float(study_current_add['service_margin_percentage']),
                            "study_fees_percentage_vat": float(study_current_add['vat_percentage']),
                            "study_fees_discount_from_coupon": float(study_current_add['discount_from_coupons']),
                            "study_fees_stars_remaining": float(study_current_add['stars_remaining']),
                            "study_receipt": float(study_current_add['receipt']) if study_current_add['receipt'] else np.nan,
                            "study_currency_code": study_current_add['currency_code'],
                            "study_reward": float(study_current['reward']),
                            "study_reward_minimum_per_hour": float(study_current_add['minimum_reward_per_hour']),
                            "study_reward_average_per_hour": float(study_current_add['average_reward_per_hour']),
                            "study_reward_average_per_hour_without_adjustment": float(study_current_add['average_reward_per_hour_without_adjustment']),
                            "study_reward_has_had_adjustment": study_current_add['has_had_adjustment'],
                            "study_reward_level_below_original_estimate": study_current['reward_level']['below_original_estimate'],
                            "study_reward_level_below_prolific_min": study_current['reward_level']['below_prolific_min'],
                            "study_time_allowed_maximum": float(study_current_add['maximum_allowed_time']),
                            "study_time_average_taken": float(study_current_add['average_time_taken']),
                            "study_time_completion_estimated": float(study_current_add['estimated_completion_time']),
                            "study_is_reallocated": study_current['is_reallocated'],
                            "study_is_underpaying": study_current['is_underpaying'],
                            "study_privacy_notice": study_current['privacy_notice'],
                            "study_publish_at": study_current['publish_at'],
                            "study_device_compatibility": ':::'.join(study_current_add['device_compatibility']),
                            "study_peripheral_requirements": ':::'.join(study_current_add['peripheral_requirements']) if len(study_current_add['peripheral_requirements'])>0 else np.nan,
                            "study_url_external": study_current_add['external_study_url']
                        }

                        for submission_current in submissions_list:

                            submissions_counter+=1

                            row['participant_id'] = submission_current['participant_id']
                            row['participant_ip'] = submission_current['ip']
                            row['participant_date_birth'] = submission_current['strata']['date of birth']
                            row['participant_ethnicity_simplified'] = submission_current['strata']['ethnicity (simplified)']
                            row['participant_sex'] = submission_current['strata']['sex']
                            row['submission_id'] = submission_current['id']
                            row['submission_status'] = submission_current['status']
                            row['submission_study_code'] = submission_current['study_code']
                            row['submission_date_started'] = submission_current['started_at'] if submission_current['started_at'] else np.nan
                            row['submission_date_started_parsed'] = find_date_string(submission_current['started_at']) if submission_current['started_at'] else np.nan
                            row['submission_date_completed'] = submission_current['completed_at'] if submission_current['completed_at'] else np.nan
                            row['submission_date_completed_parsed'] = find_date_string(submission_current['completed_at']) if submission_current['completed_at'] else np.nan
                            row['submission_is_complete'] = submission_current['is_complete']
                            row['submission_time_elapsed_seconds'] = submission_current['time_taken'] if submission_current['time_taken'] else np.nan
                            row['submission_reward'] = float(submission_current['reward'])
                            row['submission_star_awarded'] = float(submission_current['star_awarded'])
                            row['submission_bonus_payments'] = ':::'.join([str(i) for i in submission_current['bonus_payments']])

                            df_prolific.loc[len(df_prolific)] = row

        console.print(f"Study found for the current task: [green]{study_counter}[/green]")
        console.print(f"Submissions found for the current task: [green]{submissions_counter}[/green]")
        console.print(f"Dataframe shape: {df_prolific.shape}")
        if df_prolific.shape[0] > 0:
            df_prolific.to_csv(df_prolific_data_path, index=False)
            console.print(f"Prolific dataframe serialized at path: [cyan on black]{df_prolific_data_path}")
        else:
            console.print(f"Dataframe shape: {df_prolific.shape}")
            console.print(f"Prolific dataframe [yellow]empty[/yellow], dataframe not serialized.")

    else:

        df_prolific = pd.read_csv(df_prolific_data_path)
        console.print(f"Prolific dataframe [yellow]already detected[/yellow], skipping creation")
        console.print(f"Serialized at path: [cyan on black]{df_prolific_data_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_info[/cyan on white] Dataframe")
step_index = step_index + 1

def merge_dicts(dicts):
    d = {}
    for dict_current in dicts:
        for key in dict_current.keys():
            try:
                d[key].append(dict_current[key])
            except KeyError:
                d[key] = [dict_current[key]]
    keys_filter = []
    for item in d:
        if len(d[item]) > 1:
            seen = set()
            lst = np.unique(list(filter(None, d[item])))
            lst = [x for x in lst if x.lower() not in seen and not seen.add(x.lower())]
            d[item] = ":::".join(lst)
        else:
            if d[item][0] is not None:
                d[item] = d[item].pop()
            else:
                keys_filter.append(item)
    for item in keys_filter:
        d.pop(item)
    return d


def fetch_uag_data(worker_id, worker_uag):
    data = {}
    if worker_uag:
        uag_file = f"{resources_path}{worker_id}_uag.json"
        if os.path.exists(uag_file):
            ua_data = load_json(uag_file)
        else:
            try:
                ua_data = []
                if user_stack_token:
                    url = f"http://api.userstack.com/detect?access_key={user_stack_token}&ua={worker_uag}"
                    response = requests.get(url)
                    data_fetched = flatten(response.json())
                    if 'success' in data_fetched.keys():
                        if not data_fetched['success']:
                            raise ValueError(f"Request to Userstack UAG detection service failed with error code {data_fetched['error_code']}. Remove of replace your `user_stack_token`")
                    ua_data.append(data_fetched)
                if ip_geolocation_api_key:
                    url = f"https://api.ipgeolocation.io/user-agent?apiKey={ip_geolocation_api_key}"
                    response = requests.get(url, headers={'User-Agent': worker_uag})
                    if response.status_code != 200:
                        raise ValueError(f"Request to IP Geolocation UAG detection service (user-agent endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
                    else:
                        data_fetched = flatten(requests.get(url, headers={'User-Agent': worker_uag}).json())
                    ua_data.append(data_fetched)
                ua_data = merge_dicts(ua_data)
                ua_data = {camel_to_snake(key): ua_data[key] for key in ua_data}
                with open(uag_file, 'w', encoding='utf-8') as f:
                    json.dump(ua_data, f, ensure_ascii=False, indent=4)
            except ValueError as error:
                console.print(f"[red]{error}")
                sys.exit(1)
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
            try:
                ip_data = []
                if ip_info_token:
                    ip_info_handler = ipinfo.getHandler(ip_info_token)
                    ip_data.append(flatten(ip_info_handler.getDetails(worker_ip).all))
                if ip_geolocation_api_key:
                    url = f"https://api.ipgeolocation.io/ipgeo?apiKey={ip_geolocation_api_key}&ip={worker_ip}&include=hostnameFallbackLive,security"
                    data_fixed = {}
                    response = requests.get(url)
                    if response.status_code == 423:
                        console.print(f"Bogon detected: {worker_ip}")
                    else:
                        if response.status_code != 200:
                            raise ValueError(f"Request to IP Geolocation service (ipgeo endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
                        else:
                            for key, item in flatten(response.json()).items():
                                if key.startswith('geo_'):
                                    data_fixed[key.replace('geo_', '')] = item
                                else:
                                    data_fixed[key] = item
                    ip_data.append(data_fixed)
                    url = f"https://api.ipgeolocation.io/timezone?apiKey={ip_geolocation_api_key}&ip={worker_ip}"
                    data_fixed = {}
                    response = requests.get(url)
                    if response.status_code == 423:
                        pass
                    else:
                        if response.status_code != 200:
                            raise ValueError(f"Request to IP Geolocation service (timezone endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
                        else:
                            for key, item in flatten(response.json()).items():
                                if key.startswith('timezone_') or key.startswith('geo_'):
                                    key_fixed = key.replace('timezone_', '').replace('geo_', '')
                                    data_fixed[key_fixed] = item
                                else:
                                    data_fixed[key] = item
                    ip_data.append(data_fixed)
                    url = f"https://api.ipgeolocation.io/astronomy?apiKey={ip_geolocation_api_key}&ip={worker_ip}"
                    data_fixed = {}
                    response = requests.get(url)
                    if response.status_code == 423:
                        pass
                    else:
                        if response.status_code != 200:
                            raise ValueError(f"Request to IP Geolocation service (astronomy endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
                        else:
                            for key, item in flatten(response.json()).items():
                                if key.startswith('location_'):
                                    data_fixed[key.replace('location_', '')] = item
                                else:
                                    data_fixed[key] = item
                    ip_data.append(data_fixed)
                if ip_api_api_key:
                    url = f"http://api.ipapi.com/{worker_ip}?access_key={ip_api_api_key}"
                    response = requests.get(url)
                    data_fetched = flatten(response.json())
                    if 'success' in data_fetched.keys():
                        if not data_fetched['success']:
                            raise ValueError(f"Request to IPApi IP detection service failed with error code {data_fetched['error_code']}. Remove of replace your `ipapi_api_key`")
                    data_fetched = flatten(requests.get(url).json())
                    if 'location_languages' in data_fetched:
                        location_languages = data_fetched.pop('location_languages')
                        for index, lang_data in enumerate(location_languages):
                            for key, value in lang_data.items():
                                data_fetched[f"location_language_{index}_{key}"] = value
                    ip_data.append(data_fetched)
                ip_data = merge_dicts(ip_data)
                ip_data = {camel_to_snake(key): ip_data[key] for key in ip_data}
                with open(ip_file, 'w', encoding='utf-8') as f:
                    json.dump(ip_data, f, ensure_ascii=False, indent=4)
            except ValueError as error:
                console.print(f"[red]{error}")
                sys.exit(1)
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

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        snapshot = find_snapshot_for_record(acl_record)

        snapshot['uag'] = {}
        snapshot['ip'] = {}

        snapshot['uag'].update(fetch_uag_data(worker_id, acl_record['user_agent']))
        snapshot['ip'].update(fetch_ip_data(worker_id, acl_record['ip_address']))

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
    df_info = pd.read_csv(df_info_path)
    console.print(f"Workers info dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_info_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_logs[/cyan on white] Dataframe")
step_index = step_index + 1

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
    "time_server_parsed",
    "time_client_parsed"
]
counter = 0

if not os.path.exists(df_log_path):

    os.makedirs(df_log_partial_folder_path, exist_ok=True)

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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
                                'time_server_parsed': find_date_string(data_log['time_server']),
                                'time_client': data_log['time_client'],
                                'time_client_parsed': find_date_string(data_log['time_client']),
                                'type': data_log['type'],
                            }

                            log_details = data_log['details']

                            if log_details:
                                if data_log['type'] == 'keySequence':
                                    if 'log_section' not in dataframe.columns:
                                        dataframe['log_section'] = np.nan
                                    if 'log_key_sequence_index' not in dataframe.columns:
                                        dataframe['log_key_sequence_index'] = np.nan
                                    if 'log_key_sequence_timestamp' not in dataframe.columns:
                                        dataframe['log_key_sequence_timestamp'] = np.nan
                                    if 'log_key_sequence_key' not in dataframe.columns:
                                        dataframe['log_key_sequence_key'] = np.nan
                                    if 'log_sentence' not in dataframe.columns:
                                        dataframe['log_sentence'] = np.nan
                                    row['log_section'] = log_details['section']
                                    row['log_sentence'] = log_details['sentence']
                                    for index, key_sequence in enumerate(log_details['keySequence']):
                                        row['log_key_sequence_index'] = index
                                        row['log_key_sequence_timestamp'] = key_sequence['timeStamp']
                                        row['log_key_sequence_key'] = key_sequence['key'] if 'key' in key_sequence else np.nan
                                        dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'movements':
                                    for attribute, value in log_details.items():
                                        attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                        attribute_parsed = f"log_{attribute_parsed}"
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
                                                    attribute_sub_parsed = f"log_point_{attribute_parsed}_{attribute_sub_parsed}"
                                                    if attribute_sub_parsed not in dataframe.columns:
                                                        dataframe[attribute_sub_parsed] = np.nan
                                                    row[attribute_sub_parsed] = value_sub
                                            else:
                                                attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                                attribute_parsed = f"log_point_{attribute_parsed}"
                                                if attribute_parsed not in dataframe.columns:
                                                    dataframe[attribute_parsed] = np.nan
                                                row[attribute_parsed] = value
                                        dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'click':
                                    for attribute, value in log_details.items():
                                        attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                        attribute_parsed = f"log_{attribute_parsed}"
                                        if type(value) != dict and type(value) != list:
                                            if attribute_parsed not in dataframe.columns:
                                                dataframe[attribute_parsed] = np.nan
                                            row[attribute_parsed] = value
                                    for attribute, value in log_details['target'].items():
                                        attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                        attribute_parsed = f"log_target_{attribute_parsed}"
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        row[attribute_parsed] = value
                                    dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'queryResults':
                                    if 'log_section' not in dataframe.columns:
                                        dataframe['log_section'] = np.nan
                                    if 'log_url_amount' not in dataframe.columns:
                                        dataframe['log_url_amount'] = np.nan
                                    row['log_section'] = log_details['section']
                                    if 'urlAmount' in log_details:
                                        row['log_url_amount'] = log_details['urlAmount']
                                    else:
                                        row['log_url_amount'] = len(log_details['urlArray'])
                                elif data_log['type'] == 'copy' or data_log['type'] == 'cut':
                                    for attribute, value in log_details.items():
                                        attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        if attribute_parsed == 'target':
                                            row[attribute_parsed] = value.replace("\n", '')
                                    dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'context':
                                    for detail_kind, detail_val in log_details.items():
                                        detail_kind_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', detail_kind).lower()}"
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
                                        attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        row[attribute_parsed] = value
                                    dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'selection':
                                    for attribute, value in log_details.items():
                                        attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        if attribute_parsed == 'selected':
                                            row[attribute_parsed] = value.replace("\n", '')
                                    dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'paste' or data_log['type'] == 'text':
                                    for attribute, value in log_details.items():
                                        attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                        if attribute_parsed not in dataframe.columns:
                                            dataframe[attribute_parsed] = np.nan
                                        if attribute_parsed == 'text':
                                            row[attribute_parsed] = value.replace("\n", '')
                                    dataframe.loc[len(dataframe)] = row
                                elif data_log['type'] == 'query':
                                    if 'log_section' not in dataframe.columns:
                                        dataframe['log_section'] = np.nan
                                    if 'log_query' not in dataframe.columns:
                                        dataframe['log_query'] = np.nan
                                    row['log_section'] = log_details['section']
                                    row['log_query'] = log_details['query'].replace("\n", '')
                                    dataframe.loc[len(dataframe)] = row
                                else:
                                    print(data_log['type'])
                                    print(log_details)
                                    assert False
                            else:
                                dataframe.loc[len(dataframe)] = row

                    if len(dataframe) > 0:
                        dataframe.to_csv(log_df_partial_path, index=False)

    dataframes_partial = []
    df_partials_paths = glob(f"{df_log_partial_folder_path}/*")

    console.print(f"Merging together {len(df_partials_paths)} partial log dataframes")

    for df_partial_path in tqdm.tqdm(df_partials_paths):
        partial_df = pd.read_csv(df_partial_path)
        if partial_df.shape[0] > 0:
            dataframes_partial.append(partial_df)
    if len(dataframes_partial) > 0:
        dataframe = pd.concat(dataframes_partial, ignore_index=True)
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe.sort_values(by=['worker_id', 'sequence'], ascending=True, inplace=True)
        dataframe.to_csv(df_log_path, index=False)
        console.print(f"Log data found: [green]{len(dataframe)}")
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

console.rule(f"{step_index} - Building [cyan on white]workers_comments[/cyan on white] dataframe")
step_index = step_index + 1


def load_comment_col_names():
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("time_submit")
    columns.append("time_submit_parsed")
    columns.append("try_current")
    columns.append("sequence_number")
    columns.append("text")

    return columns


dataframe = pd.DataFrame()

if not os.path.exists(df_comm_path):

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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

                    if len(comment['serialization']['comment']) > 0:
                        row['try_current'] = comment['serialization']['info']['try']
                        row['time_submit'] = comment['time_submit']
                        row['time_submit_parsed'] = find_date_string(row['time_submit'])
                        row['sequence_number'] = comment['serialization']['info']['sequence']
                        row['text'] = sanitize_string(comment['serialization']['comment'])
                        dataframe = dataframe.append(row, ignore_index=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
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

console.rule(f"{step_index} - Building [cyan on white]workers_questionnaire[/cyan on white] dataframe")
step_index = step_index + 1


def load_quest_col_names(questionnaires):
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_current")
    columns.append("action")
    columns.append("time_submit")
    columns.append("time_submit_parsed")

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
            if 'dropped' in question:
                if not question['dropped']:
                    for attribute, value in question.items():
                        if type(value) != list:
                            column_name = f"question_attribute_{attribute}"
                            if column_name not in columns:
                                columns.append(column_name)
            else:
                for attribute, value in question.items():
                    if type(value) != list:
                        column_name = f"question_attribute_{attribute}"
                        if column_name not in columns:
                            columns.append(column_name)
        columns.append(f"question_answers_values")
        columns.append(f"question_answers_labels")
        columns.append(f"question_answer_value")
        columns.append(f"question_answer_text")
        columns.append(f"question_answer_free_text")
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
            if question_name_parsed == question["nameFull"] or question_name_parsed in question['nameFull']:
                if type(answer_current) == dict:
                    selected_options = ""
                    for option, selected in answer_current.items():
                        if selected:
                            selected_options = f"{selected_options}{option};"
                    if len(selected_options) > 0:
                        selected_options = selected_options[:-1]
                    answer_value = selected_options
                else:
                    answer_value = answer_current
        if '_free_text' in control_name:
            question_name_parsed = control_name.replace("_free_text", "")
            if question_name_parsed == question["nameFull"]:
                answer_free_text = answer_current

    for attribute, value in question.items():
        if attribute == 'answers':
            values = []
            labels = []
            for index, answer in enumerate(value):
                values.append(str(index))
                labels.append(answer)
            row['question_answers_values'] = ':::'.join(values)
            row['question_answers_labels'] = ':::'.join(labels)
        if type(value) != list:
            row[f"question_attribute_{attribute}"] = value
    if question['type'] != 'mcq' and question['type'] != 'list':
        row['question_answers_values'] = None
        row['question_answers_labels'] = None
    row[f"question_answer_value"] = answer_value
    row[f"question_answer_free_text"] = answer_free_text

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
        for questionnaire_mapping in questionnaire['mappings']:
            if questionnaire_mapping['value'] == answer_value:
                row[f"question_answer_mapping_index"] = questionnaire_mapping['index']
                row[f"question_answer_mapping_key"] = questionnaire_mapping['key'] if "key" in questionnaire_mapping else None
                row[f"question_answer_mapping_label"] = questionnaire_mapping['label']
                row[f"question_answer_mapping_value"] = int(questionnaire_mapping['value'])

    return row

dataframe = pd.DataFrame()

if not os.path.exists(df_quest_path):

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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
                    row['time_submit_parsed'] = find_date_string(row['time_submit'])

                    questionnaire = questionnaires[questionnaire_data['serialization']['info']['index']]
                    questions = None
                    if 'questions' in questionnaire_data['serialization']:
                        questions = questionnaire_data['serialization']['questions']
                    else:
                        questions = questionnaire['questions']
                    current_answers = questionnaire_data['serialization']['answers']
                    timestamps_elapsed = questionnaire_data['serialization']["timestamps_elapsed"]
                    info = questionnaire_data['serialization']["info"]
                    accesses = questionnaire_data['serialization']["accesses"]

                    row['action'] = info['action']
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

                        for index_sub, question in enumerate(questions):
                            if 'dropped' in question:
                                if not question['dropped']:
                                    row = parse_answers(row, questionnaire, question, current_answers)
                                    dataframe = dataframe.append(row, ignore_index=True)
                            else:
                                row = parse_answers(row, questionnaire, question, current_answers)
                                dataframe = dataframe.append(row, ignore_index=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["try_current"] = dataframe["try_current"].astype(int)
        dataframe["questionnaire_allow_back"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["questionnaire_allow_back"] = dataframe["questionnaire_allow_back"].astype(bool)
        dataframe["question_attribute_required"] = dataframe["question_attribute_required"].astype(bool)
        if 'question_attribute_freeText' in dataframe:
            dataframe["question_attribute_freeText"].replace({0.0: False, 1.0: True}, inplace=True)
            dataframe["question_attribute_freeText"] = dataframe["question_attribute_freeText"].astype(bool)
        if 'question_attribute_dropped' in dataframe:
            dataframe["question_attribute_dropped"].replace({0.0: False, 1.0: True}, inplace=True)
            dataframe["question_attribute_dropped"] = dataframe["question_attribute_dropped"].astype(bool)
        if 'question_attribute_showDetail' in dataframe:
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

console.rule(f"{step_index} - Building [cyan on white]workers_data[/cyan on white] dataframe")
step_index = step_index + 1


def load_data_col_names(dimensions, documents):
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_id")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_last")
    columns.append("try_current")
    columns.append("action")
    columns.append("time_submit")
    columns.append("time_submit_parsed")

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

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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

                for document_data in data_partial['documents_answers']:

                    row['action'] = document_data['serialization']['info']['action']
                    row['try_current'] = document_data['serialization']['info']['try']
                    row['time_submit'] = document_data['time_submit']
                    row['time_submit_parsed'] = find_date_string(row['time_submit'])

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
                            try:
                                row[f"doc_{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                            except KeyError:
                                print(current_answers)
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

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["try_last"] = dataframe["try_last"].astype(int)
        dataframe["try_current"] = dataframe["try_current"].astype(int)
        dataframe["global_outcome"] = dataframe["gold_checks"].astype(bool)
        dataframe["global_form_validity"] = dataframe["gold_checks"].astype(bool)
        dataframe["time_spent_check"] = dataframe["gold_checks"].astype(bool)
        dataframe["time_check_amount"] = dataframe["gold_checks"].astype(bool)
        dataframe["gold_checks"] = dataframe["gold_checks"].astype(bool)
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

console.rule(f"{step_index} - Building [cyan on white]workers_notes[/cyan on white] dataframe")
step_index = step_index + 1


def load_notes_col_names():
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_id")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_last")
    columns.append("try_current")
    columns.append("time_submit")
    columns.append("time_submit_parsed")

    columns.append("document_index")
    columns.append("attribute_index")

    columns.append("note_deleted")
    columns.append("note_ignored")
    columns.append("note_option_color")
    columns.append("note_option_label")
    columns.append("note_container_id")
    columns.append("note_index_start")
    columns.append("note_index_end")
    columns.append("note_timestamp_created")
    columns.append("note_timestamp_created_parsed")
    columns.append("note_timestamp_deleted")
    columns.append("note_timestamp_deleted_parsed")
    columns.append("note_base_url")
    columns.append("note_text_current")
    columns.append("note_text_raw")
    columns.append("note_text_left")
    columns.append("note_text_right")
    columns.append("note_existing_notes")

    return columns


dataframe = pd.DataFrame()

if not os.path.exists(df_notes_path):

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_paid = acl_record['paid']
        snapshots = find_snapshost_for_task(acl_record)

        for worker_snapshot in snapshots:

            task = worker_snapshot['task']
            documents = worker_snapshot['documents']
            data_partial = worker_snapshot['data_partial']

            column_names = load_notes_col_names()

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

                for document_data in data_partial['documents_answers']:

                    row['try_current'] = document_data['serialization']['info']['try']
                    row['time_submit'] = document_data['time_submit']
                    row['time_submit_parsed'] = find_date_string(row['time_submit'])

                    current_notes = document_data['serialization']['notes']

                    if len(current_notes) > 0:

                        for note_current in current_notes:
                            row['document_index'] = note_current['document_index']
                            row['attribute_index'] = note_current['attribute_index']
                            row['note_deleted'] = note_current['deleted'] == True
                            row['note_ignored'] = note_current['ignored'] == True
                            row['note_option_color'] = note_current['color']
                            row['note_option_label'] = note_current['option']
                            row['note_container_id'] = note_current['container_id']
                            row['note_index_start'] = int(note_current['index_start'])
                            row['note_index_end'] = int(note_current['index_end'])
                            row['note_timestamp_created'] = note_current['timestamp_created']
                            date = find_date_string(note_current['timestamp_created'])
                            row['note_timestamp_created_parsed'] = date
                            if note_current['timestamp_deleted'] == 0:
                                row['note_timestamp_deleted'] = np.nan
                                row['note_timestamp_deleted_parsed'] = np.nan
                            else:
                                row['note_timestamp_deleted'] = note_current['timestamp_deleted']
                                date = find_date_string(note_current['timestamp_deleted'])
                                row['note_timestamp_deleted_parsed'] = date
                            row['note_base_url'] = note_current['base_uri']
                            row['note_text_current'] = note_current['current_text']
                            row['note_text_raw'] = note_current['raw_text']
                            row['note_text_left'] = note_current['text_left']
                            row['note_text_right'] = note_current['text_right']

                        if ('time_submit') in row:
                            dataframe = dataframe.append(row, ignore_index=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["try_last"] = dataframe["try_last"].astype(int)
        dataframe["try_current"] = dataframe["try_current"].astype(int)
        dataframe["attribute_index"] = dataframe["attribute_index"].astype(int)
        dataframe["document_index"] = dataframe["document_index"].astype(int)
        dataframe["note_deleted"] = dataframe["document_index"].astype(bool)
        dataframe["note_ignored"] = dataframe["document_index"].astype(bool)
        dataframe["note_index_start"] = dataframe["note_index_start"].astype(int)
        dataframe["note_index_end"] = dataframe["note_index_end"].astype(int)
        dataframe.drop_duplicates(inplace=True)
        dataframe.to_csv(df_notes_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers data dataframe serialized at path: [cyan on white]{df_notes_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Workers data dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"Workers dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_notes_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_dimensions_selection[/cyan on white] dataframe")
step_index = step_index + 1

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

dataframe = pd.DataFrame(columns=[
    "worker_id",
    "paid",
    "task_id",
    "batch_name",
    "unit_id",
    'try_last',
    'try_current',
    'dimension_index',
    'dimension_name',
    'timestamp_start',
    'timestamp_start_parsed',
    'selection_index',
    'selection_value',
    'selection_label',
    'selection_timestamp',
    'selection_timestamp_parsed',
    'selection_time_elapsed',
    'timestamp_end',
    'timestamp_end_parsed',
    'document_index',
    'document_id'
])
dataframe['try_last'] = dataframe['try_last'].astype(int)
dataframe['try_current'] = dataframe['try_current'].astype(int)


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
            timestamp_selection_parsed = datetime.fromtimestamp(timestamp_selection)
            timestamp_parsed_previous = timestamps_found[counter - 1]
            time_elapsed = (timestamp_selection_parsed - timestamp_parsed_previous).total_seconds()
            if time_elapsed < 0:
                time_elapsed = (timestamp_parsed_previous - timestamp_selection_parsed).total_seconds()
            timestamps_found.append(timestamp_selection_parsed)

            row = {
                'worker_id': worker_id,
                'paid': worker_paid,
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
                'timestamp_start_parsed': find_date_string(timestamp_start, seconds=True),
                'selection_index': dimension_current['index'],
                'selection_value': dimension_current['value'],
                'selection_label': label,
                'selection_timestamp': dimension_current['timestamp'],
                'selection_timestamp_parsed': find_date_string(dimension_current['timestamp'], seconds=True),
                'selection_time_elapsed': time_elapsed,
                'timestamp_end': timestamp_end,
                'timestamp_end_parsed': find_date_string(timestamp_end, seconds=True)
            }
            df = df.append(row, ignore_index=True)

    return df


if not os.path.exists(df_dim_path) and os.path.exists(df_data_path):

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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

                timestamps_found = []

                for document_data in data_partial['documents_answers']:
                    timestamps_elapsed = document_data['serialization']["timestamps_elapsed"]
                    timestampsStart = document_data['serialization']["timestamps_start"]
                    timestampsEnd = document_data['serialization']["timestamps_end"]
                    info = document_data['serialization']["info"]

                    timestamp_first = timestamp_start
                    timestamp_first_parsed = datetime.fromtimestamp(timestamp_first)
                    timestamps_found = [timestamp_first_parsed]

                    counter = 0

                    dimensions_selected_data = [document_data['serialization']["dimensions_selected"]]

                    dataframe = parse_dimensions_selected(dataframe, worker_id, worker_paid, task, info, documents, dimensions, dimensions_selected_data, timestamp_start, timestamp_end)

    dataframe.drop_duplicates(inplace=True)

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["try_last"] = dataframe["try_last"].astype(int)
        dataframe["try_current"] = dataframe["try_current"].astype(int)
        dataframe.drop_duplicates(inplace=True)
        dataframe.to_csv(df_dim_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Dimension analysis dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Dimension analysis dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"Dimensions analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_dim_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_urls[/cyan on white] dataframe")
step_index = step_index + 1

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

dataframe = pd.DataFrame(columns=[
    "worker_id",
    "paid",
    "try_last",
    "try_current",
    "document_index",
    "document_id",
    "dimension_index",
    "dimension_name",
    "query_index",
    "query_text",
    "query_timestamp",
    "query_timestamp_parsed",
    "response_index",
    "response_url",
    "response_name",
    "response_snippet",
    "response_uuid",
    "index_selected"
])
dataframe['try_last'] = dataframe['try_last'].astype(float)
dataframe['try_current'] = dataframe['try_current'].astype(float)


def parse_responses(df, worker_id, worker_paid, task, info, queries, responses_retrieved, responses_selected):
    for index_current, responses_retrieved_document in enumerate(responses_retrieved):
        for index_current_sub, response_retrieved in enumerate(responses_retrieved_document["data"]):

            row = {
                "worker_id": worker_id,
                "paid": worker_paid,
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
            row['query_timestamp_parsed'] = find_date_string(response_retrieved['timestamp'])
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
            if len(row.index.values) > 0:
                df.at[row.index.values[0], 'index_selected'] = response_index

    return df


if not os.path.exists(df_url_path):

    for index, acl_record in tqdm.tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

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

                for document_data in data_partial['documents_answers']:
                    info = document_data['serialization']['info']
                    queries = document_data['serialization']['queries']
                    responses_retrieved = [document_data['serialization']['responses_retrieved']]
                    responses_selected = [document_data['serialization']['responses_selected']]

                    dataframe = parse_responses(dataframe, worker_id, worker_paid, task, info, queries, responses_retrieved, responses_selected)

    dataframe.drop_duplicates(inplace=True)
    unique_urls = np.unique(dataframe['response_url'].values)
    console.print(f"Generating UUIDs for {len(unique_urls)} unique URLs")
    for url in tqdm.tqdm(unique_urls):
        dataframe.loc[dataframe['response_url'] == url, 'response_uuid'] = uuid.uuid4()

    if dataframe.shape[0] > 0:
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        dataframe["paid"] = dataframe["paid"].astype(bool)
        dataframe["try_last"] = dataframe["try_last"].astype(int)
        dataframe["try_current"] = dataframe["try_current"].astype(int)
        dataframe.drop_duplicates(inplace=True)
        dataframe.to_csv(df_url_path, index=False)
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Worker urls dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Worker urls dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:
    console.print(f"URL analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_url_path}")

if enable_crawling:

    console.rule(f"{step_index} - Crawling Search Results")
    step_index = step_index + 1

    df_url = pd.read_csv(df_url_path)
    df_url.drop_duplicates(subset='response_url', inplace=True)
    unique_urls_amount = len(df_url)
    console.print(f"Unique URLs: [green]{len(df_url)}")

    if os.path.exists(df_crawl_path):
        df_crawl = pd.read_csv(df_crawl_path)
        console.print(f"Crawling dataframe [yellow]already detected[/yellow], loading in memory")
        df_crawl_correct = df_crawl[df_crawl["response_error_code"].isnull()]
        console.print(f"Pages correctly crawled: [green]{len(df_crawl_correct)}/{unique_urls_amount}[/green] [cyan]({(len(df_crawl_correct) / unique_urls_amount) * 100}%)")
        url_crawled = list(df_crawl_correct['response_url'].values)
        df_url = df_url[~df_url['response_url'].isin(url_crawled)]
    else:
        df_crawl = pd.DataFrame(columns=[
            'response_uuid',
            'response_url',
            'response_timestamp',
            'response_timestamp_parsed',
            "response_error_code",
            'response_source_path',
            'response_metadata_path'
        ])

    start = time_mod.time()

    # Initialize connection pool
    conn = aiohttp.TCPConnector(limit_per_host=100, limit=0, ttl_dns_cache=300)
    PARALLEL_REQUESTS = 100
    tasks = []
    errors = []
    results = []


    async def gather_with_concurrency(n):
        semaphore = asyncio.Semaphore(n)
        session = aiohttp.ClientSession(connector=conn)

        def build_response_dict(url, type, uuid, data, body=None):
            return {
                'url': url,
                'type': type,
                'uuid': uuid,
                'data': data,
                'body': body
            }

        # heres the logic for the generator
        async def get(row_url):
            response_url = row_url['response_url']
            response_uuid = row_url['response_uuid']
            async with semaphore:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.61/63 Safari/537.36 Edg/100.0.1185.39',
                    'Accept-Encoding': 'gzip'
                }
                try:
                    async with session.get(response_url, headers=headers, raise_for_status=True, timeout=30) as resp:
                        if 'octet-stream' in resp.content_type or 'application/pdf' in resp.content_type or 'application/vnd.openxmlformats-officedocument.presentationml.presentation' in resp.content_type:
                            return build_response_dict(response_url, 'data', response_uuid, resp, await resp.read())
                        elif 'text/html' in resp.content_type or 'text/plain' or 'json' in resp.content_type:
                            return build_response_dict(response_url, 'data', response_uuid, resp, await resp.text())
                        else:
                            print(response_url)
                            print(resp.content_type)
                            print(resp.content_disposition)
                            assert False
                except asyncio.TimeoutError as error:
                    error_code = 'timeout_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except ClientPayloadError as error:
                    error_code = 'client_payload_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except ClientConnectorError as error:
                    error_code = 'client_connector_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except ServerDisconnectedError as error:
                    error_code = 'server_disconnected_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except TooManyRedirects as error:
                    error_code = 'too_many_redirects_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except ClientOSError as error:
                    error_code = 'client_os_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except ClientResponseError as error:
                    error_code = 'client_os_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except UnicodeDecodeError as error:
                    error_code = 'unicode_decode_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)
                except UnicodeError as error:
                    error_code = 'unicode_error'
                    return build_response_dict(response_url, 'error', response_uuid, error, error_code)

        console.print("Generating asynchronous requests")
        for index, row_url in tqdm.tqdm(df_url.iterrows(), total=df_url.shape[0]):
            tasks.append(asyncio.create_task(get(row_url)))

        console.print("Processing asynchronous requests")
        for request_current in tqdm.tqdm(asyncio.as_completed(tasks), total=len(tasks)):
            result = await request_current
            result_url = result['url']
            result_type = result['type']
            result_uuid = result['uuid']
            result_data = result['data']
            result_body = result['body']
            result_metadata_path = f"{crawling_path_metadata}{result_uuid}_metadata.json"
            timestamp_now = datetime.now().timestamp()
            row = {
                'response_uuid': result_uuid,
                'response_url': result_url,
                'response_timestamp': timestamp_now,
                'response_timestamp_parsed': find_date_string(timestamp_now),
                "response_error_code": None,
                'response_source_path': None,
                'response_metadata_path': None,
            }
            if result_type == 'error':
                errors.append(result)
                row['response_error_code'] = result_body
                if hasattr(result_data, 'status'):
                    row['response_status_code'] = result_data.status
                with open(result_metadata_path, 'w', encoding="utf-8") as f:
                    json.dump({
                        'attributes': row,
                        'data': str(result_data)
                    }, f, ensure_ascii=False, indent=4)
            else:
                results.append(result)
                row['response_status_code'] = result_data.status
                try:
                    row['response_encoding'] = result_data.get_encoding().lower() if result_data.get_encoding() else None
                except RuntimeError:
                    row['response_encoding'] = None
                row['response_content_length'] = result_data.content_length
                row['response_content_type'] = result_data.content_length
                headers = flatten(result_data.headers)
                if 'Content-Type' in headers.keys():
                    result_source_path = None
                    row['response_content_type'] = headers['Content-Type']
                    if 'text/html' in row['response_content_type']:
                        result_source_path = f"{crawling_path_source}{result_uuid}_source.html"
                        with open(result_source_path, 'w', encoding=row['response_encoding']) as f:
                            f.write(result_body)
                    elif 'application/pdf' in row['response_content_type']:
                        result_source_path = f"{crawling_path_source}{result_uuid}_source.pdf"
                        with open(result_source_path, 'wb') as f:
                            f.write(result_body)
                    elif 'text/plain' in row['response_content_type']:
                        result_source_path = f"{crawling_path_source}{result_uuid}_source.txt"
                        with open(result_source_path, 'w', encoding=row['response_encoding']) as f:
                            f.write(result_body)
                    elif 'json' in row['response_content_type']:
                        response_content_decoded = result_body
                        result_source_path = f"{crawling_path_source}{result_uuid}_source.json"
                        with open(result_source_path, 'w', encoding=row['response_encoding']) as f:
                            f.write(response_content_decoded)
                    elif 'application/vnd.openxmlformats-officedocument.presentationml.presentation' in row['response_content_type']:
                        result_source_path = f"{crawling_path_source}{result_uuid}_source.pptx"
                        with open(result_source_path, 'wb') as f:
                            f.write(result_body)
                    elif 'application/octet-stream' in row['response_content_type']:
                        if 'Content-Disposition' in headers.keys():
                            row['response_content_disposition'] = headers['Content-Disposition']
                            content_disposition_split = row['response_content_disposition'].split(';')
                            content_disposition_type = content_disposition_split[0]
                            if content_disposition_type == 'attachment' and len(content_disposition_split) > 1:
                                content_disposition_attachment_filename = content_disposition_split[1].split("=")[1]
                                suffix = Path(content_disposition_attachment_filename).suffixes
                                result_source_path = f"{crawling_path_source}{result_uuid}_source{suffix}"
                                with open(result_source_path, 'wb') as f:
                                    f.write(result_body)
                        else:
                            suffix = Path(result_url).suffix
                            result_source_path = f"{crawling_path_source}{result_uuid}_source{suffix}"
                            with open(result_source_path, 'wb') as f:
                                f.write(result_body)
                row['response_source_path'] = result_source_path
                with open(result_metadata_path, 'w', encoding="utf-8") as f:
                    headers_lower = dict((camel_to_snake(k), v) for k, v in headers.items())
                    headers_lower_fix = {}
                    for attribute_fix, value_fix in headers_lower.items():
                        if type(value_fix) == str:
                            headers_lower_fix[attribute_fix] = value_fix.replace('\udc94', '')
                        else:
                            headers_lower_fix[attribute_fix] = value_fix
                    try:
                        json.dump({
                            'attributes': row,
                            'data': headers_lower_fix
                        }, f, ensure_ascii=False, indent=4)
                    except UnicodeEncodeError:
                        print(f"Unicode Encode error detected for page: {result_url}")
            row['response_metadata_path'] = result_metadata_path
            df_crawl.loc[len(df_crawl)] = row
            if len(df_crawl) % 1000 == 0:
                df_crawl.to_csv(df_crawl_path, index=False)

        await session.close()


    loop = asyncio.get_event_loop()
    loop.run_until_complete(gather_with_concurrency(PARALLEL_REQUESTS))
    conn.close()

    if df_crawl.shape[0] > 0:
        df_crawl.to_csv(df_crawl_path, index=False)
        df_crawl_correct = df_crawl[df_crawl["response_error_code"].isnull()]
        df_crawl_incorrect = df_crawl[df_crawl["response_error_code"] != np.nan]
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        dataframe.drop(empty_cols, axis=1, inplace=True)
        dataframe.drop_duplicates(inplace=True)
        console.print(f"Pages correctly crawled: [green]{len(df_crawl_correct)}/{unique_urls_amount}[/green] [cyan]({(len(df_crawl_correct) / unique_urls_amount) * 100}%)")
        console.print(f"Dataframe shape: {df_crawl.shape}")
        console.print(f"Worker crawling dataframe serialized at path: [cyan on white]{df_crawl_path}")
    else:
        console.print(f"Dataframe shape: {dataframe.shape}")
        console.print(f"Worker crawling dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:
    console.print(f"Worker URLs crawling [yellow]not enabled[/yellow], skipping")
