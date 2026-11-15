
CREATE TRIGGER IF NOT EXISTS trg_prevent_concurrent_outlet_order
BEFORE INSERT ON "ORDER"
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM "ORDER" o
  WHERE o.student_id = NEW.student_id
    AND o.outlet_id = NEW.outlet_id
    AND o.status IN ('Pending', 'Accepted')
)
BEGIN
  SELECT RAISE(ABORT, 'Concurrent order restriction: You already have an active (Pending/Accepted) order at this outlet.');
END;


CREATE TRIGGER IF NOT EXISTS trg_validate_order_status_transition
BEFORE UPDATE OF status ON "ORDER"
FOR EACH ROW
WHEN NOT (
  (OLD.status = 'Pending' AND NEW.status IN ('Accepted', 'Rejected', 'Cancelled')) OR
  (OLD.status = 'Accepted' AND NEW.status = 'Ready')
)
BEGIN
  SELECT RAISE(ABORT, 'Invalid order status transition.');
END;


CREATE TRIGGER IF NOT EXISTS trg_deduct_balance_on_accept
AFTER UPDATE OF status ON "ORDER"
FOR EACH ROW
WHEN OLD.status = 'Pending' AND NEW.status = 'Accepted'
BEGIN
  UPDATE STUDENT
  SET current_balance = ROUND(current_balance - NEW.total_amount, 2)
  WHERE student_id = NEW.student_id;
END;


DROP VIEW IF EXISTS v_available_menu;
CREATE VIEW v_available_menu AS
SELECT
  m.item_id,
  m.outlet_id,
  o.name AS outlet_name,
  m.name,
  m.base_price,
  m.category,
  m.diet_type,
  m.is_parcelable,
  m.parcel_charge,
  m.calories,
  m.protein,
  m.fat
FROM MENU_ITEM m
JOIN OUTLET o ON o.outlet_id = m.outlet_id
WHERE m.is_available = 1;


DROP VIEW IF EXISTS v_order_details;
CREATE VIEW v_order_details AS
SELECT
  ord.outlet_id,
  outl.name AS outlet_name,
  ord.logical_date,
  ord.daily_token_number,
  ord.student_id,
  stu.name AS student_name,
  ord.actual_timestamp,
  ord.status,
  ord.total_amount,
  oi.item_seq_no,
  mi.item_id,
  mi.name AS item_name,
  mi.category,
  mi.diet_type,
  mi.base_price,
  mi.parcel_charge,
  mi.calories,
  mi.protein,
  mi.fat,
  oi.quantity,
  oi.is_parcel
FROM "ORDER" ord
JOIN OUTLET outl ON outl.outlet_id = ord.outlet_id
JOIN STUDENT stu ON stu.student_id = ord.student_id
JOIN ORDER_ITEM oi
  ON oi.outlet_id = ord.outlet_id
  AND oi.logical_date = ord.logical_date
  AND oi.daily_token_number = ord.daily_token_number
JOIN MENU_ITEM mi ON mi.item_id = oi.item_id;


CREATE VIEW IF NOT EXISTS v_outlet_revenue_summary AS
SELECT
  o.outlet_id,
  o.name AS outlet_name,
  ord.logical_date,
  COUNT(*) AS accepted_order_count,
  ROUND(SUM(ord.total_amount), 2) AS total_revenue
FROM OUTLET o
JOIN "ORDER" ord ON ord.outlet_id = o.outlet_id
WHERE ord.status IN ('Accepted', 'Ready')
GROUP BY o.outlet_id, o.name, ord.logical_date;
