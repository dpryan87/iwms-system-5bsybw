#!/bin/bash

# @package postgresql-client v14
# @package aws-cli v2.0

set -euo pipefail

# =============================================================================
# Enterprise Database Backup Script for IWMS Platform
# Implements secure, encrypted backups with point-in-time recovery capabilities
# =============================================================================

# Source environment variables if .env exists
if [ -f .env ]; then
    source .env
fi

# Global Configuration
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-iwms_db}
POSTGRES_USER=${POSTGRES_USER:-iwms_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
BACKUP_ROOT="/var/backups/postgresql"
S3_BUCKET=${S3_BUCKET:-iwms-backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Logging configuration
LOG_FILE="/var/log/postgresql/backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# =============================================================================
# Logging Functions
# =============================================================================

log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_warn() {
    log "WARN" "$@"
}

# =============================================================================
# Prerequisite Check Functions
# =============================================================================

check_prerequisites() {
    local status=0

    # Check required environment variables
    if [ -z "$POSTGRES_PASSWORD" ]; then
        log_error "POSTGRES_PASSWORD environment variable is not set"
        status=1
    fi

    if [ -z "$ENCRYPTION_KEY" ]; then
        log_error "ENCRYPTION_KEY environment variable is not set"
        status=1
    fi

    # Verify PostgreSQL client tools
    if ! command -v pg_dump >/dev/null 2>&1; then
        log_error "pg_dump is not installed"
        status=1
    fi

    # Verify AWS CLI installation
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLI is not installed"
        status=1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials are not properly configured"
        status=1
    fi

    # Verify backup directory exists and is writable
    if [ ! -d "$BACKUP_ROOT" ]; then
        mkdir -p "$BACKUP_ROOT" || {
            log_error "Failed to create backup directory: $BACKUP_ROOT"
            status=1
        }
    fi

    # Check available disk space
    local available_space
    available_space=$(df -P "$BACKUP_ROOT" | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 5242880 ]; then  # 5GB in KB
        log_error "Insufficient disk space for backup operation"
        status=1
    }

    return $status
}

# =============================================================================
# Backup Functions
# =============================================================================

perform_full_backup() {
    local backup_file="$BACKUP_ROOT/$TIMESTAMP-full.sql.gz"
    local metadata_file="$BACKUP_ROOT/$TIMESTAMP-metadata.json"
    local checksum_file="$BACKUP_ROOT/$TIMESTAMP-checksum.sha256"
    local status=0

    log_info "Starting full backup of database: $POSTGRES_DB"

    # Create backup with parallel compression
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        -F c \
        -Z 9 \
        -j 4 \
        --verbose \
        --blobs \
        --no-owner \
        --no-privileges \
        2>> "$LOG_FILE" | gzip > "$backup_file" || {
            log_error "Failed to create full backup"
            return 1
        }

    # Generate backup metadata
    cat > "$metadata_file" << EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "type": "full",
    "database": "$POSTGRES_DB",
    "size": "$(stat -f%z "$backup_file")",
    "hostname": "$POSTGRES_HOST",
    "version": "$(pg_dump --version | awk '{print $3}')"
}
EOF

    # Calculate checksum
    sha256sum "$backup_file" > "$checksum_file"

    # Encrypt backup file
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "$backup_file" \
        -out "$backup_file.enc" \
        -pass pass:"$ENCRYPTION_KEY" || {
            log_error "Failed to encrypt backup file"
            status=1
        }

    # Verify backup integrity
    if ! pg_restore --list "$backup_file" >/dev/null 2>&1; then
        log_error "Backup verification failed"
        status=1
    fi

    return $status
}

perform_incremental_backup() {
    local wal_dir="$BACKUP_ROOT/wal"
    local status=0

    log_info "Starting incremental backup (WAL archiving)"

    # Ensure WAL directory exists
    mkdir -p "$wal_dir"

    # Archive WAL files
    PGPASSWORD="$POSTGRES_PASSWORD" pg_basebackup \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -D "$wal_dir" \
        -X stream \
        -c fast \
        -P \
        -v 2>> "$LOG_FILE" || {
            log_error "Failed to archive WAL files"
            status=1
        }

    # Encrypt WAL files
    find "$wal_dir" -type f -name "*.wal" | while read -r wal_file; do
        openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "$wal_file" \
            -out "$wal_file.enc" \
            -pass pass:"$ENCRYPTION_KEY" || status=1
    done

    return $status
}

# =============================================================================
# S3 Upload Functions
# =============================================================================

upload_to_s3() {
    local source_path=$1
    local s3_path=$2
    local status=0

    log_info "Uploading backup to S3: $s3_path"

    # Upload with server-side encryption
    aws s3 cp "$source_path" "s3://$S3_BUCKET/$s3_path" \
        --sse aws:kms \
        --storage-class STANDARD_IA \
        --metadata "timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --only-show-errors || {
            log_error "Failed to upload backup to S3"
            status=1
        }

    # Verify upload
    if ! aws s3api head-object --bucket "$S3_BUCKET" --key "$s3_path" >/dev/null 2>&1; then
        log_error "Failed to verify S3 upload"
        status=1
    }

    return $status
}

# =============================================================================
# Backup Rotation Functions
# =============================================================================

rotate_backups() {
    local retention_days=$1
    local status=0

    log_info "Starting backup rotation (retention: $retention_days days)"

    # Remove local backups older than retention period
    find "$BACKUP_ROOT" -type f -mtime +"$retention_days" -delete || {
        log_warn "Failed to clean some local backup files"
        status=1
    }

    # Update S3 lifecycle rules
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "$S3_BUCKET" \
        --lifecycle-configuration file://lifecycle.json || {
            log_error "Failed to update S3 lifecycle rules"
            status=1
        }

    return $status
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    local exit_status=0

    # Initialize logging
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    log_info "Starting database backup process"

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisite check failed"
        return 1
    fi

    # Perform full backup
    if ! perform_full_backup; then
        log_error "Full backup failed"
        exit_status=1
    fi

    # Perform incremental backup
    if ! perform_incremental_backup; then
        log_error "Incremental backup failed"
        exit_status=1
    fi

    # Upload backups to S3
    if [ $exit_status -eq 0 ]; then
        if ! upload_to_s3 "$BACKUP_ROOT/$TIMESTAMP-full.sql.gz.enc" "full/$TIMESTAMP/backup.sql.gz.enc"; then
            log_error "Failed to upload full backup to S3"
            exit_status=1
        fi
    fi

    # Rotate old backups
    if ! rotate_backups "$BACKUP_RETENTION_DAYS"; then
        log_warn "Backup rotation encountered issues"
        exit_status=1
    fi

    # Cleanup
    if [ $exit_status -eq 0 ]; then
        log_info "Backup process completed successfully"
    else
        log_error "Backup process completed with errors"
    fi

    return $exit_status
}

# Execute main function
main "$@"