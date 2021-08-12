#!/usr/bin/env python
# coding: utf-8
import json
import os
import random
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
from rich.console import Console
from rich.panel import Panel
from rich.progress import track

console = Console()

folder_result_path = "result/"

env_path = Path('.') / '.env'

botoSession = boto3.Session()

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

mturk = botoSession.client('mturk')

print(mturk.list_hits())
