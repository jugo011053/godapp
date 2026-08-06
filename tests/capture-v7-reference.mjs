import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const rows = Array.from({ length: 18 }, (_, index) => ({
  id: `ref-${index}`,
  source: 'reference',
  code: `REF-${index}`,
  name: [
    'Protein-Porridge mit Beeren',
    'Mediterrane Hähnchen-Bowl',
    'Cremige Linsenpasta',
    'Joghurt mit Apfel und Nüssen',
    'Shakshuka mit Feta',
    'Teriyaki-Tofu mit Reis'
  ][index % 6],
  cat: ['breakfast', 'lunch', 'dinner', 'snack'][index % 4],
  kcal: 430 + index * 11,
  protein: 28 + index,
  carbs: 48,
  fat: 14,
  time: 15 + (index % 4) * 5,
  servings: 2,
  difficulty: 'easy',
  tags: ['quick', 'high_protein'],
  allergens: [],
  diet_tags: [],
  ingredients: [{ name: `Zutat ${index}`, amount: 250, unit: 'g', category: 'Kühlung' }],
  steps: ['Zutaten vorbereiten.', 'Alles garen und abschmecken.'],
  classification: { dish_type: 'bowl', meal_prep_score_v2: 3, novelty_level: 1, cost_band: 'budget', dietary_style: 'omnivore' },
  quality_score: 95,
  is_plan_eligible: true
}));

await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = await context.newPage();
await page.route('**/rest/v1/recipe_catalog_v1**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
await page.addInitScript(() => localStorage.setItem('preply_v8_state_v1', JSON.stringify({
  schemaVersion: 10,
  onboardingCompleted: true,
  currentPlan: null,
  planHistory: [],
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
    enabledMeals: { breakfast: true, lunch: true, dinner: true, snack: false },
    cookingStyle: 'mixed',
    prepDays: 2,
    maxCookingTime: 45,
    simplicity: 'simple',
    priorities: ['high_protein', 'quick']
  },
  preferences: { favoriteRecipeIds: [], excludedRecipeIds: [], excludedIngredients: [], rejectionReasons: {} }
})));

await page.goto('http://127.0.0.1:4174/v8/');
await page.getByRole('button', { name: /Wochenplan erstellen|Essensplan erstellen/ }).first().click();
await page.getByRole('button', { name: 'Weiter', exact: true }).click();
await page.getByRole('button', { name: 'Weiter', exact: true }).click();
await page.getByRole('button', { name: 'Plan erstellen', exact: true }).click();
await page.waitForSelector('.meal-card2');
await page.screenshot({ path: 'artifacts/preply-v7-reference.png', fullPage: true });
await browser.close();
console.log('Screenshot erstellt.');