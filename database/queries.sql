
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


SELECT
  s.student_id,
  s.name,
  s.email,
  ROUND(s.current_balance, 2) AS current_balance,
  12000.0 AS initial_deposit,
  COUNT(o.daily_token_number) AS total_orders,
  COALESCE(ROUND(SUM(CASE WHEN o.status IN ('Accepted', 'Ready') THEN o.total_amount ELSE 0 END), 2), 0) AS completed_expenditure
FROM STUDENT s
LEFT JOIN "ORDER" o ON o.student_id = s.student_id
GROUP BY s.student_id, s.name, s.email, s.current_balance
ORDER BY completed_expenditure DESC, s.student_id ASC;
