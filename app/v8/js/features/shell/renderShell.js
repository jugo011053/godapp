const ICONS = {
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="20" x2="15" y2="20"/></svg>',
  discover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

const ROUTES = [
  ['plan', 'Plan', ICONS.plan],
  ['recipes', 'Entdecken', ICONS.discover],
  ['shopping', 'Einkauf', ICONS.shopping]
];

export function renderShell(root, { route = 'plan' } = {}) {
  /* Map 'profile' route to show profile but keep nav on 'plan' */
  const activeNav = route === 'profile' ? 'profile' : route;

  root.innerHTML = `
    <div class="v8-shell">
      <header class="v8-header">
        <div class="v8-brand">
          <strong>preply</strong>
          <span>Einfach gesund planen.</span>
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
