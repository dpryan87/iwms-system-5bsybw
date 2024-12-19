# Provider configuration with required version constraint
# AWS Provider version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for enhanced database configurations
locals {
  name_prefix = "iwms-${var.environment}"
  db_family   = "postgres14"
  
  common_tags = {
    Environment = var.environment
    Service     = "database"
    Terraform   = "true"
    Backup      = "required"
    Monitoring  = "enhanced"
  }

  # Database parameter configurations
  db_parameters = {
    "shared_preload_libraries"    = "pg_stat_statements,timescaledb"
    "log_connections"             = "1"
    "log_disconnections"          = "1"
    "log_duration"               = "1"
    "log_min_duration_statement" = "1000"
    "autovacuum"                = "on"
    "track_activity_query_size" = "2048"
    "max_connections"           = "200"
    "work_mem"                  = "4MB"
    "maintenance_work_mem"      = "64MB"
    "random_page_cost"          = "1.1"
    "effective_cache_size"      = "3GB"
    "timezone"                  = "UTC"
  }
}

# DB Subnet Group for multi-AZ deployment
resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-subnet-group"
  description = "Subnet group for ${local.name_prefix} RDS instance"
  subnet_ids  = var.subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-subnet-group"
  })
}

# Parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-pg"
  family      = local.db_family
  description = "Custom parameter group for ${local.name_prefix} PostgreSQL instance"

  dynamic "parameter" {
    for_each = local.db_parameters
    content {
      name  = parameter.key
      value = parameter.value
    }
  }

  tags = local.common_tags
}

# Primary RDS instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-primary"
  
  # Engine configuration
  engine                = "postgres"
  engine_version        = "14.7"
  instance_class        = var.db_instance_class
  
  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = var.kms_key_id

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.vpc_security_group_ids
  publicly_accessible    = false
  port                  = 5432

  # High availability configuration
  multi_az               = var.environment == "production" ? true : false
  availability_zone      = var.environment == "production" ? null : "us-west-2a"

  # Authentication and access
  username               = "iwms_admin"
  manage_master_user_password = true
  iam_database_authentication_enabled = true

  # Backup configuration
  backup_retention_period = var.db_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot  = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

  # Performance and monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-primary"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Read replica configuration (if enabled)
resource "aws_db_instance" "replica" {
  count = var.enable_read_replica ? var.read_replica_count : 0

  identifier = "${local.name_prefix}-replica-${count.index + 1}"
  
  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.db_instance_class

  # Storage configuration
  storage_encrypted   = true
  kms_key_id         = var.kms_key_id

  # Network configuration
  vpc_security_group_ids = var.vpc_security_group_ids
  publicly_accessible    = false

  # Performance and monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-replica-${count.index + 1}"
    Type = "ReadReplica"
  })
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name_prefix}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]

  tags = local.common_tags
}

# CloudWatch alarms for database monitoring
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.name_prefix}-database-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "Database CPU utilization is too high"
  alarm_actions      = []  # Add SNS topic ARN for notifications

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "database_memory" {
  alarm_name          = "${local.name_prefix}-database-memory"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "FreeableMemory"
  namespace          = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "1000000000"  # 1GB in bytes
  alarm_description  = "Database freeable memory is too low"
  alarm_actions      = []  # Add SNS topic ARN for notifications

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = local.common_tags
}