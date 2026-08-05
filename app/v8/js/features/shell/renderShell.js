const ROUTES = [
  ['plan', 'Plan'],
  ['recipes', 'Rezepte'],
  ['shopping', 'Einkauf'],
  ['profile', 'Profil']
];

function pageContent(route) {
  if (route === 'plan') {
    return `
      <section class="v8-page">
        <div class="v8-page-head">
          <div><p class="eyebrow">Planen</p><h1>Was passt heute?</h1></div>
          <p>Direkte Inspiration oder ein Plan für ausgewählte Tage. Kein Zwang zur perfekten Montag-bis-Sonntag-Existenz.</p>
        </div>
        <div class="v8-start-grid">
          <button class="v8-start-card primary" data-action="today-inspiration">
            <strong>Was esse ich heute?</strong>
            <span>Drei passende Vorschläge anhand deines Profils und deiner aktuellen Filter.</span>
          </button>
          <button class="v8-start-card" data-action="create-plan">
            <strong>Essensplan erstellen</strong>
            <span>Plane die nächsten Tage, eine Arbeitswoche oder frei ausgewählte Termine.</span>
          </button>
        </div>
      </section>`;
  }

  const copy = {
    recipes: ['Rezepte', 'Finde passende Gerichte, Favoriten und alle verfügbaren Rezepte.'],
    shopping: ['Einkauf', 'Wähle Tage aus und sieh genau, wofür jede Menge benötigt wird.'],
    profile: ['Profil', 'Ziele, Ernährung, Ausschlüsse und persönliche Präferenzen.']
  }[route];

  return `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Preply V8</p><h1>${copy[0]}</h1></div><p>${copy[1]}</p></div></section>`;
}

export function renderShell(root, { route = 'plan' } = {}) {
  root.innerHTML = `
    <div class="v8-shell">
      <header class="v8-header">
        <div class="v8-brand">
          <div class="v8-brand-mark">P</div>
          <div class="v8-brand-copy"><strong>Preply</strong><span>Essensplanung ohne Theater</span></div>
        </div>
        <button type="button" aria-label="Profil öffnen" onclick="location.hash='profile'">Profil</button>
      </header>
      <main class="v8-main">${pageContent(route)}</main>
      <nav class="v8-nav" aria-label="Hauptnavigation">
        ${ROUTES.map(([key, label]) => `<a href="#${key}" ${key === route ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
    </div>`;
}
