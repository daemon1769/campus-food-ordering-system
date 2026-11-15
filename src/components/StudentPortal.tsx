import React, { useEffect, useState, useMemo } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import type {
  Student,
  Outlet,
  MenuItem,
  ItemExtra,
  OrderRecord,
  StudentNutritionSummary,
} from '../types.ts';
import { computeCartSummary, formatINR } from '../utils/campusRules.ts';
import { apiFetch } from '../utils/apiFetch.ts';

interface CartItem {
  item: MenuItem;
  quantity: number;
  is_parcel: boolean;
  extra_ids: number[];
}

interface StudentPortalProps {
  students: Student[];
  outlets: Outlet[];
  logicalDate: string;
  lockedStudentId?: string;
  onDataMutated: () => void;
}

export function StudentPortal({
  students,
  outlets,
  logicalDate,
  lockedStudentId,
  onDataMutated,
}: StudentPortalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    lockedStudentId ??
      students.find((s) => s.student_id === '2024AAPS0225H')?.student_id ??
      students[0]?.student_id ??
      '2024AAPS0225H'
  );
  const [selectedOutletId, setSelectedOutletId] = useState<number>(outlets[0]?.outlet_id ?? 1);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    if (lockedStudentId) {
      setSelectedStudentId(lockedStudentId);
    } else if (students.length > 0 && !students.some((s) => s.student_id === selectedStudentId)) {
      setSelectedStudentId(students[0].student_id);
    }
  }, [lockedStudentId, students, selectedStudentId]);

  useEffect(() => {
    if (outlets.length > 0 && !outlets.some((o) => o.outlet_id === selectedOutletId)) {
      setSelectedOutletId(outlets[0].outlet_id);
    }
  }, [outlets, selectedOutletId]);

  const [studentInfo, setStudentInfo] = useState<Student | null>(null);
  const [summary, setSummary] = useState<StudentNutritionSummary | null>(null);
  const [dailyNutrition, setDailyNutrition] = useState<StudentNutritionSummary | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [outletExtras, setOutletExtras] = useState<ItemExtra[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [dietFilter, setDietFilter] = useState<'All' | 'Veg' | 'Non-Veg'>('All');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loadingDash, setLoadingDash] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inline Change Password state
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  const loadStudentDashboard = async (stuId: string, per: 'day' | 'week' | 'month') => {
    setLoadingDash(true);
    try {
      const res = await apiFetch(`/api/student/${encodeURIComponent(stuId)}/dashboard?period=${per}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load student dashboard');
      setStudentInfo(data.student);
      setSummary(data.summary);
      setDailyNutrition(data.dailyNutrition ?? data.summary ?? null);
      setOrders(data.orders);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoadingDash(false);
    }
  };

  const loadOutletMenu = async (outletId: number) => {
    try {
      const res = await apiFetch(`/api/outlets/${outletId}/menu`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load menu');
      setMenuItems(data.items);
      setOutletExtras(data.extras);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDashboard(selectedStudentId, period);
    }
  }, [selectedStudentId, period]);

  useEffect(() => {
    if (selectedOutletId) {
      loadOutletMenu(selectedOutletId);
      setCart([]);
      setCategoryFilter('All');
    }
  }, [selectedOutletId]);

  const categories = useMemo(() => {
    const set = new Set(menuItems.map((m) => m.category));
    return ['All', ...Array.from(set)];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (dietFilter !== 'All' && item.diet_type !== dietFilter) return false;
      return true;
    });
  }, [menuItems, categoryFilter, dietFilter]);

  const cartSummary = useMemo(() => {
    const extrasMap = new Map(outletExtras.map((e) => [e.extra_id, e]));
    return computeCartSummary(
      cart.map((c) => ({
        base_price: c.item.base_price,
        is_parcelable: c.item.is_parcelable === 1,
        parcel_charge: c.item.parcel_charge,
        is_parcel: c.is_parcel,
        quantity: c.quantity,
        calories: c.item.calories,
        protein: c.item.protein,
        fat: c.item.fat,
        extras: c.extra_ids.map((id) => ({ price: extrasMap.get(id)?.price ?? 0 })),
      }))
    );
  }, [cart, outletExtras]);

  const addToCart = (item: MenuItem) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCart((prev) => {
      const idx = prev.findIndex(
        (c) => c.item.item_id === item.item_id && !c.is_parcel && c.extra_ids.length === 0
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { item, quantity: 1, is_parcel: false, extra_ids: [] }];
    });
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c, i) => (i === index ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const toggleCartParcel = (index: number) => {
    setCart((prev) =>
      prev.map((c, i) =>
        i === index && c.item.is_parcelable === 1 ? { ...c, is_parcel: !c.is_parcel } : c
      )
    );
  };

  const toggleCartExtra = (index: number, extraId: number) => {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const exists = c.extra_ids.includes(extraId);
        return {
          ...c,
          extra_ids: exists
            ? c.extra_ids.filter((id) => id !== extraId)
            : [...c.extra_ids, extraId],
        };
      })
    );
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudentId,
          outlet_id: selectedOutletId,
          items: cart.map((c) => ({
            item_id: c.item.item_id,
            quantity: c.quantity,
            is_parcel: c.is_parcel,
            extra_ids: c.extra_ids,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }
      setCart([]);
      setSuccessMsg(
        `Order placed! Daily Token #${data.daily_token_number} (${data.logical_date}) · Status: Pending · Amount ${formatINR(data.total_amount)} will be deducted only when the outlet accepts.`
      );
      await loadStudentDashboard(selectedStudentId, period);
      onDataMutated();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (ord: OrderRecord) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(
        `/api/orders/${ord.outlet_id}/${ord.logical_date}/${ord.daily_token_number}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Cancelled' }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel order');
      setSuccessMsg(
        `Order #${ord.daily_token_number} at ${ord.outlet_name} cancelled while Pending.`
      );
      await loadStudentDashboard(selectedStudentId, period);
      onDataMutated();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setChangingPassword(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
      setSuccessMsg('Student password updated! Use your new password the next time you sign in.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  };

  const currentOutlet = outlets.find((o) => o.outlet_id === selectedOutletId);
  const balance = studentInfo?.current_balance ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Student Selection & Ledger Summary Row */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            {lockedStudentId ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {studentInfo?.name ?? lockedStudentId}
                </span>
                <span className="text-xs font-mono text-slate-600">{lockedStudentId}</span>
                {studentInfo && (
                  <span className="text-xs text-slate-500">· {studentInfo.email}</span>
                )}
              </div>
            ) : (
              <>
                <label
                  htmlFor="student-select"
                  className="text-sm font-semibold text-slate-700 whitespace-nowrap"
                >
                  Active Student
                </label>
                <select
                  id="student-select"
                  value={selectedStudentId}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setSelectedStudentId(e.target.value);
                  }}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.name} ({s.student_id})
                    </option>
                  ))}
                </select>
                {studentInfo && (
                  <span className="text-xs text-slate-500">{studentInfo.email}</span>
                )}
              </>
            )}

            {/* Inline Change Password Control at the exact header zone */}
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setShowPasswordForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </button>
            ) : (
              <form
                onSubmit={handleChangePassword}
                className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5"
              >
                <input
                  type="password"
                  required
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-900 w-36"
                />
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder="New password (4+ chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded text-slate-900 w-40"
                />
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded cursor-pointer"
                >
                  {changingPassword ? 'Saving...' : 'Update'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                  className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'day' ? 'Today (Logical Day)' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* 4-column KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div>
            <p className="text-xs font-medium text-slate-500">Semester Ledger Balance</p>
            <p
              data-testid="student-balance"
              className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
                balance < 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {formatINR(balance)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {balance < 0
                ? 'Accumulated semester debt (negative allowed)'
                : 'Initial deposit ₹12,000 · Delayed deduction'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">
              Expenditure ({period === 'day' ? 'Today' : period === 'week' ? '7 Days' : '30 Days'})
            </p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loadingDash ? '...' : formatINR(summary?.total_spent ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {summary?.order_count ?? 0} accepted/ready orders
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Calories Consumed</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loadingDash ? '...' : `${(summary?.total_calories ?? 0).toLocaleString('en-IN')} kcal`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">From accepted &amp; ready orders</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Protein Intake</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loadingDash ? '...' : `${summary?.total_protein ?? 0} g`}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Logical date {logicalDate}</p>
          </div>
        </div>
      </section>

      {/* Current Day Nutrition Summary Card */}
      <section
        data-testid="daily-nutrition-card"
        className="bg-white border border-slate-200 rounded-lg p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Nutrition Summary
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Current logical day ({logicalDate}) total calories, protein, and fat from accepted &amp;
              ready orders
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {loadingDash ? '...' : `${dailyNutrition?.order_count ?? 0} qualifying order(s) today`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-xs font-medium text-slate-500">Total Calories (Today)</p>
            <p
              data-testid="daily-calories"
              className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900"
            >
              {loadingDash
                ? '...'
                : `${(dailyNutrition?.total_calories ?? 0).toLocaleString('en-IN')} kcal`}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-xs font-medium text-slate-500">Total Protein (Today)</p>
            <p
              data-testid="daily-protein"
              className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900"
            >
              {loadingDash ? '...' : `${dailyNutrition?.total_protein ?? 0} g`}
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-xs font-medium text-slate-500">Total Fat (Today)</p>
            <p
              data-testid="daily-fat"
              className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900"
            >
              {loadingDash ? '...' : `${dailyNutrition?.total_fat ?? 0} g`}
            </p>
          </div>
        </div>
      </section>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-lg text-sm"
        >
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Split: Outlet Menu Browser (Left 2 cols) + Order Cart (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h2 className="text-base font-semibold text-slate-900">Browse Outlet Menu</h2>
              {currentOutlet && (
                <p className="text-xs text-slate-500">
                  Available items only · Contact: {currentOutlet.phones.join(' / ')}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="outlet-browse-select" className="sr-only">
                  Select Outlet
                </label>
                <select
                  id="outlet-browse-select"
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                >
                  {outlets.map((o) => (
                    <option key={o.outlet_id} value={o.outlet_id}>
                      {o.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="category-filter" className="sr-only">
                  Filter by Category
                </label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'All' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                {(['All', 'Veg', 'Non-Veg'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDietFilter(d)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      dietFilter === d
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredMenu.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No available items match this filter at {currentOutlet?.name}.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredMenu.map((item) => (
                <div
                  key={item.item_id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                      <span
                        className={`text-xs font-medium ${
                          item.diet_type === 'Veg' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {item.diet_type}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.calories} kcal</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.protein}g protein</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.fat}g fat</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.is_parcelable === 1
                          ? `Parcel +${formatINR(item.parcel_charge)}`
                          : 'Dine-in only'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {formatINR(item.base_price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {outletExtras.length > 0 && (
            <div className="pt-3 border-t border-slate-200 text-xs text-slate-600">
              <span className="font-medium text-slate-700">
                Dietary-Neutral Extras at this outlet (available for both Veg &amp; Non-Veg):
              </span>{' '}
              {outletExtras.map((ex) => `${ex.name} (${formatINR(ex.price)})`).join(' · ')}
            </div>
          )}
        </section>

        {/* Order Cart Panel */}
        <aside className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-700" />
              <span>Order Cart</span>
            </h2>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Select menu items from {currentOutlet?.name} to start an order.
            </p>
          ) : (
            <div className="space-y-4">
              {cart.map((line, idx) => (
                <div key={`${line.item.item_id}-${idx}`} className="pb-3 border-b border-slate-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{line.item.name}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        Base {formatINR(line.item.base_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${line.item.name}`}
                        onClick={() => updateCartQty(idx, -1)}
                        className="p-1.5 border border-slate-300 rounded hover:bg-slate-100"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-mono tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.item.name}`}
                        onClick={() => updateCartQty(idx, 1)}
                        className="p-1.5 border border-slate-300 rounded hover:bg-slate-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${line.item.name} from cart`}
                        onClick={() => updateCartQty(idx, -line.quantity)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {line.item.is_parcelable === 1 && (
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={line.is_parcel}
                        onChange={() => toggleCartParcel(idx)}
                        className="rounded border-slate-300"
                      />
                      <span>
                        Pack as Parcel (+{formatINR(line.item.parcel_charge)} per unit)
                      </span>
                    </label>
                  )}

                  {outletExtras.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs font-medium text-slate-600">Neutral Add-ons:</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {outletExtras.map((ex) => (
                          <label
                            key={ex.extra_id}
                            className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={line.extra_ids.includes(ex.extra_id)}
                              onChange={() => toggleCartExtra(idx, ex.extra_id)}
                              className="rounded border-slate-300"
                            />
                            <span>
                              {ex.name} (+{formatINR(ex.price)})
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="space-y-1.5 text-sm">
                <div className="space-y-0.5 text-slate-600 text-xs">
                  <span className="block">Estimated Nutrition</span>
                  <span className="block font-mono tabular-nums text-slate-800">
                    {cartSummary.totalCalories} kcal · {cartSummary.totalProtein}g protein ·{' '}
                    {cartSummary.totalFat}g fat
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 pt-1">
                  <span>Order Total</span>
                  <span className="font-mono tabular-nums">{formatINR(cartSummary.totalAmount)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handlePlaceOrder}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors"
              >
                {submitting ? 'Placing Order...' : `Place Order at ${currentOutlet?.name}`}
              </button>
              <p className="text-xs text-slate-500">
                Note: Only one active (Pending/Accepted) order per outlet is permitted. Balance is
                deducted only upon outlet acceptance.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Student Orders History */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            My Orders &amp; Daily Tokens
          </h2>
          <span className="text-xs text-slate-500">
            Cancel allowed only while status is Pending
          </span>
        </div>

        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No orders placed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Token</th>
                  <th className="py-2.5 pr-4">Logical Date</th>
                  <th className="py-2.5 pr-4">Outlet</th>
                  <th className="py-2.5 pr-4">Items &amp; Extras</th>
                  <th className="py-2.5 pr-4 text-right">Amount</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((ord) => (
                  <tr
                    key={`${ord.outlet_id}-${ord.logical_date}-${ord.daily_token_number}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="py-2.5 pr-4 font-mono font-semibold tabular-nums text-slate-900">
                      #{ord.daily_token_number}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-xs text-slate-600">
                      {ord.logical_date}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{ord.outlet_name}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {ord.items
                        .map((it) => {
                          const extrasText =
                            it.extras.length > 0
                              ? ` [${it.extras.map((e) => e.name).join(', ')}]`
                              : '';
                          const parcelText = it.is_parcel ? ' (Parcel)' : '';
                          return `${it.quantity}× ${it.item_name}${parcelText}${extrasText}`;
                        })
                        .join('; ')}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatINR(ord.total_amount)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`text-xs font-semibold ${
                          ord.status === 'Ready'
                            ? 'text-emerald-700'
                            : ord.status === 'Accepted'
                              ? 'text-indigo-700'
                              : ord.status === 'Pending'
                                ? 'text-amber-700'
                                : 'text-red-700'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {ord.status === 'Pending' ? (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(ord)}
                          className="px-2.5 py-1 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded whitespace-nowrap"
                        >
                          Cancel Order
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
