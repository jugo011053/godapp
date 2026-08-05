import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { getState, initializeStore, updateState } from './core/store.js';

const appRoot = document.getElementById('app');

function routeLabel(route) {
  return {
    plan: 'Plan',
    recipes: 'Rezepte',
    shopping: 'Einkauf',
    profile: 'Profil'
  }[route] || 'Plan';
}

function renderFoundation(route = getRoute()) {
  const state = getState();
  appRoot.innerHTML = `
    <main class="app-content">
      <section class="foundation-card">
        <p class="eyebrow">Preply V8 · ${routeLabel(route)}</p>
        <h1>Modulare Arbeitsgrundlage</h1>
        <p>Die neue App wird parallel zur laufenden Version aufgebaut. Profilversion ${state.profile.version}, Schema ${state.schemaVersion}.</p>
        <nav aria-label="V8 Hauptnavigation" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:24px">
          ${['plan', 'recipes', 'shopping', 'profile'].map((item) =>
            `<a href="#${item}" ${item === route ? 'aria-current="page"' : ''}>${routeLabel(item)}</a>`
          ).join('')}
        </nav>
      </section>
    </main>`;
}

initializeStore();
on('route:changed', ({ route }) => renderFoundation(route));
initializeRouter();

window.PreplyV8 = Object.freeze({
  getState,
  updateState,
  getRoute
});

emit('app:ready', { state: getState(), route: getRoute() });
console.info('[Preply V8] Foundation geladen.');
