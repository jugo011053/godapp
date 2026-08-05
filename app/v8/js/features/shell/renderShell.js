const ICONS = {
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>',
  recipes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
};

const ROUTES = [
  ['plan', 'Plan'],
  ['recipes', 'Rezepte'],
  ['shopping', 'Einkauf'],
  ['profile', 'Profil']
];

export function renderShell(root, { route = 'plan' } = {}) {
  root.innerHTML = `
    <div class="v8-shell">
      <header class="v8-header">
        <div class="v8-brand">
          <div class="v8-brand-mark">P</div>
          <div class="v8-brand-copy"><strong>Preply</strong><span>Deine Essensplanung</span></div>
        </div>
        <button type="button" class="v8-header-action" aria-label="Profil öffnen" onclick="location.hash='profile'">
          ${ICONS.profile}
          <span>Profil</span>
        </button>
      </header>
      <main class="v8-main"></main>
      <nav class="v8-nav" aria-label="Hauptnavigation">
        ${ROUTES.map(([key, label]) => `<a href="#${key}" ${key === route ? 'aria-current="page"' : ''}>${ICONS[key]}${label}</a>`).join('')}
      </nav>
    </div>`;
}
