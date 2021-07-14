# init.ipynb changelog

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
