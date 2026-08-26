import { normalizeCatalogRecipe } from './recipeNormalizer.js';

const DEFAULT_ENDPOINT = '/rest/v1/recipe_catalog_v1';

export class RecipeRepository {
  constructor({ supabaseUrl, anonKey, fetchImpl } = {}) {
    if (!supabaseUrl || !anonKey) {
      throw new TypeError('RecipeRepository benötigt Supabase-URL und Anon-Key.');
    }
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args));
  }

  async request(query, { signal } = {}) {
    const response = await this.fetchImpl(`${this.supabaseUrl}${DEFAULT_ENDPOINT}?${query}`, {
      signal,
      headers: {
        apikey: this.anonKey,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`Rezeptkatalog konnte nicht geladen werden (${response.status}).`);
    }
    return response.json();
  }

  async listCards({ signal, includeBlocked = false } = {}) {
    const select = [
      'id', 'source', 'code', 'name', 'cat', 'kcal', 'protein', 'carbs', 'fat',
      'time', 'servings', 'difficulty', 'tags', 'allergens', 'diet_tags',
      'ingredients', 'steps', 'classification', 'quality_score', 'is_plan_eligible'
    ].join(',');
    const filter = includeBlocked ? '' : 'is_plan_eligible=eq.true&';
    const recipes = await this.request(`${filter}select=${encodeURIComponent(select)}&order=name`, { signal });
    return recipes
      .map(normalizeCatalogRecipe)
      .filter((recipe) => includeBlocked || recipe.planEligible)
      .map((recipe) => ({
        id: recipe.id,
        code: recipe.code,
        name: recipe.name,
        category: recipe.category,
        mealRole: recipe.mealRole,
        kcal: Number(recipe.kcal || 0),
        protein: Number(recipe.protein || 0),
        carbs: Number(recipe.carbs || 0),
        fat: Number(recipe.fat || 0),
        time: Number(recipe.time || 0),
        servings: Number(recipe.servings || 1),
        difficulty: recipe.difficulty || 'medium',
        simplicity: recipe.simplicity,
        mealPrepScore: recipe.mealPrepScore,
        noveltyLevel: recipe.noveltyLevel,
        costBand: recipe.costBand,
        tags: recipe.tags || [],
        allergens: recipe.allergens,
        dietTags: recipe.dietTags,
        planEligible: recipe.planEligible,
        /* Ohne dieses Feld fällt sortRecipes('recommended') auf alphabetisch
           zurück — "Für dich" zeigte dann immer dieselben Rezepte von A. */
        qualityScore: Number(recipe.quality_score || 0),
        qualityStatus: recipe.qualityStatus,
        qualityIssues: recipe.qualityIssues,
        familyKey: recipe.familyKey,
        primaryProtein: recipe.primaryProtein,
        dishType: recipe.dishType,
        ingredientNames: recipe.ingredientNames,
        /* Zutaten und Schritte werden oben ohnehin mitgeholt und wurden hier
           bisher weggeworfen. Ohne sie brauchte jede Einkaufsliste und jedes
           aufgeklappte Gericht eine eigene Abfrage je Rezept — und ohne Netz
           blieb beides leer. */
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || []
      }));
  }

  async getRecipe(id, { signal } = {}) {
    const [recipe] = await this.request(`id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { signal });
    return recipe ? normalizeCatalogRecipe(recipe) : null;
  }

  async listForQualityAudit({ signal } = {}) {
    const recipes = await this.request('select=*&order=code', { signal });
    return recipes.map(normalizeCatalogRecipe);
  }
}
