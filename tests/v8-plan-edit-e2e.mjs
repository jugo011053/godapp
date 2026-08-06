import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const categories = ['breakfast', 'lunch', 'dinner', 'snack'];
const rows = categories.flatMap((category) => Array.from({ length: 8 }, (_, index) => ({
  id: `${category}-${index}`,
  source: 'plan-edit-e2e',
  code: `PE-${category}-${index}`,
  name: `${category} Gericht ${index}`,
  cat: category,
  kcal: 430 + index * 22,
  protein: 24 + index * 3,
  carbs: 50,
  fat: 15,
  time: 15 + index * 3,
  servings: 2,
  difficulty: index % 2 ? 'easy' : 'medium',
  tags: ['high_protein', 'quick'],
  allergens: [],
  diet_tags: [],
  ingredients: [{ name: `Zutat ${category} ${index}`, amount: 200, unit: 'g', category: 'Gemüse' }],
  steps: ['Zubereiten.'],
  classification: {
    dish_type: category,
    meal_prep_score_v2: 3,
    novelty_level: index % 3,
    cost_band: 'budget',
    dietary_style: 'omnivore'
  },
  quality_score: 95 - index,
  is_plan_eligible: true
})));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.route('**/rest/v1/recipe_catalog_v1**', async (route) => {
  const url = new URL(route.request().url());
  const idFilter = url.searchParams.get('id');
  const response = idFilter?.startsWith('eq.') ? rows.filter((row) => row.id === idFilter.slice(3)) : rows;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
});

await page.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('preply_v8_state_v1', JSON.stringify({
    schemaVersion: 10,
    onboardingCompleted: true,
    currentPlan: null,
    planHistory: [],
    shoppingChecks: {},
    profile: {
      version: 2,
      planningMode: 'simple',
      goal: 'maintain',
      calorieTarget: 2200,
      proteinTarget: 130,
      dietStyle: 'omnivore',
      allergies: [],
      excludedIngredients: [],
      excludedRecipes: [],
      persons: 1,
      enabledMeals: { breakfast: false, lunch: true, dinner: true, snack: false },
      cookingStyle: 'mixed',
      prepDays: 2,
      maxCookingTime: 60,
      simplicity: 'simple',
      priorities: ['high_protein', 'quick']
    },
    preferences: { favoriteRecipeIds: [], excludedRecipeIds: [], excludedIngredients: [], rejectionReasons: {} }
  }));
});

await page.goto('http://127.0.0.1:4173/v8/');
await page.waitForFunction(() => Boolean(window.PreplyV8));
await page.locator('[data-action="create-plan"]').first().click();
await page.getByRole('button', { name: 'Plan erstellen', exact: true }).click();
await page.locator('.preply-plan-card').waitFor();

let state = await page.evaluate(() => window.PreplyV8.getState());
const retainedDate = state.currentPlan.selectedDates[0];
const retainedLunch = state.currentPlan.days[0].meals.lunch.recipeId;

await page.locator('[data-plan-menu]').click();
await page.locator('[data-edit-plan]').click();
await page.getByRole('heading', { name: 'Plan bearbeiten' }).waitFor();
await page.locator('[data-editor-preset="5"]').click();
await page.locator('[data-editor-meal="snack"]').click();
await page.locator('[data-editor-persons]').fill('2');
await page.locator('[data-editor-save]').click();
await page.locator('.preply-plan-card').waitFor();
await page.waitForTimeout(200);

state = await page.evaluate(() => window.PreplyV8.getState());
assert.equal(state.currentPlan.selectedDates.length, 5);
assert.equal(state.currentPlan.selectedDates[0], retainedDate);
assert.equal(state.currentPlan.enabledMeals.includes('snack'), true);
assert.equal(state.currentPlan.days.every((day) => day.meals.snack), true);
assert.equal(state.profile.persons, 2);
assert.equal(state.currentPlan.days[0].meals.lunch.recipeId, retainedLunch);
assert.equal(state.currentPlan.days[0].meals.lunch.persons, 2);
assert.equal(state.planHistory.length, 1);
assert.equal(await page.getByRole('heading', { name: 'Dein Profil wurde geändert.' }).count(), 0);
assert.deepEqual(errors, []);

await browser.close();
console.log('V8 Planbearbeitung E2E erfolgreich.');
