import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './src/db/database.ts';
import {
  authenticateUser,
  changeUserPassword,
  getBootstrapData,
  getMenuItemOutletId,
  getOrderStudentId,
  getStudentNutritionSummary,
  getAvailableMenuForOutlet,
  getStudentOrders,
  placeOrderTransaction,
  updateOrderStatusTransaction,
  getOutletOrders,
  getOutletAnalytics,
  getOutletAllMenuItems,
  toggleMenuItemAvailability,
  getUnionAuditData,
  getDbmsOverview,
  runNamedDemoQuery,
  createOutletWithPhonesTransaction,
  createStudent,
  addMenuItem,
  addItemExtra,
} from './src/db/queries.ts';
import {
  parseCookieHeader,
  signSessionToken,
  verifySessionToken,
} from './src/utils/authCrypto.ts';
import type { AuthUser, OrderStatus, UserRole } from './src/types.ts';

const SESSION_COOKIE_NAME = 'campus_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`${process.cwd()}:campus-food-p2-group18`).digest('hex');

function extractSessionUser(req: express.Request): AuthUser | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    const u = verifySessionToken(cookieToken, SESSION_SECRET);
    if (u) return u;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice('Bearer '.length).trim();
    if (bearerToken) {
      return verifySessionToken(bearerToken, SESSION_SECRET);
    }
  }
  return null;
}

async function startServer() {
  // Initialize SQLite database & seed if empty
  getDb();

  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Auth: Check current session
  app.get('/api/auth/me', (req, res) => {
    const user = extractSessionUser(req);
    res.json({ authenticated: Boolean(user), user });
  });

  // Auth: Login with role + identifier + password
  app.post('/api/auth/login', (req, res) => {
    try {
      const { role, identifier, password } = req.body as {
        role?: UserRole;
        identifier?: string;
        password?: string;
      };
      if (role !== 'student' && role !== 'outlet' && role !== 'admin') {
        return res.status(400).json({ error: 'Invalid login role.' });
      }
      const user = authenticateUser(role, identifier ?? '', password ?? '');
      const token = signSessionToken(user, SESSION_SECRET);
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`
      );
      res.json({ user, token });
    } catch (err: unknown) {
      res.status(401).json({ error: (err as Error).message || 'Invalid credentials.' });
    }
  });

  // Auth: Logout
  app.post('/api/auth/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
    );
    res.json({ ok: true });
  });

  // Require authentication middleware for all non-auth data routes
  const requireAuth: express.RequestHandler = (req, res, next) => {
    const user = extractSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    (req as express.Request & { sessionUser: AuthUser }).sessionUser = user;
    next();
  };

  const getSessionUser = (req: express.Request): AuthUser =>
    (req as express.Request & { sessionUser: AuthUser }).sessionUser;

  // Auth: Change Password for the currently logged-in Student, Outlet, or Admin
  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      const targetId =
        user.role === 'student'
          ? (user.student_id ?? user.id)
          : user.role === 'outlet'
            ? (user.outlet_id ?? Number(user.id))
            : (user.admin_id ?? user.id);

      changeUserPassword(user.role, targetId, currentPassword ?? '', newPassword ?? '');
      res.json({ ok: true, message: 'Password updated successfully.' });
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message || 'Failed to update password.' });
    }
  });

  // Bootstrap dropdown options (scoped strictly to the logged-in user's role)
  app.get('/api/bootstrap', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const data = getBootstrapData();
      if (user.role === 'student') {
        return res.json({
          logicalDate: data.logicalDate,
          students: data.students.filter((s) => s.student_id === user.student_id),
          outlets: data.outlets,
          admins: [],
        });
      }
      if (user.role === 'outlet') {
        return res.json({
          logicalDate: data.logicalDate,
          students: [],
          outlets: data.outlets.filter((o) => o.outlet_id === user.outlet_id),
          admins: [],
        });
      }
      res.json({
        logicalDate: data.logicalDate,
        students: [],
        outlets: data.outlets,
        admins: data.admins.filter((a) => a.admin_id === user.admin_id),
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Student Portal: Nutrition/Spend summary + order history (Strictly authenticated student only)
  app.get('/api/student/:studentId/dashboard', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const { studentId } = req.params;
      if (user.role !== 'student' || user.student_id !== studentId) {
        return res
          .status(403)
          .json({ error: 'Access denied: Only the authenticated student can view this account.' });
      }

      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';
      const bootstrap = getBootstrapData();
      const student = bootstrap.students.find((s) => s.student_id === studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found.' });
      }
      const summary = getStudentNutritionSummary(studentId, period);
      const dailyNutrition =
        period === 'day' ? summary : getStudentNutritionSummary(studentId, 'day');
      const orders = getStudentOrders(studentId);
      res.json({ student, summary, dailyNutrition, orders });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Student Portal: Available Menu + Dietary-Neutral Extras for an Outlet
  app.get('/api/outlets/:outletId/menu', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const outletId = Number(req.params.outletId);
      if (user.role !== 'student') {
        return res
          .status(403)
          .json({ error: 'Access denied: Only students can browse the ordering menu.' });
      }
      res.json(getAvailableMenuForOutlet(outletId));
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Student Portal: Place Order (Strictly authenticated student only)
  app.post('/api/orders', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'student') {
        return res.status(403).json({
          error: 'Access denied: Only the logged-in student can place orders on their account.',
        });
      }
      const payload = { ...req.body };
      if (payload.student_id && payload.student_id !== user.student_id) {
        return res.status(403).json({
          error: 'Access denied: Only the logged-in student can place orders on their account.',
        });
      }
      payload.student_id = user.student_id;
      const result = placeOrderTransaction(payload);
      res.status(201).json(result);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to place order.';
      const status = msg.includes('Concurrent order restriction') ? 409 : 400;
      res.status(status).json({ error: msg });
    }
  });

  // Order Status Transition (Cancel strictly by owning Student; Accept/Reject/Ready strictly by owning Outlet)
  app.patch('/api/orders/:outletId/:logicalDate/:tokenNumber/status', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const outletId = Number(req.params.outletId);
      const logicalDate = req.params.logicalDate;
      const tokenNumber = Number(req.params.tokenNumber);
      const nextStatus = req.body.status as OrderStatus;

      if (nextStatus === 'Cancelled') {
        const ownerId = getOrderStudentId(outletId, logicalDate, tokenNumber);
        if (!ownerId) {
          return res.status(404).json({ error: 'Order not found.' });
        }
        if (user.role !== 'student' || ownerId !== user.student_id) {
          return res.status(403).json({
            error: 'Access denied: Only the student who placed this order can cancel it.',
          });
        }
      } else {
        if (user.role !== 'outlet' || user.outlet_id !== outletId) {
          return res.status(403).json({
            error: 'Access denied: Only the authenticated outlet can update its orders.',
          });
        }
      }

      const result = updateOrderStatusTransaction(outletId, logicalDate, tokenNumber, nextStatus);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Outlet Portal: Orders, Full Menu (including unavailable), and Analytics (Strictly owning outlet only)
  app.get('/api/outlet/:outletId/dashboard', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const outletId = Number(req.params.outletId);
      if (user.role !== 'outlet' || user.outlet_id !== outletId) {
        return res.status(403).json({
          error: 'Access denied: Only the authenticated outlet can view this dashboard.',
        });
      }
      const orders = getOutletOrders(outletId);
      const menu = getOutletAllMenuItems(outletId);
      const analytics = getOutletAnalytics(outletId);
      res.json({ orders, menu, analytics });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Outlet Portal: Toggle Live Menu Item Availability (Strictly owning outlet only)
  app.patch('/api/outlet/items/:itemId/availability', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      const itemId = Number(req.params.itemId);
      const ownerOutletId = getMenuItemOutletId(itemId);
      if (ownerOutletId === null) {
        return res.status(404).json({ error: 'Menu item not found.' });
      }
      if (user.role !== 'outlet' || ownerOutletId !== user.outlet_id) {
        return res.status(403).json({
          error: 'Access denied: Only the authenticated outlet can toggle its menu.',
        });
      }
      const isAvailable = Boolean(req.body.is_available);
      res.json(toggleMenuItemAvailability(itemId, isAvailable));
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Audit Queries (Admin only)
  app.get('/api/union/dashboard', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      res.json(getUnionAuditData());
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: DBMS Overview (9 Table Row Counts + 5 Non-Trivial SQL Queries)
  app.get('/api/union/dbms-overview', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      res.json(getDbmsOverview());
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Execute any of the 5 Non-Trivial SQL Queries live for Lab Viva Demo
  app.get('/api/union/run-query/:queryKey', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      const rows = runNamedDemoQuery(req.params.queryKey);
      res.json({ rows });
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Create Outlet + Phones (Admin only)
  app.post('/api/union/outlets', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      const { name, phones, password } = req.body as {
        name: string;
        phones: string[];
        password?: string;
      };
      const created = createOutletWithPhonesTransaction(name, phones, password);
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Register New Student (Admin only)
  app.post('/api/union/students', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      const created = createStudent(req.body);
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Add Master Menu Item (Admin only)
  app.post('/api/union/menu-items', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      const created = addMenuItem(req.body);
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Union Admin Portal: Add Dietary-Neutral Extra (Admin only)
  app.post('/api/union/extras', requireAuth, (req, res) => {
    try {
      const user = getSessionUser(req);
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Union Admin access required.' });
      }
      const { outlet_id, name, price } = req.body;
      const created = addItemExtra(Number(outlet_id), name, Number(price));
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Vite integration in dev vs static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
