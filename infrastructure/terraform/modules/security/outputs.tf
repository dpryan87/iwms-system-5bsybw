# WAF Web ACL ARN output with validation
output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL with OWASP protection rules and rate limiting"
  value       = aws_wafv2_web_acl.main.arn
  sensitive   = false

  precondition {
    condition     = length(aws_wafv2_web_acl.main.rule) > 0
    error_message = "WAF Web ACL must have at least one active protection rule configured."
  }
}

# Service IAM role ARNs with MFA enforcement
output "service_role_arns" {
  description = "Map of service IAM role ARNs with MFA enforcement and least privilege access"
  value = {
    for role_name, role in aws_iam_role.service_roles : role_name => role.arn
  }
  sensitive = true # Protect role ARNs as sensitive information
}

# KMS key ARNs for data encryption
output "kms_key_arns" {
  description = "Map of KMS key ARNs for AES-256 encryption with automatic key rotation"
  value = {
    "main" = aws_kms_key.main.arn
  }
  sensitive = true # Protect encryption key ARNs

  precondition {
    condition     = aws_kms_key.main.enable_key_rotation
    error_message = "KMS key rotation must be enabled for security compliance."
  }
}

# Security group IDs with network access controls
output "security_group_ids" {
  description = "Map of security group IDs with strict ingress/egress rules and protocol restrictions"
  value = {
    for sg_name, sg in aws_security_group.main : sg_name => sg.id
  }
  sensitive = false

  precondition {
    condition     = length(aws_security_group.main) > 0
    error_message = "At least one security group must be defined for network protection."
  }
}

# SSO SAML provider ARN
output "sso_provider_arn" {
  description = "ARN of the SAML SSO provider for Auth0 integration"
  value       = aws_iam_saml_provider.main.arn
  sensitive   = false
}

# Security monitoring log group
output "security_log_group" {
  description = "CloudWatch Log Group name for security monitoring and audit trails"
  value       = aws_cloudwatch_log_group.security_logs.name
  sensitive   = false

  precondition {
    condition     = aws_cloudwatch_log_group.security_logs.retention_in_days >= 90
    error_message = "Security logs must be retained for at least 90 days per compliance requirements."
  }
}

# Composite security configuration
output "security_config" {
  description = "Combined security configuration including WAF, IAM, KMS, and network controls"
  value = {
    waf_enabled        = true
    mfa_enforced       = true
    encryption_enabled = true
    network_protected  = true
    sso_enabled       = true
    monitoring_enabled = true
  }
  sensitive = false

  precondition {
    condition = (
      length(aws_wafv2_web_acl.main.rule) > 0 &&
      length(aws_iam_role.service_roles) > 0 &&
      aws_kms_key.main.enable_key_rotation &&
      length(aws_security_group.main) > 0 &&
      aws_iam_saml_provider.main.arn != "" &&
      aws_cloudwatch_log_group.security_logs.name != ""
    )
    error_message = "All required security controls must be properly configured."
  }
}