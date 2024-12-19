#!/bin/bash

# Database Initialization Script for IWMS
# Version: 1.0.0
# Dependencies:
# - PostgreSQL 14
# - TimescaleDB 2.8
# - pgAudit 1.6
# - pgpool2 4.3

set -euo pipefail

# Source environment variables
if [ -f .env ]; then
    source .env
fi

# Global variables with defaults
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-iwms_db}
POSTGRES_USER=${POSTGRES_USER:-iwms_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
NODE_ENV=${NODE_ENV:-development}
SSL_CERT_PATH=${SSL_CERT_PATH:-/etc/ssl/certs/postgresql}
BACKUP_PATH=${BACKUP_PATH:-/var/lib/postgresql/backups}
MAX_CONNECTIONS=${MAX_CONNECTIONS:-100}
SHARED_BUFFERS=${SHARED_BUFFERS:-1GB}

# Logging configuration
LOG_FILE="/var/log/postgresql/init-db.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
    exit 1
}

# Function to check prerequisites
check_prerequisites() {
    local env=$1
    log "Checking prerequisites for environment: $env"

    # Check PostgreSQL installation
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL client not found"
    fi

    # Verify PostgreSQL version
    local pg_version=$(psql --version | grep -oE '[0-9]{1,2}\.[0-9]{1,2}')
    if (( $(echo "$pg_version < 14.0" | bc -l) )); then
        error "PostgreSQL version must be 14.0 or higher"
    fi

    # Check required extensions
    local required_extensions=("timescaledb" "pgaudit" "pg_stat_statements")
    for ext in "${required_extensions[@]}"; do
        if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_available_extensions WHERE name = '$ext';" | grep -q 1; then
            error "Required extension not available: $ext"
        fi
    fi

    # Production-specific checks
    if [ "$env" = "production" ]; then
        # Verify SSL certificates
        if [ ! -f "$SSL_CERT_PATH/server.crt" ] || [ ! -f "$SSL_CERT_PATH/server.key" ]; then
            error "SSL certificates not found in $SSL_CERT_PATH"
        fi

        # Verify backup location
        if [ ! -d "$BACKUP_PATH" ]; then
            error "Backup directory not found: $BACKUP_PATH"
        fi
    fi

    log "Prerequisites check completed successfully"
    return 0
}

# Function to configure security
configure_security() {
    local db_name=$1
    local env=$2
    log "Configuring security for database: $db_name"

    # Base security configurations
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db_name" <<-EOSQL
        -- Enable SSL
        ALTER SYSTEM SET ssl = on;
        ALTER SYSTEM SET ssl_cert_file = '$SSL_CERT_PATH/server.crt';
        ALTER SYSTEM SET ssl_key_file = '$SSL_CERT_PATH/server.key';

        -- Configure connection security
        ALTER SYSTEM SET password_encryption = 'scram-sha-256';
        ALTER SYSTEM SET authentication_timeout = '1min';
        ALTER SYSTEM SET log_connections = on;
        ALTER SYSTEM SET log_disconnections = on;

        -- Enable audit logging
        CREATE EXTENSION IF NOT EXISTS pgaudit;
        ALTER SYSTEM SET pgaudit.log = 'write,ddl';
        ALTER SYSTEM SET pgaudit.log_catalog = on;
        ALTER SYSTEM SET pgaudit.log_relation = on;
EOSQL

    # Production-specific security
    if [ "$env" = "production" ]; then
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db_name" <<-EOSQL
            -- Force SSL for all connections
            ALTER SYSTEM SET ssl_prefer_server_ciphers = on;
            ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';

            -- Additional security settings
            ALTER SYSTEM SET log_min_duration_statement = 1000;
            ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
            ALTER SYSTEM SET log_statement = 'mod';
EOSQL
    fi

    log "Security configuration completed"
    return 0
}

# Function to setup high availability
setup_high_availability() {
    local db_name=$1
    local env=$2
    log "Setting up high availability configuration"

    if [ "$env" = "production" ]; then
        # Configure streaming replication
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db_name" <<-EOSQL
            -- Replication settings
            ALTER SYSTEM SET wal_level = replica;
            ALTER SYSTEM SET max_wal_senders = 10;
            ALTER SYSTEM SET max_replication_slots = 10;
            ALTER SYSTEM SET hot_standby = on;
            ALTER SYSTEM SET synchronous_commit = on;

            -- Configure WAL archiving
            ALTER SYSTEM SET archive_mode = on;
            ALTER SYSTEM SET archive_command = 'test ! -f $BACKUP_PATH/%f && cp %p $BACKUP_PATH/%f';
EOSQL

        # Setup pgpool configuration
        cat > /etc/pgpool2/pgpool.conf <<-EOCONF
            listen_addresses = '*'
            port = 5432
            backend_hostname0 = '$POSTGRES_HOST'
            backend_port0 = $POSTGRES_PORT
            backend_weight0 = 1
            backend_flag0 = 'ALLOW_TO_FAILOVER'
            connection_cache = on
            load_balance_mode = on
            master_slave_mode = on
            master_slave_sub_mode = 'stream'
EOCONF
    fi

    log "High availability setup completed"
    return 0
}

# Function to optimize performance
optimize_performance() {
    local db_name=$1
    log "Configuring performance optimizations"

    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db_name" <<-EOSQL
        -- Memory settings
        ALTER SYSTEM SET shared_buffers = '$SHARED_BUFFERS';
        ALTER SYSTEM SET work_mem = '64MB';
        ALTER SYSTEM SET maintenance_work_mem = '256MB';
        ALTER SYSTEM SET effective_cache_size = '4GB';

        -- Query planning
        ALTER SYSTEM SET random_page_cost = 1.1;
        ALTER SYSTEM SET effective_io_concurrency = 200;
        ALTER SYSTEM SET default_statistics_target = 100;

        -- Parallel query execution
        ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
        ALTER SYSTEM SET max_parallel_workers = 8;
        ALTER SYSTEM SET parallel_leader_participation = on;

        -- Autovacuum settings
        ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
        ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;
        ALTER SYSTEM SET autovacuum_vacuum_cost_delay = 2;
EOSQL

    log "Performance optimization completed"
    return 0
}

# Main execution function
main() {
    log "Starting database initialization process"
    
    # Validate environment
    if [ -z "$POSTGRES_PASSWORD" ]; then
        error "POSTGRES_PASSWORD environment variable is required"
    fi

    # Check prerequisites
    check_prerequisites "$NODE_ENV"

    # Create database if it doesn't exist
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "$POSTGRES_DB"; then
        log "Creating database: $POSTGRES_DB"
        createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"
    fi

    # Configure security
    configure_security "$POSTGRES_DB" "$NODE_ENV"

    # Setup high availability
    setup_high_availability "$POSTGRES_DB" "$NODE_ENV"

    # Optimize performance
    optimize_performance "$POSTGRES_DB"

    # Create TimescaleDB extension
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"

    # Reload PostgreSQL configuration
    pg_ctl reload

    log "Database initialization completed successfully"
    return 0
}

# Execute main function
main