import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from './database.ts';
import {
  authenticateUser,
  changeUserPassword,
  getDbmsOverview,
  placeOrderTransaction,
  updateOrderStatusTransaction,
  getAvailableMenuForOutlet,
  getStudentNutritionSummary,
} from './queries.ts';

test('database initializes all 9 tables with at least 500 records', () => {
  const overview = getDbmsOverview();
  assert.equal(overview.tableCounts.length, 9);
  assert.ok(
    overview.totalRecords >= 500,
    `Expected >= 500 records across DB, got ${overview.totalRecords}`
  );
});

test('delayed deduction, concurrent order guard, and pending-only cancellation triggers work', () => {
  const db = getDb();
  const studentId = '2024A7PS0530H'; // Nikhil Rao
  const outletId = 2;
  const otherOutletId = 3;

  // Clean up any test leftovers for this student today if re-run
  const beforeStudent = db
    .prepare('SELECT current_balance FROM STUDENT WHERE student_id = ?')
    .get(studentId) as { current_balance: number };

  const menu2 = getAvailableMenuForOutlet(outletId);
  const menu3 = getAvailableMenuForOutlet(otherOutletId);
  assert.ok(menu2.items.length > 0 && menu3.items.length > 0);

  // 1. Place order at outlet 2 -> status Pending, balance UNCHANGED
  const placed = placeOrderTransaction({
    student_id: studentId,
    outlet_id: outletId,
    items: [
      {
        item_id: menu2.items[0].item_id,
        quantity: 1,
        is_parcel: false,
        extra_ids: menu2.extras.length > 0 ? [menu2.extras[0].extra_id] : [],
      },
    ],
  });

  const afterPlaceStudent = db
    .prepare('SELECT current_balance FROM STUDENT WHERE student_id = ?')
    .get(studentId) as { current_balance: number };
  assert.equal(
    afterPlaceStudent.current_balance,
    beforeStudent.current_balance,
    'Balance must NOT be deducted while order is Pending'
  );

  // 2. Concurrent order at SAME outlet 2 must be rejected by trigger
  assert.throws(() => {
    placeOrderTransaction({
      student_id: studentId,
      outlet_id: outletId,
      items: [{ item_id: menu2.items[0].item_id, quantity: 1, is_parcel: false, extra_ids: [] }],
    });
  }, /Concurrent order restriction/);

  // 3. Simultaneous order at DIFFERENT outlet 3 must succeed, and can be cancelled while Pending
  const otherOrder = placeOrderTransaction({
    student_id: studentId,
    outlet_id: otherOutletId,
    items: [{ item_id: menu3.items[0].item_id, quantity: 1, is_parcel: false, extra_ids: [] }],
  });
  const cancelled = updateOrderStatusTransaction(
    otherOutletId,
    otherOrder.logical_date,
    otherOrder.daily_token_number,
    'Cancelled'
  );
  assert.equal(cancelled.status, 'Cancelled');

  const beforeNutrition = getStudentNutritionSummary(studentId, 'day');

  // 4. Accepting order at outlet 2 fires trg_deduct_balance_on_accept
  const accepted = updateOrderStatusTransaction(
    outletId,
    placed.logical_date,
    placed.daily_token_number,
    'Accepted'
  );
  assert.equal(accepted.status, 'Accepted');
  assert.equal(
    accepted.new_student_balance,
    Number((beforeStudent.current_balance - placed.total_amount).toFixed(2))
  );

  const afterAcceptNutrition = getStudentNutritionSummary(studentId, 'day');
  assert.equal(
    afterAcceptNutrition.total_calories,
    beforeNutrition.total_calories + menu2.items[0].calories
  );
  assert.equal(
    afterAcceptNutrition.total_protein,
    Number((beforeNutrition.total_protein + menu2.items[0].protein).toFixed(1))
  );
  assert.equal(
    afterAcceptNutrition.total_fat,
    Number((beforeNutrition.total_fat + menu2.items[0].fat).toFixed(1))
  );

  // 5. Cannot cancel after Accepted
  assert.throws(() => {
    updateOrderStatusTransaction(
      outletId,
      placed.logical_date,
      placed.daily_token_number,
      'Cancelled'
    );
  }, /Invalid order status transition/);

  // 6. Mark Ready so student is unblocked again
  const ready = updateOrderStatusTransaction(
    outletId,
    placed.logical_date,
    placed.daily_token_number,
    'Ready'
  );
  assert.equal(ready.status, 'Ready');
});

test('authenticateUser verifies Student, Outlet, and Union Admin credentials and rejects bad passwords', () => {
  const stu = authenticateUser('student', '2024AAPS0225H', 'student123');
  assert.equal(stu.role, 'student');
  assert.equal(stu.student_id, '2024AAPS0225H');

  const out = authenticateUser('outlet', 'Hotspot', 'outlet123');
  assert.equal(out.role, 'outlet');
  assert.equal(out.outlet_id, 1);

  const adm = authenticateUser('admin', 'ADM001', 'admin123');
  assert.equal(adm.role, 'admin');
  assert.equal(adm.admin_id, 'ADM001');

  assert.throws(() => authenticateUser('student', '2024AAPS0225H', 'wrong'), /Invalid student/);
  assert.throws(() => authenticateUser('outlet', 'Hotspot', 'wrong'), /Invalid outlet/);
  assert.throws(() => authenticateUser('admin', 'ADM001', 'wrong'), /Invalid admin/);

  // Cross-role hint when typing an outlet name on the Student tab
  assert.throws(
    () => authenticateUser('student', 'Hotspot', 'outlet123'),
    /switch the role tab above to "Food Outlet"/
  );

  // Change password for Student and Outlet, verify login with new password, then restore default
  changeUserPassword('student', '2024AAPS0225H', 'student123', 'newpass456');
  assert.equal(authenticateUser('student', '2024AAPS0225H', 'newpass456').student_id, '2024AAPS0225H');
  changeUserPassword('student', '2024AAPS0225H', 'newpass456', 'student123');

  changeUserPassword('outlet', 1, 'outlet123', 'hotpass789');
  assert.equal(authenticateUser('outlet', 'Hotspot', 'hotpass789').outlet_id, 1);
  changeUserPassword('outlet', 1, 'hotpass789', 'outlet123');
});
