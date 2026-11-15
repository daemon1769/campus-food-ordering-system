import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLogicalDate,
  computeLineAmount,
  computeCartSummary,
  canTransitionOrderStatus,
  formatINR,
} from './campusRules.ts';

test('computeLogicalDate keeps same date at 06:00 AM and later', () => {
  const morning = new Date(2026, 10, 14, 6, 0, 0); // Nov 14 2026, 06:00
  const night = new Date(2026, 10, 14, 23, 59, 0); // Nov 14 2026, 23:59
  assert.equal(computeLogicalDate(morning), '2026-11-14');
  assert.equal(computeLogicalDate(night), '2026-11-14');
});

test('computeLogicalDate rolls back to previous date between 00:00 and 05:59 AM', () => {
  const afterMidnight = new Date(2026, 10, 15, 1, 30, 0); // Nov 15 2026, 01:30 AM
  const justBeforeClose = new Date(2026, 10, 15, 3, 59, 0); // Nov 15 2026, 03:59 AM
  assert.equal(computeLogicalDate(afterMidnight), '2026-11-14');
  assert.equal(computeLogicalDate(justBeforeClose), '2026-11-14');
});

test('computeLineAmount and computeCartSummary include parcel charges and neutral extras', () => {
  const summary = computeCartSummary([
    {
      base_price: 80,
      is_parcelable: true,
      parcel_charge: 10,
      is_parcel: true,
      quantity: 2,
      calories: 450,
      protein: 14.5,
      fat: 16,
      extras: [{ price: 20 }, { price: 10 }],
    },
    {
      base_price: 40,
      is_parcelable: false,
      parcel_charge: 0,
      is_parcel: false,
      quantity: 1,
      calories: 180,
      protein: 4,
      fat: 6.5,
      extras: [],
    },
  ]);

  // Line 1: (80 + 10 + 20 + 10) * 2 = 240; Line 2: 40 * 1 = 40; Total = 280
  assert.equal(summary.totalAmount, 280);
  assert.equal(summary.totalCalories, 450 * 2 + 180);
  assert.equal(summary.totalProtein, 14.5 * 2 + 4);
  assert.equal(summary.totalFat, 16 * 2 + 6.5);
});

test('computeLineAmount rejects parcel on non-parcelable item', () => {
  assert.throws(
    () =>
      computeLineAmount({
        base_price: 50,
        is_parcelable: false,
        parcel_charge: 0,
        is_parcel: true,
        quantity: 1,
        calories: 200,
        protein: 5,
        extras: [],
      }),
    /not available for parcel/
  );
});

test('canTransitionOrderStatus enforces strict finite state machine', () => {
  assert.equal(canTransitionOrderStatus('Pending', 'Accepted'), true);
  assert.equal(canTransitionOrderStatus('Pending', 'Rejected'), true);
  assert.equal(canTransitionOrderStatus('Pending', 'Cancelled'), true);
  assert.equal(canTransitionOrderStatus('Pending', 'Ready'), false);
  assert.equal(canTransitionOrderStatus('Accepted', 'Ready'), true);
  assert.equal(canTransitionOrderStatus('Accepted', 'Cancelled'), false);
  assert.equal(canTransitionOrderStatus('Ready', 'Cancelled'), false);
});

test('formatINR formats positive and negative debt balances cleanly', () => {
  assert.equal(formatINR(12000), '₹12,000');
  assert.equal(formatINR(-450.5), '-₹450.5');
});
