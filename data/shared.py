import json
import os
import collections
import re
import numpy as np
import datefinder
import string
import random
from datetime import datetime
from rich.console import Console

console = Console()


def serialize_json(folder, filename, data, enc='utf-8'):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    console.print(f"Serialized at path: [cyan]{folder}{filename}[/cyan]")
    with open(f"{folder}{filename}", 'w', encoding=enc) as f:
        json.dump(data, f, ensure_ascii=False, indent=4, default=str)
        f.close()


def remove_json(folder, filename):
    path = f"{folder}{filename}"
    os.remove(path)


def read_json(p, enc='utf-8'):
    if os.path.exists(p):
        with open(p, "r", encoding=enc) as f:
            d = json.load(f)
        return d
    else:
        return {}


def random_string(length=11):
    letters = string.ascii_uppercase
    return ''.join(random.choice(letters) for i in range(length))


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
    if type(date) is int or type(date) is float or type(date) is np.float64 or type(date) is np.float32:
        if seconds:
            date_raw = str(datetime.fromtimestamp(date))
        else:
            date_raw = str(datetime.fromtimestamp(date // 1000))
    else:
        date_raw = date
    dates_found = []
    date_parsed = datefinder.find_dates(date_raw, strict=True)
    for date_current in date_parsed:
        dates_found.append(str(date_current))
    if len(dates_found) > 1:
        console.print(f"[yellow] Multiple dates found for {' '.join(dates_found)}")
    for date_current in dates_found:
        if '+' in date_current:
            date_parts = date_current.split("+")
            date_current = ' '.join(date_parts)
        return date_current


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


def handle_aws_error(error):
    console.rule(f"AWS SDK Error Start", style="red")
    console.print(f"Boto3 Code: [blue]{error['Error']['Code']}")
    console.print(f"HTTPS Code: [blue]{error['ResponseMetadata']['HTTPStatusCode']}")
    if error['Error']['Code'] == 'RequestError':
        console.print(f"MTurk Code: [yellow]{error['TurkErrorCode']}")
        console.print(f"Message: [yellow]{error['Error']['Message']}")
    else:
        console.print("Note: [yellow]: this error has not been handled explicitly, please report its code.")
    console.rule(f"AWS SDK Error End", style="red")


def rename_dict_key(dict, key_new, key_old):
    if key_old in dict:
        dict[key_new] = dict.pop(key_old)


def move_dict_key(dict_from, dict_to, key_old, key_new):
    if key_old in dict_from:
        if key_new not in dict_to:
            dict_to[key_new] = dict_from.pop(key_old)
        else:
            dict_from.pop(key_old)
    return key_old
