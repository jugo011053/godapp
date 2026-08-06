import { getRoute } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { loadCards, getCards, getRecipe } from './data/recipeStore.js';
import { createDefaultFilters, filterRecipes, sortRecipes } from './features/discover/discoverEngine.js';
import { toggleFavorite, excludeRecipe, restoreRecipe } from './features/favorites/preferenceSignals.js';
import { buildShoppingList, copyShoppingText, toggleShoppingDate } from './features/shopping/shoppingEngine.js';

const ui = {
  recipes: [], filters: createDefaultFilters(), sort: 'recommended',
  selectedDates: [], checks: {}, shoppingView: 'category', details: new Map()
};

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const CATEGORY_DE = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack', shake: 'Shake' };

/* ── Chip helper ──────────────────────────────────── */
function chipRow(name, options, selected, toggle = false) {
  return `<div class="chip-row">${options.map(([value, label]) => {
    const active = toggle ? selected === value : selected === value;
    return `<button class="chip ${active ? 'active' : ''}" data-chip="${name}" data-value="${esc(value)}">${esc(label)}</button>`;
  }).join('')}</div>`;
}

function recipeCard(recipe, preferences) {
  const favorite = (preferences.favoriteRecipeIds || []).includes(recipe.id);
  const excluded = (preferences.excludedRecipeIds || []).includes(recipe.id);
  return `<article class="recipe-card"><div><p class="eyebrow">${esc(CATEGORY_DE[recipe.category] || recipe.category)}</p><h3>${esc(recipe.name)}</h3></div><div class="recipe-meta"><span>${Math.round(recipe.kcal)} kcal</span><span>${Math.round(recipe.protein)} g Protein</span><span>${Math.round(recipe.time)} Min.</span></div><div class="v8-actions"><button class="v8-button ${favorite?'primary':'ghost'}" data-v8-favorite="${esc(recipe.id)}">${favorite?'★ Gespeichert':'Speichern'}</button><button class="v8-button ghost" data-v8-detail="${esc(recipe.id)}">Details</button></div></article>`;
}

function renderRecipes(root) {
  const main = root.querySelector('.v8-main');
  if (!main || !ui.recipes.length) return;
  const state = getState();
  const results = sortRecipes(filterRecipes(ui.recipes, ui.filters, state.preferences), ui.sort, state.preferences);

  const hasFilters = ui.filters.category || ui.filters.maxTime || ui.filters.diet || ui.filters.simplicity || ui.filters.favoritesOnly;

  main.innerHTML = `<section class="v8-page">
    <div class="v8-page-head">
      <h1>Rezepte</h1>
      <p>${results.length} Gerichte${hasFilters ? ' gefiltert' : ''}</p>
    </div>

    <div style="margin-bottom:var(--space-3)">
      <input type="search" data-v8-filter="query" value="${esc(ui.filters.query)}" placeholder="🔍 Suchen …" style="width:100%;padding:var(--space-3);border:1.5px solid var(--border);border-radius:var(--radius-full);background:var(--surface);color:var(--ink);font-size:var(--text-sm)">
    </div>

    ${chipRow('category', [['','Alle'],['breakfast','Frühstück'],['lunch','Mittag'],['dinner','Abend'],['snack','Snack']], ui.filters.category)}

    <div style="margin-top:var(--space-2)">
      ${chipRow('maxTime', [['','Egal'],['15','≤ 15 Min'],['30','≤ 30 Min'],['45','≤ 45 Min']], String(ui.filters.maxTime || ''))}
    </div>

    <div style="margin-top:var(--space-2)">
      ${chipRow('extra', [
        ['fav', ui.filters.favoritesOnly ? '★ Favoriten' : 'Favoriten'],
        ['vegetarian','Vegetarisch'],
        ['vegan','Vegan'],
        ['simple','Simpel'],
        ['quick','Schnellste zuerst'],
        ['protein','Meistes Protein']
      ], ui.filters.favoritesOnly ? 'fav' : ui.filters.diet === 'vegetarian' ? 'vegetarian' : ui.filters.diet === 'vegan' ? 'vegan' : ui.filters.simplicity === 'simple' ? 'simple' : ui.sort === 'quick' ? 'quick' : ui.sort === 'protein' ? 'protein' : '')}
    </div>

    <div class="v8-grid" style="margin-top:var(--space-4)">
      ${results.slice(0,80).map((recipe) => recipeCard(recipe, state.preferences)).join('') || '<div class="empty-state">Keine passenden Rezepte.</div>'}
    </div>
  </section>`;

  bindRecipeEvents(root);
}

function bindRecipeEvents(root) {
  /* Search input */
  root.querySelector('[data-v8-filter="query"]')?.addEventListener('input', (e) => {
    ui.filters = { ...ui.filters, query: e.target.value };
    renderRecipes(root);
  });

  /* Category chips */
  root.querySelectorAll('[data-chip="category"]').forEach((chip) => chip.addEventListener('click', () => {
    ui.filters = { ...ui.filters, category: chip.dataset.value || '' };
    renderRecipes(root);
  }));

  /* Time chips */
  root.querySelectorAll('[data-chip="maxTime"]').forEach((chip) => chip.addEventListener('click', () => {
    ui.filters = { ...ui.filters, maxTime: chip.dataset.value ? Number(chip.dataset.value) : null };
    renderRecipes(root);
  }));

  /* Extra chips (toggle-style: tap to activate, tap again to deactivate) */
  root.querySelectorAll('[data-chip="extra"]').forEach((chip) => chip.addEventListener('click', () => {
    const val = chip.dataset.value;
    const isActive = chip.classList.contains('active');

    /* Reset all extra-controlled filters */
    let next = { ...ui.filters, favoritesOnly: false, diet: '', simplicity: '' };
    let nextSort = 'recommended';

    if (!isActive) {
      if (val === 'fav') next.favoritesOnly = true;
      else if (val === 'vegetarian') next.diet = 'vegetarian';
      else if (val === 'vegan') next.diet = 'vegan';
      else if (val === 'simple') next.simplicity = 'simple';
      else if (val === 'quick') nextSort = 'quick';
      else if (val === 'protein') nextSort = 'protein';
    }

    ui.filters = next;
    ui.sort = nextSort;
    renderRecipes(root);
  }));

  /* Favorite + detail buttons */
  root.querySelectorAll('[data-v8-favorite]').forEach((button) => button.addEventListener('click', () => { updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences, button.dataset.v8Favorite) })); renderRecipes(root); }));
  root.querySelectorAll('[data-v8-detail]').forEach((button) => button.addEventListener('click', () => showDetail(root, button.dataset.v8Detail)));
}

async function showDetail(root,id) {
  try {
    let recipe=ui.details.get(id); if(!recipe){ recipe=await getRecipe(id); ui.details.set(id,recipe); }
    const overlay=document.createElement('div'); overlay.className='v8-overlay';
    const stepsHtml = (recipe.steps||[]).length ? `<ol>${recipe.steps.map((step)=>`<li>${esc(step)}</li>`).join('')}</ol>` : '<p style="color:var(--muted);font-size:var(--text-sm)">Keine Zubereitungsschritte hinterlegt.</p>';
    overlay.innerHTML=`<section class="v8-dialog"><button class="v8-button ghost" data-v8-close>Schließen</button><h2>${esc(recipe.name)}</h2><div class="recipe-meta"><span>${recipe.kcal} kcal</span><span>${recipe.protein} g Protein</span><span>${recipe.time} Min.</span></div><h3>Zutaten</h3><ul>${(recipe.ingredients||[]).map((item)=>`<li>${esc(item.amount ?? item.quantity)} ${esc(item.unit)} ${esc(item.name)}</li>`).join('')}</ul><h3>Zubereitung</h3>${stepsHtml}</section>`;
    root.appendChild(overlay);
    overlay.querySelector('[data-v8-close]').addEventListener('click',()=>overlay.remove());
    overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();});
  } catch(error){ console.error('[Preply V8] Rezeptdetail',error); }
}

async function detailedPlan(plan) {
  const ids=[...new Set((plan.days||[]).flatMap((day)=>Object.values(day.meals||{}).map((meal)=>meal.recipeId||meal.recipe?.id)).filter(Boolean))];
  await Promise.all(ids.map(async(id)=>{ if(!ui.details.has(id)) ui.details.set(id,await getRecipe(id)); }));
  return { ...plan, days:plan.days.map((day)=>({ ...day, meals:Object.fromEntries(Object.entries(day.meals).map(([slot,meal])=>[slot,{...meal,recipe:ui.details.get(meal.recipeId||meal.recipe?.id)||meal.recipe}])) })) };
}

async function renderShopping(root) {
  const main=root.querySelector('.v8-main'); const state=getState();
  if(!main||!state.currentPlan) return;
  main.innerHTML='<section class="v8-page"><div class="v8-page-head"><h1>Einkaufsliste</h1></div><div class="v8-status">Zutaten werden zusammengestellt …</div></section>';
  try {
    const plan=await detailedPlan(state.currentPlan);
    if(!ui.selectedDates.length) ui.selectedDates=plan.selectedDates||plan.days.map((day)=>day.date);
    const list=buildShoppingList(plan,ui.selectedDates,ui.checks);
    const fmtAmt = (item) => { const amt = item.packs ? item.buyAmount : item.amount; const unit = item.buyUnit || item.unit; const packInfo = item.packs ? ` (${item.packs}× ${item.buyAmount} ${esc(item.buyUnit || item.unit)})` : ''; return `${amt} ${esc(unit)}${packInfo}`; };
    const content=ui.shoppingView==='category' ? list.groups.map((group)=>`<section class="v8-panel"><h2>${esc(group.category)}</h2>${group.items.map((item)=>`<label class="meal-row"><input type="checkbox" data-v8-check="${esc(item.id)}" ${item.checked?'checked':''}><div><strong>${esc(item.name)}</strong> · ${fmtAmt(item)}<details><summary>Wofür?</summary>${item.sources.map((source)=>`<div>${esc(source.dayLabel)} · ${esc(source.recipeName)}: ${source.amount} ${esc(source.unit)}</div>`).join('')}</details></div></label>`).join('')}</section>`).join('') : list.byRecipe.map((group)=>`<section class="v8-panel"><h2>${esc(group.dayLabel)} · ${esc(group.recipeName)}</h2>${group.ingredients.map((item)=>`<div>${esc(item.name)}: ${item.amount} ${esc(item.unit)}</div>`).join('')}</section>`).join('');
    main.innerHTML=`<section class="v8-page"><div class="v8-page-head"><h1>Einkaufsliste</h1><p>${list.items.length} Zutaten · ca. ${list.estimatedTotal.toFixed(2)} €</p></div><div class="v8-panel"><div class="chip-row">${list.availableDates.map(({date,label})=>`<button class="chip ${list.selectedDates.includes(date)?'active':''}" data-v8-date="${date}">${esc(label)}</button>`).join('')}</div><div class="v8-actions" style="margin-top:12px"><button class="v8-button ${ui.shoppingView==='category'?'primary':''}" data-v8-view="category">Kategorie</button><button class="v8-button ${ui.shoppingView==='recipe'?'primary':''}" data-v8-view="recipe">Gericht</button><button class="v8-button ghost" data-v8-copy>Kopieren</button></div></div>${content}</section>`;
    main.querySelectorAll('[data-v8-date]').forEach((button)=>button.addEventListener('click',()=>{ui.selectedDates=toggleShoppingDate(ui.selectedDates,button.dataset.v8Date,plan);renderShopping(root);}));
    main.querySelectorAll('[data-v8-view]').forEach((button)=>button.addEventListener('click',()=>{ui.shoppingView=button.dataset.v8View;renderShopping(root);}));
    main.querySelectorAll('[data-v8-check]').forEach((input)=>input.addEventListener('change',()=>{ui.checks[input.dataset.v8Check]=input.checked;}));
    main.querySelector('[data-v8-copy]')?.addEventListener('click',async(e)=>{await navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan,ui.selectedDates,ui.checks)));const btn=e.currentTarget;btn.textContent='Kopiert ✓';setTimeout(()=>{btn.textContent='Kopieren';},1500);});
  } catch(error){ main.innerHTML=`<section class="v8-page"><div class="v8-status error">${esc(error.message)}</div></section>`; }
}

export async function initializeFeatureEnhancements() {
  try { ui.recipes=await loadCards(); } catch(error){ console.error('[Preply V8] Erweiterungskatalog',error); }
}

export async function refreshFeatureEnhancements(root) {
  if(getRoute()==='recipes') renderRecipes(root);
  if(getRoute()==='shopping') await renderShopping(root);
}
