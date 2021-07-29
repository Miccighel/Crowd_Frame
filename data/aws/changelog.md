# init.ipynb changelog

## 2021-07-28 Francesco Bombassei De Bona

### Added

- env variables server_endpoint: string and logOnConsole: boolean
- logOption to task.json to precisely select which event to monitor
- logger toggle and options on generator page
- integration for the previous where it was needed

### Changed

- logger service downloads options before angular init
- directives adapt to logger options
- refactoring where it was needed

## 2021-07-16 Michael soprano

### Added

- env variable profile_name to specify a credentials profile and skip step #4
- missing PutObjectAcl policy in config_user generation

### Changed

- index.zip and policy/ removed from .gitignore
- user_policy.json and checks.json encapsulated inside init.py
- Overall refactoring of init.py
- init.py merged with user_script.py
- generated JSONs now are serialized in aws/generated

## 2021-07-14 Francesco Bombassei De Bona

### Added

- New boolean env variable to deploy the AWS infrastructure;
- Section to input AWS credential by manually inserting key and secret or by inserting the name of a profile present in `configuration` file in `.aws` folder;
- Section to check if the provided user has the necessary policies to continue. If not, is notified about what is missing, and the program closes itself;
- Scripts to generate the AWS infrastructure to receive log requests.

### Changed

- boto3 client and all it's child clients are now instanced using the Session object which is configured based on the authentication method decided by the user;
- fixed a bug in bucket creation: you can put a constraint on the location if is the default one.

### Removed

## 2021-07-15 Francesco Bombassei De Bona

### Added

- Exported notebook to py script file
- New script for creating a configuration user on AWS
- Policy json for previous script

### Changed

- init.py tuning for better aesthetic

### Removed
