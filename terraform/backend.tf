terraform {
  backend "s3" {
    bucket         = "spanish-tutor-tf-state"
    key            = "terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "spanish-tutor-tf-locks"
    encrypt        = true
  }
}
