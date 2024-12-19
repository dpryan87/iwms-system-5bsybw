# Provider configuration
# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

# Create monitoring namespace with enhanced security
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring-${var.environment}"
    labels = {
      environment = var.environment
      managed-by  = "terraform"
      purpose     = "monitoring"
    }
    annotations = {
      "net.beta.kubernetes.io/network-policy" = "enabled"
    }
  }
}

# Security group for monitoring components
resource "aws_security_group" "monitoring" {
  name_prefix = "monitoring-${var.environment}"
  vpc_id      = var.vpc_id
  description = "Security group for monitoring stack components"

  ingress {
    from_port       = 9090
    to_port         = 9090
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Prometheus access"
  }

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Grafana access"
  }

  ingress {
    from_port       = 9200
    to_port         = 9200
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Elasticsearch access"
  }

  ingress {
    from_port       = 16686
    to_port         = 16686
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "Jaeger UI access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "monitoring-${var.environment}"
  })
}

# KMS key for monitoring data encryption
resource "aws_kms_key" "monitoring" {
  description             = "KMS key for monitoring data encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name = "monitoring-${var.environment}-key"
  })
}

# Prometheus deployment using Helm
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"
  version    = "15.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/templates/prometheus-values.yaml", {
      retention_period  = var.prometheus_retention_period
      scrape_interval  = var.prometheus_scrape_interval
      storage_class    = "gp2"
      node_selector    = var.monitoring_node_selector
      security_context = jsonencode({
        runAsUser:    65534
        runAsGroup:   65534
        runAsNonRoot: true
      })
    })
  ]

  set {
    name  = "server.persistentVolume.size"
    value = "50Gi"
  }

  depends_on = [kubernetes_namespace.monitoring]
}

# Grafana deployment using Helm
resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  version    = "6.24.1"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/templates/grafana-values.yaml", {
      admin_password = var.grafana_admin_password
      smtp_config   = var.grafana_smtp_config
      domain_name   = var.domain_name
      node_selector = var.monitoring_node_selector
    })
  ]

  set {
    name  = "persistence.enabled"
    value = "true"
  }

  depends_on = [kubernetes_namespace.monitoring]
}

# ELK Stack deployment using Helm
resource "helm_release" "elk" {
  name       = "elk"
  repository = "https://helm.elastic.co"
  chart      = "elastic-stack"
  version    = "7.17.3"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/templates/elk-values.yaml", {
      storage_size     = var.elk_storage_size
      retention_days   = var.elk_retention_days
      node_selector    = var.monitoring_node_selector
      security_enabled = true
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Jaeger deployment using Helm
resource "helm_release" "jaeger" {
  name       = "jaeger"
  repository = "https://jaegertracing.github.io/helm-charts"
  chart      = "jaeger"
  version    = "0.71.1"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  values = [
    templatefile("${path.module}/templates/jaeger-values.yaml", {
      storage_type    = var.jaeger_storage_type
      sampling_rate   = var.jaeger_sampling_rate
      node_selector   = var.monitoring_node_selector
      elasticsearch_url = "http://elasticsearch-master:9200"
    })
  ]

  depends_on = [kubernetes_namespace.monitoring, helm_release.elk]
}

# Route53 DNS records for monitoring endpoints
resource "aws_route53_record" "grafana" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = "grafana.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [kubernetes_service.grafana.status.0.load_balancer.0.ingress.0.hostname]
}

resource "aws_route53_record" "prometheus" {
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = "prometheus.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [kubernetes_service.prometheus.status.0.load_balancer.0.ingress.0.hostname]
}

# Backup configuration for monitoring data
resource "aws_backup_plan" "monitoring" {
  name = "monitoring-backup-${var.environment}"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.monitoring.name
    schedule          = "cron(0 5 ? * * *)"

    lifecycle {
      delete_after = 30
    }
  }

  tags = merge(var.tags, {
    Name = "monitoring-backup-${var.environment}"
  })
}

# Export monitoring endpoints and configuration
output "prometheus_endpoint" {
  value = {
    primary_endpoint   = "https://prometheus.${var.domain_name}"
    failover_endpoint  = "https://prometheus-failover.${var.domain_name}"
  }
  description = "Prometheus server endpoints"
}

output "grafana_endpoint" {
  value = {
    dashboard_url = "https://grafana.${var.domain_name}"
    api_endpoint  = "https://grafana.${var.domain_name}/api"
  }
  description = "Grafana dashboard and API endpoints"
}

output "monitoring_config" {
  value = {
    namespace          = kubernetes_namespace.monitoring.metadata[0].name
    security_policies  = kubernetes_namespace.monitoring.metadata[0].annotations
    retention_policies = {
      prometheus = var.prometheus_retention_period
      elk       = var.elk_retention_days
    }
  }
  description = "Monitoring stack configuration"
}