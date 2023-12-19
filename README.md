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
    <li><a href="#hits-allocation">HITs Allocation</a></li>
    <li><a href="#quality-checks">Quality Checks</a></li>
<li><a href="#local-development">Local Development</a></li>
    <li><a href="#task-performing">Task Performing</a></li>
     <li><a href="#task-results">Task Results</a></li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
    <li><a href="#references">References</a></li>
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
aiohttp==3.9.0
boto3==1.29.1
botocore==1.32.1
chardet==4.0.0
datefinder==0.7.3
ipinfo==4.4.2
Mako==1.2.3
numpy==1.26.2
pandas==2.1.4
pycountry==22.3.5
python-dotenv==1.0.0
python_dateutil==2.8.2
python_on_whales==0.60.1
pytz==2023.3.post1
Requests==2.31.0
rich==13.7.0
setuptools==68.2.2
tqdm==4.65.0
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

Crowd_Frame interacts with diverse Amazon Web Services to deploy crowdsourcing tasks, store the data produced and so on. Each service used falls within the AWS Free Tier program. 
The task requester can set the budget limit using the `budget_limit` environment variable. Thus, the usage of the services will be blocked if/when such a limit is surpassed.

## Environment Variables

The following table describes each environment variable that can be set in the environment file to customize the behavior. Path: `your_repo_folder/data/.env`

|          Variable          |                                                                                                                    Description                                                                                                                     |     Mandatory      | Value                                       |
|:--------------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|:------------------:|---------------------------------------------|
|       `profile_name`       |                                                                    Name of the IAM profile created during Step #2. If unspecified, the variable will use the value: `default`.                                                                     |        :x:         | `your_iam_user`                             |
|       `mail_contact`       |                                                                                            Contact mail to receive AWS budgeting related comunications                                                                                             | :heavy_check_mark: | Valid email address                         |
|         `platform`         |                                                                       Platform on which deploy the crowdsourcing task. Set it to `none` if you recruit the workers manually.                                                                       | :heavy_check_mark: | `none` or `mturk` or `prolific` or `toloka` |
|       `budget_limit`       |                                                                                        Maximum monthly money amount allowed to operate in USD; e.g., `5.0`                                                                                         | :heavy_check_mark: | Positive float number                       |
|        `task_name`         |                                                                                                        Identifier of the crowdsourcing task                                                                                                        | :heavy_check_mark: | Any string                                  |
|        `batch_name`        |                                                                                                        Identifier of a single task's batch                                                                                                         | :heavy_check_mark: | Any string                                  |
|        `task_title`        |                                                                                                      Custom title for the crowdsourcing task                                                                                                       |        :x:         | Any string                                  |
|       `batch_prefix`       |                                                                     Prefix of the identifiers of one or more task's batches. Use this variable to filter the final result set.                                                                     |        :x:         | Any string                                  |
|        `admin_user`        |                                                                                                             Username of the admin user                                                                                                             | :heavy_check_mark: | Any string                                  |
|      `admin_password`      |                                                                                                             Password of the admin user                                                                                                             | :heavy_check_mark: | Any string                                  |
|        `aws_region`        |                                                                                                   Region of your AWS account; e.g., `us-east-1`                                                                                                    | :heavy_check_mark: | Valid AWS region identifier                 |
|    `aws_private_bucket`    |                                                                                    Name of the private S3 bucket in which to store task configuration and data                                                                                     | :heavy_check_mark: | String unique across AWS                    |
|    `aws_deploy_bucket`     |                                                                                          Name of the public S3 bucket in which to deploy task source code                                                                                          | :heavy_check_mark: | String unique across AWS                    |
|      `server_config`       | Used to specify where the worker behavior logging interface is. Set it to `aws` to deploy the AWS-based infrastructure. Set it to `custom` if you want to provide a custom logging endpoint. Set it to `none` if you will not log worker behavior. | :heavy_check_mark: | `aws` or `custom` or `none`                 |
|      `enable_solver`       |                                       Allows to deploy the HITs solver locally. Allows to provide a set of documents which will be automatically allocated into a set of HITs. Requires the usage of Docker.                                       |        :x:         | `true` or `false`                           |
|      `enable_crawling`       |                                                                                        Enables the crawling of the results retrieved by the search engine.                                                                                         |        :x:         | `true` or `false`                           |
| `prolific_completion_code` |                                                  Prolific study completion code. Provide here the code if you recruit crowd workers via Prolific. Required if the platform chosen is `prolific`.                                                   |        :x:         | Valid Prolific completion code              |
| `toloka_oauth_token` |                                                                                     Token to access Toloka's API. Required if the platform chosen is `toloka`.                                                                                     |        :x:         | Valid Toloka OAuth token                    |
|      `ip_info_token`       |                                                                                               API Key to use `ipinfo.com` tracking functionalities.                                                                                                |        :x:         | Valid IP Info key                           |
|  `ip_geolocation_api_key`  |                                                                                            API Key to use `ipgeolocation.io` tracking functionalities.                                                                                             |        :x:         | Valid IP Geolocation key                    |
|      `ipapi_api_key`       |                                                                                                API Key to use `ipapi.com` tracking functionalities.                                                                                                |        :x:         | Valid IP Api key                            |
|     `user_stack_token`     |                                                                                        API Key to use `userstack.com` user agent detection functionalities.                                                                                        |        :x:         | Valid Userstack key                         |
|       `bing_api_key`       |                                                                                                  API Key to use `BingWebSearch` search provider.                                                                                                   |        :x:         | Valid  Bing API Web Search Key              |
|     `fake_json_token`      |                                                                     API Key to use `FakerWebSearch` search provider. Returns dummy responses useful to test the search engine.                                                                     |        :x:         | Valid  fakeJSON.com API Key                 |

## Task Configuration

The generator must be accessed to configure the crowdsourcing task deployed. This involves 4 steps:
- open the administrator panel by appending the suffix `?admin=true` to the task's URL;
- Click the **Generate** button to open the login form;
- Input the admin credentials set in the corresponding environment variables (`admin_user` and `admin_password`);
- Proceed through each configuration step and upload the final configuration.

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

The following table details the content of each configuration file.

|              File              |                            Description                             |
|:------------------------------:|:------------------------------------------------------------------:|
|          `hits.json`           |            Contains the whole set of HITs of the task.             |
|     `questionnaires.json`      |     Contains the definition of each questionnare of the task.      |
|       `dimensions.json`        | Contains the definitions of each evaluation dimension of the task. |
|  `instructions_general.json`   |           Contains the general instructions of the task.           |
| `instructions_evaluation.json` |         Contains the evaluation instructions of the task.          |
|      `search_engine.json`      | Contains the configuration of the custom search engine. |
|         `task.json`         | Contains several general settings of the task. |
|       `workers.json`        | Contains settings concerning worker access to the task. |

## HITs Allocatiom

The HITs for a crowdsourcing task designed and deployed using Crowd_Frame must be stored in a special JSON file. 
Such a file can be manually uploaded when configuring the crowdsourcing task itself. 
The file must comply to a special format that satisfies 5 requirements:

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

The requester can build manually the set of HITs compliant with the format required by the system. Initially, the requester chooses an attribute whose values split the dataset into different classes. The core idea is to build pools of elements to allocate, one for each class. Four parameters are thus established. These parameters are the total number of elements to allocate in the whole set of HITs, the number of elements that each HIT must contain, the number of elements to allocate for each class, and the number of repetitions for each element. The pools of elements must thus be updated to include all the repetitions required. Each HIT is then built using a loop. It is useful to define a support function. The core idea is to sample the required number of elements for each class until a sample without duplicates is obtained. The elements are then removed from the pool of those still available if the condition is satisfied. The total number of HITs required depends on the parameters previously established. The lists of elements allocated in HITs can be serialized for later reference. Using such an allocation matrix, the requester can finally build the set of HITs in the format required. 

The first figure shown below provides a pseudocode that further details the allocation procedure. Let us hypothesize a requester that wants to determine the number $m$ of HITs that they will publish on the crowdsourcing platform. The second figure shown below details the `singleHIT(...)` sub-procedure used by the main algorithm to sample a set of elements without duplicates. The sample obtained is used to build a single HIT of the whole set. Let us hypothesize a requester that wants to allocate $n$ elements in HITs made of $k$ positions. Each element is repeated in $p$ different HITs. The final number of HITs required is $m=(n*p)/k$.


### Automatic HITs creation

The system provides a solution to allocate automatically the elements to evaluate in a set of HITs. It is experimental and works only when using 
Crowd_Frame within the local filesystem. Future versions of the software will consolidate and generalize such a feature. Crowd_Frame allws deploying 
the implementation of a solver and provides a way to communicate with it. Docker needs to be installed in the local system, since the usage of a 
container is require to allow software and solver communicating. The container contains deployed using Docker contains two services. 
One of these services provides the implementation of the solver itself, while the other provides a reverse proxy based on the `Nginx` web server. 
The reverse proxy forwards HTTP messages to the solver. The solver processes the messages and responds.

The requester can enable the feature using the `enable_solver` environment variable. S/he can take advantage of the solver while configuring the task using the 
Generator, during the sixth step of the configuration. The first step required to create the input data required by the solver involves uploading the elements 
to be allocated into a set of HITs. Each element must share the same set of attributes and the overall set must be provided in the form of a JSON array. 
In other words, the requester can upload the value of the `documents` object of the fragment shown above, without writing any token or `unit_id`. Then, the requester can 
configure three parameters concerning the allocation. S/he thus configures the number of workers that evaluate each element and the overall number of workers among which the elements must be allocated. 
Lastly, the requester chooses the subset of attributes used to categorize the elements across different HITs. The requester must also indicate how many 
elements must be assigned to each worker for every possible value of the category chosen. For each category/element number pair the system verifies whether 
the two values are compatible. The minimum number of workers needed to evaluate the whole set of HITs is thus computed if the verification is successful. 
The requester can increase such a number as s/he prefers.

To provide an example of when such a verification can fail, let us hypothesize a requester who chooses as category an attribute named `A1` which has 2 different values 
among the elements to be evaluated. The requester requires that each worker evaluates 2 elements for each attribute's value. Then, a second attribute named `A2` 
is also chosen, which has 3 different values. The requester requires that each worker evaluates 1 element for each attribute's value. This means that according to the attribute `A1` 
each worker evaluates 4 elements, while according to `A2` each worker evaluates 3 elements. Such a selection of values is not allowed.

The figure shown below reports a sample configuration for a set of 120 statements available on [Politifact](https://www.politifact.com/>). The JSON below shows a sample of such elements. 
The requester, hence, uploads a JSON file containing 120 elements to allocate. S/he chooses that each element must be assigned to 10 different workers. 
The attribute `party` is selected as category. Each worker must evaluate 6 elements for each of the 2 values of the category. In other words, each workers must evaluate 12 different elements. 
The verification steps thus enforces a minimum number of 100 workers to recruit. The Generator allows selecting as categories only the attributes which are balanced with respect to 
the number of documents. In other words, those attributes repeated across the same number of elements. Such a design choice is needed to provide input data to the solver 
compliant with the formalization implemented. The request is now ready to send the request to the solver, which computes the allocation and returns a solution.

<img src="images/generator-solver.png" alt="Generator Solver" width="700"/>

````json
[
    {
        "name": "REP_HALFTRUE_doc5",
        "statement": "The city of Houston now has more debt per capita than California.",
        "claimant": "Rick Perry",
        "date": "2010",
        "originated_from": "ad",
        "id_par": "1796.json",
        "job": "Governor",
        "party": "REP",
        "source": "Politifact"
    }
    ...
]
````
## Quality Checks

Crowd_Frame provides a way to manually define custom quality checks triggered for each evaluation dimension when the corresponding setting is enabled in the configuration. 
A custom quality is obtained by providing an implementation for the static method `performGoldCheck` available in `data/build/skeleton/goldChecker.ts`.

A custom quality check is triggered only for certain elements of HIT, with respect to a subset of the evaluation dimensions. 
An element can be marked for the quality check by prepending the string `GOLD` to its `id` attribute. 
The fragment shown below reports a single HIT where its second element is marked for the quality check.

The second fragment shows the default implementation of the method generated by the initialization script. The `document` array provides the set 
of elements marked for the quality check. The `answers` array contains the answers provided by the worker for the evaluation dimensions 
that require the quality check. The check must be implemented among the two comments shown.

````json
[
    {
        "unit_id": "unit_0",
        "token_input": "ABCDEFGHILM",
        "token_output": "MNOPQRSTUVZ",
        "documents_number": 1,
        "documents": [
            { "id": "identifier_1", "text": "Lorem ipsum dolor sit amet" },
            { "id": "GOLD-identifier", "text": "Lorem ipsum dolor sit amet" }
        ]
    }
]
````

````typescript
export class GoldChecker {
    static performGoldCheck(goldConfiguration : Array<Object>) {
        let goldChecks = new Array<boolean>()
        /* If there are no gold elements there is nothing to be checked */
        if(goldConfiguration.length<=0) {
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
            /* The check for the current element holds if goldCheck remains true */
        ...
            /* CONTROL IMPLEMENTATION ENDS HERE */
            /* Push goldCheck inside goldChecks array for the current gold element */
            goldChecks.push(goldCheck)
        }
        return goldChecks
    }
}
````

## Local Development

Crowd_Frame provides a way to manually edit and test the configuration locally, without deploying the overall infrastructure. Enabling the local development capability involves 4 steps:

1. Move to enviroments folder:

    ````
    cd your_repo_folder/data/build/environments
    ````

2. Open the `dev` environment file:

    ````
    environment.ts
    ````

3. Edit the attribute `configuration_local` by setting the value `true`:

   Full sample:

    ````js
    export const environment = {
        production: false,
        configuration_local: true,
        platform: "mturk",
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

## Task Performing

Publishing a crowdsourcing task configured using Crowd_Frame involves choosing the platform to recruit the human workforce, even though the requester can also manually recruit each worker needed. 
The process to publish and start the task deployed is slightly different depending on such a choice.

### Manual Recruitment

A task requester that aims to manually recruit each worker to perform the task deployed must:

1. Set the environment variable `platform` using the value `none`
2. Generate ad assign each worker an alphanumeric identifier, such as`randomWorkerId`
3. Append the identifier generated as a GET parameter to the task deploy link::
   `?workerId=randomWorkerId`
4. Provide each worker with the link to the task deployed:
   `https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html?workerID=randomWorkerId`
5. Wait for task completion

The steps #2 and #3 can be skipped because the task URL can be provided to a worker also without manually adding an identifier. In such a case, Crowd_Frame will automatically generate it.

### Amazon Mechanical Turk

A task requester that aims to recruit each worker using Amazon Mechanical Turk must:
1. Create the task and set its general parameters and criterion
2. Move to the build output folder for the platform:
   `data/build/mturk/`
3. Copy the code of the wrapper:
   `data/build/mturk/index.html`
4.  Paste everything into the `Design Layout` box
5. Preview and save the task project.
6. Publish the task and recruit a batch of workers by uploading the file containing the input/output tokens:
   `data/build/mturk/tokens.csv`
7. Review the status of each submission by using the `Manage` tab.

### Prolific

A task requester that aims to recruit each worker using Prolific must:
1. Create the study and set its general parameters
2. Set the data collection modality required
   3. Choose `External study link` as the modality to collect data.
   4. Provide the URL of the task deployed
   5. Choose `URL parameters` as the modality to record Prolific IDs
   6. Rename the `PROLIFIC_PID` parameter to `workerId`.
   7. Choose to redirect the participants to confirm completion using a URL.
   8. Copy the completion code from the URL shown (i.e., the `cc` parameter).
   9. Set the `prolific_completion_code` environment variable using the completion code found as value.
10. Configure the parameters and criterion of the audience of workers to recruit.
11. Set the overall study cost.
12. Review the status of each submission by using the study's page.

### Toloka

A task requester that aims to recruit each worker using Toloka must:
1. Create the project and set its general parameters.
2. Move to the build output folder for the platform:
   `data/build/toloka/`
3. Copy the markup, JavaScript code, and CSS styles of the wrapper:
   `data/build/toloka/interface.html`
   `data/build/toloka/interface.js`
   `data/build/toloka/interface.css`
4. Paste each source code into the `Task Interface` box, using the corresponding section of the `HTML/JS/ CSS` box.
5. Copy the input and output data specification:
   `data/build/toloka/input_specification.json`
   `data/build/toloka/output_specification.json`
6. Paste each data specification into the `Data Specification` box,
7. Copy the text of the task general instructions:
   `data/build/task/instructions_general.json`
8. Paste the texts into the `Instructions for Tolokers` box, using the source code edit modality.
9. Create a new pool of workers by defining the parameters of the audience and the reward
10. Publish the task and recruit the audience of workers for each pool by uploading the file containing the input/output tokens
    `data/build/mturk/tokens.tsv`
11. Review the status of each submission by using the each pool's page.

## Task Results

The requester can download the final results of a crowdsourcing task deployed using Crowd_Frame by using the download script. This involves four steps:

1. Access the main folder: `cd ~/path/to/project/`.
2. Access the data folder: `cd data`.
3. Run the `download.py` script. The script will:
   4. Download and store snapshots of the raw data produced by each worker.
   5. Refine the raw data using a tabular format.
   6. Download and store the configuration of the task deployed.
   7. Build and store support files containing worker and user agent attributes.

The whole set of output data is stored in the results folder: `data/result/task_name`, 
where \verb|task_name| is the value of the corresponding environment variable. The folder is 
created by the download script if it does not exists. It contains 5 sub folders, one for each 
type of output data. The following table describes each of these sub folders.

|        Folder        |                            Description                             |
|:--------------------:|:------------------------------------------------------------------:|
|        `Data`        |            Contains snapshots of the raw data produced by each worker.             |
|     `Dataframe`      |      Contains tabular based refined versions of the raw data.      |
|     `Resources`      | Contains two support files for each worker with attribute about him/herself and his/her user agent. |
|        `Task`        |           Contains a backup of the task's configuration.           |
|      `Crawling`      |          Contains a crawl of the pages retrieved while using the search engine.          |

### `result/Task`

The \verb|Task| folder contains the backup of the task configuration. 

### `result/Data`

The \verb|Data| folder contains a snapshot of the data produced by each worker. 
A snapshot is a JSON dictionary. The top level object is an array. The download 
script creates an object for each batch of workers recruited within a crowdsourcing task. 
The following fragment shows the snapshot for a worker with identifier `ABEFLAGYVQ7IN4` who 
participates in the batch `Your_Batch` of the task `Your_Task`. This means that his/her 
snapshot contains an array with a single object. The `source_*` attributes represent 
the DynamoDB tables and the path on the local filesystem.

````json
[
  {
    "source_path": "result/Your_Task/Data/ABEFLAGYVQ7IN4.json",
    "source_data": "Crowd_Frame-Your-Task_Your-Batch_Data",
    "source_acl": "Crowd_Frame-Your-Task_Your-Batch_ACL",
    "source_log": "Crowd_Frame-Your-Task_Your-Batch_Logger",
    "task": {...},
    "worker": {...},
    "ip": {...},
    "uag": {...}, 
    "checks": [...],
    "questionnaires_answers": [...],
    "documents_answers": [...],
    "comments": [...],
    "logs": [...],
    "questionnaires": {...},
    "documents": {...},
    "dimensions": {...}
  }
]
````

### `result/Resources`

The `Resources` folder contains two JSON files for each worker. Let us hypothesize a 
worker recruited using the identifier `ABEFLAGYVQ7IN4`. The two support files are named 
`ABEFLAGYVQ7IN4_ip.json` and `ABEFLAGYVQ7IN4_uag.json`. 
The former contains attributes obtained by performing the reverse lookup of his/her IP addresses. 
The latter contains attributes obtained by analyzing his/her user agent strings. 
The following fragments show a subset of the information provided by the two support files.

````json
{
    "<IP-Address-1>": {
        "client_over_cloudflare_gateway": "...",
        "client_over_cloudflare_wireguard_vpn": "...",
        "cloudflare_webserver_hostname": "...",
        "cloudflare_webserver_instance": "...",
        "continent_code": "...",
        "continent_name": "Africa",
        "country_capital": "...",
        "country_code_iso2": "...",
        "country_code_iso3": "...",
        "country_currency_code_iso3": "...",
        "country_currency_name": "...",
        "country_currency_numeric": "...",
        "country_currency_symbol": "...",
        "country_flag_emoji": "...",
        "country_flag_emoji_unicode": "...",
        "country_flag_url": "...",
        "country_is_eu": false,
        "country_name": "Kenya",
        "country_name_official": "Republic of Kenya",
        "country_numeric": "...",
        "http_version": "...",
        "ip": "...",
        "ip_address_type": "...",
        "latitude": "...",
        "location_calling_code": "...",
        "location_coordinates": "...",
        "location_geoname_id": "...",
        "location_identifier": "...",
        "location_is_eu": false,
        "location_languages": [
            {
                "location_language_index": 0,
                "location_language_code_iso2": "en",
                "location_language_code_iso3": "eng",
                "location_language_scope": "I",
                "location_language_type": "L"
            },
            {
                "location_language_index": 1,
                "location_language_code_iso2": "sw",
                "location_language_code_iso3": "swa",
                "location_language_scope": "M",
                "location_language_type": "L"
            }
        ],
        "location_name": "...",
        "location_postal_code": "...",
        "longitude": "...",
        "provider_name": "...",
        "region_code": "...",
        "region_code_full": "...",
        "region_name": "...",
        "region_type": "County",
        "timezone_name": "Africa/Nairobi",
        "tls_server_name_indication": "...",
        "tls_version": "...",
        "visit_scheme": "...",
        "visit_timestamp_epoch": "...",
        "visit_timestamp_parsed": "..."
    },
    ...
}
````

````json
{
    "<User-Agent-String-1>": {
        "browser_app_code_name": "Mozilla",
        "browser_app_name": "...",
        "browser_app_version": "...",
        "browser_cookie_enabled": "...",
        "browser_engine": "...",
        "browser_name": "...",
        "browser_on_line": "...",
        "browser_pdf_viewer_enabled": "...",
        "browser_platform": "...",
        "browser_product": "...",
        "browser_product_sub": "...",
        "browser_vendor": "Google Inc.",
        "browser_vendor_sub": "",
        "browser_version": "...",
        "browser_version_major": "...",
        "connection_downlink": "...",
        "connection_downlink_max": "...",
        "connection_effective_type": "...",
        "connection_rtt": "...",
        "connection_save_data": "...",
        "connection_type": "cellular",
        "device_brand": "Samsung",
        "device_brand_code": "samsung",
        "device_brand_url": "http://www.samsung.com/",
        "device_hardware_concurrency": "...",
        "device_is_crawler": "...",
        "device_is_mobile_device": "...",
        "device_language_code": "...",
        "device_max_touch_points": 5,
        "device_memory": 2,
        "device_name": "...",
        "device_orientation": "...",
        "device_type": "...",
        "os_code": "android_11",
        "os_family": "Android",
        "os_family_code": "android",
        "os_family_vendor": "Google Inc.",
        "os_icon": "...",
        "os_icon_large": "...",
        "os_name": "Android",
        "os_url": "...",
        "os_version": "...",
        "ua": "...",
        "ua_type": "mobile-browser",
        "ua_url": "...",
        "ua_webdriver": "..."
    }
}
````

### `result/Crawling`

The `Crawling` folder contains a crawl of the web pages retrieved by the search engine 
when queried by a worker. A task requester who deploys a crowdsourcing task which 
uses the search engine within one or more evaluation dimensions can choose to 
enable the crawling by using the `enable_crawling` environment variable. The 
download script thus tries to crawl each web page if the variable is enabled. 

Initially, the download script creates two sub folders, `Metadata/` 
and `Source/`. Each web page is then assigned with an UUID (Universally Unique IDentifier). 
Let us hypothesize a page assigned with the UUID `59c0f70f-c5a6-45ec-ac90-b609e2cc66d7`, 
The script tries to download its source code. It is stored in the `Source` folder 
if the operation succeeds, in a file named `59c0f70f-c5a6-45ec-ac90-b609e2cc66d7_source`. 
The extension depends on the page's source code. 

Then, the script stores some metadata about the crawling operation of the page in 
the `Metadata` folder, in a JSON file named `59c0f70f-c5a6-45ec-ac90-b609e2cc66d7_metadata.json`. 
It is possible to understand whether the operation succeeded or not and why (i.e., by acknowledging 
the HTTP response code) and to read the value of each HTTP header. The following fragment show an 
example of metadata produced by the download script while trying to crawl one of the pages retrieved.

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
    "..."
  }
}
````

### `result/Dataframe`

The `Dataframe` folder contains a refined version of the data stored within each worker snapshot. 
The download script inserts the raw data into structures called "DataFrame". A DataFrame
is a two dimensional data structure with labeled axes that contains  heterogeneous data. 
Such structures may thus be implemented as two dimensional arrays or tables with rows and columns. 

The download script refines the raw data into up to 10 tabular dataframe serialized 
into CSV files. The final amount of dataframes serialized in the `Dataframe` folder depends 
on the environment variables configured by the task requester.    

Each `DataFrame` has a variable number of rows and columns. Their granularity 
depend on the type of data reported. 
For instance, a row of the `workers_url` dataframe contains a row for each result 
retrieved for each query submitted to the search engine while analyzing a single 
HIT's element during a given try by a single worker. A row of the `workers_answers` 
dataframe contains the answers for the evaluation dimensions provided for a single HIT's 
element during a given try by a single worker, and so on. The requester must thus be careful 
while exploring each DataFrame and properly understand what kind of data s/he is 
exploring and analyzing. The following fragments provide an example of the access 
control list for a task with a single worker recruited and an example composed of the 
answers provided by a single worker for two elements of the HIT assigned.

````csv
worker_id,in_progress,access_counter,token_input,user_agent_source,ip_address,user_agent,time_arrival,generated,task_name,ip_source,folder,time_expired,try_current,paid,status_code,platform,batch_name,try_left,token_output,unit_id,source_acl,source_data,source_log,source_path,try_last,task_id,tries_amount,questionnaire_amount,questionnaire_amount_start,questionnaire_amount_end,documents_amount,dimensions_amount,time_arrival_parsed
ABEFLAGYVQ7IN4,True,40,DXWPMUMYXSM,cf,<anonymized>,<anonymized>,"Mon, 07 Nov 2022 09:00:00 GMT",True,Sample,cf,Task-Sample/Batch-Sample/Data/BELPCXHDVUYSSJ/,False,1,False,202,custom,Batch-Sample,10,PGHWTXVNMIP,unit_0,Crowd_Frame-Sample_Batch-Sample_ACL, Crowd_Frame-Sample_Batch-Sample_Data,Crowd_Frame-Sample_Batch-Sample_Logger,result/Sample/Data/BELPCXHDVUYSSJ.json,1,Sample,10,1,1,0,3,1,2022-11-07 09:38:16 00:00
````

````csv
worker_id,paid,task_id,batch_name,unit_id,try_last,try_current,action,time_submit,time_submit_parsed,doc_index,doc_id,doc_fact_check_ground_truth_label,doc_fact_check_ground_truth_value,doc_fact_check_source,doc_speaker_name,doc_speaker_party,doc_statement_date,doc_statement_description,doc_statement_text,doc_truthfulness_value,doc_accesses,doc_time_elapsed,doc_time_start,doc_time_end,global_outcome,global_form_validity,gold_checks,time_spent_check,time_check_amount
ABEFLAGYVQ7IN4,False,Task-Sample,Batch-Sample,unit_1,1,1,Next,"Wed, 09 Nov 2022 10:19:16 GMT",2022-11-09 10:19:16 00:00,0.0,conservative-activist-steve-lonegan-claims-social-,false,1,Politifact,Steve Lonegan,REP,2022-07-12,"stated on October 1, 2011 in an interview on News 12 New Jersey's Power & Politics show:","Today, the Social Security system is broke.",10,1,2.1,1667989144,1667989146.1,False,False,False,False,False
ABEFLAGYVQ7IN4,False,Task-Sample,Batch-Sample,unit_1,1,1,Next,"Wed, 09 Nov 2022 10:19:25 GMT",2022-11-09 10:19:25 00:00,1,yes-tax-break-ron-johnson-pushed-2017-has-benefite,true,5,Politifact,Democratic Party of Wisconsin,DEM,2022-04-29,"stated on April 29, 2022 in News release:","The tax carve out (Ron) Johnson spearheaded overwhelmingly benefited the wealthiest, over small businesses.",100,1,10.27,1667989146.1,1667989156.37,False,False,False,False,False
````

Each dataframe has its own characteristics and peculiarities. However, there are several rules of thumb that a requester should remember and eventually consider while s/he performs his/her analysis:

1. The attribute `paid` is present in the whole set of dataframe. It can be used to split the data among the workers who completed or not the task. The requester may want to explore the data of who failed the task.
2. The attribute `batch_name` is present in a subset of dataframe. It can be used to split the data among the different batches of workers recruited. The requester may want to analyze separately each subset of data.
3. The attributes `try_current` and `try_last` are present in a subset of dataframe. They can be used to split the data among each try performed by each worker. The latter attribute indicates the most recent try. The requester should not forget the possible presence of multiple tries for each worker while analyzing the data. 
4. The attribute `action` is present in a subset of dataframe. It can be used to understand whether the worker proceeded to the previous/following HIT's element. The possible values are `Back`, `Next` and `Finish`. The `Finish` value indicates the last element evaluated before completing a given try. The requester should remember that only the rows with the latter two values describe the most recent answers for each element.
5. The attribute `index_selected` is present in the `workers_urls` dataframe. It can be used to filter the results retrieved by the search engine. The results with a value different from `-1` for the attribute have been selected by the worker on the user interface. If its value is equal to `4`, three other results have been previously selected. If its value is equal to `7` six other results have been previously selected, and so on. The requester may want to simply analyze the results with whom the worker interacted.
6. The attribute `type` is present in the `workers_logs` dataframe. It specifies the type of log record described by each row. The log records are generally sorted using the global timestamps. The requester can use the attribute to split the whole set of log records into subsets of the same type.
7. The dataframe `workers_acl` contains several useful information about each worker. The requester may want to merge it with the rows of the other dataframe using the `worker_id` attribute as key.  
8. The dataframe `workers_urls` contains the whole set of results retrieved by the search engine. The dataframe \verb|workers_crawling| contains information about the crawling of each result. The requester may want to merge the rows of the two dataframe `response_uuid` attribute as key.  
9. The dataframe `workers_dimensions_selection` shows the temporal ordering along with the workers chose answers for the evaluation dimensions. It is ordered using the global timestamp along with each worker made a choice. This means that the rows belonging to a worker may occur in different positions of the dataframe. This may happen if multiple workers perform the task at the same time. The requester should consider this aspect while exploring the dataframe.
10. The dataframe `worker_comments` provides the final comments of the worker. The requester should remember that providing a final comment is not mandatory for the worker, thus the dataframe may be empty.

The following table provides and overview of the whole set of dataframe produced.

|                Dataframe                |                                            Description                                            |
|:---------------------------------------:|:-------------------------------------------------------------------------------------------------:|
|            `workers_acl.csv`            |                    Contains snapshots of the raw data produced by each worker.                    |
|       `workers_ip_addresses.csv`        |                         Data concerning the IP addresses of the workers.                          |
|        `workers_user_agents.csv`        |                      Data concerning the User Agent strings of the workers.                       |
|          `workers_answers.csv`          |                    Answers provided for each evaluation dimension by workers.                     |
|       `workers_questionnaire.csv`       |                        Answers provided for each questionnaire by workers                         |
|   `workers_dimensions_selection.csv`    |       Temporal order along with each worker chooses a value for each evaluation dimension.        |
|           `workers_notes.csv`           |                             Textual annotations provided by workers.                              |
|           `workers_urls.csv`            |          Queries to the search engine provided by workers along with results retrieved.           |
|         `workers_crawling.csv`          |             Data concerning the crawling of web pages retrieved by the search engine.             |
|           `workers_logs.csv`            |                Log data produced by the logger while the workers perform the task                 |
|         `workers_comments.csv`          |            Final comments provided by workers to the requester at the end of the task.            |
|        `workers_mturk_data.csv`         |                    Data concerning workers produced by Amazon Mechanical Turk.                    |
|    `workers_prolific_study_data.csv`    |                Data concerning the study deployed on Prolific and its submissions.                |
| `workers_prolific_demographic_data.csv` | Data concerning the demographics of the workers who participate in a study published on Prolific. |
|        `workers_toloka_data.csv`        |                Data concerning the project deployed on Toloka and its submissions.                |



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
