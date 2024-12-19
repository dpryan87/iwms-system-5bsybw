# Environment configuration
variable "environment" {
  type        = string
  description = "Deployment environment identifier (staging or production)"
  
  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either staging or production"
  }
}

# Network configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where monitoring infrastructure will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for monitoring component deployment"
  
  validation {
    condition     = length(var.private_subnet_ids) > 0
    error_message = "At least one private subnet ID must be provided"
  }
}

# Domain configuration
variable "domain_name" {
  type        = string
  description = "Base domain name for monitoring service endpoints (e.g., monitoring.example.com)"
  
  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.domain_name))
    error_message = "Domain name must be a valid DNS name"
  }
}

# Prometheus configuration
variable "prometheus_retention_period" {
  type        = string
  description = "Data retention period for Prometheus metrics storage"
  default     = "15d"
}

variable "prometheus_scrape_interval" {
  type        = string
  description = "Interval for Prometheus metric collection"
  default     = "15s"
}

# Grafana configuration
variable "grafana_admin_password" {
  type        = string
  description = "Administrative password for Grafana dashboard access"
  sensitive   = true
  
  validation {
    condition     = length(var.grafana_admin_password) >= 12
    error_message = "Grafana admin password must be at least 12 characters long"
  }
}

variable "grafana_smtp_config" {
  type = object({
    host     = string
    port     = number
    user     = string
    password = string
  })
  description = "SMTP configuration for Grafana alert notifications"
  default     = null
  sensitive   = true
}

# ELK Stack configuration
variable "elk_storage_size" {
  type        = string
  description = "Storage capacity allocation for ELK stack"
  default     = "50Gi"
}

variable "elk_retention_days" {
  type        = number
  description = "Number of days to retain logs in ELK stack"
  default     = 30
}

# Jaeger configuration
variable "jaeger_storage_type" {
  type        = string
  description = "Storage backend type for Jaeger tracing data"
  default     = "elasticsearch"
}

variable "jaeger_sampling_rate" {
  type        = number
  description = "Sampling rate for Jaeger trace collection (0.0-1.0)"
  default     = 0.1
  
  validation {
    condition     = var.jaeger_sampling_rate >= 0 && var.jaeger_sampling_rate <= 1
    error_message = "Jaeger sampling rate must be between 0 and 1"
  }
}

# Kubernetes configuration
variable "monitoring_node_selector" {
  type        = map(string)
  description = "Kubernetes node selector labels for monitoring components"
  default     = {
    monitoring = "true"
  }
}

# Alert configuration
variable "alert_notification_endpoints" {
  type = list(object({
    name     = string
    endpoint = string
    type     = string
  }))
  description = "Configuration for alert notification destinations"
  default     = []
}

# Performance configuration
variable "availability_threshold" {
  type        = number
  description = "System availability target threshold percentage"
  default     = 99.9
  
  validation {
    condition     = var.availability_threshold > 0 && var.availability_threshold <= 100
    error_message = "Availability threshold must be between 0 and 100"
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags to apply to all monitoring components"
  default     = {}
}