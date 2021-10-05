# Crowd_Frame
![](https://badges.aleen42.com/src/angular.svg) ![](https://badges.aleen42.com/src/python.svg) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://GitHub.com/Naereen/StrapDown.js/graphs/commit-activity) ![Maintainer](https://img.shields.io/badge/maintainer-Miccighel-blue) [![Github all releases](https://img.shields.io/github/downloads/Miccighel/Crowd_Frame/total.svg)](https://GitHub.com/Miccighel/Crowd_Frame/releases/) [![GitHub stars](https://badgen.net/github/stars/Miccighel/Crowd_Frame)](https://GitHub.com/Miccighel/Crowd_Frame/stargazers/) [![GitHub watchers](https://badgen.net/github/watchers/Miccighel/Crowd_Frame/)](https://GitHub.com/Miccighel/Crowd_Frame/watchers/) [![GitHub contributors](https://img.shields.io/github/contributors/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/graphs/contributors/)[![GitHub issues](https://badgen.net/github/issues/Miccighel/Crowd_Frame/)](https://GitHub.com/Miccighel/Crowd_Frame/issues/) [![GitHub issues](https://img.shields.io/github/issues/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues/) [![GitHub issues-closed](https://img.shields.io/github/issues-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/issues?q=is%3Aissue+is%3Aclosed) [![GitHub pull-requests](https://img.shields.io/github/issues-pr/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/) [![GitHub pull-requests closed](https://img.shields.io/github/issues-pr-closed/Miccighel/Crowd_Frame.svg)](https://GitHub.com/Miccighel/Crowd_Frame/pull/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)


![GitHub Contributors Image](https://contrib.rocks/image?repo=Miccighel/Crowd_Frame)

:star: Star us on GitHub — it motivates us a lot!

### A software system that allows to easily design and deploy diverse types of crowdsourcing tasks.

[![ForTheBadge built-with-science](http://ForTheBadge.com/images/badges/built-with-science.svg)](https://GitHub.com/Miccighel/Crowd_Frame)


## Table of Contents

<ul>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#task-configuration">Task Configuration</a></li>
    <li><a href="#hits-format">HITs Format</a></li>
    <li><a href="#task-performing">Task Performing</a></li>
    <li><a href="#environment-variables">Environment Variables</a></li>
    <li><a href="#local-development">Local Development</li>
    <li><a href="#references">References</li>
</ul>


## Prerequisites

- [AWS Command Line Interface](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [Node.js](https://nodejs.org/it/download/)
- [Python 3](https://www.python.org/downloads/https://nodejs.org/it/download/)

## Getting Started

1. Create a [Amazon AWS Account](https://aws.amazon.com/it/)

2. Create a new [IAM USER](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html) ` your_iam_user`

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

7. Install the Yarn global binary

   ````
   npm install -g yarn
   ````

8. Move to repo folder:

   ````
   cd ~/path/to/project
   ````

9. Switch to Yarn newest version

   ````
   yarn set version berry
   ````

10. Install the dependencies:

    ````
    yarn install
    ````

11. Move to data folder:

    ```
    cd data
    ```
    
12. Create environment file `.env`:

    Path: `your_repo_folder/data/.env`
    
13. Provide environment variables values:
    
     ````
     mail_contact=your_email_address
     budget_limit=your_usd_budget_limit
     task_name=your_task_name
     batch_name=your_batch_name
     admin_user=your_admin_username
     admin_password=your_admin_password
     aws_region=your_aws_region
     aws_private_bucket=your_private_bucket_name
     aws_deploy_bucket=your_deploy_bucket_name
     deploy_config=true
     ````
    
  14. Run python script `init.py`

      Path: `your_repo_folder/data/init.py`

      The script will:
      
      	- read your env. variables;
      	- setup the AWS infrastructure;
      	- generate an empty task configuration;
      	- deploy the task on the public bucket.
      
  15. Open your task:

      `https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html`

Crowd_Frame interacts with diverse Amazon Web Services (AWS) to deploy crowdsourcing tasks, store the data produced and so on. Each service used falls within the [AWS Free Tier](https://aws.amazon.com/free/) program. The budget limit that will block the usage of such services if/when surpassed.

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

## Task Performing

1. Assign to each worker a `workerID`:

    - It is used to identify each worker ;
    - It enables data collection when the worker performs the task;

2. Append the id as a GET parameter `?workerID=worker_id_chosen`

3. Provide the input token to the worker;

4. Provide the full URL to the worker:

   `https://your_deploy_bucket.s3.your_aws_region.amazonaws.com/your_task_name/your_batch_name/index.html?workerID=worker_id_chosen`

## Environment Variables

The following table describes each environment variables that can be set in `your_repo_folder/data/.env`

|       Variable       |                         Description                          |     Mandatory      | Value                       |
| :------------------: | :----------------------------------------------------------: | :----------------: | --------------------------- |
|    `mail_contact`    | Contact mail to receive AWS budgeting related comunications  | :heavy_check_mark: | Valid email address         |
|    `budget_limit`    | Maximum monthly money amount allowed to operate in USD; e.g., `5.0` | :heavy_check_mark: | Positive float number       |
|     `task_name`      |             Identifier of the crowdsourcing task             | :heavy_check_mark: | Any string                  |
|     `batch_name`     |             Identifier of a single task's batch              | :heavy_check_mark: | Any string                  |
|     `admin_user`     |                  Username of the admin user                  | :heavy_check_mark: | Any string                  |
|   `admin_password`   |                  Password of the admin user                  | :heavy_check_mark: | Any string                  |
|     `aws_region`     |        Region of your AWS account; e.g., `us-east-1`         | :heavy_check_mark: | Valid AWS region identifier |
| `aws_private_bucket` | Name of the private S3 bucket in which to store task configuration and data | :heavy_check_mark: | String unique across AWS    |
| `aws_deploy_bucket`  | Name of the public S3 bucket in which to deploy task source code | :heavy_check_mark: | String unique across AWS    |
|   `deploy_config`    | Allows uploading the task configuration available in the local machine. Set it to false if you already edited the configuration remotely to avoid overwriting it. | :heavy_check_mark: | `true` |
|   `server_config`    | Flag used to check if deploy the AWS logging infrastructure  |        :x:         | `true` \| `false`           |
|    `bing_api_key`    |        API Key to use `BingWebSearch` search provider        |        :x:         | Valid  Bing API Key         |

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
    	taskName: "your_task_name",
    	batchName: "your_batch_name",
    	region: "your_aws_region",
    	bucket: "your_private_bucket",
    	aws_id_key: "your_aws_key_id",
    	aws_secret_key: "your_aws_key_secret",
    	bing_api_key: "your_bing_api_key",
    	logOnConsole: true,
    };
    ````

Now you can manually edit the configuration and test everything locally.

:warning: _Remember_: each execution of the `init.py` script will overwrite this file :warning:

## Contributing

Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/dev-brach`)
3. Commit your Changes (`git commit -m 'Add some Feature'`)
4. Push to the Branch (`git push origin feature/dev-branch`)
5. Open a Pull Request


## References

This software has been already used in the past to launch several crowdsourcing tasks that lead to results published.

----

Michael Soprano, Kevin Roitero, David La Barbera, Davide Ceolin, Damiano Spina, Stefano Mizzaro, & Gianluca Demartini (2021). The Many Dimensions of Truthfulness: Crowdsourcing Misinformation Assessments on a Multidimensional Scale*. Information Processing & Management, \*58\*(6), 102710.

````tex
@article{journal-paper-ipm-2021,
  title = {{The Many Dimensions of Truthfulness: Crowdsourcing Misinformation Assessments on a Multidimensional Scale}},
  journal = {Information Processing & Management},
  volume = {58},
  number = {6},
  pages = {102710},
  year = {2021},
  issn = {0306-4573},
  doi = {https://doi.org/10.1016/j.ipm.2021.102710},
  url = {https://www.sciencedirect.com/science/article/pii/S0306457321001941},
  author = {Michael Soprano and Kevin Roitero and David {La Barbera} and Davide Ceolin and Damiano Spina and Stefano Mizzaro and Gianluca Demartini},
  keywords = {Truthfulness, Crowdsourcing, Misinformation, Explainability}
}
````
---

Roitero, K., Soprano, M., Portelli, B., De Luise, M., Spina, D., Mea, V., Serra, G., Mizzaro, S., & Demartini, G. (2021). Can The Crowd Judge Truthfulness? A Longitudinal Study on Recent Misinformation About COVID-19. Personal and Ubiquitous Computing.

````tex
@Article{journal-paper-puc-2021,
   author={Roitero, Kevin and Soprano, Michael and Portelli, Beatrice and De Luise, Massimiliano and Spina, Damiano and Mea, Vincenzo Della and Serra, Giuseppe and Mizzaro, Stefano and Demartini, Gianluca},
   title={{Can The Crowd Judge Truthfulness? A Longitudinal Study on Recent Misinformation About COVID-19}},
   journal={Personal and Ubiquitous Computing},
   year={2021},
   month={Sep},
   day={16},
   issn={1617-4917},
   doi={10.1007/s00779-021-01604-6},
   url={https://doi.org/10.1007/s00779-021-01604-6}
}
````


---

Roitero, K., Soprano, M., Portelli, B., Spina, D., Della Mea, V., Serra, G., Mizzaro, S., & Demartini, G. (2020). The COVID-19 Infodemic: Can the Crowd Judge Recent Misinformation Objectively?. In Proceedings of the 29th ACM International Conference on Information and Knowledge Management (CIKM2020). Galway, Ireland (Online). October 19-23, 2020. Conference Rank: GGS A+, Core A (pp. 1305–1314). Association for Computing Machinery.

````tex
@inproceedings{conference-paper-cikm2020,
  address = {{New York, NY, USA}},
  author = {Roitero, Kevin and Soprano, Michael and Portelli, Beatrice and Spina, Damiano and Della Mea, Vincenzo and Serra, Giuseppe and Mizzaro, Stefano and Demartini, Gianluca},
  booktitle = {{Proceedings of the 29th ACM International Conference on Information and Knowledge Management (CIKM2020). Galway, Ireland (Online). October 19-23, 2020. Conference Rank: GGS A+, Core A}},
  doi = {{10.1145/3340531.3412048}},
  isbn = {{9781450368599}},
  keywords = {{ordinal classification, infodemic, information behavior, covid-19, crowdsourcing}},
  location = {{Virtual Event, Ireland}},
  numpages = {{10}},
  pages = {{1305–1314}},
  publisher = {{Association for Computing Machinery}},
  series = {{CIKM '20}},
  title = {{The COVID-19 Infodemic: Can the Crowd Judge Recent Misinformation Objectively?}},
  url = {{https://doi.org/10.1145/3340531.3412048}},
  month = {10},
  year = {2020}
}
````



---

Roitero, K., Soprano, M., Fan, S., Spina, D., Mizzaro, S., & Demartini, G. (2020). Can The Crowd Identify Misinformation Objectively? The Effects of Judgment Scale and Assessor's Background. In *Proceedings of the 43st International ACM SIGIR Conference on Research and Development in Information Retrieval (SIGIR 2020). Xi’an, China (Online). July 25-30, 2020. Conference Rank: GGS A++, Core A** (pp. 439–448). Association for Computing Machinery.

````tex
@inproceedings{conference-paper-sigir2020,
  address = {{New York, NY, USA}},
  author = {Roitero, Kevin and Soprano, Michael and Fan, Shaoyang and Spina, Damiano and Mizzaro, Stefano and Demartini, Gianluca},
  booktitle = {{Proceedings of the 43st International ACM SIGIR Conference on Research and Development in Information Retrieval (SIGIR 2020). Xi’an, China (Online). July 25-30, 2020. Conference Rank: GGS A++, Core A*}},
  doi = {{10.1145/3397271.3401112}},
  isbn = {{9781450380164}},
  keywords = {{classification, crowdsourcing, information credibility}},
  location = {{Virtual Event, China}},
  numpages = {10},
  month = {7},
  pages = {{439–448}},
  publisher = {{Association for Computing Machinery}},
  series = {{SIGIR '20}},
  title = {{Can The Crowd Identify Misinformation Objectively? The Effects of Judgment Scale and Assessor's Background}},
  url = {{https://doi.org/10.1145/3397271.3401112}},
  year = {2020}
}
````

