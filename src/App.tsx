import React, { useEffect, useState, useCallback } from 'react';
import { Utensils, Store, ShieldCheck, CalendarClock, LogOut, UserCheck } from 'lucide-react';
import { LoginPage } from './components/LoginPage.tsx';
import { StudentPortal } from './components/StudentPortal.tsx';
import { OutletPortal } from './components/OutletPortal.tsx';
import { UnionPortal } from './components/UnionPortal.tsx';
import { apiFetch, setStoredToken } from './utils/apiFetch.ts';
import type { AuthUser, Student, Outlet, UnionAdmin } from './types.ts';

export default function App() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [logicalDate, setLogicalDate] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [admins, setAdmins] = useState<UnionAdmin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/bootstrap');
      const data = await res.json();
      if (res.status === 401) {
        setCurrentUser(null);
        setStoredToken(null);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load application data');
      setLogicalDate(data.logicalDate);
      setStudents(data.students);
      setOutlets(data.outlets);
      setAdmins(data.admins);
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          setStoredToken(null);
        }
      } catch {
        if (active) setCurrentUser(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchBootstrap();
    }
  }, [currentUser, fetchBootstrap]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setLoadError(null);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setStoredToken(null);
    setCurrentUser(null);
    setStudents([]);
    setOutlets([]);
    setAdmins([]);
    setLoadError(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-4 text-sm text-slate-600">
          Checking session...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-bold tracking-tight text-sm sm:text-base text-slate-900 whitespace-nowrap">
              Campus Food System
            </span>
          </div>

          {/* Role-Locked Active Portal Indicator */}
          <nav aria-label="Portal Navigation" className="flex items-center gap-6 h-full">
            {currentUser.role === 'student' && (
              <span className="h-full flex items-center gap-1.5 text-xs sm:text-sm font-medium border-b-2 border-indigo-600 text-indigo-700 whitespace-nowrap">
                <Utensils className="w-4 h-4" />
                <span>Student Portal</span>
              </span>
            )}

            {currentUser.role === 'outlet' && (
              <span className="h-full flex items-center gap-1.5 text-xs sm:text-sm font-medium border-b-2 border-indigo-600 text-indigo-700 whitespace-nowrap">
                <Store className="w-4 h-4" />
                <span>Outlet Portal</span>
              </span>
            )}

            {currentUser.role === 'admin' && (
              <span className="h-full flex items-center gap-1.5 text-xs sm:text-sm font-medium border-b-2 border-indigo-600 text-indigo-700 whitespace-nowrap">
                <ShieldCheck className="w-4 h-4" />
                <span>Union Admin Portal</span>
              </span>
            )}
          </nav>

          {/* Session Info & Logout */}
          <div className="flex items-center gap-3 shrink-0">
            {logicalDate && (
              <div
                className="hidden md:flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap"
                title="Active Logical Day (06:00 AM to 03:59 AM next day)"
              >
                <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                <span>Logical Day: {logicalDate}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700 font-medium whitespace-nowrap max-w-44 truncate">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{currentUser.name}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Strictly Scoped by Authenticated Role */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {loading && students.length === 0 && outlets.length === 0 && admins.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
            Loading campus database...
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-800">
            Failed to connect to backend: {loadError}
          </div>
        ) : (
          <>
            {currentUser.role === 'student' && (
              <StudentPortal
                students={students}
                outlets={outlets}
                logicalDate={logicalDate}
                lockedStudentId={currentUser.student_id ?? currentUser.id}
                onDataMutated={fetchBootstrap}
              />
            )}
            {currentUser.role === 'outlet' && (
              <OutletPortal
                outlets={outlets}
                lockedOutletId={currentUser.outlet_id ?? Number(currentUser.id)}
                onDataMutated={fetchBootstrap}
              />
            )}
            {currentUser.role === 'admin' && (
              <UnionPortal
                admins={admins}
                outlets={outlets}
                lockedAdminId={currentUser.admin_id ?? currentUser.id}
                onDataMutated={fetchBootstrap}
              />
            )}
          </>
        )}
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
