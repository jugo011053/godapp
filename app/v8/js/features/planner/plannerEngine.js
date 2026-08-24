import { assertPlanRequest } from '../../data/contracts.js';
import {
  chooseAmongTop,
  createSeededRandom,
  rankRecipes,
  scoreRecipe,
  targetForMeal
} from '../../data/recipeScoring.js';

function dateKey(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Ungültiges Datum: ${value}`);
  return value;
}

function recipeFamily(recipe) {
  return recipe.familyKey || [recipe.category, recipe.dishType, recipe.primaryProtein]
    .filter(Boolean)
    .join(':') || recipe.id;
}

function portionFactor(recipe, profile, category) {
  const target = targetForMeal(profile, category);
  if (!recipe.kcal || !target) return 1;
  return Math.max(0.8, Math.min(1.2, target / recipe.kcal));
}

function createPlannedMeal(recipe, profile, category, meta = {}) {
  const factor = portionFactor(recipe, profile, category);
  return {
    recipeId: recipe.id,
    recipe,
    category,
    persons: Math.max(1, Number(profile.persons) || 1),
    portionFactor: Number(factor.toFixed(2)),
    prepGroupId: meta.prepGroupId || null,
    prepSourceDate: meta.prepSourceDate || null,
    repeatedForMealPrep: Boolean(meta.repeatedForMealPrep),
    estimatedKcalPerPerson: Math.round(recipe.kcal * factor),
    estimatedProteinPerPerson: Math.round(recipe.protein * factor)
  };
}

function prepGroupLength(profile, category) {
  if (!['lunch', 'dinner'].includes(category)) return 1;
  if (profile.cookingStyle === 'fresh') return 1;
  if (profile.cookingStyle === 'meal_prep') return Math.max(2, Number(profile.prepDays) || 2);
  return Math.max(1, Number(profile.prepDays) || 2);
}

function isMealPrepCandidate(recipe, profile) {
  if (profile.cookingStyle === 'fresh') return false;
  return Number(recipe.mealPrepScore || 0) >= 3;
}

function candidatesFor(recipes, context) {
  return rankRecipes(recipes, context);
}

export function suggestForToday(recipes, profile, preferences = {}, options = {}) {
  const category = options.category || 'dinner';
  const random = createSeededRandom(options.seed || Date.now());
  const context = {
    category,
    profile: {
      ...profile,
      maxCookingTime: options.maxCookingTime || profile.maxCookingTime,
      simplicity: options.simplicity || profile.simplicity,
      priorities: [...new Set([...(profile.priorities || []), ...(options.priorities || [])])]
    },
    preferences,
    usedRecipeIds: new Set(),
    usedFamilies: new Set()
  };

  const ranked = candidatesFor(recipes, context);
  const selected = [];
  const usedFamilies = new Set();

  for (let index = 0; index < 3; index += 1) {
    const available = ranked.filter(({ recipe }) =>
      !selected.some((item) => item.id === recipe.id) &&
      !usedFamilies.has(recipeFamily(recipe))
    );
    const fallback = ranked.filter(({ recipe }) => !selected.some((item) => item.id === recipe.id));
    const chosen = chooseAmongTop(available.length ? available : fallback, random, 3);
    if (!chosen) break;
    selected.push(chosen);
    usedFamilies.add(recipeFamily(chosen));
  }

  return selected;
}

export function buildPlan(recipes, request, preferences = {}, options = {}) {
  assertPlanRequest(request);
  const selectedDates = [...new Set(request.selectedDates.map(dateKey))].sort();
  const enabledMeals = [...new Set(request.enabledMeals)];
  const profile = request.profile;
  const random = createSeededRandom(options.seed || 1);
  const usedRecipeIds = new Set();
  const usedFamilies = new Set();
  const days = selectedDates.map((date) => ({ date, meals: {} }));

  for (const category of enabledMeals) {
    let dayIndex = 0;
    while (dayIndex < days.length) {
      const ranked = candidatesFor(recipes, {
        category,
        profile,
        preferences,
        usedRecipeIds,
        usedFamilies
      });
      const chosen = chooseAmongTop(ranked, random, 5);
      if (!chosen) {
        throw new Error(`Kein geeignetes Rezept für ${category} gefunden.`);
      }

      const possibleGroup = prepGroupLength(profile, category);
      const groupLength = isMealPrepCandidate(chosen, profile)
        ? Math.min(possibleGroup, days.length - dayIndex)
        : 1;
      const prepGroupId = groupLength > 1 ? `${category}-${days[dayIndex].date}` : null;

      for (let offset = 0; offset < groupLength; offset += 1) {
        const day = days[dayIndex + offset];
        day.meals[category] = createPlannedMeal(chosen, profile, category, {
          prepGroupId,
          prepSourceDate: days[dayIndex].date,
          repeatedForMealPrep: offset > 0,
          });
      }

      usedRecipeIds.add(chosen.id);
      usedFamilies.add(recipeFamily(chosen));
      dayIndex += groupLength;
    }
  }

  return {
    id: options.id || `plan-${selectedDates[0]}-${options.seed || 1}`,
    createdAt: new Date().toISOString(),
    startDate: selectedDates[0],
    endDate: selectedDates[selectedDates.length - 1],
    selectedDates,
    enabledMeals,
    profileSnapshot: structuredClone(profile),
    days
  };
}

export function replacementSuggestions(recipes, currentRecipe, context, mode = 'similar', limit = 12) {
  const base = {
    ...context,
    category: currentRecipe.category,
    usedRecipeIds: new Set([...(context.usedRecipeIds || []), currentRecipe.id])
  };
  return recipes
    .filter((recipe) => recipe.id !== currentRecipe.id)
    .map((recipe) => {
      let score = scoreRecipe(recipe, base);
      if (!Number.isFinite(score)) return null;
      if (mode === 'similar') {
        score -= Math.abs(recipe.kcal - currentRecipe.kcal) * 0.08;
        score -= Math.abs(recipe.protein - currentRecipe.protein) * 1.8;
      }
      if (mode === 'faster') score += Math.max(-30, currentRecipe.time - recipe.time) * 2;
      if (mode === 'simpler') {
        if (recipe.difficulty === 'easy') score += 25;
        if (recipe.simplicity === 'simple') score += 20;
      }
      if (mode === 'protein') score += recipe.protein * 1.5;
      if (mode === 'favorites' && (context.preferences?.favoriteRecipeIds || []).includes(recipe.id)) score += 100;
      return { recipe, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ recipe }) => recipe);
}
