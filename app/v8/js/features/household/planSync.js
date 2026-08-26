import { getClient, currentUser } from '../auth/account.js';

/* --- Geteilter Plan und geteilte Einkaufsliste ---------------------------

   Bis v8.34 war der Haushalt ein Code und eine Mitgliederzahl. Das Blatt
   versprach "ein Plan, eine Einkaufsliste", die App schrieb aber nie in
   meal_plans, meal_plan_entries oder shopping_items.

   Geteilt wird, WAS gekocht wird — Gericht, Tag, Mahlzeit, Vorkoch-Gruppe.
   NICHT geteilt werden die Portionsgroessen: die rechnet jedes Geraet aus dem
   eigenen Profil. Zwei Menschen im selben Haushalt haben verschiedenen Bedarf,
   und ein uebernommener portionFactor waere fuer den anderen schlicht falsch. */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readJson(response) {
  if (!response.ok || response.status === 204) return null;
  return response.json().catch(() => null);
}

/* Vorkoch-Gruppen tragen in der App eine Kennung wie "dinner-2026-09-01",
   die Spalte ist aber eine Zahl. Beim Schreiben durchnummerieren, beim Lesen
   aus Tag und Mahlzeit wieder aufbauen. */
function groupNumbers(days) {
  const numbers = new Map();
  for (const day of days) {
    for (const meal of Object.values(day.meals || {})) {
      if (meal?.prepGroupId && !numbers.has(meal.prepGroupId)) {
        numbers.set(meal.prepGroupId, numbers.size + 1);
      }
    }
  }
  return numbers;
}

export function planToRows(plan, { householdId, ownerId }) {
  const days = Array.isArray(plan.days) ? plan.days : Object.values(plan.days || {});
  const numbers = groupNumbers(days);
  const entries = [];

  for (const day of days) {
    for (const [category, meal] of Object.entries(day.meals || {})) {
      if (!meal) continue;
      entries.push({
        day_date: day.date,
        category,
        recipe_id: meal.recipeId || meal.recipe?.id || null,
        prep_group: meal.prepGroupId ? numbers.get(meal.prepGroupId) : null,
        /* Genug, um den Plan auch dann noch zu zeigen, wenn ein Rezept
           aus dem Katalog verschwindet. Mengen absichtlich nicht. */
        recipe_snapshot: {
          name: meal.recipe?.name || null,
          prepGroupId: meal.prepGroupId || null,
          prepSourceDate: meal.prepSourceDate || null,
          repeatedForMealPrep: Boolean(meal.repeatedForMealPrep),
          pinned: Boolean(meal.pinned)
        }
      });
    }
  }

  return {
    planRow: {
      household_id: householdId,
      owner_id: ownerId,
      week_start: plan.startDate,
      meta: {
        id: plan.id,
        createdAt: plan.createdAt,
        endDate: plan.endDate,
        selectedDates: plan.selectedDates,
        enabledMeals: plan.enabledMeals
      },
      updated_at: new Date().toISOString()
    },
    entries
  };
}

/* Beim Uebernehmen wird jede Mahlzeit mit dem EIGENEN Profil neu bemessen. */
export function rowsToPlan(planRow, entryRows, { recipesById, scaleMeal }) {
  const meta = planRow.meta || {};
  const byDate = new Map();

  for (const row of entryRows) {
    if (!byDate.has(row.day_date)) byDate.set(row.day_date, { date: row.day_date, meals: {} });
    const snapshot = row.recipe_snapshot || {};
    const recipe = recipesById.get(row.recipe_id);
    /* Ein Rezept, das der Katalog nicht mehr fuehrt — etwa weil es nicht mehr
       planbar ist —, darf die Mahlzeit nicht verschwinden lassen. Dann steht
       eben nur der Name da, statt dass der Tag still leer wird. */
    const ersatz = recipe || (snapshot.name
      ? { id: row.recipe_id, name: snapshot.name, kcal: 0, protein: 0, ingredients: [], steps: [] }
      : null);
    if (!ersatz) continue;
    byDate.get(row.day_date).meals[row.category] = {
      ...scaleMeal(ersatz, row.category),
      unavailable: !recipe,
      prepGroupId: snapshot.prepGroupId || null,
      prepSourceDate: snapshot.prepSourceDate || null,
      repeatedForMealPrep: Boolean(snapshot.repeatedForMealPrep),
      pinned: Boolean(snapshot.pinned)
    };
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: meta.id || planRow.id,
    createdAt: meta.createdAt || planRow.created_at,
    startDate: planRow.week_start,
    endDate: meta.endDate || days[days.length - 1]?.date || planRow.week_start,
    selectedDates: meta.selectedDates || days.map((day) => day.date),
    enabledMeals: meta.enabledMeals || [...new Set(days.flatMap((d) => Object.keys(d.meals)))],
    days,
    sharedAt: planRow.updated_at
  };
}

/* --- Netzwerk ------------------------------------------------------------ */

async function currentPlanRow(householdId) {
  const response = await getClient().authorizedFetch(
    `/rest/v1/meal_plans?household_id=eq.${householdId}&select=*&order=updated_at.desc&limit=1`
  );
  return (await readJson(response) || [])[0] || null;
}

export async function pushPlan(plan, householdId) {
  const user = currentUser();
  if (!user || !householdId || !plan?.startDate) return null;
  const client = getClient();
  const { planRow, entries } = planToRows(plan, { householdId, ownerId: user.id });

  let row = await currentPlanRow(householdId);
  if (row) {
    await client.authorizedFetch(`/rest/v1/meal_plans?id=eq.${row.id}`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(planRow)
    });
    /* Eintraege komplett ersetzen: ein Plan ist ein Ganzes, und ein
       teilweise ersetzter waere schlimmer als ein neuer. */
    await client.authorizedFetch(`/rest/v1/meal_plan_entries?meal_plan_id=eq.${row.id}`, { method: 'DELETE' });
  } else {
    const created = await client.authorizedFetch('/rest/v1/meal_plans', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify(planRow)
    });
    row = (await readJson(created) || [])[0];
  }
  if (!row) return null;

  if (entries.length) {
    await client.authorizedFetch('/rest/v1/meal_plan_entries', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify(entries.map((entry) => ({ ...entry, meal_plan_id: row.id })))
    });
  }
  return { id: row.id, updatedAt: planRow.updated_at };
}

export async function pullPlan(householdId, options) {
  if (!householdId) return null;
  const row = await currentPlanRow(householdId);
  if (!row) return null;
  const response = await getClient().authorizedFetch(
    `/rest/v1/meal_plan_entries?meal_plan_id=eq.${row.id}&select=*&order=day_date.asc`
  );
  const entries = await readJson(response) || [];
  if (!entries.length) return null;
  return rowsToPlan(row, entries, options);
}

/* --- Abgehakte Einkaeufe -------------------------------------------------

   Bewusst in households.settings statt in shopping_items: die Posten der
   Liste entstehen aus dem Plan und haben keinen stabilen Schluessel in der
   Datenbank. Ein Haken ist ausserdem eine winzige Angabe — dafuer braucht es
   keine eigene Zeile je Zutat und keine Schemaaenderung. */

export async function pullShoppingChecks(householdId) {
  if (!householdId) return null;
  const response = await getClient().authorizedFetch(
    `/rest/v1/households?id=eq.${householdId}&select=settings`
  );
  const rows = await readJson(response) || [];
  return rows[0]?.settings?.shoppingChecks || null;
}

export async function pushShoppingChecks(householdId, checks) {
  const user = currentUser();
  if (!user || !householdId) return null;
  const response = await getClient().authorizedFetch(
    `/rest/v1/households?id=eq.${householdId}&select=settings`
  );
  const settings = (await readJson(response) || [])[0]?.settings || {};
  await getClient().authorizedFetch(`/rest/v1/households?id=eq.${householdId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      settings: { ...settings, shoppingChecks: checks, shoppingCheckedBy: user.email || user.id },
      updated_at: new Date().toISOString()
    })
  });
  return true;
}

/* Zusammenfuehren: ein Haken, den einer gesetzt hat, gilt. Ein Haken, den
   einer weggenommen hat, ebenfalls — die letzte Aenderung je Posten
   entscheidet, und ohne Zeitstempel je Posten ist die Vereinigung die
   freundlichere Annahme: lieber einmal zu viel im Wagen als zweimal. */
export function mergeChecks(local = {}, remote = {}) {
  const merged = { ...remote };
  for (const [key, value] of Object.entries(local)) if (value) merged[key] = true;
  return merged;
}
