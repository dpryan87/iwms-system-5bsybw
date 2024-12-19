# Terraform variables definition file for Lightweight IWMS
# Version: 1.0
# Terraform Version: ~> 1.5

# Project Identification
variable "project_name" {
  type        = string
  description = "Name of the IWMS project used for resource naming and tagging"
  default     = "lightweight-iwms"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier for resource configuration"

  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either 'staging' or 'production'"
  }
}

# Regional Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for infrastructure deployment with availability zone support"
  default     = "us-west-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be a valid region identifier"
  }
}

# High Availability Configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ high-availability deployment"

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones required for high availability"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network configuration"
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Database Configuration
variable "db_instance_class" {
  type        = string
  description = "RDS instance class for PostgreSQL database optimized for performance"
  default     = "db.t3.large"

  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.db_instance_class))
    error_message = "Invalid RDS instance class format"
  }
}

# High Availability Database Configuration
variable "enable_read_replica" {
  type        = bool
  description = "Enable read replicas for RDS high availability"
  default     = true
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Common resource tags for cost allocation and resource management"
  default     = {}
}