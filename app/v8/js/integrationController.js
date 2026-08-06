import { getRoute, navigate } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { loadCards, getCards, getRecipe } from './data/recipeStore.js';
import { renderShell } from './features/shell/renderShell.js';
import {
  completeOnboarding,
  createOnboardingDraft,
  currentStep,
  nextStep,
  previousStep,
  updateDraft,
  validateOnboardingStep
} from './features/onboarding/onboardingModel.js';
import { MEAL_OPTIONS, STEP_DEFINITIONS } from './features/onboarding/onboardingSteps.js';
import { buildProfileSummary } from './features/profile/profileSummary.js';
import { buildPlan, suggestForToday, replacementSuggestions } from './features/planner/plannerEngine.js';
import { getReturnOptions, isPlanExpired } from './features/history/history.js';
const runtime = {
  recipes: [],
  catalogStatus: 'loading',
  catalogError: null,
  suggestions: [],
  onboardingDraft: null,
  planDraft: null,
  activeDialog: null,
  activePlanDay: null,
  expandedMeals: new Set(),
  detailCache: new Map(),
  replaceTarget: null,
  replaceMode: 'similar',
  viewMode: 'heute'
};

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

function dateLabel(value) {
  return formatDay.format(new Date(`${value}T12:00:00`));
}

function recipeCard(recipe, extra = '') {
  return `<article class="recipe-card" data-recipe-id="${escapeHtml(recipe.id)}">
    <div><p class="eyebrow">${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)}</p><h3>${escapeHtml(recipe.name)}</h3></div>
    <div class="recipe-meta"><span>${Math.round(recipe.kcal)} kcal</span><span>${Math.round(recipe.protein)} g Protein</span><span>${Math.round(recipe.time)} Min.</span><span>${escapeHtml(recipe.simplicity || 'ausgewogen')}</span></div>
    ${extra}
  </article>`;
}

function catalogStatusHtml() {
  if (runtime.catalogStatus === 'loading') return '<div class="v8-status">Rezepte werden geladen …</div>';
  if (runtime.catalogStatus === 'error') return `<div class="v8-status error">${escapeHtml(runtime.catalogError || 'Rezepte konnten nicht geladen werden.')}</div>`;
  return '';
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

function donutSvg(pct) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return `<svg class="meal-donut" viewBox="0 0 38 38">
    <circle class="meal-donut-track" cx="19" cy="19" r="${r}"/>
    <circle class="meal-donut-fill" cx="19" cy="19" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
    <text class="meal-donut-text" x="19" y="19">${Math.round(pct)}%</text>
  </svg>`;
}

function renderMealCard(date, category, meal, dayIndex, cardIndex, kcalTarget) {
  const recipe = meal.recipe || meal;
  const name = recipe.name || 'Unbekannt';
  const kcal = meal.estimatedKcalPerPerson || Math.round(recipe.kcal || 0);
  const protein = meal.estimatedProteinPerPerson || Math.round(recipe.protein || 0);
  const time = Math.round(recipe.time || 0);
  const key = mealCardKey(date, category);
  const isExpanded = runtime.expandedMeals.has(key);
  const detail = runtime.detailCache.get(recipe.id || recipe.recipeId);
  const pct = kcalTarget > 0 ? (kcal / kcalTarget) * 100 : 0;
  const bgClass = cardIndex === 0 ? 'hero-card' : 'light-card';

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

  return `<div class="meal-card2 ${bgClass} ${isExpanded ? 'expanded' : ''}" data-meal-key="${escapeHtml(key)}">
    <div class="meal-card2-top" data-expand-meal="${escapeHtml(key)}" data-recipe-id="${escapeHtml(recipe.id || '')}">
      <div class="meal-card-body">
        <div class="meal-cat-badge">${escapeHtml(MEAL_LABELS[category] || category)}</div>
        <div class="meal-name2">${escapeHtml(name)}</div>
        <div class="meal-macros-line">${kcal} kcal · ${protein} g Protein · ${time} Min.</div>
      </div>
      ${donutSvg(pct)}
      <button class="meal-swap-btn" data-swap-meal data-swap-day="${dayIndex}" data-swap-cat="${escapeHtml(category)}" title="Gericht austauschen">↻</button>
    </div>
    ${expandedHtml}
  </div>`;
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

function renderPlanPage() {
  const state = getState();
  const plan = state.currentPlan;
  if (plan && !isPlanExpired(plan)) {
    const days = normalizeDays(plan);
    if (!days.length) return renderEmptyPlan();

    const today = localDate(0);
    const activeDay = runtime.activePlanDay || today;
    const dayData = days.find((d) => d.date === activeDay) || days[0];
    const dayIndex = days.indexOf(dayData);
    const WEEKDAY_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

    const profile = state.profile || {};
    const kcalTarget = profile.calorieTarget || 2000;
    const proteinTarget = profile.proteinTarget || 120;
    const summary = dayData ? computeDaySummary(dayData) : { totalKcal: 0, totalProtein: 0, mealCount: 0 };

    const isWeekView = days.length > 1;
    const viewMode = runtime.viewMode || 'heute';
    const dayDate = dayData ? new Date(`${dayData.date}T12:00:00`) : new Date();
    const dayLabel = `HEUTE · ${String(dayDate.getDate()).padStart(2, '0')}.${String(dayDate.getMonth() + 1).padStart(2, '0')}.`;

    return `<section class="v8-page">
      <!-- Hero -->
      <div class="plan-hero">
        <div class="plan-hero-eyebrow">DEIN PLAN</div>
        <div class="plan-hero-title">Gut essen, ohne<br>nachzudenken.</div>
      </div>

      <!-- Dark stats card -->
      <div class="stats-card">
        <div class="stats-card-row">
          <div class="stats-card-item">
            <div class="stats-label">TAGESZIEL</div>
            <div class="stats-value">${kcalTarget}<span class="stats-unit"> kcal</span></div>
          </div>
          <div class="stats-card-item">
            <div class="stats-label">PROTEIN</div>
            <div class="stats-value">${proteinTarget}<span class="stats-unit"> g</span></div>
          </div>
        </div>
        <div class="stats-card-divider"></div>
        <div class="stats-card-desc">Der Plan ist auf deinen Bedarf und deine Auswahl zugeschnitten.</div>
      </div>

      ${isWeekView ? `
      <!-- Heute / Woche toggle -->
      <div class="view-toggle">
        <button class="view-toggle-btn ${viewMode === 'heute' ? 'active' : ''}" data-view-mode="heute">Heute</button>
        <button class="view-toggle-btn ${viewMode === 'woche' ? 'active' : ''}" data-view-mode="woche">Woche</button>
      </div>
      ` : ''}

      <!-- Day pills -->
      <div class="meal-day-nav">
        ${days.map((day) => {
          const d = new Date(`${day.date}T12:00:00`);
          const wd = WEEKDAY_SHORT[d.getDay()];
          const dd = String(d.getDate()).padStart(2, '0');
          const isDayToday = day.date === today;
          const isActive = day.date === (dayData ? dayData.date : '');
          return `<button class="day-pill ${isActive ? 'sel' : ''}" data-plan-day="${day.date}">
            ${isDayToday && isActive ? '<span class="day-pill-today">HEUTE</span>' : `<span class="day-pill-name">${wd}</span>`}
            <span class="day-pill-num">${dd}</span>
          </button>`;
        }).join('')}
      </div>

      <!-- Info callout -->
      <div class="info-callout">
        <div class="info-callout-icon">i</div>
        <div class="info-callout-text">Heute. Tausche jedes Gericht direkt aus – Plan und Einkaufsliste werden gemeinsam aktualisiert.</div>
      </div>

      ${dayData ? `
      <!-- Meals section -->
      <div class="meals-header">
        <h2>Deine Mahlzeiten</h2>
        <button class="meals-header-action" data-action="create-plan">Neu zusammenstellen</button>
      </div>

      <div class="meals-container">
        <div class="meals-container-header">
          <div>
            <div class="meals-container-date">${escapeHtml(dayLabel)}</div>
            <div class="meals-container-sub">Einfach loskochen</div>
          </div>
          <div class="meals-container-badge">${summary.totalKcal} kcal</div>
        </div>
        ${Object.entries(dayData.meals || {}).map(([category, meal], idx) =>
          renderMealCard(dayData.date, category, meal, dayIndex, idx, kcalTarget)
        ).join('')}
      </div>
      ` : '<div class="empty-state">Kein Plan für diesen Tag.</div>'}
    </section>`;
  }

  return renderEmptyPlan();
}

function renderEmptyPlan() {
  return `<section class="v8-page">
    <div class="v8-page-head">
      <h1>Was kochst du?</h1>
      <p>Erstelle einen Essensplan oder lass dich inspirieren.</p>
    </div>
    ${catalogStatusHtml()}

    <div class="quick-suggest-card" data-action="today-inspiration">
      <h3>🍳 Was esse ich heute?</h3>
      <p>Schnelle Vorschläge passend zu deinem Profil</p>
    </div>

    <div class="v8-start-grid">
      <button class="v8-start-card primary" data-action="create-plan"><strong>Wochenplan erstellen</strong><span>Mehrere Tage planen, Einkaufsliste inklusive.</span></button>
      <button class="v8-start-card" data-action="single-day-plan"><strong>Nur für heute</strong><span>Ein Tag, passende Gerichte, sofort los.</span></button>
    </div>

    ${runtime.suggestions.length ? `
      <div style="margin-top:var(--space-5)">
        <h2 style="font-size:var(--text-base);font-weight:700;margin-bottom:var(--space-3)">Vorschläge für dich</h2>
        ${runtime.suggestions.map((recipe) => `
          <div class="meal-card2">
            <div class="meal-card2-top" data-recipe-id="${escapeHtml(recipe.id)}">
              <div class="meal-cat-badge">${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)}</div>
              <div class="meal-card-info">
                <div class="meal-name2">${escapeHtml(recipe.name)}</div>
                <div class="meal-macros-line">${Math.round(recipe.kcal)} kcal · ${Math.round(recipe.protein)}g Protein · ${Math.round(recipe.time)} Min.</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  </section>`;
}

function renderRecipesPage() {
  /* Recipes rendering is handled by featureEnhancementsV2.renderRecipes() */
  return `<section class="v8-page"><div class="v8-page-head"><h1>Rezepte</h1><p>Werden geladen …</p></div></section>`;
}

function renderShoppingPage() {
  const plan = getState().currentPlan;
  if (!plan || isPlanExpired(plan)) return `<section class="v8-page"><div class="v8-page-head"><h1>Einkaufsliste</h1><p>Erstelle zuerst einen Plan.</p></div><div class="v8-start-grid"><button class="v8-start-card primary" data-action="create-plan"><strong>Plan erstellen</strong><span>Dann wird deine Einkaufsliste automatisch erstellt.</span></button></div></section>`;
  return `<section class="v8-page"><div class="v8-page-head"><h1>Einkaufsliste</h1><p>Wähle Tage aus, für die du einkaufen willst.</p></div><div class="v8-panel"><div class="day-chip-row">${plan.selectedDates.map((date) => `<button class="day-toggle active" data-shop-date="${date}">${escapeHtml(dateLabel(date))}</button>`).join('')}</div></div></section>`;
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

  return `<section class="v8-page">
    <div class="v8-page-head"><h1>Profil</h1></div>
    <div class="v8-panel">
      ${profileRow('Personen', `${profile.persons || 1}`)}
      ${profileRow('Ernährung', DIET_LABELS[profile.dietStyle])}
      ${profileRow('Kochstil', COOK_LABELS[profile.cookingStyle])}
      ${profileRow('Komplexität', SIMPLE_LABELS[profile.simplicity])}
      ${profileRow('Ziel', GOAL_LABELS[profile.goal])}
      ${profileRow('Maximale Kochzeit', profile.maxCookingTime ? `${profile.maxCookingTime} Min.` : null)}
      ${profileRow('Kalorienziel', profile.calorieTarget ? `${profile.calorieTarget} kcal` : null)}
      ${profileRow('Proteinziel', profile.proteinTarget ? `${profile.proteinTarget} g` : null)}
      ${profileRow('Mahlzeiten', enabledMeals || null)}
      <div class="v8-actions" style="margin-top:var(--space-4)"><button class="v8-button primary" data-action="open-onboarding">Bearbeiten</button></div>
    </div>
  </section>`;
}

function pageForRoute(route) {
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

function setDraftValue(field, value, multiple = false) {
  const draft = runtime.onboardingDraft;
  if (!draft) return;
  if (multiple) {
    const current = new Set(draft.profile[field] || []);
    current.has(value) ? current.delete(value) : current.add(value);
    runtime.onboardingDraft = updateDraft(draft, { [field]: [...current] });
  } else {
    runtime.onboardingDraft = updateDraft(draft, { [field]: value });
  }
}

function optionButtons(step, definition, profile) {
  const field = { planningMode: 'planningMode', goal: 'goal', diet: 'dietStyle', cooking: 'cookingStyle', simplicity: 'simplicity', priorities: 'priorities' }[step];
  const selected = definition.multiple ? new Set(profile[field] || []) : null;
  return `<div class="option-grid">${definition.options.map((option) => {
    const active = definition.multiple ? selected.has(option.value) : profile[field] === option.value;
    return `<button class="option-card ${active ? 'selected' : ''}" data-onboard-field="${field}" data-onboard-value="${option.value ?? ''}" data-multiple="${definition.multiple ? 'true' : 'false'}"><strong>${escapeHtml(option.label)}</strong>${option.description ? `<span>${escapeHtml(option.description)}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

function onboardingBody(draft) {
  const step = currentStep(draft);
  const profile = draft.profile;
  const definition = STEP_DEFINITIONS[step];
  if (definition) return `<h2>${escapeHtml(definition.title)}</h2>${optionButtons(step, definition, profile)}`;
  const ALLERGEN_LABELS = { gluten: 'Gluten', dairy: 'Milch', eggs: 'Eier', nuts: 'Nüsse', soy: 'Soja', fish: 'Fisch' };
  if (step === 'restrictions') return `<h2>Was soll ausgeschlossen werden?</h2><div class="option-grid">${Object.entries(ALLERGEN_LABELS).map(([key, label]) => `<button class="option-card ${(profile.allergies || []).includes(key) ? 'selected' : ''}" data-onboard-field="allergies" data-onboard-value="${key}" data-multiple="true"><strong>${label}</strong></button>`).join('')}</div><div class="form-field" style="margin-top:var(--space-4)"><span>Weitere Ausschlüsse</span><input data-onboard-input="excludedIngredients" value="${escapeHtml((profile.excludedIngredients || []).join(', '))}" placeholder="z. B. Koriander, Sellerie"></div>`;
  if (step === 'meals') return `<h2>Welche Mahlzeiten möchtest du planen?</h2><div class="option-grid">${MEAL_OPTIONS.map(([key,label]) => `<button class="option-card ${profile.enabledMeals[key] ? 'selected' : ''}" data-meal-key="${key}"><strong>${label}</strong></button>`).join('')}</div>`;
  if (step === 'details') return `<h2>Optionale Details</h2><div class="form-grid"><div class="form-field"><label>Personen</label><input type="number" min="1" data-onboard-number="persons" value="${profile.persons}"></div><div class="form-field"><label>Maximale Kochzeit</label><input type="number" min="5" data-onboard-number="maxCookingTime" value="${profile.maxCookingTime || 30}"></div><div class="form-field"><label>Kalorienziel</label><input type="number" min="0" data-onboard-number="calorieTarget" value="${profile.calorieTarget || ''}"></div><div class="form-field"><label>Proteinziel</label><input type="number" min="0" data-onboard-number="proteinTarget" value="${profile.proteinTarget || ''}"></div></div>`;
  return `<h2>So wird geplant</h2><div class="v8-status">${escapeHtml(buildProfileSummary(profile))}</div>`;
}

function createPlanDraft(profile) {
  return {
    step: 0,   /* 0 = days, 1 = meals, 2 = confirm */
    selectedDates: [localDate(0), localDate(1), localDate(2)],
    enabledMeals: Object.entries(profile.enabledMeals || {}).filter(([, enabled]) => enabled).map(([meal]) => meal),
    error: null
  };
}

function renderPlanDialog(root) {
  const draft = runtime.planDraft;
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  const stepLabels = ['Zeitraum', 'Mahlzeiten', 'Fertig'];
  const WEEKDAY_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

  let body = '';
  if (draft.step === 0) {
    body = `
      <h2>Wie viele Tage?</h2>
      <p style="color:var(--muted);font-size:var(--text-sm);margin-bottom:var(--space-3)">Wähle einen Zeitraum für deinen Plan.</p>
      <div class="chip-row" style="justify-content:center;margin-bottom:var(--space-4)">
        ${[3,5,7].map((n) => `<button class="chip ${draft.selectedDates.length === n ? 'active' : ''}" data-plan-preset="${n}" style="padding:var(--space-3) var(--space-5);font-size:var(--text-sm)">${n} Tage</button>`).join('')}
      </div>
      <div class="chip-row" style="justify-content:center">
        ${draft.selectedDates.map((date) => {
          const d = new Date(`${date}T12:00:00`);
          return `<span class="chip active" style="pointer-events:none">${WEEKDAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}</span>`;
        }).join('')}
      </div>`;
  } else if (draft.step === 1) {
    body = `
      <h2>Welche Mahlzeiten?</h2>
      <p style="color:var(--muted);font-size:var(--text-sm);margin-bottom:var(--space-3)">Was soll geplant werden?</p>
      <div class="option-grid">${MEAL_OPTIONS.map(([key, label]) =>
        `<button class="option-card ${draft.enabledMeals.includes(key) ? 'selected' : ''}" data-plan-meal="${key}"><strong>${escapeHtml(label)}</strong></button>`
      ).join('')}</div>`;
  } else {
    body = `
      <h2>Alles klar!</h2>
      <div class="v8-status" style="text-align:center;font-size:var(--text-base)">
        <strong>${draft.selectedDates.length}</strong> Tage · <strong>${draft.enabledMeals.length}</strong> Mahlzeiten<br>
        <span style="font-size:var(--text-sm);color:var(--muted)">${draft.selectedDates.length * draft.enabledMeals.length} Gerichte werden für dich zusammengestellt</span>
      </div>`;
  }

  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Schritt ${draft.step + 1} / 3 · ${stepLabels[draft.step]}</p>
    <div class="v8-progress"><div style="width:${((draft.step + 1) / 3) * 100}%"></div></div>
    ${body}
    <p class="v8-status error" data-plan-error ${draft.error ? '' : 'hidden'}>${escapeHtml(draft.error || '')}</p>
    <div class="v8-actions" style="margin-top:var(--space-5)">
      <button class="v8-button ghost" data-plan-action="close">Abbrechen</button>
      ${draft.step > 0 ? '<button class="v8-button" data-plan-action="back">Zurück</button>' : ''}
      <button class="v8-button primary" data-plan-action="${draft.step === 2 ? 'create' : 'next'}">${draft.step === 2 ? 'Plan erstellen' : 'Weiter'}</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  bindPlanDialogEvents(root);
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
  overlay.dataset.replacementOverlay = 'true';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Gericht austauschen</p>
    <h2>${escapeHtml((meal.recipe || meal).name)}</h2>
    <div class="chip-row" style="margin:var(--space-3) 0">${Object.entries(MODE_LABELS).map(([mode, label]) =>
      `<button class="chip ${runtime.replaceMode === mode ? 'active' : ''}" data-replace-mode="${mode}">${label}</button>`
    ).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${suggestions.length ? suggestions.map((recipe) => `
      <div class="meal-card2">
        <div class="meal-card2-top" style="cursor:default">
          <div class="meal-cat-badge">${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)}</div>
          <div class="meal-card-info">
            <div class="meal-name2">${escapeHtml(recipe.name)}</div>
            <div class="meal-macros-line">${Math.round(recipe.kcal)} kcal · ${Math.round(recipe.protein)}g P · ${Math.round(recipe.time)} Min.</div>
          </div>
          <button class="v8-button primary" style="align-self:center;padding:6px 12px;font-size:12px" data-pick-replacement="${escapeHtml(recipe.id)}">Wählen</button>
        </div>
      </div>
    `).join('') : '<div class="empty-state">Keine passenden Alternativen gefunden.</div>'}</div>
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
        replacedAt: new Date().toISOString()
      };
      updated.days = updatedDays;
      return { ...current, currentPlan: updated };
    });
    runtime.replaceTarget = null;
    overlay.remove();
    renderApp(root);
  }));
}

function renderDialog(root) {
  root.querySelector('.v8-overlay')?.remove();
  if (runtime.activeDialog === 'replace' && runtime.replaceTarget) { renderReplacementDialog(root); return; }
  if (runtime.activeDialog === 'plan' && runtime.planDraft) { renderPlanDialog(root); return; }
  if (runtime.activeDialog !== 'onboarding' || !runtime.onboardingDraft) return;
  const draft = runtime.onboardingDraft;
  const step = currentStep(draft);
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true"><p class="eyebrow">Einrichtung ${draft.stepIndex + 1} / 10</p><div class="v8-progress"><div style="width:${((draft.stepIndex + 1) / 10) * 100}%"></div></div>${onboardingBody(draft)}<p id="onboarding-error" class="v8-status error" hidden></p><div class="v8-actions" style="margin-top:22px"><button class="v8-button ghost" data-onboard-action="close">Überspringen</button>${draft.stepIndex ? '<button class="v8-button" data-onboard-action="back">Zurück</button>' : ''}<button class="v8-button primary" data-onboard-action="next">${step === 'summary' ? 'Profil speichern' : 'Weiter'}</button></div></section>`;
  root.appendChild(overlay);
  bindDialogEvents(root);
}

function bindPlanDialogEvents(root) {
  const draft = runtime.planDraft;

  /* Step 0: day presets */
  root.querySelectorAll('[data-plan-preset]').forEach((button) => button.addEventListener('click', () => {
    const count = Number(button.dataset.planPreset);
    draft.selectedDates = Array.from({ length: count }, (_, i) => localDate(i));
    draft.error = null;
    renderDialog(root);
  }));

  /* Step 1: meal toggles */
  root.querySelectorAll('[data-plan-meal]').forEach((button) => button.addEventListener('click', () => {
    const meal = button.dataset.planMeal;
    draft.enabledMeals = draft.enabledMeals.includes(meal)
      ? draft.enabledMeals.filter((m) => m !== meal)
      : [...draft.enabledMeals, meal];
    draft.error = null;
    renderDialog(root);
  }));

  /* Navigation */
  root.querySelectorAll('[data-plan-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.planAction;
    if (action === 'close') { runtime.activeDialog = null; runtime.planDraft = null; renderApp(root); return; }
    if (action === 'back') { draft.step = Math.max(0, draft.step - 1); draft.error = null; renderDialog(root); return; }
    if (action === 'next') {
      if (draft.step === 0 && !draft.selectedDates.length) { draft.error = 'Wähle mindestens einen Zeitraum.'; renderDialog(root); return; }
      if (draft.step === 1 && !draft.enabledMeals.length) { draft.error = 'Wähle mindestens eine Mahlzeit.'; renderDialog(root); return; }
      draft.step += 1;
      draft.error = null;
      renderDialog(root);
      return;
    }
    /* action === 'create' */
    createConfiguredPlan(root);
  }));
}

function bindDialogEvents(root) {
  root.querySelectorAll('[data-onboard-field]').forEach((button) => button.addEventListener('click', () => {
    const raw = button.dataset.onboardValue;
    const value = raw === '' && button.dataset.onboardField === 'goal' ? null : raw;
    setDraftValue(button.dataset.onboardField, value, button.dataset.multiple === 'true');
    renderDialog(root);
  }));
  root.querySelectorAll('[data-meal-key]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.mealKey;
    const current = runtime.onboardingDraft.profile.enabledMeals;
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { enabledMeals: { [key]: !current[key] } });
    renderDialog(root);
  }));
  root.querySelectorAll('[data-onboard-number]').forEach((input) => input.addEventListener('change', () => {
    const value = input.value === '' ? null : Number(input.value);
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { [input.dataset.onboardNumber]: value });
  }));
  root.querySelectorAll('[data-onboard-input]').forEach((input) => input.addEventListener('change', () => {
    runtime.onboardingDraft = updateDraft(runtime.onboardingDraft, { [input.dataset.onboardInput]: input.value.split(',').map((item) => item.trim()).filter(Boolean) });
  }));
  root.querySelectorAll('[data-onboard-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.onboardAction;
    if (action === 'close') { runtime.activeDialog = null; renderApp(root); return; }
    if (action === 'back') { runtime.onboardingDraft = previousStep(runtime.onboardingDraft); renderDialog(root); return; }
    const error = validateOnboardingStep(runtime.onboardingDraft);
    if (error) { const errorNode = root.querySelector('#onboarding-error'); errorNode.hidden = false; errorNode.textContent = error; return; }
    if (currentStep(runtime.onboardingDraft) === 'summary') {
      runtime.onboardingDraft = completeOnboarding(runtime.onboardingDraft);
      updateState((state) => ({ ...state, profile: runtime.onboardingDraft.profile, onboardingCompleted: true }));
      runtime.activeDialog = null;
      renderApp(root);
      return;
    }
    runtime.onboardingDraft = nextStep(runtime.onboardingDraft);
    renderDialog(root);
  }));
}

function openOnboarding(root) {
  runtime.onboardingDraft = createOnboardingDraft(getState().profile);
  runtime.activeDialog = 'onboarding';
  renderDialog(root);
}

function openPlanDialog(root) {
  runtime.planDraft = createPlanDraft(getState().profile);
  runtime.activeDialog = 'plan';
  renderDialog(root);
}

function createConfiguredPlan(root) {
  const draft = runtime.planDraft;
  if (!draft.selectedDates.length) { draft.error = 'Wähle mindestens einen Tag aus.'; renderDialog(root); return; }
  if (!draft.enabledMeals.length) { draft.error = 'Wähle mindestens eine Mahlzeit aus.'; renderDialog(root); return; }
  if (draft.selectedDates.length > 14) { draft.error = 'Ein einzelner Plan ist auf 14 Tage begrenzt.'; renderDialog(root); return; }

  try {
    const state = getState();
    const plan = buildPlan(runtime.recipes, {
      startDate: draft.selectedDates[0],
      selectedDates: draft.selectedDates,
      enabledMeals: draft.enabledMeals,
      mode: draft.selectedDates.length === 1 ? 'single_day' : 'multi_day',
      profile: state.profile
    }, state.preferences, { seed: Date.now() % 100000 });

    updateState((current) => ({
      ...current,
      currentPlan: plan,
      planHistory: current.currentPlan
        ? [current.currentPlan, ...(current.planHistory || [])].slice(0, 12)
        : current.planHistory || []
    }));
    runtime.activeDialog = null;
    runtime.planDraft = null;
    renderApp(root);
  } catch (error) {
    draft.error = error.message;
    renderDialog(root);
  }
}

function bindPageEvents(root) {
  root.querySelectorAll('[data-action="open-onboarding"]').forEach((button) => button.addEventListener('click', () => openOnboarding(root)));

  /* "Was esse ich heute?" — quick suggestion */
  root.querySelectorAll('[data-action="today-inspiration"]').forEach((el) => el.addEventListener('click', () => {
    if (!runtime.recipes.length) return;
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
    if (!runtime.recipes.length) return;
    openPlanDialog(root);
  }));

  /* Create single-day plan (quick "Nur für heute") */
  root.querySelectorAll('[data-action="single-day-plan"]').forEach((button) => button.addEventListener('click', () => {
    const state = getState();
    if (!state.onboardingCompleted) { openOnboarding(root); return; }
    if (!runtime.recipes.length) return;
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
      updateState((current) => ({
        ...current,
        currentPlan: plan,
        planHistory: current.currentPlan
          ? [current.currentPlan, ...(current.planHistory || [])].slice(0, 12)
          : current.planHistory || []
      }));
      renderApp(root);
    } catch (error) {
      console.error('[Preply] Tagesplan-Fehler', error);
    }
  }));

  /* View mode toggle (Heute/Woche) */
  root.querySelectorAll('[data-view-mode]').forEach((btn) => btn.addEventListener('click', () => {
    runtime.viewMode = btn.dataset.viewMode;
    renderApp(root);
  }));

  /* Plan day pills */
  root.querySelectorAll('[data-plan-day]').forEach((pill) => pill.addEventListener('click', () => {
    runtime.activePlanDay = pill.dataset.planDay;
    renderApp(root);
  }));

  /* Expand/collapse meal cards */
  root.querySelectorAll('[data-expand-meal]').forEach((el) => el.addEventListener('click', async (event) => {
    /* Don't expand if clicking the swap button */
    if (event.target.closest('[data-swap-meal]')) return;
    const key = el.dataset.expandMeal;
    const recipeId = el.dataset.recipeId;

    /* Toggle expansion */
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

  /* Swap meal button */
  root.querySelectorAll('[data-swap-meal]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!runtime.recipes.length) return;
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
