# Main Terraform configuration file for Lightweight IWMS
# Version: 1.0.0
# Provider versions:
# - hashicorp/aws ~> 4.0
# - hashicorp/random ~> 3.0

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "lightweight-iwms-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Provider Configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
  
  # Enhanced security configurations
  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformExecutionRole"
  }
}

# Local Variables
locals {
  common_tags = {
    Project         = var.project_name
    Environment     = var.environment
    ManagedBy      = "terraform"
    LastModified   = timestamp()
    ComplianceLevel = "high"
  }

  # Networking configuration
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets   = [for i, az in local.availability_zones : cidrsubnet(var.vpc_cidr, 4, i)]
  public_subnets    = [for i, az in local.availability_zones : cidrsubnet(var.vpc_cidr, 4, i + 3)]
}

# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Random ID for unique resource naming
resource "random_id" "unique" {
  byte_length = 8
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr          = var.vpc_cidr
  availability_zones = local.availability_zones
  private_subnets   = local.private_subnets
  public_subnets    = local.public_subnets

  tags = local.common_tags
}

# Database Module
module "database" {
  source = "./modules/database"

  project_name         = var.project_name
  environment         = var.environment
  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  instance_class      = var.db_instance_class
  enable_read_replica = var.enable_read_replica
  availability_zones  = local.availability_zones

  tags = local.common_tags

  depends_on = [module.networking]
}

# ECS Cluster Module
module "ecs" {
  source = "./modules/ecs"

  project_name        = var.project_name
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  
  tags = local.common_tags

  depends_on = [module.networking]
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  project_name    = var.project_name
  environment    = var.environment
  vpc_id         = module.networking.vpc_id
  cluster_name   = module.ecs.cluster_name
  database_id    = module.database.db_instance_id

  alarm_actions  = ["arn:aws:sns:${var.aws_region}:${data.aws_caller_identity.current.account_id}:${var.project_name}-${var.environment}-alerts"]
  
  tags = local.common_tags

  depends_on = [module.ecs, module.database]
}

# Security Module
module "security" {
  source = "./modules/security"

  project_name    = var.project_name
  environment    = var.environment
  vpc_id         = module.networking.vpc_id
  
  tags = local.common_tags

  depends_on = [module.networking]
}

# Outputs
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.networking.vpc_id
}

output "database_endpoints" {
  description = "Database endpoint information"
  value = {
    primary  = module.database.endpoint
    replicas = module.database.replica_endpoints
  }
  sensitive = true
}

output "monitoring_dashboard" {
  description = "URL of the CloudWatch monitoring dashboard"
  value       = module.monitoring.dashboard_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}