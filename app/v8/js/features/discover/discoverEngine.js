function token(value) {
  return String(value || '').trim().toLowerCase();
}

function includesText(recipe, query) {
  if (!query) return true;
  const haystack = [
    recipe.name,
    recipe.code,
    ...(recipe.tags || []),
    ...(recipe.ingredientNames || [])
  ].map(token).join(' ');
  return haystack.includes(token(query));
}

function inRange(value, min, max) {
  const number = Number(value || 0);
  if (min != null && number < Number(min)) return false;
  if (max != null && number > Number(max)) return false;
  return true;
}

function matchesDiet(recipe, diet) {
  if (!diet || diet === 'all' || diet === 'omnivore') return true;
  const tags = new Set((recipe.dietTags || []).map(token));
  if (diet === 'vegetarian') return tags.has('vegetarian') || tags.has('vegan');
  if (diet === 'vegan') return tags.has('vegan');
  if (diet === 'pescatarian') return tags.has('pescatarian') || tags.has('vegetarian') || tags.has('vegan');
  return tags.has(diet);
}

function avoidsAllergens(recipe, excluded = []) {
  if (!excluded.length) return true;
  const allergens = new Set((recipe.allergens || []).map(token));
  return !excluded.some((allergen) => allergens.has(token(allergen)));
}

function matchesCuisine(recipe, cuisine) {
  if (!cuisine) return true;
  return token(recipe.region || recipe.regionInspiration || recipe.classification?.region_inspiration)
    .includes(token(cuisine));
}

export function createDefaultFilters() {
  return {
    query: '',
    category: '',
    maxTime: null,
    difficulty: '',
    simplicity: '',
    minProtein: null,
    minKcal: null,
    maxKcal: null,
    costBand: '',
    minMealPrepScore: null,
    diet: '',
    halalOnly: false,
    excludedAllergens: [],
    cuisine: '',
    favoritesOnly: false,
    includeExcluded: false
  };
}

export function filterRecipes(recipes, filters = {}, preferences = {}) {
  const f = { ...createDefaultFilters(), ...filters };
  const favoriteIds = new Set(preferences.favoriteRecipeIds || []);
  const excludedIds = new Set(preferences.excludedRecipeIds || []);

  return recipes.filter((recipe) => {
    if (!f.includeExcluded && excludedIds.has(recipe.id)) return false;
    if (f.favoritesOnly && !favoriteIds.has(recipe.id)) return false;
    if (f.category && recipe.category !== f.category) return false;
    if (f.maxTime != null && Number(recipe.time || 0) > Number(f.maxTime)) return false;
    if (f.difficulty && recipe.difficulty !== f.difficulty) return false;
    if (f.simplicity && recipe.simplicity !== f.simplicity) return false;
    if (f.costBand && token(recipe.costBand) !== token(f.costBand)) return false;
    if (f.minMealPrepScore != null && Number(recipe.mealPrepScore || 0) < Number(f.minMealPrepScore)) return false;
    if (!inRange(recipe.protein, f.minProtein, null)) return false;
    if (!inRange(recipe.kcal, f.minKcal, f.maxKcal)) return false;
    if (!matchesDiet(recipe, f.diet)) return false;
    if (f.halalOnly && recipe.halal === false) return false;
    if (!avoidsAllergens(recipe, f.excludedAllergens)) return false;
    if (!matchesCuisine(recipe, f.cuisine)) return false;
    if (!includesText(recipe, f.query)) return false;
    return true;
  });
}

export function sortRecipes(recipes, mode = 'recommended', preferences = {}) {
  const favoriteIds = new Set(preferences.favoriteRecipeIds || []);
  return [...recipes].sort((a, b) => {
    if (mode === 'protein') return Number(b.protein || 0) - Number(a.protein || 0);
    if (mode === 'quick') return Number(a.time || 0) - Number(b.time || 0);
    if (mode === 'kcal_low') return Number(a.kcal || 0) - Number(b.kcal || 0);
    if (mode === 'meal_prep') return Number(b.mealPrepScore || 0) - Number(a.mealPrepScore || 0);
    if (mode === 'name') return a.name.localeCompare(b.name);
    const favoriteDelta = Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id));
    if (favoriteDelta) return favoriteDelta;
    return Number(b.qualityScore || 0) - Number(a.qualityScore || 0) || a.name.localeCompare(b.name);
  });
}

export function activeFilterChips(filters = {}) {
  const f = { ...createDefaultFilters(), ...filters };
  const chips = [];
  if (f.query) chips.push({ key: 'query', label: `Suche: ${f.query}` });
  if (f.category) chips.push({ key: 'category', label: f.category });
  if (f.maxTime != null) chips.push({ key: 'maxTime', label: `≤ ${f.maxTime} Min` });
  if (f.difficulty) chips.push({ key: 'difficulty', label: f.difficulty });
  if (f.simplicity) chips.push({ key: 'simplicity', label: f.simplicity });
  if (f.minProtein != null) chips.push({ key: 'minProtein', label: `≥ ${f.minProtein} g Protein` });
  if (f.minKcal != null || f.maxKcal != null) chips.push({ key: 'kcal', label: `${f.minKcal || 0}–${f.maxKcal || '∞'} kcal` });
  if (f.costBand) chips.push({ key: 'costBand', label: f.costBand });
  if (f.minMealPrepScore != null) chips.push({ key: 'minMealPrepScore', label: 'Meal Prep' });
  if (f.diet) chips.push({ key: 'diet', label: f.diet });
  if (f.excludedAllergens.length) chips.push({ key: 'excludedAllergens', label: `Ohne ${f.excludedAllergens.join(', ')}` });
  if (f.cuisine) chips.push({ key: 'cuisine', label: f.cuisine });
  if (f.favoritesOnly) chips.push({ key: 'favoritesOnly', label: 'Favoriten' });
  return chips;
}

export function clearFilter(filters, key) {
  const next = { ...filters };
  if (key === 'kcal') {
    next.minKcal = null;
    next.maxKcal = null;
  } else if (key === 'excludedAllergens') {
    next.excludedAllergens = [];
  } else if (typeof createDefaultFilters()[key] === 'boolean') {
    next[key] = false;
  } else {
    next[key] = createDefaultFilters()[key];
  }
  return next;
}
