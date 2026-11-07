output "state_bucket" {
  description = "Name of the S3 bucket that holds Terraform state."
  value       = aws_s3_bucket.state.bucket
}

# The main stack declares an empty `backend "s3" {}` and reads these settings
# from a gitignored file, so the bucket name (which contains the account ID)
# never lands in the repo:
#
#   terraform output -raw backend_config > ../state.s3.tfbackend
#   cd .. && terraform init -backend-config=state.s3.tfbackend
output "backend_config" {
  description = "Contents of the main stack's gitignored state.s3.tfbackend file."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.state.bucket}"
    key          = "game-ledger/terraform.tfstate"
    region       = "${var.region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
