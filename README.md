# Corporate Finance & Accounting ERP

An internal, corporate-scale finance and accounting system: registration with KYC documents, email verification, admin approval, JWT authentication, RBAC, double-entry accounting, financial documents, counterparties, contracts, budgets, expense-request workflows, idempotent payments, financial period closing, an audit trail, financial analytics, and XLSX/PDF/DOCX reporting.

Built as a single, well-organized **modular monolith** in NestJS + PostgreSQL. There is no fleet of microservices, no message broker, and no Kubernetes manifest here - at this system's scale that would be complexity bought for its own sake, not for a real requirement. See [Architecture](#architecture) for why.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Modules](#modules)
- [Database Architecture](#database-architecture)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Financial Domain](#financial-domain)
- [Accounting](#accounting)
- [Transactions](#transactions)
- [Concurrency](#concurrency)
- [Idempotency](#idempotency)
- [Audit](#audit)
- [Reports](#reports)
- [File Storage](#file-storage)
- [Development](#development)
- [Production](#production)
- [Docker](#docker)
- [Environment Variables](#environment-variables)
- [Nginx](#nginx)
- [SSL](#ssl)
- [Deployment](#deployment)
- [Migrations](#migrations)
- [Backup](#backup)
- [Restore](#restore)
- [Swagger](#swagger)
- [Testing](#testing)
- [Security](#security)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [How to Create a New Module](#how-to-create-a-new-module)
- [Learning Roadmap](#learning-roadmap)

---

## Project Overview

The system supports the full lifecycle of a small-to-mid-size company's internal finance operations:

1. An employee **registers** with personal data, a passport scan, and a face photo.
2. They **verify their email** with a one-time code.
3. An **administrator reviews and approves** the account (or rejects it).
4. Once active, the employee can create **financial documents** (invoices, acts, waybills, receipts, write-offs), submit **expense requests**, and view **reports**.
5. An accountant/admin **approves and posts** documents into a **double-entry ledger**, executes **payments**, manages **budgets**, and **closes financial periods**.
6. Every sensitive action is **audited**. Every financial report can be exported to **XLSX, PDF, or DOCX**.

## Architecture

```
                 ┌──────────────────────────────────────────────────┐
                 │                   NestJS App                     │
Internet ──Nginx─┤                                                  │
 (HTTPS)         │  Controller → DTO validation → Guard (JWT/RBAC)  │
                 │       → Service (business rules) → Repository    │
                 │       → PostgreSQL                                │
                 └──────────────────────────────────────────────────┘
```

**Why a modular monolith and not microservices:** every module in this system (auth, accounting, documents, payments, budgets...) shares the same transactional boundary requirements - a document approval and a ledger posting must succeed or fail together. Splitting that across network calls would mean distributed transactions or eventual consistency for problems that a single PostgreSQL transaction already solves correctly and simply. The system is organized into clearly bounded modules (see [Modules](#modules)) so it *could* be split later if a specific module's load genuinely outgrew the rest - but nothing here justifies that cost today.

**Why not Kafka/RabbitMQ/Redis/CQRS/Event Sourcing:** none of the workflows in this system need asynchronous cross-service messaging, a second data store, or a command/query split. Report generation - the one place with a background-processing need - is handled by a small in-process job queue (`ReportJobQueue`), not a broker (see [Reports](#reports)).

**Layering inside every module**, top to bottom:

```
HTTP request
   │
Controller          - route, @RequirePermissions(), delegates to a service
   │
DTO (class-validator) - shape and validate the request body/query
   │
Service              - business rules, transactions, calls other services
   │
TypeORM Repository    - the only thing that talks to PostgreSQL
   │
PostgreSQL
```

No controller contains business logic; no service contains raw SQL string-building outside a TypeORM query builder; no module reaches into another module's repository directly - it calls that module's exported service.

## Technology Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 22 | LTS, native `fetch`/`crypto` |
| Language | TypeScript (strict) | Compile-time safety for a codebase this size |
| Framework | NestJS 10 | DI, module boundaries, decorators - the layering above is a first-class citizen |
| Database | PostgreSQL 16 | ACID transactions, row locking, `CHECK`/trigger constraints, JSONB |
| ORM | TypeORM 0.3 | Migrations-as-code, query builder for aggregation, repository pattern |
| Auth | `@nestjs/jwt` + `passport-jwt` | Stateless access tokens, standard library |
| Email | Nodemailer | SMTP, no vendor lock-in |
| XLSX | ExcelJS | Multi-sheet, styling, streaming writer |
| PDF | PDFKit | Low-level but predictable page/table control |
| DOCX | `docx` | Declarative document/table building |
| Containers | Docker + Docker Compose | See [Docker](#docker) |
| Reverse proxy / TLS | Nginx + Let's Encrypt (Certbot) | See [Nginx](#nginx), [SSL](#ssl) |

## Project Structure

```
src/
  main.ts                 bootstrap: Helmet, compression, versioning, ValidationPipe, Swagger
  app.module.ts            wires every feature module + global guards
  config/                  env validation (class-validator) + typed config namespaces
  database/
    data-source.ts         TypeORM CLI data source (migrations)
    typeorm.config.ts       runtime connection options (used by the app)
    migrations/             every schema change, in order
    seeds/                  one-off scripts (create-admin.seed.ts)
  common/                  cross-cutting: guards, decorators, filters, base entity,
                            pagination, exact-decimal money math, validators
  modules/
    auth/                  registration, login, tokens, password reset
    users/                 admin approval/reject/block/role management
    people/                personal profile, passport document, employee record
    files/                 private file storage (KYC photos, report exports)
    audit/                 append-only audit log
    mail/                  SMTP sending
    org/                   departments, cost centers, projects
    counterparties/        contragents, contacts, bank accounts
    contracts/
    accounting/             chart of accounts, financial periods, journal
                            entries/lines, the double-entry PostingService
    documents/              financial document lifecycle (draft→...→posted)
    expense-requests/       submit→approve→pay→account workflow
    payments/               idempotent payment execution
    budgets/                plan vs. actual, department/cost-center rollups
    analytics/              SQL-aggregated financial reporting queries
    reports/                XLSX/PDF/DOCX generation + report history
    health/                 GET /health
test/
  *.e2e-spec.ts             full-flow + integration tests against a real Postgres
scripts/                    deploy.sh, setup-ssl.sh, backup.sh, restore.sh
docker/                     Dockerfile support files, Nginx templates, certbot volumes
```

## Modules

Every module follows the same shape (a module doesn't need every file - a simple one like `org` skips a few - but none of them invent a different pattern):

```
modules/<name>/
  entities/*.entity.ts        TypeORM entities (or one file if there's only one)
  enums/                       status/type enums + allowed-transition tables
  dto/                         class-validator request/response shapes
  <name>.service.ts             business logic + transactions
  <name>.controller.ts          HTTP surface, one @RequirePermissions per mutation
  <name>.module.ts               imports, providers, controllers, exports
  *.spec.ts                     unit tests next to the code they test
```

**Cross-module references are plain `uuid` columns, not TypeORM relations**, whenever the two modules are in different bounded contexts (e.g. `FinancialDocument.counterpartyId` is a `uuid` column, not a `@ManyToOne` to `Counterparty`). This keeps a module from having to import another module's entity just to compile, while referential integrity is still enforced by a real foreign key added in the migration (see [Database Architecture](#database-architecture)). Relations *are* used for entities inside the same bounded context (e.g. `PassportDocument` → `PersonProfile`).

## Database Architecture

- **PostgreSQL only**, no `synchronize: true` anywhere (schema drift in production is exactly what migrations exist to prevent). See [Migrations](#migrations).
- **UUID primary keys** everywhere (`uuid_generate_v4()`), so IDs are safe to hand out over the API and never leak insert order.
- **`numeric(18,2)`** for every money column, never `float`/`double` - floating point cannot represent money exactly, and the whole point of double-entry accounting is that debits equal credits *exactly*. See [common/utils/decimal.util.ts](src/common/utils/decimal.util.ts) for the BigInt-backed exact arithmetic this forces on the application side too.
- **Foreign keys, unique constraints, and `CHECK` constraints** are real database constraints, not just application-level checks - see `migrations/*-AddIntegrityConstraints.ts` for the full list, including a `CHECK` that a `journal_lines` row can't be a debit and a credit at once.
- **A Postgres trigger** (`check_journal_entry_balance`, same migration) re-validates `SUM(debit) = SUM(credit)` for every `POSTED` journal entry after any change to `journal_lines` - true defense in depth: it fires even if a bug, a bypass of `PostingService`, or a manual `psql` session tries to write an unbalanced entry. See [Accounting](#accounting).
- **Indexes** on every foreign-key-shaped column and on fields used in `WHERE`/`ORDER BY` in the query patterns above (see the entities for `@Index()` usage).
- Two roles (`WORKER`, `ADMIN`) and every permission code are **seeded by a migration**, not hardcoded in a guard - see `migrations/*-SeedRolesAndPermissions.ts`. Adding a role is a data change, not a code change.

## Authentication

```
Register (multipart: personal data + 3 photos)
   │
Account created, status = PENDING_EMAIL_VERIFICATION
   │
6-digit code emailed → POST /auth/verify-email
   │
status = PENDING_ADMIN_APPROVAL
   │
Admin: POST /users/:id/approve  (or /reject)
   │
status = ACTIVE → POST /auth/login now succeeds
```

- Passwords are hashed with **bcrypt** (cost factor 12), never stored or logged in plaintext.
- **Access tokens** are short-lived JWTs (15m default) carrying `{ sub, email, role, permissions[] }` - permissions are embedded so most requests need zero extra DB round-trip for authorization.
- **Refresh tokens** are opaque random strings (never JWTs), stored **hashed** (SHA-256) in `refresh_tokens`, so a leaked database dump can't be replayed as a live session. Refresh **rotates** on every use; reusing an already-rotated (revoked) token revokes its *entire* rotation family - a signal of token theft, not a normal race.
- **Email verification codes** are 6 digits, expire in 15 minutes, are rate-limited to one resend per 60 seconds, and are capped at 5 wrong attempts before requiring a fresh code. The stored value is a SHA-256 hash, never the plaintext code.
- **Password reset** follows the same code-based pattern and always returns the same generic response regardless of whether the email exists, to avoid account enumeration.
- **Login lockout**: 5 wrong passwords locks the account for 15 minutes.
- `POST /auth/change-password` and `POST /auth/reset-password` both revoke every existing refresh token for that user, forcing re-login everywhere.

## Authorization

RBAC, built to be **data-driven, not hardcoded**:

```
roles ──┬── role_permissions ──┬── permissions
        │ (join table)         │
     users.roleId          Permission.<CODE> constants (src/common/constants)
```

- Two seeded roles: `WORKER` (own documents/expense requests/reports) and `ADMIN` (every permission). Adding a third role (e.g. `ACCOUNTANT`) is a migration that seeds a new row and assigns permissions - `PermissionsGuard` and every `@RequirePermissions()` decorator need no changes.
- `PermissionsGuard` (registered globally in `AppModule`) reads the caller's `permissions[]` from their JWT and checks it against `@RequirePermissions(...)` metadata on the route. No `@RequirePermissions()` means "any authenticated user."
- `@Public()` marks the handful of routes that don't require a token at all (register, login, health, etc.) - everything else defaults to **requiring authentication**, so a new route can never accidentally ship unauthenticated.
- **The backend is the only enforcement point.** No endpoint trusts a client-supplied role/permission; every check reads from the verified JWT or the database.
- Ownership checks (e.g. "you can only edit a document you created") are separate from permission checks and live in the service layer, since RBAC alone can't express "your own resource."

## Financial Domain

Bounded contexts, and why each is its own module:

| Context | Owns | Key invariant |
|---|---|---|
| **Accounting** | Chart of accounts, financial periods, journal entries/lines | `SUM(debit) = SUM(credit)`, enforced at both the service and database level |
| **Documents** | Financial document lifecycle (invoice, act, waybill, receipt, write-off, correction) | A `POSTED` document is immutable; correcting it creates a reversal + a new `CORRECTION` document, never an `UPDATE` |
| **Expense Requests** | Create → Submit → Approve/Reject → Pay → Account | Only the creator can submit/cancel; only a holder of `expense_requests.approve` can approve/reject |
| **Payments** | Idempotent execution, linking to expense requests or documents | The same `idempotencyKey` can never execute twice, under any concurrency |
| **Budgets** | Plan vs. actual by account × department/cost-center/project | Actuals are computed from the ledger, never duplicated into the budget row |
| **Counterparties / Contracts** | Contragents, requisites, contracts | Independent of the ledger - referenced by `uuid`, not owned by it |

## Accounting

Full **double-entry** bookkeeping:

- `accounts` - the chart of accounts (`ASSET`/`LIABILITY`/`EQUITY`/`INCOME`/`EXPENSE`), optionally hierarchical via `parentId`, optionally flagged `isCash` for cash-flow reporting.
- `financial_periods` - `OPEN → CLOSING → CLOSED`. Reopening a `CLOSED` period is **not** part of the normal transition table - it's a separate, explicitly audited operation (`PeriodsService.reopenClosedPeriod`), because it's meant to be rare and deliberate, not one call away.
- `journal_entries` / `journal_lines` - every posting is at least two lines, each strictly a debit *or* a credit (never both, never negative - `CHECK` constraint), and the total debit must equal the total credit (service-level check *and* database trigger).
- **`PostingService` is the only code path allowed to write to `journal_entries`/`journal_lines`.** Every other module (Documents, Payments) calls `PostingService.post()` - this is what makes "every posting is balanced" a property of the whole system instead of something every caller has to remember.
- **Correction, never `UPDATE`.** `PostingService.reverse()` creates a new entry with every debit/credit swapped from the original, marks the original `REVERSED`, and never touches the original row's values. `DocumentsService.reverse()` does the equivalent at the document level, also creating a `CORRECTION` document rather than editing history.
- **Multi-currency**: every `journal_line` carries its original `currency`/`exchangeRate` plus the converted `baseCurrencyDebit`/`baseCurrencyCredit`, so historical postings never need to be re-converted with today's rate. Rates are looked up as of the posting date (`ExchangeRatesService.getRate`), with exact BigInt-based conversion (see [Transactions](#transactions)).

## Transactions

Every operation that touches more than one row across an invariant boundary runs inside a single `DataSource.transaction(...)`:

- Registration: `User` + `PersonProfile` + `PassportDocument` + 3 `File` rows + the verification code, all-or-nothing.
- Document posting: the document's status flip and its journal entry/lines commit together, or neither does.
- Payment execution: the payment row, the journal entry, and (if linked) the expense request's `PAID`/`ACCOUNTED` transitions are one transaction.

**A hard rule enforced throughout the codebase:** once a transaction has taken a pessimistic lock on a row, every subsequent write to that *same row* inside that transaction must go through the same `manager`, never the module's default injected repository. Mixing them causes a second connection to wait on a lock held by the first connection's own still-open transaction - a deadlock, not a race, because Postgres has no way to see that the two connections are logically the same operation. (This is a real bug this project shipped with and fixed during development - see `DocumentsService.transition()`'s comment for the specifics; `posting.service.ts`'s comment explains the same rule from the writer's side.)

## Concurrency

The specific races this system defends against, and how:

| Race | Defense |
|---|---|
| Two admins approve the same user at once | `SELECT ... FOR UPDATE` inside a transaction; the second transaction blocks, re-reads a status that's no longer `PENDING_ADMIN_APPROVAL`, and fails with 409 |
| Two approvals of the same expense request / document / budget | Same pattern - pessimistic lock + a status-transition table (`ALLOWED_*_TRANSITIONS`) checked *after* acquiring the lock |
| Two people close the same financial period | Pessimistic lock on the period row before checking/changing its status |
| Two identical payment requests (double-click, client retry) | See [Idempotency](#idempotency) |
| A bug tries to write an unbalanced journal entry | Database `CHECK` constraint + trigger, independent of any application code path |

Postgres connection settings add a second layer: `statement_timeout` (30s) and `lock_timeout` (5s) mean a coding mistake that causes indefinite lock waiting fails fast with a clear error instead of quietly exhausting the connection pool (see `src/database/typeorm.config.ts`).

## Idempotency

`POST /payments` requires a client-generated `idempotencyKey`. The contract: calling it twice with the same key executes the underlying payment **at most once**, no matter how the two calls race:

1. A quick pre-check: if a payment with that key already exists, return it immediately - no new work.
2. Otherwise, open a transaction and **insert the payment row with that key first**, before doing any ledger posting. The `payments.idempotencyKey` column has a `UNIQUE` index - this insert is the statement that actually prevents duplicates, not application logic.
3. If two requests race past step 1 simultaneously, only one insert in step 2 can win; the loser's transaction raises a Postgres unique-violation, which is caught, and the loser simply re-fetches and returns the winner's row.
4. Only after the insert succeeds does the transaction post the journal entry and (if applicable) update the linked expense request - so a failure anywhere in that sequence rolls back the payment row too, and the same key can be legitimately retried later.

This is verified under real concurrency in `test/app.e2e-spec.ts` (two simultaneous HTTP requests with the same key) and `src/modules/payments/payments.service.spec.ts` (the unique-violation-recovery path, unit-tested with a mocked race).

## Audit

`audit_logs` is **append-only** - nothing in the codebase updates or deletes a row there. Every sensitive action writes one row: registration, email verification, admin approval/rejection/block, login (success and failure), password changes, role changes, document create/submit/approve/reject/post/cancel/correct, expense request transitions, payment execution, budget approval, period transitions, and report generation.

- **Never logged**: passwords (hashed or not), JWTs, refresh tokens, or any secret. `AuditLog.metadata` is a small, explicit object per call site - never "log the whole request body."
- Audit writes participate in the **same transaction** as the action they describe wherever that action is transactional (`AuditService.record(input, manager)`), so an audit entry can never exist for an action that itself rolled back.
- `GET /audit-logs` (permission `audit.read`) supports filtering by actor, entity, action, and date range, paginated.

## Reports

Pipeline (`ReportsController` → `ReportsService`):

```
HTTP request (reportType, format, date range)
   │
Validation (DTO) + Authorization (permission + ownership on read)
   │
ReportHistory row created, status = PENDING   ← returned to the client immediately
   │
ReportJobQueue runs the rest off the request thread (max 2 concurrent jobs)
   │
AnalyticsService builds the data (SQL aggregation, never "load everything into Node")
   │
The matching generator (Xlsx/Pdf/Docx)ReportGenerator turns it into a Buffer
   │
Stored via FilesService, ReportHistory → COMPLETED, fileId set
   │
GET /reports/:id/download streams it back
```

Because generation happens off the request thread, a large report never holds an HTTP connection open - the client polls `GET /reports/:id` (or just calls download, which 409s until it's ready).

**Report types implemented**: trial balance (оборотно-сальдовая ведомость), profit & loss, cash flow, counterparty balances (receivables/payables). The architecture is built to add more without touching the pipeline: implement `ReportGenerator` is already done for all three formats - a new report type is a new `case` in `ReportsService.buildPayload()` that produces a `ReportPayload` (title, tables, totals), nothing else changes.

**Format support**:
- **XLSX** (ExcelJS): one worksheet per table, frozen header row, bold totals row, numeric column formatting, title/period/filters/generation-date/author rows above the table.
- **PDF** (PDFKit): title/period/date/filters header, manual table layout with page-break-aware header repetition and page numbers.
- **DOCX** (`docx`): heading + paragraphs for metadata, a real Word table with a bold header row and bold totals row, signature-line placeholders at the end.

Report files are stored through the same `FilesService` as KYC uploads (category `REPORT_EXPORT`), so download authorization reuses the same private-file pattern (see [File Storage](#file-storage)). `GET /reports` defaults to showing only the caller's own report history; `reports.read_all` is required to see everyone's.

## File Storage

- Files (passport photos, face photo, report exports) are stored on disk under `FILE_STORAGE_PATH`/`REPORT_STORAGE_PATH`, named by a random UUID, **never** the original filename or a public URL.
- Metadata (owner, category, mime type, size, SHA-256 checksum) lives in the `files` table; the `FilesModule` has **no HTTP routes of its own** - each domain module (`people`, `reports`) exposes its own download endpoint and applies its own authorization rule before asking `FilesService` for the bytes.
- Allowed MIME types are checked **per category** (`FilesService`'s `ALLOWED_MIME_TYPES` map): passport/face photos accept images (+ PDF for scans), report exports accept PDF/XLSX/DOCX - a user-facing KYC upload and a server-generated report file have different, appropriately scoped allow-lists.
- Upload size is capped at 10MB (both at the Multer interceptor and inside `FilesService`).
- Downloads always check **authorization before reading bytes**: for KYC documents, the file owner or a holder of `users.manage`; for reports, the report's requester or a holder of `reports.read_all`. There is no publicly reachable `/uploads/...` path anywhere in this system.

## Development

```bash
git clone <repo-url>
cd pro-auth
cp .env.example .env      # defaults are fine for local dev except secrets - see below
docker compose -f docker-compose.dev.yml up --build
```

This starts Postgres, [Maildev](https://github.com/maildev/maildev) (a local SMTP catcher - open **http://localhost:1080** to read verification codes and password reset codes instead of configuring a real mailbox), and the app in watch mode at **http://localhost:3000**. Migrations run automatically before the app starts (see the `app` service's `command` in `docker-compose.dev.yml`).

`docker-compose.dev.yml` does **not** read `.env` for its own values - it's fully self-contained with fixed development credentials, so it works immediately after a fresh clone and is never accidentally affected by a production `.env` sitting in the same directory. `.env` is only consumed by `docker-compose.prod.yml` and by running the app directly with `npm run start:dev` (see below).

**Running without Docker** (only Postgres needs to be reachable):

```bash
npm install
npm run migration:run     # requires DATABASE_* in .env to point at a real Postgres
npm run start:dev
```

**Create the first admin account** (there's no admin to approve the first admin, so this bypasses the normal flow):

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='SomeStrongPass123!' npm run seed:admin
```

**Open Swagger**: http://localhost:3000/docs

**Stop the environment**: `docker compose -f docker-compose.dev.yml down` (keeps the `postgres_dev_data` volume - your data survives).

**Delete the development database** (destructive - only do this if you mean it):

```bash
docker compose -f docker-compose.dev.yml down -v   # -v also removes named volumes
```

## Production

Compiled application, minimal image, no dev dependencies, Nginx terminating TLS, healthchecks, automatic migrations, persistent Postgres, restart policies. See [Deployment](#deployment) for the full runbook.

## Docker

Two **separate, non-interchangeable** Compose files, matching [Development](#development) and [Production](#production):

| | `docker-compose.dev.yml` | `docker-compose.prod.yml` |
|---|---|---|
| App build target | `development` (source bind-mounted, `nest start --watch`) | `production` (multi-stage build, compiled `dist/`, no dev deps) |
| Config source | fixed values in the file itself | `.env` |
| Postgres port | published (`5432:5432`, for a local DB client) | **not published** - reachable only from `app` on the internal network |
| App port | published (`3000:3000`) | **not published** - reachable only from `nginx` |
| TLS | none (plain HTTP on localhost) | Nginx + Let's Encrypt |
| Extra services | Maildev (SMTP catcher) | Certbot (renewal loop) |

**`Dockerfile`** has three stages:
- `development` - `npm ci` including dev deps; source is bind-mounted over it at runtime.
- `builder` - `npm ci` + `npm run build`; discarded after `production` copies its `dist/` output.
- `production` - `npm ci --omit=dev`, copies only `dist/` from `builder`, runs as a non-root user, has a `HEALTHCHECK` hitting `/health`, and uses `dumb-init` as PID 1 for correct signal handling on shutdown.

Alpine's musl libc has no prebuilt `bcrypt` binary, so both the `builder` and `production` stages temporarily install `python3 make g++` to compile it from source, then remove that toolchain in the same layer so it never ships in the final image.

## Environment Variables

All of these are validated at startup (`src/config/env.validation.ts`) - the application **refuses to start** with a clear error if a required one is missing or malformed, rather than running in a half-configured state. Copy `.env.example` to `.env` and fill in real values.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | ✓ | `development` \| `production` \| `test` |
| `PORT` | ✓ | App listen port (internal only in production) |
| `DOMAIN` | ✓ | Used by the deploy scripts to render Nginx config and request the TLS cert |
| `CORS_ORIGIN` | | Restrict browser origins in production |
| `DATABASE_HOST` / `_PORT` / `_NAME` / `_USER` / `_PASSWORD` | ✓ | |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✓ | Each must be ≥32 characters; use `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | | Defaults: `15m` / `30d` |
| `BASE_CURRENCY` | ✓ | e.g. `USD` - the currency all ledger balances are reported in |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_FROM` | ✓ | |
| `FILE_STORAGE_PATH` / `REPORT_STORAGE_PATH` | ✓ | Paths inside the container |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | only for `seed:admin` | Not read by the app itself |

## Nginx

Production only (`docker-compose.prod.yml`). Two templates, one active at a time, selected by the deploy scripts:

- **`docker/nginx/templates/http-only.conf.template`** - bootstrap: serves the ACME HTTP-01 challenge and proxies everything else to the app over plain HTTP. Used before a certificate exists.
- **`docker/nginx/templates/ssl.conf.template`** - full production config once a certificate exists: HTTP → HTTPS redirect (keeping the ACME challenge path working for renewal), TLS 1.2/1.3, HSTS and other security headers, a `keepalive` upstream pool to the app, request size limit (15MB), sane proxy timeouts and buffering, and stricter rate limiting (`limit_req`) on the auth endpoints (`login`, `register`, `forgot-password`, etc.) than on the rest of the API.

The selected template is copied to `docker/nginx/active/default.conf.template`, which is bind-mounted read-only into the Nginx container at `/etc/nginx/templates/` - the official Nginx image's own entrypoint renders `${DOMAIN}` into it via `envsubst` **on container start**, substituting only variables that are actually set in the container's environment. Nginx's own runtime variables (`$host`, `$remote_addr`, etc.) are never touched, because they aren't container environment variables - this is exactly the `envsubst`-vs-nginx-syntax collision the spec warns about, and it's why switching templates requires a container **restart** (`scripts/setup-ssl.sh` does this), not just `nginx -s reload` (which only re-reads already-rendered files, not the template source).

The app's port is **never** exposed to the host or published publicly - `nginx` is the only container with published ports (80/443); it reaches `app` by Docker service name on the internal Compose network.

## SSL

Let's Encrypt via Certbot, in **webroot mode** (no port-80-hijacking standalone server, so Nginx can keep serving normal bootstrap traffic during issuance).

**Bootstrap problem and how it's solved**: Nginx can't start with a config that references a certificate that doesn't exist yet. `scripts/setup-ssl.sh` handles this in order:

1. Copy `http-only.conf.template` into place, start (or restart) Nginx - it now serves the ACME challenge path and proxies everything else over plain HTTP.
2. Run `certbot certonly --webroot` against the running Nginx to obtain the certificate for `DOMAIN`.
3. Copy `ssl.conf.template` into place and restart Nginx - it now serves HTTPS with the newly-issued certificate, and redirects HTTP → HTTPS.

**Prerequisites the script checks/warns about** before attempting issuance: a DNS A/AAAA record for `DOMAIN` must already point at the server's public IP, and ports 80/443 must be reachable from the Internet (check your cloud provider's firewall/security group). Let's Encrypt's HTTP-01 challenge will fail otherwise, and the script does not try to work around that check.

**Renewal** is automatic: the `certbot` service in `docker-compose.prod.yml` runs `certbot renew` every 12 hours in a loop (Certbot itself no-ops unless the certificate is within its renewal window, ~30 days before expiry). Because Nginx caches the loaded certificate in worker memory, it needs its own periodic reload to ever pick up a renewed file - the `nginx` service's command backgrounds a loop that runs `nginx -s reload` every 12 hours. This reload only signals *that same container's own* master process, so no `docker.sock` mount or cross-container access is needed.

**Verifying renewal works**: `docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --dry-run` simulates a renewal without hitting Let's Encrypt's real (rate-limited) servers or replacing your live certificate.

Self-signed certificates are never used in production - if `setup-ssl.sh` can't obtain a real certificate, it fails loudly rather than falling back to one.

## Deployment

On a clean VPS with Docker and Docker Compose v2 installed:

```bash
git clone <repo-url>
cd pro-auth
cp .env.example .env
nano .env                 # set DOMAIN, DATABASE_*, JWT_*, SMTP_* to real values
./scripts/deploy.sh
```

Before touching Docker, `scripts/deploy.sh`:
1. Confirms Docker and Docker Compose are installed.
2. Confirms `.env` exists and every required variable is set to a non-placeholder value (fails with a specific message otherwise - see [Environment Variables](#environment-variables)).

Then it:
3. Ensures Nginx has *some* config to start with (the HTTP-only bootstrap one, if none is active yet).
4. `docker compose up -d --build` - this builds the production image, starts Postgres, waits for it to be healthy, starts the app (whose entrypoint waits for Postgres, runs migrations, then starts the server), and starts Nginx.
5. Polls the app's Docker healthcheck until it reports `healthy`.
6. If no certificate exists yet for `DOMAIN`, runs `scripts/setup-ssl.sh` (see [SSL](#ssl)).
7. Prints the resulting URLs and a couple of useful follow-up commands.

**Re-running `deploy.sh` is safe** - it never runs `docker compose down -v`, never drops the database, and skips SSL issuance if a valid certificate already exists.

**Manual equivalent**, if you'd rather not use the script:

```bash
docker compose -f docker-compose.prod.yml up -d --build
./scripts/setup-ssl.sh
```

## Migrations

TypeORM migrations, applied in order, `synchronize` permanently off.

```bash
npm run migration:generate -- src/database/migrations/DescriptiveName   # after changing entities
npm run migration:run                                                   # apply pending migrations
npm run migration:revert                                                # undo the last one
```

In Docker, migrations run **automatically** on every app container start (`docker/entrypoint.sh`), after confirming Postgres is reachable and before the server starts accepting traffic - never before the database is ready, never after the app has already started serving requests.

The migration history in this repo, in order, and why each exists:
1. `InitialSchema` - every table, generated from the entities.
2. `AddIntegrityConstraints` - sequences for human-readable numbers (`JE-00000001`, `DOC-00000001`, ...), the `journal_lines` `CHECK` constraint, the balance-enforcing trigger, and every cross-module foreign key that entity relations deliberately don't express (see [Modules](#modules)).
3. `SeedRolesAndPermissions` - the `WORKER`/`ADMIN` roles and their permission codes, as data, not code.

## Backup

```bash
./scripts/backup.sh
```

Writes a compressed, timestamped `pg_dump` to `./backups/<database>-<UTC timestamp>.sql.gz`. **Old backups are never deleted automatically** - retention is a decision for a human, made explicitly (e.g. a host-level cron job with your own retention policy), not something this script guesses at.

**Risk note**: a backup captures data as of the moment it runs; anything written after that moment and before a subsequent restore is lost. For a system tracking financial postings, take a backup before any risky operation (a migration, a bulk data fix, an upgrade) and verify it (see below) before proceeding.

## Restore

```bash
./scripts/restore.sh ./backups/pro_auth-20240115T120000Z.sql.gz --yes
```

**This is destructive**: it drops and recreates the `public` schema in the target database before loading the dump, replacing every table's current contents. The script refuses to run without the explicit `--yes` flag, and prints a warning naming exactly what it's about to overwrite before doing it.

**Verify a backup/restore** without touching production: point `DATABASE_NAME` in `.env` at a throwaway database (`createdb pro_auth_verify`), restore into that, spot-check row counts / a few key tables, then drop it.

## Swagger

Full interactive API documentation at **`/docs`** (e.g. `http://localhost:3000/docs` in development, `https://<DOMAIN>/docs` in production) - every endpoint, DTO, required permission (visible via the endpoint description), pagination query params, and response/error shape. Authenticate in the UI with the "Authorize" button using a Bearer access token obtained from `POST /auth/login`.

The raw OpenAPI JSON is served at `/docs-json` if you want to import it into another tool (Postman, an SDK generator, etc.).

## Testing

```bash
npm run test          # unit tests (mocked dependencies, no database)
npm run test:e2e       # full-flow + integration tests against a real Postgres
npm run test:cov       # unit tests with coverage
```

`npm run test:e2e` needs a reachable Postgres with migrations applied - see `.env.test` (already checked in with dev-only dummy credentials) and run:

```bash
createdb pro_auth_test   # once
DATABASE_NAME=pro_auth_test npm run migration:run   # or: set -a; source .env.test; set +a; npm run migration:run
npm run test:e2e
```

**What's covered, and where:**
- **Unit** (`src/**/*.spec.ts`, mocked dependencies): exact-decimal money arithmetic (`decimal.util.spec.ts`), double-entry balance validation and period/account enforcement (`posting.service.spec.ts`), RBAC permission checks (`permissions.guard.spec.ts`), payment idempotency including the unique-violation race path (`payments.service.spec.ts`).
- **Integration** (`test/accounting-integrity.e2e-spec.ts`, real Postgres, no HTTP layer): the database trigger rejects an unbalanced entry and rolls back the *entire* transaction (proven with an unrelated marker row that also disappears), and the `CHECK` constraint rejects a debit-and-credit-at-once line - both bypassing `PostingService` entirely, to prove the database-level defense is real.
- **End-to-end** (`test/app.e2e-spec.ts`, full HTTP stack + real Postgres): the complete business flow - register (with file uploads) → cannot log in unverified → verify email → cannot log in unapproved → admin approves → login → RBAC denial on an admin-only route → chart of accounts + period setup → draft document → cannot post before approval (409) → cannot self-approve (403) → approve → post → balanced journal entry → **duplicate payment request** (two concurrent HTTP calls, same idempotency key, exactly one payment row) → report generation and download; plus a dedicated concurrency test firing **two simultaneous** expense-request approvals and asserting exactly one succeeds (201) and the other sees the already-changed state (409).

## Security

- Passwords: bcrypt, cost 12, never logged.
- JWT access tokens are short-lived; refresh tokens are opaque, hashed at rest, and rotate with theft detection (see [Authentication](#authentication)).
- RBAC enforced server-side only (see [Authorization](#authorization)); the frontend (if any) is never trusted as a security boundary.
- All input validated with `class-validator` DTOs (`whitelist: true, forbidNonWhitelisted: true` globally - unknown fields are rejected, not silently dropped or accepted).
- SQL injection: TypeORM's query builder / repository API parameterizes everything; the few raw `manager.query()` calls in this codebase (aggregation queries, migrations) use parameter placeholders, never string interpolation of user input.
- Rate limiting: a global `ThrottlerModule` guard (120 req/min per IP) plus stricter Nginx-level `limit_req` on the auth endpoints in production (see [Nginx](#nginx)).
- File uploads: per-category MIME allow-lists, size caps, private storage, authorization-checked downloads (see [File Storage](#file-storage)).
- Errors: `AllExceptionsFilter` normalizes every error to `{ statusCode, message, error, timestamp, path }`; stack traces, raw SQL, and driver internals never reach the client - unexpected errors log full detail server-side and return a generic 500.
- Secrets live only in `.env` (gitignored) / the deployment environment, never in code, Dockerfiles, or Nginx config (see [Environment Variables](#environment-variables)).
- Postgres and the app itself have no published ports in production - only Nginx is Internet-facing (see [Docker](#docker)).

## Performance

- Every analytics/report query aggregates in SQL (`SUM`, `GROUP BY`) and returns pre-summed rows - never "load every journal line into Node and reduce" (see `AnalyticsService`). At real transaction volume this is the difference between a report that stays fast at 10 rows and one that stays fast at 10 million.
- Pagination (`PaginationQueryDto`, capped at 100/page) on every list endpoint that could otherwise return an unbounded result set.
- Indexes on every foreign-key column and on the columns real queries filter/sort by (see entity `@Index()` declarations).
- A bounded, explicit connection pool (`max: 20`) rather than an unbounded one that could starve Postgres under load.
- N+1 avoidance: list endpoints that need related data use a single query-builder join or a second bulk query, not a query-per-row loop.
- Report generation runs off the request thread with a small concurrency cap (`ReportJobQueue`, max 2 concurrent jobs), so a burst of report requests can't monopolize the connection pool or block ordinary API traffic.
- Nothing here was optimized preemptively beyond these - if a specific query becomes a real bottleneck at real data volume, the tool for that is `EXPLAIN ANALYZE` against production-shaped data, not a rewrite in advance of evidence.

## Troubleshooting

**PostgreSQL won't start** - `docker compose -f docker-compose.dev.yml logs postgres`. Usually a stale, incompatible data volume from a different Postgres major version; if you're certain it's disposable dev data: `docker compose -f docker-compose.dev.yml down -v`.

**Migration failed** - the error names the failing statement. Common cause: running `migration:run` against a database that already has conflicting objects from a partial previous run - check `SELECT * FROM migrations;` in that database to see what's actually been recorded as applied.

**Nginx won't start** - almost always a config error introduced by editing a template incorrectly, or the referenced certificate not existing yet (see [SSL](#ssl) - it must start with `http-only.conf.template` before a cert exists). Check: `docker compose -f docker-compose.prod.yml logs nginx`.

**Port 80 or 443 already in use** - another process (a system Nginx/Apache, a different container) is bound to it. Find it with `sudo lsof -i :80` (or `:443`) and stop it, or don't run this stack on a host that already serves something else on those ports.

**DNS doesn't point at the server** - `dig +short $DOMAIN` (or `nslookup $DOMAIN`) from *outside* the server and compare to the server's public IP (`curl -4 ifconfig.me`). Let's Encrypt validates from the public Internet, so a record that only resolves internally, or hasn't propagated yet, will fail issuance.

**Let's Encrypt won't issue a certificate** - re-run `./scripts/setup-ssl.sh --staging` first (uses Let's Encrypt's staging environment, which has much higher rate limits and doesn't count against the production quota) to iterate on DNS/firewall issues without risking a production rate-limit lockout.

**Application healthcheck failing** - `docker compose -f docker-compose.prod.yml exec app curl -sf http://localhost:3000/health`. If that itself fails, check `docker compose -f docker-compose.prod.yml logs app` for a startup error (commonly: a missing/invalid required environment variable - see [Environment Variables](#environment-variables), which the app validates and refuses to start without).

**Container stuck in a restart loop** - `docker compose -f docker-compose.prod.yml logs --tail=100 <service>`. For `app`, this is almost always a failed migration or a database connection refusal (Postgres not actually healthy yet, or wrong `DATABASE_*` credentials).

**"database connection refused"** - confirm Postgres is actually healthy (`docker compose -f docker-compose.prod.yml ps`), and that `DATABASE_HOST` is the Compose service name (`postgres`), not `localhost` (there is no "localhost" shared between containers).

## Limitations

Being direct about what this system does not do, so nobody is surprised in production:

- **Single-instance deployment.** `docker-compose.prod.yml` runs one app container and one Postgres instance. Horizontal scaling (multiple app replicas behind Nginx, Postgres replication/HA) is architecturally possible - nothing here holds in-process state that would break under multiple replicas (JWTs are stateless, refresh tokens and sessions live in Postgres) - but it isn't wired up, because nothing about this system's target scale needs it yet.
- **Report generation concurrency is capped at 2 in-process jobs.** Fine for a single instance at this scale; a genuinely high report volume would need a real queue (Bull/Redis) - deliberately not built here without evidence it's needed (see [Architecture](#architecture)).
- **No built-in frontend.** This is a backend/API system; Swagger (`/docs`) is the UI it ships with.
- **Exchange rates are entered manually** (`POST /accounting/exchange-rates`), not pulled from an external rate provider.
- **A single base currency** per deployment (`BASE_CURRENCY`); multi-base-currency consolidation isn't supported.
- **RBAC is single-role-per-user.** The schema (`role_permissions` many-to-many) would support multiple roles per user with a small `UsersService`/JWT-payload change, but that's not implemented.
- **Backup/restore are manual, script-driven**, not a managed continuous-backup/point-in-time-recovery setup - appropriate for this scale, not for a system that can't tolerate losing the last few minutes of data on disaster.

## How to Create a New Module

Worked example: adding a **"Fixed Assets"** module (a plausible next feature - tracking company equipment, its depreciation, and linking depreciation postings into the ledger).

**1. Business requirement.** Track fixed assets (id, name, acquisition date, acquisition cost, useful life in months) and let an accountant run monthly depreciation, posting it to the ledger.

**2. Module boundary.** This is its own bounded context (`modules/fixed-assets/`) - it depends on `accounting` (to post depreciation entries) the same way `documents` and `payments` do, but nothing should depend on it yet.

**3. Database model.** Decide the entity before writing code:
```
fixed_assets
  id, name, acquisitionDate, acquisitionCost (numeric(18,2)),
  usefulLifeMonths (int), accumulatedDepreciation (numeric(18,2)),
  assetAccountId (uuid, plain column - references accounting.accounts),
  depreciationExpenseAccountId (uuid, plain column),
  status (enum: ACTIVE, FULLY_DEPRECIATED, DISPOSED)
```
Cross-module references to `accounts` are plain `uuid` columns, matching every other module (see [Modules](#modules)) - `fixed-assets` must not import `Account` the entity, only its `id`.

**4. Migration.** Write the entity class first (`entities/fixed-asset.entity.ts`, extending `common/entities/base.entity.ts`), then:
```bash
npm run migration:generate -- src/database/migrations/AddFixedAssets
```
Add the cross-module foreign keys (`assetAccountId → accounts.id`, etc.) by hand in a follow-up migration, the same way `AddIntegrityConstraints` does for every other module - `migration:generate` only sees TypeORM relations, not plain uuid columns.

**5. Service.** `fixed-assets.service.ts`: `create()`, `findAll()`/`findById()`, and `runMonthlyDepreciation(assetId, actorId)` - the interesting part. It computes the month's depreciation amount, then calls `PostingService.post(...)` (never writes to `journal_lines` directly - see [Accounting](#accounting)) with a balanced Dr `depreciationExpenseAccountId` / Cr `assetAccountId` entry, inside a transaction, following the same pessimistic-lock pattern as `DocumentsService.post()` if the operation needs to prevent double-running depreciation for the same month.

**6. DTO.** `dto/create-fixed-asset.dto.ts` with `class-validator` decorators - copy the shape of `dto/create-contract.dto.ts` as a template (money field validated with `@IsMoneyAmount()` from `common/validators`, dates with `@IsDateString()`).

**7. Controller.** `fixed-assets.controller.ts` - one route per service method, `@RequirePermissions(Permission.FIXED_ASSETS_MANAGE)` on every mutation (add the new permission code to `common/constants/permissions.constant.ts` and seed it for `ADMIN` in a new migration, the same way `SeedRolesAndPermissions` does - never hardcode a role check in the controller).

**8. Authorization.** Decide who can create assets vs. run depreciation - if they need different permissions, add both codes; if not, one is enough. Reread [Authorization](#authorization) before inventing a new pattern - there should be exactly one way permissions are checked in this codebase.

**9. Tests.** A unit test for the depreciation calculation (pure math, mocked `PostingService` - see `posting.service.spec.ts` for the mocking pattern), and an e2e test extending `test/app.e2e-spec.ts`'s style: create an asset, run depreciation, assert the resulting journal entry balances.

**10. Swagger.** `@ApiTags('fixed-assets')`, `@ApiProperty()` on every DTO field - copy any existing controller for the exact decorator shape; there is nothing module-specific to configure.

**11. Audit.** Add `AuditAction.FIXED_ASSET_DEPRECIATION_POSTED` (and any other action worth a permanent record) to `modules/audit/audit-action.constant.ts`, and call `auditService.record(..., manager)` inside the same transaction as the posting.

**12. Wire it up.** `fixed-assets.module.ts` imports `AccountingModule`, exports `FixedAssetsService`; add `FixedAssetsModule` to `app.module.ts`'s imports.

That's the whole loop every module in this codebase follows - once you've built one, the rest is repetition, not new architecture.

## Learning Roadmap

A path through real, general-purpose skills using **this repository** as the practice ground. Each stage names files to open and a concrete task to attempt - don't move on until you can explain *why* the code in this repo does what it does at that stage, not just that it does.

### 1. JavaScript → TypeScript
**Why**: everything here is TypeScript; you need to read it comfortably before anything else makes sense.
**Open**: `src/common/utils/decimal.util.ts` - small, self-contained, uses `bigint`, union types, and generics lightly.
**Task**: without looking at the test file, predict what `toMinorUnits('12.5')` returns, then check `decimal.util.spec.ts`.
**Check**: `npm run test -- decimal.util` passes and you can explain in one sentence why this file avoids `parseFloat` for money.

### 2. Node.js & HTTP fundamentals
**Why**: NestJS is built on Node's HTTP model; you should know what's underneath the decorators.
**Open**: `src/main.ts`.
**Task**: list, in order, everything that happens to a request before it reaches a controller (Helmet → compression → CORS → versioning → ValidationPipe → your route).
**Check**: you can explain what would break if `app.useGlobalPipes(...)` were removed.

### 3. REST API design
**Open**: `src/modules/contracts/contracts.controller.ts` (small, complete CRUD + a status transition).
**Task**: using Swagger (`/docs`), call `POST /contracts`, then `GET /contracts`, then `PATCH /contracts/:id/status` with an invalid transition and read the 409 response.
**Check**: you can explain why status changes are a separate endpoint (`PATCH .../status`) rather than allowed via the general update endpoint.

### 4. PostgreSQL & SQL
**Open**: `src/modules/analytics/analytics.service.ts`.
**Task**: run the `trialBalance` query's SQL by hand in `psql` against your dev database (copy it out of the `createQueryBuilder` chain) and understand what each `JOIN` contributes.
**Check**: you can explain why this aggregates in SQL instead of loading rows into Node and summing them in JavaScript.

### 5. Docker
**Open**: `Dockerfile`, `docker-compose.dev.yml`.
**Task**: run `docker compose -f docker-compose.dev.yml up --build`, then `docker compose -f docker-compose.dev.yml exec app sh` and poke around the running container's filesystem.
**Check**: you can explain why `docker-compose.dev.yml` bind-mounts the source code but `docker-compose.prod.yml` doesn't.

### 6. NestJS & Dependency Injection
**Open**: `src/modules/org/org.module.ts` (the simplest complete module) then `org.service.ts`/`org.controller.ts`.
**Task**: add a `deactivate` endpoint for `Project` (there's already one for `Department` and `CostCenter` to copy the shape of).
**Check**: your new endpoint shows up in `/docs` without any manual registration beyond adding the `@Post()` route.

### 7. DTOs & Validation
**Open**: `src/modules/counterparties/dto/create-counterparty.dto.ts` (nested arrays, optional fields, custom validators).
**Task**: send a request missing a required field via Swagger and read the 400 response shape; then send one with an extra, unexpected field and see it rejected (`forbidNonWhitelisted`).
**Check**: you can explain what `whitelist: true` does differently from `forbidNonWhitelisted: true`.

### 8. TypeORM & migrations
**Open**: `src/modules/org/entities/department.entity.ts`, then the corresponding lines in `migrations/*-InitialSchema.ts`.
**Task**: add a nullable `description: string` column to `Department`, run `npm run migration:generate -- src/database/migrations/AddDepartmentDescription`, and read the generated SQL before running it.
**Check**: `npm run migration:run` then `npm run migration:revert` both succeed cleanly.

### 9. JWT & Authentication
**Open**: `src/modules/auth/token.service.ts`, `src/modules/auth/strategies/jwt.strategy.ts`.
**Task**: decode an access token from `POST /auth/login` at jwt.io (or `node -e "console.log(JSON.parse(Buffer.from('<payload-part>','base64url')))"`) and identify every claim.
**Check**: you can explain why refresh tokens are *not* JWTs in this system, when access tokens are.

### 10. Authorization & RBAC
**Open**: `src/common/guards/permissions.guard.ts`, `src/common/constants/permissions.constant.ts`.
**Task**: try calling an admin-only endpoint (e.g. `GET /users`) with a WORKER token and read the 403; then trace exactly how the guard reached that decision.
**Check**: you can explain, without re-reading the code, what would need to change to add a new role.

### 11. File uploads
**Open**: `src/modules/auth/auth.controller.ts`'s `register` handler, `src/modules/files/files.service.ts`.
**Task**: register a user via Swagger's "Try it out" with three small image files attached; then try uploading a `.txt` file for `facePhoto` and read the 415 response.
**Check**: you can explain why allowed MIME types differ by `FileCategory`.

### 12. Email
**Open**: `src/modules/mail/mail.service.ts`, `src/modules/auth/auth.service.ts`'s `issueVerificationCode`.
**Task**: register a user against the dev stack and read the verification code from Maildev's UI (http://localhost:1080) instead of a real inbox.
**Check**: you can explain why the code is stored as a SHA-256 hash rather than in plaintext.

### 13. Database transactions
**Open**: `src/modules/auth/auth.service.ts`'s `register()` method.
**Task**: temporarily throw an error partway through (e.g. after creating the `PersonProfile` but before the passport document) and confirm via `psql` that *nothing* from that request persisted - not even the user row.
**Check**: you can explain what `DataSource.transaction()` actually guarantees, in your own words. (Undo your temporary change afterward!)

### 14. PostgreSQL locks & concurrency
**Open**: `src/modules/users/users.service.ts`'s `approve()` method and its comment.
**Task**: reproduce the double-approval race from `test/app.e2e-spec.ts`'s concurrency test manually with two `curl` calls fired via `&` in the same shell line.
**Check**: you can explain, using the term "row lock," why exactly one of the two calls succeeds.

### 15. Accounting fundamentals & double-entry
**Open**: [Accounting](#accounting) above, then `src/modules/accounting/posting.service.ts`.
**Task**: create two accounts and post a manual, deliberately unbalanced entry directly via `PostingService` in a small script (or by temporarily calling it from a test) and confirm it's rejected before anything touches the database.
**Check**: you can explain, for one real transaction (e.g. "customer pays an invoice"), which account is debited and which is credited, and why.

### 16. Financial workflows
**Open**: `src/modules/expense-requests/enums/expense-request-status.enum.ts`, then `expense-requests.service.ts`.
**Task**: draw the full state diagram from `ALLOWED_EXPENSE_REQUEST_TRANSITIONS` on paper before looking at the code that enforces it.
**Check**: you can explain why `REJECTED → DRAFT` exists (resubmission) but `CANCELLED` has no outgoing transitions.

### 17. Audit logging
**Open**: `src/modules/audit/audit.service.ts`, `audit-action.constant.ts`.
**Task**: perform five different actions through the API (register, login, approve a user, post a document, execute a payment) and find all five in `GET /audit-logs`.
**Check**: you can explain why audit writes take an optional `manager` parameter.

### 18. Reports
**Open**: `src/modules/reports/reports.service.ts`, one generator (`generators/xlsx.generator.ts`).
**Task**: request a trial balance report in all three formats and open each one.
**Check**: you can explain the full pipeline from `POST /reports` to a downloadable file, including why it doesn't block the HTTP request.

### 19. Testing
**Open**: `src/modules/payments/payments.service.spec.ts` (unit), `test/app.e2e-spec.ts` (e2e).
**Task**: write a new unit test for a service method you haven't touched yet (pick something in `contracts.service.ts`), following the mocking style already used.
**Check**: `npm run test` shows your new test passing, and you can explain why the unit test mocks `DataSource` instead of using a real database.

### 20. Security
**Open**: [Security](#security) above, `src/common/filters/all-exceptions.filter.ts`.
**Task**: trigger a genuine 500 (e.g. temporarily misconfigure `DATABASE_HOST`) and confirm the client response contains no stack trace or internal detail, while the server log does.
**Check**: you can list, from memory, three specific defenses this system has against account enumeration.

### 21. Performance
**Open**: [Performance](#performance) above, `AnalyticsService.trialBalance`.
**Task**: run `EXPLAIN ANALYZE` on that query against your dev database and identify which index (if any) is used.
**Check**: you can explain what would happen to this query's cost if `journal_lines."accountId"` had no index.

### 22. Nginx
**Open**: `docker/nginx/templates/ssl.conf.template`.
**Task**: identify every `proxy_set_header` line and explain what each one is for.
**Check**: you can explain why the auth endpoints have a stricter `limit_req` zone than the rest of the API.

### 23. SSL / TLS
**Open**: [SSL](#ssl) above, `scripts/setup-ssl.sh`.
**Task**: run `./scripts/setup-ssl.sh --staging` against a domain you control and inspect the resulting (untrusted, staging) certificate with `openssl s_client -connect $DOMAIN:443`.
**Check**: you can explain, in order, the three steps that solve the "Nginx needs a cert that doesn't exist yet" bootstrap problem.

### 24. Production deployment
**Open**: `scripts/deploy.sh` top to bottom.
**Task**: deploy this system to a real (even a cheap, temporary) VPS, start to finish, using only this README.
**Check**: `https://<your-domain>/health` returns `{"status":"ok",...}` over a trusted HTTPS connection.

By the end of this roadmap you've touched every layer this system is built from - and you're ready to apply [How to Create a New Module](#how-to-create-a-new-module) for real.
