# AWS ECS Fargate compute module configuration
# Provider version: ~> 4.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  )

  # Capacity provider strategy configuration
  fargate_weight      = 40
  fargate_spot_weight = 60
  
  # Default task definition settings
  task_definition_memory = var.ecs_task_memory
  task_definition_cpu    = var.ecs_task_cpu
}

# ECS Cluster with container insights and capacity providers
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled"
  }

  capacity_providers = var.capacity_providers

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base             = 2  # Ensures minimum on-demand tasks for stability
    weight           = local.fargate_weight
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = local.fargate_spot_weight
  }

  tags = local.common_tags
}

# IAM role for ECS task execution
resource "aws_iam_role" "ecs_execution_role" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
  ]

  tags = local.common_tags
}

# IAM role for ECS tasks
resource "aws_iam_role" "ecs_task_role" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  inline_policy {
    name = "ecs-task-permissions"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:PutObject",
            "s3:ListBucket",
            "secretsmanager:GetSecretValue",
            "elasticache:*"
          ]
          Resource = "*"
        }
      ]
    })
  }

  tags = local.common_tags
}

# Auto-scaling target for ECS services
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.scaling_config.max_capacity
  min_capacity       = var.scaling_config.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${local.name_prefix}-service"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU utilization based auto-scaling policy
resource "aws_appautoscaling_policy" "cpu_policy" {
  name               = "${local.name_prefix}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.scaling_config.target_cpu_utilization
    scale_in_cooldown  = var.scaling_config.scale_in_cooldown
    scale_out_cooldown = var.scaling_config.scale_out_cooldown
  }
}

# Memory utilization based auto-scaling policy
resource "aws_appautoscaling_policy" "memory_policy" {
  name               = "${local.name_prefix}-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.scaling_config.target_memory_utilization
    scale_in_cooldown  = var.scaling_config.scale_in_cooldown
    scale_out_cooldown = var.scaling_config.scale_out_cooldown
  }
}

# Outputs for use by other modules
output "cluster_id" {
  description = "ID of the created ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "Name of the created ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "cluster_capacity_providers" {
  description = "List of capacity providers configured for the cluster"
  value       = aws_ecs_cluster.main.capacity_providers
}

output "execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}