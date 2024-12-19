#!/bin/bash

# Monitoring Setup Script for Lightweight IWMS
# Version: 1.0.0
# Dependencies:
# - kubectl v1.25+
# - helm v3.11+
# - vault v1.13+

set -euo pipefail

# Global Variables
readonly MONITORING_NAMESPACE="monitoring"
readonly PROMETHEUS_VERSION="2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly LOKI_VERSION="2.8.0"
readonly JAEGER_VERSION="1.45.0"

# High Availability Configuration
readonly HA_CONFIG='{
  "replicas": 3,
  "zones": ["us-east-1a", "us-east-1b", "us-east-1c"]
}'

# Data Retention Configuration
readonly RETENTION_POLICY='{
  "metrics": "30d",
  "logs": "90d",
  "traces": "15d"
}'

# Security Context Configuration
readonly SECURITY_CONTEXT='{
  "runAsNonRoot": true,
  "readOnlyRootFilesystem": true
}'

# Validation Functions
validate_prerequisites() {
    echo "Validating prerequisites..."
    
    # Check required tools
    command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed"; exit 1; }
    command -v helm >/dev/null 2>&1 || { echo "helm is required but not installed"; exit 1; }
    command -v vault >/dev/null 2>&1 || { echo "vault is required but not installed"; exit 1; }
    
    # Validate Kubernetes connection
    kubectl cluster-info >/dev/null 2>&1 || { echo "Unable to connect to Kubernetes cluster"; exit 1; }
    
    # Verify Helm repos
    helm repo list | grep -q "prometheus-community" || helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo list | grep -q "grafana" || helm repo add grafana https://grafana.github.io/helm-charts
    
    helm repo update
}

setup_namespace() {
    local cluster_context="$1"
    
    echo "Setting up monitoring namespace..."
    
    # Create namespace with security controls
    kubectl --context "$cluster_context" create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | \
    kubectl --context "$cluster_context" apply -f -
    
    # Apply network policies
    cat <<EOF | kubectl --context "$cluster_context" apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: monitoring-network-policy
  namespace: $MONITORING_NAMESPACE
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: iwms
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: iwms
EOF
    
    # Apply resource quotas
    kubectl --context "$cluster_context" apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: monitoring-quota
  namespace: $MONITORING_NAMESPACE
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
EOF
}

install_prometheus() {
    local config_path="$1"
    
    echo "Installing Prometheus..."
    
    # Create Prometheus configuration from ConfigMap
    kubectl apply -f "$config_path/prometheus-config.yaml"
    
    # Install Prometheus with HA configuration
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$MONITORING_NAMESPACE" \
        --version "$PROMETHEUS_VERSION" \
        --values - <<EOF
replicas: 3
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
  - labelSelector:
      matchExpressions:
      - key: app
        operator: In
        values:
        - prometheus
    topologyKey: kubernetes.io/hostname
persistence:
  enabled: true
  size: 100Gi
retention: 30d
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  fsGroup: 65534
configMapReload:
  prometheus:
    enabled: true
alertmanager:
  enabled: true
  replicaCount: 3
EOF
}

install_grafana() {
    local config_path="$1"
    
    echo "Installing Grafana..."
    
    # Create Grafana configuration from ConfigMap
    kubectl apply -f "$config_path/grafana-config.yaml"
    
    # Install Grafana with HA configuration
    helm upgrade --install grafana grafana/grafana \
        --namespace "$MONITORING_NAMESPACE" \
        --version "$GRAFANA_VERSION" \
        --values - <<EOF
replicas: 3
persistence:
  enabled: true
  size: 10Gi
securityContext:
  runAsNonRoot: true
  runAsUser: 472
  fsGroup: 472
admin:
  existingSecret: grafana-admin-credentials
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server:9090
      access: proxy
      isDefault: true
ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
EOF
}

install_loki() {
    local config_path="$1"
    
    echo "Installing Loki..."
    
    # Create Loki configuration from ConfigMap
    kubectl apply -f "$config_path/loki-config.yaml"
    
    # Install Loki with HA configuration
    helm upgrade --install loki grafana/loki \
        --namespace "$MONITORING_NAMESPACE" \
        --values - <<EOF
replicas: 3
persistence:
  enabled: true
  size: 50Gi
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  fsGroup: 10001
config:
  auth_enabled: true
  storage:
    type: s3
    s3:
      region: us-west-2
      bucket: iwms-logs
EOF
}

install_jaeger() {
    local config_path="$1"
    
    echo "Installing Jaeger..."
    
    # Create Jaeger configuration from ConfigMap
    kubectl apply -f "$config_path/jaeger-config.yaml"
    
    # Install Jaeger with security configuration
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace "$MONITORING_NAMESPACE" \
        --values - <<EOF
collector:
  replicaCount: 3
query:
  replicaCount: 2
agent:
  strategy: DaemonSet
storage:
  type: elasticsearch
  options:
    es:
      server-urls: http://elasticsearch:9200
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
EOF
}

setup_monitoring() {
    local cluster_context="$1"
    local config_path="$2"
    
    echo "Setting up monitoring infrastructure..."
    
    # Validate prerequisites
    validate_prerequisites
    
    # Setup namespace and security controls
    setup_namespace "$cluster_context"
    
    # Install monitoring components
    install_prometheus "$config_path"
    install_grafana "$config_path"
    install_loki "$config_path"
    install_jaeger "$config_path"
    
    # Verify deployment
    verify_deployment "$cluster_context"
}

verify_deployment() {
    local cluster_context="$1"
    
    echo "Verifying monitoring deployment..."
    
    # Check pod status
    kubectl --context "$cluster_context" -n "$MONITORING_NAMESPACE" wait --for=condition=ready pod -l app=prometheus --timeout=300s
    kubectl --context "$cluster_context" -n "$MONITORING_NAMESPACE" wait --for=condition=ready pod -l app=grafana --timeout=300s
    kubectl --context "$cluster_context" -n "$MONITORING_NAMESPACE" wait --for=condition=ready pod -l app=loki --timeout=300s
    kubectl --context "$cluster_context" -n "$MONITORING_NAMESPACE" wait --for=condition=ready pod -l app=jaeger --timeout=300s
    
    # Verify service endpoints
    kubectl --context "$cluster_context" -n "$MONITORING_NAMESPACE" get svc
}

backup_monitoring() {
    local backup_path="/backup/monitoring"
    
    echo "Backing up monitoring configuration..."
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Backup ConfigMaps
    kubectl -n "$MONITORING_NAMESPACE" get configmap -o yaml > "$backup_path/configmaps.yaml"
    
    # Backup Secrets (encrypted)
    kubectl -n "$MONITORING_NAMESPACE" get secret -o yaml > "$backup_path/secrets.yaml"
    
    # Backup PersistentVolumeClaims
    kubectl -n "$MONITORING_NAMESPACE" get pvc -o yaml > "$backup_path/pvcs.yaml"
    
    echo "Backup completed: $backup_path"
}

# Main execution
main() {
    local cluster_context="${1:-}"
    local config_path="${2:-}"
    
    if [[ -z "$cluster_context" || -z "$config_path" ]]; then
        echo "Usage: $0 <cluster_context> <config_path>"
        exit 1
    fi
    
    setup_monitoring "$cluster_context" "$config_path"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi