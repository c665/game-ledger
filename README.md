# game-ledger

Wallet ledger and event-sourced game rounds in TypeScript and PostgreSQL, with Terraform for AWS.

## Infrastructure

The Terraform for AWS lives in `infra/`. Its state is kept in an S3 bucket, which a small separate config in `infra/bootstrap/` creates. The bootstrap itself uses local state.

### Create the state bucket (once per AWS account)

```bash
cd infra/bootstrap
terraform init
terraform apply
terraform output -raw backend_config > ../state.s3.tfbackend
```

### Connect the main stack

`infra/backend.tf` declares an empty `backend "s3" {}`. Its settings live in `infra/state.s3.tfbackend`, which is gitignored because the bucket name contains the AWS account ID. If you didn't run the bootstrap yourself, create the file by hand:

```hcl
bucket       = "game-ledger-tfstate-<account-id>-eu-north-1-an"
key          = "game-ledger/terraform.tfstate"
region       = "eu-north-1"
encrypt      = true
use_lockfile = true
```

Then initialise the main stack:

```bash
cd infra
terraform init -backend-config=state.s3.tfbackend
```
