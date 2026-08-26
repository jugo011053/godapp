const DEFAULT_HISTORY_LIMIT = 12;

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function sortDates(dates = []) {
  return [...dates].filter(Boolean).sort();
}

export function getPlanDates(plan) {
  if (!plan) return [];
  if (Array.isArray(plan.selectedDates)) return sortDates(plan.selectedDates);
  if (plan.days && typeof plan.days === 'object') return sortDates(Object.keys(plan.days));
  return [];
}

export function getPlanRange(plan) {
  const dates = getPlanDates(plan);
  return {
    startDate: dates[0] || null,
    endDate: dates.at(-1) || null
  };
}

export function isPlanExpired(plan, today = new Date()) {
  const { endDate } = getPlanRange(plan);
  if (!endDate) return true;
  const localToday = typeof today === 'string'
    ? today.slice(0, 10)
    : new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return endDate < localToday;
}

export function archivePlan(state, plan, options = {}) {
  if (!plan) return state;
  const limit = Number(options.limit || DEFAULT_HISTORY_LIMIT);
  const { startDate, endDate } = getPlanRange(plan);
  const rawMeals = plan.days || plan.meals || {};
  const mealsObject = Array.isArray(rawMeals)
    ? Object.fromEntries(rawMeals.map((day) => [day.date, day.meals || {}]))
    : rawMeals;

  const entry = {
    id: plan.id || `plan-${startDate || 'unknown'}-${Date.now()}`,
    startDate,
    endDate,
    selectedDates: getPlanDates(plan),
    meals: clone(mealsObject),
    completedMeals: clone(plan.completedMeals || {}),
    archivedAt: new Date().toISOString()
  };

  const existing = Array.isArray(state.planHistory) ? state.planHistory : [];
  const history = [entry, ...existing.filter((item) => item.id !== entry.id)].slice(0, limit);
  return { ...state, planHistory: history };
}

export function replaceCurrentPlan(state, nextPlan, options = {}) {
  let nextState = state;
  if (state.currentPlan && state.currentPlan !== nextPlan) {
    nextState = archivePlan(state, state.currentPlan, options);
  }
  return { ...nextState, currentPlan: nextPlan || null };
}

/* Historieneinträge existieren in zwei Formen: archivePlan() schreibt meals{date},
   während direkt abgelegte Pläne noch days[] tragen. Beides muss lesbar sein. */
function mealsForDate(entry, date) {
  if (entry.meals?.[date]) return entry.meals[date];
  if (Array.isArray(entry.days)) return entry.days.find((day) => day.date === date)?.meals || {};
  if (entry.days && typeof entry.days === 'object') return entry.days[date] || {};
  return {};
}

function historyDates(entry) {
  if (Array.isArray(entry.selectedDates) && entry.selectedDates.length) return sortDates(entry.selectedDates);
  if (Array.isArray(entry.days)) return sortDates(entry.days.map((day) => day.date));
  if (entry.days && typeof entry.days === 'object') return sortDates(Object.keys(entry.days));
  return sortDates(Object.keys(entry.meals || {}));
}

export function reuseHistoryEntry(entry, startDate) {
  if (!entry) throw new TypeError('Historieneintrag fehlt.');
  const oldDates = historyDates(entry);
  if (!oldDates.length) throw new TypeError('Historieneintrag enthält keine Tage.');

  const targetStart = new Date(`${startDate}T12:00:00`);
  const sourceStart = new Date(`${oldDates[0]}T12:00:00`);
  const offsetDays = Math.round((targetStart - sourceStart) / 86400000);
  const days = [];
  const selectedDates = [];

  for (const oldDate of oldDates) {
    const date = new Date(`${oldDate}T12:00:00`);
    date.setDate(date.getDate() + offsetDays);
    const newDate = date.toISOString().slice(0, 10);
    selectedDates.push(newDate);
    days.push({ date: newDate, meals: clone(mealsForDate(entry, oldDate)) });
  }

  const enabledMeals = [...new Set(days.flatMap((day) =>
    Object.keys(day.meals || {})
  ))];

  return {
    id: `plan-${selectedDates[0]}-${Date.now()}`,
    startDate: selectedDates[0],
    endDate: selectedDates[selectedDates.length - 1],
    selectedDates,
    enabledMeals,
    days,
    reusedFromHistoryId: entry.id,
    createdAt: new Date().toISOString()
  };
}

export function getReturnOptions(state, today = new Date()) {
  const currentPlan = state?.currentPlan || null;
  const expired = isPlanExpired(currentPlan, today);
  if (currentPlan && !expired) {
    return {
      mode: 'active_plan',
      primaryAction: 'open_plan',
      actions: ['open_plan', 'inspiration_today', 'new_plan']
    };
  }

  return {
    mode: 'no_active_plan',
    primaryAction: 'inspiration_today',
    actions: [
      'inspiration_today',
      'new_plan',
      ...(state?.planHistory?.length ? ['open_history'] : [])
    ]
  };
}

/* --- Angepinnte Gerichte und Rueckgaengig ---------------------------------
   Ein Pin heisst "das will ich" — eine Festlegung, keine Schutzmassnahme.
   Wer selbst tauscht, pinnt automatisch; die Neuplanung respektiert das. */

export function localToday(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function normalizePlanDays(plan) {
  if (!plan) return [];
  if (Array.isArray(plan.days)) return plan.days;
  if (plan.days && typeof plan.days === 'object') {
    return Object.entries(plan.days)
      .map(([date, meals]) => ({ date, meals: meals || {} }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
}

export function setMealPinned(plan, date, category, pinned) {
  const days = normalizePlanDays(plan).map((day) => {
    if (day.date !== date) return day;
    const meal = day.meals?.[category];
    if (!meal) return day;
    return { ...day, meals: { ...day.meals, [category]: { ...meal, pinned: Boolean(pinned) } } };
  });
  return { ...plan, days };
}

export function countPinnedMeals(plan) {
  return normalizePlanDays(plan)
    .reduce((sum, day) => sum + Object.values(day.meals || {}).filter((m) => m?.pinned).length, 0);
}

export function clearAllPins(plan) {
  const days = normalizePlanDays(plan).map((day) => ({
    ...day,
    meals: Object.fromEntries(Object.entries(day.meals || {})
      .map(([cat, meal]) => [cat, { ...meal, pinned: false }]))
  }));
  return { ...plan, days };
}

/* Ein Gericht bleibt stehen, wenn es angepinnt ist oder der Tag vorbei ist.
   Vergangenes zu ersetzen ergibt nie Sinn — das ist keine Vermutung. */
export function protectedMeals(plan, today = localToday()) {
  const keep = [];
  for (const day of normalizePlanDays(plan)) {
    const past = day.date < today;
    for (const [category, meal] of Object.entries(day.meals || {})) {
      if (!meal) continue;
      if (past || meal.pinned) keep.push({ date: day.date, category, meal, reason: past ? 'past' : 'pinned' });
    }
  }
  return keep;
}

/* Legt die bewahrten Gerichte ueber einen frisch erzeugten Plan. */
export function applyProtectedMeals(nextPlan, keep) {
  if (!keep.length) return nextPlan;
  const byDate = new Map(normalizePlanDays(nextPlan).map((day) => [day.date, { ...day, meals: { ...day.meals } }]));
  for (const entry of keep) {
    const day = byDate.get(entry.date);
    if (!day) continue;
    day.meals[entry.category] = entry.meal;
  }
  return { ...nextPlan, days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

/* Rezepte der letzten Plaene — Grundlage fuer die Richtung "Immer dasselbe". */
export function recentRecipeIds(state, limit = 3) {
  const ids = new Set();
  const families = new Set();
  const entries = (state.planHistory || []).slice(0, limit);
  for (const entry of entries) {
    const meals = entry.meals && !Array.isArray(entry.meals)
      ? Object.values(entry.meals).flatMap((m) => Object.values(m || {}))
      : normalizePlanDays(entry).flatMap((day) => Object.values(day.meals || {}));
    for (const meal of meals) {
      const id = meal?.recipeId || meal?.recipe?.id;
      if (id) ids.add(id);
      const family = meal?.recipe?.familyKey;
      if (family) families.add(family);
    }
  }
  return { ids, families };
}

/* Stellt den zuletzt ersetzten Plan wieder her. */
export function undoLastPlanChange(state) {
  const history = state.planHistory || [];
  if (!history.length) return state;
  const [previous, ...rest] = history;
  const restored = {
    id: previous.id,
    startDate: previous.startDate,
    endDate: previous.endDate,
    selectedDates: previous.selectedDates || [],
    enabledMeals: previous.enabledMeals
      || [...new Set(Object.values(previous.meals || {}).flatMap((m) => Object.keys(m || {})))],
    days: Array.isArray(previous.days)
      ? previous.days
      : Object.entries(previous.meals || {})
          .map(([date, meals]) => ({ date, meals: meals || {} }))
          .sort((a, b) => a.date.localeCompare(b.date)),
    restoredAt: new Date().toISOString()
  };
  return { ...state, currentPlan: restored, planHistory: rest };
}

export function canUndoPlan(state) {
  return Boolean((state.planHistory || []).length);
}
