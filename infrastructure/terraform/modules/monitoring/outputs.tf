# Monitoring namespace output
output "monitoring_namespace" {
  description = "Kubernetes namespace where monitoring stack is deployed"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

# Prometheus endpoint output
output "prometheus_endpoint" {
  description = "URL endpoint for accessing Prometheus metrics and API"
  value       = aws_route53_record.prometheus.fqdn
}

# Grafana endpoint output
output "grafana_endpoint" {
  description = "URL endpoint for accessing Grafana dashboards"
  value       = aws_route53_record.grafana.fqdn
}

# Elasticsearch endpoint output
output "elasticsearch_endpoint" {
  description = "URL endpoint for Elasticsearch API access"
  value       = aws_route53_record.elasticsearch.fqdn
  sensitive   = true
}

# Kibana endpoint output
output "kibana_endpoint" {
  description = "URL endpoint for accessing Kibana dashboards"
  value       = aws_route53_record.kibana.fqdn
}

# Jaeger endpoint output
output "jaeger_endpoint" {
  description = "URL endpoint for accessing Jaeger UI and tracing"
  value       = aws_route53_record.jaeger.fqdn
}

# Security group output
output "monitoring_security_group_id" {
  description = "ID of the security group created for monitoring stack"
  value       = aws_security_group.monitoring.id
}

# IAM role output
output "monitoring_iam_role_arn" {
  description = "ARN of the IAM role created for monitoring components"
  value       = aws_iam_role.monitoring.arn
  sensitive   = true
}

# Health check endpoints output
output "monitoring_health_check_endpoints" {
  description = "Health check endpoints for monitoring services"
  value = {
    prometheus    = "${aws_route53_record.prometheus.fqdn}/health"
    grafana      = "${aws_route53_record.grafana.fqdn}/api/health"
    elasticsearch = "${aws_route53_record.elasticsearch.fqdn}/_cluster/health"
    jaeger       = "${aws_route53_record.jaeger.fqdn}/health"
    kibana       = "${aws_route53_record.kibana.fqdn}/api/status"
  }
}

# Backup configuration output
output "monitoring_backup_configuration" {
  description = "Backup configuration for monitoring data"
  value = {
    backup_plan_id = aws_backup_plan.monitoring.id
    backup_vault   = aws_backup_vault.monitoring.name
    retention_days = 30
    schedule      = "cron(0 5 ? * * *)"
  }
  sensitive = true
}

# Version information output
output "monitoring_version" {
  description = "Version information for deployed monitoring stack"
  value = {
    prometheus = helm_release.prometheus.version
    grafana    = helm_release.grafana.version
    elk_stack  = helm_release.elk.version
    jaeger     = helm_release.jaeger.version
  }
}

# Monitoring stack configuration output
output "monitoring_configuration" {
  description = "Complete monitoring stack configuration and settings"
  value = {
    environment         = var.environment
    retention_policies = {
      prometheus = var.prometheus_retention_period
      elk_logs   = var.elk_retention_days
    }
    availability_target = var.availability_threshold
    scrape_interval    = var.prometheus_scrape_interval
    sampling_rate      = var.jaeger_sampling_rate
  }
}

# Performance metrics endpoints output
output "monitoring_metrics_endpoints" {
  description = "Endpoints for accessing monitoring metrics and dashboards"
  value = {
    prometheus_metrics = "${aws_route53_record.prometheus.fqdn}/metrics"
    grafana_dashboards = "${aws_route53_record.grafana.fqdn}/dashboards"
    system_metrics     = "${aws_route53_record.prometheus.fqdn}/targets"
    availability_stats = "${aws_route53_record.grafana.fqdn}/api/metrics/availability"
  }
}