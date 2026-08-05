import { getRoute } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { RecipeRepository } from './data/recipeRepository.js';
import { createDefaultFilters, filterRecipes, sortRecipes } from './features/discover/discoverEngine.js';
import { toggleFavorite, excludeRecipe, restoreRecipe } from './features/favorites/preferenceSignals.js';
import { buildShoppingList, copyShoppingText, toggleShoppingDate } from './features/shopping/shoppingEngine.js';

const SUPABASE_URL = 'https://rfdtjodpjvynnavnucvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrNRV-ogNAYt2cCoNHDXoKZ8GzE';
const repository = new RecipeRepository({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });

const runtime = {
  recipes: [],
  filters: createDefaultFilters(),
  sort: 'recommended',
  selectedShoppingDates: [],
  shoppingChecks: {},
  shoppingView: 'category',
  details: new Map(),
  rendering: false
};

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}

function card(recipe, preferences) {
  const favorite = (preferences.favoriteRecipeIds || []).includes(recipe.id);
  const excluded = (preferences.excludedRecipeIds || []).includes(recipe.id);
  return `<article class="recipe-card" data-enhanced-recipe="${esc(recipe.id)}">
    <div><p class="eyebrow">${esc(recipe.category)}</p><h3>${esc(recipe.name)}</h3></div>
    <div class="recipe-meta"><span>${Math.round(recipe.kcal)} kcal</span><span>${Math.round(recipe.protein)} g Protein</span><span>${Math.round(recipe.time)} Min.</span><span>${esc(recipe.simplicity)}</span></div>
    <div class="v8-actions">
      <button class="v8-button ${favorite ? 'primary' : ''}" data-favorite="${esc(recipe.id)}">${favorite ? 'Gespeichert' : 'Speichern'}</button>
      <button class="v8-button ghost" data-exclude="${esc(recipe.id)}">${excluded ? 'Wieder zulassen' : 'Nicht vorschlagen'}</button>
      <button class="v8-button ghost" data-detail="${esc(recipe.id)}">Details</button>
    </div>
  </article>`;
}

function filterSelect(name, label, values, current) {
  return `<label class="form-field"><span>${label}</span><select data-filter="${name}"><option value="">Alle</option>${values.map(([value,text]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}

function renderRecipes(root) {
  if (getRoute() !== 'recipes' || !runtime.recipes.length) return;
  const main = root.querySelector('.v8-main');
  if (!main) return;
  const state = getState();
  const results = sortRecipes(filterRecipes(runtime.recipes, runtime.filters, state.preferences), runtime.sort, state.preferences);
  main.innerHTML = `<section class="v8-page">
    <div class="v8-page-head"><div><p class="eyebrow">Rezepte</p><h1>Für dich und alle Rezepte</h1></div><p>${results.length} passende Gerichte. Filter wirken tatsächlich, eine technisch bemerkenswerte Leistung.</p></div>
    <div class="v8-panel">
      <div class="form-grid">
        <label class="form-field"><span>Suche</span><input type="search" data-filter="query" value="${esc(runtime.filters.query)}" placeholder="Name, Zutat oder Tag"></label>
        ${filterSelect('category','Mahlzeit',[['breakfast','Frühstück'],['lunch','Mittagessen'],['dinner','Abendessen'],['snack','Snack']],runtime.filters.category)}
        ${filterSelect('maxTime','Maximale Zeit',[['15','15 Minuten'],['30','30 Minuten'],['45','45 Minuten'],['60','60 Minuten']],String(runtime.filters.maxTime || ''))}
        ${filterSelect('simplicity','Stil',[['simple','Simpel'],['balanced','Ausgewogen'],['experimental','Experimentell']],runtime.filters.simplicity)}
        ${filterSelect('diet','Ernährung',[['vegetarian','Vegetarisch'],['vegan','Vegan'],['pescatarian','Pescetarisch']],runtime.filters.diet)}
        ${filterSelect('minProtein','Protein',[['20','ab 20 g'],['30','ab 30 g'],['40','ab 40 g']],String(runtime.filters.minProtein || ''))}
        <label class="form-field"><span>Sortierung</span><select data-sort><option value="recommended">Empfohlen</option><option value="quick" ${runtime.sort==='quick'?'selected':''}>Schnell</option><option value="protein" ${runtime.sort==='protein'?'selected':''}>Proteinreich</option><option value="meal_prep" ${runtime.sort==='meal_prep'?'selected':''}>Meal Prep</option><option value="name" ${runtime.sort==='name'?'selected':''}>Name</option></select></label>
      </div>
      <div class="v8-actions" style="margin-top:12px"><button class="v8-button ${runtime.filters.favoritesOnly ? 'primary' : ''}" data-favorites-only>Nur Favoriten</button><button class="v8-button ghost" data-reset-filters>Filter zurücksetzen</button></div>
    </div>
    <div class="v8-grid">${results.slice(0,120).map((recipe) => card(recipe, state.preferences)).join('') || '<div class="empty-state">Keine passenden Rezepte.</div>'}</div>
  </section>`;
  bindRecipeEvents(root);
}

function bindRecipeEvents(root) {
  root.querySelectorAll('[data-filter]').forEach((input) => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', () => {
    const key = input.dataset.filter;
    const numeric = ['maxTime','minProtein'].includes(key);
    runtime.filters = { ...runtime.filters, [key]: numeric ? (input.value ? Number(input.value) : null) : input.value };
    renderRecipes(root);
  }));
  root.querySelector('[data-sort]')?.addEventListener('change', (event) => { runtime.sort = event.target.value; renderRecipes(root); });
  root.querySelector('[data-favorites-only]')?.addEventListener('click', () => { runtime.filters.favoritesOnly = !runtime.filters.favoritesOnly; renderRecipes(root); });
  root.querySelector('[data-reset-filters]')?.addEventListener('click', () => { runtime.filters = createDefaultFilters(); renderRecipes(root); });
  root.querySelectorAll('[data-favorite]').forEach((button) => button.addEventListener('click', () => {
    updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences, button.dataset.favorite) }));
    renderRecipes(root);
  }));
  root.querySelectorAll('[data-exclude]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.exclude;
    updateState((state) => ({ ...state, preferences: (state.preferences.excludedRecipeIds || []).includes(id) ? restoreRecipe(state.preferences,id) : excludeRecipe(state.preferences,id,[]) }));
    renderRecipes(root);
  }));
  root.querySelectorAll('[data-detail]').forEach((button) => button.addEventListener('click', async () => showDetail(root, button.dataset.detail)));
}

async function showDetail(root, id) {
  let recipe = runtime.details.get(id);
  if (!recipe) { recipe = await repository.getRecipe(id); runtime.details.set(id, recipe); }
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.innerHTML = `<section class="v8-dialog"><button class="v8-button ghost" data-close-detail>Schließen</button><h2>${esc(recipe.name)}</h2><div class="recipe-meta"><span>${recipe.kcal} kcal</span><span>${recipe.protein} g Protein</span><span>${recipe.time} Min.</span></div><h3>Zutaten</h3><ul>${(recipe.ingredients || []).map((item) => `<li>${esc(item.amount)} ${esc(item.unit)} ${esc(item.name)}</li>`).join('')}</ul><h3>Zubereitung</h3><ol>${(recipe.steps || []).map((step) => `<li>${esc(step)}</li>`).join('')}</ol></section>`;
  root.appendChild(overlay);
  overlay.querySelector('[data-close-detail]').addEventListener('click', () => overlay.remove());
}

async function enrichPlan(plan) {
  const ids = [...new Set((plan.days || []).flatMap((day) => Object.values(day.meals || {}).map((meal) => meal.recipeId || meal.recipe?.id)).filter(Boolean))];
  await Promise.all(ids.map(async (id) => { if (!runtime.details.has(id)) runtime.details.set(id, await repository.getRecipe(id)); }));
  return { ...plan, days: plan.days.map((day) => ({ ...day, meals: Object.fromEntries(Object.entries(day.meals).map(([key,meal]) => [key,{ ...meal, recipe: runtime.details.get(meal.recipeId || meal.recipe?.id) || meal.recipe }])) })) };
}

async function renderShopping(root) {
  if (getRoute() !== 'shopping') return;
  const main = root.querySelector('.v8-main');
  const state = getState();
  if (!main || !state.currentPlan) return;
  main.innerHTML = '<section class="v8-page"><div class="v8-status">Zutaten werden geladen …</div></section>';
  try {
    const plan = await enrichPlan(state.currentPlan);
    if (!runtime.selectedShoppingDates.length) runtime.selectedShoppingDates = plan.selectedDates || plan.days.map((day) => day.date);
    const list = buildShoppingList(plan, runtime.selectedShoppingDates, runtime.shoppingChecks);
    main.innerHTML = `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Einkauf</p><h1>Einkaufsliste</h1></div><p>${list.items.length} Zutaten · ca. ${list.estimatedTotal.toFixed(2)} €</p></div><div class="v8-panel"><div class="day-chip-row">${list.availableDates.map(({date,label}) => `<button class="day-toggle ${list.selectedDates.includes(date)?'active':''}" data-shop-date="${date}">${esc(label)}</button>`).join('')}</div><div class="v8-actions" style="margin-top:12px"><button class="v8-button ${runtime.shoppingView==='category'?'primary':''}" data-shop-view="category">Nach Kategorie</button><button class="v8-button ${runtime.shoppingView==='recipe'?'primary':''}" data-shop-view="recipe">Nach Gericht</button><button class="v8-button ghost" data-copy-shopping>Kopieren</button></div></div>${runtime.shoppingView === 'category' ? list.groups.map((group) => `<section class="v8-panel"><h2>${esc(group.category)}</h2>${group.items.map((item) => `<label class="meal-row"><input type="checkbox" data-shop-check="${esc(item.id)}" ${item.checked?'checked':''}><div><strong>${esc(item.name)}</strong> · ${item.buyAmount || item.amount} ${esc(item.unit)}<details><summary>Wofür?</summary>${item.sources.map((source) => `<div>${esc(source.dayLabel)} · ${esc(source.recipeName)}: ${source.amount} ${esc(source.unit)}</div>`).join('')}</details></div></label>`).join('')}</section>`).join('') : list.byRecipe.map((group) => `<section class="v8-panel"><h2>${esc(group.dayLabel)} · ${esc(group.recipeName)}</h2>${group.ingredients.map((item) => `<div>${esc(item.name)}: ${item.amount} ${esc(item.unit)}</div>`).join('')}</section>`).join('')}</section>`;
    main.querySelectorAll('[data-shop-date]').forEach((button) => button.addEventListener('click', () => { runtime.selectedShoppingDates = toggleShoppingDate(runtime.selectedShoppingDates, button.dataset.shopDate, plan); renderShopping(root); }));
    main.querySelectorAll('[data-shop-view]').forEach((button) => button.addEventListener('click', () => { runtime.shoppingView = button.dataset.shopView; renderShopping(root); }));
    main.querySelectorAll('[data-shop-check]').forEach((input) => input.addEventListener('change', () => { runtime.shoppingChecks[input.dataset.shopCheck] = input.checked; }));
    main.querySelector('[data-copy-shopping]')?.addEventListener('click', async () => { await navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan,runtime.selectedShoppingDates,runtime.shoppingChecks))); });
  } catch (error) { main.innerHTML = `<section class="v8-page"><div class="v8-status error">${esc(error.message)}</div></section>`; }
}

function enhance(root) {
  if (runtime.rendering) return;
  runtime.rendering = true;
  queueMicrotask(async () => {
    try {
      if (getRoute() === 'recipes') renderRecipes(root);
      if (getRoute() === 'shopping') await renderShopping(root);
    } finally { runtime.rendering = false; }
  });
}

export async function installFeatureEnhancements(root) {
  try { runtime.recipes = await repository.listCards(); } catch (error) { console.error('[Preply V8] Erweiterter Katalogfehler', error); }
  const observer = new MutationObserver(() => enhance(root));
  observer.observe(root, { childList: true, subtree: true });
  enhance(root);
}
