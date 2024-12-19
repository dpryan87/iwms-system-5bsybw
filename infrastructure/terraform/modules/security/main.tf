# Provider configuration with required version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for enhanced security configurations
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = merge(var.tags, {
    Module      = "security"
    Environment = var.environment
  })

  # WAF rule configurations with rate limits
  waf_rules = {
    rate_based = {
      name     = "RateBasedRule"
      priority = 1
      limit    = lookup(var.rate_limit_rules, "global", 2000)
    }
    ip_reputation = {
      name     = "IPReputationRule"
      priority = 2
    }
    sql_injection = {
      name     = "SQLInjectionRule"
      priority = 3
    }
    xss = {
      name     = "XSSRule"
      priority = 4
    }
  }
}

# WAF Web ACL with enhanced OWASP protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${local.name_prefix}-waf"
  description = "WAF Web ACL with OWASP protection for ${var.project_name}"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate-based rule
  rule {
    name     = local.waf_rules.rate_based.name
    priority = local.waf_rules.rate_based.priority

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = local.waf_rules.rate_based.limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.name_prefix}-rate-based"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection protection
  rule {
    name     = local.waf_rules.sql_injection.name
    priority = local.waf_rules.sql_injection.priority

    override_action {
      none {}
    }

    statement {
      sql_injection_match_statement {
        field_to_match {
          body {}
        }
        text_transformation {
          priority = 1
          type     = "URL_DECODE"
        }
        text_transformation {
          priority = 2
          type     = "HTML_ENTITY_DECODE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "${local.name_prefix}-sql-injection"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${local.name_prefix}-waf-acl"
    sampled_requests_enabled  = true
  }

  tags = local.common_tags
}

# KMS key for encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for ${var.project_name} encryption"
  deletion_window_in_days = lookup(var.kms_config, "deletion_window_in_days", 30)
  enable_key_rotation     = lookup(var.kms_config, "key_rotation_enabled", true)
  multi_region           = lookup(var.kms_config, "multi_region", false)

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

# KMS alias
resource "aws_kms_alias" "main" {
  name          = "alias/${local.name_prefix}-key"
  target_key_id = aws_kms_key.main.key_id
}

# IAM roles with MFA enforcement
resource "aws_iam_role" "service_roles" {
  for_each = var.iam_roles

  name = "${local.name_prefix}-${each.key}"
  path = "/service-roles/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent": "true"
          }
        }
      }
    ]
  })

  managed_policy_arns = each.value.managed_policy_arns

  tags = merge(local.common_tags, {
    Role = each.key
  })
}

# Security Groups with enhanced protocol restrictions
resource "aws_security_group" "main" {
  for_each = var.security_groups

  name        = "${local.name_prefix}-${each.key}"
  description = "Security group for ${each.key} in ${var.project_name}"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = each.value.ingress
    content {
      description     = ingress.value.description
      from_port      = ingress.value.from_port
      to_port        = ingress.value.to_port
      protocol       = ingress.value.protocol
      cidr_blocks    = ingress.value.cidr_blocks
      security_groups = lookup(ingress.value, "security_groups", null)
    }
  }

  dynamic "egress" {
    for_each = each.value.egress
    content {
      description     = egress.value.description
      from_port      = egress.value.from_port
      to_port        = egress.value.to_port
      protocol       = egress.value.protocol
      cidr_blocks    = egress.value.cidr_blocks
      security_groups = lookup(egress.value, "security_groups", null)
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-${each.key}"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# SSO SAML provider
resource "aws_iam_saml_provider" "main" {
  name                   = "${local.name_prefix}-sso"
  saml_metadata_document = file(var.sso_config.metadata_url)

  tags = local.common_tags
}

# CloudWatch Log Group for security monitoring
resource "aws_cloudwatch_log_group" "security_logs" {
  name              = "/aws/security/${local.name_prefix}"
  retention_in_days = var.security_monitoring.log_retention_days

  tags = merge(local.common_tags, {
    Type = "SecurityMonitoring"
  })
}