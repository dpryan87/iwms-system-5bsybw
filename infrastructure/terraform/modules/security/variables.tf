# Project Identification Variables
variable "project_name" {
  type        = string
  description = "Name of the project used for resource naming and tagging"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g., dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# WAF Configuration
variable "waf_config" {
  type = map(any)
  description = "WAF configuration including OWASP rules, rate limits, and IP reputation filtering"
  validation {
    condition     = can(lookup(var.waf_config, "rules")) && can(lookup(var.waf_config, "rate_limits"))
    error_message = "WAF configuration must include 'rules' and 'rate_limits' settings."
  }
}

# IAM Role Configurations
variable "iam_roles" {
  type = map(any)
  description = "IAM role definitions with least privilege access and MFA enforcement"
  validation {
    condition     = alltrue([
      for role in var.iam_roles : contains(keys(role), "permissions") && contains(keys(role), "mfa_required")
    ])
    error_message = "Each IAM role must specify permissions and MFA requirements."
  }
}

# KMS Configuration
variable "kms_config" {
  type        = map(any)
  description = "KMS key configuration for AES-256 encryption and key rotation policies"
  sensitive   = true
  validation {
    condition     = can(lookup(var.kms_config, "key_rotation_enabled")) && can(lookup(var.kms_config, "deletion_window_in_days"))
    error_message = "KMS configuration must include key rotation and deletion window settings."
  }
}

# Security Group Configurations
variable "security_groups" {
  type = map(any)
  description = "Security group rules with strict ingress/egress controls and protocol restrictions"
  validation {
    condition     = alltrue([
      for sg in var.security_groups : can(lookup(sg, "ingress")) && can(lookup(sg, "egress"))
    ])
    error_message = "Each security group must define both ingress and egress rules."
  }
}

# SSO Configuration
variable "sso_config" {
  type = map(any)
  description = "SSO integration settings for Auth0 with SAML 2.0 protocol support"
  validation {
    condition     = can(lookup(var.sso_config, "provider")) && can(lookup(var.sso_config, "metadata_url"))
    error_message = "SSO configuration must include provider and metadata URL."
  }
}

# MFA Settings
variable "mfa_settings" {
  type = map(any)
  description = "Multi-factor authentication configuration including allowed MFA types and enforcement rules"
  validation {
    condition     = can(lookup(var.mfa_settings, "enabled")) && can(lookup(var.mfa_settings, "allowed_methods"))
    error_message = "MFA settings must specify enabled status and allowed authentication methods."
  }
}

# Data Protection Configuration
variable "data_protection" {
  type = map(any)
  description = "Data protection settings including encryption standards and compliance requirements"
  validation {
    condition     = alltrue([
      can(lookup(var.data_protection, "encryption_algorithm")),
      can(lookup(var.data_protection, "key_length")),
      var.data_protection.encryption_algorithm == "AES" && var.data_protection.key_length >= 256
    ])
    error_message = "Data protection must use AES-256 or stronger encryption."
  }
}

# WAF Rate Limiting
variable "rate_limit_rules" {
  type = map(number)
  description = "Rate limiting rules for different API endpoints and services"
  validation {
    condition     = alltrue([for limit in values(var.rate_limit_rules) : limit > 0 && limit <= 10000])
    error_message = "Rate limits must be between 1 and 10000 requests per period."
  }
}

# Security Monitoring
variable "security_monitoring" {
  type = map(any)
  description = "Security monitoring and alerting configuration"
  validation {
    condition     = can(lookup(var.security_monitoring, "log_retention_days")) && var.security_monitoring.log_retention_days >= 90
    error_message = "Security logs must be retained for at least 90 days."
  }
}

# Compliance Tags
variable "compliance_tags" {
  type = map(string)
  description = "Tags for tracking compliance requirements and security standards"
  validation {
    condition     = contains(keys(var.compliance_tags), "data_classification")
    error_message = "Compliance tags must include data classification level."
  }
}