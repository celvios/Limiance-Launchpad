'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  ChevronRight,
  Coins,
  FileText,
  LogOut,
  Search,
  ShieldAlert,
  Layers,
  TrendingUp,
  Users,
  UserCog,
  WalletCards,
  AlertCircle,
  MessageSquare,
  Wallet,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { adminFetch, clearSession, getSession, login, type Admin } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'reports' | 'users' | 'tokens' | 'finance' | 'audit' | 'admins';
type Dashboard = {
  counts: Record<string, number>;
  liabilities: { availableUsdtRaw: string };
  health: { indexerLastProcessedBlock: string | null };
};
type Report = {
  id: string; targetType: string; targetId: string; reason: string;
  details?: string | null; status: string; reportCount: number; priority: string; createdAt: string;
};
type User = {
  id: string; email: string | null; primaryWalletAddress: string | null;
  authType: string; status: string; createdAt: string;
  profile: { usernameDisplay: string } | null;
  balances: Array<{ asset: string; available: string }>;
};
type Token = {
  mint: string; symbol: string; name: string; creator: string; status: string;
  currentSupply: string; supplyCap: string; graduationThreshold: string; createdAt: string;
};
type Withdrawal = {
  id: string; userWallet: string; destination: string; amount: string;
  asset: string; status: string; txHash?: string | null; refundedAt?: string | null; createdAt: string;
};
type Audit = {
  id: string; action: string; targetType: string | null; targetId: string | null;
  createdAt: string; adminUser: { displayName: string; role: string };
};
type AdminRow = {
  id: string; email: string; displayName: string; role: string;
  status: string; lastLoginAt?: string | null; createdAt: string;
};

// ─── Nav Config ─────────────────────────────────────────────────────────────
const nav: Array<{ id: View; label: string; icon: typeof Activity; roles?: string[] }> = [
  { id: 'dashboard',  label: 'Dashboard',      icon: BarChart3   },
  { id: 'reports',    label: 'Reports',         icon: ShieldAlert },
  { id: 'users',      label: 'Users',           icon: Users       },
  { id: 'tokens',     label: 'Tokens',          icon: Coins       },
  { id: 'finance',    label: 'Finance',         icon: WalletCards },
  { id: 'audit',      label: 'Audit Log',       icon: FileText    },
  { id: 'admins',     label: 'Administrators',  icon: UserCog, roles: ['super_admin'] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function truncate(str: string, len = 16) {
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Root App ────────────────────────────────────────────────────────────────
export default function AdminApp() {
  const [session, setSession] = useState<{ token: string; admin: Admin } | null>(null);
  const [view, setView] = useState<View>('dashboard');

  useEffect(() => setSession(getSession()), []);

  if (!session) return <LoginPage onSuccess={setSession} />;

  const allowedNav = nav.filter(
    (item) => !item.roles || item.roles.includes(session.admin.role) || session.admin.role === 'super_admin',
  );

  const signOut = () => { clearSession(); setSession(null); };

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-inner">
          {/* Brand */}
          <div className="brand">
            <div className="brand-logo">
              <img src="/logo.png" alt="Limiance" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </div>
            <div className="brand-text">
              <span className="brand-name">LIMIANCE</span>
              <span className="brand-sub">Ops Console</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="nav" aria-label="Main navigation">
            <div className="nav-section-label">Navigation</div>
            {allowedNav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`nav-${id}`}
                className={`nav-item${view === id ? ' active' : ''}`}
                onClick={() => setView(id)}
                aria-current={view === id ? 'page' : undefined}
              >
                <Icon size={16} className="nav-icon" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="admin-badge">
              <div className="admin-avatar">{initials(session.admin.displayName)}</div>
              <div className="admin-info">
                <div className="admin-name">{session.admin.displayName}</div>
                <div className="admin-role">{session.admin.role.replace(/_/g, ' ')}</div>
              </div>
              <button className="sign-out-btn" title="Sign out" onClick={signOut} id="btn-signout">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <ChevronRight size={14} style={{ color: 'var(--muted-2)' }} />
            <h1 className="page-title">{nav.find((n) => n.id === view)?.label}</h1>
          </div>
        </header>

        <div className="content">
          <ViewContent view={view} />
        </div>
      </main>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onSuccess }: { onSuccess: (session: { token: string; admin: Admin }) => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(await login(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login" onSubmit={submit} id="login-form">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-logo" style={{ background: 'transparent', boxShadow: 'none', padding: 0, overflow: 'visible' }}>
            <img src="/logo.png" alt="Limiance" style={{ width: 160, height: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
        </div>

        <h1>Admin sign in</h1>
        <p className="login-subtitle">Restricted operations console. Authorised personnel only.</p>

        <label htmlFor="login-email">
          Email address
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="admin@limiance.com"
          />
        </label>

        <label htmlFor="login-password">
          Password
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••••••"
          />
        </label>

        {error && <ErrorBox error={error} />}

        <button id="btn-login" className="login-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────
function ViewContent({ view }: { view: View }) {
  if (view === 'dashboard') return <DashboardView />;
  if (view === 'reports')   return <ReportsView />;
  if (view === 'users')     return <UsersView />;
  if (view === 'tokens')    return <TokensView />;
  if (view === 'finance')   return <FinanceView />;
  if (view === 'admins')    return <AdminsView />;
  return <AuditView />;
}

function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {error}
    </div>
  );
}

function useAction() {
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); return false; }
  };
  return { error, run };
}

function Pager({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (p: number) => void }) {
  return (
    <div className="pager">
      <button id="btn-prev-page" disabled={page === 0} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={13} /> Previous
      </button>
      <span className="pager-info">Page {page + 1}</span>
      <button id="btn-next-page" disabled={!hasMore} onClick={() => onChange(page + 1)}>
        Next <ArrowRight size={13} />
      </button>
    </div>
  );
}

function Detail({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="ghost" id="btn-modal-close" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<Dashboard>('/admin/dashboard').then(setData).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!data)  return <div className="empty"><Activity size={24} /><span>Loading dashboard…</span></div>;

  const statCards: Array<{ label: string; value: string | number; icon: typeof Activity; color: string }> = [
    { label: 'Total Users',          value: data.counts.users ?? 0,              icon: Users,          color: 'var(--blue)'   },
    { label: 'Tokens',               value: data.counts.tokens ?? 0,             icon: Coins,          color: 'var(--purple)' },
    { label: 'Trades (24 h)',         value: data.counts.trades24h ?? 0,          icon: TrendingUp,     color: 'var(--green)'  },
    { label: 'Open Reports',         value: data.counts.openReports ?? 0,        icon: ShieldAlert,    color: 'var(--red)'    },
    { label: 'Pending Withdrawals',  value: data.counts.pendingWithdrawals ?? 0, icon: WalletCards,    color: 'var(--amber)'  },
    { label: 'Comments',             value: data.counts.comments ?? 0,           icon: MessageSquare,  color: 'var(--blue)'   },
    { label: 'Profiles',             value: data.counts.profiles ?? 0,           icon: UserCog,        color: 'var(--purple)' },
    { label: 'Available USDT',
      value: `${(Number(data.liabilities.availableUsdtRaw) / 1e6).toFixed(2)} USDT`,
      icon: Wallet, color: 'var(--green)' },
  ];

  return (
    <>
      <div className="cards">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}18`, color }}>
              <Icon size={16} />
            </div>
            <div className="card-label">{label}</div>
            <div className="card-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">
          <h2><Activity size={15} style={{ color: 'var(--green)' }} /> System Health</h2>
        </div>
        <div className="health-row">
          <div className="health-dot" />
          <span>Indexer last processed block:</span>
          <strong style={{ color: 'var(--text)', marginLeft: 4 }}>
            {data.health.indexerLastProcessedBlock ?? 'No state recorded'}
          </strong>
        </div>
      </div>
    </>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function ReportsView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(0);
  const [error, setError]     = useState('');

  const load = () =>
    adminFetch<{ reports: Report[] }>(
      `/admin/reports?limit=50&offset=${page * 50}${status ? `&status=${status}` : ''}`,
    )
      .then((d) => setReports(d.reports))
      .catch((e: Error) => setError(e.message));

  useEffect(() => { void load(); }, [status, page]);

  const update = async (id: string, next: string) => {
    try {
      await adminFetch(`/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next, resolution: next === 'dismissed' ? 'Reviewed and dismissed' : undefined }),
      });
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
  };

  const removeComment = async (id: string) => {
    if (!window.confirm('Remove this reported comment?')) return;
    try {
      await adminFetch(`/admin/comments/${id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Removed from moderation queue' }) });
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Removal failed'); }
  };

  return (
    <>
      <div className="toolbar">
        <select id="filter-report-status" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>
      <ErrorBox error={error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Priority</th>
              <th>Target</th>
              <th>Reason</th>
              <th>Count</th>
              <th>Status</th>
              <th>Details</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td><span className={`pill ${r.priority}`}>{r.priority}</span></td>
                <td>
                  <span style={{ textTransform: 'capitalize' }}>{r.targetType}</span>{' '}
                  <span className="muted mono" title={r.targetId}>{truncate(r.targetId, 14)}</span>
                </td>
                <td>{r.reason}</td>
                <td><strong>{r.reportCount}</strong></td>
                <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td style={{ maxWidth: 180, whiteSpace: 'normal', fontSize: 12, color: 'var(--muted)' }}>{r.details || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      id={`report-status-${r.id}`}
                      value={r.status}
                      onChange={(e) => void update(r.id, e.target.value)}
                      style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--line-strong)', borderRadius: 6, background: 'var(--panel-2)', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <option value="open">Open</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                    {r.targetType === 'comment' && (
                      <button id={`btn-remove-comment-${r.id}`} className="small danger" onClick={() => void removeComment(r.targetId)}>
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && <div className="empty"><ShieldAlert size={24} /><span>No reports found.</span></div>}
        <Pager page={page} hasMore={reports.length === 50} onChange={setPage} />
      </section>
    </>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersView() {
  const [users, setUsers]       = useState<User[]>([]);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(0);
  const [selected, setSelected] = useState<User | null>(null);
  const action = useAction();

  const load = () =>
    adminFetch<{ users: User[] }>(
      `/admin/users?limit=50&offset=${page * 50}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    )
      .then((d) => setUsers(d.users))
      .catch((e: Error) => action.run(async () => { throw e; }));

  useEffect(() => { void load(); }, [page]);

  const toggleStatus = async (user: User) => {
    const next = user.status === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} this user?`)) return;
    if (await action.run(() => adminFetch(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next, reason: 'Admin console action' }) })))
      void load();
  };

  return (
    <>
      <div className="toolbar">
        <input
          id="search-users"
          placeholder="Search email or wallet address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); void load(); } }}
        />
        <button id="btn-search-users" className="primary" onClick={() => { setPage(0); void load(); }}>
          <Search size={14} /> Search
        </button>
      </div>
      <ErrorBox error={action.error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Identity</th>
              <th>Wallet</th>
              <th>Auth</th>
              <th>Profile</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email ?? <span className="muted">Wallet user</span>}</td>
                <td>
                  {u.primaryWalletAddress
                    ? <span className="mono muted" title={u.primaryWalletAddress}>{truncate(u.primaryWalletAddress, 18)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td><span className="pill">{u.authType}</span></td>
                <td>{u.profile?.usernameDisplay ? `@${u.profile.usernameDisplay}` : <span className="muted">Not onboarded</span>}</td>
                <td>
                  {u.balances.length > 0
                    ? u.balances.map((b) => `${(Number(b.available) / 1e6).toFixed(2)} ${b.asset.slice(0, 6)}`).join(', ')
                    : <span className="muted">0</span>}
                </td>
                <td><span className={`pill ${u.status}`}>{u.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button id={`btn-user-detail-${u.id}`} className="small" onClick={() => setSelected(u)}>Details</button>
                    <button id={`btn-user-toggle-${u.id}`} className="small" onClick={() => void toggleStatus(u)}>
                      {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="empty"><Users size={24} /><span>No users found.</span></div>}
        <Pager page={page} hasMore={users.length === 50} onChange={setPage} />
      </section>

      {selected && (
        <Detail title="User details" onClose={() => setSelected(null)}>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </Detail>
      )}
    </>
  );
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
function TokensView() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(0);
  const action = useAction();

  const load = () =>
    adminFetch<{ tokens: Token[] }>(
      `/admin/tokens?limit=50&offset=${page * 50}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    )
      .then((d) => setTokens(d.tokens))
      .catch((e: Error) => action.run(async () => { throw e; }));

  useEffect(() => { void load(); }, [page]);

  const toggle = async (token: Token) => {
    const status = token.status === 'cancelled' ? 'active' : 'cancelled';
    if (!window.confirm(`${status === 'cancelled' ? 'Hide' : 'Restore'} this token?`)) return;
    if (await action.run(() =>
      adminFetch(`/admin/tokens/${encodeURIComponent(token.mint)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason: 'Admin console action' }),
      }),
    )) void load();
  };

  return (
    <>
      <div className="toolbar">
        <input
          id="search-tokens"
          placeholder="Search symbol, name, or mint address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); void load(); } }}
        />
        <button id="btn-search-tokens" className="primary" onClick={() => { setPage(0); void load(); }}>
          <Search size={14} /> Search
        </button>
      </div>
      <ErrorBox error={action.error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Mint</th>
              <th>Creator</th>
              <th>Status</th>
              <th>Supply</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.mint}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <strong>${t.symbol}</strong>
                    <span className="muted">{t.name}</span>
                  </div>
                </td>
                <td><span className="mono muted" title={t.mint}>{truncate(t.mint, 16)}</span></td>
                <td><span className="mono muted" title={t.creator}>{truncate(t.creator, 16)}</span></td>
                <td><span className={`pill ${t.status}`}>{t.status}</span></td>
                <td>
                  <span>{Number(t.currentSupply).toLocaleString()}</span>
                  <span className="muted"> / {Number(t.supplyCap).toLocaleString()}</span>
                </td>
                <td className="muted">{fmtDate(t.createdAt)}</td>
                <td>
                  <button id={`btn-token-toggle-${t.mint.slice(0,8)}`} className="small" onClick={() => void toggle(t)}>
                    {t.status === 'cancelled' ? 'Restore' : 'Hide'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tokens.length === 0 && <div className="empty"><Coins size={24} /><span>No tokens found.</span></div>}
        <Pager page={page} hasMore={tokens.length === 50} onChange={setPage} />
      </section>
    </>
  );
}

// ─── Finance ──────────────────────────────────────────────────────────────────
function FinanceView() {
  const [rows, setRows]   = useState<Withdrawal[]>([]);
  const [status, setStatus] = useState('');
  const [page, setPage]   = useState(0);
  const action = useAction();

  const load = () =>
    adminFetch<{ withdrawals: Withdrawal[] }>(
      `/admin/finance/withdrawals?limit=50&offset=${page * 50}${status ? `&status=${status}` : ''}`,
    )
      .then((d) => setRows(d.withdrawals))
      .catch((e: Error) => action.run(async () => { throw e; }));

  useEffect(() => { void load(); }, [status, page]);

  const update = async (row: Withdrawal, next: 'processing' | 'completed' | 'failed') => {
    const txHash = next === 'completed' ? window.prompt('Blockchain transaction hash:') : undefined;
    const reason = next === 'failed'    ? window.prompt('Failure reason:') || undefined  : undefined;
    if (next === 'completed' && !txHash) return;
    if (await action.run(() => adminFetch(`/admin/finance/withdrawals/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: next, txHash, reason }) })))
      void load();
  };

  return (
    <>
      <div className="toolbar">
        <select id="filter-withdrawal-status" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <ErrorBox error={action.error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>User wallet</th>
              <th>Destination</th>
              <th>Amount</th>
              <th>Asset</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td><span className={`pill ${w.status}`}>{w.status}</span></td>
                <td><span className="mono muted" title={w.userWallet}>{truncate(w.userWallet, 18)}</span></td>
                <td><span className="mono muted" title={w.destination}>{truncate(w.destination, 18)}</span></td>
                <td><strong>{(Number(w.amount) / 1e6).toFixed(2)}</strong></td>
                <td className="muted">{w.asset}</td>
                <td className="muted">{fmtDateTime(w.createdAt)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {w.status === 'pending' && (
                      <button id={`btn-process-${w.id}`} className="small" onClick={() => void update(w, 'processing')}>Process</button>
                    )}
                    {w.status === 'processing' && (
                      <button id={`btn-complete-${w.id}`} className="small" onClick={() => void update(w, 'completed')}>Complete</button>
                    )}
                    {['pending', 'processing'].includes(w.status) && (
                      <button id={`btn-fail-${w.id}`} className="small danger" onClick={() => void update(w, 'failed')}>Fail + Refund</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty"><WalletCards size={24} /><span>No withdrawals found.</span></div>}
        <Pager page={page} hasMore={rows.length === 50} onChange={setPage} />
      </section>
    </>
  );
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
function AuditView() {
  const [logs, setLogs] = useState<Audit[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    adminFetch<{ logs: Audit[] }>(`/admin/audit-logs?limit=50&offset=${page * 50}`).then((d) => setLogs(d.logs));
  }, [page]);

  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Admin</th>
            <th>Role</th>
            <th>Target</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td><span className="pill">{l.action}</span></td>
              <td>{l.adminUser.displayName}</td>
              <td><span className="muted">{l.adminUser.role.replace(/_/g, ' ')}</span></td>
              <td>
                {l.targetType
                  ? <><span style={{ textTransform: 'capitalize' }}>{l.targetType}</span>{' '}<span className="mono muted" title={l.targetId ?? ''}>{l.targetId ? truncate(l.targetId, 14) : ''}</span></>
                  : <span className="muted">—</span>}
              </td>
              <td className="muted">{fmtDateTime(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <div className="empty"><FileText size={24} /><span>No audit logs found.</span></div>}
      <Pager page={page} hasMore={logs.length === 50} onChange={setPage} />
    </section>
  );
}

// ─── Administrators ───────────────────────────────────────────────────────────
function AdminsView() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'viewer' });
  const action = useAction();

  const load = () =>
    adminFetch<{ admins: AdminRow[] }>('/admin/admin-users')
      .then((d) => setRows(d.admins))
      .catch((e: Error) => action.run(async () => { throw e; }));

  useEffect(() => { void load(); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (await action.run(() => adminFetch('/admin/admin-users', { method: 'POST', body: JSON.stringify(form) }))) {
      setForm({ email: '', password: '', displayName: '', role: 'viewer' });
      void load();
    }
  };

  const toggle = async (row: AdminRow) => {
    if (await action.run(() => adminFetch(`/admin/admin-users/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: row.status === 'active' ? 'suspended' : 'active' }) })))
      void load();
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2><Layers size={15} style={{ color: 'var(--blue)' }} /> Create administrator</h2>
        <form className="inline-form" onSubmit={create} id="create-admin-form">
          <input
            id="new-admin-displayname"
            placeholder="Display name"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            required
          />
          <input
            id="new-admin-email"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            id="new-admin-password"
            type="password"
            placeholder="Password (12+ chars)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={12}
          />
          <select id="new-admin-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="viewer">Viewer</option>
            <option value="support_admin">Support</option>
            <option value="moderation_admin">Moderation</option>
            <option value="token_admin">Token</option>
            <option value="finance_admin">Finance</option>
            <option value="super_admin">Super admin</option>
          </select>
          <button id="btn-create-admin" className="primary" type="submit">Create</button>
        </form>
      </div>
      <ErrorBox error={action.error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="admin-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{initials(r.displayName)}</div>
                    {r.displayName}
                  </div>
                </td>
                <td className="muted">{r.email}</td>
                <td><span className="pill">{r.role.replace(/_/g, ' ')}</span></td>
                <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td className="muted">{r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : 'Never'}</td>
                <td>
                  <button id={`btn-admin-toggle-${r.id}`} className="small" onClick={() => void toggle(r)}>
                    {r.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty"><UserCog size={24} /><span>No administrators found.</span></div>}
      </section>
    </>
  );
}
