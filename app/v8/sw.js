const CACHE_NAME = 'preply-v8-shell-39';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/shell.css',
  './assets/css/integration.css',
  './assets/css/design-master.css',
  './assets/css/screens-master.css',
  './assets/css/profile-master.css',
  './assets/css/plan-editor-master.css',
  './assets/css/onboarding.css',
  './assets/css/feel.css',
  './js/app.js',
  './js/integrationController.js',
  './js/featureEnhancementsV2.js',
  './js/profileMasterEnhancement.js',
  './js/historyEnhancement.js',
  './js/planManagementEnhancement.js',
  './js/accountEnhancement.js',
  './js/core/events.js',
  './js/core/idb.js',
  './js/core/version.js',
  './js/core/feel.js',
  './js/core/toast.js',
  './js/core/router.js',
  './js/core/store.js',
  './js/core/storage.js',
  './js/core/supabase.js',
  './js/core/supabaseConfig.js',
  './js/data/contracts.js',
  './js/data/recipeRepository.js',
  './js/data/recipeNormalizer.js',
  './js/data/recipeScoring.js',
  './js/data/recipeStore.js',
  './js/features/auth/auth.js',
  './js/features/auth/account.js',
  './js/features/household/household.js',
  './js/features/household/planSync.js',
  './js/features/sync/userSync.js',
  './js/features/discover/discoverEngine.js',
  './js/features/favorites/preferenceSignals.js',
  './js/features/history/history.js',
  './js/features/onboarding/onboardingModel.js',
  './js/features/onboarding/onboardingSteps.js',
  './js/features/onboarding/nutrition.js',
  './js/features/planner/plannerEngine.js',
  './js/features/profile/profileSummary.js',
  './js/features/shell/renderShell.js',
  './js/features/shopping/shoppingEngine.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && (key.startsWith('preply-v8-') || key.startsWith('preply-v7'))).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && !response.redirected) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
