const ICONS = {
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 5.5h16M4 12h16M4 18.5h10"/></svg>',
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12zM6 6 5 3H2"/><circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/><path d="m9 14.5 2 2 4-4"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

/* Die Navigation bildet den Kreislauf ab, den der Nutzer wirklich durchlaeuft:
   Was ist der Plan? Was koche ich jetzt? Was muss ich kaufen? */
const ROUTES = [
  ['plan', 'Woche', ICONS.plan],
  ['today', 'Heute', ICONS.today],
  ['shopping', 'Einkauf', ICONS.shopping]
];

import { APP_BUILD } from '../../core/version.js';

export function renderShell(root, { route = 'plan' } = {}) {
  /* Map 'profile' route to show profile but keep nav on 'plan' */
  const activeNav = route === 'profile' ? 'profile' : route;

  root.innerHTML = `
    <div class="v8-shell">
      <header class="v8-header">
        <div class="v8-brand">
          <strong>preply</strong>
          <span>Einfach gesund planen. · ${APP_BUILD}</span>
        </div>
        <button type="button" class="v8-header-action" aria-label="Profil öffnen" onclick="location.hash='profile'">
          ${ICONS.profile}
        </button>
      </header>
      <main class="v8-main"></main>
      <nav class="v8-nav" aria-label="Hauptnavigation">
        ${ROUTES.map(([key, label, icon]) => `<a href="#${key}" ${key === activeNav ? 'aria-current="page"' : ''}>${icon}${label}</a>`).join('')}
      </nav>
    </div>`;
}
