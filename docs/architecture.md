# Architecture

## Final MVP Plan

Product:
- Build a production-style, multi-tenant donation platform where many charities run on one shared platform.

Core model:
- Single database.
- Every tenant-scoped table contains `tenantId`.
- Tenant admin JWT stores `tenantId` and role claims.
- Every admin query enforces tenant filtering by `tenantId`.

Roles:
- Donor: visits public donation page and pays.
- Tenant admin: logs in, views donations, edits branding/config.
- Platform admin: creates new tenants.

MVP endpoints:
- Public:
  - `GET /api/public/tenants/:slug`
  - `POST /api/public/donations`
  - `POST /api/webhooks/stripe`
- Auth/Admin:
  - `POST /api/auth/login`
  - `GET /api/admin/donations`
  - `PATCH /api/admin/config`
- Platform:
  - `POST /api/platform/tenants`

MVP frontend:
- `GET /` simple home/navigation shell
- `GET /c/:slug` public tenant donation page
- `GET /admin` tenant admin login + dashboard

Definition of done:
- One-command local start via Docker Compose.
- Seeded demo tenant and admin user.
- JWT auth and tenant isolation on admin APIs.
- Stripe PaymentIntent + webhook status updates.
- Admin dashboard shows tenant-scoped donations and allows config edits.
- Architecture docs explain isolation and flow.

## Step 2: Local Runtime Topology

Services in `docker-compose.yml`:
- `sqlserver`: SQL Server 2022 Developer, exposed on `localhost:1433`
- `api`: Node container placeholder, depends on SQL Server
- `web`: Node container placeholder, depends on API

Connection model:
- API reaches database using host `sqlserver` on Docker network.
- Web calls API through `VITE_API_BASE_URL` (currently set to `http://localhost:3000`).

Current scope after Step 2:
- Infrastructure wiring is in place.
- API and Web app logic were placeholders.

## Step 3: API Skeleton

Implemented in `apps/api`:
- Express app bootstrap
- `GET /api/health` liveness endpoint
- Minimal smoke test with Vitest + Supertest

Current service status:
- API: real service
- Web: placeholder service

## Step 4: Web Skeleton

Implemented in `apps/web`:
- Vue 3 app bootstrap with Vite
- Vue Router routes:
  - `/`
  - `/c/:slug`
  - `/admin`
- Basic UI shell and page placeholders

Current service status:
- API: real service
- Web: real service

## Runtime Note

- API and Web now run from built Docker images (no host bind-mount for source).
- This avoids Linux/Windows optional dependency mismatches inside containers.
- Tradeoff: after code edits, rebuild with `docker compose up -d --build`.

## Step 5: Database Schema and Seed

Scripts:
- `apps/api/sql/001_init.sql`: creates `Tenants`, `TenantConfig`, `Users`, `Donations`
- `apps/api/sql/002_seed.sql`: inserts one demo tenant, one tenant admin, and two donations

Important schema choices:
- `tenantId` exists on tenant-scoped tables for multitenancy enforcement
- `amountMinor` stores money in minor units (pence/cents) as integer
- `status` is constrained to `Pending`, `Paid`, `Failed`
- `stripePaymentIntentId` and `stripeEventId` have unique indexes for idempotency

Operational note:
- `db-init` helper service runs SQL scripts using `sqlcmd`
- SQL Server memory limit is set to `2048 MB` in compose for development ergonomics

## Step 6: Auth and Tenant Isolation

Implemented in API:
- `POST /api/auth/login` with `tenantSlug + email + password`
- JWT includes `tenantId`, `tenantSlug`, `role`, `email`, and `sub` (`userId`)
- `requireAuth` middleware validates bearer token
- `requireRole` middleware enforces role checks
- `requireTenantScope` middleware extracts `tenantId` from token for tenant-filtered queries
- `GET /api/admin/me` protected route demonstrates tenant-scoped query (`Donations` count filtered by `tenantId`)

Security choices:
- Passwords are bcrypt hashes in DB seed data
- Login returns generic `Invalid credentials` on auth failure
- API rejects missing/invalid/expired JWT with `401`

## Step 7: Admin APIs

Implemented:
- `GET /api/admin/donations`
  - Returns donations filtered by JWT `tenantId`
  - Sorted by `createdAt DESC`
- `PATCH /api/admin/config`
  - Updates tenant branding/config values for JWT `tenantId`
  - Supports `brandColor`, `logoUrl`, `currency`, `donationPresets`
  - Validates input shape and formats before update

Tenant isolation enforcement:
- Route middleware chain: `requireAuth -> requireRole('tenant_admin') -> requireTenantScope`
- Query layer always uses `WHERE tenantId = @tenantId`
- No tenant ID accepted from client body/query for these admin routes

## Step 8: Public Tenant and Donation APIs

Implemented:
- `GET /api/public/tenants/:slug`
  - Resolves tenant and returns tenant branding/config payload
- `POST /api/public/donations`
  - Resolves tenant by slug
  - Validates donation payload (`amountMinor`, optional `donorEmail`, optional `currency`)
  - Creates Stripe PaymentIntent
  - Inserts `Donations` row with status `Pending` and `stripePaymentIntentId`

Operational notes:
- `PAYMENTS_MODE=stripe` is the default for portfolio flows using Stripe test mode
- Stripe mode requires `STRIPE_SECRET_KEY=sk_test_...`
- Optional demo fallback uses `PAYMENTS_MODE=demo`
- In demo mode, API returns synthetic `pi_demo_*` intent IDs and client secrets
- Webhook status transitions (`Pending -> Paid/Failed`) are implemented in Step 9

## Step 9: Stripe Webhook and Idempotency

Implemented:
- `POST /api/webhooks/stripe`
  - Uses raw request body for Stripe signature verification
  - Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`
  - Maps event types to donation statuses:
    - `payment_intent.succeeded` -> `Paid`
    - `payment_intent.payment_failed` / `payment_intent.canceled` -> `Failed`

Idempotency behavior:
- Locates donation by `stripePaymentIntentId`
- Ignores unsupported event types
- Ignores duplicate event IDs
- Updates only donations still in `Pending` state
- Stores processed Stripe event ID in `stripeEventId`

Config requirements:
- `STRIPE_SECRET_KEY` for Stripe API client
- `STRIPE_WEBHOOK_SECRET` for webhook signature verification

## Step 10: Frontend Integration

Implemented in `apps/web`:
- Shared API client for browser requests with optional bearer token support
- Public tenant page (`/c/:slug`) that:
  - fetches tenant branding/config
  - creates donation intents through backend API
  - shows PaymentIntent/client-secret response metadata
- Admin dashboard (`/admin`) that:
  - authenticates with `/api/auth/login`
  - stores JWT session in browser `localStorage`
  - loads tenant profile and donation list
  - updates tenant branding/config

API runtime updates for browser integration:
- CORS enabled on API service so web app (`localhost:5173`) can call API (`localhost:3000`)

## Step 11: Platform Admin Endpoint

Implemented in API:
- `POST /api/platform/tenants`
  - Guarded by `x-platform-secret` header
  - Validates `name` and `slug`
  - Creates tenant row + default tenant config row

Remaining work after Step 11:
- Production UI hardening and full Stripe Checkout/Elements UX
- CI/CD pipeline and deployment automation
