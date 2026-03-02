# FundNest (Guided Build)

We will build this in small steps.

## Why These Files Exist
- `apps/api`: Express backend
- `apps/web`: Vue frontend
- `packages/shared`: shared types/constants
- `docs`: architecture and setup notes
- `docker-compose.yml`: starts database + API + web together
- `.env`: local settings (passwords/ports), created from `.env.example`
- `apps/api/sql/001_init.sql`: creates database tables and constraints
- `apps/api/sql/002_seed.sql`: inserts one demo tenant/admin/donations

## Current Step
- Step 8 complete: public tenant lookup + donation intent API

## Daily Start/Stop (Beginner Flow)
1. Start:
   - `docker compose up -d --build`
2. Check:
   - `docker compose ps`
3. Stop when done:
   - `docker compose down`

## First-Time Setup
1. Copy env template:
   - PowerShell: `Copy-Item .env.example .env`
2. Start containers:
   - `docker compose up -d --build`
3. Check status:
   - `docker compose ps`

Expected containers:
- `fundnest-sqlserver` (real SQL Server)
- `fundnest-api` (real Express API)
- `fundnest-web` (real Vue app)

Note:
- API is implemented with `GET /api/health`.
- Web is implemented with Vue + Vue Router.
- We intentionally do not bind-mount source into containers right now.
- After code changes, rerun `docker compose up -d --build`.
- SQL Server memory is capped to `2048 MB` in compose for lighter local usage.

## Step 3: Verify API
1. Start:
   - `docker compose up -d --build`
2. Test API health:
   - Open `http://localhost:3000/api/health`
3. Optional test run on host:
   - `npm install`
   - `npm run test:api`

## Step 4: Verify Web
1. Start:
   - `docker compose up -d --build`
2. Open the web app:
   - `http://localhost:5173`
3. Check routes:
   - `http://localhost:5173/`
   - `http://localhost:5173/c/demo-charity`
   - `http://localhost:5173/admin`

## Step 5: Create Schema + Seed Data
1. Ensure DB container is running:
   - `docker compose up -d sqlserver`
2. Apply schema + seed scripts:
   - `docker compose --profile tools run --rm db-init`
3. Optional: run full stack after seeding:
   - `docker compose up -d --build`

Seeded demo data:
- Tenant slug: `demo-charity`
- Admin email: `admin@democharity.local`
- Admin password: `DemoAdmin123!`
- Sample donations: 2 rows

## Step 6: JWT Auth + Tenant Scope
1. Re-apply seed (adds hashed demo password):
   - `docker compose up -d sqlserver`
   - `docker compose --profile tools run --rm db-init`
2. Rebuild API:
   - `docker compose up -d --build api`
3. Login (PowerShell):
   - `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{\"tenantSlug\":\"demo-charity\",\"email\":\"admin@democharity.local\",\"password\":\"DemoAdmin123!\"}'`
4. Copy `accessToken` from response and call protected endpoint:
   - `Invoke-RestMethod -Uri http://localhost:3000/api/admin/me -Headers @{ Authorization = \"Bearer <PASTE_TOKEN>\" }`

Expected:
- Login returns JWT token + user object
- `/api/admin/me` returns tenant-bound claims and donation count

## Step 7: Admin APIs
New endpoints:
- `GET /api/admin/donations`
- `PATCH /api/admin/config`

Both require:
- `Authorization: Bearer <accessToken>`
- `role = tenant_admin`
- tenant isolation via `tenantId` from JWT claim

PowerShell verification:
1. Login and store token:
   - `$body = @{ tenantSlug = 'demo-charity'; email = 'admin@democharity.local'; password = 'DemoAdmin123!' } | ConvertTo-Json`
   - `$login = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/login -ContentType 'application/json' -Body $body`
   - `$token = $login.accessToken`
2. Get tenant donations:
   - `Invoke-RestMethod -Uri http://localhost:3000/api/admin/donations -Headers @{ Authorization = \"Bearer $token\" } | ConvertTo-Json -Depth 8`
3. Update tenant config:
   - `$patch = @{ brandColor = '#1e88e5'; currency = 'GBP'; donationPresets = @(1000,2500,5000) } | ConvertTo-Json`
   - `Invoke-RestMethod -Method Patch -Uri http://localhost:3000/api/admin/config -ContentType 'application/json' -Headers @{ Authorization = \"Bearer $token\" } -Body $patch | ConvertTo-Json -Depth 8`

## Step 8: Public Tenant + Donation Endpoints
New endpoints:
- `GET /api/public/tenants/:slug`
- `POST /api/public/donations`

Behavior:
- Tenant endpoint returns tenant + branding/config by slug.
- Donation endpoint creates a payment intent and stores a `Pending` donation.
- Default mode is `stripe` (Stripe test mode recommended for portfolio).

PowerShell verification:
1. Tenant lookup:
   - `Invoke-RestMethod -Uri http://localhost:3000/api/public/tenants/demo-charity | ConvertTo-Json -Depth 8`
2. Donation creation (Stripe mode):
   - Ensure `.env` has `PAYMENTS_MODE=stripe`
   - Set `STRIPE_SECRET_KEY=sk_test_...`
   - Rebuild API: `docker compose up -d --build api`
   - `$donation = @{ tenantSlug = 'demo-charity'; amountMinor = 2500; donorEmail = 'donor@example.com' } | ConvertTo-Json`
   - `Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/public/donations -ContentType 'application/json' -Body $donation | ConvertTo-Json -Depth 8`
3. Optional demo fallback (no Stripe account):
   - Set `.env` value: `PAYMENTS_MODE=demo`
   - Rebuild API: `docker compose up -d --build api`

Expected donation response:
- `status = Pending`
- `stripePaymentIntentId`
- `clientSecret`
- `paymentProvider` (`demo` or `stripe`)
