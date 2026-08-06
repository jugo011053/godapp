const ICONS = {
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

const ROUTES = [
  ['plan', 'Heute', ICONS.plan],
  ['recipes', 'Rezepte', ICONS.discover],
  ['shopping', 'Einkauf', ICONS.shopping]
];

export function renderShell(root, { route = 'plan' } = {}) {
  const activeNav = route === 'profile' ? null : route;

  root.innerHTML = `
    <div class="v8-shell">
      <header class="v8-header">
        <button type="button" class="v8-brand" aria-label="Heute öffnen" onclick="location.hash='plan'">
          <strong>preply</strong>
        </button>
        <button type="button" class="v8-header-action" aria-label="Profil öffnen" onclick="location.hash='profile'">
          ${ICONS.profile}
        </button>
      </header>
      <main class="v8-main"></main>
      <nav class="v8-nav" aria-label="Hauptnavigation">
        ${ROUTES.map(([key, label, icon]) => `<a href="#${key}" ${key === activeNav ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></a>`).join('')}
      </nav>
    </div>`;
}
