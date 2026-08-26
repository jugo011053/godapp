import { emit, on } from './core/events.js';
import { getRoute, initializeRouter } from './core/router.js';
import { APP_BUILD, APP_BUILD_DATE } from './core/version.js';
import { initFeel } from './core/feel.js';
import { getState, initializeStore, updateState } from './core/store.js';
import { rerenderIntegratedApp, startIntegratedApp } from './integrationController.js';
import { initializeFeatureEnhancements, refreshFeatureEnhancements } from './featureEnhancementsV2.js';
import { appendBuildStamp, refreshProfileMaster } from './profileMasterEnhancement.js';
import { refreshHistoryEnhancement } from './historyEnhancement.js';
import { initializePlanManagement, refreshPlanManagement } from './planManagementEnhancement.js';

const appRoot = document.getElementById('app');

function renderProfileLayer() {
  refreshProfileMaster(appRoot);
  appRoot.querySelector('.master-profile-intro h1')?.setAttribute('aria-label', 'Deine Einstellungen');
}

/* --- Renderpfad ---------------------------------------------------------
   Drei Ursachen fuer die Haenger, alle hier behandelt:
   1. Die Huelle wurde bei jedem Durchlauf neu gebaut (jetzt in renderShell
      behoben) — dadurch ging die Scrollposition verloren.
   2. Jede Zustandsaenderung loeste sofort einen eigenen Durchlauf aus.
      Mehrere Aenderungen im selben Tick ergaben mehrere volle Neuaufbauten.
   3. Beim Seitenwechsel sprang der Inhalt hart um. */

const scrollByRoute = new Map();
let renderedRoute = null;
let renderPending = false;

async function renderAll() {
  const route = getRoute();
  const routeChanged = route !== renderedRoute;

  /* Position der bisherigen Seite merken, bevor der Inhalt ersetzt wird. */
  if (renderedRoute && routeChanged) scrollByRoute.set(renderedRoute, window.scrollY);

  rerenderIntegratedApp(appRoot);
  await refreshFeatureEnhancements(appRoot);
  renderProfileLayer();
  refreshHistoryEnhancement(appRoot);
  refreshPlanManagement(appRoot);
  appendBuildStamp(appRoot);

  if (routeChanged) {
    const main = appRoot.querySelector('.v8-main');
    if (main) {
      main.classList.remove('route-enter');
      /* Neustart der Animation erzwingen, sonst laeuft sie nur beim ersten Mal. */
      void main.offsetWidth;
      main.classList.add('route-enter');
    }
    window.scrollTo(0, scrollByRoute.get(route) ?? 0);
    renderedRoute = route;
  }
}

/* Mehrere Zustandsaenderungen im selben Frame ergeben einen Durchlauf. */
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    void renderAll();
  });
}

try {
  initializeStore();
  initializePlanManagement();
  initFeel(document.body);
  on('route:changed', scheduleRender);
  on('state:changed', scheduleRender);
  initializeRouter();
  await startIntegratedApp(appRoot);
  await initializeFeatureEnhancements();
  await refreshFeatureEnhancements(appRoot);
  renderProfileLayer();
  refreshHistoryEnhancement(appRoot);
  refreshPlanManagement(appRoot);
  appendBuildStamp(appRoot);
  renderedRoute = getRoute();

  window.PreplyV8 = Object.freeze({
    getState,
    updateState,
    getRoute,
    build: APP_BUILD,
    buildDate: APP_BUILD_DATE
  });

  emit('app:ready', { state: getState(), route: getRoute() });
  console.info(`[Preply ${APP_BUILD}] Integrierte Anwendung geladen (${APP_BUILD_DATE}).`);
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
