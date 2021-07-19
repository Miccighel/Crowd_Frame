#!/usr/bin/env python
# coding: utf-8
import hashlib
import hmac
import json
import os
import random
import shutil
import subprocess
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
from rich.console import Console
from rich.panel import Panel
from rich.progress import track

console = Console()

home = str(Path.home())
path = '/crowdFrame/config/'
userName = 'config_user'

folder_aws_path = "aws/"
folder_aws_generated_path = "aws/generated/"
folder_build_path = "build/"
folder_build_config_path = "build/config/"
folder_build_task_path = "build/task/"
folder_build_mturk_path = "build/mturk/"
folder_build_env_path = "build/environments/"
folder_build_deploy_path = "build/deploy/"
folder_build_skeleton_path = "build/skeleton/"
folder_tasks_path = "tasks/"

botoSession = boto3.Session()


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
        time.sleep(5)
        exit()


def key_cont():
    console.input('[yellow]Press enter to continue...')


env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

profile_name = os.getenv('profile_name')

task_name = os.getenv('task_name')
batch_name = os.getenv('batch_name')
admin_user = os.getenv('admin_user')
admin_password = os.getenv('admin_password')
deploy_config = strtobool(os.getenv('deploy_config'))
server_config = strtobool(os.getenv('server_config'))

aws_region = os.getenv('aws_region')
aws_private_bucket = os.getenv('aws_private_bucket')
aws_deploy_bucket = os.getenv('aws_deploy_bucket')

bing_api_key = os.getenv('bing_api_key')

iam = botoSession.client('iam')

console.rule("1 - Configuration Policy")
with console.status("Generating configuration policy", spinner="aesthetic") as status:
    time.sleep(3)
    configuration_policies = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "UserPolicy",
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
                    "sqs:ListQueues",
                    "sqs:CreateQueue",
                    "sqs:GetQueueAttributes",
                    "apigateway:GET",
                    "apigateway:POST",
                    "dynamodb:CreateTable",
                    "lambda:CreateFunction",
                    "lambda:CreateEventSourceMapping"
                ],
                "Resource": "*"
            }
        ]
    }

    try:
        policy = iam.create_policy(
            PolicyName='configPolicy',
            PolicyDocument=json.dumps(configuration_policies),
            Path=path
        )['Policy']
    except iam.exceptions.EntityAlreadyExistsException:
        policies = iam.list_policies(
            PathPrefix=path
        )['Policies']
        for result in policies:
            if result['PolicyName'] == 'configPolicy':
                policy = result
                break
    serialize_json(folder_aws_generated_path, f"policy_{policy['PolicyName']}.json", policy)

    console.rule(f"2 - [yellow]{userName}[/yellow] Creation")
    status.start()
    status.update(f"Generating user [yellow]{userName}[/yellow] and attaching configuration policy")
    time.sleep(3)
    try:
        user = iam.create_user(
            UserName=userName,
            Path=path
        )['User']
        iam.attach_user_policy(
            UserName=userName,
            PolicyArn=policy['Arn']
        )
    except iam.exceptions.EntityAlreadyExistsException:
        user = iam.get_user(
            UserName=userName
        )['User']
    serialize_json(folder_aws_generated_path, f"user_{user['UserName']}.json", user)

    console.rule("3 - Local Configuration File")
    status.start()
    status.update("Updating local configuration file")
    time.sleep(3)
    file = f'{home}/.aws/credentials'
    exists = False
    if os.path.exists(file):
        with open(file, 'r') as f:
            for line in f:
                if line.strip().find(f'[{userName}]') == 0:
                    exists = True
                    keyLine = f.readline().strip()
                    secretLine = f.readline().strip()
                    if keyLine.find('aws_access_key_id = ') != -1 and secretLine.find('aws_secret_access_key = ') != -1:
                        key = keyLine.split(' ')[2]
                    else:
                        key = ''
                    break
        if not exists:
            credentials = iam.create_access_key(
                UserName=userName
            )['AccessKey']
            with open(file, 'a') as f:
                f.write(f'\n[{userName}]\n')
                f.write(f'aws_access_key_id = {credentials["AccessKeyId"]}\n')
                f.write(f'aws_secret_access_key = {credentials["SecretAccessKey"]}\n')
            console.print('New credentials generated!')
            console.print(f'Access Key ID = {credentials["AccessKeyId"]}')
            console.print(f'Secret Access Key = {credentials["SecretAccessKey"]}')
            console.print('[bold orange]Save them somewhere safe! You will not be able to retrieve them, neither on AWS')
            console.print('[bold green]Your user profile is ready!')
        else:
            exists = False
            availableKeys = iam.list_access_keys(
                UserName=userName
            )['AccessKeyMetadata']
            for onlineKey in availableKeys:
                if onlineKey['AccessKeyId'] == key:
                    exists = True
                    console.print('[bold green]Your user profile is ready!')
                    break
            if not exists:
                console.print(f'[bold red]Your configuration has expired or is broken, remove {userName} profile from credentials file and run this script another time')
    else:
        console.print('[bold red]Before using this tool you MUST install AWS CLI, run `aws configure` command and insert your base credential')

    console.rule(f"4 - [yellow]{userName}[/yellow] Profile Loading")
    status.start()
    status.update("Checking local configuration file")
    time.sleep(3)
    method = None
    status.stop()
    if profile_name:
        console.print("Environment variable [yellow]profile_name[/yellow] detected")
        botoSession = boto3.Session(profile_name=profile_name, region_name=aws_region)
        iam_resource = botoSession.resource('iam')
        root_user = iam_resource.CurrentUser()
        aws_account_id = root_user.arn.split(':')[4]
        console.print(f"ID: [bold cyan on white]{root_user.user_id}")
        console.print(f"Username: [bold cyan on white]{root_user.user_name}")
        console.print(f"ARN: [bold cyan on white]{root_user.arn}")
        console.print(f"AWS Account ID: [bold cyan on white]{aws_account_id}")
    else:
        console.print("How do you want to insert IAM user credentials?")
        console.print("0. AWS CLI credentials file\n1. Manual input\n2. Exit")
        method = console.input("Insert here your choice: ")
        while method != "0" and method != "1" and method != "2":
            method = console.input("Wrong option! Insert here your choice: ")
        if method == "2":
            stop_sequence()
        if method == "0":
            profile = console.input("Insert profile name: ")
            while profile != "exit":
                try:
                    botoSession = boto3.Session(profile_name=profile, region_name=aws_region)
                    root_user_arn = botoSession.client('sts').get_caller_identity()['Arn']
                    break
                except ProfileNotFound:
                    console.print("[bold red]\nProfile not valid! Retry or type exit\n")
                    profile = console.input("Insert profile name: ")
            if profile == "exit":
                stop_sequence()
        else:
            aws_access_key_id = console.input("Insert your AWS account access key: ")
            aws_secret_access_key = console.input("Insert your AWS account secret key: ")
            while aws_access_key_id != "exit" and aws_secret_access_key != "exit":
                botoSession = boto3.Session(
                    aws_access_key_id=aws_access_key_id,
                    aws_secret_access_key=aws_secret_access_key,
                    region_name=aws_region
                )
                try:
                    root_user_arn = botoSession.client('sts').get_caller_identity()['Arn']
                    break
                except ClientError:
                    console.print("[bold red]\nCredentials are not valid! Retry or type exit in one of the fields\n")
                    aws_access_key_id = console.input("Insert your AWS account access key: ")
                    aws_secret_access_key = console.input("Insert your AWS account secret key: ")
            if aws_access_key_id == 'exit' or aws_secret_access_key == 'exit':
                stop_sequence()
        iam_resource = botoSession.resource('iam')
        root_user = iam_resource.CurrentUser()
        aws_account_id = root_user.arn.split(':')[4]

    console.rule(f"5 - [yellow]{userName}[/yellow] Policies Check")
    status.start()
    status.update(f"Checking policies")
    time.sleep(3)

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
            "sqs:ListQueues",
            "sqs:CreateQueue",
            "sqs:GetQueueAttributes",
            "apigateway:GET",
            "apigateway:POST",
            "dynamodb:CreateTable",
            "lambda:CreateFunction",
            "lambda:CreateEventSourceMapping"
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
            "s3:ListAllMyBuckets",
            "s3:CreateBucket",
            "s3:PutBucketPublicAccessBlock",
            "s3:GetBucketPolicy",
            "s3:PutBucketPolicy",
            "s3:GetBucketCORS",
            "s3:PutBucketCORS",
            "s3:PutObject"
        ]
    }

    denied = []
    if server_config:
        actions = required_policies['server']
    else:
        actions = required_policies['no_server']
    try:
        for result in iam.simulate_principal_policy(
            PolicySourceArn=root_user.arn,
            ActionNames=actions
        )['EvaluationResults']:
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

    console.rule(f"6 - IAM policy [cyan underline]crowd-workers-dev[/cyan underline]")
    status.start()
    status.update(f"Creating policy")
    time.sleep(3)

    crowd_workers_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "allowBucketInteraction",
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
                "Sid": "allowDatabaseInteraction",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:DescribeTable",
                    "dynamodb:DeleteItem",
                    "dynamodb:PutItem",
                    "dynamodb:GetItem",
                ],
                "Resource": f"arn:aws:dynamodb:{aws_region}:{aws_account_id}:table/users"
            }
        ]
    }

    policy = None
    try:
        policy = iam.create_policy(
            PolicyName='crowd-workers-dev',
            PolicyDocument=json.dumps(crowd_workers_policy)
        )
        console.print(
            f"[green]Policy creation completed[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
    except (iam.exceptions.EntityAlreadyExistsException) as exception:
        console.print(f"[yellow]Policy already present[/yellow]")
        policy = iam.get_policy(PolicyArn=f"arn:aws:iam::{aws_account_id}:policy/crowd-workers-dev")
        console.print(
            f"[green]Policy retrieved[/green], HTTP STATUS CODE: {policy['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"policy_{policy['Policy']['PolicyName']}.json", policy)

    console.print(f"Policy ARN: [cyan underline]{policy['Policy']['Arn']}[/cyan underline]")

    console.rule(f"7 - [cyan underline]worker-dev[/cyan underline] creation")
    status.start()
    status.update(f"Creating user")
    time.sleep(3)

    user = None
    try:
        user = iam.create_user(UserName="worker-dev")
        console.print(
            f"[green]user created[/green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    except iam.exceptions.EntityAlreadyExistsException as exception:
        console.print(f"[yellow]User already present[/yellow]")
        user = iam.get_user(UserName="worker-dev")
        console.print(
            f"[green]User retrieved[green], HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}_data.json", user)

    response = iam.attach_user_policy(UserName=user['User']['UserName'], PolicyArn=policy['Policy']['Arn'])
    policy = iam.get_policy(PolicyArn=f"{policy['Policy']['Arn']}")
    console.print(f"[green]Policy with ARN [cyan underline]{policy['Policy']['Arn']}[/cyan underline] attached to user, HTTP STATUS CODE: {user['ResponseMetadata']['HTTPStatusCode']}")

    keys = []
    paginator = iam.get_paginator('list_access_keys')
    for found_keys in paginator.paginate(UserName=user['User']['UserName']):
        for (index, key) in enumerate(found_keys['AccessKeyMetadata']):
            keyData = read_json(f"{folder_aws_generated_path}user_{user['User']['UserName']}_access_key_{key['AccessKeyId']}.json")
            if keyData:
                keys.append(keyData)
            else:
                response = iam.delete_access_key(UserName=user['User']['UserName'], AccessKeyId=key['AccessKeyId'])
                console.print(f"[red]Key {index} data not found on disk[/red]; deleting it on AWS, HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}")

    if len(keys) < 2:
        key = iam.create_access_key(UserName=user['User']['UserName'])
        serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json",
                       key)
        console.print(f"[green]Access key created[/green], HTTP STATUS CODE: {key['ResponseMetadata']['HTTPStatusCode']}.")
        keys.append(key)
        if not os.path.exists(
            f"{folder_aws_path}user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json"):
            serialize_json(folder_aws_generated_path, f"user_{user['User']['UserName']}_access_key_{key['AccessKey']['AccessKeyId']}.json", key)
            console.print(f"[green]Access key created[/green], HTTP STATUS CODE: {key['ResponseMetadata']['HTTPStatusCode']}.")

    key_selected = random.choice(keys)
    key_data = read_json(f"{folder_aws_generated_path}user_{user['User']['UserName']}_access_key_{key_selected['AccessKey']['AccessKeyId']}.json")

    console.print("Key data found on disk and loaded")

    aws_worker_access_id = key_data['AccessKey']['AccessKeyId']
    aws_worker_access_secret = key_data['AccessKey']['SecretAccessKey']

    console.rule(f"8 - bucket [cyan underline]{aws_private_bucket}[/cyan underline] creation")
    status.start()
    status.update(f"Creating bucket")
    time.sleep(3)

    s3_client = botoSession.client('s3')
    s3_resource = botoSession.resource('s3')

    buckets = []
    for bucket in s3_resource.buckets.all():
        buckets.append(bucket.name)

    try:
        if aws_region == 'us-east-1':
            private_bucket = s3_client.create_bucket(
                Bucket=aws_private_bucket
            )
        else:
            private_bucket = s3_client.create_bucket(
                Bucket=aws_private_bucket,
                CreateBucketConfiguration={
                    'LocationConstraint': aws_region
                }
            )
        console.print(
            f"[green]Bucket creation completed[/green], HTTP STATUS CODE: {private_bucket['ResponseMetadata']['HTTPStatusCode']}.")
    except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
        private_bucket = s3_resource.Bucket(aws_private_bucket)
        console.print(
            f"[yellow]Bucket already present[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}.json", private_bucket)

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
        "Id": "private-bucket-policy",
        "Statement": [
            {
                "Sid": "allow-bucket-interaction",
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::{aws_account_id}:user/{user['User']['UserName']}",
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
        console.print(
            f"[yellow]Policy already present[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchBucketPolicy':
            response = s3_client.put_bucket_policy(Bucket=aws_private_bucket, Policy=json.dumps(private_bucket_policy))
            console.print(
                f"[green]Policy configuration completed[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
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
        console.print(
            f"[yellow]CORS Configuration already present[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchCORSConfiguration':
            response = s3_client.put_bucket_cors(Bucket=aws_private_bucket, CORSConfiguration=cors_configuration)
            console.print(
                f"[green]CORS configuration completed[green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    cors_configuration = s3_client.get_bucket_cors(Bucket=aws_private_bucket)
    serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}_cors.json", cors_configuration)

    console.rule(f"9 - bucket [cyan underline]{aws_deploy_bucket}[/cyan underline] creation")
    status.start()
    status.update(f"Creating bucket")
    time.sleep(3)

    try:
        if aws_region == 'us-east-1':
            deploy_bucket = s3_client.create_bucket(
                Bucket=aws_deploy_bucket
            )
        else:
            deploy_bucket = s3_client.create_bucket(
                Bucket=aws_deploy_bucket,
                CreateBucketConfiguration={
                    'LocationConstraint': aws_region
                }
            )
        console.print(
            f"[green]Bucket creation completed[/green], HTTP STATUS CODE: {deploy_bucket['ResponseMetadata']['HTTPStatusCode']}.")
    except s3_client.exceptions.BucketAlreadyOwnedByYou as error:
        deploy_bucket = s3_resource.Bucket(aws_deploy_bucket)
        console.print(
            f"[yellow]Bucket already present[/yellow], HTTP STATUS CODE: {error.response['ResponseMetadata']['HTTPStatusCode']}.")
    serialize_json(folder_aws_generated_path, f"bucket_{aws_deploy_bucket}.json", deploy_bucket)

    deploy_bucket_policy = {
        "Version": "2012-10-17",
        "Id": "deploy-bucket-policy",
        "Statement": [
            {
                "Sid": "allow-bucket-interaction",
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::{aws_account_id}:user/{user['User']['UserName']}"
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
                "Sid": "allow-bucket-administration",
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
        console.print(
            f"[yellow]Policy already present[/yellow], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchBucketPolicy':
            response = s3_client.put_bucket_policy(Bucket=aws_deploy_bucket, Policy=json.dumps(deploy_bucket_policy))
            console.print(
                f"[green]Policy configuration completed[/green], HTTP STATUS CODE: {response['ResponseMetadata']['HTTPStatusCode']}.")
        policy = s3_client.get_bucket_policy(Bucket=aws_deploy_bucket)
        policy['Policy'] = json.loads(policy['Policy'])
    serialize_json(folder_aws_generated_path, f"bucket_{aws_private_bucket}_policy.json", policy)

    if server_config:
        console.rule(f"10 - Logging Server Setup")
        status.start()
        status.update(f"Policies setup...")
        time.sleep(3)
        path = '/crowdFrame/'

        policies = []
        roles = []

        policyList = [file for file in os.listdir(f"{folder_aws_path}policy") if 'To' in file]
        for file in track(policyList, description="Setting up policies and roles..."):
            name = file.split('.')[0]
            with open(f"{folder_aws_path}policy/{file}") as f:
                policyDocument = json.dumps(json.load(f))
            try:
                iam.create_policy(
                    PolicyName=name,
                    PolicyDocument=policyDocument,
                    Path=path,
                    Description='Policy for Crowd Frame log system'
                )
            except iam.exceptions.EntityAlreadyExistsException:
                policies.append(name)

            with open(f"{folder_aws_path}policy/{name.split('To')[0]}.json") as f:
                policyDocument = json.dumps(json.load(f))
            try:
                iam.create_role(
                    RoleName=name,
                    AssumeRolePolicyDocument=policyDocument,
                    Path=path,
                    Description='Role for Crowd_Frame log system'
                )
            except iam.exceptions.EntityAlreadyExistsException:
                roles.append(name)

            iam.attach_role_policy(
                RoleName=name,
                PolicyArn=f"arn:aws:iam::{aws_account_id}:policy{path}{name}"
            )
        status.stop()
        if policies:
            console.print(f"The following policies were already created {policies}")
        if roles:
            console.print(f"The following roles were already created {roles}")
        if not policies and roles:
            console.print("Policies created")

        status.start()
        status.update('Queue service setup...')
        time.sleep(2)
        sqs = botoSession.client('sqs')
        queue = {}
        if 'QueueUrls' not in sqs.list_queues(QueueNamePrefix="crowdFrameQueue"):
            with open(f"{folder_aws_path}policy/sqsPolicy.json") as f:
                policyDocument = json.dumps(json.load(f))
            queue['url'] = sqs.create_queue(
                QueueName='crowdFrameQueue',
                Attributes={
                    'Policy': policyDocument
                }
            )['QueueUrl']
            queue['arn'] = sqs.get_queue_attributes(
                QueueUrl=queue['url'],
                AttributeNames=['QueueArn']
            )['Attributes']['QueueArn']
            status.stop()
            console.print("Queue created")
        else:
            queue['url'] = sqs.list_queues(QueueNamePrefix="crowdFrameQueue")['QueueUrls'][0]
            queue['arn'] = sqs.get_queue_attributes(
                QueueUrl=queue['url'],
                AttributeNames=['QueueArn']
            )['Attributes']['QueueArn']
            status.stop()
            console.print("Queue already exists")

        status.start()
        status.update('Gateway setup...')
        time.sleep(2)
        apiGateway = botoSession.client('apigatewayv2')
        if not any(api for api in apiGateway.get_apis()['Items'] if api['Name'] == 'crowdFrameAPI'):
            response = apiGateway.create_api(
                CorsConfiguration={
                    'AllowCredentials': False,
                    'AllowHeaders': ['*'],
                    'AllowMethods': ['POST'],
                    'AllowOrigins': ['*'],
                    'ExposeHeaders': ['*'],
                    'MaxAge': 300
                },
                Name='crowdFrameAPI',
                ProtocolType='HTTP'
            )
            api = dict((key, response[key]) for key in ['ApiEndpoint', 'ApiId'])
            api['integration'] = apiGateway.create_integration(
                ApiId=api['ApiId'],
                IntegrationType='AWS_PROXY',
                IntegrationSubtype='SQS-SendMessage',
                PayloadFormatVersion='1.0',
                CredentialsArn=f'arn:aws:iam::{aws_account_id}:role{path}gatewayToSQS',
                RequestParameters={
                    'QueueUrl': queue['url'],
                    'MessageBody': '$request.body'
                }
            )['IntegrationId']
            apiGateway.create_route(
                ApiId=api['ApiId'],
                RouteKey='POST /log',
                Target='integrations/' + api['integration']
            )
            status.stop()
            console.print(f'[link={api["ApiEndpoint"]}/log]API endpoint[/link] created.')
        else:
            api = [api for api in apiGateway.get_apis()['Items'] if api['Name'] == 'crowdFrameAPI'][0]
            api = dict((key, api[key]) for key in ['ApiEndpoint', 'ApiId'])
            status.stop()
            console.print(f'[link={api["ApiEndpoint"]}/log]API endpoint[/link] generated previously.')

        status.start()
        status.update('DynamoDB setup...')
        time.sleep(2)
        dynamo = botoSession.client('dynamodb')
        try:
            dynamo.create_table(
                TableName=f"{task_name}_{batch_name}",
                AttributeDefinitions=[{'AttributeName': 'sequence', 'AttributeType': 'N'},
                                      {'AttributeName': 'worker', 'AttributeType': 'S'}],
                KeySchema=[{'AttributeName': 'worker', 'KeyType': 'HASH'},
                           {'AttributeName': 'sequence', 'KeyType': 'RANGE'}],
                BillingMode='PAY_PER_REQUEST'
            )
            status.stop()
            console.print(f"Table '{task_name}_{batch_name}' created")
        except dynamo.exceptions.ResourceInUseException:
            status.stop()
            console.print(f"Table '{task_name}_{batch_name}' already created")

        status.start()
        status.update('Lambda setup...')
        time.sleep(2)
        lambdaClient = botoSession.client('lambda')
        try:
            lambdaClient.create_function(
                FunctionName='crowdLoggerLambda',
                Runtime='nodejs14.x',
                Handler='index.handler',
                Role=f'arn:aws:iam::{aws_account_id}:role{path}lambdaToDynamoS3',
                Code={
                    'ZipFile': open(f"{folder_aws_path}index.zip", 'rb').read()
                },
                Timeout=10,
                PackageType='Zip'
            )
            lambdaClient.create_event_source_mapping(
                EventSourceArn=queue['arn'],
                FunctionName='crowdLoggerLambda',
                Enabled=True,
                BatchSize=1000,
                MaximumBatchingWindowInSeconds=30
            )
            status.stop()
            console.print('Function created')
        except lambdaClient.exceptions.ResourceConflictException:
            status.stop()
            console.print("Function 'crowdLoggerLambda' already created")

    console.rule(f"10 - Environment: [cyan underline]PRODUCTION[/cyan underline] creation")
    status.start()
    status.update(f"Creating environment")
    time.sleep(3)

    environment_development = f"{folder_build_env_path}environment.ts"
    environment_production = f"{folder_build_env_path}environment.prod.ts"

    environment_dict = {
        "production": 'true',
        "configuration_local": 'false',
        "taskName": task_name,
        "batchName": batch_name,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "bing_api_key": bing_api_key
    }

    os.makedirs(folder_build_env_path, exist_ok=True)

    with open(environment_production, 'w') as file:
        print("export const environment = {", file=file)
        for (env_var, value) in environment_dict.items():
            if env_var == 'production' or env_var == 'configuration_local':
                print(f"\t{env_var}: {value},", file=file)
            else:
                print(f"\t{env_var}: \"{value}\",", file=file)
        print("};", file=file)

    console.print("File [cyan underline]environment.prod.ts[/cyan underline] generated")
    console.print(f"Path: [italic]{environment_production}[/italic]")

    console.rule(f"11 -Environment: [cyan underline]DEVELOPMENT[/cyan underline] creation")
    status.start()
    status.update(f"Creating environment")
    time.sleep(3)

    environment_dict = {
        "production": 'false',
        "configuration_local": 'false',
        "taskName": task_name,
        "batchName": batch_name,
        "region": aws_region,
        "bucket": aws_private_bucket,
        "aws_id_key": aws_worker_access_id,
        "aws_secret_key": aws_worker_access_secret,
        "bing_api_key": bing_api_key
    }

    with open(environment_development, 'w') as file:
        print("export const environment = {", file=file)
        for (env_var, value) in environment_dict.items():
            if env_var == 'production' or env_var == 'configuration_local':
                print(f"\t{env_var}: {value},", file=file)
            else:
                print(f"\t{env_var}: \"{value}\",", file=file)
        print("};", file=file)

    console.print("File [cyan underline]environment.ts[/cyan underline] generated")
    console.print(f"Path: [italic]{environment_development}[/italic]")

    console.rule(f"12 - Admin Credentials Creation")
    status.start()
    status.update(f"Creating file [cyan underline]admin.json")
    time.sleep(3)

    if not os.path.exists(folder_build_config_path):
        os.makedirs(folder_build_config_path, exist_ok=True)

    admin_file = f"{folder_build_config_path}admin.json"

    console.print("Creating hash with [cyan underline]hmac[/cyan underline] and [cyan underline]sha256[/cyan underline]")
    console.print(f"Processing user with username: [white on purple]{admin_user}[white on purple]")

    admins = []
    body = f"username:{admin_user}"
    digest_maker = hmac.new(admin_password.encode(), body.encode(), hashlib.sha256)
    admins.append(digest_maker.hexdigest())
    with open(admin_file, 'w') as file:
        json.dump(admins, file, indent=4)

    console.print(f"Path: [italic]{admin_file}")

    console.rule(f"13 - Sample Task Configuration")
    status.start()
    status.update(f"Generating a sample configuration if needed")
    time.sleep(3)

    filename = "hits.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
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
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_questionnaires = [
                {
                    "type": "standard",
                    "position": "start",
                    "questions": [
                        {
                            "name": "age",
                            "text": "What is your age range?",
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
                    "position": "start",
                    "questions": [
                        {
                            "name": "farmers",
                            "text": "If three farmers can plant three trees in three hours, how long would it take nine farmers to plant nine trees?"
                        }
                    ]
                },
            ]
            print(json.dumps(sample_questionnaires, indent=4), file=file)

    filename = "dimensions.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_dimensions = [{
                "name": "sample-dimension",
                "name_pretty": "Sample Dimension",
                "description": "Lorem ipsum dolor sit amet",
                "url": False,
                "justification": False,
                "scale": {
                    "type": "categorical",
                    "mapping": [
                        {
                            "label": "False",
                            "description": "...",
                            "value": "1"
                        },
                        {
                            "label": "True",
                            "description": "...",
                            "value": "1"
                        }
                    ]
                },
                "gold_question_check": False,
                "style": False
            }]
            print(json.dumps(sample_dimensions, indent=4), file=file)

    filename = "instructions_main.json"
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

    filename = "instructions_dimensions.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
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
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
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
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_settings = {
                "task_name": f"{task_name}",
                "batch_name": f"{batch_name}",
                "allowed_tries": 10,
                "time_check_amount": 3,
                "annotator": False,
                "countdown_time": False,
                "blacklist_batches": [],
                "whitelist_batches": [],
                "messages": ["You have already started this task without finishing it"]
            }
            print(json.dumps(sample_settings, indent=4), file=file)

    filename = "workers.json"
    if os.path.exists(f"{folder_build_task_path}{filename}"):
        console.print(f"Config. file [italic white on green]{filename}[/italic white on green] detected, skipping generation")
    else:
        console.print(
            f"Config. file [italic white on yellow]{filename}[/italic white on yellow] not detected, generating a sample")
        with open(f"{folder_build_task_path}{filename}", 'w') as file:
            sample_worker_checks = {
                "blacklist": [],
                "whitelist": []
            }
            print(json.dumps(sample_worker_checks, indent=4), file=file)

    console.print(f"Path: [italic white on black]{folder_build_task_path}[/italic white on black]")

    console.rule(f"14 - Interface [cyan underline]document.ts")

    hits_file = f"{folder_build_task_path}hits.json"
    document_interface = f"{folder_build_skeleton_path}document.ts"
    if not os.path.exists(folder_build_skeleton_path):
        os.makedirs(folder_build_skeleton_path, exist_ok=True)

    console.print(f"Reading hits file")
    console.print(f"Path: [italic]{hits_file}[/italic]")
    hits = read_json(hits_file)
    sample_element = hits.pop()['documents'].pop()

    if not 'id' in sample_element.keys():
        raise Exception(
            "[red]Your [underline]hits.json[/underline] file contains an attributed called [underline]\"id\"[/underline]?")

    # This class provides a representation of a single document stored in single hit stored in the Amazon S3 bucket.
    # The attribute <document_index> is additional and should not be touched and passed in the constructor.
    # Each field of such Document must be mapped to an attribute of this class and set up in the constructor as it is shown.

    with open(document_interface, 'w') as file:
        print("export class Document {", file=file)
        print("", file=file)
        wrapper = textwrap.TextWrapper(initial_indent='\t\t', subsequent_indent='\t\t')
        print(wrapper.fill("index: number;"), file=file)
        print(wrapper.fill("countdownExpired: boolean;"), file=file)
        for attribute, value in sample_element.items():
            try:
                element = json.loads(value)
                if isinstance(element, dict):
                    print(wrapper.fill(f"{attribute}: Array<JSON>;"), file=file)
                elif isinstance(element, int) or isinstance(element, float):
                    if (attribute == "id"):
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
                    print(wrapper.fill(
                        f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"][index])"),
                        file=file)
                elif isinstance(element, list):
                    print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                    print(wrapper.fill(
                        f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"])"),
                        file=file)
                else:
                    wrapper = textwrap.TextWrapper(initial_indent='\t\t\t', subsequent_indent='\t\t\t')
                    print(wrapper.fill(f"this.{attribute} = data[\"{attribute}\"]"), file=file)
            except (TypeError, ValueError) as e:
                if isinstance(value, list):
                    print(wrapper.fill(f"this.{attribute} = new Array<String>()"), file=file)
                    print(wrapper.fill(
                        f"for (let index = 0; index < data[\"{attribute}\"].length; index++) this.{attribute}.push(data[\"{attribute}\"])"),
                        file=file)
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

    console.rule(f"15 - Amazon Mechanical Turk Landing Page")
    status.start()
    status.update(f"Istantiating Mako model")
    time.sleep(3)

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
    token_df = pd.DataFrame(columns=["token_input", "token_output"])
    for hit in hits:
        token_df = token_df.append({
            "token_input": hit['token_input'],
            "token_output": hit['token_output']
        }, ignore_index=True)
    token_df.to_csv(mturk_tokens_file, index=False)
    console.print(f"Tokens for {len(hits)} hits generated")
    console.print(f"Path: [italic]{mturk_tokens_file}")

    console.rule(f"16 - Task [cyan underline]{task_name}[/cyan underline]/[yellow underline]{batch_name}[/yellow underline] build")
    status.update(f"Executing build command, please wait")
    time.sleep(3)

    folder_build_result = f"../dist/"

    command = "ng build --configuration=\"production\" --output-hashing=none"
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

    console.rule(f"17 - Packaging Task [cyan underline]tasks/{task_name}/{batch_name}")
    status.start()
    status.update(f"Starting")
    time.sleep(3)

    folder_tasks_batch_path = f"{folder_tasks_path}{task_name}/{batch_name}/"
    folder_tasks_batch_deploy_path = f"{folder_tasks_batch_path}deploy/"
    folder_tasks_batch_mturk_path = f"{folder_tasks_batch_path}mturk/"
    folder_tasks_batch_task_path = f"{folder_tasks_batch_path}task/"
    folder_tasks_batch_config_path = f"{folder_tasks_batch_path}config/"

    console.print(f"[italic purple]deploy-config[/italic purple] variable: {bool(deploy_config)}")

    if not os.path.exists(folder_tasks_batch_deploy_path):
        console.print("[green]Deploy folder created")
        os.makedirs(folder_tasks_batch_deploy_path, exist_ok=True)
    else:
        console.print("[yellow]Deploy folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_deploy_path}")
    if not os.path.exists(folder_tasks_batch_mturk_path):
        console.print("[green]Amazon Mechanical Turk assets folder created")
        os.makedirs(folder_tasks_batch_mturk_path, exist_ok=True)
    else:
        console.print("[yellow]Amazon Mechanical Turk assets folder already present")
    console.print(f"Path: [italic]{folder_tasks_batch_mturk_path}")
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


    def copy(source, destination, title):
        panel = Panel(
            f"Source: [italic white on black]{source}[/italic white on black]\nDestination: [italic white on black]{destination}[/italic white on black]",
            title=title)
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

        source = f"{folder_build_task_path}instructions_dimensions.json"
        destination = f"{folder_tasks_batch_task_path}instructions_dimensions.json"
        copy(source, destination, "Assessment Instructions")

        source = f"{folder_build_task_path}instructions_main.json"
        destination = f"{folder_tasks_batch_task_path}instructions_main.json"
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

    console.print(f"Copying files for [blue underline on white]{folder_tasks_batch_config_path}[/blue underline on white] folder")

    source = f"{folder_build_config_path}admin.json"
    destination = f"{folder_tasks_batch_config_path}admin.json"
    copy(source, destination, "Admin Credentials")

    console.rule(f"18 - Task [cyan underline]tasks/{task_name}/{batch_name} Deploy")
    status.start()
    status.update(f"Starting")
    time.sleep(3)

    s3_private_generator_path = f"{task_name}/{batch_name}/Generator/"
    s3_private_task_path = f"{task_name}/{batch_name}/Task/"
    s3_deploy_path = f"{task_name}/{batch_name}/"

    folder_tasks_batch_deploy_path = f"{folder_tasks_batch_path}deploy/"
    folder_tasks_batch_mturk_path = f"{folder_tasks_batch_path}mturk/"
    folder_tasks_batch_task_path = f"{folder_tasks_batch_path}task/"
    folder_tasks_batch_config_path = f"{folder_tasks_batch_path}config/"

    s3_client = botoSession.client('s3')


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

    path = f"{folder_tasks_batch_config_path}admin.json"
    key = f"{s3_private_generator_path}admin.json"
    upload(path, aws_private_bucket, key, "Admin Credentials", "application/json")

    if bool(deploy_config):
        console.print(f"[white on green bold]Task configuration")

        path = f"{folder_tasks_batch_task_path}hits.json"
        key = f"{s3_private_task_path}hits.json"
        upload(path, aws_private_bucket, key, "Hits", "application/json")

        path = f"{folder_tasks_batch_task_path}instructions_dimensions.json"
        key = f"{s3_private_task_path}instructions_dimensions.json"
        upload(path, aws_private_bucket, key, "Assessment Instructions", "application/json")

        path = f"{folder_tasks_batch_task_path}instructions_main.json"
        key = f"{s3_private_task_path}instructions_main.json"
        upload(path, aws_private_bucket, key, "General Instructions", "application/json")

        path = f"{folder_tasks_batch_task_path}questionnaires.json"
        key = f"{s3_private_task_path}questionnaires.json"
        upload(path, aws_private_bucket, key, "Questionnaires", "application/json")

        path = f"{folder_tasks_batch_task_path}dimensions.json"
        key = f"{s3_private_task_path}dimensions.json"
        upload(path, aws_private_bucket, key, "Dimensions", "application/json")

        path = f"{folder_tasks_batch_task_path}search_engine.json"
        key = f"{s3_private_task_path}search_engine.json"
        upload(path, aws_private_bucket, key, "Search Engine", "application/json")

        path = f"{folder_tasks_batch_task_path}task.json"
        key = f"{s3_private_task_path}task.json"
        upload(path, aws_private_bucket, key, "Task Settings", "application/json")

        path = f"{folder_tasks_batch_task_path}workers.json"
        key = f"{s3_private_task_path}workers.json"
        upload(path, aws_private_bucket, key, "Workers Settings", "application/json")

    console.print(f"[white on purple bold]Angular Application")

    path = f"{folder_tasks_batch_deploy_path}scripts.js"
    key = f"{s3_deploy_path}scripts.js"
    upload(path, aws_deploy_bucket, key, "Javascript Assets", "text/javascript", "public-read")

    path = f"{folder_tasks_batch_deploy_path}styles.css"
    key = f"{s3_deploy_path}styles.css"
    upload(path, aws_deploy_bucket, key, "CSS Styles", "text/css", "public-read")

    path = f"{folder_tasks_batch_deploy_path}index.html"
    key = f"{s3_deploy_path}index.html"
    upload(path, aws_deploy_bucket, key, "Task Homepage", "text/html", "public-read")

    console.rule(f"19 - Public Link")
    status.start()
    status.update(f"Writing")
    time.sleep(3)

    console.print(f"[bold white on black]https://{aws_deploy_bucket}.s3.{aws_region}.amazonaws.com/{task_name}/{batch_name}/index.html")
