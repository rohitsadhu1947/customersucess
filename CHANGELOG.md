# Changelog

All notable changes to the Ensuredit Customer Success Platform will be documented in this file.

---

## Phase 4: Feature Enhancements — 2026-03-04

### Issue Detail Page with Comments & History (4.1)

- **Issue detail page (`/issues/[id]`)**: Full issue view with description, follow-up notes, sidebar with details (company, insurer, category, people, dates), status/priority badges.
- **Comments system**: Users can add comments to issues. Ensuredit team can mark comments as "Internal" (hidden from customers). Customers cannot see internal notes. Customer View Only users cannot post comments.
- **Activity history**: Tracks field changes on issues — shows who changed what, from/to values, with timestamps. Displayed in a timeline format.
- **Issue detail API (`/api/issues/[id]`)**: Fetches single issue with all joins (company, insurer, users). Role-based access — customers only see their company's issues.
- **Comments API (`/api/issues/[id]/comments`)**: GET (with internal filtering for customers) and POST (with audit logging). Validates comment content.
- **History API (`/api/issues/[id]/history`)**: GET endpoint returning field-change history for an issue.
- **Issues list updated**: "View" button now navigates to the issue detail page instead of opening a modal, in both table and card views.

### Company Detail Page with Health Score (4.2)

- **Company detail page (`/companies/[id]`)**: Full company view with header (name, status, customer since), health score indicator, stats cards (integrations, issues, users), tabbed content (integrations list, issues list).
- **Health score (0-100)**: Computed from escalation rate, resolution rate, and live integration rate. Color-coded: green (80+), yellow (60-79), red (<60).
- **Company detail API (`/api/companies/[id]`)**: Returns company info, integration projects, recent issues, issue stats, integration stats, and computed health score.
- **Companies list updated**: Cards are now clickable — clicking a company card navigates to its detail page. Edit button uses `stopPropagation` to avoid navigation.

### Notifications Framework (4.3)

- **Notifications API (`/api/notifications`)**: GET returns user's notifications (with `?unread=true` filter and `?limit=N` support) plus unread count. PUT marks individual or all notifications as read.
- **Notifications table**: Stores per-user notifications with type, title, message, entity reference, read status.
- **Bell icon integration**: Dashboard layout now polls `/api/notifications` every 60 seconds. Unread badge shows count (red dot with number). Dropdown shows recent notifications with timestamps. "Mark all read" button. Clicking a notification navigates to the relevant entity (issue or company).

### Reports Page (4.4)

- **Reports page (`/reports`)**: Four report types with sidebar selector, date range filters, data table, and CSV export.
  - **Issues Summary**: Breakdown by category, status, and priority with resolution counts and avg resolution days.
  - **Issues by Company**: Issue distribution across companies with open/escalated/resolved counts and resolution rate (Ensuredit-only).
  - **Integration Status**: Current status of all integration projects grouped by insurer.
  - **Resolution Time**: Min/avg/max resolution time by category.
- **Reports API (`/api/reports`)**: Supports `?type=`, `?from=`, `?to=`, `?company_id=` query params. Role-based filtering — customers automatically scoped to their company.
- **CSV export**: Uses existing `generateCSV`/`downloadCSV` helpers. Dynamic column headers from report data.

### Dashboard Enhancements (4.5)

- **Clickable KPI cards**: All four metric cards (Total Integrations, Total Issues, Escalated Issues, Overdue Items) are now clickable, navigating to relevant pages (integrations, issues, reports).
- **Auto-refresh**: Dashboard data refreshes every 5 minutes automatically. Manual refresh button (spinning icon) in the header.
- **Last updated indicator**: Shows timestamp of last data refresh next to the refresh button.

### Migration File

- `migrations/004_phase4_comments_notifications.sql` — Creates `issue_comments`, `issue_history`, and `notifications` tables with appropriate indexes.

### Files Created

| File | Description |
|------|-------------|
| `migrations/004_phase4_comments_notifications.sql` | Phase 4 database migration |
| `app/api/issues/[id]/route.ts` | Single issue detail API |
| `app/api/issues/[id]/comments/route.ts` | Issue comments API |
| `app/api/issues/[id]/history/route.ts` | Issue history API |
| `app/api/companies/[id]/route.ts` | Company detail API with health score |
| `app/api/notifications/route.ts` | Notifications API |
| `app/api/reports/route.ts` | Reports API (4 report types) |
| `app/issues/[id]/page.tsx` | Issue detail page with comments & history |
| `app/companies/[id]/page.tsx` | Company detail page with tabs |
| `app/reports/page.tsx` | Reports page with filters & CSV export |

### Files Modified

| File | Change |
|------|--------|
| `components/dashboard-layout.tsx` | Live notifications polling, unread badge, notification dropdown with navigation |
| `app/page.tsx` | Clickable KPIs, auto-refresh (5min), manual refresh button, last-updated timestamp |
| `app/issues/page.tsx` | View button navigates to detail page instead of modal |
| `app/companies/page.tsx` | Company cards clickable, navigate to detail page |

### Database Migrations Required

```sql
-- Run migrations/004_phase4_comments_notifications.sql
```

---

## Phase 3: Data Integrity & API Quality — 2026-03-04

### Zod Validation

- **Validation schemas (`lib/validations.ts`)**: Added Zod schemas for all entity types — issues, companies, users, and integration projects. Each has `create` and `update` variants with proper type coercion, defaults, and enum validation.
- **`validateBody()` helper**: Generic function that runs Zod validation and returns either parsed data or a structured error message.
- **All POST/PUT handlers** now use Zod validation instead of manual `if (!field)` checks. This provides consistent error messages, type-safe defaults, and email/enum validation out of the box.

### Pagination

- **Pagination helper (`lib/pagination.ts`)**: Reusable `getPaginationParams()` and `paginatedResponse()` utilities. Supports `?page=1&limit=50` query params with sensible defaults (page 1, limit 50, max 100).
- **Backwards compatible**: All GET list endpoints (issues, companies, users, integration-projects) support pagination when `?page=` is present. Without the param, they return the full array as before — no client changes required.
- **Response format**: Paginated responses use `{ data: [...], pagination: { page, limit, total, totalPages } }`.

### Soft Deletes

- **Converted hard deletes to soft deletes**: Issues, companies, and integration projects now set `is_deleted = true` instead of `DELETE FROM`. No data is ever permanently removed.
- **GET queries updated**: All list queries filter with `AND (is_deleted = false OR is_deleted IS NULL)` to handle both new and existing rows gracefully.
- **Users unchanged**: User deletion continues to use the existing `is_active = false` pattern.

### Audit Logging

- **Audit helper (`lib/audit.ts`)**: `logAudit()` function that records user actions to the `audit_logs` table. Silently fails if the table doesn't exist, so it never breaks main operations.
- **Tracked operations**: Create, update, and delete operations on issues, companies, integration projects, and users now generate audit records with `userId`, `action`, `entityType`, `entityId`, and optional `details`.

### Migration Files

- `migrations/002_phase2_password_reset.sql` — Adds `password_reset_token` and `password_reset_expires` to users table
- `migrations/003_phase3_soft_deletes_audit.sql` — Adds `is_deleted` columns, creates `audit_logs` table with indexes

### Files Modified

| File | Change |
|------|--------|
| `lib/validations.ts` | New — Zod schemas for all entities |
| `lib/pagination.ts` | New — pagination helper |
| `lib/audit.ts` | New — audit logging helper |
| `app/api/issues/route.ts` | Zod validation, pagination, soft delete, audit logging |
| `app/api/companies/route.ts` | Zod validation, pagination, soft delete, audit logging |
| `app/api/users/route.ts` | Zod validation, pagination, audit logging |
| `app/api/integration-projects/route.ts` | Zod validation, pagination, soft delete, audit logging |
| `migrations/002_phase2_password_reset.sql` | New — password reset migration |
| `migrations/003_phase3_soft_deletes_audit.sql` | New — soft deletes + audit table migration |

### Database Migrations Required

```sql
-- Run migrations/002_phase2_password_reset.sql (if not already run)
-- Run migrations/003_phase3_soft_deletes_audit.sql
```

---

## Phase 2: Core UX Fixes — 2026-03-04

### Sidebar & Navigation

- **Fixed sidebar active state**: Sidebar now highlights the current page based on the URL path instead of a hardcoded `current: true` on Dashboard. Uses `usePathname()` with prefix matching.
- **Fixed breadcrumb**: Breadcrumb now shows the current page name derived from the active navigation item. Dashboard shows only the home icon; other pages show `Home / Page Name`. Home icon links back to dashboard.
- **Renamed "Project Status" to "Issues"**: Sidebar label now matches the actual page content.

### Authentication UX

- **Remember Me**: Login form now sends `rememberMe` to the API. When checked, JWT token and cookie expire in 30 days instead of 24 hours.
- **Forgot Password flow**: New `/forgot-password` page with email form, and `/reset-password` page with token-based password reset. API endpoints generate a hashed reset token (SHA-256) with 1-hour expiry. Reset link logged to console (no email service yet). DB migration required: `password_reset_token` and `password_reset_expires` columns on `users` table.
- **Demo credentials hidden in production**: The demo credentials section on the login page is now only visible when `NODE_ENV === "development"`.

### Search & Notifications

- **Global search**: Header search input is now functional with debounced (300ms) queries to `/api/search`. Results dropdown shows matches grouped by Companies, Issues, and Integrations. Clicking a result navigates to the relevant page. Click-outside closes the dropdown.
- **Search API** (`/api/search`): New endpoint that searches across `companies`, `project_issues`, and `integration_projects` with role-based filtering. Customers only see their own company's data.
- **Notifications placeholder**: Bell button now opens a "No notifications" dropdown instead of showing a fake red badge. Ready for Phase 4 notifications framework.

### Cleanup

- **Project Status redirect**: `/project-status` now redirects to `/issues` instead of being a 1100-line duplicate page.

### Files Modified

| File | Change |
|------|--------|
| `components/dashboard-layout.tsx` | Active sidebar, breadcrumb, search, notifications |
| `app/login/page.tsx` | Forgot password link, remember me passthrough, dev-only demo creds |
| `lib/auth-context.tsx` | Login accepts `rememberMe` param |
| `app/api/auth/login/route.ts` | Remember me: 30d vs 24h token/cookie expiry |
| `app/forgot-password/page.tsx` | New — forgot password form |
| `app/reset-password/page.tsx` | New — password reset form |
| `app/api/auth/forgot-password/route.ts` | New — generates reset token |
| `app/api/auth/reset-password/route.ts` | New — validates token, resets password |
| `app/api/search/route.ts` | New — global search across entities |
| `app/project-status/page.tsx` | Replaced with redirect to `/issues` |

### Database Migrations Required

```sql
ALTER TABLE users ADD COLUMN password_reset_token TEXT;
ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMPTZ;
```

---

## Phase 1: Foundation & Security — 2026-03-04

### Security Fixes

- **Centralized auth module (`lib/auth.ts`)**: Extracted JWT verification and token creation into a single shared module, replacing 9 duplicated implementations across API routes. Eliminated hardcoded fallback JWT secret (`"fallback-secret-key-for-development"`).
- **Server-side session verification (`/api/auth/me`)**: New endpoint that verifies the JWT cookie and returns user info. Replaced all `localStorage` usage in `lib/auth-context.tsx` with this server-side check, eliminating XSS exposure of user data.
- **Gated seed endpoints**: `api/seed-users` and `api/update-passwords` now return 404 in production (`NODE_ENV !== "development"`). Previously, anyone could reset all user passwords to `admin123` in production.
- **Removed error message leaks**: Removed `details: error.message` from all API error responses (issues, users). Internal error details are no longer exposed to clients.
- **Removed debug data from dashboard API**: Removed `tablesExist` and `projectIssuesColumns` from the dashboard response payload.

### Code Quality

- **Eliminated duplicated auth code**: All 9 API route files (`issues`, `integration-projects`, `companies`, `users`, `dashboard-data`, `master-data/insurers`, `master-data/products`, `master-data/sub-products`, `auth/login`) now import from `@/lib/auth` and `@/lib/db` instead of creating their own JWT secrets and database connections.
- **Removed debug `console.log` statements**: Removed all `console.log` calls from API routes and `lib/db.ts` (~10 instances). Kept `console.error` in catch blocks for error monitoring.
- **Removed debug test query**: Removed `SELECT COUNT(*) FROM project_issues` test query that ran on every GET request to the issues API.
- **Enabled TypeScript strict checking**: Set `ignoreBuildErrors: false` in `next.config.mjs`. Fixed all type errors (~90 lines of errors across 8 files).
- **Enabled ESLint during builds**: Set `ignoreDuringBuilds: false` in `next.config.mjs`.
- **Lazy initialization for `lib/db.ts` and `lib/auth.ts`**: Database connection and JWT secret are now initialized on first use rather than at module load, allowing successful builds without env vars present.

### Bug Fixes

- **Fixed view mode toggle**: Changed `"cards"` to `"card"` in issues and project-status pages to match the `useState<"table" | "card">` type, fixing the Cards view toggle button.
- **Fixed user delete button comparison**: Changed `user?.userId` to `user?.id` in users page to match the `User` interface, fixing the condition that prevents admins from deleting themselves.

### Files Modified

| File | Change |
|------|--------|
| `lib/auth.ts` | New — shared JWT auth module |
| `lib/auth-context.tsx` | Removed localStorage, uses `/api/auth/me` |
| `lib/db.ts` | Lazy initialization, removed console.log |
| `app/api/auth/me/route.ts` | New — session verification endpoint |
| `app/api/auth/login/route.ts` | Uses shared auth module |
| `app/api/issues/route.ts` | Uses shared auth, removed debug logs/leaks |
| `app/api/integration-projects/route.ts` | Uses shared auth |
| `app/api/companies/route.ts` | Uses shared auth |
| `app/api/users/route.ts` | Uses shared auth, removed error leak |
| `app/api/dashboard-data/route.ts` | Uses shared auth, removed debug data, fixed types |
| `app/api/master-data/insurers/route.ts` | Uses shared auth |
| `app/api/master-data/products/route.ts` | Uses shared auth |
| `app/api/master-data/sub-products/route.ts` | Uses shared auth |
| `app/api/seed-users/route.ts` | Gated behind dev mode |
| `app/api/update-passwords/route.ts` | Gated behind dev mode |
| `app/page.tsx` | Fixed types, removed console.log |
| `app/issues/page.tsx` | Fixed viewMode bug, error type |
| `app/project-status/page.tsx` | Fixed viewMode bug |
| `app/users/page.tsx` | Fixed userId comparison |
| `components/ui/chart.tsx` | Fixed recharts type compatibility |
| `actions/database-actions.ts` | Fixed SQL template type |
| `next.config.mjs` | Enabled TS + ESLint strict mode |
