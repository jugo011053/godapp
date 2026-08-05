import { getRoute, navigate } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { reuseHistoryEntry } from './features/history/history.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}

function todayKey() {
  const date = new Date();
  date.setHours(12,0,0,0);
  return date.toISOString().slice(0,10);
}

export function refreshHistoryEnhancement(root) {
  if (getRoute() !== 'profile') return;
  const page = root.querySelector('.v8-main .v8-page');
  if (!page || page.querySelector('[data-v8-history]')) return;
  const history = getState().planHistory || [];
  const section = document.createElement('section');
  section.className = 'v8-panel';
  section.dataset.v8History = 'true';
  section.innerHTML = `<h2>Planverlauf</h2>${history.length ? history.map((entry) => `<article class="meal-row"><div><strong>${esc(entry.startDate || 'Ohne Datum')} bis ${esc(entry.endDate || '')}</strong><div class="recipe-meta"><span>${(entry.selectedDates || []).length} Tage</span></div></div><button class="v8-button" data-v8-reuse-plan="${esc(entry.id)}">Ab heute verwenden</button></article>`).join('') : '<div class="empty-state">Noch keine alten Pläne. Die App hat also zumindest noch keine kulinarische Vergangenheit gegen dich.</div>'}`;
  page.appendChild(section);
  section.querySelectorAll('[data-v8-reuse-plan]').forEach((button) => button.addEventListener('click', () => {
    const entry = (getState().planHistory || []).find((item) => item.id === button.dataset.v8ReusePlan);
    if (!entry) return;
    const plan = reuseHistoryEntry(entry, todayKey());
    updateState((state) => ({ ...state, currentPlan: plan }));
    navigate('plan');
  }));
}
