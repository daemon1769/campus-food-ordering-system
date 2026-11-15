import React, { useState } from 'react';
import { AlertCircle, LockKeyhole } from 'lucide-react';
import { apiFetch, setStoredToken } from '../utils/apiFetch.ts';
import type { AuthUser, UserRole } from '../types.ts';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

const DEMO_ACCOUNTS: Array<{
  role: UserRole;
  label: string;
  sublabel: string;
  identifier: string;
  password: string;
}> = [
  {
    role: 'student',
    label: 'Kartikey Gaur',
    sublabel: 'Student · 2024AAPS0225H',
    identifier: '2024AAPS0225H',
    password: 'student123',
  },
  {
    role: 'student',
    label: 'Rohan Verma',
    sublabel: 'Student (Debt Case) · 2024A7PS0101H',
    identifier: '2024A7PS0101H',
    password: 'student123',
  },
  {
    role: 'outlet',
    label: 'Hotspot',
    sublabel: 'Food Outlet · hotspot@campus.edu',
    identifier: 'Hotspot',
    password: 'outlet123',
  },
  {
    role: 'outlet',
    label: 'Yumppies',
    sublabel: 'Food Outlet · yumppies@campus.edu',
    identifier: 'Yumppies',
    password: 'outlet123',
  },
  {
    role: 'admin',
    label: 'Singireddy Hrushikesh',
    sublabel: 'Union Admin · ADM001',
    identifier: 'ADM001',
    password: 'admin123',
  },
];

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [role, setRole] = useState<UserRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const identifierLabel =
    role === 'student'
      ? 'Student ID or Email'
      : role === 'outlet'
        ? 'Outlet Name or Email'
        : 'Admin ID or Email';

  const identifierPlaceholder =
    role === 'student'
      ? 'e.g., 2024AAPS0225H or kartikey.gaur@campus.edu'
      : role === 'outlet'
        ? 'e.g., Hotspot or hotspot@campus.edu'
        : 'e.g., ADM001 or f20240239@hyderabad.bits-pilani.ac.in';

  const performLogin = async (loginRole: UserRole, loginId: string, loginPass: string) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole,
          identifier: loginId,
          password: loginPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign in failed.');
      }
      if (data.token) {
        setStoredToken(data.token);
      }
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(role, identifier, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Campus Food System
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Role-Based Portal Sign In
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Login Form Card */}
          <section className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-6 sm:p-7 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900">
                <LockKeyhole className="w-4 h-4 text-indigo-600" />
                <h1 className="text-xl font-bold tracking-tight">Sign In to Campus Food Portal</h1>
              </div>
              <p className="text-sm text-slate-600">
                Access is scoped strictly by role: students see their own account, outlets manage
                their own queue, and union admins govern outlets, menus, and campus-wide analytics.
              </p>
            </div>

            {/* Role Segmented Control */}
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">Select Role</span>
              <div
                role="tablist"
                aria-label="Account Role"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md"
              >
                {(
                  [
                    { id: 'student', label: 'Student' },
                    { id: 'outlet', label: 'Food Outlet' },
                    { id: 'admin', label: 'Union Admin' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={role === item.id}
                    onClick={() => {
                      setRole(item.id);
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 text-xs sm:text-sm font-medium rounded transition-colors whitespace-nowrap ${
                      role === item.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-800 px-3.5 py-2.5 rounded-md text-sm"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-700"
                >
                  {identifierLabel}
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder={identifierPlaceholder}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors"
              >
                {submitting
                  ? 'Signing In...'
                  : `Sign In as ${role === 'student' ? 'Student' : role === 'outlet' ? 'Outlet' : 'Admin'}`}
              </button>
            </form>
          </section>

          {/* Demo Quick-Fill Helper for Lab Evaluation */}
          <aside className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 space-y-3.5">
            <div className="pb-2.5 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Sample Accounts (Lab Demo)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any account below to fill its login credentials, then click Sign In.
              </p>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={`${acc.role}-${acc.identifier}`}
                  type="button"
                  onClick={() => {
                    setRole(acc.role);
                    setIdentifier(acc.identifier);
                    setPassword(acc.password);
                    setErrorMsg(null);
                  }}
                  className="w-full text-left px-3 py-2.5 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 rounded-md transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{acc.label}</span>
                    <span className="text-xs font-mono text-indigo-700">{acc.password}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{acc.sublabel}</p>
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">
              All 18 seeded students use password <span className="font-mono">student123</span>, all
              6 campus outlets use <span className="font-mono">outlet123</span>, and all 5 admins
              use <span className="font-mono">admin123</span>.
            </p>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CS F212 Database Systems · P2 Group-18 · Centralized Campus Food Ordering System</span>
          <span>Logical Day Boundary: 06:00 AM – 03:59 AM</span>
        </div>
      </footer>
    </div>
  );
}
