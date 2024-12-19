# Terraform variables definition file for RDS PostgreSQL database infrastructure
# Version: ~> 1.5

variable "environment" {
  type        = string
  description = "Deployment environment (staging or production) for the RDS instance"
  
  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either 'staging' or 'production'"
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class for PostgreSQL database with minimum t3.large for production workloads"
  default     = "db.t3.large"
}

variable "db_allocated_storage" {
  type        = number
  description = "Initial allocated storage size in GB for RDS instance"
  default     = 100

  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "Allocated storage must be at least 20 GB"
  }
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Maximum storage size in GB for RDS autoscaling capacity"
  default     = 500

  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "Maximum allocated storage must be greater than or equal to allocated storage"
  }
}

variable "db_backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups with minimum 7 days"
  default     = 7

  validation {
    condition     = var.db_backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days"
  }
}

variable "enable_read_replica" {
  type        = bool
  description = "Flag to enable read replicas for RDS instance"
  default     = true
}

variable "read_replica_count" {
  type        = number
  description = "Number of read replicas to create (0-5)"
  default     = 1

  validation {
    condition     = var.read_replica_count >= 0 && var.read_replica_count <= 5
    error_message = "Read replica count must be between 0 and 5"
  }
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for RDS multi-AZ deployment"

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs must be provided for HA deployment"
  }
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "List of VPC security group IDs for controlling RDS access"
}

variable "enable_performance_insights" {
  type        = bool
  description = "Enable Performance Insights for RDS monitoring and optimization"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Additional tags for RDS and related resources"
  default     = {}
}