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

## Installation

1. Create a [Amazon AWS Account](https://aws.amazon.com/it/)

2. Create a new IAM User ` your_iam_user`

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

5. Generate a new access key pair

6. Store the Access Key in your _credentials_ file 

   ![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white) Path: `C:\Users\your_os_user\.aws\credentials`

     Sample:

     ````
     [your_iam_user]
     aws_access_key_id=your_key
     aws_secret_access_key=your_secret
     ````

7. Clone repo [Miccighel/Crowd_Frame](https://github.com/Miccighel/Crowd_Frame)

8. Install the Yarn global binary

   ````
   npm install -g yarn
   ````
   
9. Move to repo folder:

   ````
   cd ~/path/to/project
   ````
   
10. Switch to Yarn newest version

    ````
    yarn set version berry
    ````

11. Install the dependencies:

    ````
    yarn install
    ````
