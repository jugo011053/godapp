import { getState, updateState } from './core/store.js';
import { on } from './core/events.js';
import { loadCards } from './data/recipeStore.js';
import { buildPlan } from './features/planner/plannerEngine.js';
import {
  replaceCurrentPlan, protectedMeals, applyProtectedMeals, countPinnedMeals,
  clearAllPins, recentRecipeIds, undoLastPlanChange, canUndoPlan,
  normalizePlanDays, localToday
} from './features/history/history.js';
import { DIRECTIONS } from './data/recipeScoring.js';
import { haptic } from './core/feel.js';
import { showToast } from './core/toast.js';

let profileSignature;
let pendingProfileDecision = false;
let suppressNextProfileDecision = false;
let initialized = false;

const MEAL_LABELS = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack'
};

const ICONS = {
  day: '<svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1-1v13H4V6a1 1 0 0 1 1-1Z"/><path d="m9 14 2 2 4-4"/></svg>',
  plan: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/><path d="m17 16 3 3m0-3-3 3"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.2 3 3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M14 14c3.5 0 5.5 2 6 5"/></svg>'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function recipes() {
  return loadCards();
}

function signature(profile) {
  return JSON.stringify(profile || {});
}

function rebuildPlan(catalog, plan, profile, preferences, selectedDates = plan.selectedDates, enabledMeals = plan.enabledMeals, options = {}) {
  return buildPlan(catalog, {
    startDate: selectedDates[0],
    selectedDates,
    enabledMeals,
    mode: selectedDates.length === 1 ? 'single_day' : 'multi_day',
    profile
  }, preferences, {
    seed: Date.now() % 100000,
    direction: options.direction || null,
    recentRecipeIds: options.recentRecipeIds,
    recentFamilies: options.recentFamilies
  });
}

/* Eine Neuplanung mit erklaerter Absicht: Der Nutzer sagt, woran es lag,
   angepinnte und vergangene Gerichte bleiben stehen, und das Ergebnis
   laesst sich zuruecknehmen. */
async function replanWithDirection(root, { direction, scope, activeDate }) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan) return;

  const catalog = await recipes();
  const today = localToday();
  const allDates = normalizePlanDays(plan).map((day) => day.date);
  const targetDates = scope === 'day' && activeDate ? [activeDate] : allDates;

  /* Vergangenes und Angepinntes ueberlebt — unabhaengig vom Umfang. */
  const keep = protectedMeals(plan, today).filter((entry) => targetDates.includes(entry.date));
  const keptIds = keep.map((entry) => entry.meal?.recipeId || entry.meal?.recipe?.id).filter(Boolean);

  const recent = recentRecipeIds(state);
  const preferences = {
    ...state.preferences,
    /* Was stehen bleibt, darf nicht ein zweites Mal gezogen werden. */
    excludedRecipeIds: [...new Set([...(state.preferences?.excludedRecipeIds || []), ...keptIds])]
  };

  const generated = rebuildPlan(
    catalog, plan, state.profile, preferences, targetDates,
    plan.enabledMeals || [...new Set(normalizePlanDays(plan).flatMap((d) => Object.keys(d.meals || {})))],
    { direction, recentRecipeIds: recent.ids, recentFamilies: recent.families }
  );

  const rebuilt = applyProtectedMeals(generated, keep);

  /* Beim Tagesumfang bleibt der Rest der Woche unangetastet. */
  const nextPlan = scope === 'day'
    ? {
        ...plan,
        days: normalizePlanDays(plan).map((day) => {
          const replacement = normalizePlanDays(rebuilt).find((d) => d.date === day.date);
          return replacement || day;
        }),
        updatedAt: new Date().toISOString()
      }
    : rebuilt;

  updateState((current) => replaceCurrentPlan(current, nextPlan));
  haptic('strong');

  const label = direction ? DIRECTIONS[direction]?.hint?.toLowerCase() : 'neu gemischt';
  showToast(root, `Plan angepasst: ${label}.`, {
    actionLabel: 'Rueckgaengig',
    onAction: () => {
      updateState((current) => undoLastPlanChange(current));
      showToast(root, 'Aenderung zurueckgenommen.');
    }
  });
}

function closeOverlay(overlay) {
  overlay?.remove();
}

function bindOverlayDismiss(overlay) {
  overlay.dataset.dismissible = 'true';
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

function deleteCurrentPlan() {
  updateState((current) => replaceCurrentPlan(current, null));
}

function openConfirmation(root, { title, text, confirmLabel, destructive = false, onConfirm }) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-confirm-overlay';
  overlay.innerHTML = `<section class="v8-dialog plan-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-confirm-title">
    <div class="sheet-head">
      <h2 id="plan-confirm-title">${esc(title)}</h2>
      <button class="sheet-close" type="button" data-manage-cancel aria-label="Schließen">×</button>
    </div>
    <p>${esc(text)}</p>
    <div class="sheet-actions">
      <button class="sheet-action ${destructive ? 'danger' : 'primary'}" type="button" data-manage-confirm>${esc(confirmLabel)}</button>
      <button class="sheet-action" type="button" data-manage-cancel>Abbrechen</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  bindOverlayDismiss(overlay);
  overlay.querySelectorAll('[data-manage-cancel]').forEach((button) => button.addEventListener('click', () => closeOverlay(overlay)));
  overlay.querySelector('[data-manage-confirm]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await onConfirm();
    haptic('strong');
    closeOverlay(overlay);
  });
  overlay.querySelector('[data-manage-confirm]')?.focus();
}

/* Bezugstag fuer "nur dieser Tag": der aufgeklappte Tag in der Woche, sonst
   der Tag der Heute-Ansicht, sonst der erste Tag des Plans. */
function activePlanDate(root, plan) {
  return root.querySelector('[data-active-day-date]')?.dataset.activeDayDate
    || root.querySelector('.preply-day.active')?.dataset.planDay
    || normalizePlanDays(plan)[0]?.date
    || null;
}

function menuItem({ icon, title, copy, attribute, danger = false }) {
  return `<button class="plan-menu-item${danger ? ' danger' : ''}" type="button" ${attribute}>
    <span class="plan-menu-icon">${icon}</span>
    <span class="plan-menu-copy"><strong>${title}</strong><small>${copy}</small></span>
    <span class="plan-menu-arrow" aria-hidden="true">›</span>
  </button>`;
}

function datePlus(date, offset) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function uniqueSortedDates(dates) {
  return [...new Set(dates.filter(Boolean))].sort();
}

function preserveExistingMeals(generated, previousPlan, profile, enabledMeals) {
  const previousByDate = new Map((previousPlan.days || []).map((day) => [day.date, day]));
  return {
    ...generated,
    days: generated.days.map((day) => {
      const previous = previousByDate.get(day.date);
      if (!previous) return day;
      const meals = { ...day.meals };
      enabledMeals.forEach((meal) => {
        if (!previous.meals?.[meal]) return;
        meals[meal] = {
          ...previous.meals[meal],
          persons: Math.max(1, Number(profile.persons) || 1)
        };
      });
      return { ...day, meals };
    })
  };
}

function createPlanEditDraft(state) {
  return {
    selectedDates: uniqueSortedDates(state.currentPlan.selectedDates || state.currentPlan.days.map((day) => day.date)),
    enabledMeals: [...new Set(state.currentPlan.enabledMeals || Object.keys(state.currentPlan.days?.[0]?.meals || {}))],
    persons: Math.max(1, Number(state.profile.persons || 1)),
    error: ''
  };
}

function renderPlanEditor(root, draft) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-menu-overlay';
  overlay.innerHTML = `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-editor-title">
    <div class="sheet-head"><h2 id="plan-editor-title">Plan bearbeiten</h2><button class="sheet-close" type="button" data-editor-close aria-label="Schließen">×</button></div>
    <div class="master-plan-editor">
      ${draft.error ? `<p class="master-editor-error">${esc(draft.error)}</p>` : ''}
      <div class="master-editor-block">
        <p>Schnellauswahl</p>
        <div class="master-preset-row">${[3, 5, 7].map((count) => `<button class="master-preset ${draft.selectedDates.length === count ? 'active' : ''}" type="button" data-editor-preset="${count}">${count} Tage</button>`).join('')}</div>
      </div>
      <div class="master-editor-block">
        <p>Zeitraum</p>
        <div class="master-date-list">${draft.selectedDates.map((date, index) => `<div class="master-date-row"><input type="date" value="${esc(date)}" data-editor-date="${index}" aria-label="Datum ${index + 1}"><button type="button" data-editor-remove-date="${index}" aria-label="Datum entfernen">×</button></div>`).join('')}</div>
        <button class="master-add-date" type="button" data-editor-add-date>Weiteren Tag hinzufügen</button>
      </div>
      <div class="master-editor-block">
        <p>Mahlzeiten</p>
        <div class="master-editor-meals">${Object.entries(MEAL_LABELS).map(([meal, label]) => `<button class="master-editor-meal ${draft.enabledMeals.includes(meal) ? 'active' : ''}" type="button" data-editor-meal="${meal}" aria-pressed="${draft.enabledMeals.includes(meal)}">${label}</button>`).join('')}</div>
      </div>
      <div class="master-editor-block">
        <p>Personen</p>
        <input class="master-editor-persons" type="number" min="1" max="12" value="${draft.persons}" data-editor-persons>
      </div>
      <button class="sheet-action primary" type="button" data-editor-save>Änderungen übernehmen</button>
    </div>
  </section>`;
  root.appendChild(overlay);
  bindOverlayDismiss(overlay);

  overlay.querySelector('[data-editor-close]').addEventListener('click', () => closeOverlay(overlay));
  overlay.querySelectorAll('[data-editor-date]').forEach((input) => input.addEventListener('change', () => {
    draft.selectedDates[Number(input.dataset.editorDate)] = input.value;
    draft.selectedDates = uniqueSortedDates(draft.selectedDates);
  }));
  overlay.querySelectorAll('[data-editor-preset]').forEach((button) => button.addEventListener('click', () => {
    const count = Number(button.dataset.editorPreset);
    const start = draft.selectedDates[0] || new Date().toISOString().slice(0, 10);
    draft.selectedDates = Array.from({ length: count }, (_, index) => datePlus(start, index));
    draft.error = '';
    renderPlanEditor(root, draft);
  }));
  overlay.querySelectorAll('[data-editor-remove-date]').forEach((button) => button.addEventListener('click', () => {
    if (draft.selectedDates.length <= 1) {
      draft.error = 'Mindestens ein Tag muss im Plan bleiben.';
    } else {
      draft.selectedDates.splice(Number(button.dataset.editorRemoveDate), 1);
      draft.error = '';
    }
    renderPlanEditor(root, draft);
  }));
  overlay.querySelector('[data-editor-add-date]').addEventListener('click', () => {
    const last = draft.selectedDates[draft.selectedDates.length - 1] || new Date().toISOString().slice(0, 10);
    draft.selectedDates = uniqueSortedDates([...draft.selectedDates, datePlus(last, 1)]);
    draft.error = '';
    renderPlanEditor(root, draft);
  });
  overlay.querySelectorAll('[data-editor-meal]').forEach((button) => button.addEventListener('click', () => {
    const meal = button.dataset.editorMeal;
    if (draft.enabledMeals.includes(meal)) {
      if (draft.enabledMeals.length === 1) {
        draft.error = 'Mindestens eine Mahlzeit muss ausgewählt bleiben.';
        renderPlanEditor(root, draft);
        return;
      }
      draft.enabledMeals = draft.enabledMeals.filter((value) => value !== meal);
    } else {
      draft.enabledMeals.push(meal);
    }
    draft.error = '';
    renderPlanEditor(root, draft);
  }));
  overlay.querySelector('[data-editor-persons]').addEventListener('change', (event) => {
    draft.persons = Math.max(1, Number(event.currentTarget.value || 1));
  });
  overlay.querySelector('[data-editor-save]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    draft.selectedDates = uniqueSortedDates(draft.selectedDates);
    draft.persons = Math.max(1, Number(overlay.querySelector('[data-editor-persons]').value || draft.persons || 1));
    if (!draft.selectedDates.length || !draft.enabledMeals.length) {
      draft.error = 'Wähle mindestens einen Tag und eine Mahlzeit.';
      renderPlanEditor(root, draft);
      return;
    }

    try {
      const state = getState();
      const catalog = await recipes();
      const nextProfile = {
        ...state.profile,
        persons: draft.persons,
        enabledMeals: Object.fromEntries(Object.keys(MEAL_LABELS).map((meal) => [meal, draft.enabledMeals.includes(meal)]))
      };
      const generated = rebuildPlan(catalog, state.currentPlan, nextProfile, state.preferences, draft.selectedDates, draft.enabledMeals);
      const nextPlan = preserveExistingMeals(generated, state.currentPlan, nextProfile, draft.enabledMeals);
      suppressNextProfileDecision = true;
      updateState((current) => replaceCurrentPlan({ ...current, profile: nextProfile }, nextPlan));
      closeOverlay(overlay);
    } catch (error) {
      draft.error = error.message || 'Der Plan konnte nicht bearbeitet werden.';
      renderPlanEditor(root, draft);
    }
  });
}

function shoppedDatesFor(state, plan) {
  /* Ein Haken sagt "hab ich im Wagen" — daraus leiten wir keine Entscheidung
     mehr ab, wir weisen nur darauf hin. */
  const checks = state.shoppingChecks || {};
  if (!Object.values(checks).some(Boolean)) return [];
  const today = localToday();
  return normalizePlanDays(plan).map((day) => day.date).filter((date) => date >= today).slice(0, 2);
}

function dayLabelShort(date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '');
}

function openPlanMenu(root) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan || !Array.isArray(plan.days)) return;

  const activeDate = activePlanDate(root, plan);
  const multiDay = normalizePlanDays(plan).length > 1;
  const draft = { scope: multiDay ? 'plan' : 'day' };

  const render = () => {
    root.querySelector('.v8-overlay')?.remove();
    const pinned = countPinnedMeals(plan);
    const shopped = shoppedDatesFor(state, plan);

    const overlay = document.createElement('div');
    overlay.className = 'v8-overlay plan-menu-overlay';
    overlay.innerHTML = `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-menu-title">
      <div class="sheet-head">
        <h2 id="plan-menu-title">Passt nicht? Woran liegt&#39;s?</h2>
        <button class="sheet-close" type="button" data-plan-menu-close aria-label="Schlie&szlig;en">&times;</button>
      </div>

      ${multiDay ? `<div class="plan-scope-row" role="group" aria-label="Umfang">
        <button type="button" class="${draft.scope === 'day' ? 'active' : ''}" data-scope="day">Nur ${esc(activeDate ? dayLabelShort(activeDate) : 'heute')}</button>
        <button type="button" class="${draft.scope === 'plan' ? 'active' : ''}" data-scope="plan">Ganze Woche</button>
      </div>` : ''}

      <div class="plan-direction-grid">
        ${Object.entries(DIRECTIONS).map(([key, item]) =>
          `<button class="plan-direction" type="button" data-direction="${key}"><strong>${esc(item.label)}</strong><small>${esc(item.hint)}</small></button>`
        ).join('')}
      </div>

      <button class="sheet-action" type="button" data-direction="">Einfach neu mischen</button>

      ${pinned ? `<div class="plan-notice"><span>${pinned} ${pinned === 1 ? 'Gericht ist angepinnt und bleibt' : 'Gerichte sind angepinnt und bleiben'} stehen.</span><button type="button" data-clear-pins>Alle l&ouml;sen</button></div>` : ''}
      ${shopped.length ? `<div class="plan-notice"><span>F&uuml;r ${shopped.map(dayLabelShort).map(esc).join(' und ')} hast du schon eingekauft. Die Einkaufsliste &auml;ndert sich mit.</span></div>` : ''}

      <div class="plan-menu-list" style="margin-top:14px">
        ${menuItem({ icon: ICONS.edit, title: 'Plan bearbeiten', copy: 'Zeitraum, Mahlzeiten oder Personen &auml;ndern', attribute: 'data-edit-plan' })}
      </div>
      ${menuItem({ icon: ICONS.trash, title: 'Plan l&ouml;schen', copy: 'Entfernt den Plan und sichert ihn in der Historie', attribute: 'data-delete-plan', danger: true })}
    </section>`;

    root.appendChild(overlay);
    bindOverlayDismiss(overlay);
    overlay.querySelector('[data-plan-menu-close]').addEventListener('click', () => closeOverlay(overlay));

    overlay.querySelectorAll('[data-scope]').forEach((button) => button.addEventListener('click', () => {
      draft.scope = button.dataset.scope;
      haptic('tap');
      render();
    }));

    overlay.querySelector('[data-clear-pins]')?.addEventListener('click', () => {
      updateState((current) => ({ ...current, currentPlan: clearAllPins(current.currentPlan) }));
      haptic('tap');
      closeOverlay(overlay);
    });

    overlay.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', async () => {
      const direction = button.dataset.direction || null;
      closeOverlay(overlay);
      await replanWithDirection(root, { direction, scope: draft.scope, activeDate });
    }));

    overlay.querySelector('[data-edit-plan]').addEventListener('click', () => {
      closeOverlay(overlay);
      renderPlanEditor(root, createPlanEditDraft(getState()));
    });

    overlay.querySelector('[data-delete-plan]').addEventListener('click', () => {
      closeOverlay(overlay);
      openConfirmation(root, {
        title: 'Plan l\u00f6schen?',
        text: 'Der Plan verschwindet von der Heute-Seite und bleibt als fr\u00fcherer Plan in deiner Historie erhalten.',
        confirmLabel: 'Plan l\u00f6schen',
        destructive: true,
        onConfirm: deleteCurrentPlan
      });
    });
  };

  render();
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
    menuButton.addEventListener('click', () => openPlanMenu(root));
    original.insertAdjacentElement('afterend', menuButton);
  });
}

export function initializePlanManagement() {
  if (initialized) return;
  initialized = true;
  profileSignature = signature(getState().profile);
  on('state:changed', (state) => {
    const nextSignature = signature(state.profile);
    if (suppressNextProfileDecision) {
      suppressNextProfileDecision = false;
    } else if (profileSignature !== undefined && nextSignature !== profileSignature && state.currentPlan) {
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
