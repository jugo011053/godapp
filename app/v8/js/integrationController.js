import { getRoute, navigate } from './core/router.js';
import { getState, updateState, silentUpdate } from './core/store.js';
import { loadCards, getRecipe } from './data/recipeStore.js';
import { renderShell } from './features/shell/renderShell.js';
import {
  completeOnboarding,
  createOnboardingDraft,
  currentStep,
  isLastStep,
  nextStep,
  previousStep,
  updateDraft,
  validateOnboardingStep,
  ONBOARDING_STEPS
} from './features/onboarding/onboardingModel.js';
import {
  MEAL_OPTIONS, STEP_TITLES, DIET_OPTIONS, ALLERGEN_OPTIONS, STYLE_OPTIONS,
  SEXES, ACTIVITY_LEVELS, GOALS, BODY_LIMITS
} from './features/onboarding/onboardingSteps.js';
import { calorieTargetFor, proteinTargetFor, explainTarget } from './features/onboarding/nutrition.js';
import { buildPlan, suggestForToday, replacementSuggestions } from './features/planner/plannerEngine.js';
import { getReturnOptions, isPlanExpired, replaceCurrentPlan, setMealPinned } from './features/history/history.js';
import { resolveCalorieTarget, resolveProteinTarget } from './data/recipeScoring.js';
import { haptic } from './core/feel.js';
import { showToast } from './core/toast.js';
const runtime = {
  recipes: [],
  catalogStatus: 'loading',
  catalogError: null,
  suggestions: [],
  onboardingDraft: null,
  activeDialog: null,
  activePlanDay: null,
  expandedMeals: new Set(),
  detailCache: new Map(),
  replaceTarget: null,
  replaceMode: 'similar'
};

const PIN_ICON = '<svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6Z"/><path d="M12 14v7"/></svg>';

const MEAL_LABELS = Object.fromEntries(MEAL_OPTIONS);
const formatDay = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function localDate(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}


function tone(index) {
  return ['tone-lime', 'tone-lavender', 'tone-peach', 'tone-blue', 'tone-pink'][index % 5];
}


function catalogStatusHtml() {
  if (runtime.catalogStatus === 'loading') return '<div class="v8-status">Rezepte werden geladen …</div>';
  if (runtime.catalogStatus === 'error') return `<div class="v8-status error">${escapeHtml(runtime.catalogError || 'Rezepte konnten nicht geladen werden.')}</div>`;
  return '';
}

function catalogNotReadyFeedback(root) {
  if (runtime.catalogStatus === 'loading') {
    showToast(root, 'Rezepte werden noch geladen …');
    return true;
  }
  if (runtime.catalogStatus === 'error') {
    showToast(root, runtime.catalogError || 'Rezepte konnten nicht geladen werden.');
    return true;
  }
  if (!runtime.recipes.length) {
    showToast(root, 'Keine Rezepte verfügbar.');
    return true;
  }
  return false;
}

async function showRecipeDetail(root, recipeId) {
  try {
    let recipe = runtime.detailCache.get(recipeId);
    if (!recipe) {
      recipe = await getRecipe(recipeId);
      runtime.detailCache.set(recipeId, recipe);
    }
    const overlay = document.createElement('div');
    overlay.className = 'v8-overlay';
    overlay.dataset.dismissible = 'true';
    const stepsHtml = (recipe.steps || []).length
      ? `<div class="meal-steps-list">${recipe.steps.map((step, i) => `<div class="meal-step"><span class="step-num">${i + 1}</span><span>${escapeHtml(step)}</span></div>`).join('')}</div>`
      : '<p style="color:var(--muted);font-size:var(--text-sm)">Keine Zubereitungsschritte hinterlegt.</p>';
    overlay.innerHTML = `<section class="v8-dialog">
      <button class="v8-button ghost" data-detail-close style="margin-bottom:var(--space-2)">← Zurück</button>
      <h2>${escapeHtml(recipe.name)}</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--space-3)">
        <span class="preply-filter" style="pointer-events:none">${Math.round(recipe.kcal)} kcal</span>
        <span class="preply-filter" style="pointer-events:none">${Math.round(recipe.protein)} g Protein</span>
        <span class="preply-filter" style="pointer-events:none">${Math.round(recipe.time)} Min.</span>
      </div>
      <h3>Zutaten</h3>
      <div class="meal-ing-list">${(recipe.ingredients || []).map((item) =>
        `<div class="meal-ing-row"><span>${escapeHtml(item.name)}</span><b>${escapeHtml(item.amount ?? item.quantity ?? '')} ${escapeHtml(item.unit || '')}</b></div>`
      ).join('')}</div>
      <h3>Zubereitung</h3>
      ${stepsHtml}
    </section>`;
    root.appendChild(overlay);
    overlay.querySelector('[data-detail-close]').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  } catch (err) {
    console.warn('[Preply] Rezeptdetail nicht geladen', err);
  }
}

function normalizeDays(plan) {
  if (Array.isArray(plan.days)) return plan.days;
  if (plan.days && typeof plan.days === 'object') {
    return Object.entries(plan.days).map(([date, meals]) => ({ date, meals: meals || {} })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
}

function mealCardKey(date, category) {
  return `${date}::${category}`;
}

function computeDaySummary(dayData) {
  const meals = Object.entries(dayData.meals || {});
  let totalKcal = 0;
  let totalProtein = 0;
  for (const [, meal] of meals) {
    const recipe = meal.recipe || meal;
    totalKcal += meal.estimatedKcalPerPerson || Math.round(recipe.kcal || 0);
    totalProtein += meal.estimatedProteinPerPerson || Math.round(recipe.protein || 0);
  }
  return { totalKcal, totalProtein, mealCount: meals.length };
}

/* --- Vorkochen sichtbar machen ------------------------------------------
   Der Planer legt Gerichte ueber mehrere Tage zusammen (prepGroupId), zeigte
   das aber nirgends an. Dasselbe Gericht an zwei Tagen sah dadurch wie ein
   Fehler aus, obwohl es Absicht ist. */

const WEEKDAY_FMT = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

function shortDay(date) {
  if (!date) return '';
  return WEEKDAY_FMT.format(new Date(`${date}T12:00:00`)).replace('.', '');
}

export function prepGroupDates(days) {
  const groups = new Map();
  for (const day of days) {
    for (const meal of Object.values(day.meals || {})) {
      const id = meal?.prepGroupId;
      if (!id) continue;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(day.date);
    }
  }
  /* Ein "Gruppe" aus einem einzigen Tag ist keine — die wird nicht beschriftet. */
  for (const [id, dates] of groups) if (dates.length < 2) groups.delete(id);
  return groups;
}

/* In der zugeklappten Wochenliste faellt die Wiederholung zuerst auf — dort
   muss der Hinweis also auch stehen, nicht nur in der geoeffneten Karte. */
function prepMark(meal, groupDates) {
  if (!groupDates || groupDates.length < 2) return '';
  return meal.repeatedForMealPrep
    ? '<i class="preply-prep-mark is-repeat">schon gekocht</i>'
    : `<i class="preply-prep-mark">für ${groupDates.length} Tage</i>`;
}

function prepNote(meal, groupDates) {
  if (!groupDates || groupDates.length < 2) return '';
  if (meal.repeatedForMealPrep) {
    const from = shortDay(meal.prepSourceDate);
    return `<span class="preply-prep is-repeat">Schon gekocht${from ? ` am ${from}` : ''}</span>`;
  }
  return `<span class="preply-prep">Für ${groupDates.map(shortDay).join(' + ')} vorkochen</span>`;
}

function renderMealCard(date, category, meal, dayIndex, cardIndex, groupDates) {
  const recipe = meal.recipe || meal;
  const name = recipe.name || 'Unbekannt';
  const kcal = meal.estimatedKcalPerPerson || Math.round(recipe.kcal || 0);
  const protein = meal.estimatedProteinPerPerson || Math.round(recipe.protein || 0);
  const time = Math.round(recipe.time || 0);
  const key = mealCardKey(date, category);
  const isExpanded = runtime.expandedMeals.has(key);
  const detail = runtime.detailCache.get(recipe.id || recipe.recipeId);

  let expandedHtml = '';
  if (isExpanded) {
    const ingredients = detail?.ingredients || recipe.ingredients || [];
    const steps = detail?.steps || recipe.steps || [];
    expandedHtml = `<div class="meal-expanded">
      ${ingredients.length ? `<div class="meal-ing-list">${ingredients.map((item) =>
        `<div class="meal-ing-row"><span>${escapeHtml(item.name)}</span><b>${escapeHtml(item.amount ?? item.quantity ?? '')} ${escapeHtml(item.unit || '')}</b></div>`
      ).join('')}</div>` : ''}
      ${steps.length ? `<div class="meal-steps-list">${steps.map((step, index) =>
        `<div class="meal-step"><span class="step-num">${index + 1}</span><span>${escapeHtml(step)}</span></div>`
      ).join('')}</div>` : '<div style="padding:10px 14px;font-size:13px;color:var(--muted)">Keine Schritte hinterlegt.</div>'}
      <div class="meal-card-actions">
        <button class="v8-button ghost" data-swap-meal data-swap-day="${dayIndex}" data-swap-cat="${escapeHtml(category)}">⇄ Austauschen</button>
      </div>
    </div>`;
  }

  const pinned = Boolean(meal.pinned);
  const pinButton = `<button class="preply-pin${pinned ? ' pinned' : ''}" data-pin-meal data-pin-date="${escapeHtml(date)}" data-pin-cat="${escapeHtml(category)}" aria-pressed="${pinned}" aria-label="${pinned ? 'Gericht nicht mehr festhalten' : 'Dieses Gericht behalten'}">${PIN_ICON}</button>`;
  return `<div class="preply-meal${pinned ? ' is-pinned' : ''}" data-meal-key="${escapeHtml(key)}">
    <button class="preply-meal-main ${tone(cardIndex)}" data-expand-meal="${escapeHtml(key)}" data-recipe-id="${escapeHtml(recipe.id || '')}">
      <span class="preply-meal-slot">${escapeHtml(MEAL_LABELS[category] || category)}</span>
      <strong>${escapeHtml(name)}</strong>
      <em>${kcal} kcal · ${protein} g Protein · ${time} Min</em>
      ${prepNote(meal, groupDates)}
    </button>
    ${pinButton}
    ${isExpanded ? '' : `<button class="preply-swap" data-swap-meal data-swap-day="${dayIndex}" data-swap-cat="${escapeHtml(category)}" aria-label="${escapeHtml(MEAL_LABELS[category] || category)} tauschen">↻</button>`}
    ${isExpanded ? expandedHtml : ''}
  </div>`;
}

/* Was am Plan eingestellt ist, in einer Zeile — direkt ueber dem Ergebnis
   statt in einem Assistenten davor. */
function planSettingsLine(plan, profile) {
  const days = normalizeDays(plan);
  const meals = [...new Set(days.flatMap((day) => Object.keys(day.meals || {})))]
    .map((meal) => MEAL_LABELS[meal] || meal);
  const persons = Math.max(1, Number(profile.persons) || 1);
  return [
    `${days.length} ${days.length === 1 ? 'Tag' : 'Tage'}`,
    meals.join(', '),
    `${persons} ${persons === 1 ? 'Person' : 'Personen'}`
  ].filter(Boolean).join(' · ');
}

/* --- Woche: planen und anpassen ---------------------------------------- */

function renderPlanPage() {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan || isPlanExpired(plan)) return renderEmptyPlan();

  const days = normalizeDays(plan);
  const groups = prepGroupDates(days);
  if (!days.length) return renderEmptyPlan();

  const today = localDate(0);
  const profile = state.profile || {};
  const kcalTarget = Math.round(resolveCalorieTarget(profile));
  const proteinTarget = Math.round(resolveProteinTarget(profile));
  /* Der aufgeklappte Tag ist zugleich der, auf den sich "nur dieser Tag"
     beim Neuplanen bezieht. */
  const openDate = days.some((d) => d.date === runtime.activePlanDay) ? runtime.activePlanDay : null;

  return `<section class="v8-page preply-page">
    <div class="preply-kicker">Deine Woche</div>
    <h1 class="preply-title">Gut essen,<br>ohne nachzudenken.</h1>

    <div class="preply-target">
      <div><span>Tagesziel</span><b>${kcalTarget} <small>kcal</small></b></div>
      <div><span>Protein</span><b>${proteinTarget}<small> g</small></b></div>
      <p>Passt die Woche? Tippe auf einen Tag, um ihn einzeln anzupassen.</p>
    </div>

    <button class="preply-plan-settings" type="button" data-plan-settings>
      <span>${planSettingsLine(plan, profile)}</span><b>ändern</b>
    </button>

    <div class="preply-section"><h2>Deine Tage</h2><button data-action="create-plan">Neu zusammenstellen</button></div>

    <div class="preply-week-list">
      ${days.map((day, dayIndex) => {
        const total = computeDaySummary(day);
        const cats = Object.keys(day.meals || {}).filter((cat) => day.meals[cat]);
        const isToday = day.date === today;
        const isOpen = day.date === openDate;
        const dayName = isToday ? 'Heute' : new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date(`${day.date}T12:00:00`));
        const dateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(`${day.date}T12:00:00`));
        const pinnedHere = cats.filter((cat) => day.meals[cat]?.pinned).length;

        return `<div class="preply-week-card ${isToday ? 'today' : ''} ${isOpen ? 'expanded' : ''}"
                     data-active-day-index="${dayIndex}" ${isOpen ? `data-active-day-date="${day.date}"` : ''}>
          <button class="preply-week-head" data-plan-day="${day.date}" aria-expanded="${isOpen}">
            <div>
              <span>${escapeHtml(dayName)} · ${escapeHtml(dateShort)}</span>
              <strong>${cats.length} ${cats.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'}${pinnedHere ? ` · ${pinnedHere} fest` : ''}</strong>
            </div>
            <b>${total.totalKcal} kcal</b>
          </button>
          ${isOpen
            ? `<div class="preply-week-body">${cats.map((cat, idx) =>
                 renderMealCard(day.date, cat, day.meals[cat], dayIndex, idx, groups.get(day.meals[cat]?.prepGroupId))
               ).join('')}</div>`
            : `<div class="preply-week-meals">${cats.map((cat) =>
                 `<div class="preply-week-meal"><span>${escapeHtml(MEAL_LABELS[cat] || cat)}</span><strong>${escapeHtml((day.meals[cat].recipe || day.meals[cat]).name)}${prepMark(day.meals[cat], groups.get(day.meals[cat]?.prepGroupId))}</strong><b>›</b></div>`
               ).join('')}</div>`}
        </div>`;
      }).join('')}
    </div>

    <button class="preply-outline" onclick="location.hash='recipes'">Alle Rezepte durchsehen <span>→</span></button>
  </section>`;
}

/* --- Heute: kochen ----------------------------------------------------- */

function renderTodayPage() {
  const state = getState();
  const plan = state.currentPlan;
  const today = localDate(0);
  const profile = state.profile || {};

  if (!plan || isPlanExpired(plan)) {
    return `<section class="v8-page preply-page">
      <div class="preply-kicker">Heute</div>
      <h1 class="preply-title">Was kochst<br>du heute?</h1>
      <p class="preply-copy">Noch kein Plan. Erstelle einen, dann steht hier jeden Tag, was ansteht.</p>
      ${catalogStatusHtml()}
      <div class="v8-start-grid" style="margin-top:18px">
        <button class="v8-start-card primary" data-action="create-plan"><strong>Wochenplan erstellen</strong><span>Mehrere Tage planen, Einkaufsliste inklusive.</span></button>
        <button class="v8-start-card" data-action="single-day-plan"><strong>Nur für heute</strong><span>Ein Tag, passende Gerichte, sofort los.</span></button>
      </div>
    </section>`;
  }

  const days = normalizeDays(plan);
  const groups = prepGroupDates(days);
  const dayData = days.find((d) => d.date === today);

  if (!dayData) {
    const next = days.find((d) => d.date > today);
    return `<section class="v8-page preply-page">
      <div class="preply-kicker">Heute</div>
      <h1 class="preply-title">Heute ist<br>nichts geplant.</h1>
      <p class="preply-copy">${next
        ? `Der Plan beginnt am ${escapeHtml(new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${next.date}T12:00:00`)))}.`
        : 'Dein Plan liegt in der Vergangenheit.'}</p>
      <div class="v8-start-grid" style="margin-top:18px">
        <button class="v8-start-card primary" data-action="single-day-plan"><strong>Tag für heute planen</strong><span>Passende Gerichte, sofort los.</span></button>
      </div>
    </section>`;
  }

  const summary = computeDaySummary(dayData);
  const kcalTarget = Math.round(resolveCalorieTarget(profile));
  const dayIndex = days.indexOf(dayData);
  const cats = Object.keys(dayData.meals || {}).filter((cat) => dayData.meals[cat]);
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${today}T12:00:00`));

  return `<section class="v8-page preply-page">
    <div class="preply-kicker">${escapeHtml(weekday)}</div>
    <h1 class="preply-title">Heute<br>kochst du.</h1>

    <div class="preply-target">
      <div><span>Heute geplant</span><b>${summary.totalKcal} <small>von ${kcalTarget} kcal</small></b></div>
      <div><span>Protein</span><b>${summary.totalProtein}<small> g</small></b></div>
      <p>Tippe ein Gericht an, um Zutaten und Zubereitung zu sehen.</p>
    </div>

    <div class="preply-section"><h2>Deine Mahlzeiten</h2><button data-action="create-plan">Neu zusammenstellen</button></div>

    <div class="preply-plan-card" data-active-day-index="${dayIndex}" data-active-day-date="${today}">
      ${cats.map((cat, idx) => renderMealCard(today, cat, dayData.meals[cat], dayIndex, idx, groups.get(dayData.meals[cat]?.prepGroupId))).join('')}
    </div>

    <button class="preply-outline" onclick="location.hash='shopping'">Zur Einkaufsliste <span>→</span></button>
  </section>`;
}

function renderEmptyPlan() {
  return `<section class="v8-page preply-page">
    <div class="preply-kicker">Plan</div>
    <h1 class="preply-title">Was kochst<br>du?</h1>
    <p class="preply-copy">Erstelle einen Essensplan oder lass dich inspirieren.</p>
    ${catalogStatusHtml()}

    <div class="quick-suggest-card" data-action="today-inspiration" style="margin-top:18px">
      <h3>🍳 Was esse ich heute?</h3>
      <p>Schnelle Vorschläge passend zu deinem Profil</p>
    </div>

    <div class="v8-start-grid">
      <button class="v8-start-card primary" data-action="create-plan"><strong>Wochenplan erstellen</strong><span>Mehrere Tage planen, Einkaufsliste inklusive.</span></button>
      <button class="v8-start-card" data-action="single-day-plan"><strong>Nur für heute</strong><span>Ein Tag, passende Gerichte, sofort los.</span></button>
    </div>

    ${runtime.suggestions.length ? `
      <div style="margin-top:18px">
        <div class="preply-section"><h2>Vorschläge für dich</h2></div>
        ${runtime.suggestions.map((recipe, i) => `
          <div class="preply-discover-card" data-recipe-id="${escapeHtml(recipe.id)}">
            <span class="preply-mark ${tone(i)}"><i></i></span>
            <span>
              <small>${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)} · ${Math.round(recipe.time)} Min</small>
              <strong>${escapeHtml(recipe.name)}</strong>
              <em>${Math.round(recipe.kcal)} kcal · ${Math.round(recipe.protein)} g Protein</em>
            </span>
            <b>›</b>
          </div>
        `).join('')}
        <div class="v8-start-grid" style="margin-top:12px">
          <button class="v8-start-card primary" data-action="single-day-plan"><strong>Direkt loslegen</strong><span>Plan für heute erstellen</span></button>
        </div>
      </div>
    ` : ''}
  </section>`;
}

function renderRecipesPage() {
  /* Recipes rendering is handled by featureEnhancementsV2.renderRecipes() */
  return `<section class="v8-page preply-page"><div class="preply-kicker">Rezepte</div><h1 class="preply-title">Was möchtest<br>du kochen?</h1><p class="preply-copy">Werden geladen …</p></section>`;
}

function renderShoppingPage() {
  const plan = getState().currentPlan;
  if (!plan || isPlanExpired(plan)) return `<section class="v8-page preply-page">
    <div class="preply-kicker">Einkaufen</div>
    <h1 class="preply-title">Alles, was<br>du brauchst.</h1>
    <p class="preply-copy">Erstelle zuerst einen Plan.</p>
    <div class="v8-start-grid" style="margin-top:18px">
      <button class="v8-start-card primary" data-action="create-plan"><strong>Plan erstellen</strong><span>Dann wird deine Einkaufsliste automatisch erstellt.</span></button>
    </div>
  </section>`;
  return `<section class="v8-page preply-page">
    <h1 class="master-screen-title">Einkauf</h1>
    <p class="master-empty">Einkaufsliste wird zusammengestellt …</p>
  </section>`;
}

function profileRow(label, value) {
  if (!value) return '';
  return `<div class="profile-row"><span class="profile-label">${escapeHtml(label)}</span><span class="profile-value">${escapeHtml(value)}</span></div>`;
}

function renderProfilePage() {
  const state = getState();
  const profile = state.profile || {};
  const DIET_LABELS = { omnivore: 'Omnivor', vegetarian: 'Vegetarisch', vegan: 'Vegan', pescatarian: 'Pescetarisch' };
  const COOK_LABELS = { fresh: 'Frisch kochen', meal_prep: 'Meal Prep', mixed: 'Gemischt' };
  const SIMPLE_LABELS = { simple: 'Simpel', balanced: 'Ausgewogen', experimental: 'Experimentell' };
  const GOAL_LABELS = { lose: 'Abnehmen', maintain: 'Gewicht halten', gain: 'Zunehmen' };
  const enabledMeals = Object.entries(profile.enabledMeals || {}).filter(([, v]) => v).map(([k]) => MEAL_LABELS[k] || k).join(', ');

  return `<section class="v8-page preply-page">
    <div class="preply-kicker">Profil</div>
    <h1 class="preply-title">Deine<br>Einstellungen.</h1>
    <div class="preply-profile-grid">
      <div class="preply-profile-stat"><span>Tagesziel</span><b>${Math.round(resolveCalorieTarget(profile))} <small>kcal</small></b></div>
      <div class="preply-profile-stat"><span>Protein</span><b>${Math.round(resolveProteinTarget(profile))} <small>g</small></b></div>
    </div>
    <div class="preply-settings-card">
      <h2>Ernährungsprofil</h2>
      ${profileRow('Personen', `${profile.persons || 1}`)}
      ${profileRow('Ernährung', DIET_LABELS[profile.dietStyle])}
      ${profileRow('Kochstil', COOK_LABELS[profile.cookingStyle])}
      ${profileRow('Komplexität', SIMPLE_LABELS[profile.simplicity])}
      ${profileRow('Ziel', GOAL_LABELS[profile.goal])}
      ${profileRow('Maximale Kochzeit', profile.maxCookingTime ? `${profile.maxCookingTime} Min.` : null)}
      ${profileRow('Mahlzeiten', enabledMeals || null)}
      <div class="v8-actions" style="margin-top:var(--space-4)"><button class="v8-button primary" data-action="open-onboarding">Bearbeiten</button></div>
    </div>
  </section>`;
}

function pageForRoute(route) {
  if (route === 'today') return renderTodayPage();
  if (route === 'recipes') return renderRecipesPage();
  if (route === 'shopping') return renderShoppingPage();
  if (route === 'profile') return renderProfilePage();
  return renderPlanPage();
}

function renderApp(root) {
  const route = getRoute();
  renderShell(root, { route });
  const main = root.querySelector('.v8-main');
  if (main) main.innerHTML = pageForRoute(route);
  bindPageEvents(root);
  renderDialog(root);
}

/* Ein Regler mit grosser Zahl statt eines Textfeldes: keine Tastatur, die
   aufspringt, einhaendig bedienbar, und der Wert ist immer sichtbar. */
function sliderField(field, label, value, limits) {
  return `<div class="ob-slider" data-slider-field="${field}">
    <div class="ob-slider-head">
      <span>${escapeHtml(label)}</span>
      <span class="ob-slider-value"><b data-slider-out>${value}</b> ${escapeHtml(limits.unit)}</span>
    </div>
    <div class="ob-slider-row">
      <button type="button" class="ob-step" data-slider-nudge="-1" aria-label="${escapeHtml(label)} verringern">−</button>
      <input type="range" min="${limits.min}" max="${limits.max}" step="${limits.step}"
             value="${value}" data-slider-input aria-label="${escapeHtml(label)}">
      <button type="button" class="ob-step" data-slider-nudge="1" aria-label="${escapeHtml(label)} erhöhen">+</button>
    </div>
  </div>`;
}

function choiceCards(field, options, selected, columns = 2) {
  return `<div class="ob-choice" style="grid-template-columns:repeat(${columns},minmax(0,1fr))">
    ${options.map(([value, label, hint]) => `
      <button type="button" class="ob-card ${selected === value ? 'selected' : ''}"
              data-choice-field="${field}" data-choice-value="${escapeHtml(value)}" aria-pressed="${selected === value}">
        <strong>${escapeHtml(label)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
      </button>`).join('')}
  </div>`;
}

function targetPreview(profile) {
  const kcal = calorieTargetFor(profile, profile.goal || 'maintain');
  const protein = proteinTargetFor(profile, profile.goal || 'maintain');
  return `<div class="ob-preview">
    <div><span>Tagesziel</span><b>${kcal}<small> kcal</small></b></div>
    <div><span>Protein</span><b>${protein}<small> g</small></b></div>
    <p>${escapeHtml(explainTarget(profile, profile.goal || 'maintain'))}</p>
  </div>`;
}

function onboardingBody(draft) {
  const step = currentStep(draft);
  const p = draft.profile;
  const head = STEP_TITLES[step] || { title: '', copy: '' };
  const heading = `<h2>${escapeHtml(head.title)}</h2><p class="ob-copy">${escapeHtml(head.copy)}</p>`;

  if (step === 'body') {
    return `${heading}
      ${choiceCards('sex', SEXES, p.sex, 3)}
      ${sliderField('age', 'Alter', p.age, BODY_LIMITS.age)}
      ${sliderField('height', 'Größe', p.height, BODY_LIMITS.height)}
      ${sliderField('weight', 'Gewicht', p.weight, BODY_LIMITS.weight)}
      <p class="ob-label">Wie viel bewegst du dich?</p>
      ${choiceCards('activity', ACTIVITY_LEVELS.map(([v, l, h]) => [v, l, h]), p.activity, 2)}`;
  }

  if (step === 'goal') {
    return `${heading}
      ${choiceCards('goal', GOALS.map(([v, l, h]) => [v, l, h]), p.goal, 1)}
      ${p.sex ? targetPreview(p) : ''}`;
  }

  if (step === 'diet') {
    const allergies = new Set(p.allergies || []);
    return `${heading}
      ${choiceCards('dietStyle', DIET_OPTIONS, p.dietStyle, 2)}
      <p class="ob-label">Was soll nie im Plan auftauchen?</p>
      <div class="ob-chips">
        ${ALLERGEN_OPTIONS.map(([value, label]) => `
          <button type="button" class="ob-chip ${allergies.has(value) ? 'selected' : ''}"
                  data-allergen="${value}" aria-pressed="${allergies.has(value)}">${escapeHtml(label)}</button>`).join('')}
      </div>
      <div class="form-field" style="margin-top:14px">
        <span class="ob-label">Sonst noch etwas?</span>
        <input data-onboard-input="excludedIngredients" value="${escapeHtml((p.excludedIngredients || []).join(', '))}" placeholder="z. B. Koriander, Sellerie">
      </div>`;
  }

  const meals = p.enabledMeals || {};
  return `${heading}
    ${choiceCards('style', STYLE_OPTIONS.map(([v, l, h]) => [v, l, h]), p.style, 2)}
    <p class="ob-label">Welche Mahlzeiten sollen wir planen?</p>
    <div class="ob-chips">
      ${MEAL_OPTIONS.map(([key, label]) => `
        <button type="button" class="ob-chip ${meals[key] ? 'selected' : ''}" data-meal-key="${key}" aria-pressed="${Boolean(meals[key])}">${escapeHtml(label)}</button>`).join('')}
    </div>
    <p class="ob-label">Für wie viele Personen?</p>
    ${sliderField('persons', 'Personen', Math.max(1, Number(p.persons) || 1), { min: 1, max: 8, step: 1, unit: '' })}`;
}

function renderReplacementDialog(root) {
  const target = runtime.replaceTarget;
  if (!target) return;
  const state = getState();
  const plan = state.currentPlan;
  const days = normalizeDays(plan);
  const dayData = days[target.dayIndex];
  if (!dayData) return;
  const meal = dayData.meals[target.category];
  if (!meal) return;

  const MODE_LABELS = { similar: 'Ähnlich', faster: 'Schneller', simpler: 'Einfacher', protein: 'Proteinreicher' };
  const usedIds = new Set(days.flatMap((d) => Object.values(d.meals || {}).map((m) => m.recipeId || m.recipe?.id).filter(Boolean)));
  const suggestions = replacementSuggestions(runtime.recipes, meal.recipe || meal, {
    profile: state.profile, preferences: state.preferences, usedRecipeIds: usedIds, usedFamilies: new Set()
  }, runtime.replaceMode, 8);

  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.dataset.owner = 'integration';
  overlay.dataset.replacementOverlay = 'true';
  overlay.dataset.dismissible = 'true';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Gericht austauschen</p>
    <h2>${escapeHtml((meal.recipe || meal).name)}</h2>
    <div class="chip-row" style="margin:var(--space-3) 0">${Object.entries(MODE_LABELS).map(([mode, label]) =>
      `<button class="chip ${runtime.replaceMode === mode ? 'active' : ''}" data-replace-mode="${mode}">${label}</button>`
    ).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${suggestions.length ? suggestions.map((recipe, i) => `
      <div class="preply-discover-card">
        <span class="preply-mark ${tone(i)}"><i></i></span>
        <span>
          <small>${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)} · ${Math.round(recipe.time)} Min</small>
          <strong>${escapeHtml(recipe.name)}</strong>
          <em>${Math.round(recipe.kcal)} kcal · ${Math.round(recipe.protein)}g Protein</em>
        </span>
        <button class="v8-button primary" style="align-self:center;padding:6px 12px;font-size:12px" data-pick-replacement="${escapeHtml(recipe.id)}">Wählen</button>
      </div>
    `).join('') : '<div class="preply-empty">Keine passenden Alternativen gefunden.</div>'}</div>
    <div class="v8-actions" style="margin-top:var(--space-4)">
      <button class="v8-button ghost" data-replace-close>Abbrechen</button>
    </div>
  </section>`;
  root.appendChild(overlay);

  overlay.querySelectorAll('[data-replace-mode]').forEach((button) => button.addEventListener('click', () => {
    runtime.replaceMode = button.dataset.replaceMode;
    overlay.remove();
    renderReplacementDialog(root);
  }));
  overlay.querySelector('[data-replace-close]')?.addEventListener('click', () => {
    runtime.replaceTarget = null;
    overlay.remove();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) { runtime.replaceTarget = null; overlay.remove(); }
  });
  overlay.querySelectorAll('[data-pick-replacement]').forEach((button) => button.addEventListener('click', () => {
    const replacement = runtime.recipes.find((r) => r.id === button.dataset.pickReplacement);
    if (!replacement) return;
    updateState((current) => {
      const updated = structuredClone(current.currentPlan);
      const updatedDays = normalizeDays(updated);
      const targetMeal = updatedDays[target.dayIndex]?.meals?.[target.category];
      if (!targetMeal) return current;
      const factor = Number(targetMeal.portionFactor || 1);
      updatedDays[target.dayIndex].meals[target.category] = {
        ...targetMeal,
        recipeId: replacement.id,
        recipe: replacement,
        prepGroupId: null,
        prepSourceDate: null,
        repeatedForMealPrep: false,
        estimatedKcalPerPerson: Math.round(replacement.kcal * factor),
        estimatedProteinPerPerson: Math.round(replacement.protein * factor),
        /* Wer selbst waehlt, legt sich fest — eine Neuplanung darf das
           nicht ueberschreiben. Der Pin wird sichtbar gesetzt. */
        pinned: true,
        replacedAt: new Date().toISOString()
      };
      updated.days = updatedDays;
      return { ...current, currentPlan: updated };
    });
    runtime.replaceTarget = null;
    haptic('strong');
    overlay.remove();
    renderApp(root);
  }));
}

function renderDialog(root) {
  /* Nur die eigenen Dialoge abraeumen. Vorher loeschte jeder Renderdurchlauf
     jedes Overlay — auch die Sheets anderer Module, die dann mitten in der
     Bedienung verschwanden. */
  root.querySelector('.v8-overlay[data-owner="integration"]')?.remove();
  if (runtime.activeDialog === 'replace' && runtime.replaceTarget) { renderReplacementDialog(root); return; }
  if (runtime.activeDialog !== 'onboarding' || !runtime.onboardingDraft) return;
  const draft = runtime.onboardingDraft;
  const total = ONBOARDING_STEPS.length;
  const last = isLastStep(draft);
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.dataset.owner = 'integration';
  overlay.innerHTML = `<section class="v8-dialog ob-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Schritt ${draft.stepIndex + 1} von ${total}</p>
    <div class="v8-progress"><div style="width:${((draft.stepIndex + 1) / total) * 100}%"></div></div>
    ${onboardingBody(draft)}
    <p id="onboarding-error" class="v8-status error" hidden></p>
    <div class="v8-actions ob-actions">
      ${draft.stepIndex ? '<button class="v8-button" data-onboard-action="back">Zurück</button>' : '<button class="v8-button ghost" data-onboard-action="close">Später</button>'}
      <button class="v8-button primary" data-onboard-action="next">${last ? 'Los geht\u2019s' : 'Weiter'}</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  bindDialogEvents(root);
}

function bindDialogEvents(root) {
  /* Auswahlkarten */
  root.querySelectorAll('[data-choice-field]').forEach((button) => button.addEventListener('click', () => {
    haptic('tap');
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, {
      [button.dataset.choiceField]: button.dataset.choiceValue
    });
    renderDialog(root);
  }));

  /* Regler: waehrend des Ziehens nur die Zahl aktualisieren, damit der
     Dialog nicht bei jedem Pixel neu gebaut wird. */
  root.querySelectorAll('[data-slider-field]').forEach((group) => {
    const field = group.dataset.sliderField;
    const input = group.querySelector('[data-slider-input]');
    const out = group.querySelector('[data-slider-out]');
    if (!input || !out) return;

    const commit = (value) => {
      runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { [field]: Number(value) });
    };

    input.addEventListener('input', () => { out.textContent = input.value; });
    input.addEventListener('change', () => {
      commit(input.value);
      haptic('tap');
      /* Erst am Ende neu zeichnen — dann stimmt auch die Bedarfsvorschau. */
      renderDialog(root);
    });

    group.querySelectorAll('[data-slider-nudge]').forEach((button) => button.addEventListener('click', () => {
      const delta = Number(button.dataset.sliderNudge) * Number(input.step || 1);
      const next = Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + delta));
      input.value = String(next);
      out.textContent = String(next);
      commit(next);
      haptic('tap');
      renderDialog(root);
    }));
  });

  /* Ausschluesse */
  root.querySelectorAll('[data-allergen]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.allergen;
    const current = new Set(runtime.onboardingDraft.profile.allergies || []);
    current.has(value) ? current.delete(value) : current.add(value);
    haptic('tap');
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { allergies: [...current] });
    renderDialog(root);
  }));

  root.querySelectorAll('[data-meal-key]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.mealKey;
    const current = runtime.onboardingDraft.profile.enabledMeals || {};
    haptic('tap');
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { enabledMeals: { [key]: !current[key] } });
    renderDialog(root);
  }));

  root.querySelectorAll('[data-onboard-input]').forEach((input) => input.addEventListener('change', () => {
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, {
      [input.dataset.onboardInput]: input.value.split(',').map((item) => item.trim()).filter(Boolean)
    });
  }));

  root.querySelectorAll('[data-onboard-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.onboardAction;
    if (action === 'close') { runtime.activeDialog = null; renderApp(root); return; }
    if (action === 'back') { runtime.onboardingDraft = previousStep(runtime.onboardingDraft); renderDialog(root); return; }

    const error = validateOnboardingStep(runtime.onboardingDraft);
    if (error) {
      const node = root.querySelector('#onboarding-error');
      if (node) { node.hidden = false; node.textContent = error; }
      haptic('warn');
      return;
    }

    if (isLastStep(runtime.onboardingDraft)) {
      runtime.onboardingDraft = completeOnboarding(runtime.onboardingDraft);
      updateState((state) => ({ ...state, profile: runtime.onboardingDraft.profile, onboardingCompleted: true }));
      runtime.activeDialog = null;
      haptic('strong');
      renderApp(root);
      return;
    }
    runtime.onboardingDraft = nextStep(runtime.onboardingDraft);
    renderDialog(root);
  }));
}

export function openOnboarding(root) {
  runtime.onboardingDraft = createOnboardingDraft(getState().profile);
  runtime.activeDialog = 'onboarding';
  renderDialog(root);
}

/* Frueher fuehrten hier drei Bildschirme hin: Tage, Mahlzeiten, bestaetigen —
   bevor man ueberhaupt gesehen hat, ob die App etwas taugt. Und beim ersten
   Mal weiss niemand, ob er drei oder sieben Tage will. Jetzt entsteht die
   Woche mit einem Tipp; Zeitraum, Mahlzeiten und Personen stehen danach ueber
   der Tagesliste. */
function createWeekPlan(root) {
  const state = getState();
  const profile = state.profile || {};
  const enabledMeals = Object.entries(profile.enabledMeals || {})
    .filter(([, an]) => an).map(([mahlzeit]) => mahlzeit);
  const selectedDates = Array.from({ length: 7 }, (_, index) => localDate(index));

  if (!enabledMeals.length) {
    showToast(root, 'Wähle im Profil mindestens eine Mahlzeit aus.');
    return;
  }

  try {
    const plan = buildPlan(runtime.recipes, {
      startDate: selectedDates[0],
      selectedDates,
      enabledMeals,
      mode: 'multi_day',
      profile
    }, state.preferences, { seed: Date.now() % 100000 });
    updateState((current) => replaceCurrentPlan(current, plan));
    haptic('strong');
    renderApp(root);
  } catch (error) {
    showToast(root, error.message);
  }
}

function bindPageEvents(root) {
  root.querySelectorAll('[data-action="open-onboarding"]').forEach((button) => button.addEventListener('click', () => openOnboarding(root)));

  /* "Was esse ich heute?" — quick suggestion */
  root.querySelectorAll('[data-action="today-inspiration"]').forEach((el) => el.addEventListener('click', () => {
    if (catalogNotReadyFeedback(root)) return;
    const state = getState();
    const profile = state.profile || {};
    const enabledMeals = profile.enabledMeals || {};
    runtime.suggestions = suggestForToday(runtime.recipes, profile, state.preferences, {
      category: enabledMeals.dinner ? 'dinner' : Object.keys(enabledMeals).find((key) => enabledMeals[key]) || 'dinner',
      seed: Date.now()
    });
    renderApp(root);
  }));

  /* Create multi-day plan */
  root.querySelectorAll('[data-action="create-plan"]').forEach((button) => button.addEventListener('click', () => {
    if (!getState().onboardingCompleted) { openOnboarding(root); return; }
    if (catalogNotReadyFeedback(root)) return;
    createWeekPlan(root);
  }));

  /* Create single-day plan (quick "Nur für heute") */
  root.querySelectorAll('[data-action="single-day-plan"]').forEach((button) => button.addEventListener('click', () => {
    const state = getState();
    if (!state.onboardingCompleted) { openOnboarding(root); return; }
    if (catalogNotReadyFeedback(root)) return;
    const profile = state.profile || {};
    const enabledMeals = Object.entries(profile.enabledMeals || {}).filter(([, v]) => v).map(([k]) => k);
    if (!enabledMeals.length) { openOnboarding(root); return; }
    try {
      const plan = buildPlan(runtime.recipes, {
        startDate: localDate(0),
        selectedDates: [localDate(0)],
        enabledMeals,
        mode: 'single_day',
        profile
      }, state.preferences, { seed: Date.now() % 100000 });
      updateState((current) => replaceCurrentPlan(current, plan));
      haptic('strong');
      renderApp(root);
    } catch (error) {
      console.error('[Preply] Tagesplan-Fehler', error);
      showToast(root, error.message || 'Der Plan konnte nicht erstellt werden.');
    }
  }));

  /* Tag in der Wochenansicht auf- und zuklappen */
  root.querySelectorAll('[data-plan-day]').forEach((pill) => pill.addEventListener('click', () => {
    haptic('tap');
    const date = pill.dataset.planDay;
    runtime.activePlanDay = runtime.activePlanDay === date ? null : date;
    renderApp(root);
  }));

  /* Expand/collapse meal cards */
  root.querySelectorAll('[data-expand-meal]').forEach((el) => el.addEventListener('click', async (event) => {
    /* Don't expand if clicking the swap button */
    if (event.target.closest('[data-swap-meal]') || event.target.closest('[data-pin-meal]')) return;
    const key = el.dataset.expandMeal;
    const recipeId = el.dataset.recipeId;

    /* Toggle expansion */
    haptic('tap');
    if (runtime.expandedMeals.has(key)) {
      runtime.expandedMeals.delete(key);
    } else {
      runtime.expandedMeals.add(key);
      /* Fetch recipe details if not cached */
      if (recipeId && !runtime.detailCache.has(recipeId)) {
        try {
          const detail = await getRecipe(recipeId);
          runtime.detailCache.set(recipeId, detail);
        } catch (err) {
          console.warn('[Preply] Rezeptdetail nicht geladen', err);
        }
      }
    }
    renderApp(root);
  }));

  /* Suggestion / discover cards — open detail overlay */
  root.querySelectorAll('.preply-discover-card[data-recipe-id]').forEach((card) => card.addEventListener('click', () => {
    const id = card.dataset.recipeId;
    if (id) showRecipeDetail(root, id);
  }));

  /* Gericht festhalten */
  root.querySelectorAll('[data-pin-meal]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const date = button.dataset.pinDate;
    const category = button.dataset.pinCat;
    const days = normalizeDays(getState().currentPlan);
    const next = !Boolean(days.find((d) => d.date === date)?.meals?.[category]?.pinned);
    haptic(next ? 'confirm' : 'tap');

    /* Ein Icon umzuschalten braucht keinen Neuaufbau der Seite — updateState
       wuerde einen vollen Durchlauf ausloesen und dabei spuerbar haengen. */
    silentUpdate((state) => ({ ...state, currentPlan: setMealPinned(state.currentPlan, date, category, next) }));
    button.classList.toggle('pinned', next);
    button.setAttribute('aria-pressed', String(next));
    button.setAttribute('aria-label', next ? 'Gericht nicht mehr festhalten' : 'Dieses Gericht behalten');
    button.closest('.preply-meal')?.classList.toggle('is-pinned', next);
  }));

  /* Swap meal button */
  root.querySelectorAll('[data-swap-meal]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (catalogNotReadyFeedback(root)) return;
    const dayIndex = Number(button.dataset.swapDay);
    const category = button.dataset.swapCat;
    runtime.replaceTarget = { dayIndex, category };
    runtime.replaceMode = 'similar';
    runtime.activeDialog = 'replace';
    renderDialog(root);
  }));
}

export async function startIntegratedApp(root) {
  renderApp(root);
  try {
    runtime.recipes = await loadCards();
    runtime.catalogStatus = 'ready';
  } catch (error) {
    runtime.catalogStatus = 'error';
    runtime.catalogError = error.message;
  }
  renderApp(root);
  if (!getState().onboardingCompleted) openOnboarding(root);
}

export function rerenderIntegratedApp(root) {
  renderApp(root);
}

export function goTo(route) {
  navigate(route);
}
