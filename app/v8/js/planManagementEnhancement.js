import { getState, updateState } from './core/store.js';
import { on } from './core/events.js';
import { RecipeRepository } from './data/recipeRepository.js';
import { buildPlan } from './features/planner/plannerEngine.js';

const SUPABASE_URL = 'https://rfdtjodpjvynnavnucvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrNRV-ogNAYt2cCoNHDXoKZ8GzE';
const repository = new RecipeRepository({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });

let recipesPromise;
let profileSignature;
let pendingProfileDecision = false;
let initialized = false;

function recipes() {
  recipesPromise ||= repository.listCards();
  return recipesPromise;
}

function signature(profile) {
  return JSON.stringify(profile || {});
}

function rebuildPlan(catalog, plan, profile, preferences, selectedDates = plan.selectedDates) {
  return buildPlan(catalog, {
    startDate: selectedDates[0],
    selectedDates,
    enabledMeals: plan.enabledMeals,
    mode: selectedDates.length === 1 ? 'single_day' : 'multi_day',
    profile
  }, preferences, { seed: Date.now() % 100000 });
}

async function regenerateWholePlan(root) {
  const state = getState();
  if (!state.currentPlan) return;
  const catalog = await recipes();
  const nextPlan = rebuildPlan(catalog, state.currentPlan, state.profile, state.preferences);
  updateState((current) => ({ ...current, currentPlan: nextPlan }));
  root.querySelector('.v8-overlay')?.remove();
}

async function regenerateDay(date) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan) return;
  const catalog = await recipes();
  const generated = rebuildPlan(catalog, plan, state.profile, state.preferences, [date]);
  const replacementDay = generated.days[0];
  const nextDays = plan.days.map((day) => day.date === date ? replacementDay : day);
  updateState((current) => ({
    ...current,
    currentPlan: {
      ...current.currentPlan,
      days: nextDays,
      updatedAt: new Date().toISOString()
    }
  }));
}

function openConfirmation(root, { title, text, confirmLabel, onConfirm }) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Plan aktualisieren</p>
    <h2>${title}</h2>
    <p>${text}</p>
    <div class="v8-actions" style="margin-top:22px">
      <button class="v8-button ghost" data-manage-cancel>Abbrechen</button>
      <button class="v8-button primary" data-manage-confirm>${confirmLabel}</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-manage-cancel]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-manage-confirm]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await onConfirm();
    overlay.remove();
  });
}

function openProfileDecision(root) {
  if (!pendingProfileDecision || !getState().currentPlan || root.querySelector('.v8-overlay')) return;
  pendingProfileDecision = false;
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true">
    <p class="eyebrow">Profil geändert</p>
    <h2>Was soll mit deinem aktuellen Plan passieren?</h2>
    <p>Der bestehende Plan wurde noch mit deinen vorherigen Einstellungen erstellt.</p>
    <div class="v8-actions" style="margin-top:22px">
      <button class="v8-button" data-profile-plan="keep">Plan behalten</button>
      <button class="v8-button primary" data-profile-plan="regenerate">Plan neu erstellen</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-profile-plan="keep"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-profile-plan="regenerate"]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await regenerateWholePlan(root);
    overlay.remove();
  });
}

export function initializePlanManagement() {
  if (initialized) return;
  initialized = true;
  profileSignature = signature(getState().profile);
  on('state:changed', ({ state }) => {
    const nextSignature = signature(state.profile);
    if (profileSignature !== undefined && nextSignature !== profileSignature && state.currentPlan) {
      pendingProfileDecision = true;
    }
    profileSignature = nextSignature;
  });
}

export function refreshPlanManagement(root) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan || !Array.isArray(plan.days)) return;

  const pageHead = root.querySelector('.v8-page-head');
  const actions = root.querySelector('.v8-page > .v8-actions');
  if (pageHead && actions && !actions.querySelector('[data-regenerate-plan]')) {
    const button = document.createElement('button');
    button.className = 'v8-button';
    button.dataset.regeneratePlan = 'true';
    button.textContent = 'Plan neu erstellen';
    button.addEventListener('click', () => openConfirmation(root, {
      title: 'Gesamten Plan neu erstellen?',
      text: 'Tage und ausgewählte Mahlzeiten bleiben gleich. Alle Gerichte werden neu zusammengestellt.',
      confirmLabel: 'Gesamten Plan erneuern',
      onConfirm: () => regenerateWholePlan(root)
    }));
    actions.appendChild(button);
  }

  root.querySelectorAll('.plan-day').forEach((section, index) => {
    const day = plan.days[index];
    const heading = section.querySelector('h2');
    if (!day || !heading || section.querySelector('[data-regenerate-day]')) return;
    const button = document.createElement('button');
    button.className = 'v8-button ghost';
    button.dataset.regenerateDay = day.date;
    button.textContent = 'Tag neu planen';
    button.addEventListener('click', () => openConfirmation(root, {
      title: `${heading.textContent} neu planen?`,
      text: 'Nur dieser Tag wird ersetzt. Alle anderen Tage bleiben unverändert.',
      confirmLabel: 'Diesen Tag erneuern',
      onConfirm: () => regenerateDay(day.date)
    }));
    heading.insertAdjacentElement('afterend', button);
  });

  queueMicrotask(() => openProfileDecision(root));
}
