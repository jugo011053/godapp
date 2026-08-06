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

export function reuseHistoryEntry(entry, startDate) {
  if (!entry) throw new TypeError('Historieneintrag fehlt.');
  const oldDates = sortDates(entry.selectedDates || Object.keys(entry.meals || {}));
  if (!oldDates.length) throw new TypeError('Historieneintrag enthält keine Tage.');

  const targetStart = new Date(`${startDate}T12:00:00`);
  const sourceStart = new Date(`${oldDates[0]}T12:00:00`);
  const offsetDays = Math.round((targetStart - sourceStart) / 86400000);
  const days = {};
  const selectedDates = [];

  for (const oldDate of oldDates) {
    const date = new Date(`${oldDate}T12:00:00`);
    date.setDate(date.getDate() + offsetDays);
    const newDate = date.toISOString().slice(0, 10);
    selectedDates.push(newDate);
    days[newDate] = clone(entry.meals?.[oldDate] || {});
  }

  return {
    id: `plan-${selectedDates[0]}-${Date.now()}`,
    selectedDates,
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
