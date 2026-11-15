

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;


INSERT OR IGNORE INTO UNION_ADMIN (admin_id, name, email, password_hash) VALUES
  ('ADM001', 'Singireddy Hrushikesh Reddy', 'f20240239@hyderabad.bits-pilani.ac.in', ''),
  ('ADM002', 'Kartikey Gaur', 'f20240225@hyderabad.bits-pilani.ac.in', ''),
  ('ADM003', 'Deeptimahanti Aashrith', 'f20240189@hyderabad.bits-pilani.ac.in', ''),
  ('ADM004', 'Aryaman Ray', 'f20240227@hyderabad.bits-pilani.ac.in', ''),
  ('ADM005', 'Kothapalli Manobhiram Reddy', 'f20240240@hyderabad.bits-pilani.ac.in', '');


INSERT OR IGNORE INTO STUDENT (student_id, name, email, password_hash, current_balance) VALUES
  ('2024AAPS0225H', 'Kartikey Gaur', 'kartikey.gaur@campus.edu', '', 12000.0),
  ('2024AAPS0239H', 'Singireddy Hrushikesh', 'hrushikesh.r@campus.edu', '', 12000.0),
  ('2024AAPS0189H', 'Deeptimahanti Aashrith', 'aashrith.d@campus.edu', '', 12000.0),
  ('2024AAPS0227H', 'Aryaman Ray', 'aryaman.ray@campus.edu', '', 12000.0),
  ('2024AAPS0240H', 'Kothapalli Manobhiram', 'manobhiram.k@campus.edu', '', 12000.0),
  ('2024A7PS0101H', 'Rohan Verma (Debt Case)', 'rohan.verma@campus.edu', '', 150.0);


INSERT OR IGNORE INTO OUTLET (outlet_id, name, email, password_hash) VALUES
  (1, 'Hotspot', 'hotspot@campus.edu', ''),
  (2, 'Protein Isle', 'proteinisle@campus.edu', ''),
  (3, 'Yumppies', 'yumppies@campus.edu', ''),
  (4, 'Dominos', 'dominos@campus.edu', ''),
  (5, 'Subway', 'subway@campus.edu', ''),
  (6, 'Sereno', 'sereno@campus.edu', '');


INSERT OR IGNORE INTO OUTLET_PHONE (outlet_id, contact_phone) VALUES
  (1, '+91-9849011001'), (1, '+91-4023451001'),
  (2, '+91-9849011002'), (2, '+91-4023451002'),
  (3, '+91-9849011003'), (3, '+91-4023451003'),
  (4, '+91-9849011004'), (4, '+91-4023451004'),
  (5, '+91-9849011005'), (5, '+91-4023451005'),
  (6, '+91-9849011006'), (6, '+91-4023451006');


INSERT OR IGNORE INTO MENU_ITEM
  (item_id, outlet_id, name, base_price, category, diet_type, is_available, is_parcelable, parcel_charge, calories, protein, fat)
VALUES
  (1, 1, 'Hotspot Classic Maggi', 50, 'Snacks', 'Veg', 1, 1, 10, 360, 8.5, 14.0),
  (2, 1, 'Paneer Masala Roll', 90, 'Snacks', 'Veg', 1, 1, 10, 480, 18.0, 19.0),
  (3, 1, 'Chicken Tikka Roll', 120, 'Snacks', 'Non-Veg', 1, 1, 10, 540, 26.0, 21.0),
  (4, 2, 'Grilled Paneer Protein Bowl', 165, 'Meals', 'Veg', 1, 1, 15, 520, 32.0, 18.0),
  (5, 2, 'Grilled Chicken Breast Bowl', 190, 'Meals', 'Non-Veg', 1, 1, 15, 480, 46.0, 10.5),
  (6, 3, 'Veg Fried Rice', 100, 'Rice', 'Veg', 1, 1, 15, 560, 12.0, 16.5),
  (7, 3, 'Chicken Hakka Noodles', 140, 'Snacks', 'Non-Veg', 1, 1, 15, 620, 24.0, 19.0),
  (8, 4, 'Margherita Personal Pizza', 119, 'Meals', 'Veg', 1, 1, 15, 580, 19.0, 22.0),
  (9, 5, 'Roasted Chicken Breast Sub', 185, 'Meals', 'Non-Veg', 1, 1, 10, 410, 29.0, 9.0),
  (10, 6, 'Masala Dosa', 60, 'Tiffin', 'Veg', 1, 1, 10, 380, 9.5, 13.0);


INSERT OR IGNORE INTO ITEM_EXTRA (extra_id, outlet_id, name, price) VALUES
  (1, 1, 'Amul Butter', 15),
  (2, 1, 'Extra Cheese', 20),
  (3, 2, 'Chia Seeds Boost', 15),
  (4, 3, 'Schezwan Dip', 15),
  (5, 4, 'Extra Mozzarella Cheese', 30),
  (6, 5, 'Extra Cheese Slice', 20),
  (7, 6, 'Extra Ghee', 20);


INSERT OR IGNORE INTO "ORDER"
  (outlet_id, logical_date, daily_token_number, student_id, actual_timestamp, status, total_amount)
VALUES
  (1, '2026-11-13', 101, '2024AAPS0225H', '2026-11-13T12:15:00', 'Pending', 140.0),
  (2, '2026-11-13', 101, '2024AAPS0239H', '2026-11-13T13:10:00', 'Pending', 220.0),
  (4, '2026-11-14', 101, '2024A7PS0101H', '2026-11-14T19:30:00', 'Pending', 164.0),
  (6, '2026-11-14', 101, '2024AAPS0189H', '2026-11-14T20:10:00', 'Pending', 90.0);

INSERT OR IGNORE INTO ORDER_ITEM
  (outlet_id, logical_date, daily_token_number, item_seq_no, item_id, quantity, is_parcel)
VALUES
  (1, '2026-11-13', 101, 1, 2, 1, 1),  
  (2, '2026-11-13', 101, 1, 5, 1, 1), 
  (4, '2026-11-14', 101, 1, 8, 1, 1),  
  (6, '2026-11-14', 101, 1, 10, 1, 1); 


UPDATE "ORDER" SET total_amount = 135.0
WHERE outlet_id = 1 AND logical_date = '2026-11-13' AND daily_token_number = 101;

INSERT OR IGNORE INTO ORDER_ITEM_EXTRA
  (outlet_id, logical_date, daily_token_number, item_seq_no, extra_id)
VALUES
  (1, '2026-11-13', 101, 1, 1),
  (1, '2026-11-13', 101, 1, 2),
  (2, '2026-11-13', 101, 1, 3),
  (4, '2026-11-14', 101, 1, 5),
  (6, '2026-11-14', 101, 1, 7);


UPDATE "ORDER" SET status = 'Accepted'
WHERE outlet_id = 1 AND logical_date = '2026-11-13' AND daily_token_number = 101 AND status = 'Pending';
UPDATE "ORDER" SET status = 'Ready'
WHERE outlet_id = 1 AND logical_date = '2026-11-13' AND daily_token_number = 101 AND status = 'Accepted';

UPDATE "ORDER" SET status = 'Accepted'
WHERE outlet_id = 2 AND logical_date = '2026-11-13' AND daily_token_number = 101 AND status = 'Pending';
UPDATE "ORDER" SET status = 'Ready'
WHERE outlet_id = 2 AND logical_date = '2026-11-13' AND daily_token_number = 101 AND status = 'Accepted';


UPDATE "ORDER" SET status = 'Accepted'
WHERE outlet_id = 4 AND logical_date = '2026-11-14' AND daily_token_number = 101 AND status = 'Pending';

COMMIT;
