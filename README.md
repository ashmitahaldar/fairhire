# FairHire

A bias-awareness tool for hiring and promotion decisions. FairHire analyses interview transcripts to surface patterns of biased language — criteria drift, asymmetric concern, hedging language, and age bias — and presents them to managers as a personal reflection tool (Decision Companion) and an aggregate pattern view (Pattern Mirror).

Built for Singapore's investment banking context with demographic fields specific to the local workforce.

---

## Architecture

```
fairhire/
  web/        React + Vite + TypeScript       — frontend (Vercel)
  api/        Node.js + Express + TypeScript  — backend API (Render)
  shared/     Shared TypeScript types         — consumed by both web and api
  prisma/     schema.prisma + migrations + manual RLS SQL
  scripts/    seed.ts, check-env.ts, check-rls.ts
```

**Data flow:**
1. Manager logs in via Clerk → `POST /auth/sync` creates or finds their `Manager` row
2. Manager uploads an interview transcript → stored in `meetings` table
3. Analysis engine (Week 2) reads the transcript and writes `Flag` rows via `POST /internal/analysis/:runId/results`
4. Manager views their Decision Companion (per-meeting flags) and Pattern Mirror (cross-meeting trends)
5. HR admin views aggregate flag and decision counts across the whole organisation via `GET /hr/summary`

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, React Router |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL via Supabase |
| Auth | Clerk |
| Deployment | Vercel (web), Render (api) |
| Testing | Jest, ts-jest, supertest |
| CI | GitHub Actions |

---

## Prerequisites

- Node.js >= 20
- A [Supabase](https://supabase.com) project with two connection strings (pooled + direct)
- A [Clerk](https://clerk.com) application (separate apps recommended for dev and prod)

---

## Local development

**1. Install dependencies**

```bash
npm install
```

**2. Set up environment variables**

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

See [Environment variables](#environment-variables) below for details on each variable.

**3. Run database migrations**

```bash
npm run db:migrate
```

**4. Apply Row-Level Security**

Run `prisma/manual/001_rls.sql` in the Supabase SQL editor. The file contains step-by-step instructions at the top. This only needs to be done once per Supabase project.

**5. Seed the database**

```bash
npm run seed:reset
```

This is destructive — it clears all tables and rebuilds with synthetic data (Meridian Capital Partners org, 5 managers, 10 candidates, 12 meetings, 33 bias flags).

**6. Start the development servers**

In two terminals:

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:5173
```

---

## Environment variables

All variables are documented in `.env.example`. Summary:

| Variable | Where used | Description |
|---|---|---|
| `DATABASE_URL` | api | Supabase pooled connection string — used by Prisma at runtime. Must connect as `app_user` after RLS setup. |
| `DIRECT_URL` | api, scripts | Supabase direct connection string — used by Prisma migrations and the seed script (superuser, bypasses RLS). |
| `CLERK_SECRET_KEY` | api | Clerk backend secret key. |
| `CLERK_PUBLISHABLE_KEY` | api | Clerk publishable key — required by `@clerk/express` middleware. |
| `VITE_CLERK_PUBLISHABLE_KEY` | web | Same value as above; `VITE_` prefix exposes it to the browser. |
| `INTERNAL_API_SECRET` | api | Shared secret for `POST /internal/*` routes (used by analysis engine, not Clerk). Generate with `openssl rand -hex 32`. |
| `WEB_URL` | api | Frontend origin for CORS — e.g. `https://fairhire-azure.vercel.app` in prod, `http://localhost:5173` in dev. |
| `VITE_API_BASE_URL` | web | API base URL — e.g. `https://fairhire-api.onrender.com` in prod, `http://localhost:3001` in dev. |

Validate that all required variables are set:

```bash
npm run check-env
```

---

## Available scripts

| Script | Description |
|---|---|
| `npm run dev:web` | Start Vite dev server |
| `npm run dev:api` | Start API with tsx watch |
| `npm run build` | Build all workspaces (shared → api → web) |
| `npm run type-check` | `tsc --noEmit` across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm test --workspace=api` | Run API test suite |
| `npm run seed:reset` | Destructive reseed with synthetic data |
| `npm run check-env` | Validate required env vars |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |

---

## API routes

All routes except `/health`, `/auth/*`, and `/internal/*` require a valid Clerk JWT and a corresponding `Manager` row.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | none | Health check |
| `POST` | `/auth/sync` | Clerk JWT | Upsert Manager row on first login |
| `GET` | `/auth/me` | Clerk JWT + Manager | Return current manager profile |
| `GET` | `/meetings` | Manager | List own meetings |
| `POST` | `/meetings` | Manager | Create meeting with transcript |
| `GET` | `/meetings/:id` | Manager (owner) | Get meeting with flags and last analysis run |
| `GET` | `/decisions` | Manager | List own decisions |
| `POST` | `/decisions` | Manager | Create decision for a meeting/candidate |
| `PATCH` | `/decisions/:id` | Manager (owner) | Update decision outcome |
| `GET` | `/flags` | Manager | List flags for own meetings |
| `PATCH` | `/flags/:id/dismiss` | Manager (owner) | Dismiss a flag with a reason |
| `GET` | `/hr/summary` | hr_admin | Org-wide aggregate flag and decision counts |
| `POST` | `/internal/analysis/:runId/results` | INTERNAL_API_SECRET header | Analysis engine callback (Week 2) |

---

## Database schema

Nine tables with full Row-Level Security. Managers can only read and write their own data — enforced at the Postgres level via a session variable (`app.current_manager_id`) set inside every transaction by `withManagerContext()`.

HR admins access aggregate data only. The `/hr/summary` endpoint uses raw aggregate SQL; individual rows are never returned from any `/hr/*` route.

Key entities:

- **Organisation / Department** — tenant isolation layer
- **Manager** — linked to Clerk user ID; role is `manager` or `hr_admin`
- **Candidate** — Singapore-specific demographics: `nationality_status`, `race`, `age_band`, `gender`, plus a `self_reported_demographics` JSONB field
- **Meeting** — stores the raw interview transcript
- **Flag** — a detected bias signal: type, excerpt, reasoning, confidence score, optional suggested alternative phrasing, dismissal state
- **Decision** — hiring outcome per candidate per meeting: `hired`, `rejected`, or `in_progress`
- **AnalysisRun** — tracks the status of each transcript analysis job

---

## Testing

```bash
npm test --workspace=api
```

Six tests across three files, covering the Week 1 security checklist:

| File | Tests |
|---|---|
| `meetings.test.ts` | Scope isolation (own meetings only), cross-manager 403 |
| `hr.test.ts` | Aggregate response shape for hr_admin, 403 for regular manager |
| `internal.test.ts` | 401 for missing secret header, 401 for wrong secret header |

Clerk and Prisma are fully mocked — no database connection or real token required.

**Note on RLS:** These tests validate application-layer enforcement (route `where` clauses, `requireOwnership`, `requireRole`). Postgres RLS policy correctness is validated separately by `scripts/check-rls.ts`, which confirms all 9 tables have RLS enabled and all 21 policies are present.

---

## Deployment

**Frontend — Vercel**

The `vercel.json` at the project root configures the build. Set these environment variables in the Vercel dashboard:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`

**Backend — Render**

The `render.yaml` at the project root defines the service. Set these environment variables in the Render dashboard:

- `DATABASE_URL`
- `DIRECT_URL`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `INTERNAL_API_SECRET`
- `WEB_URL`

The build command runs `prisma generate` automatically — no manual step needed on Render.

---

## Bias patterns in seed data

The synthetic dataset (`npm run seed:reset`) contains four distinct bias patterns, designed to be detectable by the analysis engine in Week 2:

| Manager | Pattern | Description |
|---|---|---|
| Wei Liang Tan | `criteria_drift` | Language and communication concerns raised disproportionately for Malay and Indian candidates |
| Priya Nair | `asymmetric_concern` | Family planning and childcare questions asked of female candidates only |
| David Lim | `hedging_language` + `age_bias` | Vague "culture fit" language for non-Chinese candidates; "energy" concerns for 50+ candidates |
| Marcus Chen | clean | Two low-confidence false positives, both dismissed — control case |
