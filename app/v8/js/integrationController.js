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
import { buildPlan, suggestForToday } from './features/planner/plannerEngine.js';
import { getReturnOptions, isPlanExpired } from './features/history/history.js';
const runtime = {
  recipes: [],
  catalogStatus: 'loading',
  catalogError: null,
  suggestions: [],
  onboardingDraft: null,
  planDraft: null,
  activeDialog: null,
  activePlanDay: null
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

function renderPlanPage() {
  const state = getState();
  const plan = state.currentPlan;
  if (plan && !isPlanExpired(plan)) {
    /* Find today's day or fall back to first day */
    const today = localDate(0);
    const activeDay = runtime.activePlanDay || today;
    const dayData = plan.days.find((d) => d.date === activeDay) || plan.days[0];
    const WEEKDAY_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

    return `<section class="v8-page">
      <div class="v8-page-head">
        <h1>Dein Plan</h1>
        <p>${plan.selectedDates.length} Tage · ${plan.enabledMeals.map((m) => MEAL_LABELS[m] || m).join(', ')}</p>
      </div>

      <div class="chip-row" style="margin-bottom:var(--space-4)">
        ${plan.days.map((day) => {
          const d = new Date(`${day.date}T12:00:00`);
          const wd = WEEKDAY_SHORT[d.getDay()];
          const dd = String(d.getDate()).padStart(2, '0');
          const isToday = day.date === today;
          const isActive = day.date === (dayData ? dayData.date : '');
          return `<button class="chip ${isActive ? 'active' : ''}" data-plan-day="${day.date}">${wd} ${dd}${isToday ? ' ·' : ''}</button>`;
        }).join('')}
      </div>

      ${dayData ? `<div class="v8-panel">
        <h2>${escapeHtml(dateLabel(dayData.date))}${dayData.date === today ? ' — Heute' : ''}</h2>
        ${Object.entries(dayData.meals).map(([category, meal]) => `<div class="meal-row">
          <div class="meal-label">${escapeHtml(MEAL_LABELS[category] || category)}</div>
          <div>
            <strong>${escapeHtml(meal.recipe.name)}</strong>
            <div class="recipe-meta">
              <span>${meal.estimatedKcalPerPerson} kcal</span>
              <span>${meal.estimatedProteinPerPerson} g Protein</span>
              <span>${Math.round(meal.recipe.time || 0)} Min.</span>
              ${meal.repeatedForMealPrep ? '<span>Meal Prep</span>' : ''}
            </div>
          </div>
        </div>`).join('')}
      </div>` : '<div class="empty-state">Kein Plan für diesen Tag.</div>'}

      <div class="v8-actions" style="margin-top:var(--space-3)">
        <button class="v8-button primary" data-action="create-plan">Neuer Plan</button>
      </div>
    </section>`;
  }

  return `<section class="v8-page">
    <div class="v8-page-head">
      <h1>Was kochst du?</h1>
      <p>Erstelle einen Essensplan für die nächsten Tage.</p>
    </div>
    ${catalogStatusHtml()}
    <div class="v8-start-grid">
      <button class="v8-start-card primary" data-action="create-plan"><strong>Plan erstellen</strong><span>Wir führen dich Schritt für Schritt.</span></button>
      <button class="v8-start-card" data-action="today-inspiration"><strong>Inspiration für heute</strong><span>Schnelle Vorschläge passend zu dir.</span></button>
    </div>
    ${runtime.suggestions.length ? `<div class="v8-panel" style="margin-top:var(--space-4)"><h2>Vorschläge</h2><div class="v8-grid">${runtime.suggestions.map((recipe) => recipeCard(recipe)).join('')}</div></div>` : ''}
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

function renderDialog(root) {
  root.querySelector('.v8-overlay')?.remove();
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
  root.querySelectorAll('[data-action="today-inspiration"]').forEach((button) => button.addEventListener('click', () => {
    if (!runtime.recipes.length) return;
    const state = getState();
    runtime.suggestions = suggestForToday(runtime.recipes, state.profile, state.preferences, {
      category: state.profile.enabledMeals.dinner ? 'dinner' : Object.keys(state.profile.enabledMeals).find((key) => state.profile.enabledMeals[key]) || 'dinner',
      seed: Date.now()
    });
    renderApp(root);
  }));
  root.querySelectorAll('[data-action="create-plan"]').forEach((button) => button.addEventListener('click', () => {
    if (!getState().onboardingCompleted) { openOnboarding(root); return; }
    if (!runtime.recipes.length) return;
    openPlanDialog(root);
  }));

  /* Plan day chips */
  root.querySelectorAll('[data-plan-day]').forEach((chip) => chip.addEventListener('click', () => {
    runtime.activePlanDay = chip.dataset.planDay;
    renderApp(root);
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
