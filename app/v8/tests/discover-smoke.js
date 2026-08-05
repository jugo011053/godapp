import { activeFilterChips, createDefaultFilters, filterRecipes } from '../js/features/discover/discoverEngine.js';
import { excludeRecipe, restoreRecipe, toggleFavorite } from '../js/features/favorites/preferenceSignals.js';

const recipes = [
  { id: 'a', name: 'Hähnchen Reis Bowl', category: 'lunch', time: 25, difficulty: 'easy', simplicity: 'simple', protein: 48, kcal: 620, costBand: 'low', mealPrepScore: 4, dietTags: ['omnivore'], allergens: [], ingredientNames: ['Hähnchen', 'Reis'], tags: ['high_protein'] },
  { id: 'b', name: 'Veganes Curry', category: 'dinner', time: 45, difficulty: 'medium', simplicity: 'balanced', protein: 24, kcal: 550, costBand: 'low', mealPrepScore: 5, dietTags: ['vegan', 'vegetarian'], allergens: ['nuts'], ingredientNames: ['Kichererbsen'], tags: ['meal_prep'] },
  { id: 'c', name: 'Nuss-Porridge', category: 'breakfast', time: 10, difficulty: 'easy', simplicity: 'simple', protein: 18, kcal: 430, costBand: 'medium', mealPrepScore: 2, dietTags: ['vegetarian'], allergens: ['nuts'], ingredientNames: ['Haferflocken', 'Nüsse'], tags: [] }
];

let preferences = { favoriteRecipeIds: [], excludedRecipeIds: [], excludedIngredients: [], rejectionReasons: {} };
preferences = toggleFavorite(preferences, 'a');
console.assert(preferences.favoriteRecipeIds.includes('a'), 'Favorit wird gespeichert');

const filters = { ...createDefaultFilters(), maxTime: 30, minProtein: 30, simplicity: 'simple' };
const result = filterRecipes(recipes, filters, preferences);
console.assert(result.length === 1 && result[0].id === 'a', 'Filterkombination liefert korrektes Ergebnis');
console.assert(activeFilterChips(filters).length === 3, 'Aktive Filter werden sichtbar');

preferences = excludeRecipe(preferences, 'a', ['too_complex']);
console.assert(filterRecipes(recipes, filters, preferences).length === 0, 'Ausgeschlossenes Rezept verschwindet');
preferences = restoreRecipe(preferences, 'a');
console.assert(filterRecipes(recipes, filters, preferences).length === 1, 'Ausschluss ist rückgängig machbar');

const veganWithoutNuts = filterRecipes(recipes, { ...createDefaultFilters(), diet: 'vegan', excludedAllergens: ['nuts'] }, preferences);
console.assert(veganWithoutNuts.length === 0, 'Ernährungs- und Allergenfilter kombinieren sich');

console.info('[Preply V8] Discover-Smoke-Tests erfolgreich.');
