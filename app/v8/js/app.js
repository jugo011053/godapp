import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { getState, initializeStore, updateState } from './core/store.js';
import { rerenderIntegratedApp, startIntegratedApp } from './integrationController.js';
import { initializeFeatureEnhancements, refreshFeatureEnhancements } from './featureEnhancementsV2.js';
import { refreshProfileMaster } from './profileMasterEnhancement.js';
import { refreshHistoryEnhancement } from './historyEnhancement.js';
import { initializePlanManagement, refreshPlanManagement } from './planManagementEnhancement.js';

const appRoot = document.getElementById('app');

function renderProfileLayer() {
  refreshProfileMaster(appRoot);
  appRoot.querySelector('.master-profile-intro h1')?.setAttribute('aria-label', 'Deine Einstellungen');
}

async function renderAll() {
  rerenderIntegratedApp(appRoot);
  await refreshFeatureEnhancements(appRoot);
  renderProfileLayer();
  refreshHistoryEnhancement(appRoot);
  refreshPlanManagement(appRoot);
}

try {
  initializeStore();
  initializePlanManagement();
  on('route:changed', () => void renderAll());
  on('state:changed', () => void renderAll());
  initializeRouter();
  await startIntegratedApp(appRoot);
  await initializeFeatureEnhancements();
  await refreshFeatureEnhancements(appRoot);
  renderProfileLayer();
  refreshHistoryEnhancement(appRoot);
  refreshPlanManagement(appRoot);

  window.PreplyV8 = Object.freeze({
    getState,
    updateState,
    getRoute
  });

  emit('app:ready', { state: getState(), route: getRoute() });
  console.info('[Preply V8] Integrierte Anwendung geladen.');
} catch (error) {
  console.error('[Preply V8] Startfehler:', error);
  if (appRoot) {
    appRoot.innerHTML = `<div style="max-width:480px;margin:20vh auto;padding:24px;text-align:center;font-family:system-ui,sans-serif">
      <h1 style="font-size:1.25rem;margin-bottom:12px">Preply konnte nicht geladen werden</h1>
      <p style="color:#666;margin-bottom:16px">${String(error.message || error).replace(/[<>&]/g, '')}</p>
      <button onclick="location.reload()" style="padding:8px 20px;border-radius:6px;border:1px solid #ccc;background:#78a800;color:#fff;font-weight:600;cursor:pointer">Neu laden</button>
    </div>`;
  }
}
