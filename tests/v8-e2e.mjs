import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const ingredients = (protein) => [
  { name: protein, amount: 400, unit: 'g', category: 'Kühlung', pack_size: 400, pack_price_eur: 4.99 },
  { name: 'Reis', amount: 240, unit: 'g', category: 'Trockenwaren', pack_size: 1000, pack_price_eur: 2.49 },
  { name: 'Paprika', amount: 2, unit: 'Stk', category: 'Obst und Gemüse', pack_size: 3, pack_price_eur: 2.29 }
];

const rows = Array.from({ length: 24 }, (_, index) => {
  const categories = ['breakfast', 'lunch', 'dinner', 'snack'];
  const category = categories[index % categories.length];
  const protein = category === 'breakfast' ? 'Skyr' : category === 'snack' ? 'Erdnussmus' : index % 2 ? 'Tofu' : 'Hähnchenbrust';
  return {
    id: `e2e-${index}`, source: 'e2e', code: `E2E-${index}`,
    name: `${protein} ${category} ${index}`, cat: category,
    kcal: category === 'snack' ? 330 + index : category === 'breakfast' ? 430 + index : 580 + index,
    protein: category === 'snack' ? 14 + index : category === 'breakfast' ? 28 + index : 34 + index,
    carbs: 55, fat: 16, time: 12 + (index % 5) * 5, servings: 2,
    difficulty: index % 3 ? 'easy' : 'medium',
    tags: ['high_protein', index % 2 ? 'international' : 'quick'],
    allergens: protein === 'Skyr' ? ['milk'] : [],
    diet_tags: protein === 'Tofu' || protein === 'Erdnussmus' ? ['vegan'] : [],
    ingredients: ingredients(protein),
    steps: ['Zutaten vorbereiten.', 'Alles garen und abschmecken.'],
    classification: {
      dish_type: category,
      meal_prep_score_v2: 4,
      novelty_level: index % 2 ? 2 : 1,
      cost_band: 'budget',
      protein_sources: [protein],
      dietary_style: protein === 'Tofu' || protein === 'Erdnussmus' ? 'vegan' : 'omnivore'
    },
    quality_score: 96 - index / 10,
    is_plan_eligible: true
  };
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

await page.route('**/rest/v1/recipe_catalog_v1**', async (route) => {
  const url = new URL(route.request().url());
  const idFilter = url.searchParams.get('id');
  const response = idFilter?.startsWith('eq.') ? rows.filter((row) => row.id === idFilter.slice(3)) : rows;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(response) });
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
      version: 2, planningMode: 'simple', goal: 'maintain', calorieTarget: 2200, proteinTarget: 130,
      dietStyle: 'omnivore', allergies: [], excludedIngredients: [], excludedRecipes: [], persons: 1,
      enabledMeals: { breakfast: true, lunch: true, dinner: true, snack: false },
      cookingStyle: 'mixed', prepDays: 2, maxCookingTime: 45,
      simplicity: 'simple', priorities: ['high_protein', 'quick', 'meal_prep']
    },
    preferences: { favoriteRecipeIds: [], excludedRecipeIds: [], excludedIngredients: [], rejectionReasons: {} }
  }));
});

await page.goto('http://127.0.0.1:4173/v8/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.PreplyV8));
await page.locator('[data-action="create-plan"]').first().waitFor();

/* Plan for six dates and two meal slots. */
await page.locator('[data-action="create-plan"]').first().click();
await page.getByRole('heading', { name: 'Welche Tage und Mahlzeiten?' }).waitFor();
await page.getByRole('button', { name: '5 Tage' }).click();
await page.locator('[data-plan-add-date]').click();
await page.locator('[data-plan-meal="breakfast"]').click();
await page.getByRole('button', { name: 'Plan erstellen', exact: true }).click();
await page.locator('.preply-plan-card').waitFor();
assert.equal(await page.locator('.preply-day').count(), 6);

let savedState = await page.evaluate(() => window.PreplyV8.getState());
assert.equal(savedState.currentPlan.selectedDates.length, 6);
assert.deepEqual([...savedState.currentPlan.enabledMeals].sort(), ['dinner', 'lunch']);
assert.equal(savedState.currentPlan.days.every((day) => Object.keys(day.meals).length === 2), true);

/* Selected-day navigation renders the requested day. */
await page.locator('.preply-day').nth(1).click();
assert.equal(await page.locator('.preply-day.active').getAttribute('data-plan-day'), savedState.currentPlan.selectedDates[1]);

/* Replace one meal without changing the next day. */
const originalFirstLunchId = savedState.currentPlan.days[0].meals.lunch.recipeId;
const untouchedSecondLunchId = savedState.currentPlan.days[1].meals.lunch.recipeId;
await page.locator('.preply-day').first().click();
await page.locator('[data-swap-meal][data-swap-day="0"][data-swap-cat="lunch"]').first().click();
await page.getByRole('heading', { name: savedState.currentPlan.days[0].meals.lunch.recipe.name }).waitFor();
await page.getByRole('button', { name: 'Schneller' }).click();
await page.getByRole('button', { name: 'Ähnlich' }).click();
assert.ok((await page.locator('[data-pick-replacement]').count()) > 0);
await page.locator('[data-pick-replacement]').first().click();
await page.waitForTimeout(150);
savedState = await page.evaluate(() => window.PreplyV8.getState());
assert.notEqual(savedState.currentPlan.days[0].meals.lunch.recipeId, originalFirstLunchId);
assert.equal(savedState.currentPlan.days[1].meals.lunch.recipeId, untouchedSecondLunchId);

/* Recipes: category, search, favorite and advanced filters. */
await page.locator('a[href="#recipes"]').click();
await page.getByRole('heading', { name: 'Rezepte' }).waitFor();
assert.ok((await page.locator('.master-foryou-card').count()) > 0);
assert.ok((await page.locator('.master-recipe-row').count()) > 0);
await page.locator('[data-chip="category"][data-value="dinner"]').click();
assert.ok((await page.locator('.master-recipe-row').count()) > 0);
await page.locator('[data-v8-favorite]').first().click();
savedState = await page.evaluate(() => window.PreplyV8.getState());
assert.equal(savedState.preferences.favoriteRecipeIds.length, 1);
await page.locator('[data-open-filters]').first().click();
await page.getByRole('heading', { name: 'Alle Filter' }).waitFor();
await page.getByRole('button', { name: 'Bis 30 Min.' }).click();
await page.getByRole('button', { name: 'Filter anwenden' }).click();

/* Shopping: day scope, grouping and persistent checks. */
await page.locator('a[href="#shopping"]').click();
await page.getByRole('heading', { name: 'Einkauf' }).waitFor();
assert.equal(await page.locator('[data-v8-date]').count(), 6);
assert.ok((await page.locator('[data-v8-check]').count()) > 0);
const before = await page.locator('[data-v8-check]').count();
await page.locator('[data-v8-date]').first().click();
await page.waitForTimeout(150);
assert.ok((await page.locator('[data-v8-check]').count()) <= before);
await page.locator('[data-v8-check]').first().click();
await page.waitForTimeout(100);
savedState = await page.evaluate(() => window.PreplyV8.getState());
assert.equal(Object.values(savedState.shoppingChecks).some(Boolean), true);
await page.getByRole('button', { name: 'Gericht' }).click();
assert.ok((await page.locator('.master-shopping-group').count()) > 0);

/* Profile remains accessible only from the header. */
assert.equal(await page.locator('.v8-nav a[href="#profile"]').count(), 0);
await page.locator('.v8-header-action').click();
await page.getByRole('heading', { name: 'Deine Einstellungen' }).waitFor();

assert.deepEqual(errors, [], `Browserfehler: ${errors.join(' | ')}`);
await browser.close();
console.log('V8 Chromium E2E erfolgreich.');
