import { getDb } from './database.ts';
import {
  computeLogicalDate,
  computeLineAmount,
  INITIAL_SEMESTER_DEPOSIT,
} from '../utils/campusRules.ts';
import { hashPassword, verifyPassword } from '../utils/authCrypto.ts';
import type {
  AuthUser,
  UserRole,
  Student,
  Outlet,
  MenuItem,
  ItemExtra,
  UnionAdmin,
  OrderRecord,
  OrderStatus,
  StudentNutritionSummary,
  OutletAnalytics,
  UnionAuditData,
  DbmsOverviewData,
} from '../types.ts';

function verifyOrUpgradePassword(
  rawPassword: string,
  storedHash: string,
  defaultFallbackPassword: string,
  onUpgrade: (newHash: string) => void
): boolean {
  if (storedHash && verifyPassword(rawPassword, storedHash)) {
    return true;
  }
  if (storedHash && storedHash === rawPassword) {
    onUpgrade(hashPassword(rawPassword));
    return true;
  }
  if (!storedHash && rawPassword === defaultFallbackPassword) {
    onUpgrade(hashPassword(rawPassword));
    return true;
  }
  return false;
}

function findMatchingRoleForIdentifier(cleanId: string): UserRole | null {
  const db = getDb();
  const stu = db
    .prepare(
      `SELECT 1 FROM STUDENT WHERE LOWER(student_id) = LOWER(?) OR LOWER(email) = LOWER(?)`
    )
    .get(cleanId, cleanId);
  if (stu) return 'student';

  const outl = db
    .prepare(
      `SELECT 1 FROM OUTLET WHERE LOWER(name) = LOWER(?) OR LOWER(COALESCE(email, '')) = LOWER(?) OR CAST(outlet_id AS TEXT) = ?`
    )
    .get(cleanId, cleanId, cleanId);
  if (outl) return 'outlet';

  const adm = db
    .prepare(
      `SELECT 1 FROM UNION_ADMIN WHERE LOWER(admin_id) = LOWER(?) OR LOWER(email) = LOWER(?)`
    )
    .get(cleanId, cleanId);
  if (adm) return 'admin';

  return null;
}

export function authenticateUser(role: UserRole, identifier: string, password: string): AuthUser {
  const db = getDb();
  const cleanId = identifier.trim();
  if (!cleanId || !password) {
    throw new Error('Please enter both ID/email and password.');
  }

  if (role === 'student') {
    const row = db
      .prepare(
        `SELECT student_id, name, email, password_hash
         FROM STUDENT
         WHERE LOWER(student_id) = LOWER(?) OR LOWER(email) = LOWER(?)`
      )
      .get(cleanId, cleanId) as
      | { student_id: string; name: string; email: string; password_hash: string }
      | undefined;

    if (!row) {
      const otherRole = findMatchingRoleForIdentifier(cleanId);
      if (otherRole === 'outlet') {
        throw new Error(
          `"${cleanId}" is a Food Outlet account. Please switch the role tab above to "Food Outlet" and sign in.`
        );
      }
      if (otherRole === 'admin') {
        throw new Error(
          `"${cleanId}" is a Union Admin account. Please switch the role tab above to "Union Admin" and sign in.`
        );
      }
      throw new Error('Invalid student credentials.');
    }

    const valid = verifyOrUpgradePassword(password, row.password_hash, 'student123', (newHash) => {
      db.prepare('UPDATE STUDENT SET password_hash = ? WHERE student_id = ?').run(
        newHash,
        row.student_id
      );
    });
    if (!valid) {
      throw new Error('Invalid student credentials.');
    }
    return {
      role: 'student',
      id: row.student_id,
      name: row.name,
      email: row.email,
      student_id: row.student_id,
    };
  }

  if (role === 'outlet') {
    const row = db
      .prepare(
        `SELECT outlet_id, name, email, password_hash
         FROM OUTLET
         WHERE LOWER(name) = LOWER(?) OR LOWER(COALESCE(email, '')) = LOWER(?) OR CAST(outlet_id AS TEXT) = ?`
      )
      .get(cleanId, cleanId, cleanId) as
      | { outlet_id: number; name: string; email: string | null; password_hash: string }
      | undefined;

    if (!row) {
      const otherRole = findMatchingRoleForIdentifier(cleanId);
      if (otherRole === 'student') {
        throw new Error(
          `"${cleanId}" is a Student account. Please switch the role tab above to "Student" and sign in.`
        );
      }
      if (otherRole === 'admin') {
        throw new Error(
          `"${cleanId}" is a Union Admin account. Please switch the role tab above to "Union Admin" and sign in.`
        );
      }
      throw new Error('Invalid outlet credentials.');
    }

    const valid = verifyOrUpgradePassword(password, row.password_hash, 'outlet123', (newHash) => {
      db.prepare('UPDATE OUTLET SET password_hash = ? WHERE outlet_id = ?').run(
        newHash,
        row.outlet_id
      );
    });
    if (!valid) {
      throw new Error('Invalid outlet credentials.');
    }
    return {
      role: 'outlet',
      id: String(row.outlet_id),
      name: row.name,
      email: row.email || `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}@campus.edu`,
      outlet_id: row.outlet_id,
    };
  }

  const row = db
    .prepare(
      `SELECT admin_id, name, email, password_hash
       FROM UNION_ADMIN
       WHERE LOWER(admin_id) = LOWER(?) OR LOWER(email) = LOWER(?)`
    )
    .get(cleanId, cleanId) as
    | { admin_id: string; name: string; email: string; password_hash: string }
    | undefined;

  if (!row) {
    const otherRole = findMatchingRoleForIdentifier(cleanId);
    if (otherRole === 'student') {
      throw new Error(
        `"${cleanId}" is a Student account. Please switch the role tab above to "Student" and sign in.`
      );
    }
    if (otherRole === 'outlet') {
      throw new Error(
        `"${cleanId}" is a Food Outlet account. Please switch the role tab above to "Food Outlet" and sign in.`
      );
    }
    throw new Error('Invalid admin credentials.');
  }

  const valid = verifyOrUpgradePassword(password, row.password_hash, 'admin123', (newHash) => {
    db.prepare('UPDATE UNION_ADMIN SET password_hash = ? WHERE admin_id = ?').run(
      newHash,
      row.admin_id
    );
  });
  if (!valid) {
    throw new Error('Invalid admin credentials.');
  }
  return {
    role: 'admin',
    id: row.admin_id,
    name: row.name,
    email: row.email,
    admin_id: row.admin_id,
  };
}

export function changeUserPassword(
  role: UserRole,
  userId: string | number,
  currentPassword: string,
  newPassword: string
): void {
  const db = getDb();
  const cleanCurrent = (currentPassword ?? '').trim();
  const cleanNew = (newPassword ?? '').trim();

  if (!cleanCurrent || !cleanNew) {
    throw new Error('Both current password and new password are required.');
  }
  if (cleanNew.length < 4) {
    throw new Error('New password must be at least 4 characters long.');
  }

  if (role === 'student') {
    const row = db
      .prepare('SELECT student_id, password_hash FROM STUDENT WHERE student_id = ?')
      .get(String(userId)) as { student_id: string; password_hash: string } | undefined;
    if (!row) throw new Error('Student account not found.');

    const valid = verifyOrUpgradePassword(cleanCurrent, row.password_hash, 'student123', () => {});
    if (!valid) {
      throw new Error('Current password is incorrect.');
    }
    db.prepare('UPDATE STUDENT SET password_hash = ? WHERE student_id = ?').run(
      hashPassword(cleanNew),
      row.student_id
    );
    return;
  }

  if (role === 'outlet') {
    const row = db
      .prepare('SELECT outlet_id, password_hash FROM OUTLET WHERE outlet_id = ?')
      .get(Number(userId)) as { outlet_id: number; password_hash: string } | undefined;
    if (!row) throw new Error('Outlet account not found.');

    const valid = verifyOrUpgradePassword(cleanCurrent, row.password_hash, 'outlet123', () => {});
    if (!valid) {
      throw new Error('Current password is incorrect.');
    }
    db.prepare('UPDATE OUTLET SET password_hash = ? WHERE outlet_id = ?').run(
      hashPassword(cleanNew),
      row.outlet_id
    );
    return;
  }

  const row = db
    .prepare('SELECT admin_id, password_hash FROM UNION_ADMIN WHERE admin_id = ?')
    .get(String(userId)) as { admin_id: string; password_hash: string } | undefined;
  if (!row) throw new Error('Admin account not found.');

  const valid = verifyOrUpgradePassword(cleanCurrent, row.password_hash, 'admin123', () => {});
  if (!valid) {
    throw new Error('Current password is incorrect.');
  }
  db.prepare('UPDATE UNION_ADMIN SET password_hash = ? WHERE admin_id = ?').run(
    hashPassword(cleanNew),
    row.admin_id
  );
}

export function getOrderStudentId(
  outletId: number,
  logicalDate: string,
  dailyTokenNumber: number
): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT student_id FROM "ORDER"
       WHERE outlet_id = ? AND logical_date = ? AND daily_token_number = ?`
    )
    .get(outletId, logicalDate, dailyTokenNumber) as { student_id: string } | undefined;
  return row?.student_id ?? null;
}

export function getMenuItemOutletId(itemId: number): number | null {
  const db = getDb();
  const row = db
    .prepare('SELECT outlet_id FROM MENU_ITEM WHERE item_id = ?')
    .get(itemId) as { outlet_id: number } | undefined;
  return row?.outlet_id ?? null;
}

function getWindowStartDate(logicalDate: string, period: 'day' | 'week' | 'month'): string {
  const [y, m, d] = logicalDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (period === 'week') dt.setDate(dt.getDate() - 6);
  if (period === 'month') dt.setDate(dt.getDate() - 29);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getBootstrapData() {
  const db = getDb();
  const students = db
    .prepare('SELECT student_id, name, email, current_balance FROM STUDENT ORDER BY student_id')
    .all() as unknown as Student[];

  const outletsRaw = db
    .prepare('SELECT outlet_id, name FROM OUTLET ORDER BY outlet_id')
    .all() as unknown as { outlet_id: number; name: string }[];

  const phonesRaw = db
    .prepare('SELECT outlet_id, contact_phone FROM OUTLET_PHONE ORDER BY outlet_id, contact_phone')
    .all() as unknown as { outlet_id: number; contact_phone: string }[];

  const phonesMap = new Map<number, string[]>();
  for (const p of phonesRaw) {
    const arr = phonesMap.get(p.outlet_id) ?? [];
    arr.push(p.contact_phone);
    phonesMap.set(p.outlet_id, arr);
  }

  const outlets: Outlet[] = outletsRaw.map((o) => ({
    outlet_id: o.outlet_id,
    name: o.name,
    phones: phonesMap.get(o.outlet_id) ?? [],
  }));

  const admins = db
    .prepare('SELECT admin_id, name, email FROM UNION_ADMIN ORDER BY admin_id')
    .all() as unknown as UnionAdmin[];

  return {
    logicalDate: computeLogicalDate(new Date()),
    students,
    outlets,
    admins,
  };
}

// ---------------------------------------------------------------------------
// NON-TRIVIAL SQL QUERY #1: Student Expenditure & Nutritional Intake Summary
// Concepts: Multi-table JOIN, GROUP BY / Aggregation, Date Range Filtering, COALESCE
// ---------------------------------------------------------------------------
export const SQL_QUERY_1_STUDENT_NUTRITION = `
SELECT
  COUNT(DISTINCT o.outlet_id || ':' || o.logical_date || ':' || o.daily_token_number) AS order_count,
  COALESCE(ROUND(SUM(
    (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
  ), 2), 0) AS total_spent,
  COALESCE(SUM(mi.calories * oi.quantity), 0) AS total_calories,
  COALESCE(ROUND(SUM(mi.protein * oi.quantity), 1), 0) AS total_protein,
  COALESCE(ROUND(SUM(mi.fat * oi.quantity), 1), 0) AS total_fat
FROM "ORDER" o
JOIN ORDER_ITEM oi
  ON oi.outlet_id = o.outlet_id
  AND oi.logical_date = o.logical_date
  AND oi.daily_token_number = o.daily_token_number
JOIN MENU_ITEM mi ON mi.item_id = oi.item_id
LEFT JOIN (
  SELECT
    oie.outlet_id,
    oie.logical_date,
    oie.daily_token_number,
    oie.item_seq_no,
    SUM(ie.price) AS extra_unit_sum
  FROM ORDER_ITEM_EXTRA oie
  JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
  GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
) ex
  ON ex.outlet_id = oi.outlet_id
  AND ex.logical_date = oi.logical_date
  AND ex.daily_token_number = oi.daily_token_number
  AND ex.item_seq_no = oi.item_seq_no
WHERE o.student_id = ?
  AND o.status IN ('Accepted', 'Ready')
  AND o.logical_date >= ?
  AND o.logical_date <= ?;
`.trim();

export function getStudentNutritionSummary(
  studentId: string,
  period: 'day' | 'week' | 'month'
): StudentNutritionSummary {
  const db = getDb();
  const logicalDate = computeLogicalDate(new Date());
  const startDate = getWindowStartDate(logicalDate, period);

  const row = db
    .prepare(SQL_QUERY_1_STUDENT_NUTRITION)
    .get(studentId, startDate, logicalDate) as {
      order_count: number;
      total_spent: number;
      total_calories: number;
      total_protein: number;
      total_fat: number;
    };

  return {
    period,
    order_count: row?.order_count ?? 0,
    total_spent: row?.total_spent ?? 0,
    total_calories: row?.total_calories ?? 0,
    total_protein: row?.total_protein ?? 0,
    total_fat: row?.total_fat ?? 0,
  };
}

export function getAvailableMenuForOutlet(outletId: number): {
  items: MenuItem[];
  extras: ItemExtra[];
} {
  const db = getDb();
  // Uses SQL View v_available_menu (enforces is_available = 1 visibility rule)
  const items = db
    .prepare(
      `SELECT item_id, outlet_id, outlet_name, name, base_price, category, diet_type,
              1 AS is_available, is_parcelable, parcel_charge, calories, protein, fat
       FROM v_available_menu
       WHERE outlet_id = ?
       ORDER BY category, name`
    )
    .all(outletId) as unknown as MenuItem[];

  // Dietary-neutral extras for this outlet always populate regardless of Veg/Non-Veg filter
  const extras = db
    .prepare('SELECT extra_id, outlet_id, name, price FROM ITEM_EXTRA WHERE outlet_id = ? ORDER BY name')
    .all(outletId) as unknown as ItemExtra[];

  return { items, extras };
}

function hydrateOrders(
  whereClause: string,
  params: (string | number)[],
  limit: number = 40
): OrderRecord[] {
  const db = getDb();
  const orders = db
    .prepare(
      `SELECT o.outlet_id, outl.name AS outlet_name, o.logical_date, o.daily_token_number,
              o.student_id, s.name AS student_name, o.actual_timestamp, o.status, o.total_amount
       FROM "ORDER" o
       JOIN OUTLET outl ON outl.outlet_id = o.outlet_id
       JOIN STUDENT s ON s.student_id = o.student_id
       ${whereClause}
       ORDER BY o.logical_date DESC, o.daily_token_number DESC
       LIMIT ?`
    )
    .all(...params, limit) as unknown as Array<Omit<OrderRecord, 'items'>>;

  if (orders.length === 0) return [];

  const getItemsStmt = db.prepare(
    `SELECT oi.item_seq_no, oi.item_id, mi.name AS item_name, mi.category, mi.diet_type,
            oi.quantity, oi.is_parcel, mi.base_price AS unit_base_price,
            mi.parcel_charge AS unit_parcel_charge, mi.calories, mi.protein, mi.fat
     FROM ORDER_ITEM oi
     JOIN MENU_ITEM mi ON mi.item_id = oi.item_id
     WHERE oi.outlet_id = ? AND oi.logical_date = ? AND oi.daily_token_number = ?
     ORDER BY oi.item_seq_no`
  );

  const getExtrasStmt = db.prepare(
    `SELECT ie.extra_id, ie.name, ie.price
     FROM ORDER_ITEM_EXTRA oie
     JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
     WHERE oie.outlet_id = ? AND oie.logical_date = ? AND oie.daily_token_number = ? AND oie.item_seq_no = ?
     ORDER BY ie.name`
  );

  return orders.map((ord) => {
    const itemsRaw = getItemsStmt.all(
      ord.outlet_id,
      ord.logical_date,
      ord.daily_token_number
    ) as unknown as Array<Omit<OrderRecord['items'][number], 'extras'>>;

    const items = itemsRaw.map((it) => ({
      ...it,
      extras: getExtrasStmt.all(
        ord.outlet_id,
        ord.logical_date,
        ord.daily_token_number,
        it.item_seq_no
      ) as unknown as { extra_id: number; name: string; price: number }[],
    }));

    return { ...ord, items };
  });
}

export function getStudentOrders(studentId: string): OrderRecord[] {
  return hydrateOrders('WHERE o.student_id = ?', [studentId], 40);
}

export function getOutletOrders(outletId: number): OrderRecord[] {
  return hydrateOrders('WHERE o.outlet_id = ?', [outletId], 50);
}

// ---------------------------------------------------------------------------
// ACID TRANSACTION #1: Place Order (Atomic Token Generation + Concurrent Guard)
// ---------------------------------------------------------------------------
export interface PlaceOrderPayload {
  student_id: string;
  outlet_id: number;
  items: {
    item_id: number;
    quantity: number;
    is_parcel: boolean;
    extra_ids: number[];
  }[];
}

export function placeOrderTransaction(payload: PlaceOrderPayload): {
  outlet_id: number;
  logical_date: string;
  daily_token_number: number;
  total_amount: number;
} {
  const db = getDb();
  if (!payload.items || payload.items.length === 0) {
    throw new Error('Cannot place an empty order.');
  }

  const now = new Date();
  const logicalDate = computeLogicalDate(now);
  const actualTimestamp = now.toISOString();

  db.exec('BEGIN IMMEDIATE;');
  try {
    // Verify student exists
    const student = db
      .prepare('SELECT student_id FROM STUDENT WHERE student_id = ?')
      .get(payload.student_id);
    if (!student) {
      throw new Error('Student not found.');
    }

    // Generate next sequential Daily Token Number per (outlet_id, logical_date) starting at 101
    const maxRow = db
      .prepare(
        `SELECT COALESCE(MAX(daily_token_number), 100) AS max_token
         FROM "ORDER"
         WHERE outlet_id = ? AND logical_date = ?`
      )
      .get(payload.outlet_id, logicalDate) as { max_token: number };
    const dailyTokenNumber = maxRow.max_token + 1;

    // Fetch authoritative menu item and extra prices from DB to prevent client tampering
    const getItemStmt = db.prepare(
      `SELECT item_id, outlet_id, base_price, is_available, is_parcelable, parcel_charge, calories, protein
       FROM MENU_ITEM WHERE item_id = ?`
    );
    const getExtraStmt = db.prepare(
      `SELECT extra_id, outlet_id, price FROM ITEM_EXTRA WHERE extra_id = ?`
    );

    let totalAmount = 0;
    const verifiedLines: Array<{
      item_id: number;
      quantity: number;
      is_parcel: number;
      extra_ids: number[];
    }> = [];

    for (const line of payload.items) {
      const dbItem = getItemStmt.get(line.item_id) as
        | {
            item_id: number;
            outlet_id: number;
            base_price: number;
            is_available: number;
            is_parcelable: number;
            parcel_charge: number;
            calories: number;
            protein: number;
          }
        | undefined;

      if (!dbItem || dbItem.outlet_id !== payload.outlet_id) {
        throw new Error('Selected menu item does not belong to this outlet.');
      }
      if (dbItem.is_available !== 1) {
        throw new Error('One of the items in your cart was just marked unavailable.');
      }

      const verifiedExtras: { price: number }[] = [];
      const uniqueExtraIds = Array.from(new Set(line.extra_ids || []));
      for (const exId of uniqueExtraIds) {
        const dbEx = getExtraStmt.get(exId) as
          | { extra_id: number; outlet_id: number; price: number }
          | undefined;
        if (!dbEx || dbEx.outlet_id !== payload.outlet_id) {
          throw new Error('Invalid add-on extra selected for this outlet.');
        }
        verifiedExtras.push({ price: dbEx.price });
      }

      const lineTotal = computeLineAmount({
        base_price: dbItem.base_price,
        is_parcelable: dbItem.is_parcelable === 1,
        parcel_charge: dbItem.parcel_charge,
        is_parcel: Boolean(line.is_parcel),
        quantity: line.quantity,
        calories: dbItem.calories,
        protein: dbItem.protein,
        extras: verifiedExtras,
      });

      totalAmount += lineTotal;
      verifiedLines.push({
        item_id: dbItem.item_id,
        quantity: line.quantity,
        is_parcel: line.is_parcel ? 1 : 0,
        extra_ids: uniqueExtraIds,
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));

    // Insert ORDER (Note: trigger trg_prevent_concurrent_outlet_order blocks active duplicates!)
    // Notice also: balance is NOT deducted here (Delayed Financial Deduction rule).
    db.prepare(
      `INSERT INTO "ORDER"
       (outlet_id, logical_date, daily_token_number, student_id, actual_timestamp, status, total_amount)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`
    ).run(
      payload.outlet_id,
      logicalDate,
      dailyTokenNumber,
      payload.student_id,
      actualTimestamp,
      totalAmount
    );

    const insertOI = db.prepare(
      `INSERT INTO ORDER_ITEM
       (outlet_id, logical_date, daily_token_number, item_seq_no, item_id, quantity, is_parcel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertOIE = db.prepare(
      `INSERT INTO ORDER_ITEM_EXTRA
       (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id)
       VALUES (?, ?, ?, ?, ?)`
    );

    verifiedLines.forEach((line, idx) => {
      const seqNo = idx + 1;
      insertOI.run(
        payload.outlet_id,
        logicalDate,
        dailyTokenNumber,
        seqNo,
        line.item_id,
        line.quantity,
        line.is_parcel
      );
      for (const extraId of line.extra_ids) {
        insertOIE.run(payload.outlet_id, logicalDate, dailyTokenNumber, seqNo, extraId);
      }
    });

    db.exec('COMMIT;');
    return {
      outlet_id: payload.outlet_id,
      logical_date: logicalDate,
      daily_token_number: dailyTokenNumber,
      total_amount: totalAmount,
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// ACID TRANSACTION #2: Update Order Status (Fires Delayed Deduction Trigger)
// ---------------------------------------------------------------------------
export function updateOrderStatusTransaction(
  outletId: number,
  logicalDate: string,
  dailyTokenNumber: number,
  nextStatus: OrderStatus
): { status: OrderStatus; new_student_balance: number } {
  const db = getDb();

  db.exec('BEGIN IMMEDIATE;');
  try {
    const existing = db
      .prepare(
        `SELECT student_id, status
         FROM "ORDER"
         WHERE outlet_id = ? AND logical_date = ? AND daily_token_number = ?`
      )
      .get(outletId, logicalDate, dailyTokenNumber) as
      | { student_id: string; status: OrderStatus }
      | undefined;

    if (!existing) {
      throw new Error('Order not found.');
    }

    // Executes trg_validate_order_status_transition AND trg_deduct_balance_on_accept!
    db.prepare(
      `UPDATE "ORDER"
       SET status = ?
       WHERE outlet_id = ? AND logical_date = ? AND daily_token_number = ?`
    ).run(nextStatus, outletId, logicalDate, dailyTokenNumber);

    const updatedStudent = db
      .prepare('SELECT current_balance FROM STUDENT WHERE student_id = ?')
      .get(existing.student_id) as { current_balance: number };

    db.exec('COMMIT;');
    return {
      status: nextStatus,
      new_student_balance: updatedStudent.current_balance,
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// NON-TRIVIAL SQL QUERY #2: Outlet Revenue Breakdown by Category & Menu Item
// Concepts: Multi-table JOIN, GROUP BY, SUM, Subquery (% revenue share)
// ---------------------------------------------------------------------------
export const SQL_QUERY_2_OUTLET_CATEGORY_BREAKDOWN = `
SELECT
  mi.category,
  SUM(oi.quantity) AS units_sold,
  ROUND(SUM(
    (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
  ), 2) AS revenue
FROM "ORDER" o
JOIN ORDER_ITEM oi
  ON oi.outlet_id = o.outlet_id
  AND oi.logical_date = o.logical_date
  AND oi.daily_token_number = o.daily_token_number
JOIN MENU_ITEM mi ON mi.item_id = oi.item_id
LEFT JOIN (
  SELECT
    oie.outlet_id,
    oie.logical_date,
    oie.daily_token_number,
    oie.item_seq_no,
    SUM(ie.price) AS extra_unit_sum
  FROM ORDER_ITEM_EXTRA oie
  JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
  GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
) ex
  ON ex.outlet_id = oi.outlet_id
  AND ex.logical_date = oi.logical_date
  AND ex.daily_token_number = oi.daily_token_number
  AND ex.item_seq_no = oi.item_seq_no
WHERE o.outlet_id = ?
  AND o.status IN ('Accepted', 'Ready')
GROUP BY mi.category
ORDER BY revenue DESC;
`.trim();

// ---------------------------------------------------------------------------
// NON-TRIVIAL SQL QUERY #3: Outlet Daily / Weekly / Monthly Income Analytics (CTE)
// Concepts: Common Table Expression (WITH CTE), Conditional Aggregation, GROUP BY
// ---------------------------------------------------------------------------
export const SQL_QUERY_3_OUTLET_INCOME_CTE = `
WITH outlet_valid_orders AS (
  SELECT logical_date, total_amount
  FROM "ORDER"
  WHERE outlet_id = ?
    AND status IN ('Accepted', 'Ready')
)
SELECT
  COALESCE(ROUND(SUM(CASE WHEN logical_date = ? THEN total_amount ELSE 0 END), 2), 0) AS today_revenue,
  SUM(CASE WHEN logical_date = ? THEN 1 ELSE 0 END) AS today_orders,
  COALESCE(ROUND(SUM(CASE WHEN logical_date >= ? THEN total_amount ELSE 0 END), 2), 0) AS week_revenue,
  SUM(CASE WHEN logical_date >= ? THEN 1 ELSE 0 END) AS week_orders,
  COALESCE(ROUND(SUM(CASE WHEN logical_date >= ? THEN total_amount ELSE 0 END), 2), 0) AS month_revenue,
  SUM(CASE WHEN logical_date >= ? THEN 1 ELSE 0 END) AS month_orders
FROM outlet_valid_orders;
`.trim();

export function getOutletAnalytics(outletId: number): OutletAnalytics {
  const db = getDb();
  const today = computeLogicalDate(new Date());
  const weekStart = getWindowStartDate(today, 'week');
  const monthStart = getWindowStartDate(today, 'month');

  const summary = db
    .prepare(SQL_QUERY_3_OUTLET_INCOME_CTE)
    .get(outletId, today, today, weekStart, weekStart, monthStart, monthStart) as OutletAnalytics['summary'];

  const dailyTrend = db
    .prepare(
      `SELECT logical_date, accepted_order_count AS orders_count, total_revenue AS revenue
       FROM v_outlet_revenue_summary
       WHERE outlet_id = ?
       ORDER BY logical_date DESC
       LIMIT 10`
    )
    .all(outletId) as unknown as OutletAnalytics['dailyTrend'];

  const byCategory = db
    .prepare(SQL_QUERY_2_OUTLET_CATEGORY_BREAKDOWN)
    .all(outletId) as unknown as OutletAnalytics['byCategory'];

  const byItem = db
    .prepare(
      `SELECT
         mi.item_id,
         mi.name,
         mi.category,
         mi.diet_type,
         COALESCE(SUM(oi.quantity), 0) AS units_sold,
         COALESCE(ROUND(SUM(
           (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
         ), 2), 0) AS revenue
       FROM MENU_ITEM mi
       JOIN ORDER_ITEM oi ON oi.item_id = mi.item_id
       JOIN "ORDER" o
         ON o.outlet_id = oi.outlet_id
         AND o.logical_date = oi.logical_date
         AND o.daily_token_number = oi.daily_token_number
         AND o.status IN ('Accepted', 'Ready')
       LEFT JOIN (
         SELECT
           oie.outlet_id,
           oie.logical_date,
           oie.daily_token_number,
           oie.item_seq_no,
           SUM(ie.price) AS extra_unit_sum
         FROM ORDER_ITEM_EXTRA oie
         JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
         GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
       ) ex
         ON ex.outlet_id = oi.outlet_id
         AND ex.logical_date = oi.logical_date
         AND ex.daily_token_number = oi.daily_token_number
         AND ex.item_seq_no = oi.item_seq_no
       WHERE mi.outlet_id = ?
       GROUP BY mi.item_id, mi.name, mi.category, mi.diet_type
       HAVING units_sold > 0
       ORDER BY revenue DESC`
    )
    .all(outletId) as unknown as OutletAnalytics['byItem'];

  return {
    summary: summary || {
      today_revenue: 0,
      today_orders: 0,
      week_revenue: 0,
      week_orders: 0,
      month_revenue: 0,
      month_orders: 0,
    },
    dailyTrend: dailyTrend.reverse(),
    byCategory,
    byItem,
  };
}

export function getOutletAllMenuItems(outletId: number): { items: MenuItem[]; extras: ItemExtra[] } {
  const db = getDb();
  const items = db
    .prepare('SELECT * FROM MENU_ITEM WHERE outlet_id = ? ORDER BY category, name')
    .all(outletId) as unknown as MenuItem[];
  const extras = db
    .prepare('SELECT * FROM ITEM_EXTRA WHERE outlet_id = ? ORDER BY name')
    .all(outletId) as unknown as ItemExtra[];
  return { items, extras };
}

export function toggleMenuItemAvailability(itemId: number, isAvailable: boolean): MenuItem {
  const db = getDb();
  db.prepare('UPDATE MENU_ITEM SET is_available = ? WHERE item_id = ?').run(
    isAvailable ? 1 : 0,
    itemId
  );
  const updated = db.prepare('SELECT * FROM MENU_ITEM WHERE item_id = ?').get(itemId) as
    | MenuItem
    | undefined;
  if (!updated) throw new Error('Menu item not found.');
  return updated;
}

// ---------------------------------------------------------------------------
// NON-TRIVIAL SQL QUERY #4: Union Audit — Student Semester Expenditure & Debt
// Concepts: LEFT JOIN, GROUP BY, COALESCE, Computed Debt Column
// ---------------------------------------------------------------------------
export const SQL_QUERY_4_UNION_STUDENT_AUDIT = `
SELECT
  s.student_id,
  s.name,
  s.email,
  ROUND(s.current_balance, 2) AS current_balance,
  ? AS initial_deposit,
  COUNT(o.daily_token_number) AS total_orders,
  COALESCE(ROUND(SUM(CASE WHEN o.status IN ('Accepted', 'Ready') THEN o.total_amount ELSE 0 END), 2), 0) AS completed_expenditure
FROM STUDENT s
LEFT JOIN "ORDER" o ON o.student_id = s.student_id
GROUP BY s.student_id, s.name, s.email, s.current_balance
ORDER BY completed_expenditure DESC, s.student_id ASC;
`.trim();

// ---------------------------------------------------------------------------
// NON-TRIVIAL SQL QUERY #5: Union Audit — Outlet Revenue & Contact Directory
// Concepts: Multi-table LEFT JOIN, Subquery for phone concatenation, Conditional Aggregation
// ---------------------------------------------------------------------------
export const SQL_QUERY_5_UNION_OUTLET_AUDIT = `
SELECT
  outl.outlet_id,
  outl.name,
  COALESCE((
    SELECT GROUP_CONCAT(op.contact_phone, ', ')
    FROM OUTLET_PHONE op
    WHERE op.outlet_id = outl.outlet_id
  ), 'No phone') AS phones,
  (SELECT COUNT(*) FROM MENU_ITEM mi WHERE mi.outlet_id = outl.outlet_id) AS menu_item_count,
  COUNT(o.daily_token_number) AS total_orders,
  SUM(CASE WHEN o.status IN ('Accepted', 'Ready') THEN 1 ELSE 0 END) AS accepted_orders,
  COALESCE(ROUND(SUM(CASE WHEN o.status IN ('Accepted', 'Ready') THEN o.total_amount ELSE 0 END), 2), 0) AS total_revenue
FROM OUTLET outl
LEFT JOIN "ORDER" o ON o.outlet_id = outl.outlet_id
GROUP BY outl.outlet_id, outl.name
ORDER BY total_revenue DESC, outl.outlet_id ASC;
`.trim();

export function getUnionAuditData(): UnionAuditData {
  const db = getDb();
  const studentExpenditure = db
    .prepare(SQL_QUERY_4_UNION_STUDENT_AUDIT)
    .all(INITIAL_SEMESTER_DEPOSIT) as unknown as UnionAuditData['studentExpenditure'];

  const outletRevenue = db
    .prepare(SQL_QUERY_5_UNION_OUTLET_AUDIT)
    .all() as unknown as UnionAuditData['outletRevenue'];

  return { studentExpenditure, outletRevenue };
}

export function createOutletWithPhonesTransaction(
  name: string,
  phones: string[],
  password?: string
): Outlet & { email: string; initial_password: string } {
  const db = getDb();
  const cleanName = name.trim();
  const cleanPhones = phones.map((p) => p.trim()).filter(Boolean);
  if (!cleanName) throw new Error('Outlet name is required.');
  if (cleanPhones.length === 0) throw new Error('At least one contact phone is required.');

  const cleanEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '')}@campus.edu`;
  const cleanPassword = password && password.trim().length > 0 ? password.trim() : 'outlet123';
  const outletHash = hashPassword(cleanPassword);

  db.exec('BEGIN IMMEDIATE;');
  try {
    const info = db
      .prepare('INSERT INTO OUTLET (name, email, password_hash) VALUES (?, ?, ?)')
      .run(cleanName, cleanEmail, outletHash);
    const outletId = Number(info.lastInsertRowid);
    const insertPhone = db.prepare(
      'INSERT INTO OUTLET_PHONE (outlet_id, contact_phone) VALUES (?, ?)'
    );
    for (const phone of Array.from(new Set(cleanPhones))) {
      insertPhone.run(outletId, phone);
    }
    db.exec('COMMIT;');
    return {
      outlet_id: outletId,
      name: cleanName,
      email: cleanEmail,
      phones: Array.from(new Set(cleanPhones)),
      initial_password: cleanPassword,
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function createStudent(input: {
  student_id: string;
  name: string;
  email: string;
  current_balance?: number;
  password?: string;
}): Student & { initial_password: string } {
  const db = getDb();
  const cleanId = (input.student_id ?? '').trim().toUpperCase();
  const cleanName = (input.name ?? '').trim();
  const cleanEmail = (input.email ?? '').trim().toLowerCase();
  if (!cleanId || !cleanName || !cleanEmail) {
    throw new Error('Student ID, Full Name, and Email are required.');
  }

  const balance =
    input.current_balance !== undefined && !Number.isNaN(Number(input.current_balance))
      ? Number(input.current_balance)
      : INITIAL_SEMESTER_DEPOSIT;
  const cleanPassword =
    input.password && input.password.trim().length > 0 ? input.password.trim() : 'student123';
  const studentHash = hashPassword(cleanPassword);

  db.prepare(
    `INSERT INTO STUDENT (student_id, name, email, password_hash, current_balance)
     VALUES (?, ?, ?, ?, ?)`
  ).run(cleanId, cleanName, cleanEmail, studentHash, balance);

  return {
    student_id: cleanId,
    name: cleanName,
    email: cleanEmail,
    current_balance: balance,
    initial_password: cleanPassword,
  };
}

export function addMenuItem(input: {
  outlet_id: number;
  name: string;
  base_price: number;
  category: string;
  diet_type: 'Veg' | 'Non-Veg';
  is_parcelable: boolean;
  parcel_charge: number;
  calories: number;
  protein: number;
  fat?: number;
}): MenuItem {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO MENU_ITEM
       (outlet_id, name, base_price, category, diet_type, is_available, is_parcelable, parcel_charge, calories, protein, fat)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
    )
    .run(
      input.outlet_id,
      input.name.trim(),
      Number(input.base_price),
      input.category.trim(),
      input.diet_type,
      input.is_parcelable ? 1 : 0,
      input.is_parcelable ? Number(input.parcel_charge) : 0,
      Math.round(Number(input.calories)),
      Number(input.protein),
      Number(input.fat ?? 0)
    );
  return db
    .prepare('SELECT * FROM MENU_ITEM WHERE item_id = ?')
    .get(Number(info.lastInsertRowid)) as unknown as MenuItem;
}

export function addItemExtra(outletId: number, name: string, price: number): ItemExtra {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO ITEM_EXTRA (outlet_id, name, price) VALUES (?, ?, ?)')
    .run(outletId, name.trim(), Number(price));
  return db
    .prepare('SELECT * FROM ITEM_EXTRA WHERE extra_id = ?')
    .get(Number(info.lastInsertRowid)) as unknown as ItemExtra;
}

// ---------------------------------------------------------------------------
// DEMO SHEET QUERY #2: Sales by Food Category & Diet Type (4-Table JOIN + Subquery)
// ---------------------------------------------------------------------------
export const SQL_DEMO_Q2_CATEGORY_DIET_BREAKDOWN = `
SELECT
  mi.category,
  mi.diet_type,
  COUNT(DISTINCT o.outlet_id || ':' || o.logical_date || ':' || o.daily_token_number) AS order_count,
  SUM(oi.quantity) AS units_sold,
  ROUND(SUM(
    (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
  ), 2) AS total_revenue
FROM "ORDER" o
JOIN ORDER_ITEM oi
  ON oi.outlet_id = o.outlet_id
  AND oi.logical_date = o.logical_date
  AND oi.daily_token_number = o.daily_token_number
JOIN MENU_ITEM mi ON mi.item_id = oi.item_id
LEFT JOIN (
  SELECT
    oie.outlet_id,
    oie.logical_date,
    oie.daily_token_number,
    oie.item_seq_no,
    SUM(ie.price) AS extra_unit_sum
  FROM ORDER_ITEM_EXTRA oie
  JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
  GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
) ex
  ON ex.outlet_id = oi.outlet_id
  AND ex.logical_date = oi.logical_date
  AND ex.daily_token_number = oi.daily_token_number
  AND ex.item_seq_no = oi.item_seq_no
WHERE o.status IN ('Accepted', 'Ready')
GROUP BY mi.category, mi.diet_type
ORDER BY total_revenue DESC;
`.trim();

// ---------------------------------------------------------------------------
// DEMO SHEET QUERY #3: Students Spending Above Campus Average (Nested Subquery + HAVING)
// ---------------------------------------------------------------------------
export const SQL_DEMO_Q3_ABOVE_AVG_SPENDERS = `
SELECT
  s.student_id,
  s.name,
  s.email,
  ROUND(s.current_balance, 2) AS current_balance,
  COUNT(o.daily_token_number) AS completed_orders,
  ROUND(SUM(o.total_amount), 2) AS total_spent
FROM STUDENT s
JOIN "ORDER" o
  ON o.student_id = s.student_id
  AND o.status IN ('Accepted', 'Ready')
GROUP BY s.student_id, s.name, s.email, s.current_balance
HAVING SUM(o.total_amount) > (
  SELECT AVG(student_total)
  FROM (
    SELECT COALESCE(SUM(o2.total_amount), 0) AS student_total
    FROM STUDENT s2
    LEFT JOIN "ORDER" o2
      ON o2.student_id = s2.student_id
      AND o2.status IN ('Accepted', 'Ready')
    GROUP BY s2.student_id
  )
)
ORDER BY total_spent DESC;
`.trim();

// ---------------------------------------------------------------------------
// DEMO SHEET QUERY #4: Student Daily Calorie, Protein & Fat Intake (4-Table JOIN + SUM)
// ---------------------------------------------------------------------------
export const SQL_DEMO_Q4_DAILY_NUTRITION_PER_STUDENT = `
SELECT
  s.student_id,
  s.name AS student_name,
  o.logical_date,
  COUNT(DISTINCT o.outlet_id || ':' || o.logical_date || ':' || o.daily_token_number) AS orders_count,
  ROUND(SUM(
    (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
  ), 2) AS daily_spent,
  SUM(mi.calories * oi.quantity) AS total_calories,
  ROUND(SUM(mi.protein * oi.quantity), 1) AS total_protein_g,
  ROUND(SUM(mi.fat * oi.quantity), 1) AS total_fat_g
FROM STUDENT s
JOIN "ORDER" o
  ON o.student_id = s.student_id
  AND o.status IN ('Accepted', 'Ready')
JOIN ORDER_ITEM oi
  ON oi.outlet_id = o.outlet_id
  AND oi.logical_date = o.logical_date
  AND oi.daily_token_number = o.daily_token_number
JOIN MENU_ITEM mi ON mi.item_id = oi.item_id
LEFT JOIN (
  SELECT
    oie.outlet_id,
    oie.logical_date,
    oie.daily_token_number,
    oie.item_seq_no,
    SUM(ie.price) AS extra_unit_sum
  FROM ORDER_ITEM_EXTRA oie
  JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
  GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
) ex
  ON ex.outlet_id = oi.outlet_id
  AND ex.logical_date = oi.logical_date
  AND ex.daily_token_number = oi.daily_token_number
  AND ex.item_seq_no = oi.item_seq_no
GROUP BY s.student_id, s.name, o.logical_date
ORDER BY o.logical_date DESC, total_calories DESC
LIMIT 25;
`.trim();

// ---------------------------------------------------------------------------
// DEMO SHEET QUERY #5: Top 3 Best-Selling Items per Outlet (CTE + DENSE_RANK Window Function)
// ---------------------------------------------------------------------------
export const SQL_DEMO_Q5_TOP_ITEMS_WINDOW = `
WITH item_sales_cte AS (
  SELECT
    outl.outlet_id,
    outl.name AS outlet_name,
    mi.item_id,
    mi.name AS item_name,
    mi.category,
    mi.diet_type,
    SUM(oi.quantity) AS units_sold,
    ROUND(SUM(
      (mi.base_price + (CASE WHEN oi.is_parcel = 1 THEN mi.parcel_charge ELSE 0 END) + COALESCE(ex.extra_unit_sum, 0)) * oi.quantity
    ), 2) AS item_revenue,
    DENSE_RANK() OVER (
      PARTITION BY outl.outlet_id
      ORDER BY SUM(oi.quantity) DESC, SUM(mi.base_price * oi.quantity) DESC
    ) AS sales_rank
  FROM MENU_ITEM mi
  JOIN OUTLET outl ON outl.outlet_id = mi.outlet_id
  JOIN ORDER_ITEM oi ON oi.item_id = mi.item_id
  JOIN "ORDER" o
    ON o.outlet_id = oi.outlet_id
    AND o.logical_date = oi.logical_date
    AND o.daily_token_number = oi.daily_token_number
    AND o.status IN ('Accepted', 'Ready')
  LEFT JOIN (
    SELECT
      oie.outlet_id,
      oie.logical_date,
      oie.daily_token_number,
      oie.item_seq_no,
      SUM(ie.price) AS extra_unit_sum
    FROM ORDER_ITEM_EXTRA oie
    JOIN ITEM_EXTRA ie ON ie.extra_id = oie.extra_id
    GROUP BY oie.outlet_id, oie.logical_date, oie.daily_token_number, oie.item_seq_no
  ) ex
    ON ex.outlet_id = oi.outlet_id
    AND ex.logical_date = oi.logical_date
    AND ex.daily_token_number = oi.daily_token_number
    AND ex.item_seq_no = oi.item_seq_no
  GROUP BY outl.outlet_id, outl.name, mi.item_id, mi.name, mi.category, mi.diet_type
)
SELECT
  outlet_name,
  sales_rank,
  item_name,
  category,
  diet_type,
  units_sold,
  item_revenue
FROM item_sales_cte
WHERE sales_rank <= 3
ORDER BY outlet_id ASC, sales_rank ASC;
`.trim();

export function getDbmsOverview(): DbmsOverviewData {
  const db = getDb();
  const tableNames = [
    'STUDENT',
    'OUTLET',
    'OUTLET_PHONE',
    'MENU_ITEM',
    'ITEM_EXTRA',
    'UNION_ADMIN',
    'ORDER',
    'ORDER_ITEM',
    'ORDER_ITEM_EXTRA',
  ];

  const tableCounts = tableNames.map((t) => {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM "${t}"`).get() as { cnt: number };
    return { table_name: t, row_count: row.cnt };
  });

  const totalRecords = tableCounts.reduce((acc, r) => acc + r.row_count, 0);

  return {
    tableCounts,
    totalRecords,
    logicalDate: computeLogicalDate(new Date()),
    queries: [
      {
        key: 'q1_outlet_revenue',
        title: 'Q1. Outlet-Wise Total Revenue & Order Count (LEFT JOIN + GROUP BY)',
        concepts: 'LEFT JOIN + Correlated Scalar Subqueries + GROUP_CONCAT + GROUP BY',
        sourceRef: 'src/db/queries.ts',
        sql: SQL_QUERY_5_UNION_OUTLET_AUDIT,
      },
      {
        key: 'q2_category_diet_breakdown',
        title: 'Q2. Sales by Food Category & Diet Type (4-Table JOIN + Subquery)',
        concepts: '4-Table JOIN + Derived Subquery for Item Extras + CASE + GROUP BY',
        sourceRef: 'src/db/queries.ts',
        sql: SQL_DEMO_Q2_CATEGORY_DIET_BREAKDOWN,
      },
      {
        key: 'q3_above_avg_spenders',
        title: 'Q3. Students Spending Above Campus Average (Nested Subquery + HAVING)',
        concepts: 'INNER JOIN + GROUP BY + HAVING with Nested Aggregate Subquery',
        sourceRef: 'src/db/queries.ts',
        sql: SQL_DEMO_Q3_ABOVE_AVG_SPENDERS,
      },
      {
        key: 'q4_daily_nutrition_per_student',
        title: 'Q4. Student Daily Calorie, Protein & Fat Intake (4-Table JOIN + SUM)',
        concepts: '4-Table JOIN + Subquery + Multi-Metric Nutritional SUM Aggregation',
        sourceRef: 'src/db/queries.ts',
        sql: SQL_DEMO_Q4_DAILY_NUTRITION_PER_STUDENT,
      },
      {
        key: 'q5_top_items_per_outlet_window',
        title: 'Q5. Top 3 Best-Selling Items per Outlet (CTE + DENSE_RANK Window Function)',
        concepts: 'Common Table Expression (WITH CTE) + DENSE_RANK() OVER (PARTITION BY ...)',
        sourceRef: 'src/db/queries.ts',
        sql: SQL_DEMO_Q5_TOP_ITEMS_WINDOW,
      },
    ],
  };
}

export function runNamedDemoQuery(queryKey: string): Record<string, unknown>[] {
  const db = getDb();
  const today = computeLogicalDate(new Date());
  const weekStart = getWindowStartDate(today, 'week');
  const monthStart = getWindowStartDate(today, 'month');

  switch (queryKey) {
    case 'q1_outlet_revenue':
    case 'q5_union_outlet_audit':
      return db.prepare(SQL_QUERY_5_UNION_OUTLET_AUDIT).all() as Record<string, unknown>[];
    case 'q2_category_diet_breakdown':
      return db.prepare(SQL_DEMO_Q2_CATEGORY_DIET_BREAKDOWN).all() as Record<string, unknown>[];
    case 'q3_above_avg_spenders':
      return db.prepare(SQL_DEMO_Q3_ABOVE_AVG_SPENDERS).all() as Record<string, unknown>[];
    case 'q4_daily_nutrition_per_student':
      return db.prepare(SQL_DEMO_Q4_DAILY_NUTRITION_PER_STUDENT).all() as Record<string, unknown>[];
    case 'q5_top_items_per_outlet_window':
      return db.prepare(SQL_DEMO_Q5_TOP_ITEMS_WINDOW).all() as Record<string, unknown>[];
    case 'q1_student_nutrition':
      return [
        db
          .prepare(SQL_QUERY_1_STUDENT_NUTRITION)
          .get('2024AAPS0225H', monthStart, today) as Record<string, unknown>,
      ];
    case 'q2_outlet_category':
      return db.prepare(SQL_QUERY_2_OUTLET_CATEGORY_BREAKDOWN).all(1) as Record<string, unknown>[];
    case 'q3_outlet_income_cte':
      return [
        db
          .prepare(SQL_QUERY_3_OUTLET_INCOME_CTE)
          .get(1, today, today, weekStart, weekStart, monthStart, monthStart) as Record<
          string,
          unknown
        >,
      ];
    case 'q4_union_student_audit':
      return db
        .prepare(SQL_QUERY_4_UNION_STUDENT_AUDIT)
        .all(INITIAL_SEMESTER_DEPOSIT) as Record<string, unknown>[];
    default:
      throw new Error('Unknown query key.');
  }
}
