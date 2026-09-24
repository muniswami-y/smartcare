# @caresmart/database

This package manages the single source of truth for CareSmart database schema, migrations, seeds, SQL triggers, and backup/restore scripts.

## Contents
- `prisma/schema.prisma`: Full schema definition with integer paise for money, UTC timestamps, and audit structures.
- `prisma/seed.demo.ts`: Rich demo data with all roles, doctors, 20 patients, visits, admissions, medicines, lab & imaging items, bills.
- `prisma/seed.production.ts`: Production bootstrap creating the initial admin from environment variables and empty master templates.
- `sql/`: Append-only triggers for `AuditLog` and least-privilege role setups.
- `scripts/`: Production backup with AES-256 encryption, Gzip compression, daily/weekly/monthly retention, and restore verification.

## Commands
```bash
# Generate Prisma Client
npm run prisma:generate

# Run Migrations
npm run prisma:migrate

# Seed Demo Data
npm run seed:demo

# Seed Production Data
npm run seed:production

# Run Tests
npm test
```
