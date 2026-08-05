import { buildQualityReport, normalizeCatalogRecipe } from '../js/data/recipeNormalizer.js';

const complete = normalizeCatalogRecipe({
  id: 'meal', name: 'Hähnchen mit Reis', cat: 'lunch', kcal: 620, protein: 48,
  servings: 2, time: 25, difficulty: 'easy', diet_tags: ['omnivore'],
  allergens: ['milk', 'egg'], is_plan_eligible: true, quality_score: 96,
  ingredients: [{ name: 'Hähnchen', amount: 400, unit: 'g' }],
  steps: ['Kochen'],
  classification: { dish_type: 'bowl', meal_role: 'complete_meal', novelty_level: 1, meal_prep_score_v2: 4 }
});
console.assert(complete.allergens.includes('dairy') && complete.allergens.includes('eggs'), 'Allergene werden normalisiert');
console.assert(complete.mealRole === 'complete_meal', 'Mahlzeitenrolle bleibt erhalten');
console.assert(complete.simplicity === 'simple', 'Einfaches Gericht wird erkannt');
console.assert(complete.planEligible === true, 'Plausibles Rezept bleibt planbar');

const broth = normalizeCatalogRecipe({
  id: 'broth', name: 'Hühnerbrühe', cat: 'lunch', kcal: 16, protein: 3,
  servings: 1, time: 30, is_plan_eligible: true, quality_score: 96,
  ingredients: [{ name: 'Brühe', amount: 500, unit: 'ml' }],
  steps: ['Erwärmen'], classification: { dish_type: 'brühe', meal_role: 'base' }
});
console.assert(broth.mealRole === 'base', 'Brühe wird als Basis erkannt');
console.assert(broth.qualityStatus === 'blocked', 'Extrem leichte Hauptmahlzeit wird blockiert');
console.assert(broth.planEligible === false, 'Blockiertes Rezept ist nicht planbar');

const report = buildQualityReport([complete, broth]);
console.assert(report.total === 2 && report.blocked === 1, 'Qualitätsreport zählt Status korrekt');

console.info('[Preply V8] Catalog-Smoke-Tests erfolgreich.');
