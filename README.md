# Crowd_Frame

<!-- Language/Framework badges -->
![Angular](https://badges.aleen42.com/src/angular.svg)
![Python](https://badges.aleen42.com/src/python.svg)

<!-- Project status badges -->
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity)
![Maintainer](https://img.shields.io/badge/maintainer-Miccighel-blue)
[![License](https://img.shields.io/github/license/Miccighel/Crowd_Frame)](LICENSE)

<!-- CI / Release -->
[![CI](https://github.com/Miccighel/Crowd_Frame/actions/workflows/ci.yml/badge.svg)](https://github.com/Miccighel/Crowd_Frame/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Miccighel/Crowd_Frame)](https://github.com/Miccighel/Crowd_Frame/releases)
[![Downloads](https://img.shields.io/github/downloads/Miccighel/Crowd_Frame/total.svg)](https://GitHub.com/Miccighel/Crowd_Frame/releases/)

<!-- GitHub stats -->
[![GitHub stars](https://badgen.net/github/stars/Miccighel/Crowd_Frame)](https://GitHub.com/Miccighel/Crowd_Frame/stargazers/)
[![GitHub watchers](https://badgen.net/github/watchers/Miccighel/Crowd_Frame/)](https://GitHub.com/Miccighel/Crowd_Frame/watchers/)
[![GitHub contributors](https://img.shields.io/github/contributors/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/graphs/contributors/)
[![GitHub issues](https://img.shields.io/github/issues/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues/)
[![GitHub issues-closed](https://img.shields.io/github/issues-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues?q=is%3Aissue+is%3Aclosed)
[![GitHub pull-requests](https://img.shields.io/github/issues-pr/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/)
[![GitHub pull-requests closed](https://img.shields.io/github/issues-pr-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

![GitHub Contributors Image](https://contrib.rocks/image?repo=Miccighel/Crowd_Frame)

:star: Star us on GitHub — it motivates us a lot!

### A software system that lets you design and deploy diverse types of crowdsourcing tasks.

[![ForTheBadge built-with-science](http://ForTheBadge.com/images/badges/built-with-science.svg)](https://GitHub.com/Miccighel/Crowd_Frame)

## Table of Contents

<ul>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#quickstart">Quickstart</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#environment-variables">Environment Variables</a></li>
    <li><a href="#task-configuration">Task Configuration</a></li>
    <li><a href="#hits-allocation">HITs Allocation</a></li>
    <li><a href="#quality-checks">Quality Checks</a></li>
    <li><a href="#local-development">Local Development</a></li>
    <li><a href="#task-performing">Task Performing</a></li>
    <li><a href="#task-results">Task Results</a></li>
    <li><a href="#faq--troubleshooting">FAQ & Troubleshooting</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#original-article">Original Article</a></li>
</ul>

## Prerequisites

- **AWS CLI v2**
- **Node.js 20 LTS**
- **Yarn** (via Corepack)
- **Python 3.8+**
- **Docker** *(optional; only if `enable_solver=true`)*

**AWS:** use a profile that can create/use **S3**, **DynamoDB**, and **CloudWatch Logs**:
```bash
aws configure --profile your_iam_user
aws sts get-caller-identity --profile your_iam_user
```

## Quickstart

```bash
# 1) Clone and enter the repo
git clone https://github.com/Miccighel/Crowd_Frame.git
cd Crowd_Frame

# 2) Enable Yarn via Corepack and install deps
corepack enable
yarn install --immutable

# 3) Prepare env and initialize
cd data
cp .env.example .env   # or create .env as shown below
python init.py

# 4) (Optional) sanity checks
aws --version; node -v; yarn -v; python --version

# 5) Open the deployed task
# https://<deploy_bucket>.s3.<region>.amazonaws.com/<task_name>/<batch_name>/index.html
```

See task examples: [`examples/`](https://github.com/Miccighel/Crowd_Frame/tree/master/examples)

## Getting Started

1. Create an [AWS account](https://aws.amazon.com/it/).
2. Create a new [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) `your_iam_user`.
3. Attach the `AdministratorAccess` policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow", "Action": "*", "Resource": "*" }]
   }
   ```

4. Generate an access key pair.
5. Save the access key in your AWS **credentials** file.

    - **Windows**: `C:\Users\<your_os_user>\.aws\credentials`
    - **macOS/Linux**: `~/.aws/credentials`

   ```ini
   [your_iam_user]
   aws_access_key_id=your_key
   aws_secret_access_key=your_secret
   ```

6. Clone the repo: [Miccighel/Crowd_Frame](https://github.com/Miccighel/Crowd_Frame).
7. Enable Yarn via Corepack:

   ```bash
   corepack enable
   ```

8. Go to the repo folder:

   ```bash
   cd ~/path/to/project
   ```

9. Install dependencies:

   ```bash
   yarn install --immutable
   ```

10. Go to the `data` folder:
    ```bash
    cd data
    ```

11. Create the `.env` file (make sure the name is exactly `.env`, no hidden extensions).  
    Path: `your_repo_folder/data/.env`


12. Add the required environment variables:

    ```ini
    mail_contact=your_email_address
    budget_limit=your_usd_budget_limit
    task_name=your_task_name
    batch_name=your_batch_name
    admin_user=your_admin_username
    admin_password=your_admin_password
    server_config=none
    aws_region=your_aws_region
    aws_private_bucket=your_private_bucket_name
    aws_deploy_bucket=your_deploy_bucket_name
    ```

13. Install Python packages:

    ```bash
    pip install -r ../requirements.txt
    # (or: pip install -r your_repo_folder/requirements.txt)
    ```

14. Run the initializer:

    ```bash
    python init.py
    ```

    This script will:
    - read your environment variables,
    - set up the AWS infrastructure,
    - generate an empty task configuration,
    - deploy the task to the public bucket.


15. Open your task:

    ```
    https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html
    ```

Crowd_Frame uses several AWS services to deploy tasks and store data; all are within the AWS Free Tier.  
You can cap spending via the `budget_limit` environment variable—usage is halted once the limit is reached.

## Environment Variables

The following table lists the variables you can set in `your_repo_folder/data/.env`.

|          Variable          | Description                                                                              | Mandatory | Value                                 |
|:--------------------------:|:-----------------------------------------------------------------------------------------|:---------:|:--------------------------------------|
|       `profile_name`       | IAM profile name created in Step 2. Defaults to `default` if unspecified.                |     ❌     | `your_iam_user`                       |
|       `mail_contact`       | Contact email for AWS budget notifications.                                              |     ✅     | Valid email address                   |
|         `platform`         | Deployment platform. Use `none` for manual recruitment.                                  |     ✅     | `none`, `mturk`, `prolific`, `toloka` |
|       `budget_limit`       | Monthly budget cap in USD (e.g., `5.0`).                                                 |     ✅     | Positive float                        |
|        `task_name`         | Task identifier.                                                                         |     ✅     | Any string                            |
|        `batch_name`        | Batch identifier.                                                                        |     ✅     | Any string                            |
|        `task_title`        | Custom task title.                                                                       |     ❌     | Any string                            |
|       `batch_prefix`       | Prefix to group/filter multiple batches.                                                 |     ❌     | Any string                            |
|        `admin_user`        | Admin username.                                                                          |     ✅     | Any string                            |
|      `admin_password`      | Admin password.                                                                          |     ✅     | Any string                            |
|        `aws_region`        | AWS region (e.g., `us-east-1`).                                                          |     ✅     | Valid region                          |
|    `aws_private_bucket`    | Private S3 bucket for configuration and data.                                            |     ✅     | Unique string                         |
|    `aws_deploy_bucket`     | Public S3 bucket used to deploy the task.                                                |     ✅     | Unique string                         |
|    `aws_dataset_bucket`    | Optional S3 bucket for additional datasets.                                              |     ❌     | Unique string                         |
|      `server_config`       | Worker logging backend: `aws` (managed), `custom` (your endpoint), or `none` (disabled). |     ✅     | `aws`, `custom`, `none`               |
|      `enable_solver`       | Enable the local HIT solver (automatic allocation). Requires Docker.                     |     ❌     | `true` or `false`                     |
|     `enable_crawling`      | Enable crawling of search results retrieved in-task.                                     |     ❌     | `true` or `false`                     |
| `prolific_completion_code` | Prolific study completion code (required if `platform=prolific`).                        |     ❌     | String                                |
|    `toloka_oauth_token`    | Toloka API token (required if `platform=toloka` and you use API operations).             |     ❌     | String                                |
|      `ip_info_token`       | Token for `ipinfo.com`.                                                                  |     ❌     | String                                |
|  `ip_geolocation_api_key`  | API key for `ipgeolocation.io`.                                                          |     ❌     | String                                |
|      `ipapi_api_key`       | API key for `ipapi.com`.                                                                 |     ❌     | String                                |
|     `user_stack_token`     | API key for `userstack.com` (user-agent parsing).                                        |     ❌     | String                                |
|       `bing_api_key`       | API key for Bing Web Search.                                                             |     ❌     | String                                |

## Task Configuration

Use the Generator (admin panel) to configure your deployed task:

1. Open the admin panel by appending `?admin=true` to the task URL, e.g.  
   `https://<deploy_bucket>.s3.<region>.amazonaws.com/<task_name>/<batch_name>/?admin=true`
2. Click **Generate** to open the login form.
3. Sign in with the admin credentials from `data/.env` (`admin_user`, `admin_password`).
4. Go through each configuration step and upload the final configuration.

### Step Overview

1. **Questionnaires** — Create one or more pre/post questionnaires workers complete before or after the task.
2. **Evaluation Dimensions** — Define what each worker will assess for every HIT element.
3. **Task Instructions** — Provide general instructions shown before the task starts.
4. **Evaluation Instructions** — Provide in-task instructions shown while workers perform the task.
5. **Search Engine** — Choose the search provider and (optionally) filter domains from results.
6. **Task Settings** — Configure max tries, time limits (`time_assessment`), and the annotation interface; also **upload the HITs file** for the task.
7. **Worker Checks** — Configure additional checks on workers.

The following table details the content of each configuration file.

|              File              |                            Description                             |
|:------------------------------:|:------------------------------------------------------------------:|
|          `hits.json`           |            Contains the whole set of HITs of the task.             |
|     `questionnaires.json`      |     Contains the definition of each questionnaire of the task.     |
|       `dimensions.json`        | Contains the definitions of each evaluation dimension of the task. |
|  `instructions_general.json`   |           Contains the general instructions of the task.           |
| `instructions_evaluation.json` |         Contains the evaluation instructions of the task.          |
|      `search_engine.json`      |      Contains the configuration of the custom search engine.       |
|          `task.json`           |           Contains several general settings of the task.           |
|         `workers.json`         |      Contains settings concerning worker access to the task.       |

> **Note — Blocking & reset:** Crowd_Frame enforces limits via a DynamoDB **ACL**. Workers are blocked if they exceed max tries or the time limit (`time_assessment`). For testing, use a **high `time_assessment`** to avoid accidental blocks. To reset, **clear the task’s ACL records** — this **irreversibly deletes access history**, so use only when starting from a clean slate.

## HITs Allocation

The HITs for a crowdsourcing task designed and deployed using Crowd_Frame must be stored in a special JSON file.
Such a file can be manually uploaded when configuring the crowdsourcing task itself.
The file must comply with a special format that satisfies 5 requirements:

1. There must be an array of HITs (also called _units_);
2. Each HIT must have a _unique_ input token attribute;
3. Each HIT must have a _unique_ output token attribute;
4. The number of elements for each HIT must be specified for each HIT;
5. Each element must have an attribute named `id`
6. Each element can have an arbitrary number of attributes.

The following fragment shows a valid configuration of a crowdsourcing task with 1 HIT.

````json
[
    {
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
    }
]
````

Note that:

1. Initially the deploy script creates an empty configuration
2. You can upload the HITs during configuration step 6

### Manual Allocation

HITs can also be built manually.  
Start by choosing an attribute whose values divide the dataset into classes.  
Pools of elements are then created, one per class, and four parameters are defined:

1. total number of elements to allocate,
2. number of elements per HIT,
3. number of elements per class,
4. number of repetitions per element.

Each pool is updated to include the required repetitions. HITs are then built iteratively by sampling elements from each class until a duplicate-free sample is obtained. Selected elements are removed
from the pool once used. The total number of HITs is determined by these parameters.  
The allocation matrix can be serialized for later reference, and the final HITs exported in the required format.

The first algorithm below shows the main allocation procedure, while the second details the `singleHIT(...)` sub-procedure used to sample a set of unique elements.  
If $n$ elements must be allocated into HITs of $k$ positions, each repeated $p$ times, the total number of HITs is:

$m = \frac{n \cdot p}{k}$

```pseudo
Algorithm: Allocate dataset into HITs

elementsFiltered ← filterElements(attribute, valuesChosen)
classes ← valuesChosen
pools ← List()

for class in classes do
    elementsClass ← findElements(elementsFiltered, class)
    pool ← unique(elementsClass)
    pools.append(pool)
end for

totalElements ← len(elementsFiltered)
classElementsNumber ← len(classes)
hitElementsNumber ← k
repetitionsElement ← p

for pool in pools do
    pool ← extendPool(repetitionsElement)
end for

poolsDict ← mergePools(pools, classes)
hits ← List()

for index in range((totalElements * repetitionsElement) / hitElementsNumber) do
    hitSample ← singleHit(poolsMerged)
    hitSample ← shuffle(hitSample)
    hits.append(hitSample)
end for

hits.serialize(pathAssignments)
hitsFinal ← List()

for hit in hits do
    index ← index(hit)
    unitId ← concat("unit_", index)
    tokenInput ← randomString(11)
    tokenOutput ← randomString(11)
    hitObject ← BuildJSON(unitId, tokenInput, tokenOutput, hitElementsNumber)

    for indexElem in range(hitElementsNumber) do
        hitObject["documents"] ← hits[indexElem]
    end for

    hitsFinal.append(hitObject)
end for

hitsFinal.serialize(pathHits)
```

```pseudo
Algorithm: singleHIT (sample without duplicates)

containsDuplicates ← True
while containsDuplicates do
    sample ← List()

    for class in classes do
        for indexClass in range(classElementsNumber) do
            element ← random(poolsDict[class])
            sample.append(element)
        end for
    end for

    if checkDuplicates(sample) == False then
        containsDuplicates ← False
    end if
end while

for s in sample do
    for c in classes do
        if s ∈ pool[c] then
            pool[c].remove(s)
        end if
    end for
end for

return sample
```

## Quality Checks

Crowd_Frame supports **custom quality checks** per evaluation dimension (enable them in the configuration).
Implement your logic in the static method `performGoldCheck` located at:
`data/build/skeleton/goldChecker.ts`.

Quality checks run **only** on elements marked as gold. Mark an element by **prefixing its `id` with `GOLD`**. Below, the second document in a HIT is marked for the check.

The second snippet shows the **default checker** generated by the initializer. `goldConfiguration` is an array where each entry contains the gold `document`, the worker `answers` for dimensions with
checks enabled, and optional `notes`. Write your control between the two comment blocks; return `true` for a pass, `false` for a fail (one boolean per gold element).

````json
[
    {
        "unit_id": "unit_0",
        "token_input": "ABCDEFGHILM",
        "token_output": "MNOPQRSTUVZ",
        "documents_number": 2,
        "documents": [
            {
                "id": "identifier_1",
                "text": "..."
            },
            {
                "id": "GOLD-identifier",
                "text": "..."
            }
            // Gold element
        ]
    }
]

````

````typescript
export class GoldChecker {

    static performGoldCheck(goldConfiguration: Array<Object>, taskType = null) {

        let goldChecks = new Array<boolean>()

        /* If there are no gold elements there is nothing to be checked */
        if (goldConfiguration.length <= 0) {
            goldChecks.push(true)
            return goldChecks
        }

        for (let goldElement of goldConfiguration) {

            /* Element attributes */
            let document = goldElement["document"]
            /* Worker's answers for each gold dimensions */
            let answers = goldElement["answers"]
            /* Worker's notes*/
            let notes = goldElement["notes"]

            let goldCheck = true

            /* CONTROL IMPLEMENTATION STARTS HERE */
            /* Write your code; the check for the current element holds if
            goldCheck remains set to true */

            /* CONTROL IMPLEMENTATION ENDS HERE */
            /* Push goldCheck inside goldChecks array for the current gold
            element */
            goldChecks.push(goldCheck)

        }

        return goldChecks

    }

}
````

## Local Development

You can edit and test the configuration **locally** without deploying the full AWS stack.

1. Go to the environments folder:
   ```bash
   cd your_repo_folder/data/build/environments
   ```
2. Open the **dev** environment file:
   `environment.ts`
3. Set `configuration_local` to `true` and adjust the values you want to test.

**Example (`environment.ts`):**

```ts
export const environment = {
    production: false,
    configuration_local: true,
    platform: "mturk",
    taskName: "your_task_name",
    batchName: "your_batch_name",
    ...
};
```

**Note:** Each time you run `init.py`, this file may be **overwritten**. Keep a backup of local edits if needed.


> **Security:** Don’t commit `environment.ts` or `.env` if they contain AWS keys or secrets. Add them to `.gitignore`.
## Task Performing

To publish a task, choose how you’ll recruit workers: via a supported platform or **manually**. The publishing steps vary by option. Pick one of the subsections below and follow its instructions.

### Manual Recruitment

To recruit workers manually (no platform integration):

1. Set `platform = none` in `data/.env`.
2. (Optional) Generate and assign each worker an identifier, e.g., `randomWorkerId`.
3. Append the identifier to the task URL as a GET parameter (exact casing `workerId`):  
   `?workerId=randomWorkerId`
4. Share the full link with each worker (example):  
   `https://<deploy_bucket>.s3.<region>.amazonaws.com/<task_name>/<batch_name>/index.html?workerId=randomWorkerId`
5. Wait for completion.

**Note:** Steps 2–3 are optional. If you share the base URL **without** `workerId`, Crowd_Frame generates one on first access.

---

### Amazon Mechanical Turk

To recruit via MTurk:

1. Set `platform = mturk` in `data/.env`.
2. In MTurk, create the task and set its general parameters and **criteria**.
3. Go to the build output for MTurk:  
   `data/build/mturk/`
4. Copy the wrapper HTML:  
   `data/build/mturk/index.html`
5. Paste it into the MTurk **Design Layout** box.
6. Preview and save the task project.
7. Publish the task and upload the tokens file:  
   `data/build/mturk/tokens.csv`  
   *(Client-side validation will only enable **Submit** when a pasted token matches.)*
8. Review submission statuses in the **Manage** tab.

> **Security:** Keep `data/build/mturk/tokens.csv` private; it’s used for submission validation.

---

### Prolific

To recruit via Prolific:

1. Set `platform = prolific` in `data/.env`.
2. In Prolific, create the study and set its general parameters.
3. Configure **data collection**:
    - a) Choose **External study link**.
    - b) Provide the task URL.  
      `https://<deploy_bucket>.s3.<region>.amazonaws.com/<task_name>/<batch_name>/?workerId={{PROLIFIC_PID}}&platform=prolific`
    - c) Choose **URL parameters** to record Prolific IDs.
    - d) Ensure the parameter name is `workerId` (rename `PROLIFIC_PID` → `workerId` if needed).
4. Set completion handling:
    - a) Choose to **redirect** participants on completion.
    - b) Copy the completion code from the URL (the `cc` parameter).
    - c) Set `prolific_completion_code` in `data/.env` to that code so submissions can be validated.
5. Configure audience **criteria** and places.
6. Set the overall study cost.
7. Monitor submission statuses from the study page.

---

### Toloka

To recruit via Toloka:

1. Set `platform = toloka` in `data/.env`.
2. In Toloka, create the **project** and set its general parameters.
3. Go to the build output for Toloka:  
   `data/build/toloka/`
4. Copy the wrapper files:
    - HTML: `data/build/toloka/interface.html`
    - JS:   `data/build/toloka/interface.js`
    - CSS:  `data/build/toloka/interface.css`
5. In Toloka’s **Task Interface**, paste each file into the corresponding **HTML / JS / CSS** editors.
6. Copy the data specifications:
    - Input:  `data/build/toloka/input_specification.json`
    - Output: `data/build/toloka/output_specification.json`
7. Paste them into the **Data Specification** fields.
8. Copy the general instructions:
    - `data/build/task/instructions_general.json`
9. Paste the text into **Instructions for Tolokers** (source-code edit mode).
10. Create a **pool** and define audience parameters and reward.
11. Publish and upload the tokens file for the pool:  
    `data/build/toloka/tokens.tsv`
12. Review submission statuses from each pool’s page.

> **Security:** Keep `data/build/toloka/tokens.tsv` private; it’s used for submission validation.

## Task Results

Use the download script to fetch all results for a deployed task.

### Steps

1. Go to the project root:
   ```bash
   cd ~/path/to/project
   ```
2. Enter the `data` folder:
   ```bash
   cd data
   ```
3. Run the downloader:
   ```bash
   python download.py
   ```

The script will:

- download per‑worker snapshots of raw data;
- refine raw data into tabular files;
- save the deployed task configuration;
- generate support files with worker IP and user‑agent attributes;
- (if `enable_crawling=true`) crawl pages retrieved by the in‑task search engine.

All outputs are stored under:

```
data/result/<task_name>/
```

where `<task_name>` matches your environment variable. The folder is created if it does not exist.

|   Folder    | Description                                                                                            |
|:-----------:|:-------------------------------------------------------------------------------------------------------|
|   `Data`    | Per‑worker snapshots of raw data.                                                                      |
| `Dataframe` | Tabular, analysis‑ready files derived from raw data.                                                   |
| `Resources` | Two support files per worker with IP and user‑agent attributes.                                        |
|   `Task`    | Backup of the task configuration.                                                                      |
| `Crawling`  | Source and metadata for pages retrieved by the in‑task search engine (created only if crawling is on). |

> **Privacy:** IP and user‑agent data in `Resources` may be personal data. Handle according to your organization’s policies and applicable laws (e.g., GDPR).


---

### `result/Task`

The `Task` folder contains a backup of the task configuration.

---

### `result/Data`

The `Data` folder stores a per‑worker snapshot of everything the system recorded.  
Each worker has a JSON file whose **top level is an array**. The download script adds **one object per batch** the worker participated in.  
The `source_*` attributes reference the originating DynamoDB tables and the local source path.

````json
[
    {
        "source_path": "result/Your_Task/Data/ABEFLAGYVQ7IN4.json",
        "source_data": "Crowd_Frame-Your-Task_Your-Batch_Data",
        "source_acl": "Crowd_Frame-Your-Task_Your-Batch_ACL",
        "source_log": "Crowd_Frame-Your-Task_Your-Batch_Logger",
        "task": {
            "...": "..."
        },
        "worker": {
            "id": "ABEFLAGYVQ7IN4"
        },
        "ip": {
            "...": "..."
        },
        "uag": {
            "...": "..."
        },
        "checks": [
            "..."
        ],
        "questionnaires_answers": [
            "..."
        ],
        "documents_answers": [
            "..."
        ],
        "comments": [
            "..."
        ],
        "logs": [
            "..."
        ],
        "questionnaires": {
            "...": "..."
        },
        "documents": {
            "...": "..."
        },
        "dimensions": {
            "...": "..."
        }
    }
]
````

---

### `result/Resources`

The `Resources` folder contains **two JSON files per worker**.  
For worker `ABEFLAGYVQ7IN4`, these are `ABEFLAGYVQ7IN4_ip.json` and `ABEFLAGYVQ7IN4_uag.json`.

- `<worker>_ip.json`: reverse‑lookup of IPs (geolocation, provider, headers).
- `<worker>_uag.json`: parsed user‑agent details (browser/OS/device).

Examples (subset):

````json
{
    "203.0.113.42": {
        "country_name": "Kenya",
        "country_code_iso2": "KE",
        "region_name": "Nairobi",
        "timezone_name": "Africa/Nairobi",
        "provider_name": "Example ISP",
        "content_type": "text/html; charset=utf-8",
        "status_code": 200
    }
}
````

````json
{
    "Mozilla/5.0 (Linux; Android 11; ... )": {
        "browser_name": "Chrome",
        "browser_version": "115.0",
        "os_family": "Android",
        "device_brand": "Samsung",
        "device_type": "mobile",
        "device_max_touch_points": 5,
        "ua_type": "mobile-browser"
    }
}
````

### `result/Crawling`

The `Crawling` folder stores captures of the web pages retrieved by the in‑task search engine.  
Crawling is **optional** and is enabled via the `enable_crawling` environment variable.

#### Workflow

1. The download script creates two subfolders: `Metadata/` and `Source/`.
2. Each retrieved page is assigned a UUID (e.g., `59c0f70f-c5a6-45ec-ac90-b609e2cc66d7`).
3. The script attempts to download the page source. If successful, the raw content is saved to `Source/<UUID>_source.<ext>` (the extension depends on the content type).
4. Metadata for each fetch is written to `Metadata/<UUID>_metadata.json` (always; success or failure).

#### Directory layout

```
result/
└─ Crawling/
   ├─ Metadata/
   │  ├─ 59c0f70f-c5a6-45ec-ac90-b609e2cc66d7_metadata.json
   │  └─ ...
   └─ Source/
      ├─ 59c0f70f-c5a6-45ec-ac90-b609e2cc66d7_source.html
      └─ ...
```

#### Metadata contents

Each `<UUID>_metadata.json` includes, at minimum:

- `response_uuid`, `response_url`, `response_timestamp`
- `response_status_code`, `response_error_code` (if any)
- `response_content_type`, `response_content_length`, `response_encoding`
- `response_source_path`, `response_metadata_path`
- a `data` object with selected response headers

#### Example

````json
{
    "attributes": {
        "response_uuid": "59c0f70f-c5a6-45ec-ac90-b609e2cc66d7",
        "response_url": "...",
        "response_timestamp": "...",
        "response_error_code": null,
        "response_source_path": "...",
        "response_metadata_path": "...",
        "response_status_code": 200,
        "response_encoding": "utf-8",
        "response_content_length": 125965,
        "response_content_type": "text/html; charset=utf-8"
    },
    "data": {
        "date": "Wed, 08 Jun 2022 22:33:12 GMT",
        "content_type": "text/html; charset=utf-8",
        "content_length": "125965",
        "...": "..."
    }
}
````

**Notes**

- Non‑HTML resources (PDF, images) are saved with the appropriate extension; metadata is still JSON.
- If crawling is disabled, the `Crawling/` directory is not created.

---

### `result/Dataframe`

The `Dataframe` folder contains a refined, tabular view of each worker snapshot.  
Data are loaded into **DataFrames** (2‑D tables with labeled rows/columns) and exported as CSV files. The number of exported files (up to ~10) depends on your configuration.

Granularity varies by file. For example, `workers_urls` has one row per result returned by the search engine for each query/element/try; `workers_answers` has one row per element/try with the values
for the evaluation dimensions. Use care when interpreting each file’s grain.

The following fragments show (i) a sample access‑control snapshot for a single worker and (ii) two answer rows for two elements of an assigned HIT.

````csv
worker_id,in_progress,access_counter,token_input,user_agent_source,ip_address,user_agent,time_arrival,generated,task_name,ip_source,folder,time_expired,try_current,paid,status_code,platform,batch_name,try_left,token_output,unit_id,source_acl,source_data,source_log,source_path,try_last,task_id,tries_amount,questionnaire_amount,questionnaire_amount_start,questionnaire_amount_end,documents_amount,dimensions_amount,time_arrival_parsed
ABEFLAGYVQ7IN4,True,40,DXWPMUMYXSM,cf,<anonymized>,<anonymized>,"Mon, 07 Nov 2022 09:00:00 GMT",True,Sample,cf,Task-Sample/Batch-Sample/Data/BELPCXHDVUYSSJ/,False,1,False,202,custom,Batch-Sample,10,PGHWTXVNMIP,unit_0,Crowd_Frame-Sample_Batch-Sample_ACL, Crowd_Frame-Sample_Batch-Sample_Data,Crowd_Frame-Sample_Batch-Sample_Logger,result/Sample/Data/BELPCXHDVUYSSJ.json,1,Sample,10,1,1,0,3,1,2022-11-07 09:38:16 00:00
````

````csv
worker_id,paid,task_id,batch_name,unit_id,try_last,try_current,action,time_submit,time_submit_parsed,doc_index,doc_id,doc_fact_check_ground_truth_label,doc_fact_check_ground_truth_value,doc_fact_check_source,doc_speaker_name,doc_speaker_party,doc_statement_date,doc_statement_description,doc_statement_text,doc_truthfulness_value,doc_accesses,doc_time_elapsed,doc_time_start,doc_time_end,global_outcome,global_form_validity,gold_checks,time_spent_check,time_check_amount
ABEFLAGYVQ7IN4,False,Task-Sample,Batch-Sample,unit_1,1,1,Next,"Wed, 09 Nov 2022 10:19:16 GMT",2022-11-09 10:19:16 00:00,0.0,conservative-activist-steve-lonegan-claims-social-,false,1,Politifact,Steve Lonegan,REP,2022-07-12,"stated on October 1, 2011 in an interview on News 12 New Jersey's Power & Politics show:","Today, the Social Security system is broke.",10,1,2.1,1667989144,1667989146.1,False,False,False,False,False
ABEFLAGYVQ7IN4,False,Task-Sample,Batch-Sample,unit_1,1,1,Next,"Wed, 09 Nov 2022 10:19:25 GMT",2022-11-09 10:19:25 00:00,1,yes-tax-break-ron-johnson-pushed-2017-has-benefite,true,5,Politifact,Democratic Party of Wisconsin,DEM,2022-04-29,"stated on April 29, 2022 in News release:","The tax carve out (Ron) Johnson spearheaded overwhelmingly benefited the wealthiest, over small businesses.",100,1,10.27,1667989146.1,1667989156.37,False,False,False,False,False
````

**Rules of thumb** (keep in mind when analyzing):

1. `paid` appears in most files. Use it to separate completed vs. not‑completed work; failures can be insightful.
2. `batch_name` appears in some files. Analyze results per batch when needed.
3. `try_current` and `try_last` (where present) split data by attempts; `try_last` marks the most recent. Account for multiple tries per worker.
4. `action` (when present) is one of `Back`, `Next`, `Finish`. Only `Next`/`Finish` rows reflect the latest answer for an element.
5. `index_selected` (in `workers_urls`) marks results the worker clicked (`-1` means not selected). A value of `4` means three results had already been selected, `7` means six, and so on.
6. `type` (in `workers_logs`) identifies the log record type; logs are globally time‑sorted.
7. `workers_acl` holds useful worker‑level info. Join to other files on `worker_id`.
8. `workers_urls` lists all retrieved results; `workers_crawling` contains crawling info. Join them on `response_uuid`.
9. `workers_dimensions_selection` shows the time order in which answers were chosen. Rows for one worker can be interleaved with others if multiple workers act concurrently.
10. `workers_comments` contains final comments. It’s optional, so it may be empty.

**Produced files** (may vary by configuration):

|                Dataframe                |                   Description                    |
|:---------------------------------------:|:------------------------------------------------:|
|            `workers_acl.csv`            | Snapshots of raw access/control data per worker. |
|       `workers_ip_addresses.csv`        |        IP address information per worker.        |
|        `workers_user_agents.csv`        |    Parsed user‑agent information per worker.     |
|          `workers_answers.csv`          |        Answers per evaluation dimension.         |
|         `workers_documents.csv`         |       Elements evaluated during the task.        |
|       `workers_questionnaire.csv`       |              Questionnaire answers.              |
|   `workers_dimensions_selection.csv`    |     Temporal order of dimension selections.      |
|           `workers_notes.csv`           |          Text annotations from workers.          |
|           `workers_urls.csv`            |      Search queries and retrieved results.       |
|         `workers_crawling.csv`          |          Data about crawled web pages.           |
|           `workers_logs.csv`            |     Logger events produced during the task.      |
|         `workers_comments.csv`          |           Final comments from workers.           |
|        `workers_mturk_data.csv`         |         MTurk worker/assignment exports.         |
|    `workers_prolific_study_data.csv`    |        Prolific study/submission exports.        |
| `workers_prolific_demographic_data.csv` |          Prolific worker demographics.           |
|        `workers_toloka_data.csv`        |        Toloka project/submission exports.        |

## FAQ & Troubleshooting

### FAQ

- **Paths with special characters**  
  Avoid special characters in project paths (e.g., `º`). Some tools (CLI, Docker, Python) may fail to resolve these paths reliably.

- **VS Code and working directory**  
  VS Code terminals/tasks can start in the wrong *working directory*. Run scripts from an external shell (Terminal/PowerShell/cmd) at the repo root (or the expected subfolder), or set:
  `File > Preferences > Settings > terminal.integrated.cwd`.

- **`.env` filename**  
  The file must be named exactly `.env` (not `.env.txt`).  
  On **Windows**, enable “File name extensions” in Explorer; on **macOS**, use “Get Info” to verify the name.

- **How do I reset a task that is blocked or unresponsive?**  
  If workers cannot continue or the admin panel won’t accept changes, you can restore a clean state by deleting the task’s records from the DynamoDB tables: `*_ACL`, `*_Data`, `*_Logger`. This unlocks
  the task so you can reconfigure or redeploy.

  > **Warning:** Deleting these records is irreversible and permanently erases progress and submissions. Do this only if you intend to restart from scratch.

### Known Issues

- **Docker on Windows (`pypiwin32` error)**: on certain Windows-based Python distributions, the `docker` package triggers the following exception because the `pypiwin32` dependency fails to run its
  post-install script:
  ```
  NameError: name 'NpipeHTTPAdapter' is not defined. Install pypiwin32 package to enable npipe:// support
  ```  
  To fix this, run the following command from an elevated command prompt:
  ```bash
  python your_python_folder/Scripts/pywin32_postinstall.py -install
  ```

## Contributing

Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/dev-branch`)
3. Commit your Changes (`git commit -m 'Add some Feature'`)
4. Push to the Branch (`git push origin feature/dev-branch`)
5. Open a Pull Request

## Original Article

This software was presented at the Fifteenth ACM International Conference on Web Search and Data Mining (**WSDM 2022**).  
If you use Crowd_Frame in your research, please cite the paper below. A repository-level citation file (**`CITATION.cff`**) is included, so you can also use GitHub’s **Cite this repository** button to
export in multiple formats.

**DOI:** https://doi.org/10.1145/3488560.3502182

### BibTeX

```bibtex
@inproceedings{conference-paper-wsdm2022,
  author    = {Soprano, Michael and Roitero, Kevin and Bombassei De Bona, Francesco and Mizzaro, Stefano},
  title     = {Crowd_Frame: A Simple and Complete Framework to Deploy Complex Crowdsourcing Tasks Off-the-Shelf},
  booktitle = {Proceedings of the Fifteenth ACM International Conference on Web Search and Data Mining},
  series    = {WSDM '22},
  year      = {2022},
  pages     = {1605--1608},
  publisher = {Association for Computing Machinery},
  address   = {New York, NY, USA},
  doi       = {10.1145/3488560.3502182},
  url       = {https://doi.org/10.1145/3488560.3502182},
  isbn      = {9781450391320},
  keywords  = {framework, crowdsourcing, user behavior}
}
```

### Plain-text citation

Soprano, M., Roitero, K., Bombassei De Bona, F., & Mizzaro, S. (2022). *Crowd_Frame: A Simple and Complete Framework to Deploy Complex Crowdsourcing Tasks Off-the-Shelf*. In **Proceedings of the
Fifteenth ACM International Conference on Web Search and Data Mining (WSDM ’22)** (pp. 1605–1608). Association for Computing Machinery. https://doi.org/10.1145/3488560.3502182
