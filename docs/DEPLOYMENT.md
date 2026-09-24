# CareSmart Deployment Guide

This document outlines the standard production deployment procedure for CareSmart Hospital Management System in a private hospital or healthcare cloud VPC in India.

---

## 1. System Requirements

| Component | Minimum Specification | Recommended Specification |
|-----------|------------------------|---------------------------|
| **Host Operating System** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| **CPU** | 4 vCPU (x86_64) | 8 vCPU |
| **RAM** | 16 GB ECC RAM | 32 GB ECC RAM |
| **Storage** | 100 GB NVMe SSD | 500 GB NVMe (RAID-1 / ZFS mirror) |
| **Network** | Static Public IP, 100 Mbps | Dual Gigabit Uplink |
| **Database** | PostgreSQL 16 (Local container or RDS) | PostgreSQL 16 Managed with HA |
| **Cache & Queue** | Redis 7 | Redis 7 Sentinel / Cluster |

---

## 2. Production Topology & Architecture

```
                    [ Internet / Local Hospital LAN ]
                                   │
                                   ▼
             [ Caddy 2 Reverse Proxy (HTTPS / Let's Encrypt) ]
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      [ Frontend Static Nginx ]             [ Express Backend API ]
      (React SPA + PWA)                     (Node.js 20, Port 4000)
                                                     │
                                   ┌─────────────────┴─────────────────┐
                                   ▼                                   ▼
                        [ PostgreSQL 16 DB ]                   [ Redis 7 Engine ]
                        (Encrypted data at rest)               (Rate limits, Cache)
```

---

## 3. Environment Variable Provisioning

Before starting the containers, create a production `.env` file in the root directory:

```bash
# Host Domain and SSL
DOMAIN_NAME=hospital.caresmart.in
COOKIE_DOMAIN=hospital.caresmart.in

# Database Secrets
POSTGRES_USER=caresmart_admin
POSTGRES_PASSWORD=UseAStrongRandomPassword128CharsLong!
POSTGRES_DB=caresmart_production

# Redis Secrets
REDIS_PASSWORD=AnotherStrongRandomPassword64Chars!

# Application Secrets
JWT_ACCESS_SECRET=GenerateA64CharacterHexSecretForJWTAccessTokens!
JWT_REFRESH_SECRET=GenerateA64CharacterHexSecretForJWTRefreshTokens!

# 256-bit Hex Key for Sensitive Field Encryption (AES-256-GCM)
FIELD_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# 256-bit Hex Key for Searchable HMAC Phone Hashes
PHONE_HASH_KEY=fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210

# Razorpay Production / Test Credentials
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Initial System Administrator Credentials
INITIAL_ADMIN_EMAIL=director@hospital.caresmart.in
INITIAL_ADMIN_PASSWORD=InitialTemporaryAdminPassword2026!
INITIAL_ADMIN_NAME="Dr. Hospital Director"
INITIAL_ADMIN_PHONE="+919848011111"
```

---

## 4. Deployment Steps

### Step 1: Clone Repository & Build Images
```bash
git clone https://github.com/hospital/caresmart.git /opt/caresmart
cd /opt/caresmart
cp .env.example .env
# Edit .env with your generated production secrets
```

### Step 2: Database Migration & Production Seeding
Migrations are executed as an explicit, controlled step (never on dynamic container restart):

```bash
# Run database migrations
docker compose -f docker-compose.prod.yml run --rm backend sh -c "cd database && npx prisma migrate deploy"

# Seed initial production administrator and base catalogs (NO demo patients or demo users)
docker compose -f docker-compose.prod.yml run --rm backend sh -c "cd database && npm run seed:production"
```

### Step 3: Launch Full Container Stack
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Step 4: Verify System Health
```bash
# Check service health
curl -f https://hospital.caresmart.in/api/v1/health
curl -f https://hospital.caresmart.in/api/v1/ready

# Check container status
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Security Post-Deployment Checks
1. Ensure the root directory `.env` file has file permissions set to `chmod 600 .env`.
2. Confirm that port 5432 (Postgres) and port 6379 (Redis) are NOT exposed to the public internet on your firewall.
3. Access `https://hospital.caresmart.in/login`, sign in with `INITIAL_ADMIN_EMAIL`, and immediately change the default password.
4. Verify the cryptographic audit chain status at `https://hospital.caresmart.in/admin`.
