# game-ledger

Wallet ledger and event-sourced game rounds in TypeScript and PostgreSQL, with Terraform for AWS.

## Database

The wallet's schema lives in `wallet/db/` as [Sqitch](https://sqitch.org) changes. Each change has a `deploy`, a `revert` and a `verify` SQL script, and `sqitch.plan` lists the changes in order. Sqitch runs from its Docker image through Docker Compose, so there is nothing to install.

```bash
docker compose up -d --wait             # start PostgreSQL
npm run db:deploy                       # apply pending changes, verifying each one
npm run sqitch -- add <name> -n "why"   # create a new change
npm run sqitch -- status                # show what is deployed
npm run sqitch -- revert --to @HEAD^    # undo the last change
```

`sqitch add` signs the plan entry with your git name and email.

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

## Known limitations

### Wallet

#### A transaction that arrives after its rollback is still applied

A rollback names only the transaction it undoes. The wallet takes necessary info (wallet, amount) from that original transaction. If the original isn't in the ledger, the wallet rejects the rollback.

That leaves one gap. If a transaction times out on the caller's side, the caller rolls it back, and the original then reaches the wallet late (delayed or retried), the wallet has already rejected the rollback and now applies the transaction. Money moves for a transaction the caller considers cancelled.

This takes a timeout followed by a delayed request, so it should be rare, but it is a real correctness gap and is accepted for now. The planned fix: the wallet records a rollback of an unknown transaction as a tombstone (the transaction is cancelled and no money moves), rejects any later transaction whose ID has a tombstone, and makes a transaction and its rollback coordinate on the transaction ID (for example with `SERIALIZABLE` isolation), so they can't both commit when they race.
