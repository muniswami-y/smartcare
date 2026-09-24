# @caresmart/frontend

CareSmart Web Application and Progressive Web App (PWA) built with React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, and react-i18next.

---

## Features
- **Role-Based Single Page Application:** Tailored clinical, nursing, pharmacy, diagnostic, and cashier workspaces.
- **Multilingual Support:** English, Telugu, and Hindi with strict key-parity build verification.
- **Brand Aesthetic:** Curated hospital color palette (#0B2E33 Navy, #028090 Teal, #2BB3BE Light Teal, #02C39A Mint) with accessible micro-animations, skeleton loaders, and responsive mobile-first layouts (360px+).
- **Offline-First PWA:** Installable on Android, iOS, and tablets; caches static bundles only, strictly never caching patient PHI.
- **Medical Image Viewer:** Multi-tool canvas supporting zoom, pan, 90° rotation, color invert, brightness/contrast adjustments, 2-point measurement calipers, and DICOM fallback downloads.
- **Public Price Transparency:** Searchable tariff catalog with biological test preparation instructions and turnaround times.

---

## Directory Structure
```
src/
  ├── api/          # Typed API client with token injection & error handling
  ├── components/   # UI kit (Button, Badge, Card, Modal, Skeleton, EmptyState) & ImageViewer
  ├── features/     # Auth, Reception, Doctor, Nurse, Pharmacy, Lab, Radiology, Billing, IPD, Portal, Admin, Prices
  ├── i18n/         # Dictionaries (en.json, te.json, hi.json) & initialization
  ├── lib/          # Utility helpers (cn, classnames)
  └── styles/       # Tailwind index.css directives
```

---

## Development Commands
```bash
# Start development server
npm run dev

# Run UI component and format tests
npm test

# Verify i18n translation completeness across all 3 languages
npm run i18n:verify

# Build production bundle with PWA service worker
npm run build
```
