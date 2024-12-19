# Output definitions for the ECS Fargate compute module
# Provider version: ~> 4.0

output "ecs_cluster_id" {
  description = "The ID of the ECS cluster. Used for deploying services and task definitions. Required for service module configurations."
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster. Used for CloudWatch logging configurations and service discovery. Required for service deployments and monitoring setup."
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "The ARN of the ECS cluster. Used for IAM policies and cross-account access configurations. Required for setting up task execution permissions."
  value       = aws_ecs_cluster.main.arn
}

output "ecs_task_role_arn" {
  description = "The ARN of the IAM role that ECS tasks can assume. Grants permissions for S3, Secrets Manager, and ElastiCache access. Required for task definitions."
  value       = aws_iam_role.ecs_task_role.arn
  sensitive   = true
}

output "ecs_execution_role_arn" {
  description = "The ARN of the IAM role that grants the ECS agent permission to make AWS API calls. Required for pulling container images and publishing logs."
  value       = aws_iam_role.ecs_execution_role.arn
  sensitive   = true
}

output "capacity_providers" {
  description = "List of capacity providers configured for the ECS cluster. Used for cost optimization between FARGATE and FARGATE_SPOT."
  value       = aws_ecs_cluster.main.capacity_providers
}

output "scaling_config" {
  description = "Auto-scaling configuration for ECS services including target tracking policies for CPU and memory utilization."
  value = {
    min_capacity             = var.scaling_config.min_capacity
    max_capacity            = var.scaling_config.max_capacity
    target_cpu_utilization  = var.scaling_config.target_cpu_utilization
    target_memory_utilization = var.scaling_config.target_memory_utilization
    scale_in_cooldown       = var.scaling_config.scale_in_cooldown
    scale_out_cooldown      = var.scaling_config.scale_out_cooldown
    resource_id             = aws_appautoscaling_target.ecs_target.resource_id
    service_namespace       = aws_appautoscaling_target.ecs_target.service_namespace
  }
}

output "task_definition_config" {
  description = "Default task definition configuration including CPU and memory allocations for container deployments."
  value = {
    cpu    = var.ecs_task_cpu
    memory = var.ecs_task_memory
  }
}

output "container_insights_enabled" {
  description = "Indicates whether CloudWatch Container Insights monitoring is enabled for the ECS cluster."
  value       = var.container_insights
}

output "cluster_tags" {
  description = "Tags applied to the ECS cluster for resource management and cost allocation."
  value       = aws_ecs_cluster.main.tags
}

output "autoscaling_policies" {
  description = "ARNs of the auto-scaling policies configured for CPU and memory-based scaling."
  value = {
    cpu_policy_arn    = aws_appautoscaling_policy.cpu_policy.arn
    memory_policy_arn = aws_appautoscaling_policy.memory_policy.arn
  }
}