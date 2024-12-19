# Terraform and Provider Version Requirements
# AWS Provider Version: ~> 5.0
# Random Provider Version: ~> 3.5
# Null Provider Version: ~> 3.2
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Primary AWS Provider Configuration
provider "aws" {
  region = var.aws_region
  
  # Default tags applied to all resources
  default_tags {
    tags = {
      Project             = "lightweight-iwms"
      Environment         = var.environment
      ManagedBy          = "terraform"
      Service            = "iwms-platform"
      LastUpdated        = timestamp()
      HighAvailability   = "enabled"
      SecurityCompliance = "iso27001"
    }
  }

  # Enhanced security configurations
  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "terraform-iwms-session"
  }
}

# Secondary AWS Provider for Multi-Region Support
provider "aws" {
  alias  = "dr_region"
  region = var.dr_region

  # Disaster recovery region tags
  default_tags {
    tags = {
      Project             = "lightweight-iwms"
      Environment         = var.environment
      ManagedBy          = "terraform"
      Service            = "iwms-platform-dr"
      LastUpdated        = timestamp()
      HighAvailability   = "enabled"
      SecurityCompliance = "iso27001"
      ReplicationType    = "disaster-recovery"
    }
  }

  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "terraform-iwms-dr-session"
  }
}

# Random Provider for Resource Naming
provider "random" {
  # Environment-based keepers for consistent random values
  keepers = {
    environment = var.environment
    region      = var.aws_region
  }
}

# Null Provider for Custom Operations
provider "null" {
  # Environment-based triggers for resource management
  triggers = {
    environment = var.environment
    region      = var.aws_region
    timestamp   = timestamp()
  }
}

# Provider Feature Flags
provider "aws" {
  alias = "feature_flags"
  
  # Enable advanced features for production environment
  dynamic "feature_flags" {
    for_each = var.environment == "production" ? [1] : []
    content {
      enable_enhanced_monitoring = true
      enable_backup_encryption   = true
      enable_performance_insights = true
    }
  }
}

# Provider Configurations for High Availability
provider "aws" {
  alias = "ha_config"
  
  # High availability specific configurations
  endpoints {
    dynamodb = "dynamodb.${var.aws_region}.amazonaws.com"
    s3       = "s3.${var.aws_region}.amazonaws.com"
    ec2      = "ec2.${var.aws_region}.amazonaws.com"
    rds      = "rds.${var.aws_region}.amazonaws.com"
  }

  # Retry configuration for improved reliability
  config {
    max_retries = 10
    retry_mode  = "adaptive"
  }
}