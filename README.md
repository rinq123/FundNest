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
- Platform-admin tenant creation is implemented

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

## Seeded Demo Credentials

- Tenant slug: `demo-charity`
- Admin email: `admin@democharity.local`
- Admin password: `DemoAdmin123!`

## API Surface (Current)

Public:
- `GET /api/public/tenants/:slug`
- `POST /api/public/donations`

Webhooks:
- `POST /api/webhooks/stripe`

Auth:
- `POST /api/auth/login`

Tenant Admin (JWT required):
- `GET /api/admin/me`
- `GET /api/admin/donations`
- `PATCH /api/admin/config`

Platform Admin (header `x-platform-secret` required):
- `POST /api/platform/tenants`

System:
- `GET /api/health`

## Web Features (Current)

Public page (`/c/:slug`):
- Loads tenant branding/config from API
- Creates donation intents through `/api/public/donations`
- Displays PaymentIntent metadata returned by API

Admin page (`/admin`):
- Authenticates via `/api/auth/login`
- Loads tenant dashboard from `/api/admin/me` and `/api/admin/donations`
- Updates tenant branding/config with `/api/admin/config`
- Stores JWT session in `localStorage`

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

Stop stack:
```powershell
docker compose down
```

## Roadmap

Pending MVP work:
- CI/CD and cloud deployment hardening

## End-to-End Demo Runbook

1. Open `http://localhost:5173/admin` and login:
- tenant: `demo-charity`
- email: `admin@democharity.local`
- password: `DemoAdmin123!`

2. Open `http://localhost:5173/c/demo-charity` and create a donation intent.

3. Copy returned PaymentIntent ID (`pi_...`) and confirm via Stripe CLI:
```bash
stripe payment_intents confirm <pi_id> --payment-method pm_card_visa
```

4. Verify status update:
- Stripe listener should show `payment_intent.succeeded` forwarded
- Admin donations list should show the donation status as `Paid`

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
