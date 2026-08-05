import { buildShoppingList, copyShoppingText, toggleShoppingDate } from '../js/features/shopping/shoppingEngine.js';

const chicken = { ingredientId: 'chicken', name: 'Hähnchenbrust', amount: 400, unit: 'g', category: 'Fleisch und Fisch', packSize: 500, packPrice: 4.99 };
const rice = { ingredientId: 'rice', name: 'Reis', amount: 200, unit: 'g', category: 'Trockenwaren', packSize: 1000, packPrice: 2.49 };
const plan = {
  days: [
    { date: '2026-08-05', meals: { lunch: { recipeId: 'a', persons: 1, portionFactor: 1, recipe: { id: 'a', name: 'Hähnchen Reis', servings: 1, ingredients: [chicken, rice] } } } },
    { date: '2026-08-06', meals: { lunch: { recipeId: 'a', persons: 1, portionFactor: 1, recipe: { id: 'a', name: 'Hähnchen Reis', servings: 1, ingredients: [chicken, rice] } } } },
    { date: '2026-08-07', meals: { dinner: { recipeId: 'b', persons: 1, portionFactor: 1, recipe: { id: 'b', name: 'Gemüsereis', servings: 1, ingredients: [rice] } } } }
  ]
};

const full = buildShoppingList(plan, []);
console.assert(full.selectedDates.length === 3, 'Standardmäßig sind alle Tage aktiv');
console.assert(full.items.find((item) => item.name === 'Hähnchenbrust').amount === 800, 'Mengen werden über Tage summiert');
console.assert(full.items.find((item) => item.name === 'Reis').sources.length === 3, 'Herkunft jeder Menge bleibt erhalten');

const selected = toggleShoppingDate(full.selectedDates, '2026-08-07', plan);
const reduced = buildShoppingList(plan, selected, { 'rice::g': true });
console.assert(reduced.selectedDates.length === 2, 'Tag kann abgewählt werden');
console.assert(reduced.items.find((item) => item.name === 'Reis').amount === 400, 'Abgewählter Tag wird aus Mengen entfernt');
console.assert(reduced.items.find((item) => item.name === 'Reis').checked === true, 'Häkchen bleibt über Neuberechnung erhalten');
console.assert(!copyShoppingText(reduced).includes('Fr.'), 'Kopiertext enthält nur aktive Tage');

console.info('[Preply V8] Shopping-Smoke-Tests erfolgreich.');
