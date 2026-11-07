provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "game-ledger"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}
