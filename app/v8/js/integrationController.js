import { getRoute, navigate } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { RecipeRepository } from './data/recipeRepository.js';
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

const SUPABASE_URL = 'https://rfdtjodpjvynnavnucvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrNRV-ogNAYt2cCoNHDXoKZ8GzE';

const repository = new RecipeRepository({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
const runtime = {
  recipes: [],
  catalogStatus: 'loading',
  catalogError: null,
  suggestions: [],
  onboardingDraft: null,
  activeDialog: null
};

const MEAL_LABELS = Object.fromEntries(MEAL_OPTIONS);

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

function recipeCard(recipe, extra = '') {
  return `<article class="recipe-card" data-recipe-id="${escapeHtml(recipe.id)}">
    <div>
      <p class="eyebrow">${escapeHtml(MEAL_LABELS[recipe.category] || recipe.category)}</p>
      <h3>${escapeHtml(recipe.name)}</h3>
    </div>
    <div class="recipe-meta">
      <span>${Math.round(recipe.kcal)} kcal</span>
      <span>${Math.round(recipe.protein)} g Protein</span>
      <span>${Math.round(recipe.time)} Min.</span>
      <span>${escapeHtml(recipe.simplicity || 'ausgewogen')}</span>
    </div>
    ${extra}
  </article>`;
}

function catalogStatusHtml() {
  if (runtime.catalogStatus === 'loading') return '<div class="v8-status">Rezeptkatalog wird geladen …</div>';
  if (runtime.catalogStatus === 'error') return `<div class="v8-status error">${escapeHtml(runtime.catalogError || 'Katalog konnte nicht geladen werden.')}</div>`;
  return `<div class="v8-status">${runtime.recipes.length} geprüfte Rezepte geladen.</div>`;
}

function renderPlanPage() {
  const state = getState();
  const plan = state.currentPlan;
  if (plan && !isPlanExpired(plan)) {
    return `<section class="v8-page">
      <div class="v8-page-head"><div><p class="eyebrow">Dein Plan</p><h1>${escapeHtml(plan.startDate)} bis ${escapeHtml(plan.endDate)}</h1></div><p>Gerichte austauschen und Einkaufstage auswählen folgen direkt aus diesem Plan.</p></div>
      ${catalogStatusHtml()}
      <div class="v8-actions"><button class="v8-button primary" data-action="today-inspiration">Inspiration für heute</button><button class="v8-button" data-action="create-plan">Neuen Plan erstellen</button></div>
      <div class="v8-panel">${plan.days.map((day) => `<section class="plan-day"><h2>${escapeHtml(day.date)}</h2>${Object.entries(day.meals).map(([category, meal]) => `<div class="meal-row"><div class="meal-label">${escapeHtml(MEAL_LABELS[category] || category)}</div><div><strong>${escapeHtml(meal.recipe.name)}</strong><div class="recipe-meta"><span>${meal.estimatedKcalPerPerson} kcal</span><span>${meal.estimatedProteinPerPerson} g Protein</span>${meal.repeatedForMealPrep ? '<span>Meal Prep</span>' : ''}</div></div></div>`).join('')}</section>`).join('')}</div>
    </section>`;
  }

  const returnOptions = getReturnOptions(state);
  return `<section class="v8-page">
    <div class="v8-page-head"><div><p class="eyebrow">Planen</p><h1>Was passt heute?</h1></div><p>Direkte Inspiration oder ein Plan für ausgewählte Tage. Die App verlangt keine religiöse Bindung an Montag bis Sonntag.</p></div>
    ${catalogStatusHtml()}
    ${returnOptions.actions.includes('open_history') ? '<div class="v8-status">Dein alter Plan ist abgelaufen. Du kannst neu starten oder die Historie öffnen.</div>' : ''}
    <div class="v8-start-grid">
      <button class="v8-start-card primary" data-action="today-inspiration"><strong>Was esse ich heute?</strong><span>Drei passende Vorschläge anhand deines Profils.</span></button>
      <button class="v8-start-card" data-action="create-plan"><strong>Essensplan erstellen</strong><span>Plane die nächsten drei Tage oder eine ganze Woche.</span></button>
    </div>
    ${runtime.suggestions.length ? `<div class="v8-panel"><h2>Drei Vorschläge für heute</h2><div class="v8-grid">${runtime.suggestions.map((recipe) => recipeCard(recipe, '<button class="v8-button primary" data-action="use-suggestion">Für heute wählen</button>')).join('')}</div></div>` : ''}
  </section>`;
}

function renderRecipesPage() {
  return `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Rezepte</p><h1>Alle Gerichte</h1></div><p>Die vollständigen Filter werden auf dieser Datenbasis angeschlossen.</p></div>${catalogStatusHtml()}<div class="v8-panel"><label for="recipe-search"><strong>Suche</strong></label><input id="recipe-search" type="search" placeholder="Name, Zutat oder Tag"><div id="recipe-results" class="v8-grid" style="margin-top:14px">${runtime.recipes.slice(0, 48).map((recipe) => recipeCard(recipe)).join('')}</div></div></section>`;
}

function renderShoppingPage() {
  const plan = getState().currentPlan;
  if (!plan || isPlanExpired(plan)) return '<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Einkauf</p><h1>Noch kein aktiver Plan</h1></div><p>Erstelle zuerst einen Plan. Danach erscheinen hier die auswählbaren Tage.</p></div></section>';
  return `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Einkauf</p><h1>Welche Tage kaufst du ein?</h1></div><p>Die Tagesauswahl wird aus deinem aktuellen Plan erzeugt.</p></div><div class="v8-panel"><div class="day-chip-row">${plan.selectedDates.map((date) => `<button class="day-toggle active" data-shop-date="${date}">${new Intl.DateTimeFormat('de-DE',{weekday:'short'}).format(new Date(`${date}T12:00:00`))}</button>`).join('')}</div><div class="empty-state">Die Detailzutaten werden beim nächsten Integrationsschritt aus den Rezeptdetails aggregiert.</div></div></section>`;
}

function renderProfilePage() {
  const state = getState();
  const summary = buildProfileSummary(state.profile);
  return `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Profil</p><h1>Deine Einstellungen</h1></div><p>Diese Angaben steuern Vorschläge und Pläne.</p></div><div class="v8-panel"><p>${escapeHtml(summary)}</p><div class="v8-actions"><button class="v8-button primary" data-action="open-onboarding">Profil bearbeiten</button></div></div></section>`;
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
  if (step === 'restrictions') return `<h2>Was soll ausgeschlossen werden?</h2><div class="option-grid">${['gluten','dairy','eggs','nuts','soy','fish'].map((item) => `<button class="option-card ${(profile.allergies || []).includes(item) ? 'selected' : ''}" data-onboard-field="allergies" data-onboard-value="${item}" data-multiple="true"><strong>${item}</strong></button>`).join('')}</div><div class="form-field" style="margin-top:14px"><label>Weitere ausgeschlossene Zutaten, kommagetrennt</label><input data-onboard-input="excludedIngredients" value="${escapeHtml((profile.excludedIngredients || []).join(', '))}"></div>`;
  if (step === 'meals') return `<h2>Welche Mahlzeiten möchtest du planen?</h2><div class="option-grid">${MEAL_OPTIONS.map(([key,label]) => `<button class="option-card ${profile.enabledMeals[key] ? 'selected' : ''}" data-meal-key="${key}"><strong>${label}</strong></button>`).join('')}</div>`;
  if (step === 'details') return `<h2>Optionale Details</h2><div class="form-grid"><div class="form-field"><label>Personen</label><input type="number" min="1" data-onboard-number="persons" value="${profile.persons}"></div><div class="form-field"><label>Maximale Kochzeit</label><input type="number" min="5" data-onboard-number="maxCookingTime" value="${profile.maxCookingTime || 30}"></div><div class="form-field"><label>Kalorienziel</label><input type="number" min="0" data-onboard-number="calorieTarget" value="${profile.calorieTarget || ''}"></div><div class="form-field"><label>Proteinziel</label><input type="number" min="0" data-onboard-number="proteinTarget" value="${profile.proteinTarget || ''}"></div></div>`;
  return `<h2>So wird geplant</h2><div class="v8-status">${escapeHtml(buildProfileSummary(profile))}</div>`;
}

function renderDialog(root) {
  root.querySelector('.v8-overlay')?.remove();
  if (runtime.activeDialog !== 'onboarding' || !runtime.onboardingDraft) return;
  const draft = runtime.onboardingDraft;
  const step = currentStep(draft);
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true"><p class="eyebrow">Einrichtung ${draft.stepIndex + 1} / 10</p><div class="v8-progress"><div style="width:${((draft.stepIndex + 1) / 10) * 100}%"></div></div>${onboardingBody(draft)}<p id="onboarding-error" class="v8-status error" hidden></p><div class="v8-actions" style="margin-top:22px"><button class="v8-button ghost" data-onboard-action="close">Später</button>${draft.stepIndex ? '<button class="v8-button" data-onboard-action="back">Zurück</button>' : ''}<button class="v8-button primary" data-onboard-action="next">${step === 'summary' ? 'Profil speichern' : 'Weiter'}</button></div></section>`;
  root.appendChild(overlay);
  bindDialogEvents(root);
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

function buildQuickPlan() {
  const state = getState();
  const enabledMeals = Object.entries(state.profile.enabledMeals).filter(([, enabled]) => enabled).map(([key]) => key);
  const plan = buildPlan(runtime.recipes, {
    startDate: localDate(0),
    selectedDates: [localDate(0), localDate(1), localDate(2)],
    enabledMeals,
    mode: 'multi_day',
    profile: state.profile
  }, state.preferences, { seed: Date.now() % 100000 });
  updateState((current) => ({ ...current, currentPlan: plan }));
}

function bindPageEvents(root) {
  root.querySelectorAll('[data-action="open-onboarding"]').forEach((button) => button.addEventListener('click', () => openOnboarding(root)));
  root.querySelectorAll('[data-action="today-inspiration"]').forEach((button) => button.addEventListener('click', () => {
    if (!runtime.recipes.length) return;
    const state = getState();
    runtime.suggestions = suggestForToday(runtime.recipes, state.profile, state.preferences, { category: state.profile.enabledMeals.dinner ? 'dinner' : Object.keys(state.profile.enabledMeals).find((key) => state.profile.enabledMeals[key]) || 'dinner', seed: Date.now() });
    renderApp(root);
  }));
  root.querySelectorAll('[data-action="create-plan"]').forEach((button) => button.addEventListener('click', () => {
    if (!getState().onboardingCompleted) { openOnboarding(root); return; }
    if (!runtime.recipes.length) return;
    try { buildQuickPlan(); renderApp(root); } catch (error) { runtime.catalogError = error.message; runtime.catalogStatus = 'error'; renderApp(root); }
  }));
  root.querySelector('#recipe-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    const results = runtime.recipes.filter((recipe) => [recipe.name, ...(recipe.ingredientNames || []), ...(recipe.tags || [])].join(' ').toLowerCase().includes(query)).slice(0, 60);
    const container = root.querySelector('#recipe-results');
    if (container) container.innerHTML = results.map((recipe) => recipeCard(recipe)).join('');
  });
}

export async function startIntegratedApp(root) {
  renderApp(root);
  try {
    runtime.recipes = await repository.listCards();
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
