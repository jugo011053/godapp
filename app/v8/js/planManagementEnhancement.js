import { getState, updateState } from './core/store.js';
import { on } from './core/events.js';
import { loadCards } from './data/recipeStore.js';
import { buildPlan } from './features/planner/plannerEngine.js';
import { replaceCurrentPlan } from './features/history/history.js';

let profileSignature;
let pendingProfileDecision = false;
let initialized = false;

const ICONS = {
  day: '<svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z"/><path d="m9 14 2 2 4-4"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/><path d="m17 16 3 3m0-3-3 3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M14 14c3.5 0 5.5 2 6 5"/></svg>'
};

function recipes() {
  return loadCards();
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

function closeOverlay(overlay) {
  overlay?.remove();
}

function bindOverlayDismiss(overlay) {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay);
  });
  const escapeHandler = (event) => {
    if (event.key !== 'Escape') return;
    closeOverlay(overlay);
    document.removeEventListener('keydown', escapeHandler);
  };
  document.addEventListener('keydown', escapeHandler);
}

async function regenerateWholePlan() {
  const state = getState();
  if (!state.currentPlan) return;
  const catalog = await recipes();
  const nextPlan = rebuildPlan(catalog, state.currentPlan, state.profile, state.preferences);
  updateState((current) => replaceCurrentPlan(current, nextPlan));
}

async function regenerateDay(date) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan || !Array.isArray(plan.days)) return;
  const currentDay = plan.days.find((day) => day.date === date);
  if (!currentDay) return;

  const catalog = await recipes();
  const currentRecipeIds = Object.values(currentDay.meals || {})
    .map((meal) => meal?.recipe?.id || meal?.recipeId)
    .filter(Boolean);
  const preferences = {
    ...state.preferences,
    excludedRecipeIds: [...new Set([...(state.preferences.excludedRecipeIds || []), ...currentRecipeIds])]
  };
  const generated = rebuildPlan(catalog, plan, state.profile, preferences, [date]);
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

function deleteCurrentPlan() {
  updateState((current) => replaceCurrentPlan(current, null));
}

function openConfirmation(root, { title, text, confirmLabel, destructive = false, onConfirm }) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-confirm-overlay';
  overlay.innerHTML = `<section class="v8-dialog plan-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-confirm-title">
    <div class="sheet-head">
      <h2 id="plan-confirm-title">${title}</h2>
      <button class="sheet-close" type="button" data-manage-cancel aria-label="Schließen">×</button>
    </div>
    <p>${text}</p>
    <div class="sheet-actions">
      <button class="sheet-action ${destructive ? 'danger' : 'primary'}" type="button" data-manage-confirm>${confirmLabel}</button>
      <button class="sheet-action" type="button" data-manage-cancel>Abbrechen</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  bindOverlayDismiss(overlay);
  overlay.querySelectorAll('[data-manage-cancel]').forEach((button) => button.addEventListener('click', () => closeOverlay(overlay)));
  overlay.querySelector('[data-manage-confirm]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await onConfirm();
    closeOverlay(overlay);
  });
  overlay.querySelector('[data-manage-confirm]')?.focus();
}

function activePlanDate(root, plan) {
  return root.querySelector('.preply-day.active')?.dataset.planDay || plan.days?.[0]?.date || null;
}

function menuItem({ icon, title, copy, attribute, danger = false }) {
  return `<button class="plan-menu-item${danger ? ' danger' : ''}" type="button" ${attribute}>
    <span class="plan-menu-icon">${icon}</span>
    <span class="plan-menu-copy"><strong>${title}</strong><small>${copy}</small></span>
    <span class="plan-menu-arrow" aria-hidden="true">›</span>
  </button>`;
}

function openPlanMenu(root, editTrigger) {
  const plan = getState().currentPlan;
  if (!plan || !Array.isArray(plan.days)) return;
  const date = activePlanDate(root, plan);

  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-menu-overlay';
  overlay.innerHTML = `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-menu-title">
    <div class="sheet-head">
      <h2 id="plan-menu-title">Neu zusammenstellen</h2>
      <button class="sheet-close" type="button" data-plan-menu-close aria-label="Schließen">×</button>
    </div>
    <div class="plan-menu-list">
      ${menuItem({ icon: ICONS.day, title: 'Diesen Tag neu planen', copy: 'Neue Gerichte nur für den ausgewählten Tag', attribute: `data-regenerate-day="${date || ''}"` })}
      ${menuItem({ icon: ICONS.plan, title: 'Gesamten Plan neu erstellen', copy: 'Alle Tage und Gerichte neu zusammenstellen', attribute: 'data-regenerate-plan' })}
    </div>
    ${menuItem({ icon: ICONS.trash, title: 'Plan löschen', copy: 'Den Plan entfernen und in der Historie sichern', attribute: 'data-delete-plan', danger: true })}
  </section>`;

  root.appendChild(overlay);
  bindOverlayDismiss(overlay);
  overlay.querySelector('[data-plan-menu-close]').addEventListener('click', () => closeOverlay(overlay));

  overlay.querySelector('[data-regenerate-day]').addEventListener('click', () => {
    closeOverlay(overlay);
    openConfirmation(root, {
      title: 'Diesen Tag neu planen?',
      text: 'Nur der ausgewählte Tag wird ersetzt. Alle anderen Tage bleiben unverändert.',
      confirmLabel: 'Diesen Tag erneuern',
      onConfirm: () => regenerateDay(date)
    });
  });

  overlay.querySelector('[data-regenerate-plan]').addEventListener('click', () => {
    closeOverlay(overlay);
    openConfirmation(root, {
      title: 'Gesamten Plan neu erstellen?',
      text: 'Tage und ausgewählte Mahlzeiten bleiben gleich. Alle Gerichte werden neu zusammengestellt.',
      confirmLabel: 'Gesamten Plan erneuern',
      onConfirm: regenerateWholePlan
    });
  });

  overlay.querySelector('[data-delete-plan]').addEventListener('click', () => {
    closeOverlay(overlay);
    openConfirmation(root, {
      title: 'Plan löschen?',
      text: 'Der aktuelle Plan verschwindet von der Heute-Seite und bleibt als früherer Plan in deiner Historie erhalten.',
      confirmLabel: 'Plan löschen',
      destructive: true,
      onConfirm: deleteCurrentPlan
    });
  });

  overlay.querySelector('[data-regenerate-day]')?.focus();
}

function openProfileDecision(root) {
  if (!pendingProfileDecision || !getState().currentPlan || root.querySelector('.v8-overlay')) return;
  pendingProfileDecision = false;
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay profile-decision-overlay';
  overlay.innerHTML = `<section class="v8-dialog profile-decision-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-decision-title">
    <div class="profile-decision-icon">${ICONS.people}</div>
    <h2 id="profile-decision-title">Dein Profil wurde geändert.</h2>
    <p>Deine Änderungen können Einfluss auf deinen aktuellen Plan haben.</p>
    <div class="sheet-actions">
      <button class="sheet-action primary" type="button" data-profile-plan="keep"><strong>Plan behalten</strong><small>Bestehende Gerichte soweit möglich behalten</small></button>
      <button class="sheet-action" type="button" data-profile-plan="regenerate"><strong>Plan neu erstellen</strong><small>Neue Gerichte passend zu deinem Profil</small></button>
    </div>
    <button class="profile-decision-cancel" type="button" data-profile-plan="cancel">Abbrechen</button>
  </section>`;
  root.appendChild(overlay);
  bindOverlayDismiss(overlay);
  overlay.querySelector('[data-profile-plan="keep"]').addEventListener('click', () => closeOverlay(overlay));
  overlay.querySelector('[data-profile-plan="cancel"]').addEventListener('click', () => closeOverlay(overlay));
  overlay.querySelector('[data-profile-plan="regenerate"]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await regenerateWholePlan();
    closeOverlay(overlay);
  });
  overlay.querySelector('[data-profile-plan="keep"]')?.focus();
}

function enhancePlanMenu(root) {
  root.querySelectorAll('.preply-section > button[data-action="create-plan"]').forEach((original) => {
    if (original.dataset.planEditTrigger === 'true') return;

    original.dataset.planEditTrigger = 'true';
    original.hidden = true;
    original.tabIndex = -1;
    original.setAttribute('aria-hidden', 'true');

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.dataset.planMenu = 'true';
    menuButton.textContent = 'Neu zusammenstellen';
    menuButton.addEventListener('click', () => openPlanMenu(root, original));
    original.insertAdjacentElement('afterend', menuButton);
  });
}

export function initializePlanManagement() {
  if (initialized) return;
  initialized = true;
  profileSignature = signature(getState().profile);
  on('state:changed', (state) => {
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

  enhancePlanMenu(root);
  queueMicrotask(() => openProfileDecision(root));
}
