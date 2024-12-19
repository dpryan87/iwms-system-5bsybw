# Terraform variables definition file for ECS Fargate compute resources
# Version: ~> 1.5

variable "project_name" {
  type        = string
  description = "Name of the IWMS project for resource naming and tagging"
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (staging or production) for environment-specific configurations"
  
  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either 'staging' or 'production'"
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where ECS resources will be deployed for network isolation"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for ECS task deployment across multiple AZs"
  
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be specified for high availability"
  }
}

variable "ecs_task_cpu" {
  type        = number
  description = "CPU units for ECS tasks (1024 units = 1 vCPU)"
  default     = 2048

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.ecs_task_cpu)
    error_message = "ECS task CPU must be one of [256, 512, 1024, 2048, 4096]"
  }
}

variable "ecs_task_memory" {
  type        = number
  description = "Memory (MiB) for ECS tasks"
  default     = 4096

  validation {
    condition     = var.ecs_task_memory >= 512 && var.ecs_task_memory <= 30720
    error_message = "ECS task memory must be between 512 and 30720 MiB"
  }
}

variable "container_insights" {
  type        = bool
  description = "Enable CloudWatch Container Insights for enhanced monitoring and observability"
  default     = true
}

variable "capacity_providers" {
  type        = list(string)
  description = "List of ECS capacity providers for cost optimization"
  default     = ["FARGATE", "FARGATE_SPOT"]

  validation {
    condition     = alltrue([for p in var.capacity_providers : contains(["FARGATE", "FARGATE_SPOT"], p)])
    error_message = "Capacity providers must be either FARGATE or FARGATE_SPOT"
  }
}

variable "scaling_config" {
  type = object({
    min_capacity             = number
    max_capacity            = number
    target_cpu_utilization  = number
    target_memory_utilization = number
    scale_in_cooldown       = number
    scale_out_cooldown      = number
  })
  description = "Auto-scaling configuration for ECS services"
  
  default = {
    min_capacity             = 2
    max_capacity            = 8
    target_cpu_utilization  = 70
    target_memory_utilization = 80
    scale_in_cooldown       = 300
    scale_out_cooldown      = 180
  }

  validation {
    condition     = var.scaling_config.min_capacity >= 2 && var.scaling_config.max_capacity <= 20
    error_message = "Min capacity must be >= 2 and max capacity must be <= 20"
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all compute resources for better resource management"
  default     = {}
}