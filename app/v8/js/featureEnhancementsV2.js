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

function select(name, label, options, selected = '') {
  return `<label class="form-field"><span>${label}</span><select data-v8-filter="${name}"><option value="">Alle</option>${options.map(([value,text]) => `<option value="${value}" ${String(selected)===value?'selected':''}>${text}</option>`).join('')}</select></label>`;
}

function recipeCard(recipe, preferences) {
  const favorite = (preferences.favoriteRecipeIds || []).includes(recipe.id);
  const excluded = (preferences.excludedRecipeIds || []).includes(recipe.id);
  return `<article class="recipe-card"><div><p class="eyebrow">${esc(recipe.category)}</p><h3>${esc(recipe.name)}</h3></div><div class="recipe-meta"><span>${Math.round(recipe.kcal)} kcal</span><span>${Math.round(recipe.protein)} g Protein</span><span>${Math.round(recipe.time)} Min.</span><span>${esc(recipe.simplicity)}</span></div><div class="v8-actions"><button class="v8-button ${favorite?'primary':''}" data-v8-favorite="${esc(recipe.id)}">${favorite?'Gespeichert':'Speichern'}</button><button class="v8-button ghost" data-v8-exclude="${esc(recipe.id)}">${excluded?'Wieder zulassen':'Nicht vorschlagen'}</button><button class="v8-button ghost" data-v8-detail="${esc(recipe.id)}">Details</button></div></article>`;
}

function renderRecipes(root) {
  const main = root.querySelector('.v8-main');
  if (!main || !ui.recipes.length) return;
  const state = getState();
  const results = sortRecipes(filterRecipes(ui.recipes, ui.filters, state.preferences), ui.sort, state.preferences);
  main.innerHTML = `<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Rezepte</p><h1>Für dich und alle Rezepte</h1></div><p>${results.length} passende Gerichte</p></div><div class="v8-panel"><div class="form-grid"><label class="form-field"><span>Suche</span><input type="search" data-v8-filter="query" value="${esc(ui.filters.query)}" placeholder="Name, Zutat oder Tag"></label>${select('category','Mahlzeit',[['breakfast','Frühstück'],['lunch','Mittagessen'],['dinner','Abendessen'],['snack','Snack']],ui.filters.category)}${select('maxTime','Zeit',[['15','15 Min.'],['30','30 Min.'],['45','45 Min.'],['60','60 Min.']],ui.filters.maxTime || '')}${select('simplicity','Stil',[['simple','Simpel'],['balanced','Ausgewogen'],['experimental','Experimentell']],ui.filters.simplicity)}${select('diet','Ernährung',[['vegetarian','Vegetarisch'],['vegan','Vegan'],['pescatarian','Pescetarisch']],ui.filters.diet)}${select('minProtein','Protein',[['20','ab 20 g'],['30','ab 30 g'],['40','ab 40 g']],ui.filters.minProtein || '')}<label class="form-field"><span>Sortierung</span><select data-v8-sort><option value="recommended">Empfohlen</option><option value="quick" ${ui.sort==='quick'?'selected':''}>Schnell</option><option value="protein" ${ui.sort==='protein'?'selected':''}>Protein</option><option value="meal_prep" ${ui.sort==='meal_prep'?'selected':''}>Meal Prep</option></select></label></div><div class="v8-actions" style="margin-top:12px"><button class="v8-button ${ui.filters.favoritesOnly?'primary':''}" data-v8-favorites-only>Nur Favoriten</button><button class="v8-button ghost" data-v8-reset>Zurücksetzen</button></div></div><div class="v8-grid">${results.slice(0,120).map((recipe) => recipeCard(recipe,state.preferences)).join('') || '<div class="empty-state">Keine Treffer.</div>'}</div></section>`;
  bindRecipeEvents(root);
}

function bindRecipeEvents(root) {
  root.querySelectorAll('[data-v8-filter]').forEach((node) => node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', () => {
    const key = node.dataset.v8Filter;
    ui.filters = { ...ui.filters, [key]: ['maxTime','minProtein'].includes(key) ? (node.value ? Number(node.value) : null) : node.value };
    renderRecipes(root);
  }));
  root.querySelector('[data-v8-sort]')?.addEventListener('change', (event) => { ui.sort = event.target.value; renderRecipes(root); });
  root.querySelector('[data-v8-favorites-only]')?.addEventListener('click', () => { ui.filters.favoritesOnly = !ui.filters.favoritesOnly; renderRecipes(root); });
  root.querySelector('[data-v8-reset]')?.addEventListener('click', () => { ui.filters = createDefaultFilters(); renderRecipes(root); });
  root.querySelectorAll('[data-v8-favorite]').forEach((button) => button.addEventListener('click', () => updateState((state) => ({ ...state, preferences: toggleFavorite(state.preferences,button.dataset.v8Favorite) }))));
  root.querySelectorAll('[data-v8-exclude]').forEach((button) => button.addEventListener('click', () => updateState((state) => { const id=button.dataset.v8Exclude; return { ...state, preferences:(state.preferences.excludedRecipeIds||[]).includes(id)?restoreRecipe(state.preferences,id):excludeRecipe(state.preferences,id,[]) }; })));
  root.querySelectorAll('[data-v8-detail]').forEach((button) => button.addEventListener('click', () => showDetail(root,button.dataset.v8Detail)));
}

async function showDetail(root,id) {
  try {
    let recipe=ui.details.get(id); if(!recipe){ recipe=await getRecipe(id); ui.details.set(id,recipe); }
    const overlay=document.createElement('div'); overlay.className='v8-overlay';
    const stepsHtml = (recipe.steps||[]).length ? `<ol>${recipe.steps.map((step)=>`<li>${esc(step)}</li>`).join('')}</ol>` : '<p style="color:var(--muted);font-size:var(--text-sm)">Keine Zubereitungsschritte hinterlegt.</p>';
    overlay.innerHTML=`<section class="v8-dialog"><button class="v8-button ghost" data-v8-close>Schließen</button><h2>${esc(recipe.name)}</h2><div class="recipe-meta"><span>${recipe.kcal} kcal</span><span>${recipe.protein} g Protein</span><span>${recipe.time} Min.</span></div><h3>Zutaten</h3><ul>${(recipe.ingredients||[]).map((item)=>`<li>${esc(item.amount ?? item.quantity)} ${esc(item.unit)} ${esc(item.name)}</li>`).join('')}</ul><h3>Zubereitung</h3>${stepsHtml}</section>`;
    root.appendChild(overlay); overlay.querySelector('[data-v8-close]').addEventListener('click',()=>overlay.remove());
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
  main.innerHTML='<section class="v8-page"><div class="v8-status">Zutaten werden geladen …</div></section>';
  try {
    const plan=await detailedPlan(state.currentPlan);
    if(!ui.selectedDates.length) ui.selectedDates=plan.selectedDates||plan.days.map((day)=>day.date);
    const list=buildShoppingList(plan,ui.selectedDates,ui.checks);
    const fmtAmt = (item) => { const amt = item.packs ? item.buyAmount : item.amount; const unit = item.buyUnit || item.unit; const packInfo = item.packs ? ` (${item.packs}× ${item.buyAmount} ${esc(item.buyUnit || item.unit)})` : ''; return `${amt} ${esc(unit)}${packInfo}`; };
    const content=ui.shoppingView==='category' ? list.groups.map((group)=>`<section class="v8-panel"><h2>${esc(group.category)}</h2>${group.items.map((item)=>`<label class="meal-row"><input type="checkbox" data-v8-check="${esc(item.id)}" ${item.checked?'checked':''}><div><strong>${esc(item.name)}</strong> · ${fmtAmt(item)}<details><summary>Wofür?</summary>${item.sources.map((source)=>`<div>${esc(source.dayLabel)} · ${esc(source.recipeName)}: ${source.amount} ${esc(source.unit)}</div>`).join('')}</details></div></label>`).join('')}</section>`).join('') : list.byRecipe.map((group)=>`<section class="v8-panel"><h2>${esc(group.dayLabel)} · ${esc(group.recipeName)}</h2>${group.ingredients.map((item)=>`<div>${esc(item.name)}: ${item.amount} ${esc(item.unit)}</div>`).join('')}</section>`).join('');
    main.innerHTML=`<section class="v8-page"><div class="v8-page-head"><div><p class="eyebrow">Einkauf</p><h1>Einkaufsliste</h1></div><p>${list.items.length} Zutaten · ca. ${list.estimatedTotal.toFixed(2)} €</p></div><div class="v8-panel"><div class="day-chip-row">${list.availableDates.map(({date,label})=>`<button class="day-toggle ${list.selectedDates.includes(date)?'active':''}" data-v8-date="${date}">${esc(label)}</button>`).join('')}</div><div class="v8-actions" style="margin-top:12px"><button class="v8-button ${ui.shoppingView==='category'?'primary':''}" data-v8-view="category">Kategorie</button><button class="v8-button ${ui.shoppingView==='recipe'?'primary':''}" data-v8-view="recipe">Gericht</button><button class="v8-button ghost" data-v8-copy>Kopieren</button></div></div>${content}</section>`;
    main.querySelectorAll('[data-v8-date]').forEach((button)=>button.addEventListener('click',()=>{ui.selectedDates=toggleShoppingDate(ui.selectedDates,button.dataset.v8Date,plan);renderShopping(root);}));
    main.querySelectorAll('[data-v8-view]').forEach((button)=>button.addEventListener('click',()=>{ui.shoppingView=button.dataset.v8View;renderShopping(root);}));
    main.querySelectorAll('[data-v8-check]').forEach((input)=>input.addEventListener('change',()=>{ui.checks[input.dataset.v8Check]=input.checked;}));
    main.querySelector('[data-v8-copy]')?.addEventListener('click',async()=>navigator.clipboard.writeText(copyShoppingText(buildShoppingList(plan,ui.selectedDates,ui.checks))));
  } catch(error){ main.innerHTML=`<section class="v8-page"><div class="v8-status error">${esc(error.message)}</div></section>`; }
}

export async function initializeFeatureEnhancements() {
  try { ui.recipes=await loadCards(); } catch(error){ console.error('[Preply V8] Erweiterungskatalog',error); }
}

export async function refreshFeatureEnhancements(root) {
  if(getRoute()==='recipes') renderRecipes(root);
  if(getRoute()==='shopping') await renderShopping(root);
}
