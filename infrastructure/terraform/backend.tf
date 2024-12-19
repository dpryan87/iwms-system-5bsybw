# Backend Configuration for Lightweight IWMS Infrastructure
# Version: 1.0
# Terraform Version: ~> 1.5
# AWS Provider Version: ~> 4.0

terraform {
  # S3 Backend Configuration with enhanced security and high availability features
  backend "s3" {
    # S3 bucket for state storage with environment-specific naming
    bucket = "${var.project_name}-${var.environment}-terraform-state"
    
    # State file path with environment workspace prefixing
    key = "terraform.tfstate"
    
    # AWS region configuration from variables
    region = var.aws_region
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project_name}-${var.environment}-terraform-locks"
    
    # Enhanced security configurations
    encrypt        = true
    # KMS encryption for state file
    kms_key_id     = var.kms_key_arn
    
    # Workspace management for multiple environments
    workspace_key_prefix = var.environment
    
    # Enable versioning for state file history
    versioning = true
    
    # Additional security and durability configurations
    force_path_style = false
    sse_algorithm    = "aws:kms"
    
    # Access logging configuration
    acl           = "private"
    
    # Enhanced backend configuration
    skip_credentials_validation = false
    skip_region_validation     = false
    skip_metadata_api_check    = false
    
    # S3 bucket configuration
    force_destroy = false
    
    # Lifecycle rules for state management
    lifecycle {
      prevent_destroy = true
    }
    
    # Cross-region replication configuration
    replication_configuration {
      role = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-state-replication-role"
      
      rules {
        id     = "terraform-state-replication"
        status = "Enabled"
        
        destination {
          bucket        = "${var.project_name}-${var.environment}-terraform-state-replica"
          storage_class = "STANDARD_IA"
          
          replica_kms_key_id = var.replica_kms_key_arn
          account_id         = data.aws_caller_identity.current.account_id
          
          access_control_translation {
            owner = "Destination"
          }
        }
        
        source_selection_criteria {
          sse_kms_encrypted_objects {
            status = "Enabled"
          }
        }
      }
    }
  }
  
  # Required provider configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
  
  # Terraform version constraint
  required_version = ">= 1.5.0"
}

# Backend configuration validation
locals {
  backend_validation = {
    bucket_name_valid = can(regex("^[a-z0-9.-]+$", "${var.project_name}-${var.environment}-terraform-state"))
    region_valid      = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    table_name_valid  = can(regex("^[a-zA-Z0-9._-]+$", "${var.project_name}-${var.environment}-terraform-locks"))
  }
}

# Ensure all backend validation checks pass
check "backend_configuration" {
  assert {
    condition     = alltrue([for k, v in local.backend_validation : v])
    error_message = "Backend configuration validation failed. Check naming conventions and regional settings."
  }
}