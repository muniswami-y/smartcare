#!/usr/bin/env bash
# CareSmart Safe Database Restore Script
# Restores an encrypted, compressed backup file into a target database (defaulting to a separate verification DB)

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup.sql.gz.enc> [target_database_name]"
    exit 1
fi

ENC_FILE="$1"
TARGET_DB="${2:-caresmart_restore_verify}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
ENCRYPTION_PASSPHRASE="${BACKUP_PASSPHRASE:-caresmart_backup_key_2026}"

if [ ! -f "${ENC_FILE}" ]; then
    echo "Error: Backup file '${ENC_FILE}' not found!"
    exit 1
fi

echo "[$(date -u)] Decrypting and restoring '${ENC_FILE}' into database '${TARGET_DB}'..."

# Ensure target database exists or create it
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -tc "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DB}'" | grep -q 1 || \
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -c "CREATE DATABASE \"${TARGET_DB}\";"

# Decrypt, decompress, and apply to target database
openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${ENCRYPTION_PASSPHRASE}" -in "${ENC_FILE}" | \
    gunzip | \
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TARGET_DB}" -v ON_ERROR_STOP=1

echo "[$(date -u)] Restore completed into '${TARGET_DB}'."
