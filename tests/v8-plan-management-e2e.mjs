import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const ingredients = (name) => [{ name, amount: 300, unit: 'g', category: 'Kühlung' }];
const rows = Array.from({ length: 30 }, (_, index) => {
  const category = index % 2 ? 'lunch' : 'dinner';
  return {
    id: `manage-${index}`, source: 'e2e', code: `M-${index}`,
    name: `Gericht ${index}`, cat: category, kcal: 560 + index,
    protein: 30 + index, carbs: 50, fat: 15, time: 15 + index,
    servings: 2, difficulty: index % 3 ? 'easy' : 'medium',
    tags: ['high_protein', 'quick'], allergens: [], diet_tags: [],
    ingredients: ingredients(`Zutat ${index}`), steps: ['Zubereiten.'],
    classification: { dish_type: 'bowl', meal_prep_score_v2: 3, novelty_level: 1, cost_band: 'budget', dietary_style: 'omnivore' },
    quality_score: 95, is_plan_eligible: true
  };
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/rest/v1/recipe_catalog_v1**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
await page.addInitScript(() => localStorage.setItem('preply_v8_state_v1', JSON.stringify({
  schemaVersion: 10, onboardingCompleted: true, currentPlan: null, planHistory: [],
  profile: { version: 2, planningMode: 'simple', goal: 'maintain', calorieTarget: 2200, proteinTarget: 130, dietStyle: 'omnivore', allergies: [], excludedIngredients: [], excludedRecipes: [], persons: 1, enabledMeals: { breakfast: false, lunch: true, dinner: true, snack: false }, cookingStyle: 'mixed', prepDays: 2, maxCookingTime: 60, simplicity: 'simple', priorities: ['high_protein', 'quick'] },
  preferences: { favoriteRecipeIds: [], excludedRecipeIds: [], excludedIngredients: [], rejectionReasons: {} }
})));

await page.goto('http://127.0.0.1:4173/v8/');
await page.getByText('30 geprüfte Rezepte geladen.').waitFor();
await page.getByRole('button', { name: /Essensplan erstellen/ }).click();
await page.getByRole('button', { name: 'Plan erstellen', exact: true }).click();
await page.getByText('Dein Plan').waitFor();
await page.locator('[data-plan-menu]').waitFor();

let state = await page.evaluate(() => JSON.parse(localStorage.getItem('preply_v8_state_v1')));
const firstBefore = state.currentPlan.days[0].meals.lunch.recipe.id;
const secondBefore = state.currentPlan.days[1].meals.lunch.recipe.id;

await page.locator('[data-plan-menu]').click();
await page.getByRole('heading', { name: 'Neu zusammenstellen' }).waitFor();
await page.locator('[data-regenerate-day]').click();
await page.getByRole('button', { name: 'Diesen Tag erneuern' }).click();
await page.waitForTimeout(300);
state = await page.evaluate(() => JSON.parse(localStorage.getItem('preply_v8_state_v1')));
assert.notEqual(state.currentPlan.days[0].meals.lunch.recipe.id, firstBefore);
assert.equal(state.currentPlan.days[1].meals.lunch.recipe.id, secondBefore);

const planIdsBefore = state.currentPlan.days.flatMap((day) => Object.values(day.meals).map((meal) => meal.recipe.id));
await page.locator('[data-plan-menu]').click();
await page.locator('[data-regenerate-plan]').click();
await page.getByRole('button', { name: 'Gesamten Plan erneuern' }).click();
await page.waitForTimeout(300);
state = await page.evaluate(() => JSON.parse(localStorage.getItem('preply_v8_state_v1')));
const planIdsAfter = state.currentPlan.days.flatMap((day) => Object.values(day.meals).map((meal) => meal.recipe.id));
assert.notDeepEqual(planIdsAfter, planIdsBefore);
assert.equal(state.currentPlan.selectedDates.length, 3);
assert.equal(state.planHistory.length, 1);

await page.evaluate(() => window.PreplyV8.updateState((current) => ({ ...current, profile: { ...current.profile, maxCookingTime: 25 } })));
await page.getByRole('heading', { name: 'Dein Profil wurde geändert.' }).waitFor();
await page.getByRole('button', { name: /Plan behalten/ }).click();
assert.equal(await page.getByRole('heading', { name: 'Dein Profil wurde geändert.' }).count(), 0);
assert.deepEqual(errors, []);
await browser.close();
console.log('V8 Planverwaltung E2E erfolgreich.');
