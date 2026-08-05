import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { getState, initializeStore, updateState } from './core/store.js';
import { rerenderIntegratedApp, startIntegratedApp } from './integrationController.js';
import { initializeFeatureEnhancements, refreshFeatureEnhancements } from './featureEnhancementsV2.js';
import { refreshHistoryEnhancement } from './historyEnhancement.js';

const appRoot = document.getElementById('app');

async function renderAll() {
  rerenderIntegratedApp(appRoot);
  await refreshFeatureEnhancements(appRoot);
  refreshHistoryEnhancement(appRoot);
}

initializeStore();
on('route:changed', () => void renderAll());
on('state:changed', () => void renderAll());
initializeRouter();
await startIntegratedApp(appRoot);
await initializeFeatureEnhancements();
await refreshFeatureEnhancements(appRoot);
refreshHistoryEnhancement(appRoot);

window.PreplyV8 = Object.freeze({
  getState,
  updateState,
  getRoute
});

emit('app:ready', { state: getState(), route: getRoute() });
console.info('[Preply V8] Integrierte Anwendung geladen.');
