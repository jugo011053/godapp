import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const ingredients = (protein) => [
  { name: protein, amount: 400, unit: 'g', category: 'Kühlung', pack_size: 400, pack_price_eur: 4.99 },
  { name: 'Reis', amount: 240, unit: 'g', category: 'Trockenwaren', pack_size: 1000, pack_price_eur: 2.49 },
  { name: 'Paprika', amount: 2, unit: 'Stk', category: 'Obst und Gemüse', pack_size: 3, pack_price_eur: 2.29 }
];

const rows = Array.from({ length: 18 }, (_, index) => {
  const category = index % 3 === 0 ? 'breakfast' : index % 3 === 1 ? 'lunch' : 'dinner';
  const protein = category === 'breakfast' ? 'Skyr' : index % 2 ? 'Tofu' : 'Hähnchenbrust';
  return {
    id: `e2e-${index}`, source: 'e2e', code: `E2E-${index}`,
    name: `${protein} ${category} ${index}`, cat: category,
    kcal: category === 'breakfast' ? 430 : 620 + index,
    protein: category === 'breakfast' ? 28 : 42, carbs: 55, fat: 16,
    time: 20 + (index % 3) * 5, servings: 2, difficulty: 'easy',
    tags: ['high_protein', index % 2 ? 'international' : 'quick'],
    allergens: protein === 'Skyr' ? ['milk'] : [],
    diet_tags: protein === 'Tofu' ? ['vegan'] : [],
    ingredients: ingredients(protein),
    steps: ['Zutaten vorbereiten.', 'Alles garen und abschmecken.'],
    classification: {
      dish_type: category === 'breakfast' ? 'breakfast' : index % 2 ? 'bowl' : 'pfanne',
      meal_prep_score_v2: 4, novelty_level: index % 2 ? 2 : 1,
      cost_band: 'budget', protein_sources: [protein],
      dietary_style: protein === 'Tofu' ? 'vegan' : 'omnivore'
    },
    quality_score: 96, is_plan_eligible: true
  };
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('request', (request) => { if (request.url().includes('recipe_catalog_v1')) requests.push(request.url()); });

await page.route('**/rest/v1/recipe_catalog_v1**', async (route) => {
  const url = new URL(route.request().url());
  const idFilter = url.searchParams.get('id');
  const response = idFilter?.startsWith('eq.') ? rows.filter((row) => row.id === idFilter.slice(3)) : rows;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(response) });
});

await page.addInitScript(() => {
  localStorage.setItem('preply_v8_state_v1', JSON.stringify({
    schemaVersion: 10, onboardingCompleted: true, currentPlan: null, planHistory: [],
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
try {
  await page.getByText('18 geprüfte Rezepte geladen.').waitFor({ timeout: 10000 });
} catch (error) {
  console.error('Katalog-Requests:', requests);
  console.error('Browserfehler:', errors);
  console.error('Seitentext:', (await page.locator('body').innerText()).slice(0, 4000));
  throw error;
}

await page.getByRole('button', { name: /Was esse ich heute/ }).click();
assert.equal(await page.getByText('Drei Vorschläge für heute').count(), 1);
assert.equal(await page.locator('.recipe-card').count(), 3);

await page.getByRole('button', { name: /Essensplan erstellen/ }).click();
await page.getByText('Dein Plan').waitFor();
assert.ok((await page.locator('.plan-day').count()) >= 3);

await page.locator('a[href="#recipes"]').click();
await page.getByRole('heading', { name: /Für dich und alle Rezepte/ }).waitFor();
await page.locator('[data-filter="category"]').selectOption('dinner');
assert.ok((await page.locator('[data-enhanced-recipe]').count()) > 0);
await page.locator('[data-favorite]').first().click();
assert.equal(await page.getByRole('button', { name: 'Gespeichert' }).count(), 1);

await page.locator('a[href="#shopping"]').click();
await page.getByRole('heading', { name: 'Einkaufsliste' }).waitFor();
assert.ok((await page.locator('[data-shop-date]').count()) >= 3);
assert.ok((await page.locator('[data-shop-check]').count()) > 0);
const before = await page.locator('[data-shop-check]').count();
await page.locator('[data-shop-date]').first().click();
await page.waitForTimeout(150);
assert.ok((await page.locator('[data-shop-check]').count()) <= before);

await page.locator('a[href="#profile"]').click();
await page.getByRole('heading', { name: 'Deine Einstellungen' }).waitFor();
assert.deepEqual(errors, [], `Browserfehler: ${errors.join(' | ')}`);
await browser.close();
console.log('V8 Chromium E2E erfolgreich.');
