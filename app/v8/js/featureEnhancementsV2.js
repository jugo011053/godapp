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
const TONES = ['tone-lime', 'tone-lavender', 'tone-peach', 'tone-blue', 'tone-pink'];

/* ── Discover card (V7 style) ──────────────────────── */
function discoverCard(recipe, preferences, index) {
  const favorite = (preferences.favoriteRecipeIds || []).includes(recipe.id);
  return `<div class="preply-discover-card" data-v8-detail="${esc(recipe.id)}">
    <span class="preply-mark ${TONES[index % 5]}"><i></i></span>
    <span>
      <small>${esc(CATEGORY_DE[recipe.category] || recipe.category)} · ${Math.round(recipe.time)} Min</small>
      <strong>${esc(recipe.name)}</strong>
      <em>${Math.round(recipe.kcal)} kcal · ${Math.round(recipe.protein)} g Protein</em>
    </span>
    <button class="v8-button ${favorite ? 'primary' : ''}" style="padding:4px 10px;font-size:10px;border-radius:var(--radius-full);flex-shrink:0" data-v8-favorite="${esc(recipe.id)}">${favorite ? '★' : '☆'}</button>
  </div>`;
}

function renderRecipes(root) {
  const main = root.querySelector('.v8-main');
  if (!main || !ui.recipes.length) return;
  const state = getState();
  const results = sortRecipes(filterRecipes(ui.recipes, ui.filters, state.preferences), ui.sort, state.preferences);

  const hasFilters = ui.filters.category || ui.filters.maxTime || ui.filters.diet || ui.filters.simplicity || ui.filters.favoritesOnly;

  main.innerHTML = `<section class="v8-page preply-page">
    <div class="preply-kicker">Rezepte</div>
    <h1 class="preply-title">Was möchtest<br>du kochen?</h1>

    <input class="preply-search" type="search" data-v8-filter="query" value="${esc(ui.filters.query)}" placeholder="Rezept suchen...">

    <div class="preply-filter-row">
      ${[['','Alle'],['breakfast','Frühstück'],['lunch','Mittag'],['dinner','Abend'],['snack','Snack']].map(([v,l]) =>
        `<button class="preply-filter ${ui.filters.category === v ? 'active' : ''}" data-chip="category" data-value="${esc(v)}">${esc(l)}</button>`
      ).join('')}
    </div>

    <div class="preply-filter-row">
      ${[
        ['fav', ui.filters.favoritesOnly ? '★ Favoriten' : 'Favoriten'],
        ['vegetarian','Vegetarisch'],
        ['vegan','Vegan'],
        ['simple','Simpel'],
        ['quick','Schnell'],
        ['protein','Proteinreich']
      ].map(([v,l]) => {
        const isActive = (v === 'fav' && ui.filters.favoritesOnly) ||
          (v === 'vegetarian' && ui.filters.diet === 'vegetarian') ||
          (v === 'vegan' && ui.filters.diet === 'vegan') ||
          (v === 'simple' && ui.filters.simplicity === 'simple') ||
          (v === 'quick' && ui.sort === 'quick') ||
          (v === 'protein' && ui.sort === 'protein');
        return `<button class="preply-filter ${isActive ? 'active' : ''}" data-chip="extra" data-value="${esc(v)}">${esc(l)}</button>`;
      }).join('')}
    </div>

    <p class="preply-copy">${results.length} passende Rezepte${hasFilters ? ' – gefiltert' : ''}</p>

    <div style="margin-top:14px">
      ${results.slice(0,60).map((recipe, i) => discoverCard(recipe, state.preferences, i)).join('') || '<p class="preply-empty">Dafür gibt es mit deinen aktuellen Filtern noch kein passendes Rezept.</p>'}
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

  /* Favorite buttons */
  root.querySelectorAll('[data-v8-favorite]').forEach((button) => button.addEventListener('click', (e) => {
    e.stopPropagation();
    updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences, button.dataset.v8Favorite) }));
    renderRecipes(root);
  }));

  /* Detail buttons (click on discover card) */
  root.querySelectorAll('[data-v8-detail]').forEach((card) => card.addEventListener('click', (e) => {
    if (e.target.closest('[data-v8-favorite]')) return;
    showDetail(root, card.dataset.v8Detail);
  }));
}

async function showDetail(root,id) {
  try {
    let recipe=ui.details.get(id); if(!recipe){ recipe=await getRecipe(id); ui.details.set(id,recipe); }
    const overlay=document.createElement('div'); overlay.className='v8-overlay';
    const stepsHtml = (recipe.steps||[]).length ? `<div class="meal-steps-list">${recipe.steps.map((step,i)=>`<div class="meal-step"><span class="step-num">${i+1}</span><span>${esc(step)}</span></div>`).join('')}</div>` : '<p style="color:var(--muted);font-size:var(--text-sm)">Keine Zubereitungsschritte hinterlegt.</p>';
    overlay.innerHTML=`<section class="v8-dialog"><button class="v8-button ghost" data-v8-close style="margin-bottom:var(--space-2)">← Zurück</button><h2>${esc(recipe.name)}</h2><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--space-3)"><span class="preply-filter" style="pointer-events:none">${Math.round(recipe.kcal)} kcal</span><span class="preply-filter" style="pointer-events:none">${Math.round(recipe.protein)} g Protein</span><span class="preply-filter" style="pointer-events:none">${Math.round(recipe.time)} Min.</span></div><h3>Zutaten</h3><div class="meal-ing-list">${(recipe.ingredients||[]).map((item)=>`<div class="meal-ing-row"><span>${esc(item.name)}</span><b>${esc(item.amount ?? item.quantity ?? '')} ${esc(item.unit || '')}</b></div>`).join('')}</div><h3>Zubereitung</h3>${stepsHtml}</section>`;
    root.appendChild(overlay);
    overlay.querySelector('[data-v8-close]').addEventListener('click',()=>overlay.remove());
    overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();});
  } catch(error){ console.error('[Preply V8] Rezeptdetail',error); }
}

function normalizeDays(plan) {
  if (Array.isArray(plan.days)) return plan.days;
  if (plan.days && typeof plan.days === 'object') return Object.entries(plan.days).map(([date, meals]) => ({ date, meals: meals || {} })).sort((a, b) => a.date.localeCompare(b.date));
  return [];
}

async function detailedPlan(plan) {
  const days = normalizeDays(plan);
  const ids=[...new Set(days.flatMap((day)=>Object.values(day.meals||{}).map((meal)=>meal.recipeId||meal.recipe?.id).filter(Boolean)))];
  await Promise.all(ids.map(async(id)=>{ if(!ui.details.has(id)) ui.details.set(id,await getRecipe(id)); }));
  return { ...plan, days:days.map((day)=>({ ...day, meals:Object.fromEntries(Object.entries(day.meals||{}).map(([slot,meal])=>[slot,{...meal,recipe:ui.details.get(meal.recipeId||meal.recipe?.id)||meal.recipe}])) })) };
}

async function renderShopping(root) {
  const main=root.querySelector('.v8-main'); const state=getState();
  if(!main||!state.currentPlan) return;
  main.innerHTML='<section class="v8-page preply-page"><div class="preply-kicker">Einkaufen</div><h1 class="preply-title">Alles, was<br>du brauchst.</h1><div class="v8-status">Zutaten werden zusammengestellt …</div></section>';
  try {
    const plan=await detailedPlan(state.currentPlan);
    if(!ui.selectedDates.length) ui.selectedDates=plan.selectedDates||plan.days.map((day)=>day.date);
    const list=buildShoppingList(plan,ui.selectedDates,ui.checks);
    const fmtAmt = (item) => { const amt = item.packs ? item.buyAmount : item.amount; const unit = item.buyUnit || item.unit; const packInfo = item.packs ? ` (${item.packs}× ${item.buyAmount} ${esc(item.buyUnit || item.unit)})` : ''; return `${amt} ${esc(unit)}${packInfo}`; };

    const done = list.items.filter((i) => i.checked).length;

    const content=ui.shoppingView==='category' ? list.groups.map((group)=>`<div class="preply-shopping-group"><h2>${esc(group.category)}</h2>${group.items.map((item)=>`<label class="shop-row ${item.checked ? 'checked' : ''}"><input type="checkbox" data-v8-check="${esc(item.id)}" ${item.checked?'checked':''}><div><strong>${esc(item.name)}</strong> · ${fmtAmt(item)}<details><summary style="font-size:10px;color:var(--accent-strong);cursor:pointer;margin-top:2px">Wofür?</summary>${item.sources.map((source)=>`<div style="font-size:10px;color:var(--muted);padding:2px 0">${esc(source.dayLabel)} · ${esc(source.recipeName)}: ${source.amount} ${esc(source.unit)}</div>`).join('')}</details></div></label>`).join('')}</div>`).join('') : list.byRecipe.map((group)=>`<div class="preply-shopping-group"><h2>${esc(group.dayLabel)} · ${esc(group.recipeName)}</h2>${group.ingredients.map((item)=>`<div style="padding:4px 0;font-size:13px;border-bottom:1px solid var(--border-light)">${esc(item.name)}: ${item.amount} ${esc(item.unit)}</div>`).join('')}</div>`).join('');

    main.innerHTML=`<section class="v8-page preply-page">
      <div class="preply-kicker">Einkaufen</div>
      <h1 class="preply-title">Alles, was<br>du brauchst.</h1>
      <div class="preply-shopping-summary">
        <div><b>${done} von ${list.items.length} erledigt</b><span>für deinen aktuellen Essensplan</span></div>
        <div style="text-align:right"><b>${list.estimatedTotal.toFixed(2)} €</b><span>ca. Einkauf</span></div>
      </div>
      <div class="preply-filter-row">
        ${list.availableDates.map(({date,label})=>`<button class="preply-filter ${list.selectedDates.includes(date)?'active':''}" data-v8-date="${date}">${esc(label)}</button>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:var(--space-3)">
        <button class="preply-filter ${ui.shoppingView==='category'?'active':''}" data-v8-view="category">Kategorie</button>
        <button class="preply-filter ${ui.shoppingView==='recipe'?'active':''}" data-v8-view="recipe">Gericht</button>
        <button class="preply-outline" style="margin:0;flex:0;padding:8px 12px;font-size:11px;border-radius:var(--radius-full)" data-v8-copy>Liste kopieren</button>
      </div>
      ${content}
    </section>`;
    main.querySelectorAll('[data-v8-date]').forEach((button)=>button.addEventListener('click',()=>{ui.selectedDates=toggleShoppingDate(ui.selectedDates,button.dataset.v8Date,plan);renderShopping(root);}));
    main.querySelectorAll('[data-v8-view]').forEach((button)=>button.addEventListener('click',()=>{ui.shoppingView=button.dataset.v8View;renderShopping(root);}));
    main.querySelectorAll('[data-v8-check]').forEach((input)=>input.addEventListener('change',()=>{ui.checks[input.dataset.v8Check]=input.checked;}));
    main.querySelector('[data-v8-copy]')?.addEventListener('click',async(e)=>{await navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan,ui.selectedDates,ui.checks)));const btn=e.currentTarget;btn.textContent='Kopiert ✓';setTimeout(()=>{btn.textContent='Liste kopieren';},1500);});
  } catch(error){ main.innerHTML=`<section class="v8-page preply-page"><div class="v8-status error">${esc(error.message)}</div></section>`; }
}

export async function initializeFeatureEnhancements() {
  try { ui.recipes=await loadCards(); } catch(error){ console.error('[Preply V8] Erweiterungskatalog',error); }
}

export async function refreshFeatureEnhancements(root) {
  if(getRoute()==='recipes') renderRecipes(root);
  if(getRoute()==='shopping') await renderShopping(root);
}
