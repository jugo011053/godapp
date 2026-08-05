import {
  archivePlan,
  getReturnOptions,
  isPlanExpired,
  reuseHistoryEntry
} from '../js/features/history/history.js';
import {
  mergeLocalStateIntoRemote,
  reduceSyncStatus,
  shouldOfferAccount
} from '../js/features/auth/auth.js';
import { SupabaseSessionClient } from '../js/core/supabase.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const oldPlan = {
  id: 'old-plan',
  selectedDates: ['2026-07-01', '2026-07-02'],
  days: {
    '2026-07-01': { dinner: { recipeId: 'r1' } },
    '2026-07-02': { dinner: { recipeId: 'r2' } }
  }
};

assert(isPlanExpired(oldPlan, new Date('2026-08-05T12:00:00')), 'Alter Plan muss abgelaufen sein.');
const archived = archivePlan({ planHistory: [] }, oldPlan);
assert(archived.planHistory.length === 1, 'Plan muss archiviert werden.');
const reused = reuseHistoryEntry(archived.planHistory[0], '2026-08-10');
assert(reused.selectedDates[0] === '2026-08-10', 'Wiederverwendung muss auf neues Startdatum verschieben.');
assert(getReturnOptions({ currentPlan: oldPlan, planHistory: archived.planHistory }, new Date('2026-08-05')).mode === 'no_active_plan', 'Abgelaufener Plan darf nicht aktiv wirken.');
assert(shouldOfferAccount({ currentPlan: reused, auth: null }), 'Account soll erst nach erzeugtem Wert angeboten werden.');

const syncState = reduceSyncStatus(undefined, { type: 'sync', status: 'offline' });
assert(syncState.pendingLocalChanges, 'Offline-Zustand muss lokale Änderungen erhalten.');

const merged = mergeLocalStateIntoRemote(
  { preferences: { favoriteRecipeIds: ['a'], excludedRecipeIds: [] }, planHistory: [] },
  { preferences: { favoriteRecipeIds: ['b'], excludedRecipeIds: [] }, planHistory: [] }
);
assert(merged.preferences.favoriteRecipeIds.length === 2, 'Favoriten müssen beim ersten Sync vereinigt werden.');

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
};
let calls = 0;
const client = new SupabaseSessionClient({
  supabaseUrl: 'https://example.supabase.co',
  anonKey: 'anon',
  storage,
  fetchImpl: async () => {
    calls += 1;
    return new Response(JSON.stringify({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});
client.setSession({ access_token: 'old', refresh_token: 'refresh', expires_in: 0 });
const token = await client.getValidAccessToken();
assert(token === 'new-access' && calls === 1, 'Abgelaufene Sitzung muss einmal erneuert werden.');

console.info('[Preply V8] Session-/Historien-Smoke-Test erfolgreich.');
