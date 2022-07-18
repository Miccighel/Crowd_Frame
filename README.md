# Crowd_Frame

![](https://badges.aleen42.com/src/angular.svg) ![](https://badges.aleen42.com/src/python.svg) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) ![Maintainer](https://img.shields.io/badge/maintainer-Miccighel-blue) [![Github all releases](https://img.shields.io/github/downloads/Miccighel/Crowd_Frame/total.svg)](https://GitHub.com/Miccighel/Crowd_Frame/releases/) [![GitHub stars](https://badgen.net/github/stars/Miccighel/Crowd_Frame)](https://GitHub.com/Miccighel/Crowd_Frame/stargazers/) [![GitHub watchers](https://badgen.net/github/watchers/Miccighel/Crowd_Frame/)](https://GitHub.com/Miccighel/Crowd_Frame/watchers/) [![GitHub contributors](https://img.shields.io/github/contributors/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/graphs/contributors/)[![GitHub
issues](https://badgen.net/github/issues/Miccighel/Crowd_Frame/)](https://GitHub.com/Miccighel/Crowd_Frame/issues/) [![GitHub issues](https://img.shields.io/github/issues/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues/) [![GitHub issues-closed](https://img.shields.io/github/issues-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues?q=is%3Aissue+is%3Aclosed) [![GitHub pull-requests](https://img.shields.io/github/issues-pr/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/) [![GitHub pull-requests closed](https://img.shields.io/github/issues-pr-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

![GitHub Contributors Image](https://contrib.rocks/image?repo=Miccighel/Crowd_Frame)

:star: Star us on GitHub — it motivates us a lot!

### A software system that allows to easily design and deploy diverse types of crowdsourcing tasks.

[![ForTheBadge built-with-science](http://ForTheBadge.com/images/badges/built-with-science.svg)](https://GitHub.com/Miccighel/Crowd_Frame)

## Table of Contents

<ul>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
     <li><a href="#environment-variables">Environment Variables</a></li>
    <li><a href="#task-configuration">Task Configuration</a></li>
    <li><a href="#hits-format">HITs Format</a></li>
    <li><a href="#task-performing">Task Performing</a></li>
     <li><a href="#results-download">Results Download</a></li>
    <li><a href="#local-development">Local Development</li>
    <li><a href="#troubleshooting">Troubleshooting</li>
    <li><a href="#references">References</li>
</ul>

## Prerequisites

- [AWS Command Line Interface](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [Node.js](https://nodejs.org/it/download/)
- [Python 3](https://www.python.org/downloads/https://nodejs.org/it/download/)
- [Docker](https://docs.docker.com/get-docker/) (Optional)

## Getting Started

1. Create an [Amazon AWS Account](https://aws.amazon.com/it/)

2. Create a new [IAM USER](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) `your_iam_user`

3. Attach the `AdministratorAccess` policy

   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": "*",
               "Resource": "*"
           }
       ]
   }
   ```

4. Generate a new access key pair

5. Store the Access Key in your _credentials_ file

   ![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white) Path: `C:\Users\your_os_user\.aws\credentials`

     ````
     [your_iam_user]
     aws_access_key_id=your_key
     aws_secret_access_key=your_secret
     ````

6. Clone the repo [Miccighel/Crowd_Frame](https://github.com/Miccighel/Crowd_Frame)

7. Enable the Yarn global binary

   ````
   corepack enable
   ````

8. Move to repo folder:

   ````
   cd ~/path/to/project
   ````

9. Move to data folder:

    ```
    cd data
    ```

10. Create environment file `.env`:

    Path: `your_repo_folder/data/.env`

11. Provide the mandatory subset of environment variables:

     ````
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
     ````

12. Install python packages with `pip install -r your_repo_folder/requirements.txt`:

	  ````
	boto3==1.21.32  
	ipapi==1.0.4  
	ipinfo==4.2.1  
	mako==1.1.4  
	docker==5.0.3  
	python-dotenv==0.20.0  
	rich==10.16.2  
	tqdm==4.64.0  
	numpy==1.23.0  
	pandas==1.4.2  
	toloka-kit==0.1.25  
	python-on-whales==0.43.0  
	beautifulsoup4==4.11.1  
	aiohttp==3.8.1
	  ````

13. Run python script `init.py`

    Path: `your_repo_folder/data/init.py`

    The script will:
    	- read your env. variables;
    	- setup the AWS infrastructure;
    	- generate an empty task configuration;
    	- deploy the task on the public bucket.

14. Open your task:

    `https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html`

Crowd_Frame interacts with diverse Amazon Web Services (AWS) to deploy crowdsourcing tasks, store the data produced and so on. Each service used falls within the [AWS Free Tier](https://aws.amazon.com/free/) program. The budget limit that
will block the usage of such services if/when surpassed.

## Environment Variables

The following table describes each environment variables that can be set in `your_repo_folder/data/.env`

|          Variable          |                                                                                                                    Description                                                                                                                     |     Mandatory      | Value                          |
|:--------------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:------------------:|--------------------------------|
|       `profile_name`       |                                                                    Name of the IAM profile created during Step #2. If unspecified, the variable will use the value: `default`.                                                                     |        :x:         | `your_iam_user`                |
|       `mail_contact`       |                                                                                            Contact mail to receive AWS budgeting related comunications                                                                                             | :heavy_check_mark: | Valid email address            |
|         `platform`         |                                                                                                  Platform on which deploy the crowdsourcing task.                                                                                                  | :heavy_check_mark: | `mturk` or `prolific` or `toloka`          |
|       `budget_limit`       |                                                                                        Maximum monthly money amount allowed to operate in USD; e.g., `5.0`                                                                                         | :heavy_check_mark: | Positive float number          |
|        `task_name`         |                                                                                                        Identifier of the crowdsourcing task                                                                                                        | :heavy_check_mark: | Any string                     |
|        `batch_name`        |                                                                                                        Identifier of a single task's batch                                                                                                         | :heavy_check_mark: | Any string                     |
|        `task_title`        |                                                                                                      Custom title for the crowdsourcing task                                                                                                       |        :x:         | Any string                     |
|       `batch_prefix`       |                                                                     Prefix of the identifiers of one or more task's batches. Use this variable to filter the final result set.                                                                     |        :x:         | Any string                     |
|        `admin_user`        |                                                                                                             Username of the admin user                                                                                                             | :heavy_check_mark: | Any string                     |
|      `admin_password`      |                                                                                                             Password of the admin user                                                                                                             | :heavy_check_mark: | Any string                     |
|        `aws_region`        |                                                                                                   Region of your AWS account; e.g., `us-east-1`                                                                                                    | :heavy_check_mark: | Valid AWS region identifier    |
|    `aws_private_bucket`    |                                                                                    Name of the private S3 bucket in which to store task configuration and data                                                                                     | :heavy_check_mark: | String unique across AWS       |
|    `aws_deploy_bucket`     |                                                                                          Name of the public S3 bucket in which to deploy task source code                                                                                          | :heavy_check_mark: | String unique across AWS       |
|      `server_config`       | Used to specify where the worker behavior logging interface is. Set it to `aws` to deploy the AWS-based infrastructure. Set it to `custom` if you want to provide a custom logging endpoint. Set it to `none` if you will not log worker behavior. | :heavy_check_mark: | `aws` or `custom` or `none`    |
|      `enable_solver`       |                                       Allows to deploy the HITs solver locally. Allows to provide a set of documents which will be automatically allocated into a set of HITs. Requires the usage of Docker.                                       |        :x:         | `true` or `false`              |
|      `enable_crawling`       |  Enables the crawling of the results retrieved by the search engine. |        :x:         | `true` or `false`              |
| `prolific_completion_code` |                                                  Prolific study completion code. Provide here the code if you recruit crowd workers via Prolific. Required if the platform chosen is `prolific`.                                                   |        :x:         | Valid Prolific completion code |
| `toloka_oauth_token` |  Token to access Toloka's API. Required if the platform chosen is `toloka`.                                                   |        :x:         | Valid Toloka OAuth token |
|      `ip_info_token`       |                                                                                               API Key to use `ipinfo.com` tracking functionalities.                                                                                                |        :x:         | Valid IP Info key              |
|  `ip_geolocation_api_key`  |                                                                                            API Key to use `ipgeolocation.io` tracking functionalities.                                                                                             |        :x:         | Valid IP Geolocation key       |
|      `ipapi_api_key`       |                                                                                                API Key to use `ipapi.com` tracking functionalities.                                                                                                |        :x:         | Valid IP Api key               |
|     `user_stack_token`     |                                                                                        API Key to use `userstack.com` user agent detection functionalities.                                                                                        |        :x:         |  Valid Userstack key      |
|       `bing_api_key`       |                                                                                                  API Key to use `BingWebSearch` search provider.                                                                                                   |        :x:         | Valid  Bing API Web Search Key |
|     `fake_json_token`      |                                                                     API Key to use `FakerWebSearch` search provider. Returns dummy responses useful to test the search engine.                                                                     |        :x:         | Valid  fakeJSON.com API Key    |

## Task Configuration

To configure your crowdsourcing task deployed:

- open the administrator panel by appending `?admin=true`;
- click the **Generate** button to open the login prompt;
- use your admin credentials;
- proceed through each generation step.

When the configuration is ready, click the **Upload** button.

### Step Overview

#### Step 1 - Questionnaires

Allows creating one or more questionnaires that workers will fill before or after task execution.

#### Step 2 - Evaluation Dimensions

Allows configuring what the worker will assess for each element of the HIT assigned.

#### Step 3 - Task Instructions

Each worker is shown with general task instructions before the task.

#### Step 4 - Evaluation Instructions

Each worker is shown with such instructions within the task's body.

#### Step 5 - Search Engine

Allows choosing the search provider wanted and to add a list of domains to filter from search results.

#### Step 6 - Task Settings

Allows to configures several task settings, such as the maximum amount of tries for each worker, the usage of an annotation interface, and much more.

It also _allows to provide the file containing the set of HITs for the task deployed_.

#### Step 7 - Worker Checks

Allows to configure additional checks on workers.

### Task Testing

To test the task configured open the task and try it

`https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html`

## HITs Format

The HITs for a crowdsourcing task must be stored in a special `json` file and must comply to a specific format:

1. There must be an array of HITs (also called _units_);
2. Each HIT must have a _unique_ input token attribute;
3. Each HIT must have a _unique_ output token attribute;
4. The number of documents for each HIT must be specified;
5. The documents for each HIT are key/value dictionaries;
6. Each document can have an arbitrary number of attributes.

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

Useful tips:

1. Initially the deploy script creates an empty configuration
2. You can upload the HITs during configuration step 6

### Automatic HITs creation

TODO

## Task Performing

How a crowdsourcing task is launched depends on how the workers are recruited. You can recruit each worker manually, or on one of the crowdsourcing platforms supported.

### Manual Recruitment

1. Assign to each worker a `workerID`:

    - It is used to identify each worker ;
    - It enables data collection when the worker performs the task;

2. Append the id as a GET parameter `?workerID=worker_id_chosen`

3. Provide the full URL to the worker:

   `https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html?workerID=worker_id_chosen`

### Amazon Mechanical Turk

TODO

### Prolific

TODO

### Toloka

TODO

## Results Download

1. Move to project `data` folder:

   ````
   cd ~/path/to/project/data/
   ````
   
2. Run python script `download.py`

3. Move to the results folder:

   ````
   cd result
   ````
   
4.  Move to the current task folder `your_task_name`:

	   ````
	   cd your_task_name
	   ````
	   
5.  Results structure:

	TODO

## Local Development

You may want to edit and test the task configuration locally. To enable local development:

1. Move to enviroments folder:

    ````
    cd your_repo_folder/data/build/environments
    ````

2. Open the `dev` environment file:

    ````
    environment.ts
    ````

3. Set the `configuration_local` flag to `true`:

   Full sample:

    ````js
    export const environment = {
        production: false,
        configuration_local: true,
        platform: 'mturk',
        taskName: "your_task_name",
        batchName: "your_batch_name",
        region: "your_aws_region",
        bucket: "your_private_bucket",
        aws_id_key: "your_aws_key_id",
        aws_secret_key: "your_aws_key_secret",
        prolific_completion_code: false,
        bing_api_key: "your_bing_api_key",
        fake_json_key: "your_fake_json_key",
        log_on_console: false,
        log_server_config: "none",
        table_acl_name: "Crowd_Frame-your_task_name_your_batch_name_ACL",
        table_data_name: "Crowd_Frame-your_task_name_your_batch_name_Data",
        table_log_name: "Crowd_Frame-your_task_name_your_batch_name_Logger",
        hit_solver_endpoint: "None",
    };
    ````

Now you can manually edit the configuration and test everything locally.

:warning: _Remember_: each execution of the `init.py` script will overwrite this file :warning:

## Troubleshooting

Fixes for well-known errors:
- The `docker` package, as of today, triggers the exception shown below on certain Windows-based python distributions because the `pypiwin32` dependency fails to run its post-install script.
`NameError: name 'NpipeHTTPAdapter' is not defined. Install pypiwin32 package to enable npipe:// support` . To solve it run the following command from an elevated command prompt: `python your_python_folder/Scripts/pywin32_postinstall.py -install`.

## Contributing

Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/dev-brach`)
3. Commit your Changes (`git commit -m 'Add some Feature'`)
4. Push to the Branch (`git push origin feature/dev-branch`)
5. Open a Pull Request

## Original Article

This software has been presented during The 15th ACM International WSDM Conference.

````tex
@inproceedings{conference-paper-wsdm2022,
    author = {Soprano, Michael and Roitero, Kevin and Bombassei De Bona, Francesco and Mizzaro, Stefano},
    title = {Crowd_Frame: A Simple and Complete Framework to Deploy Complex Crowdsourcing Tasks Off-the-Shelf},
    year = {2022},
    isbn = {9781450391320},
    publisher = {Association for Computing Machinery},
    address = {New York, NY, USA},
    url = {https://doi.org/10.1145/3488560.3502182},
    doi = {10.1145/3488560.3502182},
    abstract = {Due to their relatively low cost and ability to scale, crowdsourcing based approaches are widely used to collect a large amount of human annotated data. To this aim, multiple crowdsourcing platforms exist, where requesters can upload tasks and workers can carry them out and obtain payment in return. Such platforms share a task design and deploy workflow that is often counter-intuitive and cumbersome. To address this issue, we propose Crowd_Frame, a simple and complete framework which allows to develop and deploy diverse types of complex crowdsourcing tasks in an easy and customizable way. We show the abilities of the proposed framework and we make it available to researchers and practitioners.},
    booktitle = {Proceedings of the Fifteenth ACM International Conference on Web Search and Data Mining},
    pages = {1605–1608},
    numpages = {4},
    keywords = {framework, crowdsourcing, user behavior},
    location = {Virtual Event, AZ, USA},
    series = {WSDM '22}
}
````
