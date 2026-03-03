# FundNest

Multi-tenant donation platform (portfolio project) built to demonstrate backend architecture, tenant isolation, payments integration, and cloud-ready deployment workflows.

## Overview

FundNest supports multiple charities (tenants) on one shared platform:
- Public tenant donation pages by slug
- Tenant-scoped admin access with JWT auth
- SQL Server persistence with strict tenant filtering
- Stripe PaymentIntent integration (test mode)

Current status:
- Public tenant lookup and donation intent creation are implemented
- Admin donation/config APIs are implemented with tenant isolation
- Stripe webhook processing is implemented
- Frontend is integrated with live API for tenant and admin flows
- Platform-admin tenant lifecycle is implemented (list/create/archive/unarchive/delete)

## Architecture

- Frontend: Vue 3 + Vue Router (`apps/web`)
- Backend: Node.js + Express (`apps/api`)
- Database: SQL Server (`sqlserver` container)
- Payments: Stripe PaymentIntent (or optional local demo provider)
- Auth: JWT with `tenantId` and role claims
- Runtime: Docker Compose

Tenant isolation model:
1. Admin JWT includes `tenantId`
2. Middleware enforces auth + role + tenant scope
3. Every admin DB query filters by `tenantId`
4. Public endpoints resolve tenant from slug

## Repository Layout

```text
apps/
  api/        Express API, SQL scripts, tests
  web/        Vue app
docs/         Architecture and design notes
docker-compose.yml
apps/web/.env.example
```

## Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Node.js 20+ (for local test commands)

## Quick Start

1. Create local env:
```powershell
Copy-Item .env.example .env
```

2. Set required values in `.env`:
- `JWT_SECRET`
- `PLATFORM_ADMIN_SECRET`
- `STRIPE_SECRET_KEY` (test mode key, `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (from `stripe listen` output)

3. Start stack:
```powershell
docker compose up -d --build
```

4. Initialize database schema + seed data:
```powershell
docker compose --profile tools run --rm db-init
```

5. Verify services:
- API health: `http://localhost:3000/api/health`
- Web app: `http://localhost:5173`

## Run Instructions (Local)

First-time setup:
```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose --profile tools run --rm db-init
```

Start or refresh services after code changes:
```powershell
docker compose up -d --build api web
```

Run API tests:
```powershell
npm run test:api
```

If SQL scripts changed, reapply schema/seed:
```powershell
docker compose --profile tools run --rm db-init
```

If `.env` changed and values are not reflected:
```powershell
docker compose up -d --force-recreate api
```

Stop services:
```powershell
docker compose down
```

## What This Demonstrates

- Multi-tenant architecture with strict tenant isolation (`tenantId` in token claims and query filters)
- Role-based access control (RBAC) with separate `tenant_admin` and `platform_admin` capabilities
- End-to-end payment flow using Stripe PaymentIntents and webhook-driven status updates
- Platform operations lifecycle (create/list/archive/unarchive/delete tenants)
- Containerized developer workflow (Docker Compose + SQL Server + API + Vue frontend)
- Basic validation and smoke-test coverage for critical API behavior

## Environment Variables

Core values in `.env`:
- `SQL_SA_PASSWORD`
- `SQL_DATABASE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PLATFORM_ADMIN_SECRET`
- `PAYMENTS_MODE` (`stripe` or `demo`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Notes:
- Default payment mode is `stripe` (test mode expected)
- `demo` mode is available for offline payment-flow demos

## Default Access

- Platform admin email: `platform@fundnest.local`
- Platform admin password: `DemoPlatform123!`

Tenant admins are provisioned when a tenant is created:
- A tenant admin user is created automatically.
- Tenant admin email format: `admin@<tenant-slug>.local`
- Default tenant admin password: `DemoAdmin123!`
- Tenant admins can change password from the Admin Console (`/admin`) after login.
- No tenant is seeded by default; create the first tenant from the Platform Admin dashboard.

## API Surface (Current)

Public:
- `GET /api/public/tenants`
- `GET /api/public/tenants/:slug`
- `POST /api/public/donations`

Webhooks:
- `POST /api/webhooks/stripe`

Auth:
- `POST /api/auth/login`
  - Supports `loginMode=tenant` (requires `tenantSlug`) or `loginMode=platform`

Tenant Admin (JWT required):
- `GET /api/admin/me`
- `GET /api/admin/donations`
- `PATCH /api/admin/config`
- `POST /api/admin/change-password`

Platform Admin (JWT `platform_admin` role required, or legacy `x-platform-secret`):
- `GET /api/platform/tenants`
- `GET /api/platform/tenants/:tenantId`
- `GET /api/platform/tenants/:tenantId/donations`
- `POST /api/platform/tenants`
- `PATCH /api/platform/tenants/:tenantId/archive`
- `DELETE /api/platform/tenants/:tenantId`

System:
- `GET /api/health`

## Web Features (Current)

Public page (`/c/:slug`):
- Loads tenant branding/config from API
- Creates donation intents through `/api/public/donations`
- Displays PaymentIntent metadata returned by API

Admin page (`/admin`):
- Single login page with role switch:
  - Tenant admin mode
  - Platform admin mode
- Tenant admin dashboard:
  - loads `/api/admin/me` and `/api/admin/donations`
  - updates tenant branding via `/api/admin/config`
  - allows tenant admin password changes via `/api/admin/change-password`
- Platform admin dashboard:
  - lists all tenants
  - creates tenants
  - archives/unarchives tenants
  - deletes tenants
  - opens an internal tenant management view with tenant details + donation history
- Stores JWT session in `localStorage`

Home page (`/`):
- Dynamically lists active public tenant pages using `/api/public/tenants`
- Shows an empty-state message when no active tenants exist
- Includes admin-console link

Archive behavior:
- Archived tenants are not available on public routes (`/c/:slug` API data will return not found).
- Archived tenant admins cannot log in until tenant is unarchived.

Delete guard behavior:
- Platform admin cannot delete the last active tenant.
- To delete a tenant in that case, create or unarchive another active tenant first.

## Testing

Run API tests:
```powershell
npm run test:api
```

Test coverage currently includes:
- health endpoint smoke tests
- JWT helper tests
- auth guard tests
- public payload validation tests
- payment provider demo-path tests

## Development Workflow

Typical cycle:
1. Update code
2. Rebuild changed service
```powershell
docker compose up -d --build api
```
3. Run tests
```powershell
npm run test:api
```
4. If SQL schema scripts changed, re-run DB init
```powershell
docker compose --profile tools run --rm db-init
```

Stop stack:
```powershell
docker compose down
```

## Roadmap

Pending MVP work:
- CI/CD and cloud deployment hardening

## End-to-End Demo Runbook

1. Open `http://localhost:5173/admin` and login as platform admin:
- login mode: `Platform Admin`
- email: `platform@fundnest.local`
- password: `DemoPlatform123!`

2. In `Platform: Create Tenant`, create a tenant (for example `name=Save Paws`, `slug=save-paws`).

3. Copy the created tenant admin credentials shown in the success panel:
- tenant slug: `<your-slug>`
- tenant admin email: `admin@<your-slug>.local`
- default password: `DemoAdmin123!`

4. Open `http://localhost:5173/c/<your-slug>` and create a donation intent.

5. Copy returned PaymentIntent ID (`pi_...`) and confirm via Stripe CLI:
```bash
stripe payment_intents confirm <pi_id> --payment-method pm_card_visa
```

6. Verify status update:
- Stripe listener should show `payment_intent.succeeded` forwarded
- Tenant admin donations list should show the donation status as `Paid`

## Stripe Webhook (Local)

1. Ensure Stripe mode and keys are configured in `.env`:
- `PAYMENTS_MODE=stripe`
- `STRIPE_SECRET_KEY=sk_test_...`

2. Start webhook forwarding with Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Copy generated signing secret from CLI output and set:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

4. Rebuild API:
```powershell
docker compose up -d --build api
```

5. Trigger a test event:
```bash
stripe trigger payment_intent.succeeded
```
