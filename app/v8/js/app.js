import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { getState, initializeStore, updateState } from './core/store.js';
import { renderShell } from './features/shell/renderShell.js';

const appRoot = document.getElementById('app');

initializeStore();
on('route:changed', ({ route }) => renderShell(appRoot, { route }));
initializeRouter();

window.PreplyV8 = Object.freeze({
  getState,
  updateState,
  getRoute
});

emit('app:ready', { state: getState(), route: getRoute() });
console.info('[Preply V8] Responsive Shell geladen.');
