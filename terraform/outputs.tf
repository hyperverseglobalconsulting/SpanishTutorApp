output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain" {
  description = "Create A record (alias) in Route53 pointing to this"
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "Use this as the alias hosted zone ID in Route53"
  value       = aws_cloudfront_distribution.site.hosted_zone_id
}

output "acm_certificate_arn" {
  value = aws_acm_certificate.site.arn
}

output "acm_validation_records" {
  description = "Create these CNAME records in Route53 to validate the ACM certificate"
  value = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
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
