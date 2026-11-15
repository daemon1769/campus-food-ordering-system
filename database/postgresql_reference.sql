

CREATE TABLE STUDENT (
  student_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  current_balance NUMERIC(10, 2) NOT NULL DEFAULT 12000.00
);

CREATE TABLE OUTLET (
  outlet_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(120) UNIQUE,
  password_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE OUTLET_PHONE (
  outlet_id INT NOT NULL REFERENCES OUTLET(outlet_id) ON DELETE CASCADE,
  contact_phone VARCHAR(20) NOT NULL,
  PRIMARY KEY (outlet_id, contact_phone)
);

CREATE TABLE MENU_ITEM (
  item_id SERIAL PRIMARY KEY,
  outlet_id INT NOT NULL REFERENCES OUTLET(outlet_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  base_price NUMERIC(8, 2) NOT NULL CHECK (base_price >= 0),
  category VARCHAR(50) NOT NULL,
  diet_type VARCHAR(10) NOT NULL CHECK (diet_type IN ('Veg', 'Non-Veg')),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_parcelable BOOLEAN NOT NULL DEFAULT TRUE,
  parcel_charge NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (parcel_charge >= 0),
  calories INT NOT NULL CHECK (calories >= 0),
  protein NUMERIC(6, 2) NOT NULL CHECK (protein >= 0),
  fat NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (fat >= 0),
  UNIQUE (outlet_id, name)
);

CREATE TABLE ITEM_EXTRA (
  extra_id SERIAL PRIMARY KEY,
  outlet_id INT NOT NULL REFERENCES OUTLET(outlet_id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  price NUMERIC(6, 2) NOT NULL CHECK (price >= 0),
  UNIQUE (outlet_id, name)
);

CREATE TABLE UNION_ADMIN (
  admin_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "ORDER" (
  outlet_id INT NOT NULL REFERENCES OUTLET(outlet_id),
  logical_date DATE NOT NULL,
  daily_token_number INT NOT NULL CHECK (daily_token_number >= 101),
  student_id VARCHAR(20) NOT NULL REFERENCES STUDENT(student_id),
  actual_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(15) NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Accepted', 'Ready', 'Rejected', 'Cancelled')),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  PRIMARY KEY (outlet_id, logical_date, daily_token_number)
);

CREATE TABLE ORDER_ITEM (
  outlet_id INT NOT NULL,
  logical_date DATE NOT NULL,
  daily_token_number INT NOT NULL,
  item_seq_no INT NOT NULL CHECK (item_seq_no >= 1),
  item_id INT NOT NULL REFERENCES MENU_ITEM(item_id),
  quantity INT NOT NULL CHECK (quantity > 0),
  is_parcel BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no),
  FOREIGN KEY (outlet_id, logical_date, daily_token_number)
    REFERENCES "ORDER"(outlet_id, logical_date, daily_token_number) ON DELETE CASCADE
);

CREATE TABLE ORDER_ITEM_EXTRA (
  outlet_id INT NOT NULL,
  logical_date DATE NOT NULL,
  daily_token_number INT NOT NULL,
  item_seq_no INT NOT NULL,
  extra_id INT NOT NULL REFERENCES ITEM_EXTRA(extra_id),
  PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id),
  FOREIGN KEY (outlet_id, logical_date, daily_token_number, item_seq_no)
    REFERENCES ORDER_ITEM(outlet_id, logical_date, daily_token_number, item_seq_no) ON DELETE CASCADE
);


CREATE OR REPLACE FUNCTION fn_logical_date(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE AS $$
BEGIN
  IF EXTRACT(HOUR FROM ts) < 6 THEN
    RETURN (ts::DATE - INTERVAL '1 day')::DATE;
  END IF;
  RETURN ts::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


CREATE OR REPLACE FUNCTION fn_deduct_balance_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'Pending' AND NEW.status = 'Accepted' THEN
    UPDATE STUDENT
    SET current_balance = current_balance - NEW.total_amount
    WHERE student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_balance_on_accept
AFTER UPDATE OF status ON "ORDER"
FOR EACH ROW
EXECUTE FUNCTION fn_deduct_balance_on_accept();
