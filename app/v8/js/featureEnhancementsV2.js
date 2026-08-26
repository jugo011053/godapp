import { getRoute } from './core/router.js';
import { getState, updateState, silentUpdate } from './core/store.js';
import { loadCards, getRecipe } from './data/recipeStore.js';
import { createDefaultFilters, filterRecipes, sortRecipes } from './features/discover/discoverEngine.js';
import { scoreRecipe } from './data/recipeScoring.js';
import { toggleFavorite, excludeRecipe } from './features/favorites/preferenceSignals.js';
import { buildShoppingList, copyShoppingText, formatAmount, toggleShoppingDate } from './features/shopping/shoppingEngine.js';
import { haptic, enableSwipeToggle } from './core/feel.js';

const ui = {
  recipes: [],
  catalogError: null,
  filters: createDefaultFilters(),
  sort: 'recommended',
  visibleCount: 40,
  selectedDates: [],
  checks: {},
  /* Haken der Gerichtsansicht liegen getrennt: wer nur fuer ein Gericht
     einkauft, soll dessen Liste abhaken koennen, ohne dass dieselbe Zutat
     in einem anderen Gericht mit verschwindet. */
  recipeChecks: {},
  collapsedRecipes: new Set(),
  shoppingPlanId: null,
  shoppingView: 'category',
  expandedStaples: false,
  collapsedGroups: new Set(),
  details: new Map()
};

let searchTimer;

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const CATEGORY_DE = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
  shake: 'Shake'
};

const SVG = {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M20.8 5.8a5.3 5.3 0 0 0-7.5 0L12 7.1l-1.3-1.3a5.3 5.3 0 1 0-7.5 7.5L12 22l8.8-8.7a5.3 5.3 0 0 0 0-7.5Z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
};

function closeOverlay(overlay) {
  overlay?.remove();
}

function appendSheet(root, className, content) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = `v8-overlay ${className}`;
  /* Meldet dem Gesten-Beobachter: dieses Sheet darf weggewischt werden. */
  overlay.dataset.dismissible = 'true';
  overlay.innerHTML = content;
  root.appendChild(overlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay);
  });
  overlay.querySelectorAll('[data-sheet-close]').forEach((button) => button.addEventListener('click', () => closeOverlay(overlay)));
  const onEscape = (event) => {
    if (event.key !== 'Escape') return;
    closeOverlay(overlay);
    document.removeEventListener('keydown', onEscape);
  };
  document.addEventListener('keydown', onEscape);
  return overlay;
}

function recipeImage(recipe) {
  return recipe.imageUrl || recipe.image_url || recipe.image || null;
}

function isFavorite(preferences, recipeId) {
  return (preferences.favoriteRecipeIds || []).includes(recipeId);
}

function favoriteButton(recipe, preferences, extraClass = '') {
  return `<button class="master-heart ${isFavorite(preferences, recipe.id) ? 'active' : ''} ${extraClass}" type="button" data-v8-favorite="${esc(recipe.id)}" aria-label="${isFavorite(preferences, recipe.id) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${SVG.heart}</button>`;
}

/* Im Katalog gibt es derzeit kein Bildfeld, also lieferte der Platzhalter auf
   jeder Karte denselben grauen Block. Bild nur zeigen, wenn wirklich eins da
   ist — sonst trägt die Karte den Text. */
function recipeVisual(recipe) {
  const image = recipeImage(recipe);
  return image ? `<span class="master-recipe-visual"><img src="${esc(image)}" alt="" loading="lazy"></span>` : '';
}

function forYouCard(recipe, preferences) {
  return `<article class="master-foryou-card">
    <button class="master-recipe-main" type="button" data-v8-detail="${esc(recipe.id)}">
      ${recipeVisual(recipe)}
      <span class="master-foryou-copy">
        <span class="master-foryou-cat">${esc(CATEGORY_DE[recipe.category] || recipe.category || 'Rezept')}</span>
        <strong>${esc(recipe.name)}</strong>
        <small>${Math.round(recipe.kcal || 0)} kcal · ${Math.round(recipe.protein || 0)} g Protein</small>
        <small>${Math.round(recipe.time || 0)} Min.</small>
      </span>
    </button>
    ${favoriteButton(recipe, preferences)}
  </article>`;
}

function recipeRow(recipe, preferences) {
  return `<article class="master-recipe-row">
    <button class="master-recipe-main" type="button" data-v8-detail="${esc(recipe.id)}">
      <strong>${esc(recipe.name)}</strong>
      <small>${Math.round(recipe.kcal || 0)} kcal · ${Math.round(recipe.protein || 0)} g Protein · ${Math.round(recipe.time || 0)} Min.</small>
    </button>
    <span class="master-row-actions">
      ${favoriteButton(recipe, preferences)}
      <button type="button" data-recipe-menu="${esc(recipe.id)}" aria-label="Weitere Aktionen">${SVG.more}</button>
    </span>
  </article>`;
}

function hasAdvancedFilters() {
  return Boolean(ui.filters.maxTime || ui.filters.diet || ui.filters.simplicity || ui.filters.difficulty);
}

const PAGE_SIZE = 40;

const DIET_DE = {
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  pescatarian: 'Pescetarisch'
};

function activeFilterLabels() {
  const labels = [];
  if (ui.filters.favoritesOnly) labels.push('Favoriten');
  if (ui.filters.query) labels.push(`Suche „${ui.filters.query}“`);
  if (ui.filters.category) labels.push(CATEGORY_DE[ui.filters.category] || ui.filters.category);
  if (ui.filters.maxTime) labels.push(`bis ${ui.filters.maxTime} Min.`);
  if (ui.filters.diet) labels.push(DIET_DE[ui.filters.diet] || ui.filters.diet);
  if (ui.filters.simplicity) labels.push('Simpel');
  return labels;
}

/* Vorher stand hier immer derselbe Satz. Wenn ein Filter außerhalb des
   sichtbaren Bereichs aktiv war, war nicht erkennbar, was die Liste leert. */
function emptyResultsHtml(preferences) {
  const labels = activeFilterLabels();
  const noFavorites = ui.filters.favoritesOnly && !(preferences.favoriteRecipeIds || []).length;
  const text = noFavorites
    ? 'Du hast noch keine Rezepte favorisiert. Tippe bei einem Rezept auf das Herz, dann erscheint es hier.'
    : labels.length
      ? `Kein Rezept passt zu: ${labels.join(' · ')}.`
      : 'Es sind keine Rezepte verfügbar.';
  return `<p class="master-empty">${esc(text)}</p>
    ${labels.length ? '<button class="master-load-more" type="button" data-clear-filters>Filter zurücksetzen</button>' : ''}`;
}

/* "Für dich" nutzt jetzt dieselbe Bewertung wie der Planer — Kalorienziel,
   Protein, Prioritäten, Kochzeit. Vorher wurde nur alphabetisch sortiert. */
function recommendFor(profile, preferences) {
  const pool = filterRecipes(ui.recipes, {
    ...createDefaultFilters(),
    category: ui.filters.category,
    maxTime: ui.filters.maxTime,
    diet: ui.filters.diet,
    simplicity: ui.filters.simplicity
  }, preferences);

  const scored = pool
    .map((recipe) => ({
      recipe,
      score: scoreRecipe(recipe, {
        category: recipe.category,
        profile,
        preferences,
        usedRecipeIds: new Set(),
        usedFamilies: new Set()
      })
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  /* Fällt das Profil komplett durch (z. B. sehr enge Kochzeit), lieber die
     bestbewerteten Rezepte zeigen als eine leere Zeile. */
  const ranked = scored.length ? scored.map((entry) => entry.recipe) : sortRecipes(pool, 'recommended', preferences);

  const seen = new Set();
  const picked = [];
  for (const recipe of ranked) {
    const family = recipe.familyKey || recipe.id;
    if (seen.has(family)) continue;
    seen.add(family);
    picked.push(recipe);
    if (picked.length === 6) break;
  }
  return picked;
}

function renderRecipes(root) {
  const main = root.querySelector('.v8-main');
  if (!main) return;
  if (!ui.recipes.length) {
    main.innerHTML = `<section class="v8-page preply-page">
      <h1 class="master-screen-title">Rezepte</h1>
      ${ui.catalogError
        ? `<p class="master-empty">${esc(ui.catalogError)}</p>
           <button class="sheet-action primary" type="button" data-retry-catalog>Erneut versuchen</button>`
        : '<p class="master-empty">Rezepte werden geladen …</p>'}
    </section>`;
    main.querySelector('[data-retry-catalog]')?.addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'Wird geladen …';
      await initializeFeatureEnhancements();
      renderRecipes(root);
    });
    return;
  }

  const state = getState();
  const preferences = state.preferences || {};
  const filtered = filterRecipes(ui.recipes, ui.filters, preferences);
  const results = sortRecipes(filtered, ui.sort, preferences);

  /* Beim Suchen oder Filtern nach Favoriten sucht man gezielt — eine
     unveränderte Empfehlungszeile darüber sieht dann aus, als hinge sie fest. */
  const showRecommendations = !ui.filters.query && !ui.filters.favoritesOnly;
  const recommendations = showRecommendations
    ? recommendFor(state.profile || {}, preferences)
    : [];

  const visible = Math.min(ui.visibleCount, results.length);

  main.innerHTML = `<section class="v8-page preply-page">
    <h1 class="master-screen-title">Rezepte</h1>

    <div class="master-search-row">
      <label class="master-search">
        ${SVG.search}
        <input type="search" data-v8-filter="query" value="${esc(ui.filters.query)}" placeholder="Rezepte suchen …" aria-label="Rezepte suchen">
      </label>
      <button class="master-icon-button ${hasAdvancedFilters() ? 'active' : ''}" type="button" data-open-filters aria-label="Alle Filter öffnen">${SVG.filter}</button>
    </div>

    <div class="master-chip-row" aria-label="Mahlzeiten filtern">
      ${[['', 'Alle'], ['breakfast', 'Frühstück'], ['lunch', 'Mittag'], ['dinner', 'Abend'], ['snack', 'Snack']].map(([value, label]) =>
        `<button class="master-chip ${ui.filters.category === value ? 'active' : ''}" type="button" data-chip="category" data-value="${value}">${label}</button>`
      ).join('')}
    </div>

    <div class="master-chip-row" aria-label="Schnellfilter">
      <button class="master-chip ${ui.sort === 'quick' ? 'active' : ''}" type="button" data-quick-filter="quick">Schnell</button>
      <button class="master-chip ${ui.sort === 'protein' ? 'active' : ''}" type="button" data-quick-filter="protein">Proteinreich</button>
      <button class="master-chip ${ui.filters.favoritesOnly ? 'active' : ''}" type="button" data-quick-filter="favorites">Favoriten</button>
      <button class="master-chip ${hasAdvancedFilters() ? 'active' : ''}" type="button" data-open-filters>Alle Filter</button>
    </div>

    ${recommendations.length ? `
    <div class="master-section-head"><h2>Für dich</h2><span>Passend zu deinem Profil</span></div>
    <div class="master-foryou">
      ${recommendations.map((recipe) => forYouCard(recipe, preferences)).join('')}
    </div>` : ''}

    <div class="master-section-head"><h2>Alle Rezepte</h2><span>${visible < results.length ? `${visible} von ${results.length}` : results.length}</span></div>
    <div class="master-recipe-list">
      ${results.slice(0, visible).map((recipe) => recipeRow(recipe, preferences)).join('')}
    </div>
    ${results.length ? '' : emptyResultsHtml(preferences)}
    ${visible < results.length
      ? `<button class="master-load-more" type="button" data-load-more>Weitere ${Math.min(PAGE_SIZE, results.length - visible)} anzeigen</button>`
      : ''}
  </section>`;

  bindRecipeEvents(root);
}

/* Ein Herz-Klick darf die Seite nicht neu aufbauen: updateState() löst
   renderAll() aus, das die ganze Shell ersetzt — die Liste springt dann
   zurück nach oben. Also Zustand still sichern und nur das Icon umschalten. */
function applyFavorite(root, id) {
  if (!id) return;
  const next = silentUpdate((state) => ({
    ...state,
    preferences: toggleFavorite(state.preferences || {}, id)
  }));
  const active = (next.preferences?.favoriteRecipeIds || []).includes(id);
  haptic(active ? 'confirm' : 'tap');

  /* Dasselbe Rezept kann in "Für dich" und in der Liste stehen. */
  root.querySelectorAll(`[data-v8-favorite="${CSS.escape(id)}"]`).forEach((button) => {
    button.classList.toggle('active', active);
    button.setAttribute('aria-label', active ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
  });

  /* Nur wenn nach Favoriten gefiltert wird, ändert sich die sichtbare Menge. */
  if (ui.filters.favoritesOnly) renderRecipes(root);
}

function bindRecipeEvents(root) {
  root.querySelector('[data-v8-filter="query"]')?.addEventListener('input', (event) => {
    const value = event.currentTarget.value;
    const caret = event.currentTarget.selectionStart;
    ui.filters = { ...ui.filters, query: value };
    ui.visibleCount = PAGE_SIZE;
    /* Ohne Entprellung wird bei jedem Tastendruck die ganze Liste neu gebaut. */
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      renderRecipes(root);
      const input = root.querySelector('[data-v8-filter="query"]');
      if (!input) return;
      input.focus();
      input.setSelectionRange(caret, caret);
    }, 180);
  });

  root.querySelectorAll('[data-chip="category"]').forEach((button) => button.addEventListener('click', () => {
    ui.filters = { ...ui.filters, category: button.dataset.value || '' };
    ui.visibleCount = PAGE_SIZE;
    renderRecipes(root);
  }));

  root.querySelectorAll('[data-quick-filter]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.quickFilter;
    if (value === 'favorites') ui.filters = { ...ui.filters, favoritesOnly: !ui.filters.favoritesOnly };
    if (value === 'quick') ui.sort = ui.sort === 'quick' ? 'recommended' : 'quick';
    if (value === 'protein') ui.sort = ui.sort === 'protein' ? 'recommended' : 'protein';
    ui.visibleCount = PAGE_SIZE;
    renderRecipes(root);
  }));

  root.querySelectorAll('[data-open-filters]').forEach((button) => button.addEventListener('click', () => openFilterSheet(root)));

  root.querySelector('[data-load-more]')?.addEventListener('click', () => {
    ui.visibleCount += PAGE_SIZE;
    renderRecipes(root);
  });

  root.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    ui.filters = createDefaultFilters();
    ui.sort = 'recommended';
    ui.visibleCount = PAGE_SIZE;
    renderRecipes(root);
  });

  root.querySelectorAll('[data-v8-favorite]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    applyFavorite(root, button.dataset.v8Favorite);
  }));

  root.querySelectorAll('[data-v8-detail]').forEach((button) => button.addEventListener('click', () => showDetail(root, button.dataset.v8Detail)));
  root.querySelectorAll('[data-recipe-menu]').forEach((button) => button.addEventListener('click', () => openRecipeMenu(root, button.dataset.recipeMenu)));
}

function openFilterSheet(root) {
  const draft = { ...ui.filters };
  const overlay = appendSheet(root, 'plan-menu-overlay', `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title">
    <div class="sheet-head"><h2 id="filter-title">Alle Filter</h2><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
    <div class="master-sheet-list">
      <div><p class="eyebrow">Ernährung</p><div class="master-filter-grid">
        ${[['', 'Alles'], ['vegetarian', 'Vegetarisch'], ['vegan', 'Vegan'], ['pescatarian', 'Pescetarisch']].map(([value, label]) => `<button class="selection-card ${draft.diet === value ? 'selected' : ''}" type="button" data-filter-diet="${value}">${label}</button>`).join('')}
      </div></div>
      <div><p class="eyebrow">Kochzeit</p><div class="master-filter-grid">
        ${[[0, 'Beliebig'], [15, 'Bis 15 Min.'], [30, 'Bis 30 Min.'], [45, 'Bis 45 Min.']].map(([value, label]) => `<button class="selection-card ${Number(draft.maxTime || 0) === value ? 'selected' : ''}" type="button" data-filter-time="${value}">${label}</button>`).join('')}
      </div></div>
      <div><p class="eyebrow">Komplexität</p><div class="master-filter-grid">
        ${[['', 'Beliebig'], ['simple', 'Simpel']].map(([value, label]) => `<button class="selection-card ${draft.simplicity === value ? 'selected' : ''}" type="button" data-filter-simple="${value}">${label}</button>`).join('')}
      </div></div>
    </div>
    <div class="sheet-actions"><button class="sheet-action primary" type="button" data-filter-apply>Filter anwenden</button><button class="sheet-action" type="button" data-filter-reset>Zurücksetzen</button></div>
  </section>`);

  /* Verglichen wird gegen den rohen data-Wert des geklickten Knopfes. Vorher
     wurde der umgewandelte Wert verglichen — bei "Beliebig" wurde aus 0 dann
     null und "null" traf auf keinen Knopf, also blieb die Gruppe unmarkiert. */
  const select = (selector, key, button, value) => {
    draft[key] = value;
    overlay.querySelectorAll(selector).forEach((other) => other.classList.toggle('selected', other === button));
  };

  overlay.querySelectorAll('[data-filter-diet]').forEach((button) => button.addEventListener('click',
    () => select('[data-filter-diet]', 'diet', button, button.dataset.filterDiet)));
  overlay.querySelectorAll('[data-filter-time]').forEach((button) => button.addEventListener('click',
    () => select('[data-filter-time]', 'maxTime', button, Number(button.dataset.filterTime) || null)));
  overlay.querySelectorAll('[data-filter-simple]').forEach((button) => button.addEventListener('click',
    () => select('[data-filter-simple]', 'simplicity', button, button.dataset.filterSimple)));
  overlay.querySelector('[data-filter-apply]').addEventListener('click', () => {
    ui.filters = { ...ui.filters, diet: draft.diet, maxTime: draft.maxTime, simplicity: draft.simplicity };
    ui.visibleCount = PAGE_SIZE;
    closeOverlay(overlay);
    renderRecipes(root);
  });
  overlay.querySelector('[data-filter-reset]').addEventListener('click', () => {
    ui.filters = { ...ui.filters, diet: '', maxTime: null, simplicity: '', difficulty: '' };
    ui.visibleCount = PAGE_SIZE;
    closeOverlay(overlay);
    renderRecipes(root);
  });
}

async function recipeById(id) {
  if (ui.details.has(id)) return ui.details.get(id);
  const recipe = await getRecipe(id);
  ui.details.set(id, recipe);
  return recipe;
}

async function openRecipeMenu(root, id) {
  let recipe;
  try {
    recipe = await recipeById(id);
  } catch (error) {
    /* Ohne diesen Zweig endete ein fehlgeschlagener Abruf in einer stillen
       Promise-Rejection — der ···-Knopf tat dann einfach nichts. */
    console.error('[Preply V8] Rezeptmenü', error);
    recipe = ui.recipes.find((item) => item.id === id) || { id, name: 'Rezept' };
  }
  const favorite = isFavorite(getState().preferences || {}, id);
  const overlay = appendSheet(root, 'plan-menu-overlay', `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="recipe-menu-title">
    <div class="sheet-head"><h2 id="recipe-menu-title">${esc(recipe.name)}</h2><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
    <div class="plan-menu-list">
      <button class="plan-menu-item" type="button" data-menu-detail><span class="plan-menu-copy"><strong>Rezept ansehen</strong><small>Zutaten und Zubereitung öffnen</small></span><span class="plan-menu-arrow">›</span></button>
      <button class="plan-menu-item" type="button" data-menu-favorite><span class="plan-menu-copy"><strong>${favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}</strong><small>Deine gespeicherten Rezepte verwalten</small></span><span class="plan-menu-arrow">›</span></button>
    </div>
    <button class="plan-menu-item danger" type="button" data-menu-exclude><span class="plan-menu-copy"><strong>Nicht mehr anzeigen</strong><small>Kann später im Profil rückgängig gemacht werden</small></span><span class="plan-menu-arrow">›</span></button>
  </section>`);

  overlay.querySelector('[data-menu-detail]').addEventListener('click', () => {
    closeOverlay(overlay);
    showDetail(root, id);
  });
  overlay.querySelector('[data-menu-favorite]').addEventListener('click', () => {
    closeOverlay(overlay);
    applyFavorite(root, id);
  });
  overlay.querySelector('[data-menu-exclude]').addEventListener('click', () => {
    /* Ausblenden entfernt das Rezept aus der Liste — hier muss neu gerendert werden. */
    silentUpdate((state) => ({ ...state, preferences: excludeRecipe(state.preferences || {}, id, []) }));
    closeOverlay(overlay);
    renderRecipes(root);
  });
}

async function showDetail(root, id) {
  try {
    const recipe = await recipeById(id);
    const preferences = getState().preferences || {};
    const overlay = appendSheet(root, 'plan-menu-overlay', `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="recipe-detail-title">
      <div class="sheet-head"><div class="master-detail-head"><p class="eyebrow">${esc(CATEGORY_DE[recipe.category] || recipe.category || 'Rezept')}</p><h2 id="recipe-detail-title">${esc(recipe.name)}</h2><div class="master-detail-meta"><span>${Math.round(recipe.kcal || 0)} kcal</span><span>${Math.round(recipe.protein || 0)} g Protein</span><span>${Math.round(recipe.time || 0)} Min.</span></div></div><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
      <h3>Zutaten</h3>
      <div class="meal-ing-list">${(recipe.ingredients || []).map((item) => `<div class="meal-ing-row"><span>${esc(item.name)}</span><b>${esc(item.amount ?? item.quantity ?? '')} ${esc(item.unit || '')}</b></div>`).join('') || '<p class="master-empty">Keine Zutaten hinterlegt.</p>'}</div>
      <h3>Zubereitung</h3>
      <div class="meal-steps-list">${(recipe.steps || []).map((step, index) => `<div class="meal-step"><span class="step-num">${index + 1}</span><span>${esc(step)}</span></div>`).join('') || '<p class="master-empty">Keine Schritte hinterlegt.</p>'}</div>
      <div class="sheet-actions"><button class="sheet-action ${isFavorite(preferences, id) ? '' : 'lime'}" type="button" data-detail-favorite>${isFavorite(preferences, id) ? 'Aus Favoriten entfernen' : 'Favorisieren'}</button></div>
    </section>`);
    overlay.querySelector('[data-detail-favorite]').addEventListener('click', () => {
      closeOverlay(overlay);
      applyFavorite(root, id);
    });
  } catch (error) {
    console.error('[Preply V8] Rezeptdetail', error);
  }
}

function normalizeDays(plan) {
  if (Array.isArray(plan.days)) return plan.days;
  if (plan.days && typeof plan.days === 'object') {
    return Object.entries(plan.days).map(([date, meals]) => ({ date, meals: meals || {} })).sort((a, b) => a.date.localeCompare(b.date));
  }
  return [];
}

async function detailedPlan(plan) {
  const days = normalizeDays(plan);
  const ids = [...new Set(days.flatMap((day) => Object.values(day.meals || {}).map((meal) => meal.recipeId || meal.recipe?.id).filter(Boolean)))];
  await Promise.all(ids.map(async (id) => {
    if (!ui.details.has(id)) ui.details.set(id, await getRecipe(id));
  }));
  return {
    ...plan,
    days: days.map((day) => ({
      ...day,
      meals: Object.fromEntries(Object.entries(day.meals || {}).map(([slot, meal]) => [slot, {
        ...meal,
        recipe: ui.details.get(meal.recipeId || meal.recipe?.id) || meal.recipe
      }]))
    }))
  };
}

function dateParts(date) {
  const value = new Date(`${date}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(value).replace('.', '').toUpperCase();
  return { weekday, day: value.getDate(), isToday: date === new Date().toISOString().slice(0, 10) };
}

/* Feste Zuordnung der Kategorien, die im Katalog wirklich vorkommen. Die
   frühere Teilstring-Suche verhob sich daran: "Protein", "Pflanzliche
   Proteine" und "Flüssigkeit" enthalten alle die Buchstabenfolge "ei" und
   landeten dadurch unter Milchprodukte & Eier. */
const SHOPPING_CATEGORY_MAP = {
  'gemüse': 'Obst & Gemüse',
  'obst': 'Obst & Gemüse',
  'fleisch': 'Fleisch & Fisch',
  'fisch': 'Fleisch & Fisch',
  'protein': 'Fleisch & Fisch',
  'pflanzliche proteine': 'Tofu & Hülsenfrüchte',
  'milchprodukte': 'Milchprodukte & Eier',
  'kohlenhydrate': 'Trockenware & Beilagen',
  'nüsse / samen': 'Nüsse & Samen',
  'gewürze': 'Gewürze & Soßen',
  'gewürz': 'Gewürze & Soßen',
  'saucen': 'Gewürze & Soßen',
  'soße': 'Gewürze & Soßen',
  'fette / öle': 'Öle & Fette',
  'fett/öl': 'Öle & Fette',
  'süßungsmittel': 'Backen & Süßes',
  'flüssigkeit': 'Getränke & Brühe'
};

const SHOPPING_CATEGORY_ORDER = [
  'Obst & Gemüse', 'Fleisch & Fisch', 'Milchprodukte & Eier',
  'Tofu & Hülsenfrüchte', 'Trockenware & Beilagen', 'Nüsse & Samen',
  'Gewürze & Soßen', 'Öle & Fette', 'Backen & Süßes', 'Getränke & Brühe',
  'Sonstiges'
];

/* 18 Zutaten tragen im Katalog eine falsche Kategorie — Sardine, Wolfsbarsch
   und Fleischbällchen stehen unter "Gemüse", Spaghetti und Basmatireis auch.
   Wo der Name eindeutig ist, schlägt er die eingetragene Kategorie: sonst
   sucht man den Fisch in der Gemüseabteilung. */
const NAME_CATEGORY_HINTS = [
  [/lachs|thunfisch|sardin|sardell|kabeljau|seelachs|forelle|hering|makrele|wolfsbarsch|dorade|scholle|garnel|krabbe|muschel|fisch/i, 'Fleisch & Fisch'],
  [/h(ä|ae)hnchen|h(ü|ue)hner|pute|truthahn|rind|schwein|lamm|bacon|speck|schinken|salami|chorizo|wurst|hack|fleischb|gyros/i, 'Fleisch & Fisch'],
  [/nudel|pasta|spaghetti|linguine|penne|fusilli|makkaroni|reis$|basmati|jasminreis|couscous|bulgur|quinoa|haferflocken|graupen|linsen|bohnen|kichererbsen/i, 'Trockenware & Beilagen'],
  [/tofu|tempeh|seitan|sojaschnetzel/i, 'Tofu & Hülsenfrüchte'],
  [/mandel|cashew|waln|haseln|pistazie|pekan|chiasamen|sesamsamen|sonnenblumenkerne|k(ü|ue)rbiskerne/i, 'Nüsse & Samen'],
  [/k(ä|ae)se|parmesan|mozzarella|feta|joghurt|quark|skyr|sahne|milch|butter|ricotta|schmand/i, 'Milchprodukte & Eier']
];

function displayCategory(category = '', name = '') {
  const label = String(name);
  for (const [pattern, target] of NAME_CATEGORY_HINTS) {
    if (pattern.test(label)) {
      /* Pflanzliche Erzeugnisse nicht zu Milchprodukten machen. */
      if (target === 'Milchprodukte & Eier' && /soja|hafer|mandel|kokos|pflanzlich|vegan/i.test(label)) continue;
      return target;
    }
  }
  return SHOPPING_CATEGORY_MAP[String(category).trim().toLowerCase()] || 'Sonstiges';
}

function groupedShoppingItems(items) {
  const groups = items.reduce((acc, item) => {
    const category = displayCategory(item.category, item.name);
    if (!acc[category]) acc[category] = { category, items: [] };
    acc[category].items.push(item);
    return acc;
  }, {});
  /* Reihenfolge nach dem Weg durch den Supermarkt, nicht alphabetisch. */
  return SHOPPING_CATEGORY_ORDER
    .filter((category) => groups[category])
    .map((category) => groups[category]);
}

function amountText(item) {
  /* "1,2 nach Geschmack" ist keine Einkaufsmenge. */
  if (item.showAmount === false) return esc(item.unit || '');
  const amount = item.packs ? item.buyAmount : item.amount;
  /* Packungsmengen sind echte Zahlen (3 x 250 g) und werden nicht gerundet. */
  return esc(formatAmount(amount, item.buyUnit || item.unit, { exact: Boolean(item.packs) }));
}

function packText(item) {
  const parts = [];
  if (item.packs) parts.push(`${item.packs} Pack.`);
  if (item.estimatedPrice) parts.push(`ca. ${item.estimatedPrice.toFixed(2).replace('.', ',')} €`);
  return parts.join(' · ');
}

function shoppingItem(item) {
  const checked = Boolean(ui.checks[item.id] ?? item.checked);
  const pack = packText(item);
  return `<div class="master-shopping-row">
    <button class="master-shopping-check ${checked ? 'checked' : ''}" type="button" data-v8-check="${esc(item.id)}" aria-label="${checked ? 'Als offen markieren' : 'Als erledigt markieren'}">${checked ? '✓' : ''}</button>
    <span class="master-shopping-name ${checked ? 'done' : ''}">${esc(item.name)}</span>
    <span class="master-shopping-amount">${amountText(item)}${pack ? `<small>${esc(pack)}</small>` : ''}</span>
  </div>`;
}

/* Grundzutaten stehen eingeklappt am Ende: nicht im Weg, aber nachschlagbar. */
function stapleGroup(items) {
  const collapsed = !ui.expandedStaples;
  return `<section class="master-shopping-group staples ${collapsed ? 'collapsed' : ''}">
    <button type="button" data-toggle-staples>
      <span>Hast du wahrscheinlich <em>${items.length}</em></span>${SVG.chevron}
    </button>
    <div class="master-shopping-items">${items.map(shoppingItem).join('')}</div>
  </section>`;
}

function categoryGroup(group) {
  const collapsed = ui.collapsedGroups.has(group.category);
  return `<section class="master-shopping-group ${collapsed ? 'collapsed' : ''}">
    <button type="button" data-shopping-group="${esc(group.category)}"><span>${esc(group.category)}</span>${SVG.chevron}</button>
    <div class="master-shopping-items">${group.items.map(shoppingItem).join('')}</div>
  </section>`;
}

/* Ein Haken gehoert zu genau einem Gericht, nicht zur Zutat. */
function recipeCheckKey(group, item) {
  return `${group.recipeId || group.recipeName}|${group.date}|${item.id}`;
}

function recipeShoppingRow(group, item) {
  const key = recipeCheckKey(group, item);
  const checked = Boolean(ui.recipeChecks[key]);
  return `<div class="master-shopping-row">
    <button class="master-shopping-check ${checked ? 'checked' : ''}" type="button" data-recipe-check="${esc(key)}" aria-label="${checked ? 'Als offen markieren' : 'Als erledigt markieren'}">${checked ? '✓' : ''}</button>
    <span class="master-shopping-name ${checked ? 'done' : ''}">${esc(item.name)}</span>
    <span class="master-shopping-amount">${esc(formatAmount(item.amount, item.unit))}</span>
  </div>`;
}

function recipeGroupKey(group) {
  return `${group.date}|${group.category}|${group.recipeId || group.recipeName}`;
}

function recipeShoppingGroup(group) {
  const open = group.ingredients.filter((item) => !ui.recipeChecks[recipeCheckKey(group, item)]).length;
  const key = recipeGroupKey(group);
  /* Zuklappbar, damit man im Laden nur das Gericht offen hat, fuer das man
     gerade einkauft. */
  const collapsed = ui.collapsedRecipes.has(key);
  return `<section class="master-shopping-group ${collapsed ? 'collapsed' : ''}">
    <button type="button" data-recipe-group="${esc(key)}"><span>${esc(group.dayLabel)} · ${esc(group.recipeName)}</span><em class="master-shopping-open">${open} offen</em>${SVG.chevron}</button>
    <div class="master-shopping-items">${group.ingredients.map((item) => recipeShoppingRow(group, item)).join('')}</div>
  </section>`;
}

async function renderShopping(root) {
  const main = root.querySelector('.v8-main');
  const state = getState();
  if (!main) return;
  if (!state.currentPlan) {
    main.innerHTML = '<section class="v8-page preply-page"><h1 class="master-screen-title">Einkauf</h1><p class="master-empty">Erstelle zuerst einen Plan. Die Einkaufsliste entsteht dann automatisch.</p></section>';
    return;
  }

  /* Der Platzhalter erscheint nur, wenn noch keine Liste steht — sonst würde
     jeder Tages-Toggle die fertige Liste kurz gegen "wird zusammengestellt" tauschen. */
  if (!main.querySelector('.master-shopping-groups')) {
    main.innerHTML = '<section class="v8-page preply-page"><h1 class="master-screen-title">Einkauf</h1><p class="master-empty">Einkaufsliste wird zusammengestellt …</p></section>';
  }

  try {
    const plan = await detailedPlan(state.currentPlan);
    const planId = plan.id || plan.startDate || null;

    /* Neuer Plan: Tagesauswahl und Haken gehören zum alten Plan und müssen weg,
       sonst bleibt die Liste leer (alte Daten sind nicht mehr verfügbar). */
    if (ui.shoppingPlanId !== planId) {
      ui.shoppingPlanId = planId;
      ui.selectedDates = [];
      ui.checks = {};
      ui.recipeChecks = {};
      ui.collapsedGroups = new Set();
      ui.collapsedRecipes = new Set();
      silentUpdate((current) => ({ ...current, shoppingChecks: {}, shoppingRecipeChecks: {} }));
    } else {
      ui.checks = { ...(state.shoppingChecks || {}), ...ui.checks };
      ui.recipeChecks = { ...(state.shoppingRecipeChecks || {}), ...ui.recipeChecks };
    }

    if (!ui.selectedDates.length) ui.selectedDates = plan.selectedDates || plan.days.map((day) => day.date);
    const list = buildShoppingList(plan, ui.selectedDates, ui.checks);
    /* Nur die regulaeren Posten gruppieren — der Vorrat bekommt unten eine
       eigene Gruppe und stand sonst doppelt in der Liste. */
    const groups = groupedShoppingItems(list.regular);
    const openCount = list.regular.filter((item) => !(ui.checks[item.id] ?? item.checked)).length;

    main.innerHTML = `<section class="v8-page preply-page">
      <h1 class="master-screen-title">Einkauf</h1>
      <div class="master-day-strip">
        ${list.availableDates.map(({ date }) => {
          const parts = dateParts(date);
          return `<button class="master-shopping-day ${list.selectedDates.includes(date) ? 'active' : ''}" type="button" data-v8-date="${date}"><small>${parts.isToday ? 'HEUTE' : parts.weekday}</small><strong>${parts.day}</strong></button>`;
        }).join('')}
      </div>

      <div class="master-segmented">
        <button class="${ui.shoppingView === 'category' ? 'active' : ''}" type="button" data-v8-view="category">Kategorie</button>
        <button class="${ui.shoppingView === 'recipe' ? 'active' : ''}" type="button" data-v8-view="recipe">Gericht</button>
      </div>

      <div class="master-shopping-groups">
        ${ui.shoppingView === 'category' ? groups.map(categoryGroup).join('') : list.byRecipe.map(recipeShoppingGroup).join('')}
        ${ui.shoppingView === 'category' && list.staples.length ? stapleGroup(list.staples) : ''}
      </div>

      ${ui.shoppingView === 'category' ? `<div class="master-shopping-summary">
        <span data-open-count>${openCount} von ${list.regular.length} offen</span>
        ${list.estimatedTotal ? `<strong>ca. ${list.estimatedTotal.toFixed(2).replace('.', ',')} €</strong>` : ''}
      </div>` : ''}

      <div class="master-shopping-actions">
        <button class="master-shopping-copy" type="button" data-v8-copy>Einkauf kopieren</button>
        <button class="master-shopping-more" type="button" data-shopping-more aria-label="Weitere Aktionen">•••</button>
      </div>
    </section>`;

    main.querySelectorAll('[data-v8-date]').forEach((button) => button.addEventListener('click', () => {
      ui.selectedDates = toggleShoppingDate(ui.selectedDates, button.dataset.v8Date, plan);
      renderShopping(root);
    }));

    main.querySelectorAll('[data-v8-view]').forEach((button) => button.addEventListener('click', () => {
      ui.shoppingView = button.dataset.v8View;
      renderShopping(root);
    }));

    main.querySelector('[data-toggle-staples]')?.addEventListener('click', () => {
      ui.expandedStaples = !ui.expandedStaples;
      haptic('tap');
      renderShopping(root);
    });

    main.querySelectorAll('[data-shopping-group]').forEach((button) => button.addEventListener('click', () => {
      const category = button.dataset.shoppingGroup;
      if (ui.collapsedGroups.has(category)) ui.collapsedGroups.delete(category);
      else ui.collapsedGroups.add(category);
      renderShopping(root);
    }));

    const openLabel = main.querySelector('[data-open-count]');
    const applyCheck = (button, checked) => {
      const id = button.dataset.v8Check;
      ui.checks[id] = checked;
      button.classList.toggle('checked', checked);
      button.textContent = checked ? '\u2713' : '';
      button.setAttribute('aria-label', checked ? 'Als offen markieren' : 'Als erledigt markieren');
      button.nextElementSibling?.classList.toggle('done', checked);
      if (openLabel) {
        const open = list.regular.filter((item) => !(ui.checks[item.id] ?? item.checked)).length;
        openLabel.textContent = `${open} von ${list.regular.length} offen`;
      }
      silentUpdate((current) => ({ ...current, shoppingChecks: { ...(current.shoppingChecks || {}), [id]: checked } }));
    };

    /* Waagerecht wischen hakt ab — senkrechtes Scrollen behaelt Vorrang. */
    main.querySelectorAll('.master-shopping-row').forEach((row) => {
      const button = row.querySelector('[data-v8-check]');
      if (button) enableSwipeToggle(row, () => applyCheck(button, !Boolean(ui.checks[button.dataset.v8Check])));
    });

    main.querySelectorAll('[data-v8-check]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.v8Check;
      const checked = !Boolean(ui.checks[id]);
      haptic(checked ? 'confirm' : 'tap');
      applyCheck(button, checked);
    }));

    /* Gerichtsansicht: eigener Haken, eigener Zaehler, gleiche Bedienung. */
    const applyRecipeCheck = (button, checked) => {
      const key = button.dataset.recipeCheck;
      ui.recipeChecks[key] = checked;
      button.classList.toggle('checked', checked);
      button.textContent = checked ? '\u2713' : '';
      button.setAttribute('aria-label', checked ? 'Als offen markieren' : 'Als erledigt markieren');
      button.nextElementSibling?.classList.toggle('done', checked);
      const section = button.closest('.master-shopping-group');
      const counter = section?.querySelector('.master-shopping-open');
      if (counter) {
        const open = section.querySelectorAll('[data-recipe-check]:not(.checked)').length;
        counter.textContent = `${open} offen`;
      }
      silentUpdate((current) => ({ ...current, shoppingRecipeChecks: { ...(current.shoppingRecipeChecks || {}), [key]: checked } }));
    };

    main.querySelectorAll('.master-shopping-row').forEach((row) => {
      const button = row.querySelector('[data-recipe-check]');
      if (button) enableSwipeToggle(row, () => applyRecipeCheck(button, !Boolean(ui.recipeChecks[button.dataset.recipeCheck])));
    });

    main.querySelectorAll('[data-recipe-group]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.recipeGroup;
      if (ui.collapsedRecipes.has(key)) ui.collapsedRecipes.delete(key);
      else ui.collapsedRecipes.add(key);
      button.closest('.master-shopping-group')?.classList.toggle('collapsed', ui.collapsedRecipes.has(key));
      haptic('tap');
    }));

    main.querySelectorAll('[data-recipe-check]').forEach((button) => button.addEventListener('click', () => {
      const checked = !Boolean(ui.recipeChecks[button.dataset.recipeCheck]);
      haptic(checked ? 'confirm' : 'tap');
      applyRecipeCheck(button, checked);
    }));

    main.querySelector('[data-v8-copy]')?.addEventListener('click', async (event) => {
      await navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan, ui.selectedDates, ui.checks)));
      event.currentTarget.textContent = 'Kopiert ✓';
      setTimeout(() => { event.currentTarget.textContent = 'Einkauf kopieren'; }, 1300);
    });

    main.querySelector('[data-shopping-more]')?.addEventListener('click', () => openShoppingMenu(root, plan));
  } catch (error) {
    console.error('[Preply V8] Einkaufsliste', error);
    main.innerHTML = `<section class="v8-page preply-page"><h1 class="master-screen-title">Einkauf</h1><p class="master-empty">Die Einkaufsliste konnte nicht geladen werden.</p></section>`;
  }
}

function openShoppingMenu(root, plan) {
  const overlay = appendSheet(root, 'plan-menu-overlay', `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="shopping-menu-title">
    <div class="sheet-head"><h2 id="shopping-menu-title">Einkauf verwalten</h2><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
    <div class="plan-menu-list">
      <button class="plan-menu-item" type="button" data-shopping-copy><span class="plan-menu-copy"><strong>Liste kopieren</strong><small>Als Text in die Zwischenablage</small></span><span class="plan-menu-arrow">›</span></button>
      <button class="plan-menu-item" type="button" data-shopping-all-days><span class="plan-menu-copy"><strong>Alle Tage auswählen</strong><small>Den gesamten aktuellen Plan einbeziehen</small></span><span class="plan-menu-arrow">›</span></button>
      <button class="plan-menu-item" type="button" data-shopping-reset><span class="plan-menu-copy"><strong>Erledigte zurücksetzen</strong><small>Alle Haken wieder entfernen</small></span><span class="plan-menu-arrow">›</span></button>
    </div>
  </section>`);

  overlay.querySelector('[data-shopping-copy]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan, ui.selectedDates, ui.checks)));
    closeOverlay(overlay);
  });
  overlay.querySelector('[data-shopping-all-days]').addEventListener('click', () => {
    ui.selectedDates = plan.selectedDates || plan.days.map((day) => day.date);
    closeOverlay(overlay);
    renderShopping(root);
  });
  overlay.querySelector('[data-shopping-reset]').addEventListener('click', () => {
    ui.checks = {};
    updateState((current) => ({ ...current, shoppingChecks: {} }));
    closeOverlay(overlay);
  });
}

export async function initializeFeatureEnhancements() {
  try {
    ui.recipes = await loadCards();
    ui.catalogError = null;
  } catch (error) {
    console.error('[Preply V8] Erweiterungskatalog', error);
    ui.catalogError = error.message || 'Rezepte konnten nicht geladen werden.';
  }
}

export async function refreshFeatureEnhancements(root) {
  if (getRoute() === 'recipes') renderRecipes(root);
  if (getRoute() === 'shopping') await renderShopping(root);
}
