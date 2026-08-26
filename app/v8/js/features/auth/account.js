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

async function authRequest(path, body, query = null) {
  let response;
  const url = new URL(`${SUPABASE_URL}/auth/v1/${path}`);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
  try {
    response = await fetch(url.toString(), {
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

/* --- Anmeldung ueber Google (PKCE) ---------------------------------------

   v7 benutzte den impliziten Weg: Google schickte das Zugangstoken als
   #access_token in der Adresszeile zurueck, und die App uebernahm alles, was
   dort stand — ohne Pruefung, ohne state. Ein praeparierter Link loggte das
   Opfer still in einen fremden Account.

   PKCE dreht das um. Vor der Weiterleitung wird hier ein Zufallsgeheimnis
   erzeugt und nur seine Pruefsumme mitgeschickt. Zurueck kommt kein Token,
   sondern ein einmaliger Code, der ohne das Geheimnis wertlos ist. Ein
   untergeschobener Code laesst sich damit nicht einloesen. */

const VERIFIER_KEY = 'preply_v8_pkce_verifier_v1';
const INTENT_KEY = 'preply_v8_auth_intent_v1';

function base64url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createVerifier() {
  return base64url(crypto.getRandomValues(new Uint8Array(64)));
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/* Genau diese Adresse muss in Supabase unter Authentication → URL
   Configuration als Redirect-URL erlaubt sein, sonst weist Google ab. */
export function redirectTarget() {
  return `${location.origin}${location.pathname}`;
}

export async function signInWithGoogle() {
  const verifier = createVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(INTENT_KEY, 'oauth');
  const challenge = await challengeFor(verifier);
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', redirectTarget());
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 's256');
  location.assign(url.toString());
}

/* --- Rueckkehr von Google oder aus einer E-Mail --------------------------- */

export async function handleAuthRedirect() {
  /* Ein #access_token in der Adresszeile wird nicht angefasst, sondern
     entfernt. Genau darueber lief der Angriff in v7. */
  if (/access_token=|refresh_token=/.test(location.hash)) {
    console.warn('[Preply] Token in der Adresszeile ignoriert.');
    history.replaceState(null, '', location.pathname + location.search);
  }

  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const errorDescription = params.get('error_description');
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const intent = sessionStorage.getItem(INTENT_KEY);

  const cleanUrl = () => history.replaceState(null, '', location.pathname + location.hash);

  if (errorDescription) {
    cleanUrl();
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    return { status: 'error', message: decodeURIComponent(errorDescription) };
  }

  if (!code) return { status: 'none' };
  /* Ohne passendes Geheimnis stammt der Code nicht von uns. */
  if (!verifier) {
    cleanUrl();
    return { status: 'error', message: 'Dieser Anmeldelink gehört nicht zu diesem Gerät. Melde dich noch einmal an.' };
  }

  try {
    const payload = await authRequest('token?grant_type=pkce', {
      auth_code: code,
      code_verifier: verifier
    });
    getClient().setSession(payload);
    rememberUser(payload.user);
    emit('auth:changed', { user: currentUser() });
    return { status: intent === 'recovery' ? 'recovery' : 'signed_in', user: currentUser() };
  } catch (error) {
    return { status: 'error', message: error.message };
  } finally {
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    cleanUrl();
  }
}

/* --- Passwort vergessen -------------------------------------------------- */

export async function requestPasswordReset(email) {
  const verifier = createVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(INTENT_KEY, 'recovery');
  const challenge = await challengeFor(verifier);
  await authRequest('recover', {
    email: String(email).trim(),
    code_challenge: challenge,
    code_challenge_method: 's256',
    gotrue_meta_security: {}
  }, { redirect_to: redirectTarget() });
}

export async function setNewPassword(password) {
  const problem = validatePassword(password);
  if (problem) throw new AuthSessionError(problem, 'weak_password');
  const response = await getClient().authorizedFetch('/auth/v1/user', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new AuthSessionError(MESSAGES[payload.error_code] || 'Das Passwort konnte nicht gesetzt werden.', 'update_failed');
  }
  return true;
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
