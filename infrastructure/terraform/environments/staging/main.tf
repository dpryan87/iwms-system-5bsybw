# Terraform configuration for Lightweight IWMS Staging Environment
# Version: 1.0.0
# Provider versions:
# - hashicorp/aws ~> 4.16.0
# - hashicorp/random ~> 3.4.0
# - hashicorp/time ~> 0.9.0

terraform {
  required_version = ">=1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9.0"
    }
  }

  backend "s3" {
    bucket         = "lightweight-iwms-terraform-state"
    key            = "environments/staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    workspace_key_prefix = "staging"
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  common_tags = {
    Environment   = local.environment
    Project      = var.project_name
    ManagedBy    = "terraform"
    CostCenter   = "staging-testing"
    AutoShutdown = "true"
  }
}

# Staging-specific variables
variable "enable_enhanced_monitoring" {
  type    = bool
  default = true
}

variable "enable_auto_shutdown" {
  type    = bool
  default = true
}

variable "business_hours" {
  type    = string
  default = "0800-1800"
}

variable "test_data_enabled" {
  type    = bool
  default = true
}

# Provider configuration for staging
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Networking module for staging
module "networking" {
  source = "../../modules/networking"

  project_name = var.project_name
  environment  = local.environment
  
  # Staging-specific networking configuration
  vpc_cidr           = "10.1.0.0/16"  # Staging VPC CIDR
  enable_nat_gateway = true
  single_nat_gateway = true  # Cost optimization for staging
  
  tags = local.common_tags
}

# Compute module for staging
module "compute" {
  source = "../../modules/compute"

  project_name = var.project_name
  environment  = local.environment
  vpc_id       = module.networking.vpc_id
  
  # Staging-specific compute configuration
  cluster_name = "staging-ecs-cluster"
  desired_count = 1
  cpu          = 256
  memory       = 512
  
  # Auto-shutdown configuration
  enable_auto_shutdown = var.enable_auto_shutdown
  business_hours      = var.business_hours
  
  tags = local.common_tags

  depends_on = [module.networking]
}

# Database module for staging
module "database" {
  source = "../../modules/database"

  project_name = var.project_name
  environment  = local.environment
  vpc_id       = module.networking.vpc_id
  
  # Staging-specific database configuration
  instance_class    = "db.t3.medium"  # Smaller instance for staging
  allocated_storage = 20
  multi_az         = false  # Cost optimization for staging
  
  # Test data configuration
  enable_test_data = var.test_data_enabled
  
  tags = local.common_tags

  depends_on = [module.networking]
}

# Monitoring module for staging
module "monitoring" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = local.environment
  vpc_id       = module.networking.vpc_id
  
  # Enhanced monitoring for staging testing
  enable_enhanced_monitoring = var.enable_enhanced_monitoring
  retention_days            = 7  # Shorter retention for staging
  
  # Alert configuration
  alert_endpoints = {
    email = ["staging-alerts@example.com"]
    slack = "staging-channel"
  }
  
  tags = local.common_tags

  depends_on = [module.compute, module.database]
}

# Time-based resources for auto-shutdown
resource "time_recurring_schedule" "business_hours" {
  count = var.enable_auto_shutdown ? 1 : 0

  schedule    = var.business_hours
  start_time  = timeadd(timestamp(), "24h")
  time_zone   = "UTC"
}

# Outputs
output "vpc_id" {
  description = "ID of the staging VPC"
  value       = module.networking.vpc_id
}

output "database_endpoint" {
  description = "Endpoint of the staging database"
  value       = module.database.db_endpoint
  sensitive   = true
}

output "monitoring_endpoints" {
  description = "Monitoring endpoints for staging environment"
  value = {
    prometheus = module.monitoring.prometheus_endpoint
    grafana    = module.monitoring.grafana_endpoint
  }
}

# Random ID for unique resource naming in staging
resource "random_id" "staging_suffix" {
  byte_length = 4
}