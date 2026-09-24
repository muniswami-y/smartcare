# CareSmart Disaster Recovery & Business Continuity Plan

This document specifies the disaster recovery objectives, automated backup pipeline, and failover procedures for CareSmart.

---

## 1. Recovery Objectives

- **Recovery Point Objective (RPO):** < 1 Hour (Automated WAL archiving & hourly snapshots).
- **Recovery Time Objective (RTO):** < 30 Minutes (Automated container redeployment and database restore).

---

## 2. Backup Architecture

Backups are executed using `database/scripts/backup.sh` with AES-256 symmetric encryption and Gzip compression:

```
[ PostgreSQL Database ]
          │
          ▼ (pg_dump -Fc)
[ Compressed SQL Dump ]
          │
          ▼ (openssl enc -aes-256-cbc -salt)
[ Encrypted Archive: backup_YYYYMMDD_HHMMSS.dump.enc ]
          │
          ├────────────────────────┬────────────────────────┐
          ▼                        ▼                        ▼
[ Local Backup Directory ]   [ Offsite S3 Bucket ]   [ Secondary Cold Storage ]
(Retention: 14 Days)         (Retention: 8 Weeks)    (Retention: 12 Months)
```

---

## 3. Step-by-Step Restoration Procedure

### In the Event of Total Primary Server Failure:

1. **Provision New Linux Server** (Ubuntu 22.04 LTS / 24.04 LTS).
2. **Install Docker & Docker Compose:**
   ```bash
   apt-get update && apt-get install -y docker.io docker-compose-plugin
   ```
3. **Pull Encrypted Backup File & Passphrase:**
   Retrieve latest backup archive `backup_LATEST.dump.enc` and `BACKUP_ENCRYPTION_KEY` from secure offsite vault.
4. **Execute Automated Restore:**
   ```bash
   chmod +x database/scripts/restore.sh
   ./database/scripts/restore.sh /path/to/backup_LATEST.dump.enc
   ```
5. **Run Restore Verification Script:**
   ```bash
   chmod +x database/scripts/verify-restore.sh
   ./database/scripts/verify-restore.sh
   ```
6. **Launch Containers & Re-point DNS:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## 4. Disaster Recovery Drills & Testing Schedule

- **Automated Verification:** Every Sunday at 03:00 IST via `verify-restore.sh` into a temporary sandbox.
- **Bi-annual Paper Fallback Drill:** Hospital clinical departments simulate 2 hours of offline paper forms with post-drill digital ingestion to ensure care continuity during unplanned network disruptions.
