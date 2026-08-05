import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const rows = Array.from({ length: 8 }, (_, index) => ({
  id: `cutover-${index}`, source: 'e2e', code: `C-${index}`,
  name: `Cutover Gericht ${index}`, cat: index % 2 ? 'lunch' : 'dinner',
  kcal: 550, protein: 32, carbs: 50, fat: 15, time: 20, servings: 2,
  difficulty: 'easy', tags: ['quick'], allergens: [], diet_tags: [],
  ingredients: [{ name: `Zutat ${index}`, amount: 200, unit: 'g', category: 'Kühlung' }],
  steps: ['Zubereiten.'], classification: { dish_type: 'bowl', meal_prep_score_v2: 2, novelty_level: 1, cost_band: 'budget', dietary_style: 'omnivore' },
  quality_score: 95, is_plan_eligible: true
}));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/rest/v1/recipe_catalog_v1**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
await page.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem('godapp6_7_1_state_v1', JSON.stringify({
    profile: { persons: 3, targetKcal: 2450, proteinTargetG: 155, maxCookingTime: 45, prepDays: 3, excludedIngredients: ['Sellerie'] },
    mealWeek: { incompatibleLegacyShape: true },
    favoriteRecipeIds: ['legacy-favorite'],
    excludedRecipeIds: ['legacy-hidden']
  }));
});

await page.goto('http://127.0.0.1:4173/');
await page.waitForURL((url) => url.pathname.endsWith('/v8/'));
await page.getByText('8 geprüfte Rezepte geladen.').waitFor();

const state = await page.evaluate(() => JSON.parse(localStorage.getItem('preply_v8_state_v1')));
assert.equal(state.profile.persons, 3);
assert.equal(state.profile.calorieTarget, 2450);
assert.equal(state.profile.proteinTarget, 155);
assert.equal(state.profile.maxCookingTime, 45);
assert.equal(state.profile.prepDays, 3);
assert.deepEqual(state.preferences.favoriteRecipeIds, ['legacy-favorite']);
assert.deepEqual(state.preferences.excludedRecipeIds, ['legacy-hidden']);
assert.equal(state.currentPlan, null);
assert.equal(state.migration.legacyPlanAvailable, true);
assert.ok(await page.evaluate(() => localStorage.getItem('preply_v7_backup_v1')));

const legacyResponse = await page.request.get('http://127.0.0.1:4173/legacy.html');
assert.equal(legacyResponse.status(), 200);
assert.match(await legacyResponse.text(), /Preply/);
assert.deepEqual(errors, [], `Browserfehler: ${errors.join(' | ')}`);

await browser.close();
console.log('V8 Root-Cutover E2E erfolgreich.');
