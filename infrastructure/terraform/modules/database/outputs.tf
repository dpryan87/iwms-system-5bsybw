# Database endpoint outputs
output "db_instance_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "Hostname of the primary RDS instance"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "Port number of the primary RDS instance"
  value       = aws_db_instance.main.port
}

output "db_instance_arn" {
  description = "ARN of the primary RDS instance"
  value       = aws_db_instance.main.arn
}

# Read replica outputs
output "read_replica_endpoints" {
  description = "List of connection endpoints for read replica instances"
  value       = aws_db_instance.replica[*].endpoint
}

# Performance and monitoring outputs
output "performance_insights_endpoint" {
  description = "Performance Insights endpoint for database monitoring"
  value       = aws_db_instance.main.performance_insights_enabled ? aws_db_instance.main.performance_insights_endpoint : null
}

output "monitoring_role_arn" {
  description = "ARN of the enhanced monitoring IAM role"
  value       = aws_db_instance.main.monitoring_role_arn
}

# Configuration outputs
output "db_subnet_group_name" {
  description = "Name of the database subnet group"
  value       = aws_db_instance.main.db_subnet_group_name
}

output "db_parameter_group_name" {
  description = "Name of the database parameter group"
  value       = aws_db_instance.main.parameter_group_name
}

# Backup and security outputs
output "backup_retention_period" {
  description = "Number of days automated backups are retained"
  value       = aws_db_instance.main.backup_retention_period
}

output "storage_encrypted" {
  description = "Whether the storage encryption is enabled for the RDS instance"
  value       = aws_db_instance.main.storage_encrypted
}

# CloudWatch alarm outputs
output "cpu_alarm_arn" {
  description = "ARN of the CloudWatch CPU utilization alarm"
  value       = aws_cloudwatch_metric_alarm.database_cpu.arn
}

output "memory_alarm_arn" {
  description = "ARN of the CloudWatch memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.database_memory.arn
}

# Database identification outputs
output "db_instance_id" {
  description = "Identifier of the primary RDS instance"
  value       = aws_db_instance.main.id
}

output "db_instance_resource_id" {
  description = "Unique resource ID of the primary RDS instance"
  value       = aws_db_instance.main.resource_id
}

# High availability outputs
output "multi_az" {
  description = "Whether the RDS instance is multi-AZ"
  value       = aws_db_instance.main.multi_az
}

output "availability_zone" {
  description = "Availability zone of the RDS instance"
  value       = aws_db_instance.main.availability_zone
}

# Enhanced monitoring outputs
output "monitoring_interval" {
  description = "Interval in seconds for enhanced monitoring metrics"
  value       = aws_db_instance.main.monitoring_interval
}

output "enabled_cloudwatch_logs_exports" {
  description = "List of log types exported to CloudWatch"
  value       = aws_db_instance.main.enabled_cloudwatch_logs_exports
}