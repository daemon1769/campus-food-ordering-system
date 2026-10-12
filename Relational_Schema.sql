-- 1. STUDENT
CREATE TABLE STUDENT(
    student_id VARCHAR2(50),
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) NOT NULL UNIQUE,
    current_balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    CONSTRAINT STUDENT_PK 
        PRIMARY KEY (student_id)
);

-- 2. OUTLET
CREATE TABLE OUTLET(
    outlet_id VARCHAR2(50),
    name VARCHAR2(100) NOT NULL,
    CONSTRAINT OUTLET_PK
        PRIMARY KEY (outlet_id)
);

-- 3. UNION_ADMIN
CREATE TABLE UNION_ADMIN(
    admin_id VARCHAR2(50),
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) NOT NULL UNIQUE,
    CONSTRAINT UNION_ADMIN_PK
        PRIMARY KEY (admin_id)
);

-- 4. OUTLET_PHONE
CREATE TABLE OUTLET_PHONE(
    outlet_id VARCHAR2(50),
    contact_phone VARCHAR2(20),
    CONSTRAINT OUTLET_PHONE_PK
        PRIMARY KEY (outlet_id, contact_phone),
    CONSTRAINT OUTLET_PHONE_OUTLET_FK
        FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id)
            ON DELETE CASCADE
);

-- 5. MENU_ITEM
CREATE TABLE MENU_ITEM(
    item_id VARCHAR2(50),
    outlet_id VARCHAR2(50) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    category VARCHAR2(50),
    diet_type VARCHAR2(20) CHECK (diet_type IN ('Veg', 'Non-Veg')),
    is_available SMALLINT DEFAULT 1 CHECK (is_available IN (0, 1)),
    is_parcelable SMALLINT DEFAULT 1 CHECK (is_parcelable IN (0, 1)),
    parcel_charge DECIMAL(10, 2) DEFAULT 0.00,
    calories INT,
    protein DECIMAL(5, 2),
    CONSTRAINT MENU_ITEM_PK
        PRIMARY KEY (item_id),
    CONSTRAINT MENU_ITEM_OUTLET_FK
        FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id)
            ON DELETE CASCADE
);

-- 6. ITEM_EXTRA
CREATE TABLE ITEM_EXTRA(
    extra_id VARCHAR2(50),
    outlet_id VARCHAR2(50) NOT NULL,
    name VARCHAR2(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    CONSTRAINT ITEM_EXTRA_PK
        PRIMARY KEY (extra_id),
    CONSTRAINT ITEM_EXTRA_OUTLET_FK
        FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id)
            ON DELETE CASCADE
);

-- 7. ORDER
CREATE TABLE "ORDER"(
    outlet_id VARCHAR2(50),
    logical_date DATE,
    daily_token_number INT,
    student_id VARCHAR2(50) NOT NULL,
    actual_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR2(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Ready', 'Rejected', 'Cancelled')),
    total_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    CONSTRAINT ORDER_PK
        PRIMARY KEY (outlet_id, logical_date, daily_token_number),
    CONSTRAINT ORDER_OUTLET_FK
        FOREIGN KEY (outlet_id) REFERENCES OUTLET(outlet_id)
            ON DELETE CASCADE,
    CONSTRAINT ORDER_STUDENT_FK
        FOREIGN KEY (student_id) REFERENCES STUDENT(student_id)
);

-- 8. ORDER_ITEM
CREATE TABLE ORDER_ITEM(
    outlet_id VARCHAR2(50),
    logical_date DATE,
    daily_token_number INT,
    item_seq_no INT,
    item_id VARCHAR2(50) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    is_parcel SMALLINT DEFAULT 0 CHECK (is_parcel IN (0, 1)),
    CONSTRAINT ORDER_ITEM_PK
        PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no),
    CONSTRAINT ORDER_ITEM_ORDER_FK
        FOREIGN KEY (outlet_id, logical_date, daily_token_number) REFERENCES "ORDER"(outlet_id, logical_date, daily_token_number)
            ON DELETE CASCADE,
    CONSTRAINT ORDER_ITEM_MENU_ITEM_FK
        FOREIGN KEY (item_id) REFERENCES MENU_ITEM(item_id)
);

-- 9. ORDER_ITEM_EXTRA
CREATE TABLE ORDER_ITEM_EXTRA(
    outlet_id VARCHAR2(50),
    logical_date DATE,
    daily_token_number INT,
    item_seq_no INT,
    extra_id VARCHAR2(50),
    CONSTRAINT ORDER_ITEM_EXTRA_PK
        PRIMARY KEY (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id),
    CONSTRAINT ORDER_ITEM_EXTRA_ORDER_ITEM_FK
        FOREIGN KEY (outlet_id, logical_date, daily_token_number, item_seq_no) REFERENCES ORDER_ITEM(outlet_id, logical_date, daily_token_number, item_seq_no)
            ON DELETE CASCADE,
    CONSTRAINT ORDER_ITEM_EXTRA_ITEM_EXTRA_FK
        FOREIGN KEY (extra_id) REFERENCES ITEM_EXTRA(extra_id)
            ON DELETE CASCADE
);