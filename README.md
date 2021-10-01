# Crowd_Frame
![](https://badges.aleen42.com/src/angular.svg) ![](https://badges.aleen42.com/src/python.svg)

:star: Star us on GitHub — it motivates us a lot!

### A software system that allows to easily design and deploy diverse types of crowdsourcing tasks.

## Table of Contents

<ul>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#installation">Installation</a></li>
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
    
12. Create environment file:

    Path: `your_repo_folder/data/.env`
    
13. Provide environment variables values:
    
     ````
     task_name=your_task_name
     batch_name=your_batch_name
     admin_user=your_admin_username
     admin_password=your_admin_password
     aws_region=your_aws_region
     aws_private_bucket=your_private_bucket_name
     aws_deploy_bucket=your_deploy_bucket_name
     bing_api_key=your_bing_api_key
     deploy_config=true_or_false
     server_config=true_or_false
     ````
    

​       Please refer to the Table for a detailed explanation.

## Usage
