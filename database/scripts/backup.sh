#!/usr/bin/env bash
# CareSmart Automated Encrypted & Compressed Backup Script
# Retention Policy: 14 Daily, 8 Weekly, 12 Monthly

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_DB="${POSTGRES_DB:-caresmart}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
ENCRYPTION_PASSPHRASE="${BACKUP_PASSPHRASE:-caresmart_backup_key_2026}"

DATE_STR=$(date -u +"%Y%m%d_%H%M%SZ")
DAY_OF_WEEK=$(date -u +"%u") # 1 = Monday, 7 = Sunday
DAY_OF_MONTH=$(date -u +"%d")

TARGET_SUBDIR="daily"
if [ "$DAY_OF_MONTH" -eq "01" ]; then
    TARGET_SUBDIR="monthly"
elif [ "$DAY_OF_WEEK" -eq "7" ]; then
    TARGET_SUBDIR="weekly"
fi

DEST_DIR="${BACKUP_DIR}/${TARGET_SUBDIR}"
mkdir -p "${DEST_DIR}"

RAW_FILE="${DEST_DIR}/caresmart_${DATE_STR}.sql.gz"
ENC_FILE="${RAW_FILE}.enc"

echo "[$(date -u)] Starting database backup for '${POSTGRES_DB}' into ${ENC_FILE}..."

# Export and compress using gzip, then encrypt with AES-256-CBC using openssl
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists | \
    gzip -9 | \
    openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"${ENCRYPTION_PASSPHRASE}" -out "${ENC_FILE}"

echo "[$(date -u)] Backup completed successfully: ${ENC_FILE}"

# Retention Cleanup
echo "[$(date -u)] Applying retention policy..."
# Daily: keep 14 days
find "${BACKUP_DIR}/daily" -type f -name "*.sql.gz.enc" -mtime +14 -delete 2>/dev/null || true
# Weekly: keep 8 weeks (56 days)
find "${BACKUP_DIR}/weekly" -type f -name "*.sql.gz.enc" -mtime +56 -delete 2>/dev/null || true
# Monthly: keep 12 months (365 days)
find "${BACKUP_DIR}/monthly" -type f -name "*.sql.gz.enc" -mtime +365 -delete 2>/dev/null || true

echo "[$(date -u)] Retention cleanup completed."
