variable "aws_region" {
  description = "AWS region for most resources"
  default     = "ap-south-1"
}

variable "domain_name" {
  description = "Full domain for the app"
  default     = "spanish-tutor.vizeet.me"
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone"
  default     = "vizeet.me"
}

variable "openai_api_key" {
  description = "OpenAI API key stored in SSM/Secrets Manager"
  type        = string
  sensitive   = true
}

variable "app_name" {
  description = "Application name prefix"
  default     = "spanish-tutor"
}

variable "cognito_callback_urls" {
  description = "Cognito callback URLs"
  type        = list(string)
  default     = ["https://spanish-tutor.vizeet.me"]
}

variable "cognito_logout_urls" {
  description = "Cognito logout URLs"
  type        = list(string)
  default     = ["https://spanish-tutor.vizeet.me"]
}
