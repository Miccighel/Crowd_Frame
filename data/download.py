#!/usr/bin/env python
# coding: utf-8

# Standard library imports
import asyncio
import csv
import json
import os
import pprint
import re
import shutil
import sys
import uuid
import warnings
import xml.etree.ElementTree as Xml
from datetime import datetime
from distutils.util import strtobool
from glob import glob
from pathlib import Path
from time import time as time_mod

# Third-party imports
import aiohttp
import boto3
import chardet
import ipinfo
import numpy as np
import pandas as pd
import pycountry
import requests
from tqdm import tqdm
from aiohttp import (
    ClientConnectorError,
    ClientOSError,
    ClientPayloadError,
    ClientResponseError,
    ServerDisconnectedError,
    TooManyRedirects,
)
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from pytz import timezone
from rich.columns import Columns
from rich.console import Console
import toloka.client as toloka

# Local application imports
from data.shared import (
    camel_to_snake,
    find_date_string,
    flatten,
    merge_dicts,
    move_dict_key,
    read_json,
    remove_json,
    rename_dict_key,
    sanitize_string,
)

pd.set_option('display.max_columns', None)

warnings.simplefilter(action='ignore', category=FutureWarning)
pd.options.mode.chained_assignment = None
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
ip_api_api_key = os.getenv('ipapi_api_key')
user_stack_token = os.getenv('user_stack_token')

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
df_prolific_study_data_path = f"{models_path}workers_prolific_study_data.csv"
df_prolific_demographic_data_path = f"{models_path}workers_prolific_demographic_data.csv"
df_acl_path = f"{models_path}workers_acl.csv"
df_ip_path = f"{models_path}workers_ip_addresses.csv"
df_uag_path = f"{models_path}workers_user_agents.csv"
df_docs_path = f"{models_path}workers_documents.csv"
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
if enable_crawling:
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

dynamo_db_tables = []

response = dynamo_db.list_tables()
# DynamoDB client returns a paginated list of tables when they are more than 100
while 'LastEvaluatedTableName' in response.keys():
    for dynamo_db_table in response['TableNames']:
        dynamo_db_tables.append(dynamo_db_table)
    response = dynamo_db.list_tables(ExclusiveStartTableName=dynamo_db_tables[-1])
for dynamo_db_table in response['TableNames']:
    dynamo_db_tables.append(dynamo_db_table)

task_data_tables = []
task_log_tables = []
task_acl_tables = []
task_batch_names = []

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
console.print(f"Tables ACL: [cyan]{', '.join(task_acl_tables)}")
if len(task_log_tables) > 0:
    console.print(f"Tables log: [cyan]{', '.join(task_log_tables)}")

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


def fetch_uag_data(worker_id, worker_uag, properties_fetched=None):
    data = {}
    properties_moved = []
    uag_file = f"{resources_path}{worker_id}_uag.json"
    if os.path.exists(uag_file):
        data = read_json(uag_file)
    if worker_uag is not None:
        if worker_uag not in data:
            try:
                ua_data = []
                if user_stack_token:
                    url = f"http://api.userstack.com/detect?access_key={user_stack_token}&ua={worker_uag}"
                    response = requests.get(url)
                    data_fetched = flatten(response.json())
                    if 'success' in data_fetched.keys():
                        if not data_fetched['success']:
                            raise ValueError(f"Request to Userstack UAG detection service failed with error code {data_fetched['error_code']}. Remove of replace your `user_stack_token`")
                    rename_dict_key(data_fetched, 'ua_type', 'type')
                    rename_dict_key(data_fetched, 'ua_url', 'url')
                    rename_dict_key(data_fetched, 'device_is_crawler', 'crawler_is_crawler')
                    data_fetched.pop('brand')
                    data_fetched.pop('name')
                    ua_data.append(data_fetched)
                if ip_geolocation_api_key:
                    url = f"https://api.ipgeolocation.io/user-agent?apiKey={ip_geolocation_api_key}"
                    response = requests.get(url, headers={'User-Agent': worker_uag})
                    if response.status_code != 200:
                        raise ValueError(
                            f"Request to IP Geolocation UAG detection service (user-agent endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
                    else:
                        data_fetched = flatten(requests.get(url, headers={'User-Agent': worker_uag}).json())
                    ua_data.append(data_fetched)
                if properties_fetched is not None:
                    ua_cf_data = {}
                    ua_nav_data = {}
                    ua_ngx_data = {}
                    properties_moved.append(move_dict_key(properties_fetched, ua_cf_data, 'cf_uag', 'ua'))
                    ua_data.append(ua_cf_data)
                    # Reference: https://koderlabs.github.io/ngx-device-detector/index.html
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_os', 'os_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_device_type', 'device_type'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_orientation', 'device_orientation'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_os_version', 'os_version'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_os_name', 'os_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_user_agent', 'ua'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_browser', 'browser_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_browser_version', 'browser_version'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_device', 'device_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_ngx_data, 'ngx_user_agent', 'ua'))
                    ua_data.append(ua_ngx_data)
                    # Reference: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_downlink', 'connection_downlink'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_downlink_max', 'connection_downlink_max'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_effective_type', 'connection_effective_type'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_onchange', 'connection_on_change'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_ontypechange', 'connection_on_type_change'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_rtt', 'connection_rtt'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_save_data', 'connection_save_data'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_connection_type', 'connection_type'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_device_memory', 'device_memory'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_max_touch_points', 'device_max_touch_points'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_hardware_concurrency', 'device_hardware_concurrency'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_window_controls_overlay_visible', 'os_window_controls_overlay_visible'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_window_controls_overlay_ongeometrychange', 'os_window_controls_on_geometry_change'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_pdf_viewer_enabled', 'browser_pdf_viewer_enabled'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_product', 'browser_product'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_product_sub', 'browser_product_sub'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_vendor', 'browser_vendor'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_vendor_sub', 'browser_vendor_sub'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_oscpu', 'os_name_alternative'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_build_i_d', 'browser_build_identifier'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_do_not_track', 'browser_do_not_track'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_webdriver', 'ua_webdriver'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_app_code_name', 'browser_app_code_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_app_name', 'browser_app_name'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_app_version', 'browser_app_version'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_language', 'device_language_code'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_platform', 'browser_platform'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_cookie_enabled', 'browser_cookie_enabled'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_on_line', 'browser_on_line'))
                    properties_moved.append(move_dict_key(properties_fetched, ua_nav_data, 'nav_user_agent', 'ua'))
                    ua_data.append(ua_nav_data)
                ua_data = merge_dicts(ua_data)
                ua_data = {camel_to_snake(key): ua_data[key] for key in ua_data}
                data[worker_uag] = {}
                for attribute, value in ua_data.items():
                    if type(value) == dict:
                        for attribute_sub, value_sub in value.items():
                            data[worker_uag][f"{attribute}_{attribute_sub}"] = value_sub
                    else:
                        data[worker_uag][attribute] = value
                data[worker_uag] = dict(sorted(data[worker_uag].items()))
                with open(uag_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
            except ValueError as error:
                console.print(f"[red]{error}")
                sys.exit(1)
    return data, properties_moved


def fetch_ip_data(worker_id, worker_ip, properties_fetched=None):
    data = {}
    properties_moved = []
    ip_file = f"{resources_path}{worker_id}_ip.json"
    if os.path.exists(ip_file):
        data = read_json(ip_file)
    if worker_ip is not None:
        if worker_ip not in data:
            try:
                ip_data = []
                if ip_info_token:
                    ip_info_handler = ipinfo.getHandler(ip_info_token)
                    data_fetched = flatten(ip_info_handler.getDetails(worker_ip).all)
                    rename_dict_key(data_fetched, 'location_name', 'city')
                    rename_dict_key(data_fetched, 'country_currency_code_iso3', 'country_currency_code')
                    rename_dict_key(data_fetched, 'country_code_iso2', 'country')
                    rename_dict_key(data_fetched, 'country_flag_emoji_unicode', 'country_flag_unicode')
                    rename_dict_key(data_fetched, 'country_is_eu', 'isEU')
                    rename_dict_key(data_fetched, 'location_coordinates', 'loc')
                    rename_dict_key(data_fetched, 'location_postal_code', 'postal')
                    rename_dict_key(data_fetched, 'provider_name', 'org')
                    rename_dict_key(data_fetched, 'region_name', 'region')
                    rename_dict_key(data_fetched, 'provider_name', 'org')
                    rename_dict_key(data_fetched, 'timezone_name', 'timezone')
                    ip_data.append(data_fetched)
                if ip_geolocation_api_key:
                    url = f"https://api.ipgeolocation.io/ipgeo?apiKey={ip_geolocation_api_key}&ip={worker_ip}&include=hostnameFallbackLive,security"
                    data_fixed = {}
                    response = requests.get(url)
                    if response.status_code == 423:
                        console.print(f"Bogon detected: {worker_ip}")
                    else:
                        if response.status_code != 200:
                            raise ValueError(
                                f"Request to IP Geolocation service (ipgeo endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
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
                            raise ValueError(
                                f"Request to IP Geolocation service (timezone endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
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
                            raise ValueError(
                                f"Request to IP Geolocation service (astronomy endpoint) failed with error code {response.status_code} and reason: `{response.text}`. Remove of replace your `ip_geolocation_api_key`")
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
                    rename_dict_key(data_fetched, 'country_code_iso2', 'country_code')
                    rename_dict_key(data_fetched, 'country_capital', 'location_capital')
                    rename_dict_key(data_fetched, 'ip_address_type', 'type')
                    rename_dict_key(data_fetched, 'location_name', 'city')
                    rename_dict_key(data_fetched, 'location_postal_code', 'zip')
                    rename_dict_key(data_fetched, 'country_flag', 'location_country_flag')
                    rename_dict_key(data_fetched, 'country_flag_url', 'country_flag')
                    rename_dict_key(data_fetched, 'country_flag_emoji', 'location_country_flag_emoji')
                    rename_dict_key(data_fetched, 'country_flag_emoji_unicode', 'location_country_flag_emoji_unicode')
                    if 'location_languages' in data_fetched:
                        location_languages = data_fetched.pop('location_languages')
                        data_fetched['location_languages'] = []
                        if location_languages is not None:
                            for index_lang, lang_data in enumerate(location_languages):
                                location_language = {}
                                location_language["location_language_index"] = index_lang
                                location_language["location_language_code_iso2"] = lang_data['code']
                                language_data = pycountry.languages.get(alpha_2=location_language["location_language_code_iso2"])
                                location_language[f"location_language_code_iso3"] = language_data.alpha_3
                                location_language[f"location_language_scope"] = language_data.scope
                                location_language[f"location_language_type"] = language_data.type
                                data_fetched['location_languages'].append(location_language)
                    ip_data.append(data_fetched)
                country_code = None
                for ip_data_partial in ip_data:
                    if 'country_code_iso2' in ip_data_partial:
                        country_code = ip_data_partial['country_code_iso2']
                if country_code is not None:
                    country_data = pycountry.countries.get(alpha_2=country_code)
                    data_fetched = {
                        'country_code_iso2': country_data.alpha_2,
                        'country_code_iso3': country_data.alpha_3,
                        'country_name': country_data.name,
                        'country_numeric': country_data.numeric,
                    }
                    try:
                        data_fetched['country_name_official'] = country_data.official_name
                    except AttributeError:
                        data_fetched['country_name_official'] = np.nan
                    ip_data.append(data_fetched)
                currency_code = None
                for ip_data_partial in ip_data:
                    if 'country_currency_code_iso3' in ip_data_partial:
                        currency_code = ip_data_partial['country_currency_code_iso3']
                if currency_code is not None:
                    currency_data = pycountry.currencies.get(alpha_3=currency_code)
                    if currency_data is not None:
                        data_fetched = {
                            'country_currency_name': currency_data.name,
                            'country_currency_numeric': currency_data.numeric,
                        }
                        ip_data.append(data_fetched)
                region_code = None
                for ip_data_partial in ip_data:
                    if 'region_code' in ip_data_partial:
                        region_code = ip_data_partial['region_code']
                if region_code is not None and country_code is not None:
                    region_data = pycountry.subdivisions.get(code=f"{country_code}-{region_code}")
                    if region_data is not None:
                        data_fetched = {
                            'region_code_full': region_data.code,
                            'region_code_parent': region_data.parent_code,
                            'region_type': region_data.type,
                            'region_name': region_data.name,
                        }
                        ip_data.append(data_fetched)
                if properties_fetched is not None:
                    ip_cf_data = {}
                    # Reference:
                    # fl = Cloudflare WebServer Instance
                    # h = WebServer Hostname
                    # ip = IP Address of client
                    # ts = Epoch Time in seconds.millis(Similar to `date + % s. % 3 N` in bash)
                    # visit_scheme = https or http
                    # uag = User Agent
                    # colo = IATA location identifier (https://en.wikipedia.org/wiki/IATA_airport_code)
                    # sliver = Whether the request is split
                    # http = HTTP Version
                    # loc = Country Code
                    # tls = TLS or SSL Version
                    # sni = Whether SNI encrypted or plaintext (https://en.wikipedia.org/wiki/Server_Name_Indication)
                    # warp = Whether client over Cloudflares Wireguard VPN
                    # gateway = Whether client over Cloudflare Gateway (https://www.cloudflare.com/products/zero-trust/gateway/)
                    # rbi = Whether client over Cloudflares Remote Browser Isolation (https://www.cloudflare.com/learning/access-management/what-is-browser-isolation/)
                    # kex = Key exchange method for TLS (https://en.wikipedia.org/wiki/Key_exchange)
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_ip', 'ip'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_fl', 'cloudflare_webserver_instance'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_ts', 'visit_timestamp_epoch'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_kex', 'tls_key_exchange_method'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_visit_scheme', 'visit_scheme'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_tls', 'tls_version'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_sni', 'tls_server_name_indication'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_http', 'http_version'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_loc', 'country_code_iso2'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_colo', 'location_identifier'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_h', 'cloudflare_webserver_hostname'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_sliver', 'client_request_split'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_gateway', 'client_over_cloudflare_gateway'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_warp', 'client_over_cloudflare_wireguard_vpn'))
                    properties_moved.append(move_dict_key(properties_fetched, ip_cf_data, 'cf_rbi', 'client_over_cloudflare_remote_browser_isolation'))

                    if 'visit_timestamp_epoch' in ip_cf_data:
                        ip_cf_data['visit_timestamp_parsed'] = find_date_string(datetime.fromtimestamp(float(ip_cf_data['visit_timestamp_epoch']), timezone('GMT')).strftime('%c'))
                    else:
                        ip_cf_data['visit_timestamp_parsed'] = None
                    ip_data.append(ip_cf_data)
                ip_data = merge_dicts(ip_data)
                ip_data = {camel_to_snake(key): ip_data[key] for key in ip_data}
                data[worker_ip] = {}
                for attribute, value in ip_data.items():
                    data[worker_ip][attribute] = value
                data[worker_ip] = dict(sorted(data[worker_ip].items()))
                with open(ip_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
            except ValueError as error:
                console.print(f"[red]{error}")
                sys.exit(1)
    return data, properties_moved


console.rule(f"{step_index} - Fetching Workers Snapshots")
step_index = step_index + 1

worker_identifiers = []
worker_ip_addresses = {}
worker_ip_batches = {}
worker_user_agents = {}
worker_user_agents_batches = {}
paginator = dynamo_db.get_paginator('scan')
for table_acl in task_acl_tables:
    for page in paginator.paginate(TableName=table_acl, Select='ALL_ATTRIBUTES'):
        for item in page['Items']:
            worker_id = item['identifier']['S']
            ip_address = item['ip_address']['S']
            batch_name = item['batch_name']['S']
            user_agent = item['user_agent']['S']
            time_arrival = item['time_arrival']['S']
            if worker_id not in worker_identifiers:
                worker_identifiers.append(worker_id)
            if worker_id not in worker_ip_addresses:
                worker_ip_addresses[worker_id] = {}
            if worker_id not in worker_ip_batches:
                worker_ip_batches[worker_id] = {}
            if ip_address not in worker_ip_addresses[worker_id]:
                worker_ip_addresses[worker_id][ip_address] = {
                    'fetched': False,
                    'batches': {
                        batch_name: {
                            'time_submit': time_arrival,
                            'time_submit_parsed': find_date_string(time_arrival)
                        }
                    }
                }
                worker_ip_batches[worker_id][ip_address] = [batch_name]
            else:
                worker_ip_addresses[worker_id][ip_address]['batches'][batch_name] = {}
                worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit'] = time_arrival
                worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit_parsed'] = find_date_string(time_arrival)
                worker_ip_batches[worker_id][ip_address].append(batch_name)
            if worker_id not in worker_user_agents:
                worker_user_agents[worker_id] = {}
            if worker_id not in worker_user_agents_batches:
                worker_user_agents_batches[worker_id] = {}
            if user_agent not in worker_user_agents[worker_id]:
                worker_user_agents[worker_id][user_agent] = {
                    'fetched': False,
                    'batches': {
                        batch_name: {
                            'time_submit': time_arrival,
                            'time_submit_parsed': find_date_string(time_arrival)
                        }
                    }
                }
                worker_user_agents_batches[worker_id][user_agent] = [batch_name]
            else:
                worker_user_agents[worker_id][user_agent]['batches'][batch_name] = {}
                worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit'] = time_arrival
                worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit_parsed'] = find_date_string(time_arrival)
                worker_user_agents_batches[worker_id][user_agent].append(batch_name)
console.print(f"Unique worker identifiers found: [green]{len(worker_identifiers)}")

worker_counter = 0
worker_snapshots_with_data_counter = 0
worker_snapshots_without_data_counter = 0
worker_properties_unhandled = []
with console.status(f"Workers Amount: {len(worker_identifiers)}", spinner="aesthetic") as status:
    status.start()

    for worker_id in tqdm(worker_identifiers):

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

                if len(worker_session) > 0:

                    table_base_name = "_".join(data_source.split("_")[:-1])

                    acl_data_source = None
                    for table_name in task_acl_tables:
                        if table_base_name in table_name:
                            acl_data_source = table_name
                    log_data_source = None
                    for table_name in task_log_tables:
                        if table_base_name in table_name:
                            log_data_source = table_name

                    task_key_found = False

                    data_sequences = {}
                    for element in worker_session:
                        sequence = element['sequence']['S'].split("-")
                        if len(sequence) > 4:
                            worker_id = sequence[0]
                            worker_ip = sequence[1]
                            unit_id = sequence[2]
                            sequence_key = f"{worker_id}-{worker_ip}-{unit_id}"
                            if sequence_key not in data_sequences:
                                data_sequences[sequence_key] = []
                        else:
                            worker_id = sequence[0]
                            unit_id = sequence[1]
                            sequence_key = f"{worker_id}-{unit_id}"
                            if sequence_key not in data_sequences:
                                data_sequences[sequence_key] = []
                        data_sequences[sequence_key].append(element)

                    for data_sequence_key, worker_session_across_tries in data_sequences.items():

                        snapshot = {
                            "sequence_key": data_sequence_key,
                            "source_path": worker_snapshot_path,
                            "source_data": data_source,
                            "source_acl": acl_data_source,
                            "source_log": log_data_source,
                            "data_items": len(worker_session_across_tries),
                            "task": {},
                            "worker": {
                                "identifier": worker_id
                            },
                            "ip": {
                                "info": {},
                                "serialization": {}
                            },
                            "uag": {
                                "info": {},
                                "serialization": {}
                            },
                            "checks": [],
                            "questionnaires_answers": [],
                            "documents_answers": [],
                            "comments": [],
                            "logs": [],
                            "questionnaires": {},
                            "documents": {},
                            "dimensions": {}
                        }

                        sequence_number = 0

                        for element in worker_session_across_tries:

                            sequence = element['sequence']['S'].split("-")
                            data = json.loads(element['data']['S'])
                            time = element['time']['S']

                            if len(sequence) > 4:
                                worker_id = sequence[0]
                                worker_ip = sequence[1]
                                unit_id = sequence[2]
                                current_try = sequence[3]
                                sequence_number_current = sequence[4]
                            else:
                                worker_id = sequence[0]
                                unit_id = sequence[1]
                                current_try = sequence[2]
                                sequence_number_current = sequence[3]

                            if data:
                                if data['info']['element'] == 'data':
                                    if len(data['task'].items()) > 0:
                                        task_key_found = True
                                    for attribute, value in data['task'].items():
                                        if attribute == 'task_id':
                                            snapshot['task']['task_name'] = value
                                        else:
                                            snapshot['task'][attribute] = value
                                    snapshot['task']['try_last'] = current_try
                                    snapshot['task']['time_submit'] = time
                                    snapshot['task']['time_submit_parsed'] = find_date_string(time)
                                    snapshot['task']['info'] = data['info']
                                    if 'settings' in snapshot['task']:
                                        settings = snapshot['task'].pop('settings')
                                        snapshot['task']['settings'] = settings
                                    snapshot['questionnaires'] = data.pop('questionnaires')
                                    snapshot['documents'] = data.pop('documents')
                                    snapshot['dimensions'] = data.pop('dimensions')
                                    snapshot['worker'] = data.pop('worker')
                                    if 'propertiesFetched' in snapshot['worker'].keys():
                                        snapshot['worker']['properties_fetched'] = snapshot['worker'].pop('propertiesFetched')
                                    if 'paramsFetched' in snapshot['worker'].keys():
                                        snapshot['worker']['params_fetched'] = snapshot['worker'].pop('paramsFetched')
                                    if 'previousIPAddresses' in snapshot['worker'].keys():
                                        snapshot['worker'].pop('previousIPAddresses')
                                    if 'identifiersProvided' in snapshot['worker'].keys():
                                        snapshot['worker'].pop('identifiersProvided')
                                    snapshot['worker'] = dict(sorted(snapshot['worker'].items()))
                                elif data['info']['element'] == 'document':
                                    snapshot['documents_answers'].append({
                                        "time_submit": time,
                                        "serialization": data
                                    })
                                elif data['info']['element'] == 'questionnaire':
                                    snapshot['questionnaires_answers'].append({
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

                            if int(sequence_number_current) > int(sequence_number):
                                if 'try_last' in snapshot['task'].keys():
                                    snapshot['task']['try_last'] = max(int(snapshot['task']['try_last']), int(current_try))
                                snapshot['task']['unit_id'] = unit_id
                                sequence_number = sequence_number_current

                        if not task_key_found:

                            paginator = dynamo_db.get_paginator('query')
                            for page in paginator.paginate(
                                TableName=acl_data_source,
                                KeyConditionExpression="identifier = :identifier",
                                ExpressionAttributeValues={
                                    ":identifier": {'S': worker_id}
                                }, Select='ALL_ATTRIBUTES'
                            ):

                                if len(page['Items']) > 0:
                                    task_key_found = True

                                for item in page['Items']:

                                    task_name = item['task_name']['S']
                                    batch_name = item['batch_name']['S']
                                    unit_id = item['unit_id']['S']
                                    ip_address = item['ip_address']['S']
                                    user_agent = item['user_agent']['S']
                                    time_arrival = item['time_arrival']['S']
                                    time_arrival_parsed = find_date_string(time_arrival)

                                    snapshot['task']['task_name'] = task_name
                                    snapshot['task']['batch_name'] = batch_name
                                    snapshot['task']['unit_id'] = unit_id
                                    snapshot['task']['try_last'] = current_try
                                    snapshot['task']['time_submit'] = time
                                    snapshot['task']['time_submit_parsed'] = find_date_string(time)

                                    if ip_address is not None:
                                        if ip_address not in worker_ip_addresses[worker_id]:
                                            worker_ip_addresses[worker_id][ip_address] = {}
                                            worker_ip_addresses[worker_id][ip_address]['fetched'] = False
                                            worker_ip_addresses[worker_id][ip_address]['batches'] = {batch_name: {}}
                                            worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit'] = time_arrival
                                            worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit_parsed'] = time_arrival_parsed
                                        else:
                                            worker_ip_addresses[worker_id][ip_address]['batches'][batch_name] = {}
                                            worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit'] = time_arrival
                                            worker_ip_addresses[worker_id][ip_address]['batches'][batch_name]['time_submit_parsed'] = time_arrival_parsed

                                        if ip_address in worker_ip_batches[worker_id]:
                                            worker_ip_batches[worker_id][ip_address].append(batch_name)
                                        else:
                                            worker_ip_batches[worker_id][ip_address] = [batch_name]
                                    for ip_address_current in worker_ip_addresses[worker_id]:
                                        if batch_name in worker_ip_batches[worker_id][ip_address_current]:
                                            ip_data, properties_moved_ip = fetch_ip_data(worker_id, ip_address_current, properties_fetched)
                                            worker_ip_addresses[worker_id][ip_address_current]['fetched'] = True

                                    if user_agent is not None:
                                        if user_agent not in worker_user_agents[worker_id]:
                                            worker_user_agents[worker_id][user_agent] = {}
                                            worker_user_agents[worker_id][user_agent]['fetched'] = False
                                            worker_user_agents[worker_id][user_agent]['batches'] = {batch_name: {}}
                                            worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit'] = time_arrival
                                            worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit_parsed'] = time_arrival_parsed
                                        else:
                                            worker_user_agents[worker_id][user_agent]['batches'][batch_name] = {}
                                            worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit'] = time_arrival
                                            worker_user_agents[worker_id][user_agent]['batches'][batch_name]['time_submit_parsed'] = time_arrival_parsed
                                        if user_agent in worker_user_agents_batches[worker_id]:
                                            worker_user_agents_batches[worker_id][user_agent].append(batch_name)
                                        else:
                                            worker_user_agents_batches[worker_id][user_agent] = [batch_name]
                                    for user_agent_current in worker_user_agents[worker_id]:
                                        if batch_name in worker_user_agents_batches[worker_id][user_agent_current]:
                                            ua_data, properties_moved_ua = fetch_uag_data(worker_id, user_agent_current, properties_fetched)
                                            worker_user_agents[worker_id][user_agent_current]['fetched'] = True
                        if 'params_fetched' in snapshot['worker'].keys():
                            properties_fetched = snapshot['worker']['properties_fetched']
                            properties_fetched_copy = snapshot['worker']['properties_fetched'].copy()
                            ip_address = None
                            user_agent = None
                            if 'cf_ip' in properties_fetched:
                                ip_address = properties_fetched['cf_ip']
                            elif 'ipify_ip' in properties_fetched:
                                ip_address = properties_fetched['ipify_ip']
                            if 'cf_uag' in properties_fetched:
                                user_agent = properties_fetched['cf_uag']
                            elif 'ngx_user_agent' in properties_fetched:
                                user_agent = properties_fetched['ngx_user_agent']
                            else:
                                user_agent = properties_fetched['nav_user_agent']
                            if ip_address is not None:
                                if ip_address not in worker_ip_addresses[worker_id]:
                                    worker_ip_addresses[worker_id][ip_address] = {}
                                    worker_ip_addresses[worker_id][ip_address]['fetched'] = False
                                    worker_ip_addresses[worker_id][ip_address]['batches'] = {snapshot['task']['batch_name']: {}}
                                    worker_ip_addresses[worker_id][ip_address]['batches'][snapshot['task']['batch_name']]['time_submit'] = snapshot['task']['time_submit']
                                    worker_ip_addresses[worker_id][ip_address]['batches'][snapshot['task']['batch_name']]['time_submit_parsed'] = snapshot['task']['time_submit_parsed']
                                else:
                                    worker_ip_addresses[worker_id][ip_address]['batches'][snapshot['task']['batch_name']] = {}
                                    worker_ip_addresses[worker_id][ip_address]['batches'][snapshot['task']['batch_name']]['time_submit'] = snapshot['task']['time_submit']
                                    worker_ip_addresses[worker_id][ip_address]['batches'][snapshot['task']['batch_name']]['time_submit_parsed'] = snapshot['task']['time_submit_parsed']
                                if ip_address in worker_ip_batches[worker_id]:
                                    worker_ip_batches[worker_id][ip_address].append(snapshot['task']['batch_name'])
                                else:
                                    worker_ip_batches[worker_id][ip_address] = [snapshot['task']['batch_name']]
                            for ip_address_current in worker_ip_addresses[worker_id]:
                                if not worker_ip_addresses[worker_id][ip_address_current]['fetched']:
                                    fetch_ip_data(worker_id, ip_address_current, properties_fetched)
                                    worker_ip_addresses[worker_id][ip_address_current]['fetched'] = True
                            if user_agent is not None:
                                if user_agent not in worker_user_agents[worker_id]:
                                    worker_user_agents[worker_id][user_agent] = {}
                                    worker_user_agents[worker_id][user_agent]['fetched'] = False
                                    worker_user_agents[worker_id][user_agent]['batches'] = {snapshot['task']['batch_name']: {}}
                                    worker_user_agents[worker_id][user_agent]['batches'][snapshot['task']['batch_name']]['time_submit'] = snapshot['task']['time_submit']
                                    worker_user_agents[worker_id][user_agent]['batches'][snapshot['task']['batch_name']]['time_submit_parsed'] = snapshot['task']['time_submit_parsed']
                                else:
                                    worker_user_agents[worker_id][user_agent]['batches'][snapshot['task']['batch_name']] = {}
                                    worker_user_agents[worker_id][user_agent]['batches'][snapshot['task']['batch_name']]['time_submit'] = snapshot['task']['time_submit']
                                    worker_user_agents[worker_id][user_agent]['batches'][snapshot['task']['batch_name']]['time_submit_parsed'] = snapshot['task']['time_submit_parsed']

                                if user_agent in worker_user_agents_batches[worker_id]:
                                    worker_user_agents_batches[worker_id][user_agent].append(snapshot['task']['batch_name'])
                                else:
                                    worker_user_agents_batches[worker_id][user_agent] = [snapshot['task']['batch_name']]
                            for user_agent_current in worker_user_agents[worker_id]:
                                if not worker_user_agents[worker_id][user_agent_current]['fetched']:
                                    fetch_uag_data(worker_id, user_agent_current, properties_fetched)
                                    worker_user_agents[worker_id][user_agent_current]['fetched'] = True

                            ip_data, properties_moved_ip = fetch_ip_data(worker_id, ip_address, properties_fetched)
                            uag_data, properties_moved_uag = fetch_uag_data(worker_id, user_agent, properties_fetched)
                            worker_ip_addresses[worker_id][ip_address]['fetched'] = True
                            worker_user_agents[worker_id][user_agent]['fetched'] = True
                            properties_unhandled = set(properties_fetched.keys()) - set(properties_moved_ip + properties_moved_uag)
                            if len(properties_unhandled) > 0:
                                for property_key in properties_unhandled:
                                    if property_key not in properties_unhandled:
                                        worker_properties_unhandled.append(property_key)
                                        console.print(f"Worker {worker_id} property unhandled: [orange]{property_key}")
                            snapshot['worker']['properties_fetched'] = properties_fetched_copy
                            if len(sequence) > 4:
                                for ip_current, ip_data_current in worker_ip_addresses[worker_id].items():
                                    if snapshot['task']['batch_name'] in worker_ip_batches[worker_id][ip_current] and ip_current in sequence_key:
                                        snapshot['ip']['info'][ip_current] = {}
                                        snapshot['ip']['info'][ip_current][snapshot['task']['batch_name']] = worker_ip_addresses[worker_id][ip_current]['batches'][snapshot['task']['batch_name']]
                                        snapshot['ip']['serialization'][ip_current] = ip_data[ip_current]
                            else:
                                for ip_current, ip_data_current in worker_ip_addresses[worker_id].items():
                                    if snapshot['task']['batch_name'] in worker_ip_batches[worker_id][ip_current]:
                                        snapshot['ip']['info'][ip_current] = {}
                                        snapshot['ip']['info'][ip_current][snapshot['task']['batch_name']] = worker_ip_addresses[worker_id][ip_current]['batches'][snapshot['task']['batch_name']]
                                        snapshot['ip']['serialization'][ip_current] = ip_data[ip_current]
                            for ua_current, ua_data_current in worker_user_agents[worker_id].items():
                                if snapshot['task']['batch_name'] in worker_user_agents_batches[worker_id][ua_current]:
                                    snapshot['uag']['info'][ua_current] = {}
                                    snapshot['uag']['info'][ua_current][snapshot['task']['batch_name']] = worker_user_agents[worker_id][ua_current]['batches'][snapshot['task']['batch_name']]
                                    snapshot['uag']['serialization'][ua_current] = uag_data[ua_current]

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

                        if task_key_found:
                            worker_snapshot.append(snapshot)

            with open(worker_snapshot_path, 'w', encoding='utf-8') as f:
                json.dump(worker_snapshot, f, ensure_ascii=False, indent=4, separators=(',', ':'))

        worker_counter += 1

    if worker_counter > 0:
        console.print(f"Data fetching for {worker_counter} workers [green]completed")

if len(worker_properties_unhandled) > 0:
    console.print(f"Worker properties not handled: {len(properties_unhandled)}")
    for property_key in properties_unhandled:
        console.print(f"Property name: [orange]{property_key}")

with console.status(f"Checking worker snapshots download", spinner="aesthetic") as status:
    status.start()
    workers_snapshots_paths = glob(f"{data_path}/*")
    for worker_snapshots_path in workers_snapshots_paths:
        worker_snapshots = read_json(worker_snapshots_path)
        for worker_snapshot in worker_snapshots:
            if worker_snapshot['data_items'] > 0:
                worker_snapshots_with_data_counter = worker_snapshots_with_data_counter + 1
            else:
                worker_snapshots_without_data_counter = worker_snapshots_without_data_counter + 1
        status.update(f"Checked worker snapshots: {(worker_snapshots_with_data_counter + worker_snapshots_without_data_counter)}")

console.print(f"Snapshots with data items fetched: {worker_snapshots_with_data_counter}")
console.print(f"Snapshots without data items fetched: {worker_snapshots_without_data_counter}")
console.print(f"Snapshots with data items fetched: {worker_snapshots_with_data_counter}")
console.print(f"Snapshots fetched total amount: {(worker_snapshots_with_data_counter + worker_snapshots_without_data_counter)}")
console.print(f"Workers Snapshots serialized at path: [cyan on white]{data_path}")


def find_snapshot_for_record(acl_record, include_empty=False):
    worker_snapshots_path = f"result/{acl_record['task_name']}/Data/{acl_record['worker_id']}.json"
    snapshots = read_json(worker_snapshots_path)
    for snapshot in snapshots:
        if not include_empty:
            if int(snapshot['data_items']) > 0:
                if snapshot['worker']['identifier'] == acl_record['worker_id'] and \
                    snapshot['task']['task_name'] == acl_record['task_name'] and \
                    snapshot['task']['batch_name'] == acl_record['batch_name'] and \
                    snapshot['task']['unit_id'] == acl_record['unit_id']:
                    return snapshot

        else:
            try:
                if snapshot['worker']['identifier'] == acl_record['worker_id'] and \
                    snapshot['task']['task_name'] == acl_record['task_name'] and \
                    snapshot['task']['batch_name'] == acl_record['batch_name'] and \
                    snapshot['task']['unit_id'] == acl_record['unit_id']:
                    return snapshot
            except KeyError:
                pp.pprint(worker_id)
                ##pp.pprint(acl_record)
                assert False


def check_worker_paid(snapshot):
    paid = False
    if 'checks' in snapshot:
        checks = snapshot['checks']
        if len(checks) > 0:
            check = checks[-1:][0]['serialization']['checks']
            paid = check['timeSpentCheck'] and check['globalFormValidity'] and any(check['goldChecks'])
    return paid


console.rule(f"{step_index} - Fetching Workers ACL")
step_index = step_index + 1

if not os.path.exists(df_acl_path):

    console.print(f"Checking worker presence in tables: {len(task_acl_tables)}")

    workers_participations = {}
    paginator = dynamo_db.get_paginator('scan')
    for table_acl in tqdm(task_acl_tables):
        for page in paginator.paginate(TableName=table_acl, Select='ALL_ATTRIBUTES'):
            if len(page['Items']) > 0:
                for item in page['Items']:
                    worker_id = item['identifier']['S']
                    if worker_id not in workers_participations:
                        workers_participations[worker_id] = [table_acl]
                    else:
                        if table_acl not in workers_participations[worker_id]:
                            workers_participations[worker_id].append(table_acl)

    worker_identifiers = set(workers_participations.keys())

    console.print(f"Unique worker identifiers found: {len(worker_identifiers)}")

    df_acl = pd.DataFrame(columns=[
        'worker_id',
        'identifiers_provided',
        'generated',
        'in_progress',
        'paid',
        'platform',
        'task_name',
        'batch_name',
        'unit_id',
        'token_input',
        'token_output',
        'position_current',
        'try_current',
        'try_last',
        'try_left',
        'tries_amount',
        'status_code',
        'access_counter',
        'time_arrival',
        'time_arrival_parsed',
        'time_submit',
        'time_submit_parsed',
        'time_completion',
        'time_completion_parsed',
        'time_expiration_nearest',
        'time_expiration_nearest_parsed',
        'time_expiration',
        'time_expiration_parsed',
        'time_expired',
        'time_removal',
        'time_removal_parsed',
        'questionnaire_amount',
        'questionnaire_amount_start',
        'questionnaire_amount_end',
        'dimensions_amount',
        'documents_amount',
        'ip_address',
        'ip_source',
        'user_agent',
        'user_agent_source',
        'folder',
        'source_path',
        'source_acl',
        'source_data',
        'source_log'
    ])

    for worker_id in tqdm(worker_identifiers):

        worker_snapshot_path = None
        worker_snapshots = []
        worker_acl_tables = workers_participations[worker_id]

        for table_acl in worker_acl_tables:

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
                    for item in page['Items']:

                        task_name_acl = item['task_name']['S'] if 'task_name' in item else item['task_id']['S']
                        batch_name_acl = item['batch_name']['S']
                        unit_id_acl = item['unit_id']['S']

                        for attribute, value in item.items():
                            if attribute != 'identifier':
                                value = value['S']
                                if 'false' in value or 'true' in value:
                                    value = bool(strtobool(value))
                                if attribute == 'task_id':
                                    row['task_name'] = value
                                else:
                                    if attribute not in df_acl.columns:
                                        df_acl[attribute] = np.nan
                                    row[attribute] = value
                        if 'identifiers_provided' not in row.keys():
                            row['identifiers_provided'] = np.nan

                        sequence_keys = [
                            f"{row['worker_id']}-{row['ip_address']}-{row['unit_id']}",
                            f"{row['worker_id']}-{row['unit_id']}"
                        ]

                        worker_snapshot_path = f"result/{task_name}/Data/{worker_id}.json"
                        worker_snapshots = read_json(worker_snapshot_path)
                        if len(worker_snapshots) > 0:
                            for worker_snapshot in worker_snapshots:
                                if worker_snapshot['sequence_key'] in sequence_keys:
                                    task = worker_snapshot['task']
                                    task_name_snapshot = task['task_name'] if 'task_name' in task else task['task_id']
                                    batch_name_snapshot = task['batch_name']
                                    unit_id_snapshot = task['unit_id']
                                    if task_name_acl == task_name_snapshot and batch_name_acl == batch_name_snapshot and unit_id_acl == unit_id_snapshot:
                                        worker_paid = check_worker_paid(worker_snapshot)
                                        row['paid'] = worker_paid
                                        row['source_acl'] = worker_snapshot['source_acl']
                                        row['source_data'] = worker_snapshot['source_data']
                                        row['source_log'] = worker_snapshot['source_log'] if worker_snapshot['source_log'] is not None else np.nan
                                        row['source_path'] = worker_snapshot['source_path']
                                        for attribute, value in task.items():
                                            if attribute != 'settings' and attribute != 'info' and attribute != 'task_id' and attribute != 'search_engine_settings' and attribute != 'search_engine_results_retrieved' and attribute != 'search_engine_results_retrieved_settings':
                                                row[attribute] = value
                                        if 'time_arrival' in row:
                                            row['time_arrival_parsed'] = find_date_string(row['time_arrival'])
                                        if 'time_completion' in row:
                                            row['time_completion_parsed'] = find_date_string(row['time_completion'])
                                        if 'time_removal' in row:
                                            row['time_removal_parsed'] = find_date_string(row['time_removal'])
                                        if 'time_expiration' in row:
                                            row['time_expiration_parsed'] = find_date_string(row['time_expiration'])
                                        if 'time_expiration_nearest' in row:
                                            row['time_expiration_nearest_parsed'] = find_date_string(row['time_expiration_nearest'])
                                        df_acl = pd.concat([df_acl, pd.DataFrame([row])], ignore_index=True)
                        else:
                            df_acl = pd.concat([df_acl, pd.DataFrame([row])], ignore_index=True)

    if len(df_acl) > 0:
        empty_cols = [col for col in df_acl.columns if df_acl[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_acl.drop(empty_cols, axis=1, inplace=True)
        df_acl.sort_values(by='time_arrival_parsed', inplace=True)
        df_acl.to_csv(df_acl_path, index=False)
        console.print(f"Dataframe shape: {df_acl.shape}")
        console.print(f"Workers info dataframe serialized at path: [cyan on white]{df_acl_path}")

else:
    df_acl = pd.read_csv(df_acl_path)
    console.print(f"Workers ACL [yellow]already detected[/yellow], skipping download")

platforms = np.unique(df_acl['platform'].astype(str).values)

console.rule(f"{step_index} - Checking Missing Units")
step_index = step_index + 1

hits = read_json(f"{task_config_folder}{batch_name}/{filename_hits_config}")
units = []
for hit in tqdm(hits):
    hit_completed = False
    for index, acl_record in df_acl.iterrows():
        if hit['unit_id'] == acl_record['unit_id'] and acl_record['paid'] == True:
            hit_completed = True
    if not hit_completed:
        units.append(hit['unit_id'])
console.print(f"There are [cyan on white]{len(units)}/{len(hits)}[/cyan on white] units not yet evaluated")
if units:
    sorted_units = sorted(units, key=lambda u: int(re.search(r'\d+', u).group()))
    console.print(Columns(sorted_units, equal=True, expand=True))

if 'mturk' in platforms:

    console.rule(f"{step_index} - Fetching MTurk Data")
    step_index = step_index + 1

    try:

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

                                    hit_df = pd.concat([hit_df, pd.DataFrame([row])], ignore_index=True)

                            hit_counter = hit_counter + 1

                        token_counter += 1
                        hit_df.to_csv(df_mturk_data_path, index=False)
                    except KeyError:
                        console.print(f"Found tokens: {token_counter}, HITs: {hit_counter}")
                        break
            else:
                hit_df = pd.read_csv(df_mturk_data_path)

        console.print(f"MTurk HITs data available at path: [cyan on white]{df_mturk_data_path}")

    except ClientError as error:
        console.print(f"MTurk HITs data not available.")
        handle_aws_error(error.response)

if 'toloka' in platforms:

    column_names = [
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
        "worker_id"
    ]

    console.rule(f"{step_index} - Fetching Toloka Data")
    step_index = step_index + 1

    if not os.path.exists(df_toloka_data_path):

        df_toloka = pd.DataFrame(columns=column_names)
        rows_assigned = []

        toloka_client = toloka.TolokaClient(toloka_oauth_token, 'PRODUCTION')

        df_acl_copy = df_acl.copy()
        df_acl_copy = df_acl_copy.loc[df_acl_copy['platform'] == 'toloka']

        tokens_input = []
        tokens_output = []
        for batch_current in np.unique(df_acl_copy['batch_name'].values):
            for hit in hits:
                tokens_input.append(hit['token_input'])
                tokens_output.append(hit['token_output'])
        tokens_input = list(set(sorted(tokens_input)))
        tokens_output = list(set(sorted(tokens_output)))

        for project in toloka_client.get_projects():
            project_data = None
            tokens_input_deployed = []
            tokens_output_deployed = []
            for input_field, data in project.task_spec.input_spec.items():
                if input_field == 'token_input' and data.allowed_values:
                    tokens_input_deployed_current = list(set(sorted(data.allowed_values)))
                    for token_input_deployed in tokens_input_deployed_current:
                        if token_input_deployed not in tokens_input_deployed:
                            tokens_input_deployed.append(token_input_deployed)
            for output_field, data in project.task_spec.output_spec.items():
                if output_field == 'token_output' and data.allowed_values:
                    tokens_output_deployed_current = list(set(sorted(data.allowed_values)))
                    for token_output_deployed in tokens_output_deployed_current:
                        if token_output_deployed not in tokens_output_deployed:
                            tokens_output_deployed.append(token_output_deployed)
                if output_field == 'token_input' and data.allowed_values:
                    tokens_input_deployed_current = list(set(sorted(data.allowed_values)))
                    for token_input_deployed in tokens_input_deployed_current:
                        if token_input_deployed not in tokens_input_deployed:
                            tokens_input_deployed.append(token_input_deployed)
            if tokens_input == tokens_input_deployed and tokens_output == tokens_output_deployed:
                console.print(f"Toloka project with name [cyan]{project.public_name}[/cyan] and ID [cyan]{project.id}[/cyan] found")
                project_data = project

            if project_data:

                row = {
                    'project_id': project_data.id,
                    'project_name': project_data.public_name.strip(),
                    'project_description': project_data.public_description.strip(),
                    'project_comment': project_data.private_comment.strip() if project_data.private_comment is not None else np.nan,
                }

                pool_counter = 0
                task_suites_counter = 0
                assignments_counter = 0

                for pool in toloka_client.find_pools(project_id=project_data.id, sort=['last_started'], limit=50).items:
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
                    for task_suite in toloka_client.find_task_suites(pool_id=pool.id, sort=['created'], limit=10000).items:
                        task_suites.append(task_suite)
                    for task_suite in tqdm(task_suites, desc=f"Processing task suites for pool {pool.id}:"):
                        row['task_suite_id'] = task_suite.id
                        row['task_suite_creation_date'] = task_suite.created.strftime("%Y-%m-%d %H:%M:%S")
                        row['task_suite_remaining_overlap'] = task_suite.remaining_overlap
                        row['task_suite_mixed'] = task_suite.mixed
                        row['task_suite_latitude'] = task_suite.latitude
                        row['task_suite_longitude'] = task_suite.longitude
                        task_suites_counter = task_suites_counter + 1
                        # Sort is in ascending order
                        for assignment in toloka_client.find_assignments(task_suite_id=task_suite.id, sort=['created'], limit=10000).items:
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
                                solution_length = len(assignment.solutions)
                                tokens_input_solution = []
                                tokens_output_solution = []
                                for index_sol in range(0, solution_length):
                                    solution = assignment.solutions[index_sol]
                                    if 'token_input' in solution.output_values:
                                        tokens_input_solution.append(solution.output_values['token_input'])
                                    if 'token_output' in solution.output_values:
                                        tokens_output_solution.append(solution.output_values['token_output'])
                                if len(tokens_input_solution) > 0:
                                    row['assignment_token_input_final'] = ':::'.join(tokens_input_solution)
                                else:
                                    row['assignment_token_input_final'] = np.nan
                                if len(tokens_output_solution) > 0:
                                    row['assignment_token_output'] = ':::'.join(tokens_output_solution)
                                else:
                                    row['assignment_token_output'] = np.nan
                            else:
                                row['assignment_token_input_final'] = np.nan
                                row['assignment_token_output'] = np.nan
                            row['assignment_reward'] = assignment.reward
                            row['assignment_rejected'] = assignment.rejected
                            row['assignment_automerged'] = assignment.automerged
                            row['assignment_mixed'] = assignment.mixed
                            user_metadata = requests.get(f"https://toloka.dev/api/v1/user-metadata/{assignment.user_id}", headers={'Authorization': f"ApiKey {toloka_oauth_token}"}).json()
                            row['user_id'] = assignment.user_id
                            row['user_country'] = user_metadata['country']
                            row['user_languages'] = ':::'.join(user_metadata['languages'])
                            row['user_country_by_phone'] = user_metadata['attributes']['country_by_phone'] if 'country_by_phone' in user_metadata['attributes'] else np.nan
                            row['user_country_by_ip'] = user_metadata['attributes']['country_by_ip'] if 'country_by_ip' in user_metadata['attributes'] else np.nan
                            row['user_client_type'] = user_metadata['attributes']['client_type'] if 'client_type' in user_metadata['attributes'] else np.nan
                            row['user_agent_type'] = user_metadata['attributes']['user_agent_type'] if 'user_agent_type' in user_metadata['attributes'] else np.nan
                            row['user_device_category'] = user_metadata['attributes']['device_category'] if 'device_category' in user_metadata['attributes'] else np.nan
                            row['user_os_family'] = user_metadata['attributes']['os_family'] if 'os_family' in user_metadata['attributes'] else np.nan
                            row['user_os_version'] = user_metadata['attributes']['os_version'] if 'os_version' in user_metadata['attributes'] else np.nan
                            row['user_os_version_major'] = user_metadata['attributes']['os_version_major'] if 'os_version_major' in user_metadata['attributes'] else np.nan
                            row['user_os_version_minor'] = user_metadata['attributes']['os_version_minor'] if 'os_version_minor' in user_metadata['attributes'] else np.nan
                            row['user_os_version_bugfix'] = user_metadata['attributes']['os_version_bugfix'] if 'os_version_bugfix' in user_metadata['attributes'] else np.nan
                            row['user_adult_allowed'] = user_metadata['adult_allowed']
                            acl_rows = df_acl_copy.loc[(df_acl_copy['token_output'] == row['assignment_token_output']) & (df_acl_copy['platform'] == 'toloka') & (df_acl_copy['generated'] is True)]
                            if row['assignment_token_input_final'] is not np.nan:
                                acl_rows = df_acl_copy.loc[df_acl_copy['token_input'] == row['assignment_token_input_final']]
                            if len(acl_rows) >= 0:
                                acl_rows = acl_rows.sort_values(by='time_arrival', ascending=False)
                                for index_acl, row_acl in acl_rows.iterrows():
                                    if index_acl not in rows_assigned:
                                        row['worker_id'] = row_acl['worker_id']
                                        rows_assigned.append(index_acl)
                                        break

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

    console.rule(f"{step_index} - Fetching Prolific Study Data")
    step_index = step_index + 1

    column_names = [
        'worker_id',
        'worker_ip',
        "workspace_id",
        "project_id",
        "study_id",
        "study_date_created",
        "study_date_created_parsed",
        "study_date_published",
        "study_date_published_parsed",
        "study_name",
        "study_name_internal",
        "study_description",
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
        'submission_return_requested',
        'submission_study_code',
        'submission_date_started',
        'submission_date_started_parsed',
        'submission_date_completed',
        'submission_date_completed_parsed',
        'submission_is_complete',
        'submission_time_elapsed_seconds',
        'submission_reward',
        'submission_star_awarded'
    ]

    if not os.path.exists(df_prolific_study_data_path):

        df_prolific_study_data = pd.DataFrame(columns=column_names)

        study_list = requests.get(f"https://api.prolific.com/api/v1/studies/", headers={'Authorization': f"Token {prolific_api_token}"}).json()['results']

        study_counter = 0
        submissions_counter = 0

        seen_study_ids = set()
        seen_submission_ids = set()
        skipped_study_dupes = 0
        skipped_submission_dupes = 0

        for study_data in study_list:
            if task_name in study_data['internal_name']:

                if study_data['id'] in seen_study_ids:
                    skipped_study_dupes += 1
                    continue
                seen_study_ids.add(study_data['id'])

                study_current = None
                if batch_prefix is not None:
                    if batch_prefix in study_data['internal_name']:
                        study_current = study_data
                else:
                    study_current = study_data

                if study_current is not None:

                    console.print(f"Processing study [cyan]{study_current['internal_name']}")

                    submissions_counter += 1

                    if int(study_current['number_of_submissions']) > 0:

                        study_current_add = requests.get(
                            f"https://api.prolific.com/api/v1/studies/{study_current['id']}/",
                            headers={'Authorization': f"Token {prolific_api_token}"}
                        ).json()
                        del study_current_add['eligibility_requirements']
                        del study_current_add['description']

                        submissions_list = []
                        page_count = 0
                        max_pages = 100
                        next_url = f"https://api.prolific.com/api/v1/studies/{study_current['id']}/submissions/"
                        seen_urls = set()

                        with tqdm(total=None, desc="Downloading submissions", unit=" page") as pbar:
                            while next_url and page_count < max_pages:
                                if next_url in seen_urls:
                                    pbar.set_postfix_str("repeated next_url, stopping")
                                    break
                                seen_urls.add(next_url)

                                response = requests.get(next_url, headers={'Authorization': f"Token {prolific_api_token}"})
                                if response.status_code != 200:
                                    raise Exception(f"Request failed with status {response.status_code}")

                                submissions_list_response = response.json()
                                submissions_list.extend(submissions_list_response['results'])
                                page_count += 1
                                pbar.update(1)

                                pbar.set_postfix({"page": page_count, "offset": next_url.split("offset=")[-1] if "offset=" in next_url else ""})
                                next_url = submissions_list_response.get('_links', {}).get('next', {}).get('href')

                        for submission_current in tqdm(submissions_list, desc="Processing submissions", unit=" record"):

                            submission_id = submission_current.get('id', None)
                            if submission_id is None or submission_id in seen_submission_ids:
                                skipped_submission_dupes += 1
                                continue
                            seen_submission_ids.add(submission_id)

                            submissions_counter += 1

                            row = {
                                "workspace_id": study_current_add.get('workspace', np.nan),
                                "project_id": study_current_add.get('project', np.nan),
                                "study_id": study_current.get('id', np.nan),
                                "study_date_created": study_current.get('date_created', np.nan),
                                "study_date_created_parsed": find_date_string(study_current.get('date_created')) if study_current.get('date_created') else np.nan,
                                "study_date_published": study_current_add.get('published_at', np.nan),
                                "study_date_published_parsed": find_date_string(study_current_add.get('published_at')) if study_current_add.get('published_at') else np.nan,
                                "study_name": study_current.get('name', np.nan),
                                "study_name_internal": study_current.get('internal_name', np.nan),
                                "study_completion_code": study_current_add.get('completion_code', np.nan),
                                "study_completion_option": study_current_add.get('completion_option', np.nan),
                                "study_completion_option_id": study_current_add.get('prolific_id_option', np.nan),
                                "study_status": study_current.get('status', np.nan),
                                "study_type": study_current.get('study_type', np.nan),
                                "study_share_id": study_current_add.get('share_id', np.nan),
                                "study_participant_eligible_count": int(study_current_add.get('eligible_participant_count', 0)),
                                "study_participant_pool_total": int(study_current_add.get('total_participant_pool', 0)),
                                "study_number_of_submissions": int(study_current.get('number_of_submissions', 0)),
                                "study_places_taken": int(study_current.get('places_taken', 0)),
                                "study_places_total_available": int(study_current.get('total_available_places', 0)),
                                "study_places_total_cost": float(study_current.get('total_cost', 0.0)),
                                "study_fees_per_submission": float(study_current_add.get('fees_per_submission', 0.0)),
                                "study_fees_percentage": float(study_current_add.get('fees_percentage', 0.0)),
                                "study_fees_percentage_service_margin": float(study_current_add.get('service_margin_percentage', 0.0)),
                                "study_fees_percentage_vat": float(study_current_add.get('vat_percentage', 0.0)),
                                "study_fees_discount_from_coupon": float(study_current_add.get('discount_from_coupons', 0.0)),
                                "study_fees_stars_remaining": float(study_current_add.get('stars_remaining', np.nan)),
                                "study_receipt": float(study_current_add.get('receipt')) if study_current_add.get('receipt') else np.nan,
                                "study_currency_code": study_current_add.get('currency_code', np.nan),
                                "study_reward": float(study_current.get('reward', 0.0)),
                                "study_reward_minimum_per_hour": float(study_current_add.get('minimum_reward_per_hour', 0.0)),
                                "study_reward_average_per_hour": float(study_current_add.get('average_reward_per_hour', 0.0)),
                                "study_reward_average_per_hour_without_adjustment": float(study_current_add.get('average_reward_per_hour_without_adjustment', 0.0)),
                                "study_reward_has_had_adjustment": study_current_add.get('has_had_adjustment', np.nan),
                                "study_reward_level_below_original_estimate": study_current.get('reward_level', {}).get('below_original_estimate', np.nan),
                                "study_reward_level_below_prolific_min": study_current.get('reward_level', {}).get('below_prolific_min', np.nan),
                                "study_time_allowed_maximum": float(study_current_add.get('maximum_allowed_time', 0.0)),
                                "study_time_average_taken": float(study_current_add.get('average_time_taken', 0.0)),
                                "study_time_completion_estimated": float(study_current_add.get('estimated_completion_time', 0.0)),
                                "study_is_reallocated": study_current.get('is_reallocated', np.nan),
                                "study_is_underpaying": study_current.get('is_underpaying', np.nan),
                                "study_privacy_notice": study_current.get('privacy_notice', np.nan),
                                "study_publish_at": study_current.get('publish_at', np.nan),
                                "study_device_compatibility": ':::'.join(study_current_add.get('device_compatibility', [])),
                                "study_peripheral_requirements": ':::'.join(study_current_add.get('peripheral_requirements', [])) if study_current_add.get('peripheral_requirements') else np.nan,
                                "study_url_external": study_current_add.get('external_study_url', np.nan),
                                "worker_id": submission_current.get('participant_id', np.nan),
                                "worker_ip": submission_current.get('ip', np.nan),
                                "submission_id": submission_id,
                                "submission_status": submission_current.get('status', np.nan),
                                "submission_return_requested": submission_current.get('return_requested', np.nan),
                                "submission_study_code": submission_current.get('study_code', np.nan),
                                "submission_date_started": submission_current.get('started_at', np.nan),
                                "submission_date_started_parsed": find_date_string(submission_current.get('started_at')) if submission_current.get('started_at') else np.nan,
                                "submission_date_completed": submission_current.get('completed_at', np.nan),
                                "submission_date_completed_parsed": find_date_string(submission_current.get('completed_at')) if submission_current.get('completed_at') else np.nan,
                                "submission_is_complete": submission_current.get('is_complete', np.nan),
                                "submission_time_elapsed_seconds": int(submission_current.get('time_taken', 0)) if submission_current.get('time_taken') else np.nan,
                                "submission_reward": float(submission_current.get('reward', np.nan)),
                                "submission_star_awarded": float(submission_current.get('star_awarded', np.nan)),
                                "submission_bonus_payments": ':::'.join(map(str, submission_current.get('bonus_payments', [])))
                            }

                            df_prolific_study_data.loc[len(df_prolific_study_data)] = row

        console.print(f"Skipped [red]{skipped_study_dupes}[/red] duplicate studies based on ID.")
        console.print(f"Skipped [red]{skipped_submission_dupes}[/red] duplicate submissions based on ID.")

        console.print(f"Study found for the current task: [green]{study_counter}[/green]")
        console.print(f"Submissions found for the current task: [green]{submissions_counter}[/green]")
        console.print(f"Dataframe shape: {df_prolific_study_data.shape}")
        if df_prolific_study_data.shape[0] > 0:
            df_prolific_study_data.dropna(axis=1, how='all', inplace=True)
            df_prolific_study_data.to_csv(df_prolific_study_data_path, index=False)
            console.print(f"Prolific study dataframe serialized at path: [cyan on black]{df_prolific_study_data_path}")
        else:
            console.print(f"Dataframe study shape: {df_prolific_study_data.shape}")
            console.print(f"Prolific dataframe [yellow]empty[/yellow], dataframe not serialized.")

    else:

        df_prolific_study_data = pd.read_csv(df_prolific_study_data_path)
        console.print(f"Prolific dataframe [yellow]already detected[/yellow], skipping creation")
        console.print(f"Serialized at path: [cyan on black]{df_prolific_study_data_path}")

    if not os.path.exists(df_prolific_demographic_data_path):

        console.rule(f"{step_index} - Fetching Prolific Demographic Data")
        step_index += 1

        column_names = [
            "worker_id", "workspace_id", "project_id", "study_id", "study_custom_tncs_accepted",
            "submission_id", 'submission_date_started', 'submission_date_started_parsed',
            'submission_date_completed', 'submission_date_completed_parsed',
            'submission_date_reviewed', 'submission_date_reviewed_parsed',
            'submission_date_archived', 'submission_date_archived_parsed',
            'submission_time_elapsed_seconds', 'submission_status', 'worker_completion_code_entered',
            'worker_total_approvals', 'worker_sex', 'worker_age', 'worker_ethnicity_simplified',
            'worker_country_birth', 'worker_country_residence', 'worker_nationality',
            'worker_language', 'worker_languages_fluent', 'worker_student_status',
            'worker_employment_status',
        ]

        df_prolific_demo_data = pd.DataFrame(columns=column_names)

        study_list = requests.get(
            "https://api.prolific.com/api/v1/studies/",
            headers={'Authorization': f"Token {prolific_api_token}"}
        ).json().get('results', [])

        for study_data in study_list:
            if task_name in study_data.get('internal_name', ''):
                if batch_prefix is None or batch_prefix in study_data['internal_name']:
                    study_current = study_data
                    study_current_add = requests.get(
                        f"https://api.prolific.com/api/v1/studies/{study_current['id']}/",
                        headers={'Authorization': f"Token {prolific_api_token}"}
                    ).json()

                    study_current_add.pop('eligibility_requirements', None)
                    study_current_add.pop('description', None)

                    console.print(f"Processing study [cyan]{study_current['internal_name']}")

                    with requests.Session() as session:
                        export_url = f"https://api.prolific.com/api/v1/studies/{study_current['id']}/export/"
                        response = session.get(export_url, headers={'Authorization': f"Token {prolific_api_token}"})

                        decoded_content = response.content.decode('utf-8')
                        reader = csv.reader(decoded_content.splitlines(), delimiter=',')
                        demo_list = list(reader)

                        if len(demo_list) > 1:
                            df_demo_raw = pd.DataFrame(demo_list[1:], columns=demo_list[0])

                            for _, row_raw in tqdm(df_demo_raw.iterrows(), total=len(df_demo_raw), desc=f"Downloading demographics", unit=" row"):
                                row = {
                                    "worker_id": row_raw.get('Participant id', np.nan),
                                    "workspace_id": study_current_add.get('workspace', np.nan),
                                    "project_id": study_current_add.get('project', np.nan),
                                    "study_id": study_current.get('id', np.nan),
                                    "study_custom_tncs_accepted": row_raw.get('Custom study tncs accepted at', np.nan),
                                    "submission_id": row_raw.get('Submission id', np.nan),
                                    'submission_date_started': row_raw.get('Started at', np.nan),
                                    'submission_date_started_parsed': find_date_string(row_raw.get('Started at'), seconds=True) if row_raw.get('Started at') else np.nan,
                                    'submission_date_completed': row_raw.get('Completed at', np.nan),
                                    'submission_date_completed_parsed': find_date_string(row_raw.get('Completed at'), seconds=True) if row_raw.get('Completed at') else np.nan,
                                    'submission_date_reviewed': row_raw.get('Reviewed at', np.nan),
                                    'submission_date_reviewed_parsed': find_date_string(row_raw.get('Reviewed at'), seconds=True) if row_raw.get('Reviewed at') else np.nan,
                                    'submission_date_archived': row_raw.get('Archived at', np.nan),
                                    'submission_date_archived_parsed': find_date_string(row_raw.get('Archived at'), seconds=True) if row_raw.get('Archived at') else np.nan,
                                    'submission_time_elapsed_seconds': float(row_raw.get('Time taken')) if row_raw.get('Time taken', '') else np.nan,
                                    'submission_status': row_raw.get('Status', np.nan),
                                    'worker_completion_code_entered': row_raw.get('Completion code', np.nan),
                                    'worker_total_approvals': row_raw.get('Total approvals', np.nan),
                                    'worker_sex': row_raw.get('Sex', np.nan),
                                    'worker_age': row_raw.get('Age', np.nan),
                                    'worker_ethnicity_simplified': row_raw.get('Ethnicity simplified', np.nan),
                                    'worker_country_birth': row_raw.get('Country of birth', np.nan),
                                    'worker_country_residence': row_raw.get('Country of residence', np.nan),
                                    'worker_nationality': row_raw.get('Nationality', np.nan),
                                    'worker_language': row_raw.get('Language', np.nan),
                                    'worker_languages_fluent': ":::".join(row_raw.get('Fluent languages', '').split(", ")) if row_raw.get('Fluent languages') else np.nan,
                                    'worker_student_status': row_raw.get('Student status', np.nan),
                                    'worker_employment_status': row_raw.get('Employment status', np.nan),
                                }
                                df_prolific_demo_data = pd.concat([df_prolific_demo_data, pd.DataFrame([row])], ignore_index=True)

        if df_prolific_demo_data.shape[0] > 0:
            df_prolific_demo_data.dropna(axis=1, how='all', inplace=True)
            df_prolific_demo_data.to_csv(df_prolific_demographic_data_path, index=False)
            console.print(f"Prolific demographic dataframe serialized at path: [cyan on black]{df_prolific_demographic_data_path}")
        else:
            console.print(f"Dataframe shape: {df_prolific_demo_data.shape}")
            console.print(f"Prolific demographic dataframe [yellow]empty[/yellow], dataframe not serialized.")
    else:
        df_prolific_demo_data = pd.read_csv(df_prolific_demographic_data_path)
        console.print(f"Prolific demographic dataframe [yellow]already detected[/yellow], skipping creation")
        console.print(f"Serialized at path: [cyan on black]{df_prolific_demographic_data_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_ip_addresses[/cyan on white] Dataframe")
step_index = step_index + 1

if not os.path.exists(df_ip_path):

    df_ip = pd.DataFrame()

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        sequence_key = f"{acl_record['worker_id']}-{acl_record['ip_address']}-{acl_record['unit_id']}"
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)
            task = worker_snapshot['task']
            checks = worker_snapshot['checks']
            ip_data = worker_snapshot['ip']

            ip_info = ip_data['info']
            ip_serialization = ip_data['serialization']

            for ip_address, ip_info_details in ip_info.items():

                for ip_batch, batch_data in ip_info_details.items():

                    row = {
                        'worker_id': worker_id,
                        'paid': worker_paid,
                        'task_name': task['task_name'],
                        'batch_name': ip_batch,
                        'unit_id': task['unit_id'],
                        'ip_address': ip_address,
                        'time_submit': batch_data['time_submit'],
                        'time_submit_parsed': batch_data['time_submit_parsed'],
                    }

                    ip_properties = ip_serialization[ip_address]
                    for property, value in ip_properties.items():
                        if property == 'location_languages':
                            for index_lang, location_language_data in enumerate(value):
                                for lang_property, lang_value in location_language_data.items():
                                    row[f"{lang_property}_{index_lang}"] = lang_value
                        else:
                            row[property] = value
                    df_ip = pd.concat([df_ip, pd.DataFrame([row])])

    if len(df_ip) > 0:
        df_ip.sort_values(by=['worker_id', 'batch_name', 'time_submit_parsed'], inplace=True)
        df_ip.to_csv(df_ip_path, index=False)
        console.print(f"Dataframe shape: {df_ip.shape}")
        console.print(f"Workers IP addresses dataframe serialized at path: [cyan on white]{df_ip_path}")
else:
    df_ip = pd.read_csv(df_ip_path)
    console.print(f"Workers IP addresses dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_ip_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_user_agents[/cyan on white] Dataframe")
step_index = step_index + 1

if not os.path.exists(df_uag_path):

    df_ua = pd.DataFrame()

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)
            task = worker_snapshot['task']
            checks = worker_snapshot['checks']
            ua_data = worker_snapshot['uag']

            ua_info = ua_data['info']
            ua_serialization = ua_data['serialization']

            for user_agent, user_agent_details in ua_info.items():

                for ua_batch, batch_data in user_agent_details.items():

                    row = {
                        'worker_id': worker_id,
                        'paid': worker_paid,
                        'task_name': task['task_name'] if 'task_name' in task else task['task_id'],
                        'batch_name': ua_batch,
                        'unit_id': task['unit_id'],
                        'user_agent': user_agent,
                        'time_submit': batch_data['time_submit'],
                        'time_submit_parsed': batch_data['time_submit_parsed'],
                    }

                    ua_properties = ua_serialization[user_agent]
                    for property, value in ua_properties.items():
                        row[property] = value
                    df_ua = pd.concat([df_ua, pd.DataFrame([row])], ignore_index=True)

    if len(df_ua) > 0:
        df_ua.sort_values(by=['worker_id', 'batch_name', 'time_submit_parsed'], inplace=True)
        df_ua.to_csv(df_uag_path, index=False)
        console.print(f"Dataframe shape: {df_ua.shape}")
        console.print(f"Workers user agents dataframe serialized at path: [cyan on white]{df_uag_path}")
else:
    df_ua = pd.read_csv(df_uag_path)
    console.print(f"Workers user agents dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_ip_path}")

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


if not os.path.exists(df_comm_path):

    df_comm = pd.DataFrame(columns=load_comment_col_names())

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)
            checks = worker_snapshot['checks']
            task = worker_snapshot['task']
            task_name = task['task_name']
            batch_name = task['batch_name']
            unit_id = task['unit_id']

            row = {
                'worker_id': worker_id,
                'paid': worker_paid,
                'task_name': task_name,
                'batch_name': batch_name,
                'unit_id': unit_id
            }

            if 'comments' in worker_snapshot:

                comments = worker_snapshot['comments']

                for comment in comments:

                    if len(comment['serialization']['comment']) > 0:
                        row['try_current'] = comment['serialization']['info']['try']
                        row['time_submit'] = comment['time_submit']
                        row['time_submit_parsed'] = find_date_string(row['time_submit'])
                        row['sequence_number'] = int(comment['serialization']['info']['sequence'])
                        row['text'] = sanitize_string(comment['serialization']['comment'])
                        df_comm = pd.concat([df_comm, pd.DataFrame([row])], ignore_index=True)

    if df_comm.shape[0] > 0:
        empty_cols = [col for col in df_comm.columns if df_comm[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_comm.drop(empty_cols, axis=1, inplace=True)
        df_comm["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_comm["paid"] = df_comm["paid"].astype(bool)
        df_comm.sort_values(by='time_submit_parsed', inplace=True)
        df_comm.to_csv(df_comm_path, index=False)
        console.print(f"Dataframe shape: {df_comm.shape}")
        console.print(f"Workers comments dataframe serialized at path: [cyan on white]{df_comm_path}")
    else:
        console.print(f"Dataframe shape: {df_comm.shape}")
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
                elif type(answer_current) == str:
                    answer_value = answer_current
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
        if type(value) is not list:
            row[f"question_attribute_{attribute}"] = value

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


if not os.path.exists(df_quest_path):

    df_quest = pd.DataFrame()
    questionnaires_backup = None

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)
            task = worker_snapshot['task']
            checks = worker_snapshot['checks']
            questionnaires = worker_snapshot['questionnaires']
            if len(questionnaires) > 0:
                questionnaires_backup = questionnaires
            questionnaires_answers = worker_snapshot['questionnaires_answers']

            task_name = task['task_name']
            batch_name = task['batch_name']
            unit_id = task['unit_id']

            column_names = load_quest_col_names(questionnaires)

            for column in column_names:
                if column not in df_quest:
                    df_quest[column] = np.nan

            if len(questionnaires_answers) > 0:

                for questionnaire_data in questionnaires_answers:

                    row = {}
                    row['worker_id'] = worker_id
                    row['paid'] = worker_paid
                    row['task_name'] = task_name
                    row['batch_name'] = batch_name
                    row['unit_id'] = unit_id
                    row['time_submit'] = questionnaire_data['time_submit']
                    row['time_submit_parsed'] = find_date_string(row['time_submit'])

                    try:
                        questionnaire = questionnaires[questionnaire_data['serialization']['info']['index']]
                    except KeyError:
                        # Branch triggered when the original 'data' payload has been lost
                        questionnaire = questionnaires_backup[questionnaire_data['serialization']['info']['index']]
                        questionnaire['questions'] = questionnaire_data['serialization']['questions']
                    questions = questionnaire_data['serialization']['questions']
                    current_answers = questionnaire_data['serialization']['answers']
                    timestamps_start = questionnaire_data['serialization']["timestamps_start"]
                    timestamps_end = questionnaire_data['serialization']["timestamps_end"]
                    timestamps_elapsed = questionnaire_data['serialization']["timestamps_elapsed"]
                    info = questionnaire_data['serialization']["info"]
                    accesses = questionnaire_data['serialization']["accesses"]

                    row['action'] = info['action']
                    row['try_current'] = info['try']

                    data = df_quest.loc[
                        (df_quest['worker_id'] == row['worker_id']) &
                        (df_quest['task_name'] == row['task_name']) &
                        (df_quest['batch_name'] == row['batch_name']) &
                        (df_quest['unit_id'] == row['unit_id']) &
                        (df_quest['try_current'] == row['try_current']) &
                        (df_quest['questionnaire_index'] == questionnaire_data['serialization']['info']['index'])
                        ]

                    if data.shape[0] <= 0:

                        for attribute, value in questionnaire.items():
                            if type(value) != list:
                                row[f"questionnaire_{attribute}"] = value
                        try:
                            row[f"questionnaire_time_elapsed"] = round(timestamps_elapsed, 2)
                        except TypeError:
                            delta = (datetime.fromtimestamp(timestamps_end[-1])) - (datetime.fromtimestamp(timestamps_start[0]))
                            row[f"questionnaire_time_elapsed"] = round(delta.total_seconds(), 2)
                        row[f"questionnaire_accesses"] = accesses

                        for index_sub, question in enumerate(questions):
                            if 'dropped' in question:
                                if not question['dropped']:
                                    row = parse_answers(row, questionnaire, question, current_answers)
                                    df_quest = pd.concat([df_quest, pd.DataFrame([row])], ignore_index=True)
                            else:
                                row = parse_answers(row, questionnaire, question, current_answers)
                                df_quest = pd.concat([df_quest, pd.DataFrame([row])], ignore_index=True)

    if df_quest.shape[0] > 0:
        empty_cols = [col for col in df_quest.columns if df_quest[col].isnull().all()]
        df_quest.drop(empty_cols, axis=1, inplace=True)
        df_quest["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_quest["paid"] = df_quest["paid"].astype(bool)
        df_quest["try_current"] = df_quest["try_current"].astype(int)
        df_quest["questionnaire_allow_back"].replace({0.0: False, 1.0: True}, inplace=True)
        df_quest["questionnaire_allow_back"] = df_quest["questionnaire_allow_back"].astype(bool)
        df_quest["question_attribute_required"] = df_quest["question_attribute_required"].astype(bool)
        if 'question_attribute_freeText' in df_quest:
            df_quest["question_attribute_freeText"].replace({0.0: False, 1.0: True}, inplace=True)
            df_quest["question_attribute_freeText"] = df_quest["question_attribute_freeText"].astype(bool)
        if 'question_attribute_dropped' in df_quest:
            df_quest["question_attribute_dropped"].replace({0.0: False, 1.0: True}, inplace=True)
            df_quest["question_attribute_dropped"] = df_quest["question_attribute_dropped"].astype(bool)
        if 'question_attribute_showDetail' in df_quest:
            df_quest["question_attribute_showDetail"].replace({0.0: False, 1.0: True}, inplace=True)
            df_quest["question_attribute_showDetail"] = df_quest["question_attribute_showDetail"].astype(bool)
        df_quest.sort_values(by=['worker_id', 'time_submit_parsed'], inplace=True)
        df_quest.to_csv(df_quest_path, index=False)
        console.print(f"Dataframe shape: {df_quest.shape}")
        console.print(f"Workers questionnaire dataframe serialized at path: [cyan on white]{df_quest_path}")
    else:
        console.print(f"Dataframe shape: {df_quest.shape}")
        console.print(f"Workers questionnaire dataframe [yellow]empty[/yellow], dataframe not serialized.")
else:
    console.print(f"Workers questionnaire dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_quest_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_documents[/cyan on white] dataframe")
step_index = step_index + 1

df_docs = pd.DataFrame()


def load_elem_col_names(documents):
    columns = []

    for document in documents:
        current_attributes = document.keys()
        for current_attribute in current_attributes:
            if f"{current_attribute}" not in columns and current_attribute != "id" and current_attribute != "index" and current_attribute != "params":
                columns.append(current_attribute)
            if current_attribute == "id":
                columns.append(f"document_{current_attribute}")
        for current_attribute in current_attributes:
            if current_attribute == "params":
                for current_parameter, current_parameter_value in document[current_attribute].items():
                    if (current_parameter == "check_gold"):
                        for check_gold_parameter in current_parameter_value.keys():
                            if f"{current_parameter}_{check_gold_parameter}" not in columns:
                                columns.append(f"{current_parameter}_{check_gold_parameter}")
                    else:
                        if f"{current_parameter}" not in columns:
                            columns.append(f"{current_parameter}")

    columns.append("unit_ids")
    columns.append("worker_ids")

    return columns


if not os.path.exists(df_docs_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)

            task = worker_snapshot['task']
            documents = worker_snapshot['documents']

            column_names = load_elem_col_names(documents)

            for column in column_names:
                if column not in df_docs:
                    df_docs[column] = np.nan

            if len(documents) > 0:

                for document in documents:

                    row = df_docs.loc[df_docs['document_id'] == document['id']]

                    if row.shape[0] <= 0:

                        row = {
                            'document_id': document['id']
                        }

                        for element_attribute, element_value in document.items():

                            if element_attribute == 'index':
                                pass
                            elif element_attribute == 'id':
                                row[f"document_{element_attribute}"] = element_value
                            elif element_attribute == 'params':
                                for parameter_name, parameter_value in element_value.items():
                                    if (parameter_name == "check_gold"):
                                        for check_gold_name, check_gold_value in parameter_value.items():
                                            row[f"{parameter_name}_{check_gold_name}"] = check_gold_value
                                    else:
                                        row[f"{parameter_name}"] = parameter_value
                            else:
                                row[element_attribute] = element_value

                        unit_ids = []
                        for hit in hits:
                            unit_id = hit['unit_id']
                            for element in hit['documents']:
                                if row['document_id'] == element['id']:
                                    unit_ids.append(unit_id)
                        row['unit_ids'] = ':::'.join(unit_ids)

                        worker_ids = []
                        if acl_record['unit_id'] in unit_ids:
                            worker_ids.append(worker_id)
                        row['worker_ids'] = ':::'.join(worker_ids)

                        df_docs.loc[len(df_docs)] = row

                    else:

                        unit_ids = row['unit_ids'].values[0].split(":::")
                        worker_ids = row['worker_ids'].values[0].split(":::")
                        if acl_record['unit_id'] in unit_ids:
                            worker_ids.append(worker_id)
                        row['worker_ids'] = ':::'.join(worker_ids)

                        df_docs.loc[row.index] = row

    if df_docs.shape[0] > 0:
        empty_cols = [col for col in df_docs.columns if df_docs[col].isnull().all()]
        df_docs.drop(empty_cols, axis=1, inplace=True)
        df_docs.to_csv(df_docs_path, index=False)
        console.print(f"Dataframe shape: {df_docs.shape}")
        console.print(f"Documents dataframe serialized at path: [cyan on white]{df_docs_path}")
    else:
        console.print(f"Dataframe shape: {df_docs.shape}")
        console.print(f"Documents dataframe [yellow]empty[/yellow], dataframe not serialized.")
else:
    console.print(f"Documents dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_docs_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_answers[/cyan on white] dataframe")
step_index = step_index + 1


def load_data_col_names(dimensions, settings=None):
    columns = []

    columns.append("worker_id")
    columns.append("paid")
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_last")
    columns.append("try_current")
    columns.append("action")
    columns.append("time_submit")
    columns.append("time_submit_parsed")

    columns.append("document_id")
    columns.append("document_index")

    for dimension in dimensions:
        if f"{dimension['name']}_value" not in columns:
            columns.append(f"{dimension['name']}_value")
        if f"{dimension['name']}_description" not in columns:
            columns.append(f"{dimension['name']}_description")
        if f"{dimension['name']}_label" not in columns:
            columns.append(f"{dimension['name']}_label")
        if f"{dimension['name']}_index" not in columns:
            columns.append(f"{dimension['name']}_index")
        if f"{dimension['name']}_justification" not in columns:
            if dimension['justification'] is not None:
                columns.append(f"{dimension['name']}_justification")
        if f"{dimension['name']}_url" not in columns:
            if dimension['url'] is not None:
                columns.append(f"{dimension['name']}_url")
        if settings is not None:
            if 'post_assessment' in settings.keys():
                post_assessment_data = settings['post_assessment']
                if post_assessment_data is not None:
                    post_assessment_attributes = settings['post_assessment']['attributes']
                    for assessment_data in post_assessment_attributes:
                        post_assessment_index = assessment_data['index']
                        if 'dimensions' in settings['post_assessment']:
                            post_assessment_dimensions = settings['post_assessment']['dimensions']
                            for dimension_data in post_assessment_dimensions:
                                if dimension_data['name'] == dimension['name'] and post_assessment_index in dimension_data['indexes']:
                                    columns.append(f"{dimension['name']}_value_post_{post_assessment_index}")
                                    if 'justification' in dimension.keys():
                                        if dimension['justification'] is not None:
                                            columns.append(f"{dimension['name']}_justification_post_{post_assessment_index}")
                                    if 'url' in dimension.keys():
                                        if dimension['url'] is not None:
                                            columns.append(f"{dimension['name']}_url_post_{post_assessment_index}")

    columns.append("time_start")
    columns.append("time_end")
    columns.append("time_elapsed")
    columns.append("time_start_parsed")
    columns.append("time_end_parsed")
    columns.append("accesses")

    columns.append("countdown_time_start")
    columns.append("countdown_time_value")
    columns.append('countdown_end')
    columns.append("countdown_time_text")
    columns.append("countdown_time_expired")
    columns.append("countdown_time_started")
    columns.append("overtime")

    columns.append("global_outcome")
    columns.append("global_form_validity")
    columns.append("gold_checks")
    columns.append("time_spent_check")

    return columns


df_answ = pd.DataFrame()


def check_task_type(doc, typeslist):
    return typeslist != False if not typeslist else typeslist == True or (doc["params"]['task_type'].lower() in [x.lower() for x in typeslist])


if not os.path.exists(df_data_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)

            task = worker_snapshot['task']
            checks = worker_snapshot['checks']
            worker = worker_snapshot['worker']
            documents_answers = worker_snapshot['documents_answers']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            settings = None
            if 'settings' in task.keys():
                settings = task['settings']

            column_names = load_data_col_names(dimensions, settings)

            for column in column_names:
                if column not in df_answ:
                    df_answ[column] = np.nan

            if len(documents_answers) > 0:

                row = {}
                row['worker_id'] = worker_id
                row['paid'] = worker_paid

                for attribute, value in task.items():
                    if attribute == 'task_id':
                        row['task_name'] = value
                    if attribute in column_names:
                        row[attribute] = value

                for document_data in documents_answers:

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
                                row["time_spent_check"] = check_data['serialization']["checks"]["timeSpentCheck"]
                    else:
                        row["global_outcome"] = False
                        row["global_form_validity"] = False
                        row["gold_checks"] = False
                        row["time_spent_check"] = False
                    row["accesses"] = document_data['serialization']['accesses']
                    countdowns_start = document_data['serialization']['countdowns_times_start']
                    countdowns_left = document_data['serialization']['countdowns_times_left']
                    countdowns_expired_time = document_data['serialization']['countdown_expired_timestamp']
                    countdowns_expired = document_data['serialization']['countdowns_expired']
                    countdowns_started = document_data['serialization']['countdowns_started']
                    countdowns_expired_value = countdowns_expired[document_data['serialization']['info']['index']] if isinstance(countdowns_expired, list) and len(
                        countdowns_expired) > 0 else countdowns_expired if isinstance(countdowns_expired, bool) else np.nan
                    overtime = document_data['serialization']['overtime']
                    row["countdown_time_start"] = countdowns_start if countdowns_start is not None else np.nan
                    row["countdown_time_value"] = countdowns_left if countdowns_left is not None else np.nan
                    row["countdown_time_expired"] = countdowns_expired_value
                    row["countdown_time_started"] = countdowns_started if countdowns_left is not None else np.nan
                    row['overtime'] = overtime if countdowns_left is not None else np.nan
                    row['countdown_end'] = countdowns_expired_time if countdowns_left is not None else np.nan

                    current_attributes = documents[document_data['serialization']['info']['index']].keys()
                    current_answers = document_data['serialization']['answers']
                    for dimension in dimensions:
                        task_type_check = True
                        if 'task_type' in dimension.keys():
                            task_type_check = check_task_type(documents[document_data['serialization']['info']['index']], dimension['task_type'])
                        if dimension['scale'] is not None and task_type_check:
                            if settings is not None:
                                if 'post_assessment' in settings.keys():
                                    if settings['post_assessment'] is not None:
                                        if 'attributes' in settings['post_assessment']:
                                            post_assessment_data = settings['post_assessment']['attributes']
                                            post_assessment_dimensions = settings['post_assessment']['dimensions']
                                            for assessment_data in post_assessment_data:
                                                post_assessment_index = assessment_data['index']
                                                for dimension_data in post_assessment_dimensions:
                                                    if dimension_data['name'] == dimension['name'] and post_assessment_index in dimension_data['indexes']:
                                                        # If the dimension appears in the first post-assessment, also the initial values must be stored
                                                        if post_assessment_index == 0:
                                                            value = current_answers[f"{dimension['name']}_value"]
                                                            if type(value) is str:
                                                                value = value.strip()
                                                                value = re.sub('\n', '', value)
                                                            row[f"{dimension['name']}_value"] = value
                                                        value_post = current_answers[f"{dimension['name']}_value_post_{post_assessment_index + 1}"]
                                                        if type(value_post) is str:
                                                            value_post = value_post.strip()
                                                            value_post = re.sub('\n', '', value_post)
                                                        row[f"{dimension['name']}_value_post_{post_assessment_index}"] = value_post
                                    else:
                                        value = current_answers[f"{dimension['name']}_value"]
                                        if type(value) is str:
                                            value = value.strip()
                                            value = re.sub('\n', '', value)
                                        row[f"{dimension['name']}_value"] = value
                                else:
                                    value = current_answers[f"{dimension['name']}_value"]
                                    if type(value) is str:
                                        value = value.strip()
                                        value = re.sub('\n', '', value)
                                    row[f"{dimension['name']}_value"] = value
                            if dimension["scale"]["type"] == "categorical":
                                for mapping in dimension["scale"]['mapping']:
                                    label = mapping['label'].lower().split(" ")
                                    label = '-'.join([str(c) for c in label])
                                    if mapping['value'] == row[f"{dimension['name']}_value"]:
                                        row[f"{dimension['name']}_label"] = label
                                        row[f"{dimension['name']}_index"] = mapping['index']
                                        if not (mapping['description']):
                                            row[f"{dimension['name']}_description"] = np.nan
                                        else:
                                            row[f"{dimension['name']}_description"] = np.nan if len(mapping['description']) <= 0 else mapping['description']
                            else:
                                row[f"{dimension['name']}_label"] = np.nan
                                row[f"{dimension['name']}_index"] = np.nan
                                row[f"{dimension['name']}_description"] = np.nan
                        else:
                            # If the dimension has been used in a training scenario, its values must not be null.
                            if 'Training' not in dimension['task_type']:
                                row[f"{dimension['name']}_value"] = np.nan
                                row[f"{dimension['name']}_label"] = np.nan
                                row[f"{dimension['name']}_index"] = np.nan
                                row[f"{dimension['name']}_description"] = np.nan
                        if dimension['justification'] and task_type_check:
                            if settings is not None:
                                if 'post_assessment' in settings.keys():
                                    if settings['post_assessment'] is not None:
                                        if 'attributes' in settings['post_assessment']:
                                            post_assessment_data = settings['post_assessment']['attributes']
                                            post_assessment_dimensions = settings['post_assessment']['dimensions']
                                            for assessment_data in post_assessment_data:
                                                post_assessment_index = assessment_data['index']
                                                for dimension_data in post_assessment_dimensions:
                                                    if dimension_data['name'] == dimension['name'] and post_assessment_index in dimension_data['indexes']:
                                                        # If the dimension appears in the first post-assessment, also the initial values must be stored
                                                        if post_assessment_index == 0:
                                                            justification = current_answers[f"{dimension['name']}_justification"].strip()
                                                            justification = re.sub('\n', '', justification)
                                                            row[f"{dimension['name']}_justification"] = justification
                                                        justification_post = current_answers[f"{dimension['name']}_justification_post_{post_assessment_index + 1}"].strip()
                                                        justification_post = re.sub('\n', '', justification_post)
                                                        row[f"{dimension['name']}_justification_post_{post_assessment_index}"] = justification_post
                                    else:
                                        justification = current_answers[f"{dimension['name']}_justification"].strip()
                                        justification = re.sub('\n', '', justification)
                                        row[f"{dimension['name']}_justification"] = justification
                                else:
                                    justification = current_answers[f"{dimension['name']}_justification"].strip()
                                    justification = re.sub('\n', '', justification)
                                    row[f"{dimension['name']}_justification"] = justification
                        else:
                            row[f"{dimension['name']}_justification"] = np.nan
                        if dimension['url'] and task_type_check:
                            try:
                                row[f"{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                            except KeyError:
                                console.print(f"[red]Key error while parsing values for: {dimension['name']}_url")
                            if settings is not None:
                                if 'post_assessment' in settings.keys():
                                    if settings['post_assessment'] is not None:
                                        if 'attributes' in settings['post_assessment']:
                                            post_assessment_data = settings['post_assessment']['attributes']
                                            post_assessment_dimensions = settings['post_assessment']['dimensions']
                                            for assessment_data in post_assessment_data:
                                                post_assessment_index = assessment_data['index']
                                                for dimension_data in post_assessment_dimensions:
                                                    if dimension_data['name'] == dimension['name'] and post_assessment_index in dimension_data['indexes']:
                                                        # If the dimension appears in the first post-assessment, also the initial values must be stored
                                                        if post_assessment_index == 0:
                                                            try:
                                                                row[f"{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                                                            except KeyError:
                                                                console.print(f"[red]Key error while parsing values for: {dimension['name']}_url")
                                                        row[f"{dimension['name']}_url_post_{post_assessment_index}"] = current_answers[f"{dimension['name']}_url_post_{post_assessment_index + 1}"]
                                        else:
                                            try:
                                                row[f"{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                                            except KeyError:
                                                console.print(f"[red]Key error while parsing values for: {dimension['name']}_url")
                                else:
                                    try:
                                        row[f"{dimension['name']}_url"] = current_answers[f"{dimension['name']}_url"]
                                    except KeyError:
                                        console.print(f"[red]Key error while parsing values for: {dimension['name']}_url")
                        else:
                            row[f"{dimension['name']}_url"] = np.nan

                    current_attributes = documents[document_data['serialization']['info']['index']].keys()
                    current_answers = document_data['serialization']['answers']
                    attributes_allowed = ['id', 'index']
                    for current_attribute in current_attributes:
                        attribute_name = current_attribute
                        current_attribute_value = documents[document_data['serialization']['info']['index']][current_attribute]
                        if current_attribute in attributes_allowed:
                            if current_attribute == 'id':
                                row[f"document_{current_attribute}"] = current_attribute_value
                            elif current_attribute == 'index':
                                row[f"document_{attribute_name}"] = int(current_attribute_value)
                            else:
                                row[f"{attribute_name}"] = current_attribute_value

                                # --- Pairwise selection columns (only for pairwise modality) ---
                                if settings is not None and settings.get('modality') == 'pairwise':
                                    doc_idx = document_data['serialization']['info']['index']
                                    subdocs = documents[doc_idx].get('subdocuments', []) if isinstance(documents[doc_idx], dict) else []
                                    subdoc_count = len(subdocs)

                                    # Defaults when not determinable
                                    row['pairwise_selected_index'] = np.nan
                                    row['pairwise_selected_label'] = np.nan

                                    # 1) Prefer compact numeric index if present & valid
                                    raw_selected_index = current_answers.get('pairwise_selected_index', None)
                                    selected_index: int | None = None
                                    try:
                                        if raw_selected_index is not None and str(raw_selected_index) != '':
                                            candidate = int(raw_selected_index)
                                            if candidate >= 0 and (subdoc_count == 0 or candidate < subdoc_count):
                                                selected_index = candidate
                                    except (TypeError, ValueError):
                                        selected_index = None

                                    # 2) Fallback: derive from element_<k>_selected flags (keep the first True)
                                    if selected_index is None:
                                        # Find all flags like element_0_selected, element_1_selected, ...
                                        flags: list[tuple[int, bool]] = []
                                        for key, val in current_answers.items():
                                            if isinstance(key, str) and key.startswith('element_') and key.endswith('_selected'):
                                                try:
                                                    k = int(key[len('element_'): -len('_selected')])
                                                except ValueError:
                                                    continue
                                                # Coerce truthiness in a tolerant way
                                                is_selected = (
                                                    (isinstance(val, bool) and val) or
                                                    (isinstance(val, (int, float)) and int(val) == 1) or
                                                    (isinstance(val, str) and val.strip().lower() in {'true', '1', 'yes', 'y'})
                                                )
                                                flags.append((k, is_selected))
                                        flags.sort(key=lambda t: t[0])
                                        first_true = next((k for k, is_sel in flags if is_sel), None)
                                        if first_true is not None and (subdoc_count == 0 or first_true < subdoc_count):
                                            selected_index = first_true

                                    # 3) Write columns if we found a valid selection
                                    if selected_index is not None:
                                        row['pairwise_selected_index'] = selected_index
                                        # Friendly label: A, B, C, ... (fallback to "#<n>" if beyond alphabet)
                                        alphabet = [chr(ord('A') + i) for i in range(26)]
                                        row['pairwise_selected_label'] = alphabet[selected_index] if selected_index < len(alphabet) else f'#{selected_index}'
                                # --- end pairwise selection columns ---

                    row["accesses"] = document_data['serialization']['accesses']

                    if not document_data['serialization']['timestamps_start']:
                        row["time_start"] = np.nan
                    else:
                        row["time_start"] = round(document_data['serialization']['timestamps_start'][0], 2)
                        row["time_start_parsed"] = find_date_string(datetime.fromtimestamp(float(row["time_start"]), timezone('GMT')).strftime('%c'))

                    if not document_data['serialization']['timestamps_end']:
                        row["time_end"] = np.nan
                    else:
                        row["time_end"] = round(document_data['serialization']['timestamps_end'][0], 2)
                        row["time_end_parsed"] = find_date_string(datetime.fromtimestamp(float(row["time_end"]), timezone('GMT')).strftime('%c'))

                    if not document_data['serialization']['timestamps_elapsed']:
                        row["time_elapsed"] = np.nan
                    else:
                        row["time_elapsed"] = round(document_data['serialization']['timestamps_elapsed'], 2)

                    if 'time_submit' in row:
                        df_answ = pd.concat([df_answ, pd.DataFrame([row])], ignore_index=True)

    if df_answ.shape[0] > 0:
        empty_cols = [
            col for col in df_answ.columns
            if df_answ[col].apply(lambda x: pd.isna(x) or x == []).all()
        ]
        if empty_cols:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_answ.drop(columns=empty_cols, inplace=True)
        df_answ["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_answ["paid"] = df_answ["paid"].astype(bool)
        df_answ["try_last"] = df_answ["try_last"].astype(int)
        df_answ["try_current"] = df_answ["try_current"].astype(int)
        df_answ["document_index"] = df_answ["document_index"].astype(int)
        df_answ["accesses"] = df_answ["accesses"].astype(int)
        df_answ["global_outcome"] = df_answ["global_outcome"].astype(bool)
        df_answ["global_form_validity"] = df_answ["global_form_validity"].astype(bool)
        df_answ["time_spent_check"] = df_answ["time_spent_check"].astype(bool)
        df_answ["gold_checks"] = df_answ["gold_checks"].astype(bool)
        df_answ.sort_values(by=['worker_id', 'time_submit_parsed'], inplace=True)
        df_answ.drop_duplicates(inplace=True)
        df_answ.to_csv(df_data_path, index=False)
        console.print(f"Dataframe shape: {df_answ.shape}")
        console.print(f"Workers data dataframe serialized at path: [cyan on white]{df_data_path}")
    else:
        console.print(f"Dataframe shape: {df_answ.shape}")
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
    columns.append("task_name")
    columns.append("batch_name")
    columns.append("unit_id")
    columns.append("try_last")
    columns.append("try_current")
    columns.append("time_submit")
    columns.append("time_submit_parsed")

    columns.append("document_index")
    columns.append("attribute_index")

    columns.append("note_version")
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
    columns.append("note_text_current_length")
    columns.append("note_text_raw_length")
    columns.append("note_text_left_length")
    columns.append("note_text_right_length")
    columns.append("note_offset")
    columns.append("note_existing_notes")

    return columns


df_notes = pd.DataFrame()

if not os.path.exists(df_notes_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)

            task = worker_snapshot['task']
            documents = worker_snapshot['documents']
            documents_answers = worker_snapshot['documents_answers']

            column_names = load_notes_col_names()

            for column in column_names:
                if column not in df_notes:
                    df_notes[column] = np.nan

            if len(documents_answers) > 0:

                row = {}
                row['worker_id'] = worker_id
                row['paid'] = worker_paid

                for attribute, value in task.items():
                    if attribute in column_names:
                        row[attribute] = value

                for document_data in documents_answers:

                    row['try_current'] = document_data['serialization']['info']['try']
                    row['time_submit'] = document_data['time_submit']
                    row['time_submit_parsed'] = find_date_string(row['time_submit'])

                    current_notes = document_data['serialization']['notes']

                    if len(current_notes) > 0:

                        for note_current in current_notes:
                            row['document_index'] = note_current['document_index']
                            row['attribute_index'] = note_current['attribute_index']
                            row['note_version'] = int(note_current['version'])
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
                            row['note_text_current_length'] = len(note_current['current_text'])
                            row['note_text_raw_length'] = len(note_current['raw_text'])
                            row['note_text_left_length'] = len(note_current['text_left'])
                            row['note_text_right_length'] = len(note_current['text_right'])
                            note_serialization = json.loads(note_current['serialization'])
                            row['note_offset'] = int(note_serialization['offset'])

                            if 'time_submit' in row:
                                df_notes = pd.concat([df_notes, pd.DataFrame([row])], ignore_index=True)

    if df_notes.shape[0] > 0:
        empty_cols = [col for col in df_notes.columns if df_notes[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_notes.drop(empty_cols, axis=1, inplace=True)
        df_notes["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_notes["paid"] = df_notes["paid"].astype(bool)
        df_notes["try_last"] = df_notes["try_last"].astype(int)
        df_notes["try_current"] = df_notes["try_current"].astype(int)
        df_notes["attribute_index"] = df_notes["attribute_index"].astype(int)
        df_notes["document_index"] = df_notes["document_index"].astype(int)
        df_notes["note_deleted"] = df_notes["document_index"].astype(bool)
        df_notes["note_ignored"] = df_notes["document_index"].astype(bool)
        df_notes["note_index_start"] = df_notes["note_index_start"].astype(int)
        df_notes["note_index_end"] = df_notes["note_index_end"].astype(int)
        df_notes["note_text_current_length"] = df_notes["note_text_current_length"].astype(int)
        df_notes["note_text_raw_length"] = df_notes["note_text_raw_length"].astype(int)
        df_notes["note_text_left_length"] = df_notes["note_text_left_length"].astype(int)
        df_notes["note_text_right_length"] = df_notes["note_text_right_length"].astype(int)
        df_notes.drop_duplicates(inplace=True)
        df_notes.sort_values(by=['worker_id', 'time_submit_parsed'], inplace=True)
        df_notes.to_csv(df_notes_path, index=False)
        console.print(f"Dataframe shape: {df_notes.shape}")
        console.print(f"Workers data dataframe serialized at path: [cyan on white]{df_notes_path}")
    else:
        console.print(f"Dataframe shape: {df_notes.shape}")
        console.print(f"Workers data dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:

    console.print(f"Workers dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_notes_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_dimensions_selection[/cyan on white] dataframe")
step_index = step_index + 1

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

df_dim_sel = pd.DataFrame(columns=[
    "worker_id",
    "paid",
    "task_name",
    "batch_name",
    "unit_id",
    'try_last',
    'try_current',
    'document_id',
    'document_index',
    'post_assessment',
    'dimension_index',
    'dimension_name',
    'timestamp_start',
    'timestamp_start_parsed',
    'selection_index',
    'selection_type',
    'selection_value',
    'selection_label',
    'selection_timestamp',
    'selection_timestamp_parsed',
    'selection_time_elapsed',
    'timestamp_end',
    'timestamp_end_parsed'
])
df_dim_sel['try_last'] = df_dim_sel['try_last'].astype(int)
df_dim_sel['try_current'] = df_dim_sel['try_current'].astype(int)


def parse_dimensions_selected(df, worker_id, worker_paid, task, info, documents, dimensions, dimensions_selected_data, timestamp_start, timestamp_end):
    for index_current, dimensions_selected in enumerate(dimensions_selected_data):

        for dimension_current in dimensions_selected['data']:
            dimension_data = dimensions[dimension_current['dimension']]

            timestamp_selection = float(dimension_current['timestamp'])
            timestamp_selection_parsed = datetime.fromtimestamp(timestamp_selection)
            timestamp_parsed_previous = timestamps_found[counter - 1]
            time_elapsed = (timestamp_selection_parsed - timestamp_parsed_previous).total_seconds()
            if time_elapsed < 0:
                time_elapsed = (timestamp_parsed_previous - timestamp_selection_parsed).total_seconds()
            timestamps_found.append(timestamp_selection_parsed)

            selection_type = np.nan
            selection_value = np.nan
            selection_label = np.nan
            if 'justification' in dimension_current.keys():
                selection_type = 'justification'
                selection_value = dimension_current['justification']
            if 'value' in dimension_current.keys():
                selection_value = dimension_current['value']
                if dimension_data['scale']:
                    selection_type = dimension_data['scale']['type']
                    if dimension_data['scale']['type'] == 'categorical':
                        for mapping in dimension_data['scale']['mapping']:
                            if int(mapping['value']) == int(dimension_current['value']):
                                selection_label = mapping['label']

            row = {
                'worker_id': worker_id,
                'paid': worker_paid,
                'task_name': task['task_name'],
                'batch_name': task['batch_name'],
                'unit_id': task['unit_id'],
                'try_last': task['try_last'],
                'try_current': info['try'],
                'document_index': dimension_current['document'],
                'post_assessment': int(dimension_current['post_assessment']) if 'post_assessment' in dimension_current.keys() else np.nan,
                'document_id': documents[dimension_current['document']]['id'],
                'dimension_index': dimension_current['dimension'],
                'dimension_name': dimension_data['name'],
                'timestamp_start': timestamp_start,
                'timestamp_start_parsed': find_date_string(timestamp_start, seconds=True),
                'selection_index': dimension_current['index'],
                'selection_type': selection_type,
                'selection_value': selection_value,
                'selection_label': selection_label,
                'selection_timestamp': dimension_current['timestamp'],
                'selection_timestamp_parsed': find_date_string(dimension_current['timestamp'], seconds=True),
                'selection_time_elapsed': time_elapsed,
                'timestamp_end': timestamp_end,
                'timestamp_end_parsed': find_date_string(timestamp_end, seconds=True)
            }
            df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)

    return df


if not os.path.exists(df_dim_path) and os.path.exists(df_data_path):

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)

            task = worker_snapshot['task']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            documents_answers = worker_snapshot['documents_answers']

            worker_data = df_data.loc[df_data['worker_id'] == worker_id]
            timestamp_start = worker_data['time_start'].min()
            timestamp_end = worker_data['time_start'].max()

            if len(documents_answers) > 0:

                timestamps_found = []

                for document_data in documents_answers:
                    timestamps_elapsed = document_data['serialization']["timestamps_elapsed"]
                    timestamps_start = document_data['serialization']["timestamps_start"]
                    timestamps_end = document_data['serialization']["timestamps_end"]
                    info = document_data['serialization']["info"]

                    timestamp_first = timestamp_start

                    timestamp_first_parsed = datetime.fromtimestamp(timestamp_first)
                    timestamps_found = [timestamp_first_parsed]

                    counter = 0

                    dimensions_selected_data = [document_data['serialization']["dimensions_selected"]]

                    df_dim_sel = parse_dimensions_selected(df_dim_sel, worker_id, worker_paid, task, info, documents, dimensions, dimensions_selected_data, timestamp_start, timestamp_end)

    df_dim_sel.drop_duplicates(inplace=True)

    if df_dim_sel.shape[0] > 0:
        empty_cols = [col for col in df_dim_sel.columns if df_dim_sel[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_dim_sel.drop(empty_cols, axis=1, inplace=True)
        df_dim_sel["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_dim_sel["paid"] = df_dim_sel["paid"].astype(bool)
        df_dim_sel["try_last"] = df_dim_sel["try_last"].astype(int)
        df_dim_sel["try_current"] = df_dim_sel["try_current"].astype(int)
        df_dim_sel.drop_duplicates(inplace=True)
        df_dim_sel.sort_values(by=['worker_id', 'selection_timestamp_parsed'], inplace=True)
        df_dim_sel.to_csv(df_dim_path, index=False)
        console.print(f"Dataframe shape: {df_dim_sel.shape}")
        console.print(f"Dimension analysis dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {df_dim_sel.shape}")
        console.print(f"Dimension analysis dataframe [yellow]empty[/yellow], dataframe not serialized.")
else:
    console.print(f"Dimensions analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_dim_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_urls[/cyan on white] dataframe")
step_index = step_index + 1

if os.path.exists(df_data_path):
    df_data = pd.read_csv(df_data_path)

df_urls = pd.DataFrame(columns=[
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
    "query_text_encoded",
    "query_timestamp",
    "query_timestamp_parsed",
    "query_estimated_matches",
    "results_retrieved",
    "results_to_skip",
    "results_amount",
    "page_index",
    "page_size",
    "response_index",
    "response_url",
    "response_name",
    "response_snippet",
    "response_uuid",
    "index_selected",
    'response_visited'
])
df_urls['try_last'] = df_urls['try_last'].astype(float)
df_urls['try_current'] = df_urls['try_current'].astype(float)


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
                "query_index": response_retrieved['query'],
                "query_estimated_matches": response_retrieved['estimated_matches'] if 'estimated_matches' in response_retrieved.keys() else np.nan,
                "results_retrieved": response_retrieved['results_retrieved'] if 'results_retrieved' in response_retrieved.keys() else np.nan,
                "results_to_skip": response_retrieved['results_to_skip'] if 'results_to_skip' in response_retrieved.keys() else np.nan,
                "results_amount": response_retrieved['results_amount'] if 'results_amount' in response_retrieved.keys() else np.nan,
                "page_index": response_retrieved['page_index'] if 'page_index' in response_retrieved.keys() else np.nan,
                "page_size": response_retrieved['page_size'] if 'page_size' in response_retrieved.keys() else np.nan
            }
            query_text = np.nan
            query_text_encoded = np.nan

            if type(queries) == list:
                for query in queries[int(response_retrieved['document'])]["data"]:
                    if response_retrieved["query"] == query['index']:
                        query_text = query["text"]
                        query_text_encoded = query["textEncoded"]
            else:
                for query in queries["data"]:
                    if response_retrieved["query"] == query['index']:
                        query_text = query["text"]
                        if 'textEncoded' in query.keys():
                            query_text_encoded = query["textEncoded"]
            row['query_text'] = query_text
            row['query_text_encoded'] = query_text_encoded
            row['query_timestamp'] = response_retrieved['timestamp']
            row['query_timestamp_parsed'] = find_date_string(datetime.fromtimestamp(float(response_retrieved['timestamp']), timezone('GMT')).strftime('%c'))
            for response_index, response in enumerate(response_retrieved['response']):

                response_index_full = response_index
                if 'results_to_skip' in response_retrieved.keys():
                    response_index_full = response_index_full + response_retrieved['results_to_skip']

                row["response_index"] = response_index_full
                row["response_url"] = response["url"]
                row["response_name"] = response["name"]
                row["response_snippet"] = response["snippet"]
                row["response_visited"] = response["visited"]

                if 'parameters' in response.keys():
                    for parameter, value in response['parameters'].items():
                        if f"param_{parameter}" not in df.columns:
                            if "date_last_crawled" in parameter:
                                df[f"param_{parameter}_parsed"] = np.nan
                            df[f"param_{parameter}"] = np.nan
                        row[f"param_{parameter}"] = value
                        if "date_last_crawled" in parameter:
                            try:
                                date_parsed = ' '.join(find_date_string(datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")).split(' ')[:2])
                                df[f"param_{parameter}_parsed"] = date_parsed
                            except ValueError:
                                # Result returned from Bing Web Search API
                                truncated_date_string = value[:-4] + value[-1]  # Truncate the last three zeros
                                date_parsed = ' '.join(find_date_string(str(datetime.strptime(truncated_date_string, "%Y-%m-%dT%H:%M:%S.%fZ"))).split(' ')[:2])
                                df[f"param_{parameter}_parsed"] = date_parsed

                row["index_selected"] = -1
                row_check = df.loc[
                    (df["worker_id"] == row["worker_id"]) &
                    (df["try_last"] == task['try_last']) &
                    (df["try_current"] == row["try_current"]) &
                    (df["document_index"] == row["document_index"]) &
                    (df["dimension_index"] == row["dimension_index"]) &
                    (df["query_index"] == row["query_index"]) &
                    (df["query_timestamp"] == row["query_timestamp"]) &
                    (df["response_index"] == response_index_full)
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

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)

            task = worker_snapshot['task']
            dimensions = worker_snapshot['dimensions']
            documents = worker_snapshot['documents']
            questionnaires_answers = worker_snapshot['questionnaires_answers']
            documents_answers = worker_snapshot['documents_answers']

            if len(documents_answers) > 0:

                for document_data in documents_answers:
                    info = document_data['serialization']['info']
                    queries = document_data['serialization']['queries']
                    responses_retrieved = [document_data['serialization']['responses_retrieved']]
                    responses_selected = [document_data['serialization']['responses_selected']]

                    df_urls = parse_responses(df_urls, worker_id, worker_paid, task, info, queries, responses_retrieved, responses_selected)

    df_urls.drop_duplicates(inplace=True)
    unique_urls = np.unique(df_urls['response_url'].values)
    console.print(f"Generating UUIDs for {len(unique_urls)} unique URLs")
    for url in tqdm(unique_urls):
        df_urls.loc[df_urls['response_url'] == url, 'response_uuid'] = uuid.uuid4()

    if df_urls.shape[0] > 0:
        empty_cols = [col for col in df_urls.columns if df_urls[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
        df_urls.drop(empty_cols, axis=1, inplace=True)
        df_urls["paid"].replace({0.0: False, 1.0: True}, inplace=True)
        df_urls["paid"] = df_urls["paid"].astype(bool)
        df_urls["try_last"] = df_urls["try_last"].astype(int)
        df_urls["try_current"] = df_urls["try_current"].astype(int)
        df_urls.drop_duplicates(inplace=True)
        df_urls.sort_values(by=['worker_id', 'query_timestamp_parsed'], inplace=True)
        df_urls.to_csv(df_url_path, index=False)
        console.print(f"Dataframe shape: {df_urls.shape}")
        console.print(f"Worker urls dataframe serialized at path: [cyan on white]{df_dim_path}")
    else:
        console.print(f"Dataframe shape: {df_urls.shape}")
        console.print(f"Worker urls dataframe [yellow]empty[/yellow], dataframe not serialized.")

else:
    console.print(f"URL analysis dataframe [yellow]already detected[/yellow], skipping creation")
    console.print(f"Serialized at path: [cyan on white]{df_url_path}")

console.rule(f"{step_index} - Building [cyan on white]workers_logs[/cyan on white] Dataframe")
step_index = step_index + 1

column_names = [
    "worker_id",
    "paid",
    "task_name",
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

    for index, acl_record in tqdm(df_acl.iterrows(), total=df_acl.shape[0]):

        worker_id = acl_record['worker_id']
        worker_snapshot = find_snapshot_for_record(acl_record, include_empty=True)

        if worker_snapshot is not None:

            worker_paid = check_worker_paid(worker_snapshot)
            task = worker_snapshot['task']
            logs = worker_snapshot['logs']

            df_logs_part_path = f"{df_log_partial_folder_path}{worker_id}.csv"
            df_logs_part = pd.DataFrame(columns=column_names)
            if os.path.exists(df_logs_part_path):
                df_logs_part = pd.read_csv(df_logs_part_path)

            existing_snapshot_records = df_logs_part.loc[
                (df_logs_part['worker_id'] == acl_record['worker_id']) &
                (df_logs_part['task_name'] == acl_record['task_name']) &
                (df_logs_part['batch_name'] == acl_record['batch_name']) &
                (df_logs_part['unit_id'] == acl_record['unit_id'])
                ]

            if len(logs) > 0 and existing_snapshot_records.shape[0] <= 0:

                task_started = True

                for data_log in logs:

                    row = {
                        'worker_id': worker_id,
                        'paid': worker_paid,
                        'task_name': data_log['task'],
                        'batch_name': data_log['batch'],
                        'unit_id': data_log['unit_id'],
                        'task_started': task_started,
                        'sequence': data_log['sequence'],
                        'time_server': data_log['time_server'],
                        'time_server_parsed': find_date_string(datetime.fromtimestamp(float(data_log['time_server']) / 1000, timezone('GMT')).strftime('%c')),
                        'time_client': data_log['time_client'],
                        'time_client_parsed': find_date_string(datetime.fromtimestamp(float(data_log['time_client']) / 1000, timezone('GMT')).strftime('%c')),
                        'type': data_log['type'],
                    }

                    log_details = data_log['details']

                    if log_details:
                        if data_log['type'] == 'keySequence':
                            if 'log_section' not in df_logs_part.columns:
                                df_logs_part['log_section'] = np.nan
                            if 'log_key_sequence_index' not in df_logs_part.columns:
                                df_logs_part['log_key_sequence_index'] = np.nan
                            if 'log_key_sequence_timestamp' not in df_logs_part.columns:
                                df_logs_part['log_key_sequence_timestamp'] = np.nan
                            if 'log_key_sequence_key' not in df_logs_part.columns:
                                df_logs_part['log_key_sequence_key'] = np.nan
                            if 'log_sentence' not in df_logs_part.columns:
                                df_logs_part['log_sentence'] = np.nan
                            row['log_section'] = log_details['section']
                            row['log_sentence'] = log_details['sentence']
                            for index, key_sequence in enumerate(log_details['keySequence']):
                                row['log_key_sequence_index'] = index
                                row['log_key_sequence_timestamp'] = key_sequence['timeStamp']
                                row['log_key_sequence_key'] = key_sequence['key'] if 'key' in key_sequence else np.nan
                                df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'movements':
                            for attribute, value in log_details.items():
                                attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                attribute_parsed = f"log_{attribute_parsed}"
                                if type(value) != dict and type(value) != list:
                                    if attribute_parsed not in df_logs_part.columns:
                                        df_logs_part[attribute_parsed] = np.nan
                                    row[attribute_parsed] = value
                            for movement_data in log_details['points']:
                                for attribute, value in movement_data.items():
                                    attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                    if type(value) == dict:
                                        for attribute_sub, value_sub in value.items():
                                            attribute_sub_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute_sub).lower()
                                            attribute_sub_parsed = f"log_point_{attribute_parsed}_{attribute_sub_parsed}"
                                            if attribute_sub_parsed not in df_logs_part.columns:
                                                df_logs_part[attribute_sub_parsed] = np.nan
                                            row[attribute_sub_parsed] = value_sub
                                    else:
                                        attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                        attribute_parsed = f"log_point_{attribute_parsed}"
                                        if attribute_parsed not in df_logs_part.columns:
                                            df_logs_part[attribute_parsed] = np.nan
                                        row[attribute_parsed] = value
                                df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'click':
                            for attribute, value in log_details.items():
                                attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                attribute_parsed = f"log_{attribute_parsed}"
                                if type(value) != dict and type(value) != list:
                                    if attribute_parsed not in df_logs_part.columns:
                                        df_logs_part[attribute_parsed] = np.nan
                                    row[attribute_parsed] = value
                            for attribute, value in log_details['target'].items():
                                attribute_parsed = re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()
                                attribute_parsed = f"log_target_{attribute_parsed}"
                                if attribute_parsed not in df_logs_part.columns:
                                    df_logs_part[attribute_parsed] = np.nan
                                row[attribute_parsed] = value
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'queryResults':
                            if 'log_section' not in df_logs_part.columns:
                                df_logs_part['log_section'] = np.nan
                            if 'log_url_amount' not in df_logs_part.columns:
                                df_logs_part['log_url_amount'] = np.nan
                            row['log_section'] = log_details['section']
                            if 'urlAmount' in log_details:
                                row['log_url_amount'] = log_details['urlAmount']
                            else:
                                row['log_url_amount'] = len(log_details['urlArray'])
                        elif data_log['type'] == 'copy' or data_log['type'] == 'cut':
                            for attribute, value in log_details.items():
                                attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                if attribute_parsed not in df_logs_part.columns:
                                    df_logs_part[attribute_parsed] = np.nan
                                if attribute_parsed == 'target':
                                    row[attribute_parsed] = value.replace("\n", '')
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'context':
                            for detail_kind, detail_val in log_details.items():
                                detail_kind_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', detail_kind).lower()}"
                                if detail_kind_parsed not in df_logs_part.columns:
                                    df_logs_part[detail_kind_parsed] = np.nan
                                if type(detail_val) == str:
                                    detail_val.replace('\n', '')
                                row[detail_kind_parsed] = detail_val
                            df_logs_part.loc[len(df_logs_part)] = row
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
                                if attribute_parsed not in df_logs_part.columns:
                                    df_logs_part[attribute_parsed] = np.nan
                                row[attribute_parsed] = value
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'selection':
                            for attribute, value in log_details.items():
                                attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                if attribute_parsed not in df_logs_part.columns:
                                    df_logs_part[attribute_parsed] = np.nan
                                if attribute_parsed == 'selected':
                                    row[attribute_parsed] = value.replace("\n", '')
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'paste' or data_log['type'] == 'text':
                            for attribute, value in log_details.items():
                                attribute_parsed = f"log_{re.sub(r'(?<!^)(?=[A-Z])', '_', attribute).lower()}"
                                if attribute_parsed not in df_logs_part.columns:
                                    df_logs_part[attribute_parsed] = np.nan
                                if attribute_parsed == 'text':
                                    row[attribute_parsed] = value.replace("\n", '')
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'query':
                            if 'log_section' not in df_logs_part.columns:
                                df_logs_part['log_section'] = np.nan
                            if 'log_query' not in df_logs_part.columns:
                                df_logs_part['log_query'] = np.nan
                            row['log_section'] = log_details['section']
                            row['log_query_text'] = log_details['query']['text']
                            row['log_query_text_encoded'] = log_details['query']['encoded']
                            df_logs_part.loc[len(df_logs_part)] = row
                        elif data_log['type'] == 'linkVisited':
                            if 'log_section' not in df_logs_part.columns:
                                df_logs_part['log_section'] = np.nan
                            row['log_section'] = log_details['section']
                            df_logs_part.loc[len(df_logs_part)] = row
                        else:
                            print(data_log['type'])
                            print(log_details)
                            assert False
                    df_logs_part.loc[len(df_logs_part)] = row

            if len(df_logs_part) > 0:
                os.makedirs(df_log_partial_folder_path, exist_ok=True)
                df_logs_part.to_csv(df_logs_part_path, index=False)

    dataframes_partial = []
    df_partials_paths = glob(f"{df_log_partial_folder_path}/*")

    console.print(f"Merging together {len(df_partials_paths)} partial log dataframes")

    for df_partial_path in tqdm(df_partials_paths):
        partial_df = pd.read_csv(df_partial_path)
        if partial_df.shape[0] > 0:
            dataframes_partial.append(partial_df)
    if len(dataframes_partial) > 0:
        dataframe = pd.concat(dataframes_partial, ignore_index=True)
        empty_cols = [col for col in dataframe.columns if dataframe[col].isnull().all()]
        if len(empty_cols) > 0:
            console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
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

if enable_crawling:

    console.rule(f"{step_index} - Crawling Search Results")
    step_index = step_index + 1

    if os.path.exists(df_url_path):

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
            for index, row_url in tqdm(df_url.iterrows(), total=df_url.shape[0]):
                tasks.append(asyncio.create_task(get(row_url)))

            console.print("Processing asynchronous requests")
            for request_current in tqdm(asyncio.as_completed(tasks), total=len(tasks)):
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
                    'response_timestamp_parsed': find_date_string(datetime.fromtimestamp(timestamp_now).strftime('%c')),
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
            df_crawl_correct = df_crawl[df_crawl["response_error_code"].isnull()]
            df_crawl_incorrect = df_crawl[df_crawl["response_error_code"] != np.nan]
            empty_cols = [col for col in df_crawl.columns if df_crawl[col].isnull().all()]
            if len(empty_cols) > 0:
                console.print(f"Dropping unused columns: [yellow]{', '.join(empty_cols)}")
            df_crawl.drop(empty_cols, axis=1, inplace=True)
            df_crawl.drop_duplicates(inplace=True)
            df_crawl.to_csv(df_crawl_path, index=False)
            console.print(f"Pages correctly crawled: [green]{len(df_crawl_correct)}/{unique_urls_amount}[/green] [cyan]({(len(df_crawl_correct) / unique_urls_amount) * 100}%)")
            console.print(f"Dataframe shape: {df_crawl.shape}")
            console.print(f"Worker crawling dataframe serialized at path: [cyan on white]{df_crawl_path}")
        else:
            console.print(f"Dataframe shape: {df_crawl.shape}")
            console.print(f"Worker crawling dataframe [yellow]empty[/yellow], dataframe not serialized.")

    else:
        console.print(f"Crawling [yellow]was not performed[/yellow]; there are no URLs retrieved from the results.")

else:
    console.print(f"Worker URLs crawling [yellow]not enabled[/yellow], skipping")
