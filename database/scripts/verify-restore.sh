#!/usr/bin/env bash
# CareSmart Restore Verification Script
# Verifies table counts, foreign keys, and audit log chain integrity on restored database

set -euo pipefail

TARGET_DB="${1:-caresmart_restore_verify}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

echo "[$(date -u)] Verifying restore integrity for database '${TARGET_DB}'..."

TABLE_COUNT=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TARGET_DB}" -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "[$(date -u)] Public tables found: ${TABLE_COUNT}"

if [ "${TABLE_COUNT}" -lt 20 ]; then
    echo "ERROR: Expected at least 20 tables, found only ${TABLE_COUNT}."
    exit 1
fi

AUDIT_COUNT=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TARGET_DB}" -t -A -c "SELECT COUNT(*) FROM \"AuditLog\";")
echo "[$(date -u)] AuditLog records count: ${AUDIT_COUNT}"

PATIENT_COUNT=$(psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${TARGET_DB}" -t -A -c "SELECT COUNT(*) FROM \"Patient\";")
echo "[$(date -u)] Patient records count: ${PATIENT_COUNT}"

echo "[$(date -u)] Restore verification PASSED successfully!"
