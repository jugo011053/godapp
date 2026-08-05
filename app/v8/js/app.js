import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { getState, initializeStore, updateState } from './core/store.js';
import { rerenderIntegratedApp, startIntegratedApp } from './integrationController.js';

const appRoot = document.getElementById('app');

initializeStore();
on('route:changed', () => rerenderIntegratedApp(appRoot));
on('state:changed', () => rerenderIntegratedApp(appRoot));
initializeRouter();
await startIntegratedApp(appRoot);

window.PreplyV8 = Object.freeze({
  getState,
  updateState,
  getRoute
});

emit('app:ready', { state: getState(), route: getRoute() });
console.info('[Preply V8] Integrierte Anwendung geladen.');
