const SESSION_KEY = 'preply_v8_auth_session_v1';
const REFRESH_MARGIN_MS = 90_000;

function safeParse(value) {
  try { return value ? JSON.parse(value) : null; }
  catch { return null; }
}

export class AuthSessionError extends Error {
  constructor(message, code, cause = null) {
    super(message);
    this.name = 'AuthSessionError';
    this.code = code;
    this.cause = cause;
  }
}

export class SupabaseSessionClient {
  constructor({ supabaseUrl, anonKey, fetchImpl, storage = localStorage, onStatus = () => {} }) {
    if (!supabaseUrl || !anonKey) throw new TypeError('Supabase URL und Anon-Key sind erforderlich.');
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
    /* fetch braucht window als this. Stand hier als `fetchImpl = fetch` und
       wurde als `this.fetchImpl(...)` aufgerufen — im Browser ist das ein
       "Illegal invocation", das als Netzwerkfehler durchgereicht wurde. */
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args));
    this.storage = storage;
    this.onStatus = onStatus;
    this.refreshPromise = null;
  }

  getSession() {
    return safeParse(this.storage.getItem(SESSION_KEY));
  }

  setSession(session) {
    if (!session?.access_token || !session?.refresh_token) {
      throw new AuthSessionError('Unvollständige Sitzung.', 'invalid_session');
    }
    const expiresAt = session.expires_at
      ? Number(session.expires_at) * 1000
      : Date.now() + Number(session.expires_in || 3600) * 1000;
    const stored = { ...session, expiresAt };
    this.storage.setItem(SESSION_KEY, JSON.stringify(stored));
    this.onStatus({ type: 'session', status: 'active', expiresAt });
    return stored;
  }

  clearSession(reason = 'signed_out') {
    this.storage.removeItem(SESSION_KEY);
    this.onStatus({ type: 'session', status: reason });
  }

  needsRefresh(session = this.getSession()) {
    return Boolean(session?.refresh_token && (!session.expiresAt || session.expiresAt - Date.now() <= REFRESH_MARGIN_MS));
  }

  async refreshSession() {
    if (this.refreshPromise) return this.refreshPromise;
    const session = this.getSession();
    if (!session?.refresh_token) {
      throw new AuthSessionError('Kein Refresh-Token vorhanden.', 'missing_refresh_token');
    }

    this.refreshPromise = this.fetchImpl(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }).then(async (response) => {
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        if ([400, 401, 403].includes(response.status)) this.clearSession('expired');
        throw new AuthSessionError(
          `Sitzung konnte nicht erneuert werden (${response.status}).`,
          'refresh_failed',
          detail
        );
      }
      return this.setSession(await response.json());
    }).catch((error) => {
      this.onStatus({ type: 'sync', status: 'offline_or_failed', error });
      if (error instanceof AuthSessionError) throw error;
      throw new AuthSessionError('Netzwerkfehler beim Erneuern der Sitzung.', 'network_error', error);
    }).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async getValidAccessToken() {
    let session = this.getSession();
    if (!session) return null;
    if (this.needsRefresh(session)) session = await this.refreshSession();
    return session.access_token;
  }

  async authorizedFetch(path, options = {}) {
    const execute = async (allowRetry) => {
      const accessToken = await this.getValidAccessToken();
      const headers = new Headers(options.headers || {});
      headers.set('apikey', this.anonKey);
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

      let response;
      try {
        response = await this.fetchImpl(`${this.supabaseUrl}${path}`, { ...options, headers });
      } catch (error) {
        this.onStatus({ type: 'sync', status: 'offline', error });
        throw new AuthSessionError('Synchronisierung ist gerade nicht erreichbar.', 'network_error', error);
      }

      if (response.status === 401 && allowRetry && this.getSession()?.refresh_token) {
        await this.refreshSession();
        return execute(false);
      }

      if (!response.ok) {
        this.onStatus({ type: 'sync', status: 'failed', httpStatus: response.status });
      } else {
        this.onStatus({ type: 'sync', status: 'ok' });
      }
      return response;
    };

    return execute(true);
  }
}

export { SESSION_KEY };
