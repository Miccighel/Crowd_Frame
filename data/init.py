#!/usr/bin/env python
# coding: utf-8

import json
from python_on_whales import DockerClient
import docker
from mako.template import Template
import os
from datetime import datetime
import pandas as pd
import subprocess
import random
import hashlib
import shutil
import hmac
import textwrap
import boto3
from zipfile import ZipFile
import time
from distutils.util import strtobool
from pathlib import Path
from shutil import copy2
from botocore.exceptions import ClientError
from docker.errors import ImageNotFound
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import track
import warnings

warnings.simplefilter(action='ignore', category=FutureWarning)

console = Console()

home = str(Path.home())
iam_path = '/Crowd_Frame/'

config_user_name = 'config-user'
mturk_user_name = 'mturk-user'

# Your working dir must be set to data/

folder_aws_path = "aws/"
folder_aws_generated_path = "aws/generated/"
folder_build_path = "build/"
folder_build_config_path = "build/config/"
folder_build_task_path = "build/task/"
folder_build_mturk_path = "build/mturk/"
folder_build_toloka_path = "build/toloka/"
folder_build_env_path = "build/environments/"
folder_build_deploy_path = "build/deploy/"
folder_build_skeleton_path = "build/skeleton/"
folder_tasks_path = "tasks/"


def serialize_json(folder, filename, data):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    console.print(f"Serialized at path: [cyan]{folder}{filename}[/cyan]")
    with open(f"{folder}{filename}", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4, default=str)
        f.close()


def remove_json(folder, filename):
    os.remove(f"{folder}{filename}")


def read_json(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf8") as file:
            data = json.load(file)
        return data
    else:
        return {}


def stop_sequence():
    console.print('\n\n')
    with console.status("Stopping the ship...", spinner="aesthetic"):
        exit()


def key_cont():
    console.input('[yellow]Press enter to continue...')


env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

mail_contact = os.getenv('mail_contact')
platform = os.getenv('platform')
profile_name = os.getenv('profile_name')
task_name = os.getenv('task_name')
batch_name = os.getenv('batch_name')
batch_prefix = os.getenv('batch_prefix')
admin_user = os.getenv('admin_user')
admin_password = os.getenv('admin_password')
server_config = os.getenv('server_config')
deploy_config = strtobool(os.getenv('deploy_config')) if os.getenv('deploy_config') is not None else False
enable_solver = strtobool(os.getenv('enable_solver')) if os.getenv('enable_solver') is not None else False
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
table_logging_name = f"Crowd_Frame-{task_name}_{batch_name}_Logger"
table_data_name = f"Crowd_Frame-{task_name}_{batch_name}_Data"
table_acl_name = f"Crowd_Frame-{task_name}_{batch_name}_ACL"
api_gateway_name = 'Crowd_Frame-API'

if profile_name is None:
    profile_name = 'default'

iam_client = boto3.Session(profile_name=profile_name).client('iam', region_name=aws_region)

console.rule("0 - Initialization")

console.print("[bold]Init.py[/bold] script launched")
console.print(f"Working directory: [bold]{os.getcwd()}[/bold]")

if batch_prefix is None:
    batch_prefix = ''

if platform is None:
    platform = 'mturk'

console.rule("1 - Configuration policy")

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
                    "sqs:ListQueues",
                    "sqs:CreateQueue",
                    "sqs:GetQueueUrl",
                    "sqs:GetQueueAttributes",
                    "apigateway:GET",
                    "apigateway:POST",
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

    console.rule(f"2 - [yellow]{config_user_name}[/yellow] creation")

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

    console.rule(f"3 - Amazon Mechanical Turk policy")

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

    console.rule(f"4 - [yellow]{mturk_user_name}[/yellow] creation")

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

    console.rule("5 - Local Configuration File")

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

    console.rule(f"6 - [yellow]{config_user_name}[/yellow] authentication")

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

    console.rule(f"7 - [yellow]{root_user.user_name}[/yellow] policies check")

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
        ]
    }

    denied = []
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
    except ClientError:
        status.stop()
        console.print("[bold red]\nYou must grant access to the SimulatePrincipalPolicy operation!\n")
        stop_sequence()

    console.rule(f"8 - Crowd workers interaction policy")

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

    console.rule(f"9 - [cyan underline]crowd-worker[/cyan underline] user creation")

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

    console.rule(f"10 - Private bucket [cyan underline]{aws_private_bucket}[/cyan underline] creation")

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
    except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
        console.print(f"[yellow]Bucket already created[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")
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

    console.rule(f"11 - Deploy bucket [cyan underline]{aws_deploy_bucket}[/cyan underline] creation")

    status.start()
    status.update(f"Creating bucket")

    try:
        if aws_region == 'us-east-1':
            deploy_bucket = s3_client.create_bucket(Bucket=aws_deploy_bucket)
        else:
            deploy_bucket = s3_client.create_bucket(Bucket=aws_deploy_bucket, CreateBucketConfiguration={'LocationConstraint': aws_region})
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

    console.rule(f"12 - Table [cyan underline]{table_data_name}[/cyan underline] setup")

    try:
        table_name = table_data_name
        table = dynamodb_client.create_table(
            TableName=table_name,
            AttributeDefinitions=[{'AttributeName': 'identifier', 'AttributeType': 'S'}, {'AttributeName': 'sequence', 'AttributeType': 'S'}],
            KeySchema=[{'AttributeName': 'identifier', 'KeyType': 'HASH'}, {'AttributeName': 'sequence', 'KeyType': 'RANGE'}],
            BillingMode='PAY_PER_REQUEST'
        )
        serialize_json(folder_aws_generated_path, f"dynamodb_table_{table_name}.json", table)
        status.stop()
        console.print(f"{table_data_name} created")
    except dynamodb_client.exceptions.ResourceInUseException:
        status.stop()
        console.print(f"Table [cyan underline]{table_data_name}[/cyan underline] already created")

    console.rule(f"13 - Table [cyan underline]{table_acl_name}[/cyan underline] setup")

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
            KeySchema=[{'AttributeName': 'identifier', 'KeyType': 'HASH'}],
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

    console.rule(f"14 - Logging infrastructure setup")

    status.start()
    status.update(f"Setting up policies")

    console.print(f"Modality chosen: [cyan on white]{server_config}")

    if server_config == "aws":

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
        status.update(f"Table {table_logging_name} setup")

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
            console.print(f"{table_logging_name} created")
        except dynamodb_client.exceptions.ResourceInUseException:
            status.stop()
            console.print(f"Table {table_logging_name} already created")

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
                Runtime='nodejs14.x',
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
        status.update('Gateway setup')

        if not any(api for api in api_gateway_client.get_apis()['Items'] if api['Name'] == api_gateway_name):
            response = api_gateway_client.create_api(
                CorsConfiguration={
                    'AllowCredentials': False,
                    'AllowHeaders': ['*'],
                    'AllowMethods': ['POST'],
                    'AllowOrigins': ['*'],
                    'ExposeHeaders': ['*'],
                    'MaxAge': 300
                },
                Name=api_gateway_name,
                ProtocolType='HTTP'
            )
            serialize_json(folder_aws_generated_path, f"api_gateway_{api_gateway_name}.json", response)
            api = dict((key, response[key]) for key in ['ApiEndpoint', 'ApiId'])
            api['integration'] = api_gateway_client.create_integration(
                ApiId=api['ApiId'],
                IntegrationType='AWS_PROXY',
                IntegrationSubtype='SQS-SendMessage',
                PayloadFormatVersion='1.0',
                CredentialsArn=f'arn:aws:iam::{aws_account_id}:role{iam_path}GatewayToSQS',
                RequestParameters={
                    'QueueUrl': f'https://sqs.{aws_region}.amazonaws.com/{aws_account_id}/{queue_name}',
                    'MessageBody': '$request.body'
                }
            )
            serialize_json(folder_aws_generated_path, f"api_gateway_integration_{api['integration']['IntegrationId']}.json", api['integration'])
            response = api_gateway_client.create_route(
                ApiId=api['ApiId'],
                RouteKey='POST /log',
                Target='integrations/' + api['integration']['IntegrationId']
            )
            serialize_json(folder_aws_generated_path, f"api_gateway_route_{response['RouteId']}.json", response)
            response = api_gateway_client.create_stage(
                ApiId=api['ApiId'],
                StageName="$default",
                AutoDeploy=True
            )
            serialize_json(folder_aws_generated_path, f"api_gateway_stage_{response['StageName']}.json", response)
            console.print(f'[link={api["ApiEndpoint"]}/log]API endpoint[/link] created.')
        else:
            api = [api for api in api_gateway_client.get_apis()['Items'] if api['Name'] == api_gateway_name][0]
            api = dict((key, api[key]) for key in ['ApiEndpoint', 'ApiId'])
            status.stop()
            console.print(f'[link={api["ApiEndpoint"]}/log]API endpoint[/link] already created')

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
            console.print(f"Event source mapping between {queue_name} and {function_name} created.")
            serialize_json(folder_aws_generated_path, f"lambda_event_source_mapping_{response['UUID']}.json", response)
        else:
            console.print(f"[yellow]Event source mapping already created.")
        status.stop()

    elif server_config == "custom":
        status.stop()
        console.print("Please insert your custom logging endpoint: ")
        endpoint = console.input()
    elif server_config == "none":
        console.print("Logging infrastructure not deployed")
        endpoint = ""
    else:
        raise Exception("Your [italic]server_config[/italic] environment variable must be set to [white on black]aws[/white on black], [white on black]custom[/white on black] or [white on black]none[/white on black]")

    console.rule(f"15 - HITs Solver setup")

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

    console.rule(f"16 - Budgeting setting")
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
                    "budgets:*"
                ],
                "Resource": "*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "aws-portal:ViewBilling"
                ],
                "Resource": "*"
            },
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
                    "aws-portal:ModifyBilling",
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

    console.rule(f"16 - Environment: [cyan underline]PRODUCTION[/cyan underline] creation")
    status.start()
    status.update(f"Creating environment")

    environment_development = f"{folder_build_env_path}environment.ts"
    environment_production = f"{folder_build_env_path}environment.prod.ts"

    environment_dict = {
        "production": 'true',
        "configuration_local": 'false',
        "platform": platform if platform else 'mturk',
        "taskName": task_name,
        "batchName": batch_name,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "prolific_completion_code": prolific_completion_code if prolific_completion_code else 'false',
        "bing_api_key": bing_api_key,
        "fake_json_token": fake_json_token,
        "log_on_console": 'false',
        "log_server_config": f"{server_config}",
        "table_acl_name": f"{table_acl_name}",
        "table_data_name": f"{table_data_name}",
        "table_log_name": f"{table_logging_name}",
        "hit_solver_endpoint": f"{hit_solver_endpoint}"
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

    console.rule(f"17 - Environment: [cyan underline]DEVELOPMENT[/cyan underline] creation")
    status.start()
    status.update(f"Creating environment")

    environment_dict = {
        "production": 'false',
        "configuration_local": 'false',
        "platform": platform if platform else 'mturk',
        "taskName": task_name,
        "batchName": batch_name,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "prolific_completion_code": prolific_completion_code if prolific_completion_code else 'false',
        "bing_api_key": bing_api_key,
        "fake_json_token": fake_json_token,
        "log_on_console": 'true',
        "log_server_config": f"{server_config}",
        "table_acl_name": f"{table_acl_name}",
        "table_data_name": f"{table_data_name}",
        "table_log_name": f"{table_logging_name}",
        "hit_solver_endpoint": f"{hit_solver_endpoint}"
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

    console.rule(f"18 - Admin Credentials Creation")
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

    console.rule(f"19 - Sample task configuration")
    status.start()
    status.update(f"Generating a sample configuration if needed")

    if not os.path.exists(folder_build_task_path):
        os.makedirs(folder_build_task_path, exist_ok=True)

    filename = "hits.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(
            f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_units = [{
                "unit_id": "unit_0",
                "token_input": "ABCDEFGHILM",
                "token_output": "MNOPQRSTUVZ",
                "documents_number": 1,
                "documents": [
                    {
                        "id": "identifier_1",
                        "text": "Lorem ipsum dolor sit amet"
                    }
                ]
            }]
            print(json.dumps(sample_units, indent=4), file=file)

    filename = "questionnaires.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(
            f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_questionnaires = [
                {
                    "type": "standard",
                    "description": "This is a standard questionnaire",
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
                    "description": "This is a CRT questionnaire",
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

    filename = "dimensions.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(
            f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_dimensions = [{
                "name": "sample-dimension",
                "name_pretty": "Sample Dimension",
                "description": "Lorem ipsum dolor sit amet",
                "gold": False,
                "pairwise": False,
                "url": False,
                "justification": False,
                "scale": {
                    "type": "categorical",
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

    filename = "instructions_general.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
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

    filename = "instructions_evaluation.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(
            f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_instructions = [
                {
                    "caption": "Evaluation Instructions",
                    "text": "<p>Lorem ipsum <strong>dolor</strong> sit amet.</p>"
                }
            ]
            print(json.dumps(sample_instructions, indent=4), file=file)

    filename = "search_engine.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_search_engine = {
                "source": "FakerWebSearch",
                "domains_filter": []
            }

            print(json.dumps(sample_search_engine, indent=4), file=file)

    filename = "task.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        try:
            logging_endpoint = f'{api["ApiEndpoint"]}/log'
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
                        "show": False,
                        "annotate": False,
                        "required": False
                    },
                    {
                        "name": "text",
                        "show": True,
                        "required": False,
                        "annotate": False
                    }
                ],
                "annotator": False,
                "countdown_time": False,
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
                    "crowd-xplorer": {
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

    filename = "workers.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_worker_checks = {
                "block": True,
                "blacklist": [],
                "whitelist": [],
                "blacklist_batches": [],
                "whitelist_batches": [],
            }
            print(json.dumps(sample_worker_checks, indent=4), file=file)

    console.print(f"Path: [italic white on black]{folder_build_task_path}[/italic white on black]")

    console.rule(f"20 - Interface [cyan underline]document.ts")

    hits_file = f"{folder_build_task_path}hits.json"
    document_interface = f"{folder_build_skeleton_path}document.ts"
    if not os.path.exists(folder_build_skeleton_path):
        os.makedirs(folder_build_skeleton_path, exist_ok=True)

    console.print(f"Reading hits file")
    console.print(f"Path: [italic]{hits_file}[/italic]")
    hits = read_json(hits_file)
    documents = hits.pop()['documents']

    sample_element = {}

    if len(documents) > 0:

        sample_element = documents.pop()

        if not 'id' in sample_element.keys():
            raise Exception("Your hits.json file does not contains an attributed called \"id\"!")

    # This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
    # The attribute <document_index> is additional and should not be touched and passed in the constructor.
    # Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.

    with open(document_interface, 'w') as file:
        print("export class Document {", file=file)
        print("", file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
        print(wrapper.fill("index: number;"), file=file)
        for attribute, value in sample_element.items():
            try:
                element = json.loads(value)
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
                    if isinstance(value[0], dict):
                        print(wrapper.fill(f"{attribute}: Array<JSON>;"), file=file)
                    else:
                        print(wrapper.fill(f"{attribute}: Array<String>;"), file=file)
                elif isinstance(value, int) or isinstance(value, float):
                    print(wrapper.fill(f"{attribute}: number;"), file=file)
                else:
                    print(wrapper.fill(f"{attribute}: string;"), file=file)
                console.print(f"Attribute with name: [cyan underline]{attribute}[/cyan underline] and type: {type(value)} found")
        print("", file=file)
        print(wrapper.fill(f"constructor ("), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
        print(wrapper.fill("index: number,"), file=file)
        print(wrapper.fill("data: JSON"), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
        print(wrapper.fill(") {"), file=file)
        print("", file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
        print(wrapper.fill("this.index = index"), file=file)
        for attribute, value in sample_element.items():
            try:
                element = json.loads(value)
                if isinstance(element, dict):
                    print(wrapper.fill(f"this.{attribute} = new Array<JSON>()"), file=file)
                    print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"), file=file)
                elif isinstance(element, list):
                    print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                    print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"])"), file=file)
                else:
                    wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
                    print(wrapper.fill(f"this.{attribute} = data[\"{attribute}\"]"), file=file)
            except (TypeError, ValueError) as e:
                if isinstance(value, list):
                    if isinstance(value[0], dict):
                        print(wrapper.fill(f"this.{attribute} = new Array<JSON>()"), file=file)
                        print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"), file=file)
                    else:
                        print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                        print(wrapper.fill(f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"])"), file=file)
                else:
                    wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
                    print(wrapper.fill(f"this.{attribute} = data[\"{attribute}\"]"), file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
        print("", file=file)
        print(wrapper.fill("}"), file=file)
        print("", file=file)
        print("}", file=file)

    console.print("Interface built")
    console.print(f"Path: [italic]{document_interface}[/italic]")

    console.rule(f"21 - Class [cyan underline]goldChecker.ts")

    # This class provides a stub to implement the gold elements check. If there are no gold elements, the check is considered true automatically.
    # The following codes provides answers, notes and attributes for each gold element. Those three corresponding data structures should be used
    # to implement the check

    filename = f"goldChecker.ts"
    if os.path.exists(f"{folder_build_skeleton_path}{filename}"):
        console.print(f"Gold checker [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Gold checker [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_skeleton_path}{filename}", 'w') as file:
            print("export class GoldChecker {", file=file)
            print("", file=file)
            wrapper = textwrap.TextWrapper(initial_indent='\t', subsequent_indent='\t')
            print(wrapper.fill('static performGoldCheck(goldConfiguration : Array<Object>) {'), file=file)
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
            print(wrapper.fill('let document = goldElement["document"]'), file=file)
            print(wrapper.fill("/* Worker's answers for each gold dimensions */"), file=file)
            print(wrapper.fill('let answers = goldElement["answers"]'), file=file)
            print(wrapper.fill("/* Worker's notes*/"), file=file)
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

        console.rule(f"22 - Amazon Mechanical Turk Landing Page")
        status.start()
        status.update(f"Istantiating Mako model")

        model = Template(filename=f"{folder_build_mturk_path}model.html")
        mturk_page = model.render(
            aws_region=aws_region,
            aws_deploy_bucket=aws_deploy_bucket,
            task_name=task_name,
            batch_name=batch_name
        )
        mturk_page_file = f"{folder_build_mturk_path}index.html"
        with open(mturk_page_file, 'w') as file:
            print(mturk_page, file=file)

        console.print(f"Model istantiated")
        console.print(f"Path: {mturk_page_file}")

        status.update(f"Generating tokens")

        hits_file = f"{folder_build_task_path}hits.json"
        mturk_tokens_file = f"{folder_build_mturk_path}tokens.csv"
        console.print(f"Loading [cyan underline]hits.json[/cyan underline] file")
        console.print(f"Path: [ital]{hits_file}")
        hits = read_json(hits_file)
        token_df = pd.DataFrame(columns=["tokens"])

        for hit in hits:
            tokens = ""
            for hit in hits:
                tokens = f"{tokens};{hit['token_output']}"
            tokens = tokens[1:]
            token_df = token_df.append({
                "tokens": tokens
            }, ignore_index=True)
        token_df.to_csv(mturk_tokens_file, index=False)
        console.print(f"Tokens for {len(hits)} hits generated")
        console.print(f"Path: [italic]{mturk_tokens_file}")

    if platform == 'toloka':
        console.rule(f"22 - Toloka HTML Interface")
        status.start()
        status.update(f"Istantiating Mako model")

        model = Template(filename=f"{folder_build_toloka_path}model.html")
        toloka_page = model.render(
            aws_region=aws_region,
            aws_deploy_bucket=aws_deploy_bucket,
            task_name=task_name,
            batch_name=batch_name
        )
        toloka_page_file = f"{folder_build_toloka_path}interface.html"
        with open(toloka_page_file, 'w') as file:
            print(toloka_page, file=file)

        console.print(f"Model istantiated")
        console.print(f"Path: {toloka_page_file}")

        hits_file = f"{folder_build_task_path}hits.json"
        toloka_tokens_file = f"{folder_build_toloka_path}tokens.tsv"
        console.print(f"Loading [cyan underline]hits.json[/cyan underline] file")
        console.print(f"Path: [ital]{hits_file}")
        hits = read_json(hits_file)
        token_df = pd.DataFrame(columns=["INPUT:token_input"])

        # for hit in hits:
        #     token_df = token_df.append({
        #         "INPUT:token_input": hit['token_input']
        #     }, ignore_index=True)
        #     token_df = token_df.append({
        #         "INPUT:token_input": None
        #     }, ignore_index=True)
        # token_df.to_csv(toloka_tokens_file, sep="\t", index=False)
        console.print(f"Token for the current batch chosen")
        console.print(f"Path: [italic]{toloka_tokens_file}")

    console.rule(f"23 - Task [cyan underline]{task_name}[/cyan underline]/[yellow underline]{batch_name}[/yellow underline] build")
    status.update(f"Executing build command, please wait")

    folder_build_result = f"../dist/"

    command = "yarn run build --configuration=\"production\" --output-hashing=none"
    console.print(f"[green on black]{command}")
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
    for line in process.stdout:
        line_clean = line.decode().strip()
        if "Initial Total" in line_clean:
            line_clean = line_clean[2:]
        if line_clean != "":
            console.print(line_clean)
    process.wait()

    status.update("Merging Javascript assets")
    script_merged_file = f"{folder_build_deploy_path}scripts.js"
    if (os.path.exists(script_merged_file)):
        os.remove(script_merged_file)
    es_scripts = [
        'polyfills.js',
        'runtime.js',
        'main.js',
    ]
    with open(script_merged_file, 'a') as outfile:
        for file in es_scripts:
            script_current_file = f"{folder_build_result}Crowd_Frame/{file}"
            console.print(f"Processing file: [italic purple on black]{script_current_file}")
            with open(script_current_file) as script:
                for line in script:
                    outfile.write(line)
    console.print(f"Path: [italic]{script_merged_file}")

    status.update("Merging CSS assets")
    styles_merged_file = f"{folder_build_deploy_path}styles.css"
    if (os.path.exists(styles_merged_file)):
        os.remove(styles_merged_file)
    css_styles = ['styles.css']
    with open(styles_merged_file, 'a') as outfile:
        for file in css_styles:
            style_current_file = f"{folder_build_result}Crowd_Frame/{file}"
            console.print(f"Processing file: [italic cyan on black]{style_current_file}")
            with open(style_current_file) as style:
                for line in style:
                    outfile.write(line)
    console.print(f"Path: [italic underline]{styles_merged_file}")

    console.print("Deleting build folder")
    console.print(f"Path: [italic underline]{folder_build_result}")
    shutil.rmtree(folder_build_result)

    model = Template(filename=f"{folder_build_deploy_path}model.html")
    index_page = model.render(
        task_name=task_name,
        batch_name=batch_name
    )
    index_page_file = f"{folder_build_deploy_path}index.html"
    with open(index_page_file, 'w') as file:
        print(index_page, file=file)

    console.print("Model istantiated")
    console.print(f"Path: [italic underline]{index_page_file}")

    console.rule(f"24 - Packaging Task [cyan underline]tasks/{task_name}/{batch_name}")
    status.start()
    status.update(f"Starting")

    folder_tasks_batch_path = f"{folder_tasks_path}{task_name}/{batch_name}/"
    folder_tasks_batch_deploy_path = f"{folder_tasks_batch_path}deploy/"
    folder_tasks_batch_env_path = f"{folder_tasks_batch_path}environments/"
    folder_tasks_batch_mturk_path = f"{folder_tasks_batch_path}mturk/"
    folder_tasks_batch_toloka_path = f"{folder_tasks_batch_path}toloka/"
    folder_tasks_batch_task_path = f"{folder_tasks_batch_path}task/"
    folder_tasks_batch_config_path = f"{folder_tasks_batch_path}config/"
    folder_tasks_batch_skeleton_path = f"{folder_tasks_batch_path}skeleton/"

    console.print(f"[italic purple]deploy-config[/italic purple] variable: {bool(deploy_config)}")

    if not os.path.exists(folder_tasks_batch_deploy_path):
        console.print("[green]Deploy folder created")
        os.makedirs(folder_tasks_batch_deploy_path, exist_ok=True)
    else:
        console.print("[yellow]Deploy folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_deploy_path}")
    if platform == 'mturk':
        if not os.path.exists(folder_tasks_batch_mturk_path):
            console.print("[green]Amazon Mechanical Turk assets folder created")
            os.makedirs(folder_tasks_batch_mturk_path, exist_ok=True)
        else:
            console.print("[yellow]Amazon Mechanical Turk assets folder already present")
    if platform == 'toloka':
        if not os.path.exists(folder_tasks_batch_toloka_path):
            console.print("[green]Toloka assets folder created")
            os.makedirs(folder_tasks_batch_toloka_path, exist_ok=True)
        else:
            console.print("[yellow]Toloka assets folder already present")
    if not os.path.exists(folder_tasks_batch_env_path):
        console.print("[green]Environments folder created")
        os.makedirs(folder_tasks_batch_env_path, exist_ok=True)
    else:
        console.print("[yellow]Environments folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_env_path}")
    if not os.path.exists(folder_tasks_batch_task_path) and deploy_config:
        console.print("[green]Task configuration folder created")
        os.makedirs(folder_tasks_batch_task_path, exist_ok=True)
    else:
        console.print("[yellow]Task configuration folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_task_path}")
    if not os.path.exists(folder_tasks_batch_config_path) and deploy_config:
        console.print("[green]Task configuration folder created")
        os.makedirs(folder_tasks_batch_config_path, exist_ok=True)
    else:
        console.print("[yellow]General configuration folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_config_path}")
    if not os.path.exists(folder_tasks_batch_skeleton_path) and deploy_config:
        console.print("[green]Task skeleton folder created")
        os.makedirs(folder_tasks_batch_skeleton_path, exist_ok=True)
    else:
        console.print("[yellow]Task skeleton folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_skeleton_path}")


    def copy(source, destination, title):
        panel = Panel(f"Source: [italic white on black]{source}[/italic white on black]\nDestination: [italic white on black]{destination}[/italic white on black]", title=title)
        console.print(panel)
        copy2(source, destination)


    console.print(f"Copying files for [blue underline on white]{folder_build_deploy_path}[/blue underline on white] folder")

    source = f"{folder_build_deploy_path}scripts.js"
    destination = f"{folder_tasks_batch_deploy_path}scripts.js"
    copy(source, destination, "Javascript Assets")

    source = f"{folder_build_deploy_path}styles.css"
    destination = f"{folder_tasks_batch_deploy_path}styles.css"
    copy(source, destination, "CSS Styles")

    source = f"{folder_build_deploy_path}index.html"
    destination = f"{folder_tasks_batch_deploy_path}index.html"
    copy(source, destination, "Task Homepage")

    console.print(f"Copying files for [blue underline on white]{folder_build_env_path}[/blue underline on white] folder")

    source = f"{folder_build_env_path}environment.ts"
    destination = f"{folder_tasks_batch_env_path}environment.ts"
    copy(source, destination, "Dev Environment")

    source = f"{folder_build_env_path}environment.prod.ts"
    destination = f"{folder_tasks_batch_env_path}environment.prod.ts"
    copy(source, destination, "Prod Environment")

    if platform == 'toloka':
        console.print(f"Copying files for [blue underline on white]{folder_build_toloka_path}[/blue underline on white] folder")

        source = f"{folder_build_toloka_path}interface.html"
        destination = f"{folder_tasks_batch_toloka_path}interface.html"
        copy(source, destination, "Toloka Page Markup")

        source = f"{folder_build_toloka_path}interface.css"
        destination = f"{folder_tasks_batch_toloka_path}interface.css"
        copy(source, destination, "Toloka Page Stylesheet")

        source = f"{folder_build_toloka_path}interface.js"
        destination = f"{folder_tasks_batch_toloka_path}interface.js"
        copy(source, destination, "Toloka Page Javascript")

        source = f"{folder_build_toloka_path}tokens.tsv"
        destination = f"{folder_tasks_batch_toloka_path}tokens.tsv"
        copy(source, destination, "Hits tokens")

    if platform == 'mturk':
        console.print(f"Copying files for [blue underline on white]{folder_build_mturk_path}[/blue underline on white] folder")

        source = f"{folder_build_mturk_path}index.html"
        destination = f"{folder_tasks_batch_mturk_path}index.html"
        copy(source, destination, "Amazon Mechanical Turk landing page")

        source = f"{folder_build_mturk_path}tokens.csv"
        destination = f"{folder_tasks_batch_mturk_path}tokens.csv"
        copy(source, destination, "Hits tokens")

    if bool(deploy_config):
        console.print(f"Copying files for [blue underline on white]{folder_build_task_path}[/blue underline on white] folder")

        source = f"{folder_build_task_path}hits.json"
        destination = f"{folder_tasks_batch_task_path}hits.json"
        copy(source, destination, "Hits")

        source = f"{folder_build_task_path}dimensions.json"
        destination = f"{folder_tasks_batch_task_path}dimensions.json"
        copy(source, destination, "Dimensions")

        source = f"{folder_build_task_path}instructions_evaluation.json"
        destination = f"{folder_tasks_batch_task_path}instructions_evaluation.json"
        copy(source, destination, "Assessment Instructions")

        source = f"{folder_build_task_path}instructions_general.json"
        destination = f"{folder_tasks_batch_task_path}instructions_general.json"
        copy(source, destination, "General Instructions")

        source = f"{folder_build_task_path}questionnaires.json"
        destination = f"{folder_tasks_batch_task_path}questionnaires.json"
        copy(source, destination, "Questionnaires")

        source = f"{folder_build_task_path}search_engine.json"
        destination = f"{folder_tasks_batch_task_path}search_engine.json"
        copy(source, destination, "Search Engine")

        source = f"{folder_build_task_path}task.json"
        destination = f"{folder_tasks_batch_task_path}task.json"
        copy(source, destination, "Task Settings")

        source = f"{folder_build_task_path}workers.json"
        destination = f"{folder_tasks_batch_task_path}workers.json"
        copy(source, destination, "Workers Settings")

    console.print(f"Copying files for [yellow underline on white]{folder_tasks_batch_skeleton_path}[/yellow underline on white] folder")

    source = f"{folder_build_skeleton_path}document.ts"
    destination = f"{folder_tasks_batch_skeleton_path}document.ts"
    copy(source, destination, "Document Interface")

    source = f"{folder_build_skeleton_path}goldChecker.ts"
    destination = f"{folder_tasks_batch_skeleton_path}goldChecker.ts"
    copy(source, destination, "Gold Checker")

    console.print(f"Copying files for [blue underline on white]{folder_tasks_batch_config_path}[/blue underline on white] folder")

    source = f"{folder_build_config_path}admin.json"
    destination = f"{folder_tasks_batch_config_path}admin.json"
    copy(source, destination, "Admin Credentials")

    console.rule(f"25 - Task [cyan underline]tasks/{task_name}/{batch_name} Deploy")
    status.start()
    status.update(f"Starting")

    s3_private_generator_path = f"{task_name}/{batch_name}/Generator/"
    s3_private_task_path = f"{task_name}/{batch_name}/Task/"
    s3_deploy_path = f"{task_name}/{batch_name}/"

    folder_tasks_batch_deploy_path = f"{folder_tasks_batch_path}deploy/"
    folder_tasks_batch_mturk_path = f"{folder_tasks_batch_path}mturk/"
    folder_tasks_batch_task_path = f"{folder_tasks_batch_path}task/"
    folder_tasks_batch_config_path = f"{folder_tasks_batch_path}config/"


    def upload(path, bucket, key, title, content_type, acl=None):
        panel = Panel(
            f"Region: [italic white on black]{aws_region}[/italic white on black]\nBucket: [italic white on black]{bucket}[/italic white on black]\nFile: [italic white on black]{path}[/italic white on black]\nKey: [italic white on black]{key}[/italic white on black]\nPath: [italic white on black] s3://{aws_region}/{bucket}/{key}[/italic white on black]\nACL: {acl}",
            title=title)
        console.print(panel)
        if acl:
            response = s3_client.put_object(Body=open(path, 'rb'), Bucket=bucket, Key=key, ContentType=content_type, ACL=acl)
        else:
            response = s3_client.put_object(Body=open(path, 'rb'), Bucket=bucket, Key=key, ContentType=content_type)
        console.print(f"HTTP Status Code: {response['ResponseMetadata']['HTTPStatusCode']}, ETag: {response['ETag']}")


    console.print(f"[italic purple]deploy-config[/italic purple] variable: {bool(deploy_config)}")

    console.print(f"[white on blue bold]Generator configuration")

    iam_path = f"{folder_tasks_batch_config_path}admin.json"
    key = f"{s3_private_generator_path}admin.json"
    upload(iam_path, aws_private_bucket, key, "Admin Credentials", "application/json", 'bucket-owner-full-control')

    if bool(deploy_config):
        console.print(f"[white on green bold]Task configuration")

        iam_path = f"{folder_tasks_batch_task_path}hits.json"
        key = f"{s3_private_task_path}hits.json"
        upload(iam_path, aws_private_bucket, key, "Hits", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}instructions_evaluation.json"
        key = f"{s3_private_task_path}instructions_evaluation.json"
        upload(iam_path, aws_private_bucket, key, "Assessment Instructions", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}instructions_general.json"
        key = f"{s3_private_task_path}instructions_general.json"
        upload(iam_path, aws_private_bucket, key, "General Instructions", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}questionnaires.json"
        key = f"{s3_private_task_path}questionnaires.json"
        upload(iam_path, aws_private_bucket, key, "Questionnaires", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}dimensions.json"
        key = f"{s3_private_task_path}dimensions.json"
        upload(iam_path, aws_private_bucket, key, "Dimensions", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}search_engine.json"
        key = f"{s3_private_task_path}search_engine.json"
        upload(iam_path, aws_private_bucket, key, "Search Engine", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}task.json"
        key = f"{s3_private_task_path}task.json"
        upload(iam_path, aws_private_bucket, key, "Task Settings", "application/json", 'bucket-owner-full-control')

        iam_path = f"{folder_tasks_batch_task_path}workers.json"
        key = f"{s3_private_task_path}workers.json"
        upload(iam_path, aws_private_bucket, key, "Workers Settings", "application/json", 'bucket-owner-full-control')

    console.print(f"[white on purple bold]Angular Application")

    iam_path = f"{folder_tasks_batch_deploy_path}scripts.js"
    key = f"{s3_deploy_path}scripts.js"
    upload(iam_path, aws_deploy_bucket, key, "Javascript Assets", "text/javascript", "public-read")

    iam_path = f"{folder_tasks_batch_deploy_path}styles.css"
    key = f"{s3_deploy_path}styles.css"
    upload(iam_path, aws_deploy_bucket, key, "CSS Styles", "text/css", "public-read")

    iam_path = f"{folder_tasks_batch_deploy_path}index.html"
    key = f"{s3_deploy_path}index.html"
    upload(iam_path, aws_deploy_bucket, key, "Task Homepage", "text/html", "public-read")

    console.rule(f"26 - Public Link")
    status.start()
    status.update(f"Writing")

    console.print(f"[bold white on black]https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com/{task_name}/{batch_name}/index.html")