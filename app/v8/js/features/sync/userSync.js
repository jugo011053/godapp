import { getClient, currentUser } from '../auth/account.js';
import { mergeLocalStateIntoRemote } from '../auth/auth.js';

/* --- Abbildung zwischen App-Profil und Tabelle ---------------------------
   Die Tabelle `profiles` gibt es seit v7 und hatte bis heute null Zeilen —
   alles lag als ein JSONB-Klumpen in `user_state`. Was der Planer filtert,
   bekommt jetzt eine echte Spalte: abfragbar, und die CHECK-Bedingungen in der
   Datenbank fangen Tippfehler ab, statt sie still versacken zu lassen. */

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];

function mealsToArray(enabledMeals = {}) {
  return MEAL_KEYS.filter((key) => enabledMeals[key]);
}

function mealsToObject(list) {
  const meals = Object.fromEntries(MEAL_KEYS.map((key) => [key, false]));
  for (const key of Array.isArray(list) ? list : []) if (key in meals) meals[key] = true;
  return meals;
}

/* Das Alter wandert als Geburtsjahr in die Datenbank. Es altert dann von
   selbst mit, statt nach einem Jahr falsch zu sein. */
function ageToBirthYear(age) {
  const value = Number(age);
  return Number.isFinite(value) && value > 0 ? new Date().getFullYear() - Math.round(value) : null;
}

function birthYearToAge(year) {
  const value = Number(year);
  return Number.isFinite(value) && value > 1900 ? new Date().getFullYear() - value : null;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DIET_STYLES = ['omnivore', 'vegetarian', 'vegan', 'pescatarian'];
const COOKING_STYLES = ['fresh', 'mixed', 'meal_prep'];
const GOALS = ['lose', 'maintain', 'gain'];

/* Die Datenbank weist unbekannte Werte per CHECK zurueck. Lieber hier auf NULL
   setzen, als die ganze Synchronisierung an einem Tippfehler scheitern lassen. */
function oneOf(value, allowed) {
  return allowed.includes(value) ? value : null;
}

export function profileToRow(profile = {}, userId) {
  return {
    user_id: userId,
    gender: profile.sex || null,
    birth_year: ageToBirthYear(profile.age),
    weight_kg: num(profile.weight),
    height_cm: num(profile.height),
    activity: profile.activity || null,
    goal: oneOf(profile.goal, GOALS),
    diet_style: oneOf(profile.dietStyle, DIET_STYLES),
    allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
    calorie_target: num(profile.calorieTarget),
    protein_target_g: num(profile.proteinTarget),
    prep_days: [1, 2, 3].includes(Number(profile.prepDays)) ? Number(profile.prepDays) : 2,
    persons: Math.max(1, Number(profile.persons) || 1),
    cooking_style: oneOf(profile.cookingStyle, COOKING_STYLES),
    max_cooking_time: num(profile.maxCookingTime),
    simplicity: profile.simplicity || null,
    priorities: Array.isArray(profile.priorities) ? profile.priorities : [],
    excluded_ingredients: Array.isArray(profile.excludedIngredients) ? profile.excludedIngredients : [],
    enabled_meals: mealsToArray(profile.enabledMeals),
    onboarding_done: Boolean(profile.calorieTarget),
    /* Es gibt keine halal-Spalte; settings ist der vorgesehene Platz fuer
       Merkmale, die kein eigenes Feld haben. */
    settings: { halal: Boolean(profile.halal) },
    updated_at: new Date().toISOString()
  };
}

export function rowToProfile(row = {}) {
  return {
    sex: row.gender || null,
    age: birthYearToAge(row.birth_year),
    weight: num(row.weight_kg),
    height: num(row.height_cm),
    activity: row.activity || 'light',
    goal: row.goal || null,
    dietStyle: row.diet_style && row.diet_style !== 'normal' ? row.diet_style : 'omnivore',
    allergies: row.allergies || [],
    calorieTarget: num(row.calorie_target),
    proteinTarget: num(row.protein_target_g),
    prepDays: num(row.prep_days) ?? 2,
    persons: num(row.persons) ?? 1,
    cookingStyle: row.cooking_style || 'mixed',
    maxCookingTime: num(row.max_cooking_time) ?? 30,
    simplicity: row.simplicity || 'balanced',
    priorities: row.priorities || [],
    excludedIngredients: row.excluded_ingredients || [],
    halal: Boolean(row.settings?.halal),
    enabledMeals: mealsToObject(row.enabled_meals)
  };
}

/* --- Netzwerk ----------------------------------------------------------- */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readJson(response) {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

export async function pullRemote() {
  const user = currentUser();
  if (!user) return null;
  const client = getClient();

  const [profileRes, stateRes, favRes, feedbackRes] = await Promise.all([
    client.authorizedFetch(`/rest/v1/profiles?user_id=eq.${user.id}&select=*`),
    client.authorizedFetch(`/rest/v1/user_state?user_id=eq.${user.id}&select=state`),
    client.authorizedFetch(`/rest/v1/favorites?user_id=eq.${user.id}&select=recipe_id`),
    client.authorizedFetch(`/rest/v1/recipe_feedback?user_id=eq.${user.id}&select=recipe_id,verdict`)
  ]);

  const profileRow = (await readJson(profileRes) || [])[0] || null;
  const stateRow = (await readJson(stateRes) || [])[0] || null;
  const favorites = (await readJson(favRes) || []).map((row) => row.recipe_id);
  const feedback = await readJson(feedbackRes) || [];

  return {
    profile: profileRow ? rowToProfile(profileRow) : null,
    state: stateRow?.state || null,
    favoriteRecipeIds: favorites,
    excludedRecipeIds: feedback.filter((row) => row.verdict === 'hidden').map((row) => row.recipe_id)
  };
}

/* Favoriten und Ausgeblendetes sind Zeilen, keine Liste in einem Klumpen.
   Deshalb wird die Differenz geschrieben, nicht alles neu. */
async function syncIdSet(path, userId, wanted, remote, extraFields = {}) {
  const client = getClient();
  const wantedSet = new Set(wanted);
  const remoteSet = new Set(remote);
  const toAdd = [...wantedSet].filter((id) => !remoteSet.has(id));
  const toRemove = [...remoteSet].filter((id) => !wantedSet.has(id));

  if (toAdd.length) {
    await client.authorizedFetch(`/rest/v1/${path}`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(toAdd.map((id) => ({ user_id: userId, recipe_id: id, ...extraFields })))
    });
  }
  if (toRemove.length) {
    const list = toRemove.map((id) => `"${id}"`).join(',');
    await client.authorizedFetch(
      `/rest/v1/${path}?user_id=eq.${userId}&recipe_id=in.(${encodeURIComponent(list)})`,
      { method: 'DELETE' }
    );
  }
  return { added: toAdd.length, removed: toRemove.length };
}

export async function pushLocal(state, remote = { favoriteRecipeIds: [], excludedRecipeIds: [] }) {
  const user = currentUser();
  if (!user) return null;
  const client = getClient();
  const preferences = state.preferences || {};

  await client.authorizedFetch('/rest/v1/profiles', {
    method: 'POST',
    headers: { ...JSON_HEADERS, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(profileToRow(state.profile || {}, user.id))
  });

  await client.authorizedFetch('/rest/v1/user_state', {
    method: 'POST',
    headers: { ...JSON_HEADERS, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: user.id,
      state,
      schema_ver: 9,
      updated_at: new Date().toISOString()
    })
  });

  const favorites = await syncIdSet('favorites', user.id,
    preferences.favoriteRecipeIds || [], remote.favoriteRecipeIds || []);
  const hidden = await syncIdSet('recipe_feedback', user.id,
    preferences.excludedRecipeIds || [], remote.excludedRecipeIds || [], { verdict: 'hidden' });

  return { favorites, hidden };
}

/* Zusammenfuehren statt ersetzen: wer sich auf einem zweiten Geraet anmeldet,
   soll seine dortige Arbeit nicht verlieren. */
export function mergeForSync(localState, remote) {
  if (!remote) return localState;
  const remoteState = remote.state || {};
  const merged = mergeLocalStateIntoRemote(localState, remoteState);

  return {
    ...merged,
    /* Das Profil aus der Datenbank gilt nur dort, wo lokal nichts steht. */
    profile: { ...(remote.profile || {}), ...(remoteState.profile || {}), ...(localState.profile || {}) },
    preferences: {
      ...merged.preferences,
      favoriteRecipeIds: [...new Set([
        ...(remote.favoriteRecipeIds || []),
        ...(merged.preferences?.favoriteRecipeIds || [])
      ])],
      excludedRecipeIds: [...new Set([
        ...(remote.excludedRecipeIds || []),
        ...(merged.preferences?.excludedRecipeIds || [])
      ])]
    }
  };
}

export async function syncNow(localState) {
  const remote = await pullRemote();
  const merged = mergeForSync(localState, remote);
  await pushLocal(merged, remote || undefined);
  return merged;
}
