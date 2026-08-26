const MEAL_TARGET_SHARE = Object.freeze({
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.30,
  snack: 0.10
});

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

/* Einzige Quelle für die Tagesziele. Jede Anzeige und das Scoring müssen
   dieselbe Zahl verwenden, sonst zeigt die App ein anderes Ziel an, als sie plant. */
export function resolveCalorieTarget(profile = {}) {
  const fallback = profile.goal === 'gain' ? 2600 : profile.goal === 'lose' ? 1800 : 2200;
  return Number(profile.calorieTarget) || fallback;
}

export function resolveProteinTarget(profile = {}) {
  const explicit = Number(profile.proteinTarget);
  if (explicit) return explicit;
  /* ~1.6 g/kg bei einem 75-kg-Referenzkörper, skaliert am Kalorienziel. */
  return Math.round(resolveCalorieTarget(profile) * 0.055);
}

export function targetForMeal(profile, category) {
  return resolveCalorieTarget(profile) * (MEAL_TARGET_SHARE[category] || 0.25);
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
  /* Beilagen und Basisrezepte (Dips, Soßen) sind nie eine ganze Mahlzeit.
     "Leichte Mahlzeit" dagegen schon — ein Salat mittags ist ein Mittagessen.
     Ob genug drin steckt, entscheiden die Mindestwerte unten. */
  if (recipe.mealRole === 'base' || recipe.mealRole === 'side') return false;

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

/* Richtungen sind Korrekturen an dem, was gerade im Plan steht — der Nutzer
   sagt "so nicht, sondern eher ...". Sie veraendern nie, WAS erlaubt ist
   (das entscheidet recipeEligible anhand von Profil und Allergien), sondern
   nur, was bevorzugt wird. */
export const DIRECTIONS = Object.freeze({
  effort:  { label: 'Zu aufwendig',     hint: 'Kuerzer und einfacher' },
  price:   { label: 'Zu teuer',         hint: 'Guenstigere Zutaten' },
  protein: { label: 'Zu wenig Protein', hint: 'Mehr Eiweiss pro Portion' },
  variety: { label: 'Immer dasselbe',   hint: 'Anderes als zuletzt' },
  exotic:  { label: 'Zu ausgefallen',   hint: 'Vertraute Gerichte' },
  heavy:   { label: 'Zu schwer',        hint: 'Leichter und weniger fett' }
});

function directionBonus(recipe, direction, context) {
  if (!direction) return 0;
  const recent = context.recentRecipeIds || new Set();
  const recentFamilies = context.recentFamilies || new Set();

  switch (direction) {
    case 'effort':
      return Math.max(-30, 30 - recipe.time * 0.9)
        + (recipe.difficulty === 'easy' ? 18 : recipe.difficulty === 'hard' ? -22 : 0)
        + (recipe.simplicity === 'simple' ? 14 : 0);
    case 'price': {
      const band = normalToken(recipe.costBand);
      if (['low', 'budget', 'guenstig', 'günstig'].includes(band)) return 34;
      if (['mittel', 'medium'].includes(band)) return 0;
      return -30;
    }
    case 'protein':
      return Math.min(45, recipe.protein * 1.5);
    case 'variety':
      /* Was zuletzt auf dem Tisch stand, tritt in den Hintergrund. */
      return (recent.has(recipe.id) ? -60 : 12)
        + (recipe.familyKey && recentFamilies.has(recipe.familyKey) ? -25 : 8);
    case 'exotic':
      /* Stufe 1 ist "vertraut" — je hoeher, desto ausgefallener. */
      return 26 - Number(recipe.noveltyLevel || 1) * 12;
    case 'heavy':
      return Math.max(-25, 22 - Number(recipe.fat || 0) * 0.6)
        + (recipe.kcal < targetForMeal(context.profile, context.category) ? 14 : -10);
    default:
      return 0;
  }
}

export function scoreRecipe(recipe, context) {
  if (!recipeEligible(recipe, context)) return Number.NEGATIVE_INFINITY;

  const { category, profile, preferences = {}, usedRecipeIds = new Set(), usedFamilies = new Set() } = context;
  const targetKcal = targetForMeal(profile, category);
  const targetProtein = resolveProteinTarget(profile) * (MEAL_TARGET_SHARE[category] || 0.25);

  let score = 100;
  score += closeness(recipe.kcal, targetKcal, 18);
  score += closeness(recipe.protein, targetProtein, 2.2);

  if (profile.simplicity === recipe.simplicity) score += 18;
  if (profile.simplicity === 'simple' && recipe.difficulty === 'easy') score += 10;
  if (profile.simplicity === 'experimental' && includesAny(recipe, ['international', 'experimental'])) score += 10;

  /* Alltagstauglichkeit. Der Katalog ist zu 65 % "vertraut" (Stufe 1), nur
     2 % sind "ausgefallen" (Stufe 5) — ohne Abwertung landeten die Ausreißer
     trotzdem regelmäßig im Plan, weil Vertrautheit gar nicht zählte.
     Ausgefallenes bleibt möglich, ist aber die Ausnahme. */
  const novelty = Number(recipe.noveltyLevel || 0);
  if (novelty > 0) {
    if (profile.simplicity === 'experimental') score += (novelty - 1) * 6;
    else if (profile.simplicity === 'simple') score -= (novelty - 1) * 10;
    else score -= (novelty - 1) * 5;
  }

  const priorities = new Set(profile.priorities || []);
  if (priorities.has('high_protein')) score += Math.min(25, recipe.protein * 0.75);
  if (priorities.has('quick')) score += Math.max(-15, 18 - recipe.time * 0.55);
  if (priorities.has('budget') && ['low', 'budget', 'günstig'].includes(normalToken(recipe.costBand))) score += 18;
  if (priorities.has('meal_prep')) score += Number(recipe.mealPrepScore || 0) * 4;

  score += directionBonus(recipe, context.direction, context);

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
