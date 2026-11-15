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
| **1** | **Singireddy Hrushikesh Reddy** | `2024AAPS0239H` | **Database & Backend (Core Schema & Setup APIs)** — Designed the core 3NF database schema and performance indexes for students, outlets, and admins, configured the SQLite database connection, and built the backend APIs for registering outlets/students, adding menu items, and loading student dashboards. |
| **2** | **Kartikey Gaur** | `2024AAPS0225H` | **Database & Backend (Orders, Triggers & Views)** — Designed the menu and order tables, set up database triggers for balance deduction, order status checks, and duplicate-order prevention, built helper SQL views, and implemented the backend APIs for placing orders, updating order statuses, and toggling item availability. |
| **3** | **Deeptimahanti Aashrith** | `2024AAPS0189H` | **Frontend UI & Portals** — Built the login page and the three role-locked user interfaces: the Student Portal (menu browsing, cart, token tracking, and nutrition charts), the Outlet Portal (live order queue and item availability toggles), and the Union Admin Portal (setup forms, reports, and CSV downloads). |
| **4** | **Aryaman Ray** | `2024AAPS0227H` | **Backend Authentication, App Rules & Testing** — Implemented login, logout, password hashing, session tokens, and password-change backend endpoints, wrote the shared business logic for cart totals and the 6 AM–4 AM business day, and created the automated unit and integration tests. |
| **5** | **Kothapalli Manobhiram Reddy** | `2024AAPS0240H` | **Backend Analytics, Sample Data & Project Integration** — Built the backend dashboard and audit reporting APIs, wrote the analytical SQL queries and CSV report generators, created the multi-table sample dataset seeder, and handled build configuration and project documentation. |

---

## Technology Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons
- **Backend:** Node.js (v22.5+) + Express.js REST API with Strict Role-Based Access Control (RBAC)
- **Database:** Embedded Relational SQLite3 (`node:sqlite` with `PRAGMA foreign_keys = ON` and `WAL` mode) + PostgreSQL Reference DDL (`database/postgresql_reference.sql`)

---

## 3 End-to-End Workflows

1. **Workflow 1: Union Setup and Auditing**
   - The Union creates new food outlets in the system and standardizes their specific menus.
   - They define every item's attribute, including base price, category (e.g., rice, tiffin, juice), dietary type (veg/non-veg), parcel surcharges, and exact nutritional values (calories, protein).
   - The Union can run administrative queries to generate Excel-style breakdowns of any student's total semester expenditure or any outlet's total revenue.

2. **Workflow 2: Student Ordering and Tracking**
   - Students log in to view their current semester ledger balance alongside their cumulative spending and nutritional intake, which can be filtered by day, week, or month.
   - They browse an outlet's menu, viewing only items currently marked "available." They can filter items by category or dietary preference (with neutral add-ons like extra cheese appearing in both veg and non-veg filters).
   - The cart dynamically calculates total cost (including parcel fees) and total nutrition.
   - **Order Logic & Constraints:** A student can place simultaneous orders at different outlets, but the database restricts them from placing a new order at the same outlet until their previous order is marked "Ready." Students can cancel an order as long as it is in the "Pending" state.
   - Upon ordering, the student receives a unique Daily Token Number (e.g., `#101`). This sequence is unique per outlet and resets daily based on the logical business day (6 AM to 4 AM).

3. **Workflow 3: Outlet Fulfilment and Analytics**
   - Vendors can instantly toggle the live availability of their menu items.
   - Outlets receive incoming "Pending" orders and choose to Accept or Reject them.
   - **Delayed Financial Transaction:** The database executes an ACID transaction to deduct the funds from the student's central balance only at the exact moment the outlet clicks "Accept."
   - Once prepared, the outlet updates the order status to "Ready."
   - Outlets access advanced reporting dashboards powered by grouping and aggregation queries, allowing them to view daily, weekly, and monthly income, complete with category-wise and item-wise revenue breakdowns.

---

## 21-File Project Architecture

| # | File Path | Purpose |
| :- | :--- | :--- |
| 1 | `database/schema.sql` | 3NF DDL for all 9 relational tables (`STUDENT`, `OUTLET`, `OUTLET_PHONE`, `MENU_ITEM`, `ITEM_EXTRA`, `UNION_ADMIN`, `"ORDER"`, `ORDER_ITEM`, `ORDER_ITEM_EXTRA`) and 4 performance indexes. |
| 2 | `database/triggers_and_views.sql` | 3 SQLite triggers (concurrency guard, FSM validation, delayed deduction) and 3 analytical/security SQL views. |
| 3 | `database/queries.sql` | Standalone SQL script containing all 6 analytical queries with DBMS concept annotations. |
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

---

## Role-Based Login Credentials (Lab Demo)

Each logged-in role is strictly locked to its own portal UI and backend API routes:

- **Student** (`2024AAPS0225H` / `student123`, or debt test case `2024A7PS0101H` / `student123`): Strictly accesses the **Student Portal** for their own account to browse available menus, select parcel/dietary-neutral extras, place orders, cancel `Pending` orders, and track daily/weekly/monthly nutrition and semester ledger balance.
- **Food Outlet** (`Hotspot` / `outlet123`, `Yumppies` / `outlet123`, etc.): Strictly accesses the **Outlet Portal** for their own outlet to accept/reject/mark orders ready, toggle live menu item availability (`is_available`), and inspect category/item revenue analytics.
- **Union Admin** (`ADM001` / `admin123`): Strictly accesses the **Union Admin Portal** to register new outlets, standardize menu items, add dietary-neutral extras, run live DBMS analytical queries, and export audit CSVs.

