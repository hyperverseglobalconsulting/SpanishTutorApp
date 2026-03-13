output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "site_url" {
  value = "https://${var.domain_name}"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.site.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.main.api_endpoint
}

output "dynamodb_table" {
  value = aws_dynamodb_table.progress.name
}
