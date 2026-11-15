import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { computeLogicalDate, INITIAL_SEMESTER_DEPOSIT } from '../utils/campusRules.ts';
import { hashPassword } from '../utils/authCrypto.ts';

const DB_PATH = path.resolve(process.cwd(), 'campus_food.db');
const SCHEMA_SQL_PATH = path.resolve(process.cwd(), 'database', 'schema.sql');
const TRIGGERS_VIEWS_SQL_PATH = path.resolve(process.cwd(), 'database', 'triggers_and_views.sql');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');

    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf-8');
    const triggersViewsSql = fs.readFileSync(TRIGGERS_VIEWS_SQL_PATH, 'utf-8');

    dbInstance.exec(schemaSql);
    ensureMenuFatColumn(dbInstance);
    ensureAuthColumns(dbInstance);
    dbInstance.exec(triggersViewsSql);

    seedDatabaseIfEmpty(dbInstance);
  }
  return dbInstance;
}

function ensureMenuFatColumn(db: DatabaseSync): void {
  const cols = db.prepare('PRAGMA table_info(MENU_ITEM)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'fat')) {
    db.exec('ALTER TABLE MENU_ITEM ADD COLUMN fat REAL NOT NULL DEFAULT 0 CHECK (fat >= 0);');
    db.exec('UPDATE MENU_ITEM SET fat = ROUND(calories * 0.03, 1) WHERE fat = 0;');
  }
}

function ensureAuthColumns(db: DatabaseSync): void {
  const studentCols = db.prepare('PRAGMA table_info(STUDENT)').all() as Array<{ name: string }>;
  if (!studentCols.some((c) => c.name === 'password_hash')) {
    db.exec("ALTER TABLE STUDENT ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';");
  }

  const outletCols = db.prepare('PRAGMA table_info(OUTLET)').all() as Array<{ name: string }>;
  if (!outletCols.some((c) => c.name === 'email')) {
    db.exec('ALTER TABLE OUTLET ADD COLUMN email TEXT;');
  }
  if (!outletCols.some((c) => c.name === 'password_hash')) {
    db.exec("ALTER TABLE OUTLET ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';");
  }

  const adminCols = db.prepare('PRAGMA table_info(UNION_ADMIN)').all() as Array<{ name: string }>;
  if (!adminCols.some((c) => c.name === 'password_hash')) {
    db.exec("ALTER TABLE UNION_ADMIN ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';");
  }

  // Backfill default password hashes if any existing rows have empty hashes
  const missingStu = db
    .prepare("SELECT COUNT(*) AS cnt FROM STUDENT WHERE password_hash = ''")
    .get() as { cnt: number };
  if (missingStu.cnt > 0) {
    db.prepare("UPDATE STUDENT SET password_hash = ? WHERE password_hash = ''").run(
      hashPassword('student123')
    );
  }

  const outletsMissing = db
    .prepare("SELECT outlet_id, name, email, password_hash FROM OUTLET WHERE password_hash = '' OR email IS NULL")
    .all() as Array<{ outlet_id: number; name: string; email: string | null; password_hash: string }>;
  if (outletsMissing.length > 0) {
    const fallbackOutletHash = hashPassword('outlet123');
    const updOutlet = db.prepare(
      'UPDATE OUTLET SET email = COALESCE(email, ?), password_hash = CASE WHEN password_hash = \'\' THEN ? ELSE password_hash END WHERE outlet_id = ?'
    );
    for (const o of outletsMissing) {
      const slug = o.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
      updOutlet.run(`${slug}@campus.edu`, fallbackOutletHash, o.outlet_id);
    }
  }

  const missingAdmin = db
    .prepare("SELECT COUNT(*) AS cnt FROM UNION_ADMIN WHERE password_hash = ''")
    .get() as { cnt: number };
  if (missingAdmin.cnt > 0) {
    db.prepare("UPDATE UNION_ADMIN SET password_hash = ? WHERE password_hash = ''").run(
      hashPassword('admin123')
    );
  }
}

function shiftLogicalDate(baseDateStr: string, deltaDays: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function seedDatabaseIfEmpty(db: DatabaseSync): void {
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM STUDENT').get() as { cnt: number };
  if (countRow.cnt > 0) {
    return;
  }

  const todayLogical = computeLogicalDate(new Date());

  const studentHash = hashPassword('student123');
  const outletHash = hashPassword('outlet123');
  const adminHash = hashPassword('admin123');

  db.exec('BEGIN IMMEDIATE;');
  try {
    // 1. UNION_ADMIN (5 records - P2 Group 18 members serving as Food Safety Union Admins)
    const insertAdmin = db.prepare(
      'INSERT INTO UNION_ADMIN (admin_id, name, email, password_hash) VALUES (?, ?, ?, ?)'
    );
    const admins = [
      ['ADM001', 'Singireddy Hrushikesh Reddy', 'f20240239@hyderabad.bits-pilani.ac.in', adminHash],
      ['ADM002', 'Kartikey Gaur', 'f20240225@hyderabad.bits-pilani.ac.in', adminHash],
      ['ADM003', 'Deeptimahanti Aashrith', 'f20240189@hyderabad.bits-pilani.ac.in', adminHash],
      ['ADM004', 'Aryaman Ray', 'f20240227@hyderabad.bits-pilani.ac.in', adminHash],
      ['ADM005', 'Kothapalli Manobhiram Reddy', 'f20240240@hyderabad.bits-pilani.ac.in', adminHash],
    ];
    for (const a of admins) insertAdmin.run(...a);

    // 2. STUDENT (18 records)
    const insertStudent = db.prepare(
      'INSERT INTO STUDENT (student_id, name, email, password_hash, current_balance) VALUES (?, ?, ?, ?, ?)'
    );
    const students = [
      ['2024AAPS0225H', 'Kartikey Gaur', 'kartikey.gaur@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024AAPS0239H', 'Singireddy Hrushikesh', 'hrushikesh.r@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024AAPS0189H', 'Deeptimahanti Aashrith', 'aashrith.d@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024AAPS0227H', 'Aryaman Ray', 'aryaman.ray@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024AAPS0240H', 'Kothapalli Manobhiram', 'manobhiram.k@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A7PS0101H', 'Rohan Verma (Debt Case)', 'rohan.verma@campus.edu', studentHash, 1000], // Will go negative to demonstrate debt tracking
      ['2024A7PS0112H', 'Ananya Sharma', 'ananya.sharma@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A8PS0145H', 'Vikramaditya Nair', 'vikram.nair@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A3PS0210H', 'Priya Deshmukh', 'priya.deshmukh@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A4PS0178H', 'Siddharth Kulkarni', 'siddharth.k@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A7PS0288H', 'Meera Krishnan', 'meera.krishnan@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A1PS0312H', 'Kabir Malhotra', 'kabir.malhotra@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024AAPS0355H', 'Ishita Banerjee', 'ishita.b@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A7PS0401H', 'Devansh Patel', 'devansh.patel@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A8PS0422H', 'Tanvi Joshi', 'tanvi.joshi@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A3PS0467H', 'Arjun Menon', 'arjun.menon@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A4PS0509H', 'Sneha Reddy', 'sneha.reddy@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
      ['2024A7PS0530H', 'Nikhil Rao', 'nikhil.rao@campus.edu', studentHash, INITIAL_SEMESTER_DEPOSIT],
    ];
    for (const s of students) insertStudent.run(...s);

    // 3. OUTLET (6 records) & 4. OUTLET_PHONE (12 records - 2 per outlet for 1NF)
    const insertOutlet = db.prepare(
      'INSERT INTO OUTLET (name, email, password_hash) VALUES (?, ?, ?)'
    );
    const insertPhone = db.prepare(
      'INSERT INTO OUTLET_PHONE (outlet_id, contact_phone) VALUES (?, ?)'
    );
    const outlets = [
      { name: 'Hotspot', email: 'hotspot@campus.edu', phones: ['+91-9849011001', '+91-4023451001'] },
      { name: 'Protein Isle', email: 'proteinisle@campus.edu', phones: ['+91-9849011002', '+91-4023451002'] },
      { name: 'Yumppies', email: 'yumppies@campus.edu', phones: ['+91-9849011003', '+91-4023451003'] },
      { name: 'Dominos', email: 'dominos@campus.edu', phones: ['+91-9849011004', '+91-4023451004'] },
      { name: 'Subway', email: 'subway@campus.edu', phones: ['+91-9849011005', '+91-4023451005'] },
      { name: 'Sereno', email: 'sereno@campus.edu', phones: ['+91-9849011006', '+91-4023451006'] },
    ];
    for (const o of outlets) {
      const info = insertOutlet.run(o.name, o.email, outletHash);
      const outletId = Number(info.lastInsertRowid);
      for (const phone of o.phones) {
        insertPhone.run(outletId, phone);
      }
    }

    // 5. MENU_ITEM (36 records - 6 per outlet)
    const insertItem = db.prepare(
      `INSERT INTO MENU_ITEM
       (outlet_id, name, base_price, category, diet_type, is_available, is_parcelable, parcel_charge, calories, protein, fat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const menuData: Array<[number, string, number, string, 'Veg' | 'Non-Veg', number, number, number, number, number, number]> = [
      // Outlet 1: Hotspot
      [1, 'Hotspot Classic Maggi', 50, 'Snacks', 'Veg', 1, 1, 10, 360, 8.5, 14.0],
      [1, 'Cheese Chilli Toast', 65, 'Snacks', 'Veg', 1, 1, 10, 410, 12.0, 18.5],
      [1, 'Paneer Masala Roll', 90, 'Snacks', 'Veg', 1, 1, 10, 480, 18.0, 19.0],
      [1, 'Double Egg Maggi', 65, 'Snacks', 'Non-Veg', 1, 1, 10, 440, 15.0, 18.0],
      [1, 'Chicken Tikka Roll', 120, 'Snacks', 'Non-Veg', 1, 1, 10, 540, 26.0, 21.0],
      [1, 'Hot Chocolate Cup', 45, 'Beverages', 'Veg', 0, 0, 0, 180, 4.0, 7.0], // Unavailable by default

      // Outlet 2: Protein Isle
      [2, 'Grilled Paneer Protein Bowl', 165, 'Meals', 'Veg', 1, 1, 15, 520, 32.0, 18.0],
      [2, 'Quinoa Chickpea Salad', 130, 'Meals', 'Veg', 1, 1, 10, 390, 18.0, 11.0],
      [2, 'Whey Banana Shake', 95, 'Juice', 'Veg', 1, 1, 10, 290, 25.0, 3.5],
      [2, 'Grilled Chicken Breast Bowl', 190, 'Meals', 'Non-Veg', 1, 1, 15, 480, 46.0, 10.5],
      [2, 'Boiled Egg & Avocado Bowl', 145, 'Meals', 'Non-Veg', 1, 1, 10, 420, 24.0, 22.0],
      [2, 'Peanut Butter Berry Smoothie', 110, 'Juice', 'Veg', 0, 1, 10, 340, 22.0, 12.0], // Unavailable by default

      // Outlet 3: Yumppies
      [3, 'Veg Fried Rice', 100, 'Rice', 'Veg', 1, 1, 15, 560, 12.0, 16.5],
      [3, 'Paneer Manchurian Bowl', 135, 'Meals', 'Veg', 1, 1, 15, 610, 20.0, 24.0],
      [3, 'Chilli Garlic Veg Noodles', 110, 'Snacks', 'Veg', 1, 1, 10, 530, 11.0, 15.5],
      [3, 'Chicken Hakka Noodles', 140, 'Snacks', 'Non-Veg', 1, 1, 15, 620, 24.0, 19.0],
      [3, 'Egg Schezwan Fried Rice', 125, 'Rice', 'Non-Veg', 1, 1, 15, 590, 19.0, 18.0],
      [3, 'Veg Steamed Momos', 75, 'Snacks', 'Veg', 1, 0, 0, 320, 9.0, 7.5],

      // Outlet 4: Dominos
      [4, 'Margherita Personal Pizza', 119, 'Meals', 'Veg', 1, 1, 15, 580, 19.0, 22.0],
      [4, 'Peppy Paneer Personal Pizza', 169, 'Meals', 'Veg', 1, 1, 15, 660, 24.0, 27.0],
      [4, 'Classic Garlic Breadsticks', 99, 'Snacks', 'Veg', 1, 1, 10, 430, 10.0, 16.0],
      [4, 'Pepper Barbecue Chicken Pizza', 189, 'Meals', 'Non-Veg', 1, 1, 15, 710, 31.0, 25.0],
      [4, 'Chicken Pepperoni Slices', 199, 'Meals', 'Non-Veg', 1, 1, 15, 730, 33.0, 29.0],
      [4, 'Choco Lava Cake', 99, 'Snacks', 'Veg', 1, 1, 5, 360, 5.0, 18.0],

      // Outlet 5: Subway
      [5, 'Veggie Delite 6-inch Sub', 135, 'Snacks', 'Veg', 1, 1, 10, 330, 11.0, 6.0],
      [5, 'Paneer Tikka 6-inch Sub', 165, 'Meals', 'Veg', 1, 1, 10, 450, 21.0, 14.0],
      [5, 'Corn & Peas Salad Bowl', 150, 'Meals', 'Veg', 1, 0, 0, 290, 9.5, 8.0],
      [5, 'Roasted Chicken Breast Sub', 185, 'Meals', 'Non-Veg', 1, 1, 10, 410, 29.0, 9.0],
      [5, 'Chicken Teriyaki 6-inch Sub', 195, 'Meals', 'Non-Veg', 1, 1, 10, 440, 28.0, 10.5],
      [5, 'Oatmeal Raisin Cookie', 55, 'Snacks', 'Veg', 1, 1, 5, 210, 3.0, 8.5],

      // Outlet 6: Sereno
      [6, 'Masala Dosa', 60, 'Tiffin', 'Veg', 1, 1, 10, 380, 9.5, 13.0],
      [6, 'Veg Dum Biryani Bowl', 120, 'Rice', 'Veg', 1, 1, 15, 610, 15.0, 19.5],
      [6, 'Cold Coffee Frappe', 70, 'Beverages', 'Veg', 1, 1, 10, 250, 6.0, 8.0],
      [6, 'Chicken Dum Biryani', 170, 'Rice', 'Non-Veg', 1, 1, 15, 760, 34.0, 26.0],
      [6, 'Egg Bhurji & Paratha', 95, 'Tiffin', 'Non-Veg', 1, 1, 10, 490, 18.0, 21.0],
      [6, 'Fresh Lime Soda', 40, 'Juice', 'Veg', 1, 0, 0, 95, 0.5, 0.0],
    ];
    for (const item of menuData) insertItem.run(...item);

    // 6. ITEM_EXTRA (18 records - 3 dietary-neutral extras per outlet)
    const insertExtra = db.prepare(
      'INSERT INTO ITEM_EXTRA (outlet_id, name, price) VALUES (?, ?, ?)'
    );
    const extrasData: Array<[number, string, number]> = [
      [1, 'Amul Butter', 15],
      [1, 'Extra Cheese', 20],
      [1, 'Peri Peri Masala', 10],
      [2, 'Chia Seeds Boost', 15],
      [2, 'Roasted Almonds', 20],
      [2, 'Olive Oil Dressing', 10],
      [3, 'Schezwan Dip', 15],
      [3, 'Chilli Oil Drizzle', 10],
      [3, 'Crispy Fried Garlic', 10],
      [4, 'Extra Mozzarella Cheese', 30],
      [4, 'Cheesy Jalapeno Dip', 25],
      [4, 'Oregano & Chilli Pack', 5],
      [5, 'Extra Cheese Slice', 20],
      [5, 'Southwest Chipotle Sauce', 15],
      [5, 'Olives & Jalapenos', 15],
      [6, 'Extra Ghee', 20],
      [6, 'Raita Cup', 15],
      [6, 'Mint Chutney', 10],
    ];
    for (const ex of extrasData) insertExtra.run(...ex);

    // Fetch all inserted items & extras to compute exact order totals deterministically
    const allItems = db.prepare('SELECT * FROM MENU_ITEM').all() as Array<{
      item_id: number;
      outlet_id: number;
      base_price: number;
      is_parcelable: number;
      parcel_charge: number;
      is_available: number;
    }>;
    const allExtras = db.prepare('SELECT * FROM ITEM_EXTRA').all() as Array<{
      extra_id: number;
      outlet_id: number;
      price: number;
    }>;

    const itemsByOutlet = new Map<number, typeof allItems>();
    for (const it of allItems) {
      if (it.is_available === 0) continue;
      const arr = itemsByOutlet.get(it.outlet_id) ?? [];
      arr.push(it);
      itemsByOutlet.set(it.outlet_id, arr);
    }

    const extrasByOutlet = new Map<number, typeof allExtras>();
    for (const ex of allExtras) {
      const arr = extrasByOutlet.get(ex.outlet_id) ?? [];
      arr.push(ex);
      extrasByOutlet.set(ex.outlet_id, arr);
    }

    const insertOrder = db.prepare(
      `INSERT INTO "ORDER"
       (outlet_id, logical_date, daily_token_number, student_id, actual_timestamp, status, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const updateOrderStatus = db.prepare(
      `UPDATE "ORDER" SET status = ? WHERE outlet_id = ? AND logical_date = ? AND daily_token_number = ?`
    );
    const insertOrderItem = db.prepare(
      `INSERT INTO ORDER_ITEM
       (outlet_id, logical_date, daily_token_number, item_seq_no, item_id, quantity, is_parcel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertOrderItemExtra = db.prepare(
      `INSERT INTO ORDER_ITEM_EXTRA
       (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id)
       VALUES (?, ?, ?, ?, ?)`
    );

    const tokenCounters = new Map<string, number>();
    const nextToken = (outletId: number, logicalDate: string): number => {
      const key = `${outletId}:${logicalDate}`;
      const next = (tokenCounters.get(key) ?? 100) + 1;
      tokenCounters.set(key, next);
      return next;
    };

    const studentIds = students.map((s) => s[0] as string);

    // Seed ~150 historical Ready/Cancelled/Rejected orders over past 25 logical days
    for (let dayOffset = -25; dayOffset <= -1; dayOffset++) {
      const lDate = shiftLogicalDate(todayLogical, dayOffset);
      const ordersForDay = 6; // 25 * 6 = 150 orders across past days
      for (let i = 0; i < ordersForDay; i++) {
        const outletId = ((Math.abs(dayOffset) + i) % 6) + 1;
        const studentId = studentIds[(Math.abs(dayOffset) * 3 + i) % studentIds.length];
        const token = nextToken(outletId, lDate);
        const outletMenu = itemsByOutlet.get(outletId)!;
        const outletExtras = extrasByOutlet.get(outletId)!;

        // 1 or 2 items per order
        const lineCount = (i + Math.abs(dayOffset)) % 2 === 0 ? 2 : 1;
        const lines: Array<{ itemId: number; qty: number; isParcel: number; extraIds: number[]; lineTotal: number }> = [];

        for (let seq = 0; seq < lineCount; seq++) {
          const item = outletMenu[(i + seq * 2 + Math.abs(dayOffset)) % outletMenu.length];
          const qty = (seq + i) % 3 === 0 ? 2 : 1;
          const isParcel = item.is_parcelable === 1 && (i + seq) % 2 === 0 ? 1 : 0;
          const chosenExtras: number[] = [];
          let extraCost = 0;
          if ((i + seq) % 2 === 0) {
            const ex1 = outletExtras[(i + seq) % outletExtras.length];
            chosenExtras.push(ex1.extra_id);
            extraCost += ex1.price;
          }
          if ((i + seq) % 4 === 0 && outletExtras.length > 1) {
            const ex2 = outletExtras[(i + seq + 1) % outletExtras.length];
            if (!chosenExtras.includes(ex2.extra_id)) {
              chosenExtras.push(ex2.extra_id);
              extraCost += ex2.price;
            }
          }
          const lineTotal =
            (item.base_price + (isParcel ? item.parcel_charge : 0) + extraCost) * qty;
          lines.push({ itemId: item.item_id, qty, isParcel, extraIds: chosenExtras, lineTotal });
        }

        const totalAmount = Number(lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2));
        const hour = 10 + ((i * 2) % 12);
        const timestamp = `${lDate}T${String(hour).padStart(2, '0')}:15:00`;

        insertOrder.run(outletId, lDate, token, studentId, timestamp, 'Pending', totalAmount);
        lines.forEach((l, idx) => {
          insertOrderItem.run(outletId, lDate, token, idx + 1, l.itemId, l.qty, l.isParcel);
          for (const exId of l.extraIds) {
            insertOrderItemExtra.run(outletId, lDate, token, idx + 1, exId);
          }
        });

        // Transition status via UPDATE so trg_deduct_balance_on_accept executes genuinely!
        if (i % 11 === 10) {
          updateOrderStatus.run('Cancelled', outletId, lDate, token);
        } else if (i % 13 === 12) {
          updateOrderStatus.run('Rejected', outletId, lDate, token);
        } else {
          updateOrderStatus.run('Accepted', outletId, lDate, token);
          updateOrderStatus.run('Ready', outletId, lDate, token);
        }
      }
    }

    // Extra heavy spending for Rohan Verma (2024A7PS0101H) to demonstrate negative debt balance
    for (let k = 0; k < 8; k++) {
      const lDate = shiftLogicalDate(todayLogical, -(k + 1));
      const outletId = (k % 5) + 1;
      const token = nextToken(outletId, lDate);
      const outletMenu = itemsByOutlet.get(outletId)!;
      const item = outletMenu[0];
      const qty = 2;
      const totalAmount = Number(((item.base_price + (item.is_parcelable ? item.parcel_charge : 0)) * qty).toFixed(2));
      insertOrder.run(outletId, lDate, token, '2024A7PS0101H', `${lDate}T20:30:00`, 'Pending', totalAmount);
      insertOrderItem.run(outletId, lDate, token, 1, item.item_id, qty, item.is_parcelable ? 1 : 0);
      updateOrderStatus.run('Accepted', outletId, lDate, token);
      updateOrderStatus.run('Ready', outletId, lDate, token);
    }

    // Seed 12 orders on TODAY's logical date (mix of Ready, Accepted, and Pending for live demo)
    // Leave Kartikey Gaur (2024AAPS0225H) with NO active Pending/Accepted at Outlet 1, 2, 3
    // so he can immediately place a fresh demo order at Outlet 1!
    const todayOrdersPlan: Array<{
      outletId: number;
      studentId: string;
      finalStatus: 'Ready' | 'Accepted' | 'Pending';
      hour: string;
    }> = [
      { outletId: 1, studentId: '2024A7PS0112H', finalStatus: 'Ready', hour: '08:15:00' },
      { outletId: 1, studentId: '2024A8PS0145H', finalStatus: 'Ready', hour: '09:05:00' },
      { outletId: 1, studentId: '2024A3PS0210H', finalStatus: 'Accepted', hour: '12:20:00' },
      { outletId: 1, studentId: '2024A4PS0178H', finalStatus: 'Pending', hour: '12:45:00' },
      { outletId: 2, studentId: '2024A7PS0288H', finalStatus: 'Ready', hour: '12:10:00' },
      { outletId: 2, studentId: '2024A1PS0312H', finalStatus: 'Pending', hour: '12:50:00' },
      { outletId: 3, studentId: '2024AAPS0225H', finalStatus: 'Ready', hour: '10:30:00' },
      { outletId: 3, studentId: '2024AAPS0355H', finalStatus: 'Accepted', hour: '12:40:00' },
      { outletId: 4, studentId: '2024A7PS0401H', finalStatus: 'Pending', hour: '13:05:00' },
      { outletId: 5, studentId: '2024A8PS0422H', finalStatus: 'Ready', hour: '12:30:00' },
      { outletId: 6, studentId: '2024A3PS0467H', finalStatus: 'Ready', hour: '11:00:00' },
      { outletId: 6, studentId: '2024A4PS0509H', finalStatus: 'Pending', hour: '13:10:00' },
    ];

    todayOrdersPlan.forEach((plan, idx) => {
      const token = nextToken(plan.outletId, todayLogical);
      const outletMenu = itemsByOutlet.get(plan.outletId)!;
      const outletExtras = extrasByOutlet.get(plan.outletId)!;
      const item1 = outletMenu[idx % outletMenu.length];
      const item2 = outletMenu[(idx + 1) % outletMenu.length];
      const ex1 = outletExtras[0];
      const ex2 = outletExtras[1];

      const p1 = item1.is_parcelable ? 1 : 0;
      const p2 = item2.is_parcelable ? 1 : 0;
      const total = Number(
        (
          item1.base_price +
          (p1 ? item1.parcel_charge : 0) +
          ex1.price +
          (item2.base_price + (p2 ? item2.parcel_charge : 0) + ex2.price)
        ).toFixed(2)
      );

      insertOrder.run(
        plan.outletId,
        todayLogical,
        token,
        plan.studentId,
        `${todayLogical}T${plan.hour}`,
        'Pending',
        total
      );
      insertOrderItem.run(plan.outletId, todayLogical, token, 1, item1.item_id, 1, p1);
      insertOrderItemExtra.run(plan.outletId, todayLogical, token, 1, ex1.extra_id);
      insertOrderItem.run(plan.outletId, todayLogical, token, 2, item2.item_id, 1, p2);
      insertOrderItemExtra.run(plan.outletId, todayLogical, token, 2, ex2.extra_id);

      if (plan.finalStatus === 'Accepted') {
        updateOrderStatus.run('Accepted', plan.outletId, todayLogical, token);
      } else if (plan.finalStatus === 'Ready') {
        updateOrderStatus.run('Accepted', plan.outletId, todayLogical, token);
        updateOrderStatus.run('Ready', plan.outletId, todayLogical, token);
      }
    });

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
