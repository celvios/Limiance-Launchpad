const API = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:4000/api';

export type Admin = { id: string; email: string; displayName: string; role: string; status: string };
export type Session = { token: string; admin: Admin };

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem('limiance-admin-session'); return raw ? JSON.parse(raw) as Session : null; } catch { return null; }
}
export function saveSession(session: Session) { localStorage.setItem('limiance-admin-session', JSON.stringify(session)); }
export function clearSession() { localStorage.removeItem('limiance-admin-session'); }

export async function adminFetch<T>(path: string, options: RequestInit = {}) {
  const session = getSession();
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers ?? {}) } });
  if (response.status === 401) { clearSession(); throw new Error('Admin session expired'); }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.status}`);
  return data;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API}/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const data = await response.json() as { error?: string; token?: string; admin?: Admin };
  if (!response.ok || !data.token || !data.admin) throw new Error(data.error ?? 'Unable to sign in');
  const session = { token: data.token, admin: data.admin }; saveSession(session); return session;
}
