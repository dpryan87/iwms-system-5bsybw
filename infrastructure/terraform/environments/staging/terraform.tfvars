# Project Configuration
project_name = "lightweight-iwms-staging"
environment  = "staging"

# Regional Configuration
aws_region = "us-west-2"

# High Availability Configuration
# Using multiple AZs for redundancy and fault tolerance
availability_zones = [
  "us-west-2a",
  "us-west-2b"
]

# Network Configuration
# VPC CIDR with sufficient IP space for staging environment
vpc_cidr = "10.0.0.0/16"

# Database Configuration
# Optimized instance class for staging workloads with good performance
db_instance_class = "db.t3.large"

# Enable read replica for improved read performance and HA
enable_read_replica = true

# Resource Tags
# Comprehensive tagging strategy for resource management and cost allocation
tags = {
  Environment = "staging"
  Project     = "lightweight-iwms"
  ManagedBy   = "terraform"
  Team        = "platform"
  CostCenter  = "engineering"
}