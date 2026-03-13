terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# CloudFront requires ACM certs in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_route53_zone" "main" {
  name         = var.hosted_zone_name
  private_zone = false
}

data "aws_caller_identity" "current" {}

# ─────────────────────────────────────────────
# S3 BUCKET – static site hosting
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "site" {
  bucket        = var.domain_name
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
        }
      }
    }]
  })
}

# ─────────────────────────────────────────────
# ACM CERTIFICATE (us-east-1 for CloudFront)
# ─────────────────────────────────────────────
resource "aws_acm_certificate" "site" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# NOTE: After `terraform apply`, go to ACM in us-east-1 console,
# copy the CNAME validation record, and create it manually in Route53.
# Once validated, CloudFront will serve on spanish-tutor.vizeet.me.
# Then create an A record (alias) in Route53 pointing to the CloudFront distribution.

# ─────────────────────────────────────────────
# CLOUDFRONT OAC + DISTRIBUTION
# ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.app_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA fallback – serve index.html for 403/404
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.site.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  depends_on = [aws_acm_certificate.site]
}

# ─────────────────────────────────────────────
# ROUTE53 – A record pointing to CloudFront
# ─────────────────────────────────────────────
resource "aws_route53_record" "site" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─────────────────────────────────────────────
# COGNITO USER POOL
# ─────────────────────────────────────────────
resource "aws_cognito_user_pool" "main" {
  name = "${var.app_name}-users"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.app_name
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.app_name}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = var.cognito_callback_urls
  logout_urls                          = var.cognito_logout_urls
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  prevent_user_existence_errors = "ENABLED"
}

# ─────────────────────────────────────────────
# DYNAMODB – progress tracking
# ─────────────────────────────────────────────
resource "aws_dynamodb_table" "progress" {
  name         = "${var.app_name}-progress"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB – curriculum content (vocab, units, phases, scenarios)
# ─────────────────────────────────────────────
resource "aws_dynamodb_table" "curriculum" {
  name         = "${var.app_name}-curriculum"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB – learning events (analytics)
# ─────────────────────────────────────────────
resource "aws_dynamodb_table" "events" {
  name         = "${var.app_name}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}

# ─────────────────────────────────────────────
# S3 – analytics data lake
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "analytics" {
  bucket        = "${var.app_name}-analytics-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_lifecycle_configuration" "analytics" {
  bucket = aws_s3_bucket.analytics.id

  rule {
    id     = "expire-old-data"
    status = "Enabled"
    expiration {
      days = 365
    }
  }
}

# ─────────────────────────────────────────────
# GLUE – catalog database + crawler for analytics
# ─────────────────────────────────────────────
resource "aws_glue_catalog_database" "analytics" {
  name = replace("${var.app_name}-analytics", "-", "_")
}

resource "aws_iam_role" "glue" {
  name = "${var.app_name}-glue-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "glue.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "glue" {
  name = "${var.app_name}-glue-policy"
  role = aws_iam_role.glue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.analytics.arn, "${aws_s3_bucket.analytics.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["glue:*"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:DescribeTable", "dynamodb:Scan", "dynamodb:GetItem"]
        Resource = [aws_dynamodb_table.events.arn, aws_dynamodb_table.progress.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_glue_crawler" "events" {
  name          = "${var.app_name}-events-crawler"
  database_name = aws_glue_catalog_database.analytics.name
  role          = aws_iam_role.glue.arn
  schedule      = "cron(0 6 ? * MON *)"

  dynamodb_target {
    path = aws_dynamodb_table.events.name
  }
}

# ─────────────────────────────────────────────
# ATHENA – query workgroup
# ─────────────────────────────────────────────
resource "aws_athena_workgroup" "main" {
  name = "${var.app_name}-analytics"

  configuration {
    result_configuration {
      output_location = "s3://${aws_s3_bucket.analytics.id}/athena-results/"
    }
    enforce_workgroup_configuration = true
  }
}

# ─────────────────────────────────────────────
# SSM PARAMETER – OpenAI key
# ─────────────────────────────────────────────
resource "aws_ssm_parameter" "openai_key" {
  name  = "/${var.app_name}/openai-api-key"
  type  = "SecureString"
  value = var.openai_api_key
}

# ─────────────────────────────────────────────
# IAM ROLE – Lambda execution
# ─────────────────────────────────────────────
resource "aws_iam_role" "lambda" {
  name = "${var.app_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.app_name}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:BatchWriteItem", "dynamodb:BatchGetItem"]
        Resource = [
          aws_dynamodb_table.progress.arn,
          aws_dynamodb_table.curriculum.arn,
          "${aws_dynamodb_table.curriculum.arn}/index/*",
          aws_dynamodb_table.events.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = "${aws_s3_bucket.analytics.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = aws_ssm_parameter.openai_key.arn
      }
    ]
  })
}

# ─────────────────────────────────────────────
# LAMBDA – Progress API
# ─────────────────────────────────────────────
data "archive_file" "progress_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/progress/index.mjs"
  output_path = "${path.module}/../lambda/progress.zip"
}

# ─────────────────────────────────────────────
# CLOUDWATCH LOG GROUPS (3-day retention)
# ─────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "lambda_progress" {
  name              = "/aws/lambda/${var.app_name}-progress"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "lambda_chatbot" {
  name              = "/aws/lambda/${var.app_name}-chatbot"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "lambda_curriculum" {
  name              = "/aws/lambda/${var.app_name}-curriculum"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "lambda_analytics" {
  name              = "/aws/lambda/${var.app_name}-analytics"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "lambda_seed" {
  name              = "/aws/lambda/${var.app_name}-seed"
  retention_in_days = 3
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.app_name}-api"
  retention_in_days = 3
}

resource "aws_lambda_function" "progress" {
  function_name    = "${var.app_name}-progress"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  filename         = data.archive_file.progress_lambda.output_path
  source_code_hash = data.archive_file.progress_lambda.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.lambda_progress]

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.progress.name
    }
  }
}

# ─────────────────────────────────────────────
# LAMBDA – Chatbot API
# ─────────────────────────────────────────────
data "archive_file" "chatbot_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/chatbot/index.mjs"
  output_path = "${path.module}/../lambda/chatbot.zip"
}

resource "aws_lambda_function" "chatbot" {
  function_name    = "${var.app_name}-chatbot"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  filename         = data.archive_file.chatbot_lambda.output_path
  source_code_hash = data.archive_file.chatbot_lambda.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.lambda_chatbot]

  environment {
    variables = {
      SSM_OPENAI_KEY = aws_ssm_parameter.openai_key.name
      TABLE_NAME     = aws_dynamodb_table.progress.name
    }
  }
}

# ─────────────────────────────────────────────
# LAMBDA – Curriculum API (CRUD for vocab, units, phases, scenarios)
# ─────────────────────────────────────────────
data "archive_file" "curriculum_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/curriculum-api/index.mjs"
  output_path = "${path.module}/../lambda/curriculum-api.zip"
}

resource "aws_lambda_function" "curriculum" {
  function_name    = "${var.app_name}-curriculum"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  filename         = data.archive_file.curriculum_lambda.output_path
  source_code_hash = data.archive_file.curriculum_lambda.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.lambda_curriculum]

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.curriculum.name
    }
  }
}

# ─────────────────────────────────────────────
# LAMBDA – Analytics API (record + query learning events)
# ─────────────────────────────────────────────
data "archive_file" "analytics_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/analytics/index.mjs"
  output_path = "${path.module}/../lambda/analytics.zip"
}

resource "aws_lambda_function" "analytics" {
  function_name    = "${var.app_name}-analytics"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 10
  filename         = data.archive_file.analytics_lambda.output_path
  source_code_hash = data.archive_file.analytics_lambda.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.lambda_analytics]

  environment {
    variables = {
      EVENTS_TABLE   = aws_dynamodb_table.events.name
      PROGRESS_TABLE = aws_dynamodb_table.progress.name
    }
  }
}

# ─────────────────────────────────────────────
# LAMBDA – Seed (populate curriculum table from vocab data)
# ─────────────────────────────────────────────
data "archive_file" "seed_lambda" {
  type        = "zip"
  source_file = "${path.module}/../lambda/seed/index.mjs"
  output_path = "${path.module}/../lambda/seed.zip"
}

resource "aws_lambda_function" "seed" {
  function_name    = "${var.app_name}-seed"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 120
  memory_size      = 512
  filename         = data.archive_file.seed_lambda.output_path
  source_code_hash = data.archive_file.seed_lambda.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.lambda_seed]

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.curriculum.name
    }
  }
}

# ─────────────────────────────────────────────
# API GATEWAY (HTTP API)
# ─────────────────────────────────────────────
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.app_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["https://${var.domain_name}"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# Progress routes
resource "aws_apigatewayv2_integration" "progress" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.progress.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "progress_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/progress"
  target             = "integrations/${aws_apigatewayv2_integration.progress.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "progress_put" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /api/progress"
  target             = "integrations/${aws_apigatewayv2_integration.progress.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Chatbot routes
resource "aws_apigatewayv2_integration" "chatbot" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.chatbot.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "chatbot_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/chat"
  target             = "integrations/${aws_apigatewayv2_integration.chatbot.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Stage
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "apigw_progress" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.progress.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_chatbot" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chatbot.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Curriculum routes
resource "aws_apigatewayv2_integration" "curriculum" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.curriculum.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "curriculum_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/curriculum/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.curriculum.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "curriculum_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/curriculum/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.curriculum.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "curriculum_put" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /api/curriculum/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.curriculum.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "curriculum_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /api/curriculum/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.curriculum.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "apigw_curriculum" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.curriculum.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Analytics routes
resource "aws_apigatewayv2_integration" "analytics" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.analytics.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "analytics_post" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /api/analytics/events"
  target             = "integrations/${aws_apigatewayv2_integration.analytics.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "analytics_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /api/analytics/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.analytics.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "apigw_analytics" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
