import { getRoute } from './core/router.js';
import { getState, updateState, silentUpdate } from './core/store.js';
import { loadCards, getRecipe } from './data/recipeStore.js';
import { createDefaultFilters, filterRecipes, sortRecipes } from './features/discover/discoverEngine.js';
import { toggleFavorite, excludeRecipe } from './features/favorites/preferenceSignals.js';
import { buildShoppingList, copyShoppingText, toggleShoppingDate } from './features/shopping/shoppingEngine.js';

const ui = {
  recipes: [],
  filters: createDefaultFilters(),
  sort: 'recommended',
  selectedDates: [],
  checks: {},
  shoppingView: 'category',
  collapsedGroups: new Set(),
  details: new Map()
};

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

function recipeVisual(recipe) {
  const image = recipeImage(recipe);
  return image
    ? `<div class="master-recipe-visual"><img src="${esc(image)}" alt="" loading="lazy"></div>`
    : '<div class="master-recipe-visual placeholder" aria-hidden="true"></div>';
}

function forYouCard(recipe, preferences) {
  return `<article class="master-foryou-card">
    <button class="master-recipe-main" type="button" data-v8-detail="${esc(recipe.id)}" style="display:block;width:100%;padding:0">
      ${recipeVisual(recipe)}
      <span class="master-foryou-copy">
        <strong>${esc(recipe.name)}</strong>
        <small>${Math.round(recipe.kcal || 0)} kcal · ${Math.round(recipe.protein || 0)} g Protein · ${Math.round(recipe.time || 0)} Min.</small>
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

function renderRecipes(root) {
  const main = root.querySelector('.v8-main');
  if (!main) return;
  if (!ui.recipes.length) {
    main.innerHTML = '<section class="v8-page preply-page"><h1 class="master-screen-title">Rezepte</h1><p class="master-empty">Rezepte werden geladen …</p></section>';
    return;
  }

  const state = getState();
  const preferences = state.preferences || {};
  const filtered = filterRecipes(ui.recipes, ui.filters, preferences);
  const results = sortRecipes(filtered, ui.sort, preferences);
  const recommendations = sortRecipes(filterRecipes(ui.recipes, {
    ...createDefaultFilters(),
    category: ui.filters.category,
    maxTime: ui.filters.maxTime,
    diet: ui.filters.diet,
    simplicity: ui.filters.simplicity
  }, preferences), 'recommended', preferences).slice(0, 6);

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

    <div class="master-section-head"><h2>Für dich</h2><span>${recommendations.length} Vorschläge</span></div>
    <div class="master-foryou">
      ${recommendations.map((recipe) => forYouCard(recipe, preferences)).join('') || '<p class="master-empty">Noch keine passenden Empfehlungen.</p>'}
    </div>

    <div class="master-section-head"><h2>Alle Rezepte</h2><span>${results.length}</span></div>
    <div class="master-recipe-list">
      ${results.slice(0, 80).map((recipe) => recipeRow(recipe, preferences)).join('') || '<p class="master-empty">Mit diesen Filtern wurde kein Rezept gefunden.</p>'}
    </div>
  </section>`;

  bindRecipeEvents(root);
}

function bindRecipeEvents(root) {
  root.querySelector('[data-v8-filter="query"]')?.addEventListener('input', (event) => {
    ui.filters = { ...ui.filters, query: event.currentTarget.value };
    renderRecipes(root);
    const input = root.querySelector('[data-v8-filter="query"]');
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });

  root.querySelectorAll('[data-chip="category"]').forEach((button) => button.addEventListener('click', () => {
    ui.filters = { ...ui.filters, category: button.dataset.value || '' };
    renderRecipes(root);
  }));

  root.querySelectorAll('[data-quick-filter]').forEach((button) => button.addEventListener('click', () => {
    const value = button.dataset.quickFilter;
    if (value === 'favorites') ui.filters = { ...ui.filters, favoritesOnly: !ui.filters.favoritesOnly };
    if (value === 'quick') ui.sort = ui.sort === 'quick' ? 'recommended' : 'quick';
    if (value === 'protein') ui.sort = ui.sort === 'protein' ? 'recommended' : 'protein';
    renderRecipes(root);
  }));

  root.querySelectorAll('[data-open-filters]').forEach((button) => button.addEventListener('click', () => openFilterSheet(root)));

  root.querySelectorAll('[data-v8-favorite]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    updateState((state) => ({
      ...state,
      preferences: toggleFavorite(state.preferences || {}, button.dataset.v8Favorite)
    }));
    renderRecipes(root);
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

  const select = (selector, key, value) => {
    draft[key] = value;
    overlay.querySelectorAll(selector).forEach((button) => button.classList.toggle('selected', button.dataset[selector.includes('diet') ? 'filterDiet' : selector.includes('time') ? 'filterTime' : 'filterSimple'] === String(value)));
  };

  overlay.querySelectorAll('[data-filter-diet]').forEach((button) => button.addEventListener('click', () => select('[data-filter-diet]', 'diet', button.dataset.filterDiet)));
  overlay.querySelectorAll('[data-filter-time]').forEach((button) => button.addEventListener('click', () => select('[data-filter-time]', 'maxTime', Number(button.dataset.filterTime) || null)));
  overlay.querySelectorAll('[data-filter-simple]').forEach((button) => button.addEventListener('click', () => select('[data-filter-simple]', 'simplicity', button.dataset.filterSimple)));
  overlay.querySelector('[data-filter-apply]').addEventListener('click', () => {
    ui.filters = { ...ui.filters, diet: draft.diet, maxTime: draft.maxTime, simplicity: draft.simplicity };
    closeOverlay(overlay);
    renderRecipes(root);
  });
  overlay.querySelector('[data-filter-reset]').addEventListener('click', () => {
    ui.filters = { ...ui.filters, diet: '', maxTime: null, simplicity: '', difficulty: '' };
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
  const recipe = await recipeById(id);
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
    updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences || {}, id) }));
    closeOverlay(overlay);
    renderRecipes(root);
  });
  overlay.querySelector('[data-menu-exclude]').addEventListener('click', () => {
    updateState((state) => ({ ...state, preferences: excludeRecipe(state.preferences || {}, id, []) }));
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
      updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences || {}, id) }));
      closeOverlay(overlay);
      renderRecipes(root);
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

function displayCategory(category = '') {
  const value = category.toLowerCase();
  if (value.includes('gemüse') || value.includes('obst') || value.includes('salat')) return 'Obst & Gemüse';
  if (value.includes('fleisch') || value.includes('geflügel') || value.includes('wurst') || value.includes('rind') || value.includes('schwein') || value.includes('hack')) return 'Fleisch & Wurst';
  if (value.includes('fisch') || value.includes('meeres') || value.includes('garnele') || value.includes('lachs') || value.includes('thunfisch')) return 'Fisch';
  if (value.includes('milch') || value.includes('käse') || value.includes('joghurt') || value.includes('ei') || value.includes('kühl') || value.includes('quark') || value.includes('sahne') || value.includes('butter') || value.includes('schmand')) return 'Milchprodukte & Eier';
  if (value.includes('brot') || value.includes('back') || value.includes('mehl') || value.includes('teig')) return 'Brot & Backwaren';
  if (value.includes('nudel') || value.includes('pasta') || value.includes('reis') || value.includes('getreide') || value.includes('hülsen') || value.includes('trocken') || value.includes('linse') || value.includes('bohne') || value.includes('couscous') || value.includes('haferflocken')) return 'Trockenware & Beilagen';
  if (value.includes('gewürz') || value.includes('kräuter') || value.includes('soße') || value.includes('sauce') || value.includes('essig') || value.includes('senf') || value.includes('dressing') || value.includes('würz')) return 'Gewürze & Soßen';
  if (value.includes('öl') || value.includes('fett') || value.includes('margarine')) return 'Öle & Fette';
  if (value.includes('konserv') || value.includes('dose') || value.includes('passiert') || value.includes('tomatenmark')) return 'Konserven';
  if (value.includes('tiefkühl') || value.includes('gefroren') || value.includes('tk')) return 'Tiefkühl';
  if (value.includes('nuss') || value.includes('nüsse') || value.includes('samen') || value.includes('kerne') || value.includes('mandel')) return 'Nüsse & Samen';
  return 'Sonstiges';
}

function groupedShoppingItems(items) {
  return Object.values(items.reduce((groups, item) => {
    const category = displayCategory(item.category);
    if (!groups[category]) groups[category] = { category, items: [] };
    groups[category].items.push(item);
    return groups;
  }, {}));
}

function amountText(item) {
  const amount = item.packs ? item.buyAmount : item.amount;
  return `${Math.round(Number(amount || 0) * 100) / 100} ${esc(item.buyUnit || item.unit || '')}`;
}

function shoppingItem(item) {
  const checked = Boolean(ui.checks[item.id] ?? item.checked);
  return `<div class="master-shopping-row">
    <button class="master-shopping-check ${checked ? 'checked' : ''}" type="button" data-v8-check="${esc(item.id)}" aria-label="${checked ? 'Als offen markieren' : 'Als erledigt markieren'}">${checked ? '✓' : ''}</button>
    <span class="master-shopping-name ${checked ? 'done' : ''}">${esc(item.name)}</span>
    <span class="master-shopping-amount">${amountText(item)}</span>
  </div>`;
}

function categoryGroup(group) {
  const collapsed = ui.collapsedGroups.has(group.category);
  return `<section class="master-shopping-group ${collapsed ? 'collapsed' : ''}">
    <button type="button" data-shopping-group="${esc(group.category)}"><span>${esc(group.category)}</span>${SVG.chevron}</button>
    <div class="master-shopping-items">${group.items.map(shoppingItem).join('')}</div>
  </section>`;
}

function recipeShoppingGroup(group) {
  return `<section class="master-shopping-group">
    <button type="button"><span>${esc(group.dayLabel)} · ${esc(group.recipeName)}</span></button>
    <div class="master-shopping-items">${group.ingredients.map((item) => `<div class="master-shopping-row"><span></span><span class="master-shopping-name">${esc(item.name)}</span><span class="master-shopping-amount">${Math.round(Number(item.amount || 0) * 100) / 100} ${esc(item.unit)}</span></div>`).join('')}</div>
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

  main.innerHTML = '<section class="v8-page preply-page"><h1 class="master-screen-title">Einkauf</h1><p class="master-empty">Einkaufsliste wird zusammengestellt …</p></section>';

  try {
    const plan = await detailedPlan(state.currentPlan);
    if (!ui.selectedDates.length) ui.selectedDates = plan.selectedDates || plan.days.map((day) => day.date);
    ui.checks = { ...(state.shoppingChecks || {}), ...ui.checks };
    const list = buildShoppingList(plan, ui.selectedDates, ui.checks);
    const groups = groupedShoppingItems(list.items);

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
      </div>

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

    main.querySelectorAll('[data-shopping-group]').forEach((button) => button.addEventListener('click', () => {
      const category = button.dataset.shoppingGroup;
      if (ui.collapsedGroups.has(category)) ui.collapsedGroups.delete(category);
      else ui.collapsedGroups.add(category);
      renderShopping(root);
    }));

    main.querySelectorAll('[data-v8-check]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.v8Check;
      const checked = !Boolean(ui.checks[id]);
      ui.checks[id] = checked;
      button.classList.toggle('checked', checked);
      button.textContent = checked ? '✓' : '';
      button.nextElementSibling?.classList.toggle('done', checked);
      silentUpdate((current) => ({ ...current, shoppingChecks: { ...(current.shoppingChecks || {}), [id]: checked } }));
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
  } catch (error) {
    console.error('[Preply V8] Erweiterungskatalog', error);
  }
}

export async function refreshFeatureEnhancements(root) {
  if (getRoute() === 'recipes') renderRecipes(root);
  if (getRoute() === 'shopping') await renderShopping(root);
}
