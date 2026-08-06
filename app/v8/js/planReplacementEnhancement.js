import { getRoute } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { loadCards } from './data/recipeStore.js';
import { replacementSuggestions } from './features/planner/plannerEngine.js';
const MODE_LABELS = Object.freeze({
  similar: 'Ähnlich',
  faster: 'Schneller',
  simpler: 'Einfacher',
  protein: 'Proteinreicher',
  favorites: 'Gespeichert'
});

let recipes = null;
let activeSelection = null;
let activeMode = 'similar';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

async function getRecipes() {
  if (!recipes) recipes = await loadCards();
  return recipes;
}

function mealAt(plan, dayIndex, category) {
  return plan?.days?.[dayIndex]?.meals?.[category] || null;
}

function usedRecipeIds(plan) {
  return new Set((plan?.days || []).flatMap((day) =>
    Object.values(day.meals || {}).map((meal) => meal.recipeId || meal.recipe?.id).filter(Boolean)
  ));
}

function currentSuggestions() {
  const state = getState();
  const plan = state.currentPlan;
  const currentMeal = mealAt(plan, activeSelection?.dayIndex, activeSelection?.category);
  if (!currentMeal || !recipes) return [];
  return replacementSuggestions(recipes, currentMeal.recipe, {
    profile: state.profile,
    preferences: state.preferences,
    usedRecipeIds: usedRecipeIds(plan),
    usedFamilies: new Set()
  }, activeMode, 10);
}

function renderDialog(root) {
  root.querySelector('[data-replacement-overlay]')?.remove();
  if (!activeSelection) return;
  const state = getState();
  const meal = mealAt(state.currentPlan, activeSelection.dayIndex, activeSelection.category);
  if (!meal) return;

  const suggestions = currentSuggestions();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay';
  overlay.dataset.replacementOverlay = 'true';
  overlay.innerHTML = `<section class="v8-dialog" role="dialog" aria-modal="true" aria-labelledby="replacement-title">
    <p class="eyebrow">Gericht austauschen</p>
    <h2 id="replacement-title">${escapeHtml(meal.recipe.name)}</h2>
    <div class="v8-actions" style="margin:16px 0">${Object.entries(MODE_LABELS).map(([mode, label]) => `<button class="v8-button ${activeMode === mode ? 'primary' : ''}" data-replacement-mode="${mode}">${label}</button>`).join('')}</div>
    <div class="v8-grid" data-replacement-results>${suggestions.length ? suggestions.map((recipe) => `<article class="recipe-card">
      <div><p class="eyebrow">${escapeHtml(MODE_LABELS[activeMode])}</p><h3>${escapeHtml(recipe.name)}</h3></div>
      <div class="recipe-meta"><span>${Math.round(recipe.kcal)} kcal</span><span>${Math.round(recipe.protein)} g Protein</span><span>${Math.round(recipe.time)} Min.</span></div>
      <button class="v8-button primary" data-replacement-recipe="${escapeHtml(recipe.id)}">Übernehmen</button>
    </article>`).join('') : '<div class="empty-state">Für diesen Modus gibt es aktuell keine passende Alternative.</div>'}</div>
    <div class="v8-actions" style="margin-top:18px"><button class="v8-button ghost" data-replacement-close>Abbrechen</button></div>
  </section>`;
  root.appendChild(overlay);

  overlay.querySelectorAll('[data-replacement-mode]').forEach((button) => button.addEventListener('click', () => {
    activeMode = button.dataset.replacementMode;
    renderDialog(root);
  }));
  overlay.querySelector('[data-replacement-close]')?.addEventListener('click', () => {
    activeSelection = null;
    renderDialog(root);
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      activeSelection = null;
      renderDialog(root);
    }
  });
  overlay.querySelectorAll('[data-replacement-recipe]').forEach((button) => button.addEventListener('click', () => {
    const replacement = recipes.find((recipe) => recipe.id === button.dataset.replacementRecipe);
    if (!replacement) return;
    updateState((current) => {
      const plan = structuredClone(current.currentPlan);
      const target = plan.days[activeSelection.dayIndex].meals[activeSelection.category];
      const factor = Number(target.portionFactor || 1);
      plan.days[activeSelection.dayIndex].meals[activeSelection.category] = {
        ...target,
        recipeId: replacement.id,
        recipe: replacement,
        prepGroupId: null,
        prepSourceDate: null,
        repeatedForMealPrep: false,
        estimatedKcalPerPerson: Math.round(replacement.kcal * factor),
        estimatedProteinPerPerson: Math.round(replacement.protein * factor),
        replacedAt: new Date().toISOString()
      };
      return { ...current, currentPlan: plan };
    });
    activeSelection = null;
  }));
}

function enhanceMealRows(root) {
  const state = getState();
  const plan = state.currentPlan;
  if (!plan || getRoute() !== 'plan') return;
  const dayNodes = [...root.querySelectorAll('.plan-day')];
  dayNodes.forEach((dayNode, dayIndex) => {
    const categories = Object.keys(plan.days?.[dayIndex]?.meals || {});
    const rows = [...dayNode.querySelectorAll('.meal-row')];
    rows.forEach((row, rowIndex) => {
      const category = categories[rowIndex];
      if (!category || row.querySelector('[data-replace-meal]')) return;
      const content = row.lastElementChild;
      if (!content) return;
      const button = document.createElement('button');
      button.className = 'v8-button ghost';
      button.type = 'button';
      button.dataset.replaceMeal = 'true';
      button.dataset.dayIndex = String(dayIndex);
      button.dataset.category = category;
      button.textContent = 'Austauschen';
      button.style.marginTop = '8px';
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Lade Alternativen …';
        try {
          await getRecipes();
          activeSelection = { dayIndex, category };
          activeMode = 'similar';
          renderDialog(root);
        } finally {
          button.disabled = false;
          button.textContent = 'Austauschen';
        }
      });
      content.appendChild(button);
    });
  });
}

export async function refreshPlanReplacementEnhancement(root) {
  if (getRoute() !== 'plan') {
    activeSelection = null;
    root.querySelector('[data-replacement-overlay]')?.remove();
    return;
  }
  enhanceMealRows(root);
  if (activeSelection) renderDialog(root);
}
