

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS STUDENT (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',

  current_balance REAL NOT NULL DEFAULT 12000.0
);

CREATE TABLE IF NOT EXISTS OUTLET (
  outlet_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL DEFAULT ''
);


CREATE TABLE IF NOT EXISTS OUTLET_PHONE (
  outlet_id INTEGER NOT NULL,
  contact_phone TEXT NOT NULL,
  PRIMARY KEY (outlet_id, contact_phone),
  FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS MENU_ITEM (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  base_price REAL NOT NULL CHECK (base_price >= 0),
  category TEXT NOT NULL,
  diet_type TEXT NOT NULL CHECK (diet_type IN ('Veg', 'Non-Veg')),
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  is_parcelable INTEGER NOT NULL DEFAULT 1 CHECK (is_parcelable IN (0, 1)),
  parcel_charge REAL NOT NULL DEFAULT 0 CHECK (parcel_charge >= 0),
  calories INTEGER NOT NULL CHECK (calories >= 0),
  protein REAL NOT NULL CHECK (protein >= 0),
  fat REAL NOT NULL DEFAULT 0 CHECK (fat >= 0),
  UNIQUE (outlet_id, name),
  FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS ITEM_EXTRA (
  extra_id INTEGER PRIMARY KEY AUTOINCREMENT,
  outlet_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  UNIQUE (outlet_id, name),
  FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS UNION_ADMIN (
  admin_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT ''
);


CREATE TABLE IF NOT EXISTS "ORDER" (
  outlet_id INTEGER NOT NULL,
  logical_date TEXT NOT NULL,
  daily_token_number INTEGER NOT NULL CHECK (daily_token_number >= 101),
  student_id TEXT NOT NULL,
  actual_timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Accepted', 'Ready', 'Rejected', 'Cancelled')),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  PRIMARY KEY (outlet_id, logical_date, daily_token_number),
  FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS ORDER_ITEM (
  outlet_id INTEGER NOT NULL,
  logical_date TEXT NOT NULL,
  daily_token_number INTEGER NOT NULL,
  item_seq_no INTEGER NOT NULL CHECK (item_seq_no >= 1),
  item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  is_parcel INTEGER NOT NULL DEFAULT 0 CHECK (is_parcel IN (0, 1)),
  PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no),
  FOREIGN KEY (outlet_id, logical_date, daily_token_number)
    REFERENCES "ORDER"(outlet_id, logical_date, daily_token_number) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES MENU_ITEM(item_id) ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS ORDER_ITEM_EXTRA (
  outlet_id INTEGER NOT NULL,
  logical_date TEXT NOT NULL,
  daily_token_number INTEGER NOT NULL,
  item_seq_no INTEGER NOT NULL,
  extra_id INTEGER NOT NULL,
  PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id),
  FOREIGN KEY (outlet_id, logical_date, daily_token_number, item_seq_no)
    REFERENCES ORDER_ITEM(outlet_id, logical_date, daily_token_number, item_seq_no) ON DELETE CASCADE,
  FOREIGN KEY (extra_id) REFERENCES ITEM_EXTRA(extra_id) ON DELETE RESTRICT
);


CREATE INDEX IF NOT EXISTS idx_order_student_logical_date
  ON "ORDER"(student_id, logical_date, status);

CREATE INDEX IF NOT EXISTS idx_order_outlet_status_date
  ON "ORDER"(outlet_id, status, logical_date);

CREATE INDEX IF NOT EXISTS idx_menu_item_outlet_available
  ON MENU_ITEM(outlet_id, is_available, category, diet_type);

CREATE INDEX IF NOT EXISTS idx_order_item_item_id
  ON ORDER_ITEM(item_id);
