import type { OrderStatus } from '../types.ts';

export const INITIAL_SEMESTER_DEPOSIT = 12000;

/**
 * Computes the Campus "Logical Day" boundary (YYYY-MM-DD).
 * Operational day runs from 6:00 AM to 3:59 AM the following calendar day.
 * Any timestamp between 00:00 and 05:59 belongs to the previous calendar day's logical date.
 */
export function computeLogicalDate(date: Date = new Date()): string {
  const local = new Date(date.getTime());
  if (local.getHours() < 6) {
    local.setDate(local.getDate() - 1);
  }
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface CartLineInput {
  base_price: number;
  is_parcelable: boolean;
  parcel_charge: number;
  is_parcel: boolean;
  quantity: number;
  calories: number;
  protein: number;
  fat?: number;
  extras: { price: number }[];
}

export function computeLineAmount(line: CartLineInput): number {
  if (line.quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }
  if (line.is_parcel && !line.is_parcelable) {
    throw new Error('This menu item is not available for parcel.');
  }
  const extrasSum = line.extras.reduce((sum, ex) => sum + Number(ex.price || 0), 0);
  const parcelFee = line.is_parcel && line.is_parcelable ? Number(line.parcel_charge || 0) : 0;
  const unitPrice = Number(line.base_price) + parcelFee + extrasSum;
  return Number((unitPrice * line.quantity).toFixed(2));
}

export function computeCartSummary(lines: CartLineInput[]): {
  totalAmount: number;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
} {
  let totalAmount = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;

  for (const line of lines) {
    totalAmount += computeLineAmount(line);
    totalCalories += Number(line.calories) * line.quantity;
    totalProtein += Number(line.protein) * line.quantity;
    totalFat += Number(line.fat ?? 0) * line.quantity;
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    totalCalories: Math.round(totalCalories),
    totalProtein: Number(totalProtein.toFixed(1)),
    totalFat: Number(totalFat.toFixed(1)),
  };
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Pending: ['Accepted', 'Rejected', 'Cancelled'],
  Accepted: ['Ready'],
  Ready: [],
  Rejected: [],
  Cancelled: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function formatINR(amount: number): string {
  const num = Number(amount || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}₹${Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
