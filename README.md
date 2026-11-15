# Centralized Campus Food Ordering System

- **Project Title:** Centralized Campus Food Ordering System
- **Course:** CS F212 Database Systems — Final Project
- **Lab & Team ID:** P2 Group-18
- **Repository:** https://github.com/daemon1769/campus-food-ordering-system/
- **Final Tag (`final`) & Submitted Commit Hash:** 

---

## Team Members & Individual Contributions (5-Part Division)

| # | Name | BITS ID | Assigned Module & Individual Contributions |
| :- | :--- | :--- | :--- |
| **1** | **Singireddy Hrushikesh Reddy** | `2024AAPS0239H` | **Database & Backend (Transactions, Triggers & Views)** — Weak-entity & menu modeling (`MENU_ITEM`, `ITEM_EXTRA`, `"ORDER"`, `ORDER_ITEM`, `ORDER_ITEM_EXTRA`), database triggers (`trg_prevent_concurrent_outlet_order`, `trg_validate_order_status_transition`, `trg_deduct_balance_on_accept`), SQL views (`v_available_menu`, `v_order_details`, `v_outlet_revenue_summary` in `database/triggers_and_views.sql`), ACID order/status transactions (`placeOrderTransaction`, `updateOrderStatusTransaction` in `src/db/queries.ts`), and Student/Outlet order & availability API routes (`/api/outlets/:outletId/menu`, `/api/orders`, `/api/orders/.../status`, `/api/outlet/items/:itemId/availability` in `server.ts`). |
| **2** | **Kartikey Gaur** | `2024AAPS0225H` | **Database & Backend (Core Schema, Connection Layer & Provisioning API)** — Core 3NF DDL (`database/schema.sql`) and PostgreSQL reference schema (`database/postgresql_reference.sql`) for `STUDENT`, `OUTLET`, `OUTLET_PHONE`, `UNION_ADMIN`, and 4 performance indexes; SQLite connection & initialization (`src/db/database.ts`), outlet/student/menu management transactions (`createOutletWithPhonesTransaction`, `createStudent`, `addMenuItem`, `addItemExtra` in `src/db/queries.ts`), and Union provisioning & Student dashboard backend routes (`/api/student/:studentId/dashboard`, `/api/union/outlets`, `/api/union/students`, `/api/union/menu-items`, `/api/union/extras` in `server.ts`). |
| **3** | **Deeptimahanti Aashrith** | `2024AAPS0189H` | **Frontend UI & Role-Locked Portals** — Root role-locked application shell & styling (`src/App.tsx`, `src/index.css`, `src/types.ts`), role-based login portal (`src/components/LoginPage.tsx`), Student ordering, token tracker & nutrition dashboard (`src/components/StudentPortal.tsx`), Outlet order queue & live menu availability toggle (`src/components/OutletPortal.tsx`), Union Admin setup, CSV export & live SQL inspector UI (`src/components/UnionPortal.tsx`), and authenticated `fetch` client (`src/utils/apiFetch.ts`). |
| **4** | **Aryaman Ray** | `2024AAPS0227H` | **Backend Auth Middleware, Security, Domain Rules & Automated Testing** — Express session & RBAC middleware (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password`, `extractSessionUser`, `requireAuth` in `server.ts`) and backend credential services (`authenticateUser`, `changeUserPassword` in `src/db/queries.ts`); PBKDF2 password hashing & HMAC-SHA256 stateless session token signing (`src/utils/authCrypto.ts`); `06:00 AM–03:59 AM` logical day boundary, cart pricing & finite state machine validation (`src/utils/campusRules.ts`); and automated unit & integration test suites (`src/db/database.test.ts`, `src/utils/authCrypto.test.ts`, `src/utils/campusRules.test.ts`). |
| **5** | **Kothapalli Manobhiram Reddy** | `2024AAPS0240H` | **Backend Analytics API, Database Seeding, SQL Queries & Integration** — Backend analytics & audit REST endpoints (`/api/bootstrap`, `/api/outlet/:outletId/dashboard`, `/api/union/dashboard`, `/api/union/dbms-overview`, `/api/union/run-query/:queryKey` in `server.ts`) and backend query/aggregation services (`getBootstrapData`, `getOutletAnalytics`, `getUnionAuditData`, `getDbmsOverview`, `runNamedDemoQuery` in `src/db/queries.ts`); deterministic 9-table dataset seeding (`database/seed_sample.sql` and seeding pipeline in `src/db/database.ts`); 6 non-trivial analytical SQL queries (`database/queries.sql` — `q1_outlet_revenue` through `q6_union_student_debt_audit`); build/deployment configuration (`package.json`, `vite.config.ts`, `tsconfig.json`); and project documentation (`README.md`). |

---

## Technology Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **Backend:** Node.js (v22.5+) + Express.js REST API with Strict Role-Based Access Control (RBAC)
- **Database:** Embedded Relational SQLite3 (`node:sqlite` with `PRAGMA foreign_keys = ON` and `WAL` mode) + PostgreSQL Reference DDL (`database/postgresql_reference.sql`)

---

## Role-Based Login Credentials (Lab Demo)

Each logged-in role is strictly locked to its own portal UI and backend API routes:

- **Student** (`2024AAPS0225H` / `student123`, or debt test case `2024A7PS0101H` / `student123`): Strictly accesses the **Student Portal** for their own account to browse available menus, select parcel/dietary-neutral extras, place orders, cancel `Pending` orders, and track daily/weekly/monthly nutrition and semester ledger balance.
- **Food Outlet** (`Hotspot` / `outlet123`, `Yumppies` / `outlet123`, etc.): Strictly accesses the **Outlet Portal** for their own outlet to accept/reject/mark orders ready, toggle live menu item availability (`is_available`), and inspect category/item revenue analytics.
- **Union Admin** (`ADM001` / `admin123`): Strictly accesses the **Union Admin Portal** to register new outlets, standardize menu items, add dietary-neutral extras, run live DBMS analytical queries, and export audit CSVs.

---

## 3 End-to-End Workflows

1. **Workflow 1 — Union Governance, Standardization & Live SQL Auditing (`Union Admin Portal`):**
   - Register new campus food outlets atomically across `OUTLET` and `OUTLET_PHONE` (resolving multi-valued phone attributes in 1NF).
   - Standardize master menu items (`MENU_ITEM`) with calories, protein, fat, parcel rules, and dietary-neutral add-ons (`ITEM_EXTRA`).
   - Audit campus-wide outlet revenues and student semester debt accounts, export CSV reports, and execute the 5 Non-Trivial SQL Queries live in the **DBMS Evaluation Inspector**.
2. **Workflow 2 — Student Cashless Ordering, Token Generation & Nutrition Tracking (`Student Portal`):**
   - Browse live available items (`v_available_menu`) filtered by category and diet (`Veg` / `Non-Veg`), while dietary-neutral extras remain accessible across all filters.
   - Place orders with sequential daily token numbers (`#101+`) scoped to `(outlet_id, logical_date)`. `trg_prevent_concurrent_outlet_order` prevents duplicate active (`Pending`/`Accepted`) orders at the same outlet.
   - Cancel orders only while `Pending`; track real-time semester ledger balance (supporting negative semester debt) and daily/weekly/monthly calorie, protein, and fat intake.
3. **Workflow 3 — Outlet Queue Fulfilment, Delayed Ledger Deduction & Revenue Analytics (`Outlet Portal`):**
   - Manage incoming orders through the strict state machine (`Pending -> Accepted -> Ready` or `Pending -> Rejected`).
   - Clicking **Accept** fires `trg_deduct_balance_on_accept` inside an ACID transaction, deducting `total_amount` from `STUDENT.current_balance` only upon vendor acceptance.
   - Toggle live item availability (`is_available`) and inspect daily/weekly/monthly revenue trends and category/item breakdowns.

---

## 6 Non-Trivial Analytical SQL Queries (`database/queries.sql` & `src/db/queries.ts`)

1. **`q1_outlet_revenue` — Q1. Outlet-Wise Total Revenue & Order Count (`LEFT JOIN + GROUP BY`):**
   Aggregates total orders, accepted/ready orders, total revenue, menu item count, and concatenated phone numbers (`GROUP_CONCAT` subquery on `OUTLET_PHONE`) across all outlets.
2. **`q2_category_diet_breakdown` — Q2. Sales by Food Category & Diet Type (`4-Table JOIN + Subquery`):**
   Joins `"ORDER"`, `ORDER_ITEM`, `MENU_ITEM`, and a derived subquery over `ORDER_ITEM_EXTRA` + `ITEM_EXTRA` to compute units sold and exact revenue (base + parcel + extras) grouped by category and diet type.
3. **`q3_above_avg_spenders` — Q3. Students Spending Above Campus Average (`Nested Subquery + HAVING`):**
   Identifies students whose completed semester expenditure exceeds the campus-wide average student expenditure using a nested aggregate subquery inside the `HAVING` clause.
4. **`q4_daily_nutrition_per_student` — Q4. Student Daily Calorie, Protein & Fat Intake (`4-Table JOIN + SUM`):**
   Computes per-student, per-logical-day expenditure and macronutrient intake (`calories`, `protein`, `fat`) across accepted/ready orders.
5. **`q5_top_items_per_outlet_window` — Q5. Top 3 Best-Selling Items per Outlet (`CTE + DENSE_RANK Window Function`):**
   Uses a Common Table Expression (`WITH item_sales_cte`) and `DENSE_RANK() OVER (PARTITION BY outl.outlet_id ORDER BY SUM(oi.quantity) DESC)` to rank the top 3 best-selling menu items at each outlet.
6. **`q6_union_student_debt_audit` — Q6. Union Audit: Student Semester Ledger & Debt Report (`LEFT JOIN + Conditional SUM`):**
   Preserves zero-order students via `LEFT JOIN`, reconciling initial semester deposit (`₹12,000`), completed expenditure, and negative semester debt balances.

---

## 4 Core DBMS Features Implemented

1. **Database Triggers (`database/triggers_and_views.sql`):**
   - `trg_prevent_concurrent_outlet_order` (`BEFORE INSERT ON "ORDER"`): Blocks a student from placing a second order at the same outlet while an existing order is `Pending` or `Accepted`.
   - `trg_validate_order_status_transition` (`BEFORE UPDATE OF status ON "ORDER"`): Enforces the finite state machine (`Pending -> Accepted | Rejected | Cancelled`, `Accepted -> Ready`).
   - `trg_deduct_balance_on_accept` (`AFTER UPDATE OF status ON "ORDER"`): Implements Delayed Financial Deduction when status transitions from `Pending` to `Accepted`.
2. **Database Views (`database/triggers_and_views.sql`):**
   - `v_available_menu`: Projects only available (`is_available = 1`) menu items joined with outlet names for student browsing.
   - `v_order_details`: Consolidates order headers, student details, outlet names, line items, and nutritional attributes.
   - `v_outlet_revenue_summary`: Pre-aggregates daily accepted/ready order counts and revenues per outlet.
3. **ACID Transactions (`src/db/queries.ts`):**
   - `placeOrderTransaction`: Atomically computes sequential daily tokens (`101+`), verifies item availability and pricing, and inserts into `"ORDER"`, `ORDER_ITEM`, and `ORDER_ITEM_EXTRA` (`BEGIN IMMEDIATE ... COMMIT / ROLLBACK`).
   - `updateOrderStatusTransaction`: Atomically transitions order status and verifies updated student ledger balance.
   - `createOutletWithPhonesTransaction`: Atomically inserts a new outlet into `OUTLET` and its multi-valued contact numbers into `OUTLET_PHONE`.
4. **Performance Indexes (`database/schema.sql`):**
   - `idx_order_student_logical_date` on `"ORDER"(student_id, logical_date, status)`
   - `idx_order_outlet_status_date` on `"ORDER"(outlet_id, status, logical_date)`
   - `idx_menu_item_outlet_available` on `MENU_ITEM(outlet_id, is_available, category, diet_type)`
   - `idx_order_item_item_id` on `ORDER_ITEM(item_id)`

---

## 21-File Project Architecture

| # | File Path | Purpose |
| :- | :--- | :--- |
| 1 | `database/schema.sql` | 3NF DDL for all 9 relational tables (`STUDENT`, `OUTLET`, `OUTLET_PHONE`, `MENU_ITEM`, `ITEM_EXTRA`, `UNION_ADMIN`, `"ORDER"`, `ORDER_ITEM`, `ORDER_ITEM_EXTRA`) and 4 performance indexes. |
| 2 | `database/triggers_and_views.sql` | 3 SQLite triggers (concurrency guard, FSM validation, delayed deduction) and 3 analytical/security SQL views. |
| 3 | `database/queries.sql` | Standalone SQL script containing all 6 non-trivial analytical queries with DBMS concept annotations. |
| 4 | `database/seed_sample.sql` | Standalone reproducible SQL seed script for manual CLI inspection across all 9 tables. |
| 5 | `database/postgresql_reference.sql` | Equivalent PostgreSQL 3NF DDL + PL/pgSQL trigger functions reference script. |
| 6 | `src/db/database.ts` | SQLite connection manager (`WAL` + `foreign_keys = ON`) and deterministic 630–927+ record automatic seeder. |
| 7 | `src/db/queries.ts` | Data access layer, ACID transactions, and analytical query runners (`getDbmsOverview`, `runNamedDemoQuery`). |
| 8 | `src/db/database.test.ts` | Automated integration test suite verifying 9-table record volume, triggers, ACID transactions, and authentication. |
| 9 | `server.ts` | Express.js REST API server with strict Role-Based Access Control (RBAC) and Vite middleware integration. |
| 10 | `src/App.tsx` | Root React shell enforcing strict role-locked portal rendering (`StudentPortal`, `OutletPortal`, `UnionPortal`). |
| 11 | `src/components/LoginPage.tsx` | Role-based authentication portal with quick-fill lab demo credentials. |
| 12 | `src/components/StudentPortal.tsx` | Student ordering interface, dietary-neutral extras selector, token tracker, and nutrition dashboard. |
| 13 | `src/components/OutletPortal.tsx` | Vendor order queue manager (`Accept` / `Reject` / `Mark Ready`), live menu availability toggle, and revenue charts. |
| 14 | `src/components/UnionPortal.tsx` | Union Admin setup forms, CSV audit exporters, and Live DBMS SQL & 9-Table Row Counts Inspector. |
| 15 | `src/utils/campusRules.ts` | Pure domain logic for `06:00 AM–03:59 AM` logical day calculation, cart pricing, and FSM validation. |
| 16 | `src/utils/campusRules.test.ts` | Unit tests for logical day boundary rollover, parcel/extra pricing, and currency formatting. |
| 17 | `src/utils/authCrypto.ts` | PBKDF2 password hashing and HMAC-SHA256 stateless session token signing/verification. |
| 18 | `src/utils/authCrypto.test.ts` | Unit tests for password hashing, session token verification, and cookie parsing. |
| 19 | `src/utils/apiFetch.ts` | Authenticated `fetch` wrapper attaching session Bearer tokens and credentials. |
| 20 | `src/types.ts` | Shared TypeScript interfaces for all 9 relations, API payloads, and analytics structures. |
| 21 | `package.json` | Project metadata, scripts (`dev`, `build`, `start`, `lint`, `test`), and dependencies. |

---

## Step-by-Step Reproducibility Instructions

### 1. Prerequisites
- **Node.js v22.5+** (includes built-in `node:sqlite`) and `npm`

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Full-Stack Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser. On startup, `src/db/database.ts` automatically initializes `campus_food.db`, executes `database/schema.sql` and `database/triggers_and_views.sql`, and populates all 9 3NF tables.

### 4. Run Automated Verification & Unit Tests
```bash
npm test
```

### 5. Build & Run for Production
```bash
npm run build
npm start
```
