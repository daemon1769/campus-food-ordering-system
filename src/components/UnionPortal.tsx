import React, { useEffect, useState } from 'react';
import { Download, AlertCircle, CheckCircle2, Database, Play } from 'lucide-react';
import type { Outlet, UnionAdmin, UnionAuditData, DietType, DbmsOverviewData } from '../types.ts';
import { formatINR } from '../utils/campusRules.ts';
import { apiFetch } from '../utils/apiFetch.ts';

interface UnionPortalProps {
  admins: UnionAdmin[];
  outlets: Outlet[];
  lockedAdminId?: string;
  onDataMutated: () => void;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const QUERY_CATALOG: Array<{ key: string; title: string }> = [
  {
    key: 'q1_outlet_revenue',
    title: 'Q1. Outlet-Wise Total Revenue & Order Count (LEFT JOIN + GROUP BY)',
  },
  {
    key: 'q2_category_diet_breakdown',
    title: 'Q2. Sales by Food Category & Diet Type (4-Table JOIN + Subquery)',
  },
  {
    key: 'q3_above_avg_spenders',
    title: 'Q3. Students Spending Above Campus Average (Nested Subquery + HAVING)',
  },
  {
    key: 'q4_daily_nutrition_per_student',
    title: 'Q4. Student Daily Calorie, Protein & Fat Intake (4-Table JOIN + SUM)',
  },
  {
    key: 'q5_top_items_per_outlet_window',
    title: 'Q5. Top 3 Best-Selling Items per Outlet (CTE + DENSE_RANK Window Function)',
  },
];

export function UnionPortal({ admins, outlets, lockedAdminId, onDataMutated }: UnionPortalProps) {
  const [selectedAdminId, setSelectedAdminId] = useState<string>(
    lockedAdminId ?? admins[0]?.admin_id ?? 'ADM001'
  );
  const [auditData, setAuditData] = useState<UnionAuditData | null>(null);
  const [dbmsOverview, setDbmsOverview] = useState<DbmsOverviewData | null>(null);
  const [selectedQueryKey, setSelectedQueryKey] = useState<string>(QUERY_CATALOG[0].key);
  const [queryResultRows, setQueryResultRows] = useState<Record<string, unknown>[]>([]);
  const [hasExecutedQuery, setHasExecutedQuery] = useState<boolean>(false);
  const [runningQuery, setRunningQuery] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Form 1: New Outlet + Phones (1NF)
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletPhones, setNewOutletPhones] = useState('');
  const [newOutletPassword, setNewOutletPassword] = useState('outlet123');

  // Form 2: New Standardized Menu Item
  const [itemOutletId, setItemOutletId] = useState<number>(outlets[0]?.outlet_id ?? 1);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('80');
  const [itemCategory, setItemCategory] = useState('Tiffin');
  const [itemDietType, setItemDietType] = useState<DietType>('Veg');
  const [itemIsParcelable, setItemIsParcelable] = useState(true);
  const [itemParcelCharge, setItemParcelCharge] = useState('10');
  const [itemCalories, setItemCalories] = useState('400');
  const [itemProtein, setItemProtein] = useState('12');
  const [itemFat, setItemFat] = useState('10');

  // Form 3: New Dietary-Neutral Extra
  const [extraOutletId, setExtraOutletId] = useState<number>(outlets[0]?.outlet_id ?? 1);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('15');

  // Form 4: Register New Student
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentBalance, setNewStudentBalance] = useState('12000');
  const [newStudentPassword, setNewStudentPassword] = useState('student123');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const [auditRes, dbmsRes] = await Promise.all([
        apiFetch('/api/union/dashboard'),
        apiFetch('/api/union/dbms-overview'),
      ]);
      const auditJson = await auditRes.json();
      if (!auditRes.ok) throw new Error(auditJson.error || 'Failed to load Union audit');
      setAuditData(auditJson);

      const dbmsJson = await dbmsRes.json();
      if (!dbmsRes.ok) throw new Error(dbmsJson.error || 'Failed to load DBMS overview');
      setDbmsOverview(dbmsJson);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunLiveQuery = async () => {
    setRunningQuery(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/union/run-query/${encodeURIComponent(selectedQueryKey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute live SQL query');
      setQueryResultRows(Array.isArray(data.rows) ? data.rows : []);
      setHasExecutedQuery(true);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setRunningQuery(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const phones = newOutletPhones
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const res = await apiFetch('/api/union/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOutletName,
          phones,
          password: newOutletPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register outlet');
      setNewOutletName('');
      setNewOutletPhones('');
      setNewOutletPassword('outlet123');
      setSuccessMsg(
        `Registered outlet "${data.name}" (#${data.outlet_id}) with ${data.phones.length} phone(s). Sign in under the "Food Outlet" tab using Name "${data.name}" (or ${data.email}) and password "${data.initial_password ?? 'outlet123'}".`
      );
      await loadAudit();
      onDataMutated();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch('/api/union/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: newStudentId,
          name: newStudentName,
          email: newStudentEmail,
          current_balance: Number(newStudentBalance),
          password: newStudentPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register student');
      setNewStudentId('');
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentBalance('12000');
      setNewStudentPassword('student123');
      setSuccessMsg(
        `Registered student "${data.name}" (${data.student_id}) with initial balance ${formatINR(data.current_balance)}. Sign in under the "Student" tab using ID "${data.student_id}" and password "${data.initial_password ?? 'student123'}".`
      );
      await loadAudit();
      onDataMutated();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch('/api/union/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: itemOutletId,
          name: itemName,
          base_price: Number(itemPrice),
          category: itemCategory,
          diet_type: itemDietType,
          is_parcelable: itemIsParcelable,
          parcel_charge: Number(itemParcelCharge),
          calories: Number(itemCalories),
          protein: Number(itemProtein),
          fat: Number(itemFat),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add menu item');
      setItemName('');
      setSuccessMsg(`Added standardized menu item "${data.name}" (ID #${data.item_id}).`);
      await loadAudit();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleCreateExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch('/api/union/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: extraOutletId,
          name: extraName,
          price: Number(extraPrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add extra');
      setExtraName('');
      setSuccessMsg(`Added dietary-neutral add-on "${data.name}" (${formatINR(data.price)}).`);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const activeAdmin = admins.find((a) => a.admin_id === selectedAdminId);
  const activeQuery =
    dbmsOverview?.queries.find((q) => q.key === selectedQueryKey) ?? dbmsOverview?.queries[0];
  const resultColumns = queryResultRows.length > 0 ? Object.keys(queryResultRows[0]) : [];

  return (
    <div className="space-y-6">
      {/* Union Admin Header */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {lockedAdminId ? (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {activeAdmin?.name ?? lockedAdminId}
              </span>
              <span className="text-xs font-mono text-slate-600">{lockedAdminId}</span>
            </div>
          ) : (
            <>
              <label
                htmlFor="union-admin-select"
                className="text-sm font-semibold text-slate-700 whitespace-nowrap"
              >
                Food Safety Union Admin
              </label>
              <select
                id="union-admin-select"
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md text-slate-900"
              >
                {admins.map((a) => (
                  <option key={a.admin_id} value={a.admin_id}>
                    {a.name} ({a.admin_id})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        {activeAdmin && <span className="text-xs text-slate-500">{activeAdmin.email}</span>}
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

      {/* Setup Forms Grid (4 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form 1: Register New Outlet */}
        <form
          onSubmit={handleCreateOutlet}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="pb-2 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">1. Register Food Outlet</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inserts into OUTLET + OUTLET_PHONE (1NF multi-phone support) with login password
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="new-outlet-name" className="block text-xs font-medium text-slate-700">
                Outlet Name
              </label>
              <input
                id="new-outlet-name"
                type="text"
                required
                placeholder="e.g., Amul Parlour"
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="new-outlet-password"
                className="block text-xs font-medium text-slate-700"
              >
                Initial Login Password
              </label>
              <input
                id="new-outlet-password"
                type="text"
                required
                value={newOutletPassword}
                onChange={(e) => setNewOutletPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="new-outlet-phones" className="block text-xs font-medium text-slate-700">
              Contact Phone(s) (comma-separated)
            </label>
            <input
              id="new-outlet-phones"
              type="text"
              required
              placeholder="+91-9849012345, +91-4023459999"
              value={newOutletPhones}
              onChange={(e) => setNewOutletPhones(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            Create Outlet
          </button>
        </form>

        {/* Form 4: Register New Student */}
        <form
          onSubmit={handleCreateStudent}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5"
        >
          <div className="pb-2 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">2. Register New Student</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inserts into STUDENT with semester ledger deposit &amp; portal login credentials
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="new-student-id" className="block text-xs font-medium text-slate-700">
                Student ID
              </label>
              <input
                id="new-student-id"
                type="text"
                required
                placeholder="e.g., 2024A7PS0999H"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="new-student-name"
                className="block text-xs font-medium text-slate-700"
              >
                Full Name
              </label>
              <input
                id="new-student-name"
                type="text"
                required
                placeholder="e.g., Aditya Kulkarni"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="new-student-email"
                className="block text-xs font-medium text-slate-700"
              >
                Campus Email
              </label>
              <input
                id="new-student-email"
                type="email"
                required
                placeholder="e.g., aditya.k@campus.edu"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="new-student-balance"
                className="block text-xs font-medium text-slate-700"
              >
                Initial Deposit (₹)
              </label>
              <input
                id="new-student-balance"
                type="number"
                step="100"
                required
                value={newStudentBalance}
                onChange={(e) => setNewStudentBalance(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="new-student-password"
                className="block text-xs font-medium text-slate-700"
              >
                Initial Login Password
              </label>
              <input
                id="new-student-password"
                type="text"
                required
                value={newStudentPassword}
                onChange={(e) => setNewStudentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer"
          >
            Register Student
          </button>
        </form>

        {/* Form 2: Add Standardized Menu Item */}
        <form
          onSubmit={handleCreateMenuItem}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-3.5"
        >
          <div className="pb-2 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">3. Standardize Menu Item</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defines price, category, diet type, parcel charge &amp; nutrition
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label htmlFor="item-outlet" className="block text-xs font-medium text-slate-700">
                Outlet
              </label>
              <select
                id="item-outlet"
                value={itemOutletId}
                onChange={(e) => setItemOutletId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {outlets.map((o) => (
                  <option key={o.outlet_id} value={o.outlet_id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 space-y-1">
              <label htmlFor="item-name" className="block text-xs font-medium text-slate-700">
                Item Name
              </label>
              <input
                id="item-name"
                type="text"
                required
                placeholder="e.g., Paneer Kathi Roll"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="item-price" className="block text-xs font-medium text-slate-700">
                Base Price (₹)
              </label>
              <input
                id="item-price"
                type="number"
                min="0"
                step="1"
                required
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="item-category" className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                id="item-category"
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="Tiffin">Tiffin</option>
                <option value="Rice">Rice</option>
                <option value="Snacks">Snacks</option>
                <option value="Meals">Meals</option>
                <option value="Juice">Juice</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="item-diet" className="block text-xs font-medium text-slate-700">
                Diet Type
              </label>
              <select
                id="item-diet"
                value={itemDietType}
                onChange={(e) => setItemDietType(e.target.value as DietType)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="Veg">Veg</option>
                <option value="Non-Veg">Non-Veg</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="item-parcel-charge" className="block text-xs font-medium text-slate-700">
                Parcel Charge (₹)
              </label>
              <input
                id="item-parcel-charge"
                type="number"
                min="0"
                disabled={!itemIsParcelable}
                value={itemIsParcelable ? itemParcelCharge : '0'}
                onChange={(e) => setItemParcelCharge(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono disabled:bg-slate-100"
              />
            </div>

            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="item-calories" className="block text-xs font-medium text-slate-700">
                  Calories (kcal)
                </label>
                <input
                  id="item-calories"
                  type="number"
                  min="0"
                  required
                  value={itemCalories}
                  onChange={(e) => setItemCalories(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-protein" className="block text-xs font-medium text-slate-700">
                  Protein (g)
                </label>
                <input
                  id="item-protein"
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={itemProtein}
                  onChange={(e) => setItemProtein(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="item-fat" className="block text-xs font-medium text-slate-700">
                  Fat (g)
                </label>
                <input
                  id="item-fat"
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={itemFat}
                  onChange={(e) => setItemFat(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={itemIsParcelable}
              onChange={(e) => setItemIsParcelable(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Item can be packed as parcel</span>
          </label>

          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer"
          >
            Add Menu Item
          </button>
        </form>

        {/* Form 3: Add Dietary-Neutral Extra */}
        <form
          onSubmit={handleCreateExtra}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="pb-2 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">4. Add Dietary-Neutral Extra</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Appears across both Veg &amp; Non-Veg filters for the selected outlet
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="extra-outlet" className="block text-xs font-medium text-slate-700">
              Outlet
            </label>
            <select
              id="extra-outlet"
              value={extraOutletId}
              onChange={(e) => setExtraOutletId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
            >
              {outlets.map((o) => (
                <option key={o.outlet_id} value={o.outlet_id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="extra-name" className="block text-xs font-medium text-slate-700">
              Add-on Name
            </label>
            <input
              id="extra-name"
              type="text"
              required
              placeholder="e.g., Extra Mozzarella Cheese"
              value={extraName}
              onChange={(e) => setExtraName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="extra-price" className="block text-xs font-medium text-slate-700">
              Add-on Price (₹)
            </label>
            <input
              id="extra-price"
              type="number"
              min="0"
              required
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            Add Item Extra
          </button>
        </form>
      </div>

      {/* Administrative Audit Tables */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Union Audit 1: Outlet Revenue &amp; Phone Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated across OUTLET, OUTLET_PHONE, MENU_ITEM, and ORDER
            </p>
          </div>
          {auditData && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'union_outlet_revenue_audit.csv',
                  ['Outlet ID', 'Name', 'Phones', 'Menu Items', 'Total Orders', 'Accepted Orders', 'Total Revenue'],
                  auditData.outletRevenue.map((o) => [
                    o.outlet_id,
                    o.name,
                    o.phones,
                    o.menu_item_count,
                    o.total_orders,
                    o.accepted_orders,
                    o.total_revenue,
                  ])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap self-start"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Outlet ID</th>
                <th className="py-2.5 pr-4">Outlet Name</th>
                <th className="py-2.5 pr-4">Phones (OUTLET_PHONE)</th>
                <th className="py-2.5 pr-4 text-right">Menu Items</th>
                <th className="py-2.5 pr-4 text-right">Accepted Orders</th>
                <th className="py-2.5 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && !auditData ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Loading audit...
                  </td>
                </tr>
              ) : (
                auditData?.outletRevenue.map((o) => (
                  <tr key={o.outlet_id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-600">
                      #{o.outlet_id}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{o.name}</td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-slate-600">{o.phones}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-700">
                      {o.menu_item_count}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-700">
                      {o.accepted_orders} / {o.total_orders}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatINR(o.total_revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Union Audit 2: Student Semester Expenditure &amp; Debt Export
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              End-of-semester debt accounts (negative balance) highlighted for fee collection
            </p>
          </div>
          {auditData && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  'union_student_expenditure_audit.csv',
                  ['Student ID', 'Name', 'Email', 'Current Balance', 'Total Orders', 'Completed Expenditure'],
                  auditData.studentExpenditure.map((s) => [
                    s.student_id,
                    s.name,
                    s.email,
                    s.current_balance,
                    s.total_orders,
                    s.completed_expenditure,
                  ])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap self-start"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Student ID</th>
                <th className="py-2.5 pr-4">Name</th>
                <th className="py-2.5 pr-4 text-right">Orders</th>
                <th className="py-2.5 pr-4 text-right">Completed Spend</th>
                <th className="py-2.5 pr-4 text-right">Current Balance</th>
                <th className="py-2.5 text-right">Ledger Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditData?.studentExpenditure.map((s) => (
                <tr key={s.student_id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{s.student_id}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{s.name}</td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-700">
                    {s.total_orders}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-900">
                    {formatINR(s.completed_expenditure)}
                  </td>
                  <td
                    className={`py-2.5 pr-4 text-right font-mono tabular-nums font-semibold ${
                      s.current_balance < 0 ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {formatINR(s.current_balance)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`text-xs font-semibold ${
                        s.current_balance < 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {s.current_balance < 0 ? 'Semester Debt Due' : 'Positive Credit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* DBMS Live SQL & 9-Table Row Counts Inspector */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-start gap-2.5">
            <Database className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                DBMS Evaluation Inspector: 9-Table Row Counts &amp; 5 Non-Trivial SQL Queries
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live SQLite verification of 3NF relations, record volume, and analytical SQL queries
              </p>
            </div>
          </div>

          {dbmsOverview && (
            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap self-start">
              Total Records Across 9 3NF Tables: {dbmsOverview.totalRecords} (Requirement: &gt;= 500)
            </span>
          )}
        </div>

        {/* 9-Table Row Counts Grid */}
        {dbmsOverview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {dbmsOverview.tableCounts.map((t) => (
              <div
                key={t.table_name}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
              >
                <span className="text-xs font-mono font-medium text-slate-700 truncate pr-2">
                  {t.table_name}
                </span>
                <span className="text-xs font-mono font-semibold tabular-nums text-indigo-700">
                  {t.row_count}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 5 Non-Trivial SQL Queries Live Runner */}
        {dbmsOverview && activeQuery && (
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label
                  htmlFor="dbms-query-select"
                  className="block text-xs font-medium text-slate-700"
                >
                  Select Non-Trivial SQL Query
                </label>
                <select
                  id="dbms-query-select"
                  value={selectedQueryKey}
                  onChange={(e) => {
                    setSelectedQueryKey(e.target.value);
                    setQueryResultRows([]);
                    setHasExecutedQuery(false);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white text-slate-900"
                >
                  {QUERY_CATALOG.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunLiveQuery}
                disabled={runningQuery}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{runningQuery ? 'Executing...' : 'Run Live SQL Query'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">DBMS Concepts:</span>{' '}
                {activeQuery.concepts}
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono overflow-x-auto">
                {activeQuery.sql}
              </pre>
            </div>

            {hasExecutedQuery && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  Live Query Output ({queryResultRows.length}{' '}
                  {queryResultRows.length === 1 ? 'row' : 'rows'})
                </div>
                {queryResultRows.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md">
                    Query executed successfully and returned 0 rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                          {resultColumns.map((col) => (
                            <th key={col} className="py-2 px-3 font-mono whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {queryResultRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {resultColumns.map((col) => {
                              const val = row[col];
                              return (
                                <td
                                  key={col}
                                  className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap"
                                >
                                  {val === null || val === undefined ? 'NULL' : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
