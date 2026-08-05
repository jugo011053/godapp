import { normalizeRecipeCard } from './contracts.js';

const DEFAULT_ENDPOINT = '/rest/v1/recipe_catalog_v1';

export class RecipeRepository {
  constructor({ supabaseUrl, anonKey, fetchImpl = fetch }) {
    if (!supabaseUrl || !anonKey) {
      throw new TypeError('RecipeRepository benötigt Supabase-URL und Anon-Key.');
    }
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl;
  }

  async listCards({ signal } = {}) {
    const select = [
      'id', 'name', 'cat', 'kcal', 'protein', 'carbs', 'fat', 'time',
      'difficulty', 'tags', 'allergens', 'diet_tags', 'classification',
      'quality_score', 'is_plan_eligible'
    ].join(',');
    const url = `${this.supabaseUrl}${DEFAULT_ENDPOINT}?is_plan_eligible=eq.true&select=${encodeURIComponent(select)}&order=name`;
    const response = await this.fetchImpl(url, {
      signal,
      headers: {
        apikey: this.anonKey,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`Rezeptkatalog konnte nicht geladen werden (${response.status}).`);
    }
    const recipes = await response.json();
    return recipes.map((recipe) => normalizeRecipeCard({
      ...recipe,
      mealPrepScore: recipe.classification?.meal_prep_score_v2,
      costBand: recipe.classification?.cost_band
    }));
  }

  async getRecipe(id, { signal } = {}) {
    const url = `${this.supabaseUrl}${DEFAULT_ENDPOINT}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const response = await this.fetchImpl(url, {
      signal,
      headers: {
        apikey: this.anonKey,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`Rezept konnte nicht geladen werden (${response.status}).`);
    }
    const [recipe] = await response.json();
    return recipe || null;
  }
}
