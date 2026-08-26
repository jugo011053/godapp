import { getClient, currentUser } from '../auth/account.js';

/* Der Haushalt liegt seit v7 in der Datenbank: `households`, `household_members`
   und die beiden RPCs. Beim Wiederanschluss am 2026-08-26 fiel auf, dass
   join_household nur das alte Praefix `D1-` entfernte — ein Code im heutigen
   Format `PREP-XXXXXX` wurde nie gefunden. Ist in der Datenbank behoben; die
   App schickt den Code so, wie der Nutzer ihn eingibt. */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function formatInviteCode(code) {
  return code ? `PREP-${String(code).toUpperCase()}` : '';
}

async function rpc(name, body) {
  const response = await getClient().authorizedFetch(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || '';
    if (/nicht gefunden/i.test(message)) throw new Error('Diesen Code gibt es nicht. Tippfehler?');
    if (/nicht angemeldet/i.test(message)) throw new Error('Dafür musst du angemeldet sein.');
    throw new Error('Das hat nicht geklappt. Versuch es gleich noch einmal.');
  }
  return payload;
}

export async function currentHousehold() {
  if (!currentUser()) return null;
  const response = await getClient().authorizedFetch(
    '/rest/v1/households?select=id,name,invite_code,created_by,household_members(user_id,role,display_name,joined_at)'
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

export async function createHousehold(name = 'Haushalt') {
  return rpc('create_household', { p_name: name });
}

export async function joinHousehold(code) {
  const cleaned = String(code || '').trim();
  if (!cleaned) throw new Error('Bitte gib einen Code ein.');
  return rpc('join_household', { p_code: cleaned });
}

/* Austreten laeuft ueber die eigene Mitgliedszeile — die DELETE-Policy erlaubt
   genau das und nichts weiter. */
export async function leaveHousehold(householdId) {
  const user = currentUser();
  if (!user) return;
  await getClient().authorizedFetch(
    `/rest/v1/household_members?household_id=eq.${householdId}&user_id=eq.${user.id}`,
    { method: 'DELETE' }
  );
}
