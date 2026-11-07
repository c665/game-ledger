variable "region" {
  description = "AWS region for the state bucket. Must match the region the main stack deploys into."
  type        = string
  default     = "eu-north-1"
}
