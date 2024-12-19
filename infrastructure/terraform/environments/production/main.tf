# Production Environment Terraform Configuration
# Terraform Version: ~> 1.5
# AWS Provider Version: ~> 4.0
# Random Provider Version: ~> 3.0

terraform {
  required_version = "~> 1.5"
  
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
    encrypt        = true
    bucket         = "lightweight-iwms-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "terraform-state-lock"
  }
}

# Local variables for production environment
locals {
  environment = "production"
  common_tags = {
    Project          = var.project_name
    Environment      = local.environment
    ManagedBy        = "terraform"
    CostCenter       = "production-infrastructure"
    BackupPolicy     = "daily"
    ComplianceLevel  = "high"
  }
  monitoring_config = {
    detailed_monitoring    = true
    log_retention_days    = 90
    alarm_evaluation_periods = 3
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformProductionRole"
  }
}

# Production Networking Module
module "networking" {
  source = "../../modules/networking"

  environment         = local.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  
  enable_nat_gateway = true
  single_nat_gateway = false
  enable_vpn_gateway = true
  
  enable_flow_logs   = true
  flow_logs_retention_days = local.monitoring_config.log_retention_days

  tags = merge(local.common_tags, {
    Component = "networking"
  })
}

# Production Database Module
module "database" {
  source = "../../modules/database"
  
  environment = local.environment
  vpc_id      = module.networking.vpc_id
  subnet_ids  = module.networking.private_subnet_ids

  instance_class = "db.r6g.xlarge"
  engine_version = "14"
  
  multi_az                = true
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  monitoring_interval     = var.monitoring_interval
  monitoring_role_name   = "${var.project_name}-rds-monitoring-role"
  
  enable_read_replica    = true
  read_replica_count     = 2
  
  deletion_protection    = true
  skip_final_snapshot    = false
  
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = merge(local.common_tags, {
    Component = "database"
  })
}

# CloudWatch Monitoring and Alarms
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.project_name}-${local.environment}-database-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = local.monitoring_config.alarm_evaluation_periods
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Database CPU utilization is too high"
  alarm_actions       = ["${aws_sns_topic.alerts.arn}"]

  dimensions = {
    DBInstanceIdentifier = module.database.db_instance_id
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-${local.environment}-alerts"
  
  tags = merge(local.common_tags, {
    Component = "monitoring"
  })
}

# Outputs for dependent configurations
output "vpc_id" {
  description = "ID of the production VPC"
  value       = module.networking.vpc_id
}

output "database_endpoint" {
  description = "Endpoint of the production database"
  value       = module.database.db_endpoint
  sensitive   = true
}

output "database_read_replica_endpoints" {
  description = "Endpoints of the database read replicas"
  value       = module.database.read_replica_endpoints
  sensitive   = true
}

output "monitoring_topic_arn" {
  description = "ARN of the SNS monitoring topic"
  value       = aws_sns_topic.alerts.arn
}