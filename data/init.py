#!/usr/bin/env python
# coding: utf-8

import json
import pprint
import docker
import os
import pandas as pd
import subprocess
import datefinder
import glob
import random
import hashlib
import shutil
import hmac
import textwrap
import boto3
import time
import warnings
import requests
import filecmp
import re
from mako.template import Template
from python_on_whales import DockerClient
from datetime import datetime
from zipfile import ZipFile
from distutils.util import strtobool
from pathlib import Path
from shutil import copy2
from botocore.exceptions import ClientError
from docker.errors import ImageNotFound
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import track
from dateutil import tz
from shared import handle_aws_error
from shared import serialize_json
from shared import read_json
from shared import remove_json

warnings.simplefilter(action='ignore', category=FutureWarning)

console = Console()

home = str(Path.home())
iam_path = '/Crowd_Frame/'

config_user_name = 'config-user'
mturk_user_name = 'mturk-user'

step_index = 1

console.rule(f"{step_index} - Initialization")
step_index = step_index + 1

# ------------------------------------------------------------------
# Resolve project roots (do not depend on the current working dir)
# init.py path: <project-root>/data/init.py
# ------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parent  # <project-root>/data
CORE_DIR = DATA_DIR.parent  # <project-root>

# ------------------------------------------------------------------
# Paths (anchored to DATA_DIR / CORE_DIR)
# ------------------------------------------------------------------

folder_aws_path = f"{DATA_DIR}/aws/"
folder_aws_generated_path = f"{DATA_DIR}/aws/generated/"

folder_build_path = f"{DATA_DIR}/build/"
folder_build_config_path = f"{DATA_DIR}/build/config/"
folder_build_task_path = f"{DATA_DIR}/build/task/"
folder_build_mturk_path = f"{DATA_DIR}/build/mturk/"
folder_build_toloka_path = f"{DATA_DIR}/build/toloka/"
folder_build_env_path = f"{DATA_DIR}/build/environments/"
folder_build_deploy_path = f"{DATA_DIR}/build/deploy/"
folder_build_skeleton_path = f"{DATA_DIR}/build/skeleton/"

folder_tasks_path = f"{DATA_DIR}/tasks/"
folder_locales_path = f"{CORE_DIR}/src/locale/"

filename_hits_config = "hits.json"
filename_dimensions_config = "dimensions.json"
filename_instructions_general_config = "instructions_general.json"
filename_instructions_evaluation_config = "instructions_evaluation.json"
filename_questionnaires_config = "questionnaires.json"
filename_search_engine_config = "search_engine.json"
filename_task_settings_config = "task.json"
filename_workers_settings_config = "workers.json"


def stop_sequence():
    console.print('\n\n')
    with console.status("Stopping the ship...", spinner="aesthetic"):
        exit()


def key_cont():
    console.input('[yellow]Press enter to continue...')


# ------------------------------------------------------------------
# Load .env (data/.env only)
# ------------------------------------------------------------------

env_path = DATA_DIR / ".env"
if not env_path.exists():
    raise FileNotFoundError(f".env not found at expected path: {env_path}")

load_dotenv(dotenv_path=env_path)
console.print(f".env loaded from: [bold]{env_path}[/bold]")

mail_contact = os.getenv('mail_contact')
platform = os.getenv('platform')
profile_name = os.getenv('profile_name')
task_name = os.getenv('task_name')
batch_name = os.getenv('batch_name')
task_title = os.getenv('task_title')
batch_prefix = os.getenv('batch_prefix')
admin_user = os.getenv('admin_user')
admin_password = os.getenv('admin_password')
server_config = os.getenv('server_config')
enable_solver = strtobool(os.getenv('enable_solver')) if os.getenv('enable_solver') is not None else False
aws_region = os.getenv('aws_region')
language_code = os.getenv('language_code')
aws_private_bucket = os.getenv('aws_private_bucket')
aws_deploy_bucket = os.getenv('aws_deploy_bucket')
aws_dataset_bucket = os.getenv('aws_dataset_bucket')
toloka_oauth_token = os.getenv('toloka_oauth_token')
prolific_completion_code = os.getenv('prolific_completion_code')
prolific_api_token = os.getenv('prolific_api_token')
prolific_project_id = os.getenv('prolific_project_id')
budget_limit = os.getenv('budget_limit')
brave_api_key = os.getenv('brave_api_key')
pubmed_api_key = os.getenv('pubmed_api_key')
google_api_key = os.getenv('google_api_key')
google_cx = os.getenv('google_cx')
ip_info_token = os.getenv('ip_info_token')
ip_geolocation_api_key = os.getenv('ip_geolocation_api_key')
ip_api_api_key = os.getenv('ip_api_api_key')
user_stack_token = os.getenv('user_stack_token')
table_logging_name = f"Crowd_Frame-{task_name}_{batch_name}_Logger"
table_data_name = f"Crowd_Frame-{task_name}_{batch_name}_Data"
table_acl_name = f"Crowd_Frame-{task_name}_{batch_name}_ACL"
api_gateway_name = 'Crowd_Frame-API'

if profile_name is None:
    profile_name = 'default'

iam_client = boto3.Session(profile_name=profile_name).client('iam', region_name=aws_region)

console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

if batch_prefix is None:
    batch_prefix = ''

if task_title is None:
    task_title = 'none'

if platform is None:
    platform = 'none'

if language_code is None:
    language_code = 'en-US'

console.rule(f"{step_index} - Configuration Policy")
step_index = step_index + 1

with console.status("Generating configuration policy", spinner="aesthetic") as status:
    configuration_policies = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "EnableConfiguration",
                "Effect": "Allow",
                "Action": [
                    "iam:SimulatePrincipalPolicy",
                    "iam:GetUser",
                    "iam:CreatePolicy",
                    "iam:GetPolicy",
                    "iam:CreateUser",
                    "iam:AttachUserPolicy",
                    "iam:ListAccessKeys",
                    "iam:DeleteAccessKey",
                    "iam:CreateAccessKey",
                    "iam:CreateRole",
                    "iam:AttachRolePolicy",
                    "iam:PassRole",
                    "s3:ListAllMyBuckets",
                    "s3:CreateBucket",
                    "s3:PutBucketPublicAccessBlock",
                    "s3:GetBucketPolicy",
                    "s3:PutBucketPolicy",
                    "s3:GetBucketCORS",
                    "s3:PutBucketCORS",
                    "s3:PutObject",
                    "s3:PutObjectAcl",
                    "s3:GetObject",
                    "s3:ListBucket",
                    "s3:PutBucketOwnershipControls",
                    "s3:PutBucketPublicAccessBlock",
                    "sqs:ListQueues",
                    "sqs:CreateQueue",
                    "sqs:GetQueueUrl",
                    "sqs:GetQueueAttributes",
                    "apigateway:GET",
                    "apigateway:POST",
                    "apigateway:PATCH",
                    "dynamodb:CreateTable",
                    "lambda:CreateFunction",
                    "lambda:CreateEventSourceMapping",
                    "lambda:ListEventSourceMappings",
                    "lambda:UpdateEventSourceMapping",
                    "lambda:DeleteEventSourceMapping",
                ],
                "Resource": "*"
            }
        ]
    }

    try:
        policy = iam_client.create_policy(
            PolicyName='Configuration',
            Description="Provides access to the services required by Crowd_Frame",
            PolicyDocument=json.dumps(configuration_policies),
            Path=iam_path
        )
        console.print(f"[green]Policy creation completed[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
        policy = policy['Policy']
    except iam_client.exceptions.EntityAlreadyExistsException:
        policies = iam_client.list_policies(
            PathPrefix=iam_path
        )['Policies']
        for result in policies:
            if result['PolicyName'] == 'Configuration':
                policy = result
                console.print(f"[yellow]Policy already created")
                break
    serialize_json(folder_aws_generated_path, f"policy_{policy['PolicyName']}.json", policy)

    console.rule(f"{step_index} - [yellow]{config_user_name}[/yellow] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Generating user [yellow]{config_user_name}[/yellow] and attaching configuration policy")
    try:
        user = iam_client.create_user(UserName=config_user_name, Path=iam_path)
        console.print(f"[green]User created[/green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    except iam_client.exceptions.EntityAlreadyExistsException:
        console.print("[yellow]User already created")
        user = iam_client.get_user(UserName=config_user_name)
    iam_client.attach_user_policy(UserName=config_user_name, PolicyArn=policy['Arn'])
    serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}.json", user)

    console.rule(f"{step_index} - Amazon Mechanical Turk Policy")
    step_index = step_index + 1

    status.start()
    status.update(f"Generating Amazon Mechanical Turk read-only access policy")

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "EnableReadOnlyAccess",
                "Effect": "Allow",
                "Action": [
                    "mechanicalturk:SearchHITs",
                    "mechanicalturk:GetReviewableHITs",
                    "mechanicalturk:GetHIT",
                    "mechanicalturk:ListAssignmentsForHIT",
                    "mechanicalturk:GetAssignment",
                    "mechanicalturk:ListHITs"
                ],
                "Resource": ["*"]
            }
        ]
    }

    try:
        policy = iam_client.create_policy(
            PolicyName='MTurkAccess',
            Description="Provides read-only access to Amazon Mechanical Turk",
            PolicyDocument=json.dumps(policy),
            Path=iam_path
        )
        console.print(f"[green]Policy creation completed[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
        policy = policy['Policy']
    except iam_client.exceptions.EntityAlreadyExistsException:
        policies = iam_client.list_policies(PathPrefix=iam_path)['Policies']
        for result in policies:
            if result['PolicyName'] == 'MTurkAccess':
                policy = result
                console.print(f"[yellow]Policy already created")
                break
    serialize_json(folder_aws_generated_path, f"policy_{policy['PolicyName']}.json", policy)

    console.rule(f"{step_index} - [yellow]{mturk_user_name}[/yellow] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Generating user [yellow]{mturk_user_name}[/yellow] and attaching read-only Amazon MTurk access policy")
    try:
        user = iam_client.create_user(UserName=mturk_user_name, Path=iam_path)
        console.print(f"[green]User created[/green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    except iam_client.exceptions.EntityAlreadyExistsException:
        console.print("[yellow]User already created")
        user = iam_client.get_user(UserName=mturk_user_name)
    iam_client.attach_user_policy(UserName=mturk_user_name, PolicyArn=policy['Arn'])
    serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}.json", user)

    console.rule(f"{step_index} - Local Configuration File")
    step_index = step_index + 1

    status.start()
    status.update("Adding users to local configuration file")

    users = [config_user_name, mturk_user_name]

    for user in users:
        file_credentials = f'{home}/.aws/credentials'
        key_valid = False
        if os.path.exists(file_credentials):
            keys_online = iam_client.list_access_keys(UserName=user)['AccessKeyMetadata']

            # We try to search for credentials in .aws/credentials file
            keys_credentials = []
            with open(file_credentials, 'r') as f:
                for line in f:
                    if line.strip().find(f'[{user}]') == 0:
                        key_line = f.readline().strip()
                        secret_line = f.readline().strip()
                        if key_line.find('aws_access_key_id = ') != -1 and secret_line.find('aws_secret_access_key = ') != -1:
                            key_id = key_line.split(' ')[2]
                            keys_credentials.append(key_id)
            # If we find a key which is also online, then we are good
            for key_credentials in keys_credentials:
                for key_online in keys_online:
                    if key_credentials == key_online['AccessKeyId']:
                        key_valid = True
                        console.print(f"[bold green]Valid key for user {user} found in /.credentials file")

            # We try to look for a key serialized in .aws/generated folder
            if not key_valid:
                key = None
                keys_serialized = [str(path) for path in Path(folder_aws_generated_path).resolve().glob(f"**/*{user}_access_key*.json")]
                for key_file in keys_serialized:
                    with open(key_file, 'r') as f:
                        key_serialized = json.load(f)
                    for key_online in keys_online:
                        if key_serialized['AccessKeyId'] == key_online['AccessKeyId']:
                            key = key_serialized
                            key_valid = True
                            console.print(f"[green]Valid key for user {user} found at path: [yellow] {key_file}")
                            with open(file_credentials, "r") as f:
                                line_index = None
                                line_counter = 0
                                lines = f.readlines()
                                for line in lines:
                                    if line.strip() == f'[{user}]':
                                        line_index = line_counter
                                    line_counter += 1
                            if line_index is not None:
                                del lines[line_index:line_index + 3]
                            lines.append(f'\n[{user}]\n')
                            lines.append(f'aws_access_key_id = {key["AccessKeyId"]}\n')
                            lines.append(f'aws_secret_access_key = {key["SecretAccessKey"]}\n')
                            with open(file_credentials, "w") as f:
                                for line in lines:
                                    f.write(line)
                            console.print(f"[green]Credentials file updated with user {user} key")

            # At last, we try to generate a new key for the user
            if not key_valid:
                keys_serialized = [str(path) for path in Path(folder_aws_generated_path).resolve().glob(f"**/*{user}_access_key*.json")]
                for key_invalid in keys_serialized:
                    console.print(f"[red]Removing invalid key at path: {key_invalid}")
                    os.remove(key_invalid)
                console.print(f"[green]Generating new valid key for user {user}")
                try:
                    key = iam_client.create_access_key(UserName=user)['AccessKey']
                except ClientError as error:
                    if error.response['Error']['Code'] == 'LimitExceeded':
                        console.print("[yellow] Removing old keys, limit of two keys for user {user} reached")
                        for key_online in keys_online:
                            iam_client.delete_access_key(AccessKeyId=key_online['AccessKeyId'], UserName=user)
                        key = iam_client.create_access_key(UserName=user)['AccessKey']
                with open(file_credentials, 'a') as f:
                    f.write(f'\n[{user}]\n')
                    f.write(f'aws_access_key_id = {key["AccessKeyId"]}\n')
                    f.write(f'aws_secret_access_key = {key["SecretAccessKey"]}\n')
                serialize_json(folder_aws_generated_path, f"user_{user}_access_key_{key['AccessKeyId']}.json", key)
                console.print(f"[bold green]New credentials generated for user {user}")
                console.print(f'[bold green]Access Key ID = {key["AccessKeyId"]}')
                console.print(f'[bold green]Secret Access Key = <hidden>')
                console.print(f'[bold green]Credentials file updated at path: {file_credentials}')
                console.print(f"[bold green]Profile for user {user} ready!")
        else:
            console.print('[bold red]Before using this tool you MUST install AWS CLI, run `aws configure` command and insert the credentials of a valid IAM user with admin access')

    console.rule(f"{step_index} - [yellow]{config_user_name}[/yellow] Authentication")
    step_index = step_index + 1

    status.start()
    status.update("Checking local configuration file")

    method = None
    status.stop()

    boto_session = boto3.Session(profile_name=config_user_name, region_name=aws_region)

    iam_resource = boto_session.resource('iam')
    root_user = iam_resource.CurrentUser()
    aws_account_id = root_user.arn.split(':')[4]

    console.print(f"ID: [bold cyan on white]{root_user.user_id}")
    console.print(f"Username: [bold cyan on white]{root_user.user_name}")
    console.print(f"ARN: [bold cyan on white]{root_user.arn}")
    console.print(f"AWS Account ID: [bold cyan on white]{aws_account_id}")

    api_gateway_client = boto_session.client('apigatewayv2', region_name=aws_region)
    s3_client = boto_session.client('s3', region_name=aws_region)
    s3_resource = boto_session.resource('s3')
    sqs_client = boto_session.client('sqs', region_name=aws_region)
    dynamodb_client = boto_session.client('dynamodb', region_name=aws_region)
    lambda_client = boto_session.client('lambda', region_name=aws_region)
    budget_client = boto3.Session(profile_name=profile_name).client('budgets', region_name=aws_region)

    console.rule(f"{step_index} - [yellow]{root_user.user_name}[/yellow] Policies Check")
    step_index = step_index + 1

    status.start()
    status.update(f"Checking if the required policies are correctly set up")

    required_policies = {
        "server": [
            "iam:GetUser",
            "iam:CreatePolicy",
            "iam:GetPolicy",
            "iam:CreateUser",
            "iam:AttachUserPolicy",
            "iam:ListAccessKeys",
            "iam:DeleteAccessKey",
            "iam:CreateAccessKey",
            "iam:CreateRole",
            "iam:AttachRolePolicy",
            "iam:PassRole",
            "s3:ListAllMyBuckets",
            "s3:CreateBucket",
            "s3:PutBucketPublicAccessBlock",
            "s3:GetBucketPolicy",
            "s3:PutBucketPolicy",
            "s3:GetBucketCORS",
            "s3:PutBucketCORS",
            "s3:PutObject",
            "s3:GetObject",
            "s3:ListBucket",
            "sqs:ListQueues",
            "sqs:CreateQueue",
            "sqs:GetQueueAttributes",
            "sqs:GetQueueUrl",
            "apigateway:GET",
            "apigateway:POST",
            "dynamodb:CreateTable",
            "lambda:CreateFunction",
            "lambda:CreateEventSourceMapping",
            "cloudfront:ListDistributions",
            "cloudfront:CreateDistribution",
            "cloudfront:ListOriginAccessControls",
            "cloudfront:CreateOriginAccessControl"
        ],
        "no_server": [
            "iam:GetUser",
            "iam:CreatePolicy",
            "iam:GetPolicy",
            "iam:CreateUser",
            "iam:AttachUserPolicy",
            "iam:ListAccessKeys",
            "iam:DeleteAccessKey",
            "iam:CreateAccessKey",
            "iam:CreateRole",
            "iam:AttachRolePolicy",
            "iam:PassRole",
            "s3:ListAllMyBuckets",
            "s3:CreateBucket",
            "s3:PutBucketPublicAccessBlock",
            "s3:GetBucketPolicy",
            "s3:PutBucketPolicy",
            "s3:GetBucketCORS",
            "s3:PutBucketCORS",
            "s3:PutObject",
            "s3:GetObject",
            "s3:ListBucket",
            "dynamodb:CreateTable",
            "cloudfront:ListDistributions",
            "cloudfront:CreateDistribution",
            "cloudfront:ListOriginAccessControls",
            "cloudfront:CreateOriginAccessControl"
        ]
    }

    denied = []
    endpoint = ""
    if server_config == "aws":
        actions = required_policies['server']
    else:
        actions = required_policies['no_server']
    try:
        response = iam_client.simulate_principal_policy(
            PolicySourceArn=root_user.arn,
            ActionNames=actions
        )
        console.print(f"[green]Policy compliance evaluation completed for user {root_user.user_name}")
        serialize_json(folder_aws_generated_path, f"user_{root_user.user_name}_policies_evaluation.json", response)
        for result in response['EvaluationResults']:
            if result['EvalDecision'].find('Deny') != -1:
                denied.append(result['EvalActionName'])
        if denied:
            status.stop()
            console.print(f"\nTo continue you must provide these missing permissions: {denied}\n")
            stop_sequence()
        else:
            console.print(f"[green]Each permission is correctly set up!")
    except ClientError as error:
        status.stop()
        handle_aws_error(error.response)
        stop_sequence()

    console.rule(f"{step_index} - Crowd Workers Interaction Policy")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating policy to allow crowd workers interaction")

    crowd_workers_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowBucketInteraction",
                "Effect": "Allow",
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:ListBucket"
                ],
                "Resource": [
                    f"arn:aws:s3:::{aws_private_bucket}",
                    f"arn:aws:s3:::{aws_private_bucket}/*",
                    f"arn:aws:s3:::{aws_deploy_bucket}",
                    f"arn:aws:s3:::{aws_deploy_bucket}/*"
                ]
            },
            {
                "Sid": "AllowDatabaseInteraction",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:DescribeTable",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:GetItem",
                    "dynamodb:Query",
                    "dynamodb:Scan",
                    "dynamodb:ListTables"
                ],
                "Resource": "*"
            }
        ]
    }

    policy = None
    try:
        policy = iam_client.create_policy(
            PolicyName='CrowdWorkersInteractionPolicy',
            Description='Provides crowd workers interaction with Crowd_Frame ecosystem',
            PolicyDocument=json.dumps(crowd_workers_policy)
        )
        console.print(f"[green]Policy creation completed[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
    except iam_client.exceptions.EntityAlreadyExistsException as exception:
        console.print(f"[yellow]Policy already created[/yellow]")
        policy = iam_client.get_policy(PolicyArn=f"arn:aws:iam::{aws_account_id}:policy/CrowdWorkersInteractionPolicy")
        console.print(f"[green]Policy retrieved[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"policy_{policy['Policy']['PolicyName']}.json", policy)

    console.print(f"Policy ARN: [cyan underline]{policy['Policy']['Arn']}[/cyan underline]")

    console.rule(f"{step_index} - [cyan underline]crowd-worker[/cyan underline] User Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating user")

    user = None
    try:
        user = iam_client.create_user(UserName="crowd-worker", Path=iam_path)
        console.print(f"[green]User created[/green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    except iam_client.exceptions.EntityAlreadyExistsException as exception:
        console.print(f"[yellow]User already created[/yellow]")
        user = iam_client.get_user(UserName="crowd-worker")
        console.print(f"[green]User retrieved[green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}.json", user)

    response = iam_client.attach_user_policy(UserName=user['User']['UserName'], PolicyArn=policy['Policy']['Arn'])
    policy = iam_client.get_policy(PolicyArn=f"{policy['Policy']['Arn']}")
    console.print(f"[green]Policy with ARN [cyan underline]{policy['Policy']['Arn']}[/cyan underline] attached to user, HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}")

    keys = []
    paginator = iam_client.get_paginator('list_access_keys')
    for found_keys in paginator.paginate(UserName=user['User']['UserName']):
        for (index, key) in enumerate(found_keys['AccessKeyMetadata']):
            keyData = read_json(f"{folder_aws_generated_path}user_{user['User']['UserName']}_access_key_{key['AccessKeyId']}.json")
            if keyData:
                keys.append(keyData)
            else:
                response = iam_client.delete_access_key(UserName=user['User']['UserName'], AccessKeyId=key['AccessKeyId'])
                console.print(f"[red]Key {index} data not found on disk[/red]; deleting it on AWS, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}")

    if len(keys) < 2:
        key = iam_client.create_access_key(UserName=user['User']['UserName'])
        serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json", key)
        console.print(f"[green]Access key created[/green], HTTP STATUS CODE: {key['ResponseMetadata']['HTTPStatusCode']}.")
        keys.append(key)
        if not os.path.exists(f"{folder_aws_path}user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json"):
            serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json", key)
            console.print(f"[green]Access key created[/green], HTTP STATUS CODE: {key['ResponseMetadata']['HTTPStatusCode']}.")

    key_selected = random.choice(keys)
    key_data = read_json(f"{folder_aws_generated_path}user_{user['User']['UserName']}_access_key_{key_selected['AccessKey']['AccessKeyId']}.json")

    console.print("Key data found on disk and loaded")

    aws_worker_access_id = key_data['AccessKey']['AccessKeyId']
    aws_worker_access_secret = key_data['AccessKey']['SecretAccessKey']

    console.rule(f"{step_index} - Private Bucket [cyan underline]{aws_private_bucket}[/cyan underline] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating bucket")

    buckets = []
    for bucket in s3_resource.buckets.all():
        buckets.append(bucket.name)

    try:
        if aws_region == 'us-east-1':
            private_bucket = s3_client.create_bucket(Bucket=aws_private_bucket)
        else:
            private_bucket = s3_client.create_bucket(
                Bucket=aws_private_bucket,
                CreateBucketConfiguration={'LocationConstraint': aws_region}
            )
        serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}.json", private_bucket)
        console.print(f"[green]Bucket creation completed[/green], HTTP STATUS CODE: {private_bucket['ResponseMetadata']['HTTPStatusCode']}.")
    except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
        console.print(f"[yellow]Bucket already created[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")

    response = s3_client.put_public_access_block(
        Bucket=aws_private_bucket,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True
        },
    )
    console.print(f"[green]Public access blocked[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")

    private_bucket_policy = {
        "Version": "2012-10-17",
        "Id": "PrivateBucket",
        "Statement": [
            {
                "Sid": "AllowPrivateBucketInteraction",
                "Effect": "Allow",
                "Principal": {
                    "AWS": [
                        f"arn:aws:iam::{aws_account_id}:user{iam_path}{config_user_name}",
                        f"arn:aws:iam::{aws_account_id}:user{iam_path}crowd-worker"
                    ]
                },
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:ListBucket"
                ],
                "Resource": [
                    f"arn:aws:s3:::{aws_private_bucket}",
                    f"arn:aws:s3:::{aws_private_bucket}/*"
                ]
            }
        ]
    }

    try:
        policy = s3_client.get_bucket_policy(Bucket=aws_private_bucket)
        policy['Policy'] = json.loads(policy['Policy'])
        console.print(f"[yellow]Policy already created[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        response = s3_client.put_bucket_policy(Bucket=aws_private_bucket, Policy=json.dumps(private_bucket_policy))
        console.print(f"[green]Policy configuration completed[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
        policy = s3_client.get_bucket_policy(Bucket=aws_private_bucket)
        policy['Policy'] = json.loads(policy['Policy'])
    serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}_policy.json", policy)

    cors_configuration = {
        'CORSRules': [{
            'AllowedHeaders': ['*'],
            'AllowedMethods': ['GET', 'HEAD', 'PUT'],
            'AllowedOrigins': ['*'],
            'ExposeHeaders': [],
            'MaxAgeSeconds': 3000
        }]
    }

    try:
        cors_configuration = s3_client.get_bucket_cors(Bucket=aws_private_bucket)
        console.print(f"[yellow]CORS Configuration already created[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        response = s3_client.put_bucket_cors(Bucket=aws_private_bucket, CORSConfiguration=cors_configuration)
        console.print(f"[green]CORS configuration completed[green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    cors_configuration = s3_client.get_bucket_cors(Bucket=aws_private_bucket)
    serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}_cors.json", cors_configuration)

    console.rule(f"{step_index} - Deploy Bucket [cyan underline]{aws_deploy_bucket}[/cyan underline] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating bucket")

    try:
        if aws_region == 'us-east-1':
            deploy_bucket = s3_client.create_bucket(Bucket=aws_deploy_bucket, ObjectOwnership='ObjectWriter')
        else:
            deploy_bucket = s3_client.create_bucket(Bucket=aws_deploy_bucket, ObjectOwnership='ObjectWriter', CreateBucketConfiguration={'LocationConstraint': aws_region})
        serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}.json", deploy_bucket)
        console.print(f"[green]Bucket creation completed[/green], HTTP STATUS CODE: {deploy_bucket['ResponseMetadata']['HTTPStatusCode']}.")
    except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
        deploy_bucket = s3_resource.Bucket(aws_deploy_bucket)
        console.print(f"[yellow]Bucket already created[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")

    deploy_bucket_policy = {
        "Version": "2012-10-17",
        "Id": "DeployBucket",
        "Statement": [
            {
                "Sid": "AllowPublicBucketInteraction",
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::{aws_account_id}:user{iam_path}{user['User']['UserName']}"
                },
                "Action": [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:ListBucket"
                ],
                "Resource": [
                    f"arn:aws:s3:::{aws_deploy_bucket}",
                    f"arn:aws:s3:::{aws_deploy_bucket}/*"
                ]
            },
            {
                "Sid": "AllowPublicBucketAdministration",
                "Effect": "Allow",
                "Principal": {
                    "AWS": root_user.arn
                },
                "Action": [
                    "s3:*",
                ],
                "Resource": [
                    f"arn:aws:s3:::{aws_deploy_bucket}",
                    f"arn:aws:s3:::{aws_deploy_bucket}/*"
                ]
            }
        ]
    }

    status.update(f"Setting bucket policy")

    try:
        policy = s3_client.get_bucket_policy(Bucket=aws_deploy_bucket)
        policy['Policy'] = json.loads(policy['Policy'])
        console.print(f"[yellow]Policy already created[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchBucketPolicy':
            response = s3_client.put_bucket_policy(Bucket=aws_deploy_bucket, Policy=json.dumps(deploy_bucket_policy))
            console.print(f"[green]Policy configuration completed[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
        policy = s3_client.get_bucket_policy(Bucket=aws_deploy_bucket)
        policy['Policy'] = json.loads(policy['Policy'])
    serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}_policy.json", policy)

    status.update(f"Updating public access block configuration")

    response = s3_client.get_public_access_block(Bucket=aws_deploy_bucket)
    public_access_configuration = response['PublicAccessBlockConfiguration']
    serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}_public_access_configuration.json", response)

    response = s3_client.put_public_access_block(
        Bucket=aws_deploy_bucket,
        PublicAccessBlockConfiguration={
            'BlockPublicAcls': False,
            'IgnorePublicAcls': False,
            'BlockPublicPolicy': False,
            'RestrictPublicBuckets': False
        }
    )
    serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}_public_access_removal.json", response)

    status.update(f"Enabling static website hosting")

    website_configuration = {
        'IndexDocument': {'Suffix': 'index.html'},
        'ErrorDocument': {'Key': 'index.html'}
    }

    response = s3_client.put_bucket_website(
        Bucket=aws_deploy_bucket,
        WebsiteConfiguration=website_configuration
    )
    serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}_static_website_hosting.json", response)

    website_endpoint = f"http://{aws_deploy_bucket}.s3-website.{aws_region}.amazonaws.com"
    console.print(f"[green]Static website hosting initialized[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    console.print(f"Website endpoint: [cyan]{website_endpoint}")

    if aws_dataset_bucket is not None:

        console.rule(f"{step_index} - Dataset Bucket [cyan underline]{aws_dataset_bucket}[/cyan underline] Creation")
        step_index = step_index + 1

        status.start()
        status.update(f"Creating bucket")

        try:
            if aws_region == 'us-east-1':
                dataset_bucket = s3_client.create_bucket(Bucket=aws_dataset_bucket)
            else:
                dataset_bucket = s3_client.create_bucket(
                    Bucket=aws_dataset_bucket,
                    CreateBucketConfiguration={'LocationConstraint': aws_region}
                )
            serialize_json(folder_aws_generated_path, f"bucket_{aws_dataset_bucket}.json", dataset_bucket)
            console.print(f"[green]Bucket creation completed[/green], HTTP STATUS CODE: {dataset_bucket['ResponseMetadata']['HTTPStatusCode']}.")
        except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
            console.print(f"[yellow]Bucket already created[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")

        status.update(f"Updating public access configuration")

        # Ensure public access settings allow policies
        response = s3_client.put_public_access_block(
            Bucket=aws_dataset_bucket,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': True,
                'IgnorePublicAcls': True,
                'BlockPublicPolicy': False,
                'RestrictPublicBuckets': False
            },
        )
        serialize_json(folder_aws_generated_path, f"bucket_{aws_dataset_bucket}_public_access_configuration.json", response)

    console.rule(f"{step_index} - Configuring Cloudfront Distribution For {aws_deploy_bucket}")
    step_index = step_index + 1

    cloudfront_client = boto3.Session(profile_name=profile_name).client('cloudfront')
    paginator = cloudfront_client.get_paginator('list_distributions')

    origin_domain = website_endpoint.replace("http://", '')

    # CloudFront distribution configuration
    distribution_config = {
        'CallerReference': f"{aws_deploy_bucket}-distribution",  # A unique string that ensures idempotence
        'Comment': f"Cloudfront distribution for {aws_deploy_bucket}",
        'Enabled': True,
        'Origins': {
            'Quantity': 1,
            'Items': [{
                'Id': 'S3-' + aws_deploy_bucket,
                'DomainName': origin_domain,
                'CustomOriginConfig': {
                    'HTTPPort': 80,
                    'HTTPSPort': 443,
                    'OriginProtocolPolicy': 'http-only',  # Can also be https-only or match-viewer
                    'OriginSslProtocols': {
                        'Quantity': 3,
                        'Items': ['TLSv1.2', 'TLSv1.1', 'TLSv1']
                    }
                }
            }]
        },
        'DefaultCacheBehavior': {
            'TargetOriginId': 'S3-' + aws_deploy_bucket,
            'ViewerProtocolPolicy': 'redirect-to-https',
            'AllowedMethods': {
                'Quantity': 2,
                'Items': ['GET', 'HEAD'],
                'CachedMethods': {
                    'Quantity': 2,
                    'Items': ['GET', 'HEAD']
                }
            },
            'Compress': True,
            'ForwardedValues': {
                'QueryString': False,
                'Cookies': {'Forward': 'none'}
            },
            'MinTTL': 86400
        }
    }

    distribution_found = False
    distribution = None
    cloudfront_endpoint = None

    # Iterate through all CloudFront distributions
    try:
        for page in paginator.paginate():
            # Check each distribution for the specific S3 bucket as an origin
            for distribution_current in page['DistributionList'].get('Items', []):
                # Look at each origin within this distribution
                for origin in distribution_current['Origins']['Items']:
                    if origin['DomainName'] == origin_domain:
                        distribution_found = True
                        distribution = distribution_current
                        break
                if distribution_found:
                    break
            if distribution_found:
                break
    except Exception as e:
        print(f"An error occurred: {e}")

    if distribution:
        console.print(f"[yellow]CloudFront distribution already created[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    else:
        distribution = cloudfront_client.create_distribution(DistributionConfig=distribution_config)
        console.print(f"[green]Cloudfront distribution initialized[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    console.print(f"Domain name: [cyan]{distribution['DomainName']}")
    console.print(f"Comment: [cyan]{distribution['Comment']}")
    cloudfront_endpoint = distribution['DomainName']
    serialize_json(folder_aws_generated_path, f"cloudfront_distribution_{distribution['Id']}.json", distribution)

    if aws_dataset_bucket is not None:

        console.rule(f"{step_index} - Configuring Cloudfront Distribution For {aws_dataset_bucket}")
        step_index = step_index + 1

        cloudfront_client = boto3.Session(profile_name=profile_name).client('cloudfront')
        origin_domain = f"{aws_dataset_bucket}.s3.us-east-2.amazonaws.com"
        caller_reference = f"{aws_dataset_bucket}-distribution"
        oac_name = f"{aws_dataset_bucket}-oac"

        # Try to retrieve existing OAC
        try:
            oac_list_response = cloudfront_client.list_origin_access_controls()
            existing_oacs = oac_list_response.get('OriginAccessControlList', {}).get('Items', [])
            oac = next((o for o in existing_oacs if o['Name'] == oac_name), None)

            if oac:
                oac_id = oac['Id']
                console.print(f"[yellow]Origin Access Control '{oac_name}' already exists[/yellow], ID: {oac_id}")
            else:
                oac_response = cloudfront_client.create_origin_access_control(
                    OriginAccessControlConfig={
                        'Name': oac_name,
                        'OriginAccessControlOriginType': 's3',
                        'SigningBehavior': 'always',
                        'SigningProtocol': 'sigv4',
                        'Description': f"OAC for {aws_dataset_bucket}"
                    }
                )
                oac_id = oac_response['OriginAccessControl']['Id']
                console.print(f"[green]Created new Origin Access Control '{oac_name}'[/green], ID: {oac_id}")
                serialize_json(folder_aws_generated_path, f"origin_access_control_{oac_id}.json", oac_response)
        except Exception as e:
            console.print(f"[red]Failed to retrieve or create Origin Access Control[/red]: {e}")
            raise

        # Check if CloudFront distribution already exists
        paginator = cloudfront_client.get_paginator('list_distributions')
        distribution_found = False
        distribution = None
        cloudfront_endpoint = None

        try:
            for page in paginator.paginate():
                for distribution_current in page['DistributionList'].get('Items', []):
                    for origin in distribution_current['Origins']['Items']:
                        if origin['DomainName'] == origin_domain:
                            distribution_found = True
                            distribution = distribution_current
                            break
                    if distribution_found:
                        break
                if distribution_found:
                    break

            if distribution_found:
                distribution_id = distribution['Id']
                cloudfront_endpoint = distribution['DomainName']
                console.print(f"[yellow]CloudFront distribution already exists[/yellow], ID: {distribution_id}")
                console.print(f"Domain name: [cyan]{cloudfront_endpoint}")
                console.print(f"Comment: [cyan]{distribution.get('Comment', '')}")
                serialize_json(folder_aws_generated_path, f"cloudfront_distribution_{distribution_id}.json", distribution)
            else:
                console.print(f"[green]No existing CloudFront distribution found for origin '{origin_domain}'[/green]")
        except Exception as e:
            console.print(f"[red]An error occurred while checking existing distributions[/red]: {e}")
            raise

    if distribution:
        console.print(f"[yellow]CloudFront distribution already created for dataset bucket[/yellow], ID: {distribution['Id']}")
        cloudfront_endpoint = distribution['DomainName']
    else:
        try:
            response = cloudfront_client.create_distribution(
                DistributionConfig={
                    'CallerReference': caller_reference,
                    'Comment': f"CloudFront distribution for {aws_dataset_bucket}",
                    'Enabled': True,
                    'Origins': {
                        'Quantity': 1,
                        'Items': [{
                            'Id': f"S3-{aws_dataset_bucket}",
                            'DomainName': origin_domain,
                            'OriginAccessControlId': oac_id,
                            'S3OriginConfig': {
                                'OriginAccessIdentity': ''
                            }
                        }]
                    },
                    'DefaultCacheBehavior': {
                        'TargetOriginId': f"S3-{aws_dataset_bucket}",
                        'ViewerProtocolPolicy': 'redirect-to-https',
                        'AllowedMethods': {
                            'Quantity': 2,
                            'Items': ['GET', 'HEAD'],
                            'CachedMethods': {
                                'Quantity': 2,
                                'Items': ['GET', 'HEAD']
                            }
                        },
                        'Compress': True,
                        'ForwardedValues': {
                            'QueryString': False,
                            'Cookies': {'Forward': 'none'}
                        },
                        'MinTTL': 86400
                    }
                }
            )
            distribution = response['Distribution']
            cloudfront_endpoint = distribution['DomainName']
            console.print(f"[green]CloudFront distribution for dataset bucket created[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}")
            serialize_json(folder_aws_generated_path, f"cloudfront_distribution_{distribution['Id']}.json", response)
        except Exception as e:
            console.print(f"[red]Failed to create CloudFront distribution[/red]: {e}")
            raise

    console.print(f"Domain name: [cyan]{cloudfront_endpoint}")
    console.print(f"Comment: [cyan]{distribution['Comment']}")

    console.rule(f"{step_index} - Table [cyan underline]{table_data_name}[/cyan underline] Setup")
    step_index = step_index + 1

    try:
        table_name = table_data_name
        table = dynamodb_client.create_table(
            TableName=table_name,
            AttributeDefinitions=[
                {'AttributeName': 'identifier', 'AttributeType': 'S'},
                {'AttributeName': 'sequence', 'AttributeType': 'S'},
                {'AttributeName': 'sequence_number', 'AttributeType': 'S'},
            ],
            KeySchema=[
                {'AttributeName': 'identifier', 'KeyType': 'HASH'},
                {'AttributeName': 'sequence', 'KeyType': 'RANGE'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'identifier-sequence_number',
                    'KeySchema': [
                        {
                            'AttributeName': 'identifier',
                            'KeyType': 'HASH',
                        },
                        {
                            'AttributeName': 'sequence_number',
                            'KeyType': 'RANGE'
                        }
                    ],
                    "Projection": {
                        "ProjectionType": "ALL"
                    },
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        serialize_json(folder_aws_generated_path, f"dynamodb_table_{table_name}.json", table)
        status.stop()
        console.print(f"{table_data_name} created")
    except dynamodb_client.exceptions.ResourceInUseException:
        status.stop()
        console.print(f"Table [cyan underline]{table_data_name}[/cyan underline] already created")

    console.rule(f"{step_index} - Table [cyan underline]{table_acl_name}[/cyan underline] Setup")
    step_index = step_index + 1

    try:
        table_name = table_acl_name
        table = dynamodb_client.create_table(
            TableName=table_name,
            AttributeDefinitions=[
                {'AttributeName': 'identifier', 'AttributeType': 'S'},
                {'AttributeName': 'unit_id', 'AttributeType': 'S'},
                {'AttributeName': 'time_arrival', 'AttributeType': 'S'},
                {'AttributeName': 'ip_address', 'AttributeType': 'S'},
            ],
            KeySchema=[
                {'AttributeName': 'identifier', 'KeyType': 'HASH'},
                # If you want to use ip_address as part of the primary key:
                {'AttributeName': 'ip_address', 'KeyType': 'RANGE'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'unit_id-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'unit_id',
                            'KeyType': 'HASH',
                        },
                        {
                            'AttributeName': 'time_arrival',
                            'KeyType': 'RANGE'
                        }
                    ],
                    "Projection": {
                        "ProjectionType": "ALL"
                    },
                },
                {
                    'IndexName': 'identifier-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'identifier',
                            'KeyType': 'HASH',
                        },
                        {
                            'AttributeName': 'time_arrival',
                            'KeyType': 'RANGE'
                        }
                    ],
                    "Projection": {
                        "ProjectionType": "ALL"
                    },
                },
                {
                    'IndexName': 'ip_address-index',
                    'KeySchema': [
                        {
                            'AttributeName': 'ip_address',
                            'KeyType': 'HASH',
                        },
                        {
                            'AttributeName': 'time_arrival',
                            'KeyType': 'RANGE'
                        }
                    ],
                    "Projection": {
                        "ProjectionType": "ALL"
                    },
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        serialize_json(folder_aws_generated_path, f"dynamodb_table_{table_name}.json", table)
        console.print(f"Table [green]{table_acl_name}[/green] created")
    except dynamodb_client.exceptions.ResourceInUseException:
        console.print(f"Table [cyan underline]{table_acl_name}[/cyan underline] already created")

    console.rule(f"{step_index} - API Gateway {api_gateway_name} Setup")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating gateway")

    api_gateway_available = api_gateway_client.get_apis()['Items']
    if not any(api for api in api_gateway_available if api['Name'] == api_gateway_name):
        response = api_gateway_client.create_api(
            CorsConfiguration={
                'AllowCredentials': False,
                'AllowHeaders': [
                    '*'
                ],
                'AllowMethods': [
                    'GET',
                    'POST',
                    'OPTIONS'
                ],
                'AllowOrigins': [
                    f"https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com",
                    f"https://{cloudfront_endpoint}",
                    f"{website_endpoint}",
                ],
                'ExposeHeaders': [
                    'x-msedge-clientid',
                    'x-msedge-clientip',
                    'x-search-location'
                ],
                'MaxAge': 300
            },
            Name=api_gateway_name,
            ProtocolType='HTTP'
        )
        api_gateway = response
        serialize_json(folder_aws_generated_path, f"api_gateway_{api_gateway_name}.json", response)
        console.print(f"[green]API Gateway created, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    else:
        console.print(f"[yellow]API Gateway already created, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
        api_gateway = [api for api in api_gateway_available if api['Name'] == api_gateway_name][0]
        origin_allowed = f"https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com"
        origins_already_allowed = api_gateway['CorsConfiguration'].get('AllowOrigins', [])
        if origin_allowed not in origins_already_allowed:
            origins_already_allowed.append(origin_allowed)
            api_gateway['CorsConfiguration']['AllowOrigins'] = origins_already_allowed
            cors_configuration = {
                "AllowOrigins": api_gateway['CorsConfiguration']['AllowOrigins'],
                "AllowMethods": ["GET", "POST", "OPTIONS"]
            }
            response = api_gateway_client.update_api(ApiId=api_gateway['ApiId'], CorsConfiguration=cors_configuration)
            console.print(f"CORS configuration updated")
            console.print(f"Allowed origin: {origin_allowed}")
        status.stop()
    console.print(f"Identifier: [cyan]{api_gateway['ApiId']}[/cyan]")
    console.print(f"Endpoint: [cyan]{api_gateway['ApiEndpoint']}[/cyan]")

    status.update(f"Fetching available integrations")
    api_integrations = api_gateway_client.get_integrations(
        ApiId=api_gateway['ApiId'],
        MaxResults='5',
    )['Items']

    status.update("Creating Brave HTTP proxy integration")
    brave_integration_uri = "https://api.search.brave.com/res/v1/web/search"
    brave_api_integration = None

    for api_integration_current in api_integrations:
        if (
            api_integration_current["IntegrationType"] == "HTTP_PROXY"
            and api_integration_current["IntegrationUri"] == brave_integration_uri
        ):
            brave_api_integration = api_integration_current
            console.print("[yellow]Brave HTTP proxy integration already created")
            break

    if not brave_api_integration:
        brave_api_integration = api_gateway_client.create_integration(
            ApiId=api_gateway["ApiId"],
            IntegrationType="HTTP_PROXY",
            IntegrationMethod="GET",
            PayloadFormatVersion="1.0",
            IntegrationUri=brave_integration_uri,
        )
        console.print("[green]Brave HTTP proxy integration created")

    console.print(f"Identifier: [cyan underline]{brave_api_integration['IntegrationId']}")
    console.print(f"URI: [cyan underline]{brave_api_integration['IntegrationUri']}")
    serialize_json(
        folder_aws_generated_path,
        f"api_gateway_{api_gateway_name}_integration_{brave_api_integration['IntegrationId']}.json",
        brave_api_integration,
    )

    status.update("Creating Google HTTP proxy integration")
    google_integration_uri = "https://www.googleapis.com/customsearch/v1"
    google_api_integration = None

    for api_integration_current in api_integrations:
        if (
            api_integration_current["IntegrationType"] == "HTTP_PROXY"
            and api_integration_current["IntegrationUri"] == google_integration_uri
        ):
            google_api_integration = api_integration_current
            console.print("[yellow]Google HTTP proxy integration already created")
            break

    if not google_api_integration:
        google_api_integration = api_gateway_client.create_integration(
            ApiId=api_gateway["ApiId"],
            IntegrationType="HTTP_PROXY",
            IntegrationMethod="GET",
            PayloadFormatVersion="1.0",
            IntegrationUri=google_integration_uri,
        )
        console.print("[green]Google HTTP proxy integration created")

    console.print(f"Identifier: [cyan underline]{google_api_integration['IntegrationId']}")
    console.print(f"URI: [cyan underline]{google_api_integration['IntegrationUri']}")
    serialize_json(
        folder_aws_generated_path,
        f"api_gateway_{api_gateway_name}_integration_{google_api_integration['IntegrationId']}.json",
        google_api_integration,
    )

    status.update(f"Fetching available API routes")
    api_routes = api_gateway_client.get_routes(
        ApiId=api_gateway['ApiId'],
        MaxResults='5',
    )['Items']

    brave_route_name = "GET /brave"
    status.update(f"Creating {brave_route_name} api route")

    try:
        brave_response = api_gateway_client.create_route(
            ApiId=api_gateway["ApiId"],
            RouteKey=brave_route_name,
            Target=f"integrations/{brave_api_integration['IntegrationId']}",
        )
        brave_api_route = brave_response
        console.print(
            "[green]Brave API route created[/green], "
            f"HTTP STATUS CODE: {brave_response['ResponseMetadata']['HTTPStatusCode']}."
        )
    except api_gateway_client.exceptions.ConflictException:
        for api_route_candidate in api_routes:
            if api_route_candidate["RouteKey"] == brave_route_name:
                brave_api_route = api_route_candidate
                console.print(
                    f"[yellow]Brave API route [cyan]{brave_route_name}[/cyan] already created."
                )
                break

    console.print(f"Identifier: [cyan underline]{brave_api_route['RouteId']}")
    console.print(f"Key: [cyan underline]{brave_api_route['RouteKey']}")
    console.print(f"Target: [cyan underline]{brave_api_route['Target']}")
    serialize_json(
        folder_aws_generated_path,
        f"api_gateway_{api_gateway_name}_route_{brave_api_route['RouteId']}.json",
        brave_api_route,
    )

    google_route_name = "GET /google"
    status.update(f"Creating {google_route_name} api route")

    try:
        google_response = api_gateway_client.create_route(
            ApiId=api_gateway["ApiId"],
            RouteKey=google_route_name,
            Target=f"integrations/{google_api_integration['IntegrationId']}",
        )
        google_api_route = google_response
        console.print(
            "[green]Google API route created[/green], "
            f"HTTP STATUS CODE: {google_response['ResponseMetadata']['HTTPStatusCode']}."
        )
    except api_gateway_client.exceptions.ConflictException:
        for api_route_candidate in api_routes:
            if api_route_candidate["RouteKey"] == google_route_name:
                google_api_route = api_route_candidate
                console.print(
                    f"[yellow]Google API route [cyan]{google_route_name}[/cyan] already created."
                )
                break

    console.print(f"Identifier: [cyan underline]{google_api_route['RouteId']}")
    console.print(f"Key: [cyan underline]{google_api_route['RouteKey']}")
    console.print(f"Target: [cyan underline]{google_api_route['Target']}")
    serialize_json(
        folder_aws_generated_path,
        f"api_gateway_{api_gateway_name}_route_{google_api_route['RouteId']}.json",
        google_api_route,
    )

    status.update(f"Creating auto deployment stage")
    try:
        response = api_gateway_client.create_stage(
            ApiId=api_gateway['ApiId'],
            StageName="$default",
            AutoDeploy=True
        )
        console.print(f"[green]Deployment stage created, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except api_gateway_client.exceptions.ConflictException as error:
        console.print(f"[yellow]Deployment stage already created, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    response = api_gateway_client.get_stage(
        ApiId=api_gateway['ApiId'],
        StageName="$default",
    )
    api_stage = response
    api_stage_endpoint = f"https://{api_gateway['ApiId']}.execute-api.{aws_region}.amazonaws.com"
    console.print(f"Endpoint: [cyan]{api_stage_endpoint}[/cyan]")
    serialize_json(folder_aws_generated_path, f"api_gateway_{api_gateway_name}_stage_default.json", response)

    console.rule(f"{step_index} - Logging Infrastructure Setup")
    step_index = step_index + 1

    status.start()
    console.print(f"Modality chosen: [cyan on white]{server_config}")

    endpoint = ""  # default logging endpoint for the frontend

    if server_config == "aws":

        status.update(f"Setting up policies")

        policies = []
        roles = []

        policy_list = [file for file in os.listdir(f"{folder_aws_path}policy") if 'To' in file]
        for file in track(policy_list, description="Setting up policies and roles..."):
            name = file.split('.')[0]
            with open(f"{folder_aws_path}policy/{file}") as f:
                policy_document = json.dumps(json.load(f))
            try:
                policy = iam_client.create_policy(
                    PolicyName=name,
                    PolicyDocument=policy_document,
                    Path=iam_path,
                    Description="Required by Crowd_Frame's logging system"
                )['Policy']
                serialize_json(folder_aws_generated_path, f"policy_{policy['PolicyName']}.json", policy)
            except iam_client.exceptions.EntityAlreadyExistsException:
                policies.append(name)

            with open(f"{folder_aws_path}policy/{name.split('To')[0]}.json") as f:
                policy_document = json.dumps(json.load(f))
            try:
                role = iam_client.create_role(
                    RoleName=name,
                    AssumeRolePolicyDocument=policy_document,
                    Path=iam_path,
                    Description="Required by Crowd_Frame's logging system"
                )['Role']
                serialize_json(folder_aws_generated_path, f"role_{role['RoleName']}.json", role)
            except iam_client.exceptions.EntityAlreadyExistsException:
                roles.append(name)
            iam_client.attach_role_policy(
                RoleName=name,
                PolicyArn=f"arn:aws:iam::{aws_account_id}:policy{iam_path}{name}"
            )
        status.stop()
        if policies:
            console.print(f"The following policies were already created {policies}")
        if roles:
            console.print(f"The following roles were already created {roles}")
        if not policies and roles:
            console.print("[green]Policies correctly set up")

        status.start()
        status.update(f"Table {table_logging_name} Setup")

        try:
            table_name = table_logging_name
            table = dynamodb_client.create_table(
                TableName=table_name,
                AttributeDefinitions=[{'AttributeName': 'sequence', 'AttributeType': 'S'}, {'AttributeName': 'worker', 'AttributeType': 'S'}],
                KeySchema=[{'AttributeName': 'worker', 'KeyType': 'HASH'}, {'AttributeName': 'sequence', 'KeyType': 'RANGE'}],
                BillingMode='PAY_PER_REQUEST'
            )
            serialize_json(folder_aws_generated_path, f"dynamodb_table_{table_name}.json", table)
            status.stop()
            console.print(f"[green] Table {table_logging_name} created")
        except dynamodb_client.exceptions.ResourceInUseException:
            status.stop()
            console.print(f"[yellow] Table {table_logging_name} already created")

        status.start()
        status.update('Queue service setup')

        queue = {}
        queue_name = "Crowd_Frame-Queue"
        queue_new = False
        if 'QueueUrls' not in sqs_client.list_queues(QueueNamePrefix=queue_name):
            with open(f"{folder_aws_path}policy/SQSPolicy.json") as f:
                policy_document = json.dumps(json.load(f))
            queue = sqs_client.create_queue(
                QueueName=queue_name,
                Attributes={
                    'Policy': policy_document,
                    'VisibilityTimeout': '120'
                }
            )
            queue_new = True
            status.stop()
            console.print("Queue created")
        else:
            queue = sqs_client.get_queue_url(QueueName=queue_name, QueueOwnerAWSAccountId=aws_account_id)
            status.stop()
            console.print("Queue already created")
        attributes = sqs_client.get_queue_attributes(
            QueueUrl=queue['QueueUrl'],
            AttributeNames=['All']
        )
        queue['Attributes'] = attributes['Attributes']
        serialize_json(folder_aws_generated_path, f"queue_{queue_name}.json", queue)

        status.start()
        status.update('Lambda setup')
        function_name = 'Crowd_Frame-Logger'
        function_new = False
        if not os.path.exists(f"{folder_aws_path}index.zip"):
            with ZipFile(f"{folder_aws_path}index.zip", 'w') as zipf:
                zipf.write(f"{folder_aws_path}index.js", arcname='index.js')
        try:
            response = lambda_client.create_function(
                FunctionName=function_name,
                Runtime='nodejs20.x',
                Handler='index.handler',
                Role=f'arn:aws:iam::{aws_account_id}:role{iam_path}LambdaToDynamoDBAndS3',
                Code={'ZipFile': open(f"{folder_aws_path}index.zip", 'rb').read()},
                Timeout=20,
                PackageType='Zip'
            )
            function_new = True
            serialize_json(folder_aws_generated_path, f"lambda_{function_name}.json", response)
            console.print('[green]Function created.')
        except lambda_client.exceptions.ResourceConflictException as error:
            console.print(f"[yellow]Function already created.")
        status.stop()

        status.start()
        status.update('Event source mapping between queue and lambda setup')
        source_mappings = lambda_client.list_event_source_mappings(EventSourceArn=queue['Attributes']['QueueArn'])
        if queue_new or function_new or len(source_mappings['EventSourceMappings']) <= 0:
            for mapping in source_mappings['EventSourceMappings']:
                lambda_client.delete_event_source_mapping(UUID=mapping['UUID'])
            time.sleep(61)
            response = lambda_client.create_event_source_mapping(
                EventSourceArn=queue['Attributes']['QueueArn'],
                FunctionName=function_name,
                Enabled=True,
            )
            console.print(f"[green]Event source mapping between {queue_name} and {function_name} created.")
            serialize_json(folder_aws_generated_path, f"lambda_event_source_mapping_{response['UUID']}.json", response)
        else:
            console.print(f"[yellow]Event source mapping already created.")
        status.stop()

        status.start()
        status.update("Fetching available integrations")
        api_integrations = api_gateway_client.get_integrations(
            ApiId=api_gateway["ApiId"],
            MaxResults="5",
        )["Items"]

        # ----------------------------------------------------------------------
        # SQS logging integration (AWS_PROXY) — used by POST /log
        # ----------------------------------------------------------------------
        queue_url = f"https://sqs.{aws_region}.amazonaws.com/{aws_account_id}/{queue_name}"

        status.update("Creating gateway integration between /log route and SQS queue")
        sqs_integration = None
        for api_integration_current in api_integrations:
            if (
                api_integration_current["IntegrationType"] == "AWS_PROXY"
                and api_integration_current.get("IntegrationSubtype") == "SQS-SendMessage"
                and api_integration_current.get("RequestParameters", {}).get("QueueUrl") == queue_url
            ):
                sqs_integration = api_integration_current
                console.print("[yellow]AWS proxy integration with SQS already created.")
                break

        if not sqs_integration:
            response = api_gateway_client.create_integration(
                ApiId=api_gateway["ApiId"],
                IntegrationType="AWS_PROXY",
                IntegrationSubtype="SQS-SendMessage",
                PayloadFormatVersion="1.0",
                CredentialsArn=f"arn:aws:iam::{aws_account_id}:role{iam_path}GatewayToSQS",
                RequestParameters={
                    "QueueUrl": queue_url,
                    "MessageBody": "$request.body",
                },
            )
            sqs_integration = response
            console.print(
                "[green]AWS proxy integration with SQS created, "
                f"HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}"
            )

        console.print(f"Identifier: [cyan underline]{sqs_integration['IntegrationId']}")
        console.print(f"Queue URL: [cyan underline]{queue_url}")
        serialize_json(
            folder_aws_generated_path,
            f"api_gateway_{api_gateway_name}_integration_{sqs_integration['IntegrationId']}.json",
            sqs_integration,
        )

        # ----------------------------------------------------------------------
        # Route POST /log → SQS integration
        # ----------------------------------------------------------------------
        api_route_name = "POST /log"
        status.update(f"Creating {api_route_name} api route")

        log_route = None
        try:
            response = api_gateway_client.create_route(
                ApiId=api_gateway["ApiId"],
                RouteKey=api_route_name,
                Target=f"integrations/{sqs_integration['IntegrationId']}",
            )
            log_route = response
            console.print(
                "[green]API route created[/green], "
                f"HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}."
            )
        except api_gateway_client.exceptions.ConflictException:
            for api_route_candidate in api_routes:
                if api_route_candidate["RouteKey"] == api_route_name:
                    log_route = api_route_candidate
                    console.print(
                        f"[yellow]API route [cyan]{api_route_name}[/cyan] already created."
                    )
                    break

        console.print(f"Identifier: [cyan underline]{log_route['RouteId']}")
        console.print(f"Key: [cyan underline]{log_route['RouteKey']}")
        console.print(f"Target: [cyan underline]{log_route['Target']}")
        serialize_json(
            folder_aws_generated_path,
            f"api_gateway_{api_gateway_name}_route_{log_route['RouteId']}.json",
            log_route,
        )

        # Derive the API Gateway /log endpoint for the frontend
        endpoint = f"{api_stage_endpoint}/log"

    elif server_config == "custom":
        console.print("Please insert your custom logging endpoint: ")
        endpoint = console.input()
    elif server_config == "none":
        console.print("Logging infrastructure not deployed")
        endpoint = ""
    else:
        raise Exception(
            "Your [italic]server_config[/italic] environment variable must be set to [white on black]aws[/white on black], [white on black]custom[/white on black] or [white on black]none[/white on black]")

    status.stop()

    console.rule(f"{step_index} - HITs Solver Setup")
    step_index = step_index + 1

    console.print(f"Environment variable [blue]enable_solver[/blue] value: [cyan]{enable_solver}")

    if enable_solver:

        console.print(f"HITs solver deployment started")

        docker_client = docker.from_env()
        docker_whales = DockerClient(compose_files=["docker/docker-compose.yml"])

        status.update(f"Fetching solver image")
        image_name = 'miccighel/crowd_frame-solver'
        image_tag = 'latest'

        try:
            image = docker_client.images.get(f"{image_name}:{image_tag}")
            console.print(f"Solver image available locally with name [green]{image_name}[/green] and tag [blue]{image_tag}[/blue]")
        except ImageNotFound:
            console.print(f"Fetching solver image from Docker Hub repository [yellow]{image_name}[/yellow] with tag [blue]{image_tag}[/blue]")
            image = docker_client.images.pull(repository=image_name, tag=image_tag)

        status.update(f"Fetching reverse proxy image")

        image_name = 'nginx'
        image_tag = '1.17.10'
        try:
            image = docker_client.images.get(f"{image_name}:{image_tag}")
            console.print(f"Reverse proxy image available locally with name [green]{image_name}[/green] and tag [blue]{image_tag}[/blue]")
        except ImageNotFound:
            console.print(f"Fetching reverse proxy image from Docker Hub repository [yellow]{image_name}[/yellow] with tag [blue]{image_tag}[/blue]")
            image = docker_client.images.pull(repository=image_name, tag=image_tag)

        status.update(f"Starting containers")

        docker_whales.compose.up(detach=True)

        container_list = docker_client.containers.list()
        for container in container_list:
            console.print(f"Container with name [green]{container.name}[/green] and {container.image} deployed")

        hit_solver_endpoint = "http://localhost"

    else:
        console.print("HITs solver not deployed")
        hit_solver_endpoint = None

    console.rule(f"{step_index} - Budgeting Setting")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating role")

    role_name = "Budgeting"
    budget_name = "crowdsourcing-tasks"

    budget_policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "iam:PassRole"
                ],
                "Resource": "*",
                "Condition": {
                    "StringEquals": {
                        "iam:PassedToService": "budgets.amazonaws.com"
                    }
                }
            },
            {
                "Effect": "Allow",
                "Action": [
                    "budgets:*",
                    "billing:GetBillingDetails",
                    "billing:UpdateBillingPreferences",
                    "ec2:DescribeInstances",
                    "iam:ListGroups",
                    "iam:ListPolicies",
                    "iam:ListRoles",
                    "iam:ListUsers",
                    "iam:AttachUserPolicy",
                    "organizations:ListAccounts",
                    "organizations:ListOrganizationalUnitsForParent",
                    "organizations:ListPolicies",
                    "organizations:ListRoots",
                    "rds:DescribeDBInstances",
                    "sns:ListTopics"
                ],
                "Resource": "*"
            }
        ]
    }

    try:
        policy = iam_client.create_policy(
            PolicyName='Budgeting',
            Description="Provides access to the budgeting configuration required by Crowd_Frame",
            PolicyDocument=json.dumps(budget_policy_document),
            Path=iam_path
        )
        console.print(f"[green]Policy creation completed[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
        policy = policy['Policy']
    except iam_client.exceptions.EntityAlreadyExistsException:
        policies = iam_client.list_policies(
            PathPrefix=iam_path
        )['Policies']
        for result in policies:
            if result['PolicyName'] == 'Budgeting':
                policy = result
                console.print(f"[yellow]Policy already created")
                break
    serialize_json(folder_aws_generated_path, f"policy_{policy['PolicyName']}.json", policy)

    role_policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "",
                "Effect": "Allow",
                "Principal": {
                    "Service": "budgets.amazonaws.com"
                },
                "Action": [
                    "sts:AssumeRole",
                ]
            }
        ]
    }

    try:
        role = iam_client.create_role(
            RoleName=role_name,
            Path=iam_path,
            AssumeRolePolicyDocument=json.dumps(role_policy_document),
            Description="Allows Budgets to create and manage AWS resources on your behalf "
        )
        console.print(f"[green]Role {role_name} created")
        serialize_json(folder_aws_generated_path, f"role_{role['Role']['RoleName']}.json", role)
    except iam_client.exceptions.EntityAlreadyExistsException:
        console.print(f"[yellow]Role {role_name} already created")
    iam_client.attach_role_policy(RoleName=role_name, PolicyArn=policy['Arn'])

    try:
        response = budget_client.create_budget(
            AccountId=aws_account_id,
            Budget={
                'BudgetName': budget_name,
                'BudgetLimit': {
                    'Amount': budget_limit,
                    'Unit': 'USD'
                },
                'CostTypes': {
                    'IncludeTax': True,
                    'IncludeSubscription': True,
                    'UseBlended': False,
                    'IncludeRefund': False,
                    'IncludeCredit': False,
                    'IncludeUpfront': True,
                    'IncludeRecurring': True,
                    'IncludeOtherSubscription': True,
                    'IncludeSupport': True,
                    'IncludeDiscount': True,
                    'UseAmortized': False
                },
                'TimeUnit': "MONTHLY",
                'TimePeriod': {
                    'Start': datetime.now(),
                    'End': datetime(2087, 6, 15)
                },
                'BudgetType': "COST",
                'LastUpdatedTime': datetime.now()
            }
        )
        console.print(f"[green]Budget {budget_name} created")
    except ClientError as e:
        if e.response['Error']['Code'] == 'DuplicateRecordException':
            console.print(f"[yellow]Budget {budget_name} already created")
            response = budget_client.describe_budget(
                AccountId=aws_account_id,
                BudgetName=budget_name
            )
    serialize_json(folder_aws_generated_path, f"budget_{budget_name}.json", response)

    try:
        response = budget_client.describe_budget_actions_for_budget(
            AccountId=aws_account_id,
            BudgetName=budget_name,
        )
        if len(response['Actions']) > 0:
            console.print("[yellow]Budgeting action already created")
            response = response['Actions'][0]
        else:
            response = budget_client.create_budget_action(
                AccountId=aws_account_id,
                BudgetName=budget_name,
                NotificationType='ACTUAL',
                ActionType='APPLY_IAM_POLICY',
                ActionThreshold={
                    'ActionThresholdValue': 95.0,
                    'ActionThresholdType': 'PERCENTAGE'
                },
                Definition={
                    'IamActionDefinition': {
                        'PolicyArn': 'arn:aws:iam::aws:policy/AWSDenyAll',
                        'Users': ['crowd-worker', 'config-user', 'mturk-user']
                    }
                },
                ExecutionRoleArn=f"arn:aws:iam::{aws_account_id}:role{iam_path}{role_name}",
                ApprovalModel='AUTOMATIC',
                Subscribers=[
                    {
                        'SubscriptionType': 'EMAIL',
                        'Address': mail_contact
                    },
                ]
            )
            serialize_json(folder_aws_generated_path, f"budget_{budget_name}_action_{response['ActionId']}.json", response)
    except ClientError as e:
        if e.response['Error']['Code'] == 'AccessDenied':
            console.print(f"[yellow] Access denied to budget information for current user")
        else:
            print("An unexpected error occurred: ", {e})

    console.rule(f"{step_index} - Environment: [cyan underline]PRODUCTION[/cyan underline] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating environment")

    environment_development = f"{folder_build_env_path}environment.ts"
    environment_production = f"{folder_build_env_path}environment.prod.ts"

    environment_dict = {
        "production": 'true',
        "configuration_local": 'false',
        "platform": platform if platform else 'none',
        "taskName": task_name,
        "batchName": batch_name,
        "taskTitle": task_title,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "bucket_deploy": aws_deploy_bucket,
        "websiteEndpoint": website_endpoint,
        "cloudfrontEndpoint": cloudfront_endpoint,
        "languageCode": language_code,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "prolific_completion_code": prolific_completion_code if prolific_completion_code else 'false',
        "brave_api_key": brave_api_key,
        "google_api_key": google_api_key,
        "google_cx": google_cx,
        "pubmed_api_key": pubmed_api_key,
        "log_on_console": 'false',
        "log_server_config": f"{server_config}",
        "table_acl_name": f"{table_acl_name}",
        "table_data_name": f"{table_data_name}",
        "table_log_name": f"{table_logging_name}",
        "api_gateway_endpoint": f"{api_stage_endpoint}",
        "hit_solver_endpoint": f"{hit_solver_endpoint}",
        "log_endpoint": f"{endpoint}",
    }

    os.makedirs(folder_build_env_path, exist_ok=True)

    with open(environment_production, 'w') as file:
        print("export const environment = {", file=file)
        for (env_var, value) in environment_dict.items():
            if env_var == 'production' or env_var == 'configuration_local' or env_var == 'log_on_console':
                print(f"\t{env_var}: {value},", file=file)
            elif env_var == 'prolific_completion_code':
                if value != 'false':
                    print(f"\t{env_var}: \"{value}\",", file=file)
                else:
                    print(f"\t{env_var}: {value},", file=file)
            else:
                print(f"\t{env_var}: \"{value}\",", file=file)
        print("};", file=file)

    console.print("File [cyan underline]environment.prod.ts[/cyan underline] generated")
    console.print(f"Path: [italic]{environment_production}[/italic]")

    console.rule(f"{step_index} - Environment: [cyan underline]DEVELOPMENT[/cyan underline] Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating environment")

    environment_dict = {
        "production": 'false',
        "configuration_local": 'false',
        "platform": platform if platform else 'mturk',
        "taskName": task_name,
        "batchName": batch_name,
        "taskTitle": task_title,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "bucket_deploy": aws_deploy_bucket,
        "websiteEndpoint": website_endpoint,
        "cloudfrontEndpoint": cloudfront_endpoint,
        "languageCode": language_code,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "prolific_completion_code": prolific_completion_code if prolific_completion_code else 'false',
        "brave_api_key": brave_api_key,
        "pubmed_api_key": pubmed_api_key,
        "google_api_key": google_api_key,
        "google_cx": google_cx,
        "log_on_console": 'true',
        "log_server_config": f"{server_config}",
        "table_acl_name": f"{table_acl_name}",
        "table_data_name": f"{table_data_name}",
        "table_log_name": f"{table_logging_name}",
        "api_gateway_endpoint": f"{api_stage_endpoint}",
        "hit_solver_endpoint": f"{hit_solver_endpoint}",
        "log_endpoint": f"{endpoint}",
    }

    with open(environment_development, 'w') as file:
        print("export const environment = {", file=file)
        for (env_var, value) in environment_dict.items():
            if env_var == 'production' or env_var == 'configuration_local' or env_var == 'log_on_console':
                print(f"\t{env_var}: {value},", file=file)
            elif env_var == 'prolific_completion_code':
                if value != 'false':
                    print(f"\t{env_var}: \"{value}\",", file=file)
                else:
                    print(f"\t{env_var}: {value},", file=file)
            else:
                print(f"\t{env_var}: \"{value}\",", file=file)
        print("};", file=file)

    console.print("File [cyan underline]environment.ts[/cyan underline] generated")
    console.print(f"Path: [italic]{environment_development}[/italic]")

    console.rule(f"{step_index} - Admin Credentials Creation")
    step_index = step_index + 1

    status.start()
    status.update(f"Creating file [cyan underline]admin.json")

    if not os.path.exists(folder_build_config_path):
        os.makedirs(folder_build_config_path, exist_ok=True)

    admin_file = f"{folder_build_config_path}admin.json"

    console.print("Creating hash with [cyan underline]hmac[/cyan underline] and [cyan underline]sha256[/cyan underline]")
    console.print(f"Processing user with username: [cyan on white]{admin_user}[/cyan on white]")

    admins = []
    body = f"username:{admin_user}"
    digest_maker = hmac.new(admin_password.encode(), body.encode(), hashlib.sha256)
    admins.append(digest_maker.hexdigest())
    with open(admin_file, 'w') as file:
        json.dump(admins, file, indent=4)

    console.print(f"Path: [italic]{admin_file}")

    console.rule(f"{step_index} - Task Configuration Synchronization")
    step_index = step_index + 1

    status.start()
    status.update(f"Checking metadata of existing configuration items")

    s3 = boto_session.client('s3', region_name=aws_region)

    task_batch_names = []
    task_config_filenames = [
        filename_hits_config,
        filename_questionnaires_config,
        filename_instructions_evaluation_config,
        filename_instructions_general_config,
        filename_dimensions_config,
        filename_search_engine_config,
        filename_task_settings_config,
        filename_workers_settings_config
    ]

    task_config_items_checked = []
    task_config_items_updated = 0
    task_config_items_updated_local = 0
    task_config_items_updated_names = []
    task_config_items_updated_names_local = []


    def sync_task_configs_simple(
        s3,
        *,
        aws_private_bucket: str,
        task_name: str,
        batch_name: str,
        task_config_filenames,
        folder_build_task_path: str,
        console
    ):
        """
        One-shot sync:
          - finds batches under f"{task_name}/" where batch_name is contained in the batch dir
          - picks the newest remote object per expected filename across all matching batches
          - compares LastModified vs local mtime; downloads if remote is newer or local missing
        """

        expected = list(task_config_filenames)
        expected_set = set(expected)
        local_dir = Path(folder_build_task_path)
        local_dir.mkdir(parents=True, exist_ok=True)

        # Collect batch names (top-level dirs under task_name/)
        prefix_root = f"{task_name}/"
        paginator = s3.get_paginator("list_objects_v2")
        matching_batches = []

        for page in paginator.paginate(Bucket=aws_private_bucket, Prefix=prefix_root, Delimiter="/"):
            for cp in page.get("CommonPrefixes", []):
                name = cp["Prefix"].split("/")[1]  # "TaskName/BatchX/" -> "BatchX"
                if batch_name in name:
                    matching_batches.append(name)

        if not matching_batches:
            console.print(f"[yellow]No batches found[/yellow] under [blue]{task_name}/[/blue] matching '{batch_name}'")

        # Build newest remote per filename across all matching batches
        newest_remote_by_name = {}  # filename -> obj dict with Key, LastModified, ...
        for bn in matching_batches:
            prefix = f"{task_name}/{bn}/Task/"
            for page in paginator.paginate(Bucket=aws_private_bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    fname = Path(obj["Key"]).name
                    if fname in expected_set:
                        prev = newest_remote_by_name.get(fname)
                        if prev is None or obj["LastModified"] > prev["LastModified"]:
                            newest_remote_by_name[fname] = obj

        # Counters
        task_config_items_updated = 0  # pulled from REMOTE
        task_config_items_updated_names = []
        task_config_items_updated_local = 0  # kept LOCAL
        task_config_items_updated_names_local = []
        task_config_items_to_generate = 0

        # Decide for each expected file
        for filename in expected:
            local_path = local_dir / filename
            remote_obj = newest_remote_by_name.get(filename)

            if remote_obj is None:
                if local_path.exists():
                    console.print(
                        f"Configuration item [blue]{filename}[/blue] status: "
                        f"[green]LOCAL[/green] detected, [green]REMOTE[/green] not detected"
                    )
                    task_config_items_updated_local += 1
                    task_config_items_updated_names_local.append(filename)
                else:
                    console.print(
                        f"Configuration item [blue]{filename}[/blue] status: "
                        f"[green]LOCAL[/green] not detected, [green]REMOTE[/green] not detected"
                    )
                    console.print("Sample generation during next step")
                    task_config_items_to_generate += 1
                continue

            # Remote present
            remote_key = remote_obj["Key"]
            remote_dt = remote_obj["LastModified"]  # tz-aware datetime
            remote_ts = remote_dt.timestamp()

            if local_path.exists():
                local_ts = local_path.stat().st_mtime
                console.print(
                    f"Configuration item [blue]{filename}[/blue] status: "
                    f"[green]LOCAL[/green] detected, [green]REMOTE[/green] detected"
                )
                if remote_ts > local_ts:
                    console.print(f"Most recent version: [blue underline]REMOTE[/blue underline], date: {remote_dt}")
                    tmp_path = local_path.with_suffix(local_path.suffix + ".tmp")
                    s3.download_file(aws_private_bucket, remote_key, str(tmp_path))
                    os.replace(tmp_path, local_path)  # atomic move
                    task_config_items_updated += 1
                    task_config_items_updated_names.append(filename)
                else:
                    console.print(
                        f"Most recent version: [blue underline]LOCAL[/blue underline], date: {datetime.fromtimestamp(local_ts)}"
                    )
                    task_config_items_updated_local += 1
                    task_config_items_updated_names_local.append(filename)
            else:
                console.print(
                    f"Configuration item [blue]{filename}[/blue] status: "
                    f"[green]LOCAL[/green] not detected, [green]REMOTE[/green] detected"
                )
                console.print(f"Fetching remote version, date: {remote_dt}")
                tmp_path = local_path.with_suffix(local_path.suffix + ".tmp")
                s3.download_file(aws_private_bucket, remote_key, str(tmp_path))
                os.replace(tmp_path, local_path)
                task_config_items_updated += 1
                task_config_items_updated_names.append(filename)

        # Summary (kept identical in spirit to your original)
        console.print(f"Configuration items synchronized: {task_config_items_updated}")
        console.print(f"Items fetched from [green]REMOTE[/green]: {task_config_items_updated}, {task_config_items_updated_names}")
        console.print(f"Items available from [green]LOCAL[/green]: {task_config_items_updated_local}, {task_config_items_updated_names_local}")
        console.print(f"Items to generate: {task_config_items_to_generate}")


    sync_task_configs_simple(
        s3,
        aws_private_bucket=aws_private_bucket,
        task_name=task_name,
        batch_name=batch_name,
        task_config_filenames=task_config_filenames,
        folder_build_task_path=folder_build_task_path,
        console=console,
    )

    console.rule(f"{step_index} - Sample Task Configuration")
    step_index = step_index + 1

    status.start()
    status.update(f"Generating a sample configuration if needed")

    if not os.path.exists(folder_build_task_path):
        os.makedirs(folder_build_task_path, exist_ok=True)

    filename = filename_hits_config
    hits_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        hits_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_units = [{
                "unit_id": "unit_0",
                "token_input": "ABCDEFGHILM",
                "token_output": "MNOPQRSTUVZ",
                "documents_number": 1,
                "documents_params": {
                    "identifier_1": {
                        "task_type": "Main",
                        "allow_back": True,
                        "check_gold": {
                            "message": None,
                            "jump": None
                        },
                        "reset_jump": False
                    }
                },
                "documents": [
                    {
                        "id": "identifier_1",
                        "text": "Lorem ipsum dolor sit amet"
                    }
                ]
            }]
            print(json.dumps(sample_units, indent=4), file=file)

    filename = filename_questionnaires_config
    questionnaire_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        questionnaire_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_questionnaires = [
                {
                    "type": "standard",
                    "name": "questionnaire_1",
                    "description": "This is a standard questionnaire",
                    "caption": False,
                    "position": "start",
                    "allow_back": False,
                    "questions": [
                        {
                            "index": 0,
                            "name": "age",
                            "text": "What is your age range?",
                            "type": "mcq",
                            "required": True,
                            "free_text": False,
                            "show_detail": False,
                            "detail": None,
                            "answers": [
                                "0-18",
                                "19-25",
                                "26-35",
                                "36-50",
                                "50-80",
                                "80"
                            ]
                        }
                    ]
                },
                {
                    "type": "crt",
                    "name": "questionnaire_2",
                    "description": "This is a CRT questionnaire",
                    "caption": False,
                    "position": "start",
                    "allow_back": False,
                    "questions": [
                        {
                            "index": 0,
                            "name": "farmers",
                            "text": "If three farmers can plant three trees in three hours, how long would it take nine farmers to plant nine trees?"
                        }
                    ]
                },
            ]
            print(json.dumps(sample_questionnaires, indent=4), file=file)

    filename = filename_dimensions_config
    dimensions_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        dimensions_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_dimensions = [{
                "name": "sample-dimension",
                "name_pretty": "Sample Dimension",
                "description": "Lorem ipsum dolor sit amet",
                "task_type": [
                    "Main"
                ],
                "example": False,
                "gold": False,
                "pairwise": False,
                "url": False,
                "justification": False,
                "scale": {
                    "type": "categorical",
                    "multiple_selection": False,
                    "instructions": {
                        "label": "Label",
                        "caption": "Caption",
                        "text": "Instruction text"
                    },
                    "mapping": [
                        {
                            "label": "False",
                            "description": "...",
                            "value": "0"
                        },
                        {
                            "label": "True",
                            "description": "...",
                            "value": "1"
                        }
                    ]
                },
                "style": {
                    "type": "list",
                    "position": "middle",
                    "orientation": "vertical",
                    "separator": False
                }
            }]
            print(json.dumps(sample_dimensions, indent=4), file=file)

    filename = filename_instructions_general_config
    instructions_general_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        instructions_general_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_instructions = [
                {
                    "caption": "Task Instructions",
                    "text": "<p>Lorem ipsum <strong>dolor</strong> sit amet.</p>"
                }
            ]
            print(json.dumps(sample_instructions, indent=4), file=file)

    filename = filename_instructions_evaluation_config
    instructions_evaluation_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        instructions_evaluation_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_instructions = {
                "instructions": [
                    {
                        "caption": "Evaluation Instructions",
                        "text": "<p>Lorem ipsum <strong>dolor</strong> sit amet.</p>",
                        "task_type": [
                            "Main"
                        ]
                    }
                ],
                "element": {
                    "label": "Label",
                    "caption": "Caption",
                    "text": "Instruction text"
                }
            }
            print(json.dumps(sample_instructions, indent=4), file=file)

    filename = filename_search_engine_config
    search_engine_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        search_engine_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_search_engine = {
                "source": "FakerWebSearch",
                "domains_filter": []
            }

            print(json.dumps(sample_search_engine, indent=4), file=file)

    filename = filename_task_settings_config
    task_settings_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        task_settings_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        try:
            logging_endpoint = f'{api_stage_endpoint}/log'
        except NameError:
            logging_endpoint = endpoint
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_settings = {
                "modality": f"pointwise",
                "allowed_tries": 10,
                "time_assessment": 2,
                "time_check_amount": 3,
                "attributes": [
                    {
                        "name": "id",
                        "name_pretty": False,
                        "show": False,
                        "annotate": False,
                        "required": False
                    },
                    {
                        "name": "text",
                        "name_pretty": False,
                        "show": True,
                        "required": False,
                        "annotate": False
                    }
                ],
                "element_labels": {
                    "main": "Element",
                    "main_short": "E"
                },
                "annotator": False,
                "countdown_time": False,
                "countdown_behavior": False,
                "additional_times": False,
                "countdown_modality": False,
                "countdown_attribute": False,
                "countdown_attribute_values": [],
                "countdown_position_values": [],
                "logger": False,
                "logger_option": {
                    "button": {
                        "general": False,
                        "click": False
                    },
                    "mouse": {
                        "general": False,
                        "mouseMovements": False,
                        "leftClicks": False,
                        "rightClicks": False
                    },
                    "keyboard": {
                        "general": False,
                        "shortcuts": False,
                        "keys": False
                    },
                    "textInput": {
                        "general": False,
                        "paste": False,
                        "delete": False
                    },
                    "clipboard": {
                        "general": False,
                        "copy": False,
                        "cut": False
                    },
                    "radio": {
                        "general": False,
                        "change": False
                    },
                    "search-engine-body": {
                        "general": False,
                        "query": False,
                        "result": False
                    },
                    "various": {
                        "general": False,
                        "selection": False,
                        "unload": False,
                        "focus&blur": False,
                        "scroll": False,
                        "resize": False
                    }
                },
                "server_endpoint": logging_endpoint,
                "messages": ["You have already started this task without finishing it"]
            }
            print(json.dumps(sample_settings, indent=4), file=file)

    filename = filename_workers_settings_config
    worker_settings_config = None
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        worker_settings_config = read_json(f"{folder_build_task_path}{filename}")
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_worker_checks = {
                "block": False,
                "blacklist": [],
                "whitelist": [],
                "blacklist_batches": [],
                "whitelist_batches": [],
            }
            print(json.dumps(sample_worker_checks, indent=4), file=file)

    console.print(f"Path: [italic white on black]{folder_build_task_path}[/italic white on black]")

    console.rule(f"{step_index} - Interface [cyan underline]document.ts")
    step_index = step_index + 1

    hits_file = f"{folder_build_task_path}{filename_hits_config}"
    document_interface = f"{folder_build_skeleton_path}document.ts"
    if not os.path.exists(folder_build_skeleton_path):
        os.makedirs(folder_build_skeleton_path, exist_ok=True)

    console.print(f"Reading hits file")
    console.print(f"Path: [italic]{hits_file}[/italic]")
    hits = read_json(hits_file)

    # This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
    # The attribute <document_index> is additional and should not be touched and passed in the constructor.
    # Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.

    with open(document_interface, 'w') as file:
        print("export class Document {", file=file)
        print("", file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t', width=500, break_long_words=False)
        print(wrapper.fill("index: number;"), file=file)
        print(wrapper.fill("params: { };"), file=file)
        contents = []
        for unit in hits:
            if len(unit['documents']) > 0:
                for idx_s_e, sample_element in enumerate(unit['documents']):
                    if not 'id' in sample_element.keys():
                        raise Exception(f"In your {filename_hits_config} file, the document number {idx_s_e + 1} in HIT {unit['unit_id']} does not contain the required attribute \"id\"!")
                    for attribute, value in sample_element.items():
                        if attribute not in contents:
                            contents += [attribute]
                            try:
                                element = value if (value == 'false' or value == 'true') else json.loads(value)
                                if isinstance(element, bool):
                                    print(wrapper.fill(f"{attribute}: boolean;"), file=file)
                                if isinstance(element, dict):
                                    print(wrapper.fill(f"{attribute}: Array<JSON>;"), file=file)
                                elif isinstance(element, int) or isinstance(element, float):
                                    if attribute == "id":
                                        print(wrapper.fill(f"{attribute}: string;"), file=file)
                                    else:
                                        print(wrapper.fill(f"{attribute}: number;"), file=file)
                                elif isinstance(element, list):
                                    print(wrapper.fill(f"{attribute}: Array<String>;"), file=file)
                                else:
                                    print(wrapper.fill(f"{attribute}: string;"), file=file)
                                console.print(
                                    f"Attribute with name: [cyan underline]{attribute}[/cyan underline] and type: {type(element)} found")
                            except (TypeError, ValueError) as e:
                                if isinstance(value, list):
                                    if len(value) == 0:
                                        print(wrapper.fill(f"{attribute}: Array<String>;"), file=file)
                                    else:
                                        first = value[0]
                                        if isinstance(first, dict):
                                            print(wrapper.fill(f"{attribute}: Array<JSON>;"), file=file)
                                        elif isinstance(first, str):
                                            print(wrapper.fill(f"{attribute}: Array<String>;"), file=file)
                                        elif isinstance(first, (int, float)):
                                            print(wrapper.fill(f"{attribute}: Array<Number>;"), file=file)
                                        elif isinstance(first, list):
                                            # Optionally, handle nested lists here if needed
                                            print(wrapper.fill(f"{attribute}: Array<Array<String>>;"), file=file)
                                        else:
                                            print(wrapper.fill(f"{attribute}: Array<String>;"), file=file)
                                elif isinstance(value, bool):
                                    print(wrapper.fill(f"{attribute}: boolean;"), file=file)
                                elif isinstance(value, int) or isinstance(value, float):
                                    print(wrapper.fill(f"{attribute}: number;"), file=file)
                                else:
                                    print(wrapper.fill(f"{attribute}: string;"), file=file)
                                console.print(f"Attribute with name: [cyan underline]{attribute}[/cyan underline] and type: {type(value)} found")
        print("", file=file)
        print(wrapper.fill(f"constructor ("), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t', width=500, break_long_words=False)
        print(wrapper.fill("index: number,"), file=file)
        if not len(unit.get('documents', [])) > 0:
            print(wrapper.fill("// @ts-expect-error TS6133: 'data' is declared but its value is never read"), file=file)
        print(wrapper.fill("data: JSON,"), file=file)
        print(wrapper.fill("params: JSON"), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t', width=500, break_long_words=False)
        print(wrapper.fill(") {"), file=file)
        print("", file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', width=500, break_long_words=False)
        print(wrapper.fill("this.index = index"), file=file)
        print(wrapper.fill("this.params = { }"), file=file)
        print(wrapper.fill("this.params[\"task_type\"] = params[\"task_type\"] || \"Main\" "), file=file)
        print(wrapper.fill("this.params[\"allow_back\"] = params[\"allow_back\"]"), file=file)
        print(wrapper.fill("this.params[\"check_gold\"] = params[\"check_gold\"]"), file=file)
        print(wrapper.fill("this.params[\"reset_jump\"] = params[\"reset_jump\"]"), file=file)
        contents = []
        for unit in hits:
            if len(unit['documents']) > 0:
                for idx_s_e, sample_element in enumerate(unit['documents']):
                    if not 'id' in sample_element.keys():
                        raise Exception(f"In your {filename_hits_config} file, the document number {idx_s_e + 1} in HIT {unit['unit_id']} does not contain the required attribute \"id\"!")
                    for attribute, value in sample_element.items():
                        if attribute not in contents:
                            contents += [attribute]
                            try:
                                element = value if (value == 'false' or value == 'true') else json.loads(value)
                                if isinstance(element, dict):
                                    print(wrapper.fill(f"this.{attribute} = new Array<JSON>()"), file=file)
                                    print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"), file=file)
                                elif isinstance(element, list):
                                    print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                                    print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"])"), file=file)
                                else:
                                    wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', width=500, break_long_words=False)
                                    print(wrapper.fill(f"this.{attribute} = data[\"{attribute}\"]"), file=file)
                            except (TypeError, ValueError) as e:
                                if isinstance(value, list):
                                    if len(value) == 0:
                                        print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                                    else:
                                        first = value[0]
                                        if isinstance(first, dict):
                                            print(wrapper.fill(f"this.{attribute} = new Array<JSON>()"), file=file)
                                            print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                                                  file=file)
                                        elif isinstance(first, str):
                                            print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                                            print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                                                  file=file)
                                        elif isinstance(first, (int, float)):
                                            print(wrapper.fill(f"this.{attribute} = new Array<Number>()"), file=file)
                                            print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                                                  file=file)
                                        elif isinstance(first, list):
                                            print(wrapper.fill(f"this.{attribute} = new Array<Array<String>>()"), file=file)
                                            print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                                                  file=file)
                                        else:
                                            print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                                            print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                                                  file=file)
                                else:
                                    wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', width=500, break_long_words=False)
                                    print(wrapper.fill(f"this.{attribute} = data[\"{attribute}\"]"), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t', width=500, break_long_words=False)
        print("", file=file)
        print(wrapper.fill("}"), file=file)
        print("", file=file)
        print("}", file=file)

    console.print("Interface built")
    console.print(f"Path: [italic]{document_interface}[/italic]")

    console.rule(f"{step_index} - Class [cyan underline]goldChecker.ts")
    step_index = step_index + 1

    # This class provides a stub to implement the gold elements check. If there are no gold elements, the check is considered true automatically.
    # The following codes provides answers, notes and attributes for each gold element. Those three corresponding data structures should be used
    # to implement the check

    filename = f"goldChecker.ts"
    if os.path.exists(f"{folder_build_skeleton_path}{filename}"):
        console.print(f"Gold checker [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Gold checker [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_skeleton_path}{filename}", 'w') as file:
            print("export class GoldChecker {", file=file)
            print("", file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t', subsequent_indent='\t')
            print(wrapper.fill('// @ts-ignore TS6133: intentionally unused – user will implement logic.'))
            print(wrapper.fill('static performGoldCheck(goldConfiguration : Array<Object>, taskType = null) {'), file=file)
            print("", file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
            print(wrapper.fill('let goldChecks = new Array<boolean>()'), file=file)
            print("", file=file)
            print(wrapper.fill("/* If there are no gold elements there is nothing to be checked */"), file=file)
            print(wrapper.fill("if(goldConfiguration.length<=0) {"), file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
            print(wrapper.fill("goldChecks.push(true)"), file=file)
            print(wrapper.fill("return goldChecks"), file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
            print(wrapper.fill('}'), file=file)
            print("", file=file)
            print(wrapper.fill("for (let goldElement of goldConfiguration) {"), file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
            print("", file=file)
            print(wrapper.fill("/* Element attributes */"), file=file)
            print(wrapper.fill('// @ts-ignore TS6133: intentionally unused – user will implement logic.'))
            print(wrapper.fill('let document = goldElement["document"]'), file=file)
            print(wrapper.fill("/* Worker's answers for each gold dimensions */"), file=file)
            print(wrapper.fill('// @ts-ignore TS6133: intentionally unused – user will implement logic.'))
            print(wrapper.fill('let answers = goldElement["answers"]'), file=file)
            print(wrapper.fill("/* Worker's notes*/"), file=file)
            print(wrapper.fill('// @ts-ignore TS6133: intentionally unused – user will implement logic.'))
            print(wrapper.fill('let notes = goldElement["notes"]'), file=file)
            print("", file=file)
            print(wrapper.fill("let goldCheck = true"), file=file)
            print("", file=file)
            print(wrapper.fill("/* CONTROL IMPLEMENTATION STARTS HERE */"), file=file)
            print(
                wrapper.fill("/* Write your code; the check for the current element holds if goldCheck remains set to true */"),
                file=file)
            print("", file=file)
            print("", file=file)
            print("", file=file)
            print(wrapper.fill("/* CONTROL IMPLEMENTATION ENDS HERE */"), file=file)
            print(wrapper.fill("/* Push goldCheck inside goldChecks array for the current gold element */"), file=file)
            print(wrapper.fill('goldChecks.push(goldCheck)'), file=file)
            print("", file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
            print(wrapper.fill('}'), file=file)
            print("", file=file)
            print(wrapper.fill('return goldChecks'), file=file)
            print("", file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t', subsequent_indent='\t')
            print(wrapper.fill('}'), file=file)
            print("", file=file)
            print("}", file=file)

        console.print("Class built")
        console.print(f"Path: [italic]{filename}[/italic]")

    if platform == 'mturk':

        console.rule(f"{step_index} - Amazon Mechanical Turk Landing Page")
        step_index = step_index + 1

        status.start()
        status.update(f"Instantiating Mako model")

        model = Template(filename=f"{folder_build_mturk_path}model.html")
        if 'results_retrieved' in search_engine_config:
            if len(search_engine_config['results_retrieved']) > 0:
                mturk_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=cloudfront_endpoint)
            else:
                mturk_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=None)
        else:
            mturk_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=None)
        mturk_page_file = f"{folder_build_mturk_path}index.html"
        with open(mturk_page_file, 'w') as file:
            print(mturk_page, file=file)

        console.print(f"Model istantiated")
        console.print(f"Path: {mturk_page_file}")

        status.update(f"Generating tokens")

        hits_file = f"{folder_build_task_path}{filename_hits_config}"
        mturk_tokens_file = f"{folder_build_mturk_path}tokens.csv"
        console.print(f"Loading [cyan underline]{filename_hits_config}[/cyan underline] file")
        console.print(f"Path: [ital]{hits_file}")
        hits = read_json(hits_file)
        token_df = pd.DataFrame(columns=["tokens"])

        for hit in hits:
            tokens = ""
            for hit in hits:
                tokens = f"{tokens};{hit['token_output']}"
            tokens = tokens[1:]
            token_df = pd.concat([token_df, pd.DataFrame({"tokens": [tokens]})], ignore_index=True)
        token_df.to_csv(mturk_tokens_file, index=False)
        console.print(f"Tokens for {len(hits)} hits generated")
        console.print(f"Path: [italic]{mturk_tokens_file}")

    if platform == "prolific":
        status.update("Prolific Workspace / Project Sanity Check")

        headers = {"Authorization": f"Token {prolific_api_token}"}

        # Build study description from general instructions (HTML preserved)
        study_description = "<Edit the study description here>"

        if instructions_general_config:
            description_parts = []
            for block in instructions_general_config:
                caption = (block.get("caption") or "").strip()
                text_html = (block.get("text") or "").strip()

                # Keep HTML; add a heading for the caption if present
                if caption:
                    description_parts.append(f"<h3>{caption}</h3>")
                if text_html:
                    description_parts.append(text_html)

            if description_parts:
                study_description = "\n\n".join(description_parts)

        # 1) Decide which project to use
        project_id = prolific_project_id  # <- defined above from .env

        if project_id:
            console.print(
                "[bold]Prolific project[/bold]: using id from "
                "env var [cyan]prolific_project_id[/cyan] "
                f"→ [blue]{project_id}[/blue]"
            )
        else:
            # Fallback: ask Prolific which project is "current" for this user
            try:
                user_resp = requests.get(
                    "https://api.prolific.com/api/v1/users/me/",
                    headers=headers,
                )
                if user_resp.ok:
                    user_data = user_resp.json()
                    current_project_id = user_data.get("current_project_id")
                    if current_project_id:
                        project_id = current_project_id
                        console.print(
                            "[bold]Prolific project[/bold]: using "
                            f"[green]current_project_id[/green] from /users/me "
                            f"→ [blue]{project_id}[/blue]"
                        )
                    else:
                        console.print(
                            "[red]/users/me does not expose current_project_id. "
                            "Set prolific_project_id in your .env.[/red]"
                        )
                        raise SystemExit(1)
                else:
                    console.print(
                        f"[red]Failed to call /users/me: {user_resp.status_code}[/red]"
                    )
                    console.print(user_resp.text)
                    raise SystemExit(1)
            except Exception as e:
                console.print(
                    f"[red]Error while probing Prolific current project:[/red] {e}"
                )
                console.print(
                    "[red]Set prolific_project_id in your .env to fix this.[/red]"
                )
                raise SystemExit(1)

        # Optional: log project info
        try:
            project_resp = requests.get(
                f"https://api.prolific.com/api/v1/projects/{project_id}/",
                headers=headers,
            )
            if project_resp.ok:
                project = project_resp.json()
                project_name = project.get("title") or project.get("name", "<unknown>")
                console.print(
                    "[bold]Confirmed Prolific project[/bold]: "
                    f"[green]{project_name}[/green] "
                    f"(id: [blue]{project_id}[/blue])"
                )
            else:
                console.print(
                    f"[yellow]Warning: could not retrieve project {project_id}: "
                    f"{project_resp.status_code}[/yellow]"
                )
        except Exception as e:
            console.print(
                f"[yellow]Warning: error fetching project {project_id}: {e}[/yellow]"
            )

        # 2) Prolific study find-or-create
        console.rule(f"{step_index} - Prolific Study Creation")
        step_index = step_index + 1

        status.start()
        status.update("Checking Prolific study existence")

        study_list_resp = requests.get(
            "https://api.prolific.com/api/v1/studies/",
            headers=headers,
        )

        if not study_list_resp.ok:
            console.print(
                f"[red]Failed to list studies: {study_list_resp.status_code}[/red]"
            )
            console.print(study_list_resp.text)
            raise SystemExit(1)

        study_list = study_list_resp.json().get("results", [])

        study_current = None
        for study_data in study_list:
            if study_data.get("internal_name") == f"{task_name}_{batch_name}":
                study_current = study_data
                console.print(
                    "Prolific study detected. "
                    f"ID: [blue]{study_current['id']}[/blue], "
                    f"Name (Internal): [green]{study_current['internal_name']}[/green]"
                )
                console.print(
                    "[yellow]Existing Prolific study found; "
                    "no update performed by init script.[/yellow]"
                )
                break

        if study_current is None:
            status.update("Creating Prolific study")

            base_external_url = (
                f"https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com/"
                f"{task_name}/{batch_name}/index.html"
            )

            external_study_url = (
                base_external_url
                + "?workerID={{%PROLIFIC_PID%}}"
                + "&studyID={{%STUDY_ID%}}"
                + "&sessionID={{%SESSION_ID%}}"
                + "&platform=prolific"
            )

            prolific_completion_code_env = os.getenv("prolific_completion_code")
            if prolific_completion_code_env:
                completion_code = prolific_completion_code_env
            else:
                completion_code = (
                    f"{task_name}_{batch_name}_OK"
                    .replace("-", "")
                    .replace(" ", "")
                    .upper()
                )

            study_data = {
                "name": task_title if task_title else task_name,
                "internal_name": f"{task_name}_{batch_name}",
                "description": study_description,
                "external_study_url": external_study_url,
                "prolific_id_option": "url_parameters",
                "completion_option": "url",
                "completion_codes": [
                    {
                        "code": completion_code,
                        "code_type": "COMPLETED",
                        "actions": [
                            {"action": "AUTOMATICALLY_APPROVE"},
                        ],
                    }
                ],
                "total_available_places": len(hits),
                "estimated_completion_time": 30,
                "reward": 5,
                "device_compatibility": ["desktop"],
                "peripheral_requirements": [],
                "eligibility_requirements": [],
            }

            response = requests.post(
                f"https://api.prolific.com/api/v1/projects/{project_id}/studies/",
                json=study_data,
                headers={
                    "Authorization": f"Token {prolific_api_token}",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code == 201:
                study = response.json()
                study_id = study.get("id")
                study_name = study.get("name") or study.get("internal_name", "<unknown>")
                study_status = study.get("status", "<unknown>")

                console.print("[green]Study created successfully[/green]")
                console.print(
                    f"  ID: [blue]{study_id}[/blue]\n"
                    f"  Name: [green]{study_name}[/green]\n"
                    f"  Status: [cyan]{study_status}[/cyan]\n"
                    f"  Completion Code: [magenta]{completion_code}[/magenta]"
                )

                if study_id:
                    console.print(
                        "  Open in Prolific: "
                        f"https://app.prolific.com/researcher/studies/{study_id}"
                    )

            else:
                console.print(
                    f"[red]Failed to create study: {response.status_code}[/red]"
                )

                try:
                    error_json = response.json()
                    error_root = error_json.get("error") or error_json
                    error_title = error_root.get("title", "<no title>")
                    error_detail = error_root.get("detail")

                    console.print(f"[red]  Error: {error_title}[/red]")

                    if error_detail:
                        console.print(f"[yellow]  Detail: {error_detail}[/yellow]")
                    else:
                        console.print(f"[yellow]{error_json}[/yellow]")

                except ValueError:
                    console.print(response.text)

    if platform == 'toloka':
        console.rule(f"{step_index} - Toloka HTML Interface")
        step_index = step_index + 1

        status.start()
        status.update(f"Instantiating Mako model")

        model = Template(filename=f"{folder_build_toloka_path}model.html")
        if 'results_retrieved' in search_engine_config:
            if len(search_engine_config['results_retrieved']) > 0:
                toloka_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=cloudfront_endpoint)
            else:
                toloka_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=None)
        else:
            toloka_page = model.render(aws_region=aws_region, aws_deploy_bucket=aws_deploy_bucket, task_name=task_name, batch_name=batch_name, cloudfront_endpoint=None)

        toloka_page_file = f"{folder_build_toloka_path}interface.html"
        with open(toloka_page_file, 'w') as file:
            print(toloka_page, file=file)

        console.print(f"Model istantiated")
        console.print(f"Path: {toloka_page_file}")

        hits_file = f"{folder_build_task_path}{filename_hits_config}"
        toloka_tokens_file = f"{folder_build_toloka_path}tokens.tsv"
        console.print(f"Loading [cyan underline]{filename_hits_config}[/cyan underline] file")
        console.print(f"Path: [ital]{hits_file}")
        hits = read_json(hits_file)
        token_df = pd.DataFrame(columns=["INPUT:token_input"])
        tokens_input = []
        tokens_output = []
        for hit in hits:
            token_df = pd.concat([token_df, pd.DataFrame({"INPUT:token_input": [hit['token_input']]})], ignore_index=True)
            token_df = pd.concat([token_df, pd.DataFrame({"INPUT:token_input": [None]})], ignore_index=True)
            tokens_input.append(hit['token_input'])
            tokens_output.append(hit['token_output'])
        token_df.to_csv(toloka_tokens_file, sep="\t", index=False)
        console.print(f"Token for the current batch chosen")
        console.print(f"Path: [italic]{toloka_tokens_file}")

        console.print(f"Building input specification")
        toloka_input_spec_file = f"{folder_build_toloka_path}input_specification.json"
        input_specification = {
            "token_input": {
                "type": "string",
                "hidden": False,
                "required": False,
                "max_length": 11,
                "min_length": 11,
                "allowed_values": tokens_input
            }
        }
        serialize_json(folder_build_toloka_path, 'input_specification.json', input_specification)
        console.print(f"Path: {toloka_input_spec_file}")

        console.print(f"Building output specification")
        toloka_output_spec_file = f"{folder_build_toloka_path}output_specification.json"
        output_specification = {
            "token_input": {
                "type": "string",
                "hidden": False,
                "required": True,
                "max_length": 11,
                "min_length": 11,
                "allowed_values": tokens_input
            },
            "token_output": {
                "type": "string",
                "hidden": False,
                "required": True,
                "max_length": 11,
                "min_length": 11,
                "allowed_values": tokens_output
            }
        }
        serialize_json(folder_build_toloka_path, 'output_specification.json', output_specification)
        console.print(f"Path: {toloka_output_spec_file}")

    console.rule(
        f"{step_index} - Task [cyan underline]{task_name}[/cyan underline]/[yellow underline]{batch_name}[/yellow underline] build"
    )
    step_index = step_index + 1

    console.print(f"Deployment language code: [cyan underline]{language_code}[/cyan underline]")

    # dist folder must be computed from the Angular workspace root (CORE_DIR), not from cwd
    folder_build_result_path = CORE_DIR / "dist" / "Crowd_Frame" / language_code
    console.print(f"Build output folder: [cyan underline]{folder_build_result_path}[/cyan underline]")


    # ------------------------------------------------------------------
    # Subprocess helpers (stream stderr too, fail fast, and enforce cwd)
    # ------------------------------------------------------------------

    def _build_node_env(project_root: Path) -> dict:
        env = os.environ.copy()

        raw_parts = (env.get("PATH") or "").split(os.pathsep)
        path_parts = [p for p in raw_parts if p and os.path.isdir(p)]

        extra_dirs: list[str] = []

        # Common macOS/Homebrew paths
        for d in ("/usr/local/bin", "/opt/homebrew/bin", "/opt/homebrew/sbin"):
            if os.path.isdir(d):
                extra_dirs.append(d)

        # NVM (macOS/Linux)
        nvm_root = Path.home() / ".nvm" / "versions" / "node"
        if nvm_root.exists():
            for p in sorted(nvm_root.glob("*/bin")):
                if p.is_dir():
                    extra_dirs.append(str(p))

        # Windows (if any)
        program_files = os.environ.get("ProgramFiles")
        if program_files:
            nodejs_dir = os.path.join(program_files, "nodejs")
            if os.path.isdir(nodejs_dir):
                extra_dirs.append(nodejs_dir)

        # Local node bin
        local_bin = project_root / "node_modules" / ".bin"
        if local_bin.is_dir():
            extra_dirs.append(str(local_bin))

        merged: list[str] = []
        for d in extra_dirs + path_parts:
            if d not in merged:
                merged.append(d)

        env["PATH"] = os.pathsep.join(merged)
        return env


    def _resolve_exe(name: str, env: dict) -> str:
        exe = shutil.which(name, path=env.get("PATH", ""))
        if not exe:
            raise RuntimeError(f"{name} not found in PATH. PATH={env.get('PATH', '')}")
        return exe


    def _run_streamed(args: list[str], title: str, cwd: Path, env: dict) -> None:
        status.update(title)
        console.print(f"Command: [green on black]{' '.join(args)}[/green on black]")

        process = subprocess.Popen(
            args,
            cwd=str(cwd),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        assert process.stdout is not None
        for line in process.stdout:
            line_clean = line.strip()
            if "Initial Total" in line_clean:
                line_clean = line_clean[2:]
            if line_clean:
                console.print(line_clean)

        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f"Command failed (exit {return_code}): {' '.join(args)}")


    node_env = _build_node_env(CORE_DIR)
    yarn_exe = _resolve_exe("yarn", node_env)
    xlf_merge_exe = _resolve_exe("xlf-merge", node_env)

    # ------------------------------------------------------------------
    # i18n extraction + merge (run from CORE_DIR)
    # ------------------------------------------------------------------

    if language_code != "en-US":
        locale_file_existing_path = f"{folder_locales_path}messages.{language_code}.xlf"
        locale_file_existing_temp_path = f"{folder_locales_path}messages.{language_code}-old.xlf"

        if os.path.exists(locale_file_existing_path):
            status.update("Copying previous translations, please wait")
            shutil.copy(locale_file_existing_path, locale_file_existing_temp_path)

        _run_streamed(
            [yarn_exe, "run", "translate"],
            "Extracting i18n translations, please wait",
            cwd=CORE_DIR,
            env=node_env,
        )

        if os.path.exists(locale_file_existing_temp_path):
            _run_streamed(
                [
                    xlf_merge_exe,
                    "merge",
                    locale_file_existing_temp_path,
                    f"{folder_locales_path}messages.xlf",
                    locale_file_existing_path,
                ],
                "Updating translation files, please wait",
                cwd=CORE_DIR,
                env=node_env,
            )
            os.remove(locale_file_existing_temp_path)

    # ------------------------------------------------------------------
    # Angular build (run from CORE_DIR)
    # ------------------------------------------------------------------

    configuration = "production" if language_code == "en-US" else f"production-{language_code}"
    _run_streamed(
        [
            yarn_exe,
            "run",
            "build",
            "--configuration",
            configuration,
            "--output-hashing=none",
            "--named-chunks=false",
            "--base-href",
            f"/{task_name}/{batch_name}/",
        ],
        "Executing build command, please wait",
        cwd=CORE_DIR,
        env=node_env,
    )

    # ------------------------------------------------------------------
    # Merge JS assets with esbuild
    # ------------------------------------------------------------------

    status.update("Merging Javascript assets (via esbuild single bundle)")

    script_merged_file_path = Path(folder_build_deploy_path) / "scripts.js"
    entry_script_source_path = folder_build_result_path / "entry-for-esbuild.js"
    temp_bundle_file_path = Path(str(script_merged_file_path) + ".tmp")

    for p in [entry_script_source_path, temp_bundle_file_path]:
        if p.exists():
            p.unlink()

    # main*.js (fallback to accommodate possible layout changes)
    main_candidates = list(folder_build_result_path.rglob("main*.js"))
    if not main_candidates:
        console.print("[bold red]main*.js not found, cannot continue![/bold red]")
        raise RuntimeError(f"main*.js not found after Angular build in {folder_build_result_path}")
    main_script_source_path = main_candidates[0]

    # polyfills*.js (optional)
    polyfills_candidates = list(folder_build_result_path.rglob("polyfills*.js"))
    polyfills_source_path = polyfills_candidates[0] if polyfills_candidates else None

    with open(entry_script_source_path, "w") as entry_file:
        if polyfills_source_path is not None:
            poly_rel = polyfills_source_path.relative_to(folder_build_result_path).as_posix()
            console.print(f"Entry will include: [italic purple on black]{polyfills_source_path}[/italic purple on black]")
            entry_file.write(f"import './{poly_rel}';\n")
        else:
            console.print("[yellow]Warning: polyfills not detected, proceeding without it[/yellow]")

        main_rel = main_script_source_path.relative_to(folder_build_result_path).as_posix()
        console.print(f"Entry will include: [italic purple on black]{main_script_source_path}[/italic purple on black]")
        entry_file.write(f"import './{main_rel}';\n")

    _run_streamed(
        [
            yarn_exe,
            "esbuild",
            str(entry_script_source_path),
            "--bundle",
            f"--outfile={temp_bundle_file_path}",
            "--format=esm",
        ],
        "Running esbuild to create single JS bundle (temp file)",
        cwd=CORE_DIR,
        env=node_env,
    )

    try:
        if script_merged_file_path.exists() and filecmp.cmp(
            str(temp_bundle_file_path), str(script_merged_file_path), shallow=False
        ):
            console.print("[green]No changes in JS bundle, skipping overwrite[/green]")
            temp_bundle_file_path.unlink(missing_ok=True)
        else:
            shutil.move(str(temp_bundle_file_path), str(script_merged_file_path))
            console.print(f"[cyan]Bundle updated: {script_merged_file_path}[/cyan]")
    finally:
        if entry_script_source_path.exists():
            entry_script_source_path.unlink()
        if temp_bundle_file_path.exists():
            temp_bundle_file_path.unlink()

    console.print("Deleting build folder")
    build_folder_to_delete = CORE_DIR / "dist" / "Crowd_Frame"
    if build_folder_to_delete.exists():
        console.print(f"Path: [italic underline]{build_folder_to_delete}[/italic underline]")
        shutil.rmtree(build_folder_to_delete)
    else:
        console.print(f"Build folder not detected: [italic underline]{build_folder_to_delete}[/italic underline]")

    # ------------------------------------------------------------------
    # Create index.html from template
    # ------------------------------------------------------------------

    model = Template(filename=f"{folder_build_deploy_path}model.html")
    index_page = model.render(
        task_title=task_title if task_title else None,
        task_name=task_name,
        batch_name=batch_name,
    )

    index_page_file = f"{folder_build_deploy_path}index.html"
    with open(index_page_file, "w") as file:
        print(index_page, file=file)

    console.print("Model instantiated")
    console.print(f"Path: [italic underline]{index_page_file}[/italic underline]")

    # ------------------------------------------------------------------
    # Packaging Task folders + copy artifacts
    # ------------------------------------------------------------------

    console.rule(f"{step_index} - Packaging Task [cyan underline]tasks/{task_name}/{batch_name}[/cyan underline]")
    step_index = step_index + 1

    status.start()
    status.update("Starting")

    folder_tasks_batch_path = f"{folder_tasks_path}{task_name}/{batch_name}/"
    folder_tasks_batch_deploy_path = f"{folder_tasks_batch_path}deploy/"
    folder_tasks_batch_env_path = f"{folder_tasks_batch_path}environments/"
    folder_tasks_batch_mturk_path = f"{folder_tasks_batch_path}mturk/"
    folder_tasks_batch_toloka_path = f"{folder_tasks_batch_path}toloka/"
    folder_tasks_batch_task_path = f"{folder_tasks_batch_path}task/"
    folder_tasks_batch_config_path = f"{folder_tasks_batch_path}config/"
    folder_tasks_batch_skeleton_path = f"{folder_tasks_batch_path}skeleton/"

    os.makedirs(folder_tasks_batch_deploy_path, exist_ok=True)
    os.makedirs(folder_tasks_batch_env_path, exist_ok=True)
    os.makedirs(folder_tasks_batch_task_path, exist_ok=True)
    os.makedirs(folder_tasks_batch_config_path, exist_ok=True)
    os.makedirs(folder_tasks_batch_skeleton_path, exist_ok=True)

    if platform == "mturk":
        os.makedirs(folder_tasks_batch_mturk_path, exist_ok=True)
    if platform == "toloka":
        os.makedirs(folder_tasks_batch_toloka_path, exist_ok=True)

    console.print(f"Path: [italic]{folder_tasks_batch_deploy_path}[/italic]")
    console.print(f"Path: [italic]{folder_tasks_batch_env_path}[/italic]")
    console.print(f"Path: [italic]{folder_tasks_batch_task_path}[/italic]")
    console.print(f"Path: [italic]{folder_tasks_batch_config_path}[/italic]")
    console.print(f"Path: [italic]{folder_tasks_batch_skeleton_path}[/italic]")


    def copy(source: str, destination: str, title: str) -> None:
        panel = Panel(
            f"Source: [italic white on black]{source}[/italic white on black]\n"
            f"Destination: [italic white on black]{destination}[/italic white on black]",
            title=title,
        )
        console.print(panel)
        copy2(source, destination)


    console.print(
        f"Copying files for [blue underline on white]{folder_build_deploy_path}[/blue underline on white] folder"
    )

    copy(f"{folder_build_deploy_path}scripts.js", f"{folder_tasks_batch_deploy_path}scripts.js", "Javascript Assets")
    copy(f"{folder_build_deploy_path}styles.css", f"{folder_tasks_batch_deploy_path}styles.css", "CSS Styles")
    copy(f"{folder_build_deploy_path}index.html", f"{folder_tasks_batch_deploy_path}index.html", "Task Homepage")

    console.print(f"Copying files for [blue underline on white]{folder_build_env_path}[/blue underline on white] folder")
    copy(f"{folder_build_env_path}environment.ts", f"{folder_tasks_batch_env_path}environment.ts", "Dev Environment")
    copy(f"{folder_build_env_path}environment.prod.ts", f"{folder_tasks_batch_env_path}environment.prod.ts", "Prod Environment")

    if platform == "toloka":
        console.print(f"Copying files for [blue underline on white]{folder_build_toloka_path}[/blue underline on white] folder")
        copy(f"{folder_build_toloka_path}interface.html", f"{folder_tasks_batch_toloka_path}interface.html", "Page Markup")
        copy(f"{folder_build_toloka_path}interface.css", f"{folder_tasks_batch_toloka_path}interface.css", "Page Stylesheet")
        copy(f"{folder_build_toloka_path}interface.js", f"{folder_tasks_batch_toloka_path}interface.js", "Page Javascript")
        copy(f"{folder_build_toloka_path}tokens.tsv", f"{folder_tasks_batch_toloka_path}tokens.tsv", "Hits tokens")
        copy(f"{folder_build_toloka_path}input_specification.json", f"{folder_tasks_batch_toloka_path}input_specification.json", "Input Specification")
        copy(f"{folder_build_toloka_path}output_specification.json", f"{folder_tasks_batch_toloka_path}output_specification.json", "Output Specification")

    if platform == "mturk":
        console.print(f"Copying files for [blue underline on white]{folder_build_mturk_path}[/blue underline on white] folder")
        copy(f"{folder_build_mturk_path}index.html", f"{folder_tasks_batch_mturk_path}index.html", "Amazon Mechanical Turk landing page")
        copy(f"{folder_build_mturk_path}tokens.csv", f"{folder_tasks_batch_mturk_path}tokens.csv", "Hits tokens")

    console.print(f"Copying files for [blue underline on white]{folder_build_task_path}[/blue underline on white] folder")
    copy(f"{folder_build_task_path}{filename_hits_config}", f"{folder_tasks_batch_task_path}{filename_hits_config}", "Hits")
    copy(f"{folder_build_task_path}{filename_dimensions_config}", f"{folder_tasks_batch_task_path}{filename_dimensions_config}", "Dimensions")
    copy(f"{folder_build_task_path}{filename_instructions_evaluation_config}", f"{folder_tasks_batch_task_path}{filename_instructions_evaluation_config}", "Assessment Instructions")
    copy(f"{folder_build_task_path}{filename_instructions_general_config}", f"{folder_tasks_batch_task_path}{filename_instructions_general_config}", "General Instructions")
    copy(f"{folder_build_task_path}{filename_questionnaires_config}", f"{folder_tasks_batch_task_path}{filename_questionnaires_config}", "Questionnaires")
    copy(f"{folder_build_task_path}{filename_search_engine_config}", f"{folder_tasks_batch_task_path}{filename_search_engine_config}", "Search Engine")
    copy(f"{folder_build_task_path}{filename_task_settings_config}", f"{folder_tasks_batch_task_path}{filename_task_settings_config}", "Task Settings")
    copy(f"{folder_build_task_path}{filename_workers_settings_config}", f"{folder_tasks_batch_task_path}{filename_workers_settings_config}", "Workers Settings")

    console.print(f"Copying files for [yellow underline on white]{folder_tasks_batch_skeleton_path}[/yellow underline on white] folder")
    copy(f"{folder_build_skeleton_path}document.ts", f"{folder_tasks_batch_skeleton_path}document.ts", "Document Interface")
    copy(f"{folder_build_skeleton_path}goldChecker.ts", f"{folder_tasks_batch_skeleton_path}goldChecker.ts", "Gold Checker")

    console.print(f"Copying files for [blue underline on white]{folder_tasks_batch_config_path}[/blue underline on white] folder")
    copy(f"{folder_build_config_path}admin.json", f"{folder_tasks_batch_config_path}admin.json", "Admin Credentials")

    # ------------------------------------------------------------------
    # Deploy (upload to S3)
    # ------------------------------------------------------------------

    console.rule(f"{step_index} - Task [cyan underline]tasks/{task_name}/{batch_name} Deploy[/cyan underline]")
    step_index = step_index + 1

    status.start()
    status.update("Starting")

    s3_private_generator_path = f"{task_name}/{batch_name}/Generator/"
    s3_private_task_path = f"{task_name}/{batch_name}/Task/"
    s3_deploy_path = f"{task_name}/{batch_name}/"


    def upload(path: str, bucket: str, key: str, title: str, content_type: str, acl: str | None = None) -> None:
        panel = Panel(
            f"Region: [italic white on black]{aws_region}[/italic white on black]\n"
            f"Bucket: [italic white on black]{bucket}[/italic white on black]\n"
            f"File: [italic white on black]{path}[/italic white on black]\n"
            f"Key: [italic white on black]{key}[/italic white on black]\n"
            f"Path: [italic white on black]s3://{aws_region}/{bucket}/{key}[/italic white on black]\n"
            f"ACL: {acl}",
            title=title,
        )
        console.print(panel)

        with open(path, "rb") as fh:
            if acl:
                response = s3_client.put_object(
                    Body=fh, Bucket=bucket, Key=key, ContentType=content_type, ACL=acl
                )
            else:
                response = s3_client.put_object(
                    Body=fh, Bucket=bucket, Key=key, ContentType=content_type
                )

        console.print(
            f"HTTP Status Code: {response['ResponseMetadata']['HTTPStatusCode']}, ETag: {response['ETag']}"
        )


    console.print("[white on blue bold]Generator configuration[/white on blue bold]")
    upload(
        f"{folder_tasks_batch_config_path}admin.json",
        aws_private_bucket,
        f"{s3_private_generator_path}admin.json",
        "Admin Credentials",
        "application/json",
        "bucket-owner-full-control",
    )

    console.print("[white on green bold]Task configuration[/white on green bold]")
    upload(
        f"{folder_tasks_batch_task_path}{filename_hits_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_hits_config}",
        "Hits",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_instructions_evaluation_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_instructions_evaluation_config}",
        "Assessment Instructions",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_instructions_general_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_instructions_general_config}",
        "General Instructions",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_questionnaires_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_questionnaires_config}",
        "Questionnaires",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_dimensions_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_dimensions_config}",
        "Dimensions",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_search_engine_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_search_engine_config}",
        "Search Engine",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_task_settings_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_task_settings_config}",
        "Task Settings",
        "application/json",
        "bucket-owner-full-control",
    )
    upload(
        f"{folder_tasks_batch_task_path}{filename_workers_settings_config}",
        aws_private_bucket,
        f"{s3_private_task_path}{filename_workers_settings_config}",
        "Workers Settings",
        "application/json",
        "bucket-owner-full-control",
    )

    console.print("[white on purple bold]Angular Application[/white on purple bold]")
    upload(
        f"{folder_tasks_batch_deploy_path}scripts.js",
        aws_deploy_bucket,
        f"{s3_deploy_path}scripts.js",
        "Javascript Assets",
        "text/javascript",
        "public-read",
    )
    upload(
        f"{folder_tasks_batch_deploy_path}styles.css",
        aws_deploy_bucket,
        f"{s3_deploy_path}styles.css",
        "CSS Styles",
        "text/css",
        "public-read",
    )
    upload(
        f"{folder_tasks_batch_deploy_path}index.html",
        aws_deploy_bucket,
        f"{s3_deploy_path}index.html",
        "Task Homepage",
        "text/html",
        "public-read",
    )

    if "results_retrieved" in search_engine_config and len(search_engine_config["results_retrieved"]) > 0:
        console.rule(f"{step_index} - Invalidating Contents on Cloudfront distribution")
        step_index = step_index + 1

        paths = {
            "Quantity": 3,
            "Items": [
                f"/{task_name}/{batch_name}/styles.css",
                f"/{task_name}/{batch_name}/scripts.js",
                f"/{task_name}/{batch_name}/index.html",
            ],
        }

        cloudfront_client.create_invalidation(
            DistributionId=distribution["Id"],
            InvalidationBatch={
                "Paths": paths,
                "CallerReference": str(time.time()),
            },
        )

    console.rule(f"{step_index} - Public Links")
    step_index = step_index + 1

    status.start()
    status.update("Writing")

    console.print("Deploy Bucket Endpoint")
    console.print(
        f"[bold white on black]https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com/{task_name}/{batch_name}/index.html[/bold white on black]"
    )

    console.print("Static Website Endpoint")
    console.print(
        f"[bold white on black]http://{aws_deploy_bucket}.s3-website.{aws_region}.amazonaws.com/{task_name}/{batch_name}/[/bold white on black]"
    )

    if "results_retrieved" in search_engine_config and len(search_engine_config["results_retrieved"]) > 0:
        console.print("Cloudfront Endpoint")
        console.print(
            f"[bold white on black]https://{cloudfront_endpoint}/{task_name}/{batch_name}/[/bold white on black]"
        )
