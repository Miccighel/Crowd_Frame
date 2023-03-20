import json
import os
from rich.console import Console

console = Console()


def serialize_json(folder, filename, data):
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    console.print(f"Serialized at path: [cyan]{folder}{filename}[/cyan]")
    with open(f"{folder}{filename}", 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4, default=str)
        f.close()


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
