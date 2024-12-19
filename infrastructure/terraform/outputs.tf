# Terraform outputs definition file for Lightweight IWMS platform
# Version: ~> 1.5

# VPC and Networking Outputs
output "vpc_details" {
  description = "VPC configuration details including networking and security"
  value = {
    vpc_id             = module.networking.vpc_id
    private_subnets    = module.networking.private_subnet_ids
    public_subnets     = module.networking.public_subnet_ids
    vpc_flow_log_id    = module.networking.vpc_flow_log_id
  }
}

# Database Connectivity Outputs
output "database_endpoints" {
  description = "Database connection endpoints for primary and read replicas"
  value = {
    primary_endpoint     = module.database.endpoint
    read_replicas       = module.database.read_replica_endpoints
    monitoring_endpoint = module.database.monitoring_endpoint
  }
  sensitive = true
}

# Monitoring and Observability Outputs
output "monitoring_endpoints" {
  description = "Monitoring and observability platform endpoints"
  value = {
    dashboard_url       = module.monitoring.cloudwatch_dashboard_url
    alarm_topic_arn    = module.monitoring.alarm_topic_arn
  }
}

# High Availability Configuration
output "ha_configuration" {
  description = "High availability deployment configuration"
  value = {
    availability_zones = length(module.networking.private_subnet_ids)
    read_replica_count = length(module.database.read_replica_endpoints)
    multi_az_enabled   = var.environment == "production" ? true : false
  }
}

# System Performance Metrics
output "performance_metrics" {
  description = "System performance and availability metrics endpoints"
  value = {
    cloudwatch_namespace = "IWMS/${var.environment}"
    metrics_endpoint     = "https://monitoring.${var.environment}.iwms.internal/metrics"
    health_check_endpoint = "https://api.${var.environment}.iwms.internal/health"
  }
}

# Security Configuration
output "security_config" {
  description = "Security configuration and monitoring endpoints"
  value = {
    vpc_flow_logs_enabled = true
    encryption_at_rest    = true
    ssl_enabled          = true
    backup_retention     = var.environment == "production" ? "30" : "7"
  }
}

# Infrastructure Status
output "infrastructure_status" {
  description = "Current infrastructure deployment status"
  value = {
    environment         = var.environment
    deployment_region   = data.aws_region.current.name
    high_availability  = var.environment == "production" ? true : false
    monitoring_enabled = true
  }
}

# Resource Tags
output "resource_tags" {
  description = "Common resource tags applied to infrastructure"
  value = {
    Environment = var.environment
    Service     = "iwms"
    ManagedBy   = "terraform"
    Project     = "lightweight-iwms"
  }
}

# Data Sources
data "aws_region" "current" {}