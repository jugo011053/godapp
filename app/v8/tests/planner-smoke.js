import { createDefaultProfile } from '../js/data/contracts.js';
import { buildPlan, replacementSuggestions, suggestForToday } from '../js/features/planner/plannerEngine.js';

const base = {
  allergens: [], dietTags: ['omnivore'], planEligible: true, qualityStatus: 'approved',
  mealRole: 'complete_meal', difficulty: 'easy', simplicity: 'simple', mealPrepScore: 4,
  costBand: 'low', tags: ['high_protein'], time: 25, carbs: 40, fat: 15
};
const recipes = [
  { ...base, id: 'a', name: 'Hähnchen Reis', category: 'lunch', kcal: 620, protein: 48, familyKey: 'bowl-chicken' },
  { ...base, id: 'b', name: 'Puten Pasta', category: 'lunch', kcal: 590, protein: 45, familyKey: 'pasta-turkey' },
  { ...base, id: 'c', name: 'Linsen Curry', category: 'lunch', kcal: 560, protein: 28, familyKey: 'curry-lentil' },
  { ...base, id: 'd', name: 'Tofu Pfanne', category: 'lunch', kcal: 520, protein: 31, familyKey: 'stirfry-tofu' },
  { ...base, id: 'broth', name: 'Brühe', category: 'lunch', kcal: 16, protein: 3, mealRole: 'base' }
];

const profile = {
  ...createDefaultProfile(),
  calorieTarget: 2200,
  proteinTarget: 150,
  cookingStyle: 'meal_prep',
  prepDays: 2,
  simplicity: 'simple',
  priorities: ['high_protein']
};

const inspiration = suggestForToday(recipes, profile, {}, { category: 'lunch', seed: 42 });
console.assert(inspiration.length === 3, 'Inspiration liefert drei Vorschläge');
console.assert(!inspiration.some((recipe) => recipe.id === 'broth'), 'Brühe wird ausgeschlossen');
console.assert(new Set(inspiration.map((recipe) => recipe.familyKey)).size === inspiration.length, 'Vorschläge sind verschieden');

const plan = buildPlan(recipes, {
  startDate: '2026-08-05',
  selectedDates: ['2026-08-05', '2026-08-06', '2026-08-07'],
  enabledMeals: ['lunch'],
  mode: 'multi_day',
  profile
}, {}, { seed: 12 });
console.assert(plan.days.length === 3, 'Plan enthält ausgewählte Tage');
console.assert(plan.days.every((day) => day.meals.lunch), 'Jeder Tag enthält Mittagessen');
console.assert(plan.days[1].meals.lunch.repeatedForMealPrep === true, 'Meal Prep wird markiert');
console.assert(plan.days.every((day) => day.meals.lunch.portionFactor >= 0.8 && day.meals.lunch.portionFactor <= 1.2), 'Skalierung bleibt moderat');

const replacements = replacementSuggestions(recipes, recipes[0], {
  profile,
  preferences: {},
  usedRecipeIds: new Set()
}, 'protein');
console.assert(replacements.every((recipe) => recipe.id !== 'a'), 'Aktuelles Rezept wird nicht erneut vorgeschlagen');

console.info('[Preply V8] Planner-Smoke-Tests erfolgreich.');
