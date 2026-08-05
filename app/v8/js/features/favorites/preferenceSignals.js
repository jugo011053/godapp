const VALID_REJECTION_REASONS = new Set([
  'too_complex',
  'too_expensive',
  'too_experimental',
  'disliked_ingredients'
]);

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function toggleFavorite(preferences, recipeId) {
  const favoriteRecipeIds = new Set(preferences.favoriteRecipeIds || []);
  if (favoriteRecipeIds.has(recipeId)) favoriteRecipeIds.delete(recipeId);
  else favoriteRecipeIds.add(recipeId);
  return { ...preferences, favoriteRecipeIds: [...favoriteRecipeIds] };
}

export function excludeRecipe(preferences, recipeId, reasons = []) {
  const validReasons = unique(reasons).filter((reason) => VALID_REJECTION_REASONS.has(reason));
  return {
    ...preferences,
    excludedRecipeIds: unique([...(preferences.excludedRecipeIds || []), recipeId]),
    rejectionReasons: {
      ...(preferences.rejectionReasons || {}),
      [recipeId]: validReasons
    }
  };
}

export function restoreRecipe(preferences, recipeId) {
  const rejectionReasons = { ...(preferences.rejectionReasons || {}) };
  delete rejectionReasons[recipeId];
  return {
    ...preferences,
    excludedRecipeIds: (preferences.excludedRecipeIds || []).filter((id) => id !== recipeId),
    rejectionReasons
  };
}

export function excludeIngredient(preferences, ingredientName) {
  return {
    ...preferences,
    excludedIngredients: unique([...(preferences.excludedIngredients || []), ingredientName.trim()])
  };
}

export function restoreIngredient(preferences, ingredientName) {
  return {
    ...preferences,
    excludedIngredients: (preferences.excludedIngredients || []).filter((name) => name !== ingredientName)
  };
}

export function preferenceEvent(type, payload) {
  return {
    type,
    payload: structuredClone(payload),
    occurredAt: new Date().toISOString(),
    schemaVersion: 1
  };
}

export function applyPreferenceEvent(preferences, event) {
  if (event.type === 'favorite_toggled') return toggleFavorite(preferences, event.payload.recipeId);
  if (event.type === 'recipe_excluded') return excludeRecipe(preferences, event.payload.recipeId, event.payload.reasons);
  if (event.type === 'recipe_restored') return restoreRecipe(preferences, event.payload.recipeId);
  if (event.type === 'ingredient_excluded') return excludeIngredient(preferences, event.payload.ingredientName);
  if (event.type === 'ingredient_restored') return restoreIngredient(preferences, event.payload.ingredientName);
  return preferences;
}
