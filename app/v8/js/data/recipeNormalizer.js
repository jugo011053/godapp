const ALLERGEN_MAP = Object.freeze({
  egg: 'eggs', eggs: 'eggs', ei: 'eggs', eier: 'eggs',
  milk: 'dairy', dairy: 'dairy', milch: 'dairy', lactose: 'dairy', laktose: 'dairy',
  nuts: 'nuts', nut: 'nuts', nuts_peanuts: 'nuts', peanut: 'nuts', peanuts: 'nuts',
  nuss: 'nuts', nüsse: 'nuts', erdnuss: 'nuts', erdnüsse: 'nuts',
  soy: 'soy', soja: 'soy',
  fish: 'fish', fisch: 'fish',
  shellfish: 'shellfish', crustaceans: 'shellfish', schalentiere: 'shellfish',
  gluten: 'gluten', wheat: 'gluten', weizen: 'gluten',
  sesame: 'sesame', sesam: 'sesame',
  mustard: 'mustard', senf: 'mustard',
  celery: 'celery', sellerie: 'celery',
  sulphites: 'sulphites', sulfite: 'sulphites'
});

const COMPLETE_DISH_TYPES = new Set([
  'bowl', 'pfanne', 'pasta', 'curry', 'eintopf', 'auflauf', 'wrap', 'burger',
  'pizza', 'salat_hauptgericht', 'suppe_hauptgericht', 'sandwich', 'frühstück',
  'breakfast', 'main', 'hauptgericht',
  /* Werte, wie sie tatsächlich in classification.dish_type stehen */
  'pfannengericht/sonstiges', 'suppe', 'pasta/nudeln', 'salat', 'curry/dal',
  'ofengericht', 'reis/getreide', 'porridge/müsli', 'eiergericht',
  'wrap/sandwich', 'bratling/burger', 'wok/pfanne', 'spieß/grill',
  'pfannkuchen/crêpe', 'smoothie/shake'
]);

const BASE_DISH_TYPES = new Set([
  'brühe', 'basis', 'dip', 'sauce', 'beilage', 'topping', 'dip/aufstrich'
]);

/* Der Katalog liefert die Mahlzeitenrolle auf Deutsch. Ohne diese Zuordnung
   trifft inferMealRole() nie den expliziten Wert und rät über Kalorien. */
const MEAL_ROLE_MAP = {
  hauptmahlzeit: 'complete_meal',
  'leichte mahlzeit': 'light_meal',
  frühstück: 'complete_meal',
  snack: 'light_meal',
  getränk: 'base',
  beilage: 'side'
};

/* novelty_level steht als Wort in der Datenbank, nicht als Zahl. Number()
   ergab darauf NaN, womit jeder Größenvergleich in inferSimplicity() falsch
   wurde und alle Rezepte als "balanced" endeten. */
const NOVELTY_MAP = {
  vertraut: 1,
  alltäglich: 1,
  abwechslungsreich: 3,
  ausgefallen: 5,
  experimentell: 5
};

function token(value) {
  return String(value || '').trim().toLowerCase();
}

/* dish_type ist ein Array (z. B. ["Pfannengericht/sonstiges"]). */
export function dishTypeToken(classification = {}) {
  const raw = classification.dish_type;
  if (Array.isArray(raw)) return token(raw[0]);
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return token(parsed[0]);
    } catch { /* unten als Klartext behandeln */ }
  }
  return token(raw);
}

export function noveltyLevel(classification = {}) {
  const raw = classification.novelty_level;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  return NOVELTY_MAP[token(raw)] ?? 0;
}

export function normalizeAllergens(values = []) {
  return [...new Set(values.map((value) => ALLERGEN_MAP[token(value)] || token(value)).filter(Boolean))].sort();
}

export function normalizeDietTags(values = [], classification = {}) {
  const tags = new Set(values.map(token).filter(Boolean));
  const style = token(classification.dietary_style);
  if (style) tags.add(style);
  if (tags.has('vegan')) tags.add('vegetarian');
  return [...tags].sort();
}

export function inferMealRole(recipe) {
  const classification = recipe.classification || {};
  const explicit = token(classification.meal_role || recipe.meal_role);
  if (['complete_meal', 'light_meal', 'side', 'base'].includes(explicit)) return explicit;
  if (MEAL_ROLE_MAP[explicit]) return MEAL_ROLE_MAP[explicit];

  const dishType = dishTypeToken(classification);
  if (BASE_DISH_TYPES.has(dishType)) return 'base';
  if (COMPLETE_DISH_TYPES.has(dishType)) return 'complete_meal';

  const category = recipe.cat || recipe.category;
  const kcal = Number(recipe.kcal || classification.kcal_serving || 0);
  const protein = Number(recipe.protein || classification.protein_serving_g || 0);
  if (category === 'snack') return 'light_meal';
  if (['lunch', 'dinner'].includes(category) && (kcal < 250 || protein < 10)) return 'light_meal';
  if (category === 'breakfast' && kcal < 180) return 'light_meal';
  return 'complete_meal';
}

export function inferSimplicity(recipe) {
  const classification = recipe.classification || {};
  const novelty = noveltyLevel(classification);
  const time = Number(recipe.time || classification.total_time_min || 0);
  const difficulty = token(recipe.difficulty || classification.difficulty);
  const ingredientCount = Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;

  if (difficulty === 'easy' && time <= 30 && ingredientCount <= 12 && novelty <= 2) return 'simple';
  if (difficulty === 'hard' || time > 60 || novelty >= 4 || ingredientCount > 20) return 'experimental';
  return 'balanced';
}

export function qualityAssessment(recipe) {
  const issues = [];
  const category = recipe.cat || recipe.category;
  const kcal = Number(recipe.kcal || 0);
  const protein = Number(recipe.protein || 0);
  const servings = Number(recipe.servings || 0);
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];

  if (!recipe.id || !recipe.name) issues.push('missing_identity');
  if (!['breakfast', 'lunch', 'dinner', 'snack', 'shake'].includes(category)) issues.push('invalid_category');
  if (!Number.isFinite(kcal) || kcal <= 0) issues.push('invalid_kcal');
  if (!Number.isFinite(protein) || protein < 0) issues.push('invalid_protein');
  if (!Number.isFinite(servings) || servings <= 0) issues.push('invalid_servings');
  if (!ingredients.length) issues.push('missing_ingredients');
  if (!steps.length) issues.push('missing_steps');
  if (['lunch', 'dinner'].includes(category) && kcal < 180) issues.push('implausibly_light_main');
  if (['lunch', 'dinner'].includes(category) && protein === 0) issues.push('zero_protein_main');
  if (kcal > 1400) issues.push('implausibly_high_kcal');
  if (ingredients.some((item) => Number(item.amount) <= 0)) issues.push('nonpositive_ingredient_amount');

  const critical = issues.some((issue) => [
    'missing_identity', 'invalid_category', 'invalid_kcal', 'invalid_servings',
    'missing_ingredients', 'implausibly_light_main', 'zero_protein_main',
    'implausibly_high_kcal', 'nonpositive_ingredient_amount'
  ].includes(issue));

  const score = Number(recipe.quality_score || 0);
  const status = critical ? 'blocked' : issues.length || score < 85 ? 'review' : 'approved';
  return { status, issues };
}

function primaryProtein(recipe) {
  const sources = recipe.classification?.protein_sources;
  if (Array.isArray(sources) && sources.length) return token(sources[0]);
  return null;
}

function familyKey(recipe) {
  const classification = recipe.classification || {};
  return [
    recipe.cat || recipe.category,
    dishTypeToken(classification),
    primaryProtein(recipe)
  ].filter(Boolean).join(':') || String(recipe.id);
}

export function normalizeCatalogRecipe(recipe) {
  const quality = qualityAssessment(recipe);
  const classification = recipe.classification || {};
  return {
    ...recipe,
    category: recipe.cat || recipe.category || 'dinner',
    allergens: normalizeAllergens(recipe.allergens || []),
    dietTags: normalizeDietTags(recipe.diet_tags || recipe.dietTags || [], classification),
    mealRole: inferMealRole(recipe),
    simplicity: inferSimplicity(recipe),
    mealPrepScore: Number(classification.meal_prep_score_v2 || recipe.mealPrepScore || 0),
    noveltyLevel: noveltyLevel(classification),
    costBand: classification.cost_band || recipe.costBand || 'unknown',
    qualityStatus: quality.status,
    qualityIssues: quality.issues,
    planEligible: Boolean(recipe.is_plan_eligible) && quality.status !== 'blocked',
    familyKey: familyKey(recipe),
    primaryProtein: primaryProtein(recipe),
    dishType: dishTypeToken(classification) || null,
    ingredientNames: (recipe.ingredients || []).map((ingredient) => ingredient.name).filter(Boolean)
  };
}

export function buildQualityReport(recipes = []) {
  const normalized = recipes.map(normalizeCatalogRecipe);
  const issueCounts = {};
  for (const recipe of normalized) {
    for (const issue of recipe.qualityIssues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }
  return {
    total: normalized.length,
    approved: normalized.filter((recipe) => recipe.qualityStatus === 'approved').length,
    review: normalized.filter((recipe) => recipe.qualityStatus === 'review').length,
    blocked: normalized.filter((recipe) => recipe.qualityStatus === 'blocked').length,
    planEligible: normalized.filter((recipe) => recipe.planEligible).length,
    issueCounts,
    blockedRecipes: normalized
      .filter((recipe) => recipe.qualityStatus === 'blocked')
      .map((recipe) => ({ id: recipe.id, code: recipe.code, name: recipe.name, issues: recipe.qualityIssues }))
  };
}
