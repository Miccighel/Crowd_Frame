import json
import os
import time
import boto3
from pathlib import Path
from rich.console import Console

home = str(Path.home())
console = Console()
botoSession = boto3.Session()
iamClient = botoSession.client('iam')
path = '/crowdFrame/config/'
userName = 'config_user'

def keyCont():
    console.input('[green]Press enter to continue...\n\n')

with console.status("Generating policy", spinner="aesthetic") as status:
    time.sleep(3)
    with open('user_policy.json', 'r') as f:
        document = json.dumps(json.load(f))
        try:
            policy = iamClient.create_policy(
              PolicyName='configPolicy',
              PolicyDocument=document,
              Path=path
            )['Policy']
        except iamClient.exceptions.EntityAlreadyExistsException:
            policies = iamClient.list_policies(
              PathPrefix=path
            )['Policies']
            for result in policies:
                if result['PolicyName'] == 'configPolicy':
                    policy = result
                    break
    console.print(policy)
    status.stop()
    keyCont()
    status.start()
    status.update("Generating user and attaching policy")
    time.sleep(3)
    try:
        user = iamClient.create_user(
          UserName=userName,
          Path=path
        )['User']
        iamClient.attach_user_policy(
          UserName=userName,
          PolicyArn=policy['Arn']
        )
    except iamClient.exceptions.EntityAlreadyExistsException:
        user = iamClient.get_user(
          UserName=userName
        )['User']
    console.print(user)
    status.stop()
    keyCont()
    status.start()
    status.update("Checking and updating configuration file")
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
                    if keyLine.find('aws_access_key_id = ') != -1 and secretLine.find('aws_secret_access_key = '):
                        key = keyLine.split(' ')[2]
                    else:
                        key = ''
                    break
        if not exists:
            credentials = iamClient.create_access_key(
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
            availableKeys = iamClient.list_access_keys(
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
    status.stop()
    keyCont()
