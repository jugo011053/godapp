import { SupabaseSessionClient, AuthSessionError } from '../../core/supabase.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../core/supabaseConfig.js';
import { emit } from '../../core/events.js';

/* Anmeldung ueber E-Mail und Passwort.

   Bewusst nicht der OAuth-Weg aus v7: der uebernahm jedes `#access_token` aus
   der Adresszeile ungeprueft, ohne state-Parameter und ohne Gegenprobe beim
   Server. Ein praeparierter Link loggte das Opfer still in einen fremden
   Account. Kommt hier nicht wieder rein. */

let client = null;

export function getClient() {
  if (!client) {
    client = new SupabaseSessionClient({
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      onStatus: (event) => emit('sync:status', event)
    });
  }
  return client;
}

const USER_KEY = 'preply_v8_auth_user_v1';

function rememberUser(user) {
  if (!user) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email }));
  return user || null;
}

export function currentUser() {
  if (!getClient().getSession()) return null;
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

export function isSignedIn() {
  return Boolean(getClient().getSession() && currentUser());
}

/* Die Fehlertexte von Supabase sind englisch und technisch. Was der Nutzer
   falsch gemacht haben koennte, steht hier auf Deutsch. */
const MESSAGES = {
  invalid_credentials: 'E-Mail oder Passwort stimmt nicht.',
  email_exists: 'Zu dieser E-Mail gibt es schon ein Konto. Melde dich an.',
  user_already_exists: 'Zu dieser E-Mail gibt es schon ein Konto. Melde dich an.',
  weak_password: 'Das Passwort ist zu schwach. Nimm mindestens acht Zeichen.',
  over_email_send_rate_limit: 'Zu viele Versuche. Warte einen Moment.',
  validation_failed: 'Bitte gib eine gültige E-Mail-Adresse ein.'
};

async function authRequest(path, body) {
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new AuthSessionError('Keine Verbindung. Versuch es gleich noch einmal.', 'network_error', error);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.error_code || payload.error || '';
    throw new AuthSessionError(
      MESSAGES[code] || payload.msg || payload.error_description || 'Das hat nicht geklappt.',
      code || 'auth_failed',
      payload
    );
  }
  return payload;
}

export function validatePassword(password) {
  if (String(password || '').length < 8) return 'Mindestens acht Zeichen.';
  return null;
}

export async function signUp(email, password) {
  const problem = validatePassword(password);
  if (problem) throw new AuthSessionError(problem, 'weak_password');

  const payload = await authRequest('signup', { email: String(email).trim(), password });
  /* Ist Bestaetigung per E-Mail eingeschaltet, kommt hier noch keine Sitzung. */
  if (payload.access_token) {
    getClient().setSession(payload);
    rememberUser(payload.user);
    emit('auth:changed', { user: currentUser() });
    return { user: currentUser(), needsConfirmation: false };
  }
  return { user: null, needsConfirmation: true };
}

export async function signIn(email, password) {
  const payload = await authRequest('token?grant_type=password', {
    email: String(email).trim(),
    password
  });
  getClient().setSession(payload);
  rememberUser(payload.user);
  emit('auth:changed', { user: currentUser() });
  return currentUser();
}

export async function signOut() {
  const token = getClient().getSession()?.access_token;
  if (token) {
    /* Scheitert das Abmelden am Server, ist die lokale Sitzung trotzdem weg —
       sonst bliebe der Nutzer gegen seinen Willen angemeldet. */
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  getClient().clearSession();
  rememberUser(null);
  emit('auth:changed', { user: null });
}

export { AuthSessionError };
