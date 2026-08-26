import { emit } from './events.js';

/* 'plan' ist die Woche (planen und anpassen), 'today' der Kochmoment.
   Das sind zwei Zeitpunkte im selben Kreislauf, keine zwei Zoomstufen —
   deshalb eigene Flaechen statt eines Umschalters.
   'recipes' bleibt erreichbar, steht aber nicht mehr in der Navigation. */
const VALID_ROUTES = new Set(['plan', 'today', 'recipes', 'shopping', 'profile']);
let currentRoute = 'plan';

export function getRoute() {
  return currentRoute;
}

export function navigate(route, options = {}) {
  if (!VALID_ROUTES.has(route)) {
    throw new RangeError(`Unbekannte Route: ${route}`);
  }
  currentRoute = route;
  if (options.updateHash !== false) {
    history.replaceState(null, '', `#${route}`);
  }
  emit('route:changed', { route });
}

export function initializeRouter() {
  const requested = location.hash.replace(/^#/, '');
  navigate(VALID_ROUTES.has(requested) ? requested : 'plan');
  window.addEventListener('hashchange', () => {
    const route = location.hash.replace(/^#/, '');
    if (VALID_ROUTES.has(route) && route !== currentRoute) {
      navigate(route, { updateHash: false });
    }
  });
}
