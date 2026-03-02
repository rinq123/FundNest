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
- Stripe webhook processing and platform-admin tenant creation are pending

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
- `PAYMENTS_MODE` (`stripe` or `demo`)
- `STRIPE_SECRET_KEY`

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

Auth:
- `POST /api/auth/login`

Tenant Admin (JWT required):
- `GET /api/admin/me`
- `GET /api/admin/donations`
- `PATCH /api/admin/config`

System:
- `GET /api/health`

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
- Stripe webhook handler (`/api/webhooks/stripe`) with signature verification and idempotency
- Platform admin tenant creation endpoint (`/api/platform/tenants`)
- Frontend integration for login, admin dashboard data, and payment confirmation flow
- CI/CD and cloud deployment hardening

