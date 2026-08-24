import { getRoute } from './core/router.js';
import { getState, updateState } from './core/store.js';
import { loadCards } from './data/recipeStore.js';
import { restoreRecipe } from './features/favorites/preferenceSignals.js';

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const LABELS = {
  goal: { lose: 'Abnehmen', maintain: 'Gewicht halten', gain: 'Zunehmen' },
  diet: { omnivore: 'Mischkost', vegetarian: 'Vegetarisch', vegan: 'Vegan', pescatarian: 'Pescetarisch', halal: 'Halal' },
  cooking: { simple: 'Einfach', mixed: 'Ausgewogen', ambitious: 'Abwechslungsreich' },
  meals: { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack' }
};

let recipes = [];

function closeOverlay(overlay) {
  overlay?.remove();
}

function appendSheet(root, content) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-menu-overlay';
  overlay.innerHTML = content;
  root.appendChild(overlay);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay);
  });
  overlay.querySelectorAll('[data-sheet-close]').forEach((button) => button.addEventListener('click', () => closeOverlay(overlay)));
  return overlay;
}

function mealSummary(profile) {
  return Object.entries(profile.enabledMeals || {})
    .filter(([, enabled]) => enabled)
    .map(([meal]) => LABELS.meals[meal] || meal)
    .join(', ') || 'Keine';
}

function renderProfile(root) {
  if (getRoute() !== 'profile') return;
  const main = root.querySelector('.v8-main');
  if (!main) return;

  const state = getState();
  const profile = state.profile || {};
  const excludedCount = (state.preferences?.excludedRecipeIds || []).length;
  const excludedIngredients = profile.excludedIngredients || state.preferences?.excludedIngredients || [];

  main.innerHTML = `<section class="v8-page preply-page">
    <div class="master-profile-intro">
      <h1>Profil</h1>
      <p>Deine Angaben steuern Planung, Portionen und Empfehlungen.</p>
    </div>

    <div class="master-profile-summary">
      <div class="master-profile-stat dark"><small>Kalorienziel</small><strong>${Math.round(profile.calorieTarget || 2000)} kcal</strong></div>
      <div class="master-profile-stat dark"><small>Proteinziel</small><strong>${Math.round(profile.proteinTarget || 120)} g</strong></div>
      <div class="master-profile-stat"><small>Personen</small><strong>${Math.max(1, Number(profile.persons || 1))}</strong></div>
      <div class="master-profile-stat"><small>Kochzeit</small><strong>${Math.round(profile.maxCookingTime || 0)} Min.</strong></div>
    </div>

    <section class="master-profile-section">
      <h2>Planung</h2>
      <div class="master-profile-row"><span>Ziel</span><strong>${esc(LABELS.goal[profile.goal] || profile.goal || 'Nicht festgelegt')}</strong></div>
      <div class="master-profile-row"><span>Ernährungsweise</span><strong>${esc(LABELS.diet[profile.dietStyle] || profile.dietStyle || 'Nicht festgelegt')}</strong></div>
      <div class="master-profile-row"><span>Kochstil</span><strong>${esc(LABELS.cooking[profile.cookingStyle] || profile.cookingStyle || 'Nicht festgelegt')}</strong></div>
      <div class="master-profile-row"><span>Mahlzeiten</span><strong>${esc(mealSummary(profile))}</strong></div>
    </section>

    <section class="master-profile-section">
      <h2>Ausschlüsse</h2>
      <div class="master-profile-row"><span>Zutaten</span><strong>${excludedIngredients.length ? esc(excludedIngredients.join(', ')) : 'Keine'}</strong></div>
      <button class="master-profile-row action" type="button" data-manage-excluded><span>Ausgeblendete Rezepte</span><strong>${excludedCount || 'Keine'}</strong></button>
    </section>

    <button class="master-profile-edit-button" type="button" data-edit-profile>Profil bearbeiten</button>
  </section>`;

  main.querySelector('[data-edit-profile]').addEventListener('click', () => openProfileEditor(root));
  main.querySelector('[data-manage-excluded]').addEventListener('click', () => openExcludedRecipes(root));
}

function option(value, label, current) {
  return `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`;
}

function openProfileEditor(root) {
  const profile = structuredClone(getState().profile || {});
  const enabledMeals = { breakfast: false, lunch: false, dinner: false, snack: false, ...(profile.enabledMeals || {}) };
  const overlay = appendSheet(root, `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
    <div class="sheet-head"><h2 id="profile-edit-title">Profil bearbeiten</h2><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
    <form class="master-profile-form" data-profile-form>
      <div class="master-form-grid">
        <div class="master-form-field"><label for="profile-persons">Personen</label><input id="profile-persons" name="persons" type="number" min="1" max="12" value="${Math.max(1, Number(profile.persons || 1))}"></div>
        <div class="master-form-field"><label for="profile-time">Kochzeit</label><input id="profile-time" name="maxCookingTime" type="number" min="5" max="240" value="${Math.round(profile.maxCookingTime || 45)}"></div>
        <div class="master-form-field"><label for="profile-kcal">Kalorienziel</label><input id="profile-kcal" name="calorieTarget" type="number" min="800" max="6000" value="${Math.round(profile.calorieTarget || 2200)}"></div>
        <div class="master-form-field"><label for="profile-protein">Proteinziel</label><input id="profile-protein" name="proteinTarget" type="number" min="20" max="400" value="${Math.round(profile.proteinTarget || 130)}"></div>
      </div>

      <div class="master-form-grid">
        <div class="master-form-field"><label for="profile-goal">Ziel</label><select id="profile-goal" name="goal">${Object.entries(LABELS.goal).map(([value, label]) => option(value, label, profile.goal)).join('')}</select></div>
        <div class="master-form-field"><label for="profile-diet">Ernährungsweise</label><select id="profile-diet" name="dietStyle">${Object.entries(LABELS.diet).map(([value, label]) => option(value, label, profile.dietStyle)).join('')}</select></div>
      </div>

      <div class="master-form-field"><label for="profile-cooking">Kochstil</label><select id="profile-cooking" name="cookingStyle">${Object.entries(LABELS.cooking).map(([value, label]) => option(value, label, profile.cookingStyle)).join('')}</select></div>

      <fieldset class="master-form-group">
        <legend>Mahlzeiten</legend>
        <div class="master-meal-options">
          ${Object.entries(LABELS.meals).map(([meal, label]) => `<button class="master-meal-option ${enabledMeals[meal] ? 'active' : ''}" type="button" data-profile-meal="${meal}" aria-pressed="${enabledMeals[meal]}">${label}</button>`).join('')}
        </div>
      </fieldset>

      <div class="master-form-field"><label for="profile-excluded">Ausgeschlossene Zutaten</label><textarea id="profile-excluded" name="excludedIngredients" placeholder="Zum Beispiel Sellerie, Erdnüsse">${esc((profile.excludedIngredients || []).join(', '))}</textarea></div>
      <button class="sheet-action primary" type="submit">Speichern</button>
    </form>
  </section>`);

  overlay.querySelectorAll('[data-profile-meal]').forEach((button) => button.addEventListener('click', () => {
    const meal = button.dataset.profileMeal;
    enabledMeals[meal] = !enabledMeals[meal];
    button.classList.toggle('active', enabledMeals[meal]);
    button.setAttribute('aria-pressed', String(enabledMeals[meal]));
  }));

  overlay.querySelector('[data-profile-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!Object.values(enabledMeals).some(Boolean)) return;
    const form = new FormData(event.currentTarget);
    const excludedIngredients = String(form.get('excludedIngredients') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    closeOverlay(overlay);
    updateState((state) => ({
      ...state,
      profile: {
        ...state.profile,
        persons: Math.max(1, Number(form.get('persons') || 1)),
        maxCookingTime: Math.max(5, Number(form.get('maxCookingTime') || 45)),
        calorieTarget: Math.max(800, Number(form.get('calorieTarget') || 2200)),
        proteinTarget: Math.max(20, Number(form.get('proteinTarget') || 130)),
        goal: String(form.get('goal') || 'maintain'),
        dietStyle: String(form.get('dietStyle') || 'omnivore'),
        cookingStyle: String(form.get('cookingStyle') || 'mixed'),
        enabledMeals,
        excludedIngredients
      },
      preferences: {
        ...state.preferences,
        excludedIngredients
      }
    }));
  });
}

async function openExcludedRecipes(root) {
  const ids = getState().preferences?.excludedRecipeIds || [];
  if (!recipes.length) {
    try { recipes = await loadCards(); } catch { recipes = []; }
  }
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const overlay = appendSheet(root, `<section class="v8-dialog plan-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="excluded-title">
    <div class="sheet-head"><h2 id="excluded-title">Ausgeblendete Rezepte</h2><button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button></div>
    <div class="master-excluded-list">
      ${ids.length ? ids.map((id) => `<div class="master-excluded-row"><strong>${esc(byId.get(id)?.name || id)}</strong><button type="button" data-restore-recipe="${esc(id)}">Wieder anzeigen</button></div>`).join('') : '<p class="master-empty">Du hast keine Rezepte ausgeblendet.</p>'}
    </div>
  </section>`);

  overlay.querySelectorAll('[data-restore-recipe]').forEach((button) => button.addEventListener('click', () => {
    updateState((state) => ({ ...state, preferences: restoreRecipe(state.preferences || {}, button.dataset.restoreRecipe) }));
    closeOverlay(overlay);
  }));
}

export function refreshProfileMaster(root) {
  renderProfile(root);
}
