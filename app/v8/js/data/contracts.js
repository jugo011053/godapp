export const PROFILE_VERSION = 2;
export const APP_SCHEMA_VERSION = 10;
export const LEGACY_STORE_KEY = 'godapp6_7_1_state_v1';

export const MEAL_CATEGORIES = Object.freeze([
  'breakfast',
  'lunch',
  'dinner',
  'snack'
]);

export const DIET_STYLES = Object.freeze([
  'omnivore',
  'vegetarian',
  'vegan',
  'pescatarian'
]);

export const COOKING_STYLES = Object.freeze([
  'fresh',
  'meal_prep',
  'mixed'
]);

export const SIMPLICITY_LEVELS = Object.freeze([
  'simple',
  'balanced',
  'experimental'
]);

export function createDefaultProfile() {
  return {
    version: PROFILE_VERSION,
    planningMode: 'simple',
    goal: null,
    calorieTarget: null,
    proteinTarget: null,
    dietStyle: 'omnivore',
    allergies: [],
    excludedIngredients: [],
    excludedRecipes: [],
    persons: 1,
    enabledMeals: {
      breakfast: true,
      lunch: true,
      dinner: true,
      snack: false
    },
    cookingStyle: 'mixed',
    prepDays: 2,
    maxCookingTime: 30,
    simplicity: 'balanced',
    priorities: []
  };
}

export function createPreferenceSignals() {
  return {
    favoriteRecipeIds: [],
    excludedRecipeIds: [],
    excludedIngredients: [],
    rejectionReasons: {}
  };
}

export function assertPlanRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new TypeError('PlanRequest muss ein Objekt sein.');
  }
  if (!Array.isArray(request.selectedDates) || request.selectedDates.length === 0) {
    throw new TypeError('PlanRequest benötigt mindestens ein ausgewähltes Datum.');
  }
  if (!Array.isArray(request.enabledMeals) || request.enabledMeals.length === 0) {
    throw new TypeError('PlanRequest benötigt mindestens eine Mahlzeit.');
  }
  return request;
}

export function normalizeRecipeCard(recipe) {
  if (!recipe || !recipe.id) {
    throw new TypeError('RecipeCard benötigt eine id.');
  }
  return {
    id: String(recipe.id),
    name: String(recipe.name || 'Unbenanntes Rezept'),
    category: recipe.category || recipe.cat || 'dinner',
    mealRole: recipe.mealRole || recipe.meal_role || 'complete_meal',
    kcal: Number(recipe.kcal || 0),
    protein: Number(recipe.protein || 0),
    carbs: Number(recipe.carbs || 0),
    fat: Number(recipe.fat || 0),
    time: Number(recipe.time || 0),
    difficulty: recipe.difficulty || 'medium',
    simplicity: recipe.simplicity || 'balanced',
    mealPrepScore: Number(recipe.mealPrepScore || recipe.meal_prep_score || 0),
    costBand: recipe.costBand || recipe.cost_band || 'unknown',
    tags: Array.isArray(recipe.tags) ? [...recipe.tags] : [],
    allergens: Array.isArray(recipe.allergens) ? [...recipe.allergens] : [],
    dietTags: Array.isArray(recipe.dietTags || recipe.diet_tags)
      ? [...(recipe.dietTags || recipe.diet_tags)]
      : []
  };
}
