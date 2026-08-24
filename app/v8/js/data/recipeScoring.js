const MEAL_TARGET_SHARE = Object.freeze({
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10
});

function normalizedShare(category, enabledMeals) {
  const share = MEAL_TARGET_SHARE[category] || 0.25;
  if (!enabledMeals || enabledMeals.length === 0) return share;
  const totalShare = enabledMeals.reduce((sum, cat) => sum + (MEAL_TARGET_SHARE[cat] || 0.25), 0);
  return totalShare > 0 ? share / totalShare : share;
}

const COMPLETE_MEAL_MINIMUMS = Object.freeze({
  breakfast: { kcal: 220, protein: 8 },
  lunch: { kcal: 300, protein: 12 },
  dinner: { kcal: 300, protein: 12 },
  snack: { kcal: 60, protein: 0 }
});

const ALLERGEN_ALIASES = Object.freeze({
  egg: 'eggs', eggs: 'eggs', ei: 'eggs', eier: 'eggs',
  milk: 'dairy', dairy: 'dairy', milch: 'dairy', laktose: 'dairy',
  nuts: 'nuts', nut: 'nuts', nuts_peanuts: 'nuts', nüsse: 'nuts', nuss: 'nuts', erdnuss: 'nuts',
  soy: 'soy', soja: 'soy',
  fish: 'fish', fisch: 'fish',
  shellfish: 'shellfish', crustaceans: 'shellfish',
  gluten: 'gluten', weizen: 'gluten',
  sesame: 'sesame', sesam: 'sesame'
});

function normalToken(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeAllergen(value) {
  const token = normalToken(value);
  return ALLERGEN_ALIASES[token] || token;
}

export function normalizedAllergens(values = []) {
  return new Set(values.map(normalizeAllergen).filter(Boolean));
}

export function targetForMeal(profile, category, enabledMeals) {
  const fallbackDaily = profile.goal === 'gain' ? 2600 : profile.goal === 'lose' ? 1800 : 2200;
  const daily = Number(profile.calorieTarget) || fallbackDaily;
  return daily * normalizedShare(category, enabledMeals);
}

function dietCompatible(recipe, dietStyle) {
  const diets = new Set((recipe.dietTags || []).map(normalToken));
  if (dietStyle === 'vegan') return diets.has('vegan');
  if (dietStyle === 'vegetarian') return diets.has('vegetarian') || diets.has('vegan');
  if (dietStyle === 'pescatarian') {
    return diets.has('pescatarian') || diets.has('vegetarian') || diets.has('vegan');
  }
  return true;
}

function containsExcludedIngredient(recipe, excludedIngredients = []) {
  if (!excludedIngredients.length) return false;
  const searchable = [
    recipe.name,
    ...(recipe.ingredientNames || []),
    ...(recipe.tags || [])
  ].map(normalToken).join(' ');
  return excludedIngredients.some((value) => searchable.includes(normalToken(value)));
}

export function recipeEligible(recipe, context) {
  const { category, profile, preferences = {} } = context;
  if (!recipe || recipe.category !== category) return false;
  if (recipe.planEligible === false || recipe.qualityStatus === 'blocked') return false;
  if (category !== 'snack' && recipe.mealRole !== 'complete_meal') return false;

  const minimum = COMPLETE_MEAL_MINIMUMS[category];
  if (minimum && (recipe.kcal < minimum.kcal || recipe.protein < minimum.protein)) return false;

  if (!dietCompatible(recipe, profile.dietStyle)) return false;

  const userAllergens = normalizedAllergens(profile.allergies || []);
  const recipeAllergens = normalizedAllergens(recipe.allergens || []);
  if ([...userAllergens].some((allergen) => recipeAllergens.has(allergen))) return false;

  const excludedRecipes = new Set([
    ...(profile.excludedRecipes || []),
    ...(preferences.excludedRecipeIds || [])
  ]);
  if (excludedRecipes.has(recipe.id)) return false;

  const excludedIngredients = [
    ...(profile.excludedIngredients || []),
    ...(preferences.excludedIngredients || [])
  ];
  if (containsExcludedIngredient(recipe, excludedIngredients)) return false;

  if (profile.maxCookingTime && recipe.time > profile.maxCookingTime) return false;
  return true;
}

function closeness(value, target, tolerance) {
  if (!target || !Number.isFinite(value)) return 0;
  return Math.max(-30, 30 - Math.abs(value - target) / tolerance);
}

function includesAny(recipe, values) {
  const tags = new Set((recipe.tags || []).map(normalToken));
  return values.some((value) => tags.has(value));
}

export function scoreRecipe(recipe, context) {
  if (!recipeEligible(recipe, context)) return Number.NEGATIVE_INFINITY;

  const { category, profile, preferences = {}, usedRecipeIds = new Set(), usedFamilies = new Set() } = context;
  const targetKcal = targetForMeal(profile, category, context.enabledMeals);
  const targetProtein = profile.proteinTarget
    ? Number(profile.proteinTarget) * normalizedShare(category, context.enabledMeals)
    : category === 'snack' ? 8 : 25;

  let score = 100;
  score += closeness(recipe.kcal, targetKcal, 18);
  score += closeness(recipe.protein, targetProtein, 2.2);

  if (profile.simplicity === recipe.simplicity) score += 18;
  if (profile.simplicity === 'simple' && recipe.difficulty === 'easy') score += 10;
  if (profile.simplicity === 'experimental' && includesAny(recipe, ['international', 'experimental'])) score += 10;

  const priorities = new Set(profile.priorities || []);
  if (priorities.has('high_protein')) score += Math.min(25, recipe.protein * 0.75);
  if (priorities.has('quick')) score += Math.max(-15, 18 - recipe.time * 0.55);
  if (priorities.has('budget') && ['low', 'budget', 'günstig'].includes(normalToken(recipe.costBand))) score += 18;
  if (priorities.has('meal_prep')) score += Number(recipe.mealPrepScore || 0) * 4;

  if ((preferences.favoriteRecipeIds || []).includes(recipe.id)) score += 8;
  if (usedRecipeIds.has(recipe.id)) score -= 100;
  if (recipe.familyKey && usedFamilies.has(recipe.familyKey)) score -= 28;

  return score;
}

export function rankRecipes(recipes, context) {
  return recipes
    .map((recipe) => ({ recipe, score: scoreRecipe(recipe, context) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
}

export function createSeededRandom(seed = 1) {
  let value = Math.abs(Number(seed) || 1) % 2147483647;
  if (value === 0) value = 1;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function chooseAmongTop(ranked, random, breadth = 4) {
  if (!ranked.length) return null;
  const candidates = ranked.slice(0, Math.min(breadth, ranked.length));
  return candidates[Math.floor(random() * candidates.length)]?.recipe || candidates[0].recipe;
}
