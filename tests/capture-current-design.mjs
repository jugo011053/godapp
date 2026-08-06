import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const dates = ['2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10'];
const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
const names = {
  breakfast: ['Hummus-Avocado-Toast', 'Protein-Pancakes mit Beeren', 'Rührei mit Spinat', 'Skyr-Bowl mit Apfel', 'Herzhafte Frühstücksbowl'],
  lunch: ['Tomaten-Nudel-Suppe', 'Linsen-Bolognese mit Vollkornnudeln', 'Quinoa-Salat mit Kichererbsen', 'Ofengemüse mit Feta', 'Hähnchen-Gemüse-Pfanne'],
  dinner: ['Riesenbohnen-Eintopf', 'Süßkartoffel-Bowl mit Tahini-Dressing', 'Couscous mit Gemüse', 'Tofu-Curry mit Reis', 'Lachs mit Ofengemüse'],
  snack: ['Banane mit Erdnussmus', 'Skyr mit Beeren', 'Apfel mit Mandelmus', 'Hummus mit Gemüsesticks', 'Protein-Pudding']
};

function makeRecipe(category, index) {
  const id = `${category}-${index}`;
  return {
    id,
    source: 'visual-test',
    code: `VIS-${category}-${index}`,
    name: names[category][index % names[category].length],
    cat: category,
    kcal: category === 'snack' ? 355 + index * 5 : category === 'breakfast' ? 560 + index * 8 : 510 + index * 17,
    protein: category === 'snack' ? 12 + index : category === 'breakfast' ? 24 + index : 20 + index * 4,
    carbs: 55,
    fat: 16,
    time: category === 'snack' ? 2 + index : 8 + index * 7,
    servings: 2,
    difficulty: index % 2 ? 'medium' : 'easy',
    tags: ['high_protein', index % 2 ? 'meal_prep' : 'quick'],
    allergens: [],
    diet_tags: index % 2 ? ['vegetarian'] : [],
    ingredients: [
      { name: category === 'snack' ? 'Banane' : 'Tomaten', amount: category === 'snack' ? 1 : 300, unit: category === 'snack' ? 'Stück' : 'g', category: 'Gemüse' },
      { name: category === 'breakfast' ? 'Avocado' : 'Kichererbsen', amount: category === 'breakfast' ? 1 : 150, unit: category === 'breakfast' ? 'Stück' : 'g', category: 'Hülsenfrüchte & Getreide' },
      { name: category === 'dinner' ? 'Feta' : 'Olivenöl', amount: category === 'dinner' ? 100 : 1, unit: category === 'dinner' ? 'g' : 'EL', category: category === 'dinner' ? 'Milchprodukte & Eier' : 'Sonstiges' }
    ],
    steps: ['Zutaten vorbereiten.', 'Alles nach Rezept garen und abschmecken.', 'Anrichten und servieren.'],
    classification: {
      dish_type: category,
      meal_prep_score_v2: 4,
      novelty_level: index % 3,
      cost_band: 'budget',
      dietary_style: index % 2 ? 'vegetarian' : 'omnivore'
    },
    quality_score: 95,
    is_plan_eligible: true
  };
}

const rows = slots.flatMap((slot) => Array.from({ length: 6 }, (_, index) => makeRecipe(slot, index)));
const byId = new Map(rows.map((recipe) => [recipe.id, recipe]));

const days = dates.map((date, dayIndex) => ({
  date,
  meals: Object.fromEntries(slots.map((slot, slotIndex) => {
    const recipe = byId.get(`${slot}-${(dayIndex + slotIndex) % 6}`);
    return [slot, {
      recipeId: recipe.id,
      recipe,
      estimatedKcalPerPerson: Math.round(recipe.kcal),
      estimatedProteinPerPerson: Math.round(recipe.protein),
      prepGroupId: null
    }];
  }))
}));

const state = {
  schemaVersion: 10,
  onboardingCompleted: true,
  profile: {
    version: 2,
    planningMode: 'simple',
    goal: 'maintain',
    calorieTarget: 2650,
    proteinTarget: 133,
    dietStyle: 'omnivore',
    allergies: [],
    excludedIngredients: [],
    excludedRecipes: [],
    persons: 2,
    enabledMeals: { breakfast: true, lunch: true, dinner: true, snack: true },
    cookingStyle: 'mixed',
    prepDays: 2,
    maxCookingTime: 45,
    simplicity: 'balanced',
    priorities: ['high_protein', 'quick', 'meal_prep']
  },
  preferences: {
    favoriteRecipeIds: ['breakfast-1', 'lunch-1'],
    excludedRecipeIds: [],
    excludedIngredients: [],
    rejectionReasons: {}
  },
  currentPlan: {
    id: 'visual-plan',
    createdAt: '2026-08-06T10:00:00.000Z',
    selectedDates: dates,
    enabledMeals: slots,
    days
  },
  planHistory: [],
  shoppingChecks: {}
};

await fs.mkdir('artifacts/v8-design', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

await page.route('**/rest/v1/recipe_catalog_v1**', async (route) => {
  const url = new URL(route.request().url());
  const idFilter = url.searchParams.get('id');
  const result = idFilter?.startsWith('eq.') ? rows.filter((row) => row.id === idFilter.slice(3)) : rows;
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(result) });
});

await page.addInitScript((seed) => {
  localStorage.clear();
  localStorage.setItem('preply_v8_state_v1', JSON.stringify(seed));
}, state);

await page.goto('http://127.0.0.1:4173/v8/#plan', { waitUntil: 'networkidle' });
await page.locator('.preply-plan-card').waitFor({ timeout: 15000 });
await page.screenshot({ path: 'artifacts/v8-design/01-heute.png', fullPage: true });

await page.locator('a[href="#recipes"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/v8-design/02-rezepte.png', fullPage: true });

await page.locator('a[href="#shopping"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/v8-design/03-einkauf.png', fullPage: true });

await page.locator('a[href="#plan"]').click();
await page.locator('.preply-plan-card').waitFor();
await page.locator('[data-swap-meal]').first().click();
await page.waitForTimeout(350);
await page.screenshot({ path: 'artifacts/v8-design/04-austauschen.png', fullPage: true });

await page.keyboard.press('Escape');
await page.locator('.v8-header-action').click();
await page.waitForTimeout(350);
await page.screenshot({ path: 'artifacts/v8-design/05-profil.png', fullPage: true });

await browser.close();
if (errors.length) throw new Error(errors.join('\n'));
console.log('V8 design captures created.');
