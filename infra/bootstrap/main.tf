# Bootstrap: the S3 bucket that holds Terraform state for ../ (the main stack).
#
# The main stack can't create its own state bucket, so this config is applied
# once, by hand, with local state. Its terraform.tfstate only describes this
# bucket and holds no secrets. It is still gitignored; if it is lost, bring the
# bucket back under management with `terraform import`.

data "aws_caller_identity" "current" {}

locals {
  # Account-regional namespace: the name only has to be unique within this
  # account and region, and it must end in -<account-id>-<region>-an.
  bucket_name = "game-ledger-tfstate-${data.aws_caller_identity.current.account_id}-${var.region}-an"
}

resource "aws_s3_bucket" "state" {
  bucket           = local.bucket_name
  bucket_namespace = "account-regional"

  lifecycle {
    prevent_destroy = true
  }
}

# Every state write keeps the previous version, so a bad apply can be rolled back.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled       = true
    blocked_encryption_types = ["SSE-C"]
  }
}

# Old state versions and lock-file leftovers would otherwise pile up forever.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days           = 90
      newer_noncurrent_versions = 10
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

resource "aws_s3_bucket_abac" "state" {
  bucket = aws_s3_bucket.state.id

  abac_status {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "state" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json
}
