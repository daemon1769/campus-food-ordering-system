import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import type { Outlet, OrderRecord, MenuItem, OutletAnalytics, OrderStatus } from '../types.ts';
import { formatINR } from '../utils/campusRules.ts';
import { apiFetch } from '../utils/apiFetch.ts';

interface OutletPortalProps {
  outlets: Outlet[];
  lockedOutletId?: number;
  onDataMutated: () => void;
}

export function OutletPortal({ outlets, lockedOutletId, onDataMutated }: OutletPortalProps) {
  const [selectedOutletId, setSelectedOutletId] = useState<number>(
    lockedOutletId ?? outlets[0]?.outlet_id ?? 1
  );
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [analytics, setAnalytics] = useState<OutletAnalytics | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inline Change Password state
  const [showPasswordForm, setShowPasswordForm] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  useEffect(() => {
    if (lockedOutletId !== undefined) {
      setSelectedOutletId(lockedOutletId);
    } else if (outlets.length > 0 && !outlets.some((o) => o.outlet_id === selectedOutletId)) {
      setSelectedOutletId(outlets[0].outlet_id);
    }
  }, [lockedOutletId, outlets, selectedOutletId]);

  const loadOutletDashboard = async (outletId: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/outlet/${outletId}/dashboard`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load outlet dashboard');
      setOrders(data.orders);
      setMenuItems(data.menu.items);
      setAnalytics(data.analytics);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOutletId) {
      loadOutletDashboard(selectedOutletId);
    }
  }, [selectedOutletId]);

  const handleStatusChange = async (ord: OrderRecord, nextStatus: OrderStatus) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(
        `/api/orders/${ord.outlet_id}/${ord.logical_date}/${ord.daily_token_number}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');

      if (nextStatus === 'Accepted') {
        setSuccessMsg(
          `Order #${ord.daily_token_number} Accepted. Delayed deduction trigger updated ${ord.student_name}'s balance to ${formatINR(data.new_student_balance)}.`
        );
      } else {
        setSuccessMsg(`Order #${ord.daily_token_number} marked as ${nextStatus}.`);
      }

      await loadOutletDashboard(selectedOutletId);
      onDataMutated();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const nextVal = item.is_available === 1 ? false : true;
      const res = await apiFetch(`/api/outlet/items/${item.item_id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: nextVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle availability');
      setSuccessMsg(
        `${item.name} is now marked ${nextVal ? 'Available' : 'Unavailable'} for students.`
      );
      await loadOutletDashboard(selectedOutletId);
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
      setSuccessMsg('Outlet password updated! Use your new password the next time you sign in.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredOrders =
    statusFilter === 'All' ? orders : orders.filter((o) => o.status === statusFilter);
  const currentOutlet = outlets.find((o) => o.outlet_id === selectedOutletId);
  const maxTrendRev = Math.max(1, ...(analytics?.dailyTrend.map((d) => d.revenue) ?? [1]));

  return (
    <div className="space-y-6">
      {/* Outlet Selection & Income Analytics Header */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-5 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            {lockedOutletId !== undefined ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {currentOutlet?.name ?? `Outlet #${lockedOutletId}`}
                </span>
                <span className="text-xs font-mono text-slate-500">ID #{lockedOutletId}</span>
              </div>
            ) : (
              <>
                <label
                  htmlFor="outlet-portal-select"
                  className="text-sm font-semibold text-slate-700 whitespace-nowrap"
                >
                  Manage Outlet
                </label>
                <select
                  id="outlet-portal-select"
                  value={selectedOutletId}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setSelectedOutletId(Number(e.target.value));
                  }}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                >
                  {outlets.map((o) => (
                    <option key={o.outlet_id} value={o.outlet_id}>
                      {o.name} (ID #{o.outlet_id})
                    </option>
                  ))}
                </select>
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
          {currentOutlet && (
            <span className="text-xs text-slate-500">
              Phones: {currentOutlet.phones.join(' · ')}
            </span>
          )}
        </div>

        {/* Income Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div>
            <p className="text-xs font-medium text-slate-500">Today&apos;s Revenue (Logical Day)</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loading ? '...' : formatINR(analytics?.summary.today_revenue ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {analytics?.summary.today_orders ?? 0} accepted/ready orders
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Last 7 Days Income</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loading ? '...' : formatINR(analytics?.summary.week_revenue ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {analytics?.summary.week_orders ?? 0} accepted/ready orders
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Last 30 Days Income</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900">
              {loading ? '...' : formatINR(analytics?.summary.month_revenue ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
              {analytics?.summary.month_orders ?? 0} accepted/ready orders
            </p>
          </div>
        </div>
      </section>

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

      {/* Incoming Orders Queue */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Order Fulfilment Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Clicking Accept triggers the ACID ledger deduction on STUDENT.current_balance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
            {(['All', 'Pending', 'Accepted', 'Ready', 'Rejected', 'Cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No orders matching filter &ldquo;{statusFilter}&rdquo;.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Token</th>
                  <th className="py-2.5 pr-4">Logical Date</th>
                  <th className="py-2.5 pr-4">Student</th>
                  <th className="py-2.5 pr-4">Items</th>
                  <th className="py-2.5 pr-4 text-right">Amount</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((ord) => (
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
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-900">{ord.student_name}</div>
                      <div className="text-xs font-mono text-slate-500">{ord.student_id}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {ord.items
                        .map((it) => {
                          const extrasText =
                            it.extras.length > 0
                              ? ` [${it.extras.map((e) => e.name).join(', ')}]`
                              : '';
                          return `${it.quantity}× ${it.item_name}${it.is_parcel ? ' (Parcel)' : ''}${extrasText}`;
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
                    <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                      {ord.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(ord, 'Accepted')}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(ord, 'Rejected')}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {ord.status === 'Accepted' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(ord, 'Ready')}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                        >
                          Mark Ready
                        </button>
                      )}
                      {ord.status !== 'Pending' && ord.status !== 'Accepted' && (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bottom Split: Live Menu Availability Toggle + Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Live Menu Availability</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Items toggled Unavailable are immediately hidden from Student Portal via v_available_menu
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {menuItems.map((item) => (
              <div key={item.item_id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.category} · {item.diet_type} ·{' '}
                    <span className="font-mono tabular-nums">{formatINR(item.base_price)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAvailability(item)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                    item.is_available === 1
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {item.is_available === 1 ? 'Available (Click to Hide)' : 'Unavailable (Click to Show)'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Revenue Analytics (Category &amp; Daily Trend)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated from SQL View v_outlet_revenue_summary &amp; Category JOIN query
            </p>
          </div>

          {/* Simple Daily Bar Trend */}
          {analytics && analytics.dailyTrend.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-600">Recent Logical Days Revenue</h3>
              <div className="space-y-2">
                {analytics.dailyTrend.map((d) => {
                  const widthPct = Math.max(4, Math.round((d.revenue / maxTrendRev) * 100));
                  return (
                    <div key={d.logical_date} className="flex items-center gap-3 text-xs">
                      <span className="w-24 font-mono tabular-nums text-slate-600 shrink-0">
                        {d.logical_date}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono tabular-nums font-medium text-slate-900 shrink-0">
                        {formatINR(d.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category-wise Revenue Table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Category-wise Breakdown</h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3 text-right">Units Sold</th>
                  <th className="py-2 text-right">Revenue (incl. extras/parcel)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analytics?.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{c.category}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                      {c.units_sold}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatINR(c.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Item-wise Revenue Table */}
          <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Top Items by Revenue</h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3">Menu Item</th>
                  <th className="py-2 pr-3 text-right">Units</th>
                  <th className="py-2 text-right">Item Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {analytics?.byItem.map((it) => (
                  <tr key={it.item_id}>
                    <td className="py-2 pr-3 text-slate-900">
                      {it.name}{' '}
                      <span className="text-xs text-slate-500">({it.diet_type})</span>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                      {it.units_sold}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatINR(it.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
