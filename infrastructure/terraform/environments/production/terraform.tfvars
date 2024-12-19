# Production Environment Configuration
# Terraform Version: ~> 1.5
# Last Updated: 2024

# Project Identification
project_name = "lightweight-iwms"
environment  = "production"

# Regional Configuration
aws_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b", 
  "us-west-2c"
]

# Database Configuration
# R6g instance class provides better price-performance ratio with ARM-based processors
db_instance_class = "db.r6g.xlarge"
enable_read_replica = true

# Resource Tagging Strategy
tags = {
  Environment  = "production"
  Project      = "lightweight-iwms"
  ManagedBy    = "terraform"
  BusinessUnit = "Facilities"
  CostCenter   = "FAC-PROD-001"
}

# ECS Configuration
ecs_instance_type = "c6g.xlarge"
min_capacity = 2
max_capacity = 8
desired_capacity = 4

# Load Balancer Configuration
enable_alb = true
alb_idle_timeout = 60
enable_access_logs = true

# Monitoring Configuration
enable_enhanced_monitoring = true
monitoring_interval = 30
backup_retention_period = 30

# Security Configuration
enable_encryption = true
enable_ssl = true
ssl_certificate_arn = "arn:aws:acm:us-west-2:ACCOUNT_ID:certificate/CERTIFICATE_ID"

# High Availability Configuration
multi_az = true
enable_auto_failover = true
backup_window = "03:00-04:00"
maintenance_window = "Mon:04:00-Mon:05:00"

# Performance Configuration
enable_performance_insights = true
performance_insights_retention = 7
enable_auto_minor_version_upgrade = true

# Storage Configuration
storage_type = "gp3"
allocated_storage = 100
max_allocated_storage = 500
iops = 3000
storage_throughput = 125

# Cache Configuration
elasticache_node_type = "cache.r6g.xlarge"
elasticache_num_cache_nodes = 3
elasticache_parameter_group_family = "redis6.x"
enable_transit_encryption = true

# S3 Configuration
enable_versioning = true
enable_encryption = true
lifecycle_rule_enabled = true
transition_to_ia_days = 90
transition_to_glacier_days = 180

# Route53 Configuration
domain_name = "iwms.example.com"
enable_dns_hostnames = true
enable_dns_support = true

# WAF Configuration
enable_waf = true
waf_block_mode = true
ip_rate_limit = 2000

# Backup Configuration
enable_automated_backups = true
enable_cross_region_backup = true
backup_retention_days = 30
enable_point_in_time_recovery = true

# Cost Management
enable_cost_allocation_tags = true
enable_budget_alerts = true
monthly_budget_limit = 25000
budget_alert_threshold = 80

# Compliance and Audit
enable_cloudtrail = true
enable_config = true
enable_guardduty = true
enable_securityhub = true