function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function ingredientKey(ingredient) {
  return `${ingredient.ingredientId || ingredient.foodId || ingredient.name}::${ingredient.unit || 'g'}`;
}

function recipeIngredients(meal) {
  return meal.recipe?.ingredients || meal.ingredients || [];
}

function dayLabel(date) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(`${date}T12:00:00`));
}

function scaledIngredientAmount(ingredient, meal) {
  const baseServings = Number(meal.recipe?.servings || meal.servings || 1) || 1;
  const persons = Number(meal.persons || 1) || 1;
  const factor = Number(meal.portionFactor || 1) || 1;
  return Number(ingredient.amount || 0) / baseServings * persons * factor;
}

function packEstimate(amount, ingredient) {
  const packSize = Number(ingredient.packSize || ingredient.pack_size || 0);
  const packPrice = Number(ingredient.packPrice || ingredient.pack_price_eur || 0);
  if (!packSize || amount <= 0) {
    return { packs: null, buyAmount: amount, estimatedPrice: null };
  }
  const packs = Math.ceil(amount / packSize);
  return {
    packs,
    buyAmount: packs * packSize,
    estimatedPrice: packPrice ? round(packs * packPrice) : null
  };
}

export function availableShoppingDates(plan) {
  return (plan?.days || [])
    .filter((day) => Object.keys(day.meals || {}).length > 0)
    .map((day) => ({ date: day.date, label: dayLabel(day.date) }));
}

export function normalizeSelectedDates(plan, selectedDates) {
  const available = new Set(availableShoppingDates(plan).map((entry) => entry.date));
  if (!selectedDates || selectedDates.length === 0) return [...available];
  return [...new Set(selectedDates)].filter((date) => available.has(date));
}

export function buildShoppingList(plan, selectedDates, previousChecks = {}) {
  const activeDates = normalizeSelectedDates(plan, selectedDates);
  const activeSet = new Set(activeDates);
  const aggregated = new Map();
  const byRecipe = [];

  for (const day of plan?.days || []) {
    if (!activeSet.has(day.date)) continue;
    for (const [category, meal] of Object.entries(day.meals || {})) {
      const mealGroup = {
        date: day.date,
        dayLabel: dayLabel(day.date),
        category,
        recipeId: meal.recipeId || meal.recipe?.id,
        recipeName: meal.recipe?.name || meal.name || 'Unbenanntes Gericht',
        ingredients: []
      };

      for (const ingredient of recipeIngredients(meal)) {
        const amount = scaledIngredientAmount(ingredient, meal);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const key = ingredientKey(ingredient);
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            id: key,
            ingredientId: ingredient.ingredientId || ingredient.foodId || null,
            name: ingredient.name,
            unit: ingredient.unit || 'g',
            category: ingredient.category || 'Sonstiges',
            amount: 0,
            packSize: Number(ingredient.packSize || ingredient.pack_size || 0) || null,
            packPrice: Number(ingredient.packPrice || ingredient.pack_price_eur || 0) || null,
            sources: [],
            checked: Boolean(previousChecks[key])
          });
        }
        const item = aggregated.get(key);
        item.amount += amount;
        item.sources.push({
          date: day.date,
          dayLabel: dayLabel(day.date),
          recipeId: mealGroup.recipeId,
          recipeName: mealGroup.recipeName,
          category,
          amount: round(amount),
          unit: item.unit
        });
        mealGroup.ingredients.push({
          id: key,
          name: ingredient.name,
          amount: round(amount),
          unit: item.unit,
          category: item.category
        });
      }
      byRecipe.push(mealGroup);
    }
  }

  const items = [...aggregated.values()].map((item) => {
    const total = round(item.amount);
    const estimate = packEstimate(total, item);
    return {
      ...item,
      amount: total,
      ...estimate
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const groups = Object.values(items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = { category: item.category, items: [] };
    acc[item.category].items.push(item);
    return acc;
  }, {}));

  return {
    selectedDates: activeDates,
    availableDates: availableShoppingDates(plan),
    items,
    groups,
    byRecipe,
    estimatedTotal: round(items.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0))
  };
}

export function toggleShoppingDate(currentDates, date, plan) {
  const available = new Set(availableShoppingDates(plan).map((entry) => entry.date));
  if (!available.has(date)) return normalizeSelectedDates(plan, currentDates);
  const next = new Set(normalizeSelectedDates(plan, currentDates));
  if (next.has(date)) next.delete(date);
  else next.add(date);
  return [...next].sort();
}

export function shoppingChecksFromList(list) {
  return Object.fromEntries((list?.items || []).map((item) => [item.id, Boolean(item.checked)]));
}

export function copyShoppingText(list) {
  const lines = [`Einkauf für ${list.selectedDates.map(dayLabel).join(', ')}`];
  for (const group of list.groups || []) {
    lines.push('', group.category);
    for (const item of group.items) {
      const amount = item.buyAmount || item.amount;
      const packInfo = item.packs ? ` (${item.packs} Packung${item.packs === 1 ? '' : 'en'})` : '';
      lines.push(`${item.checked ? '✓' : '○'} ${item.name}: ${round(amount)} ${item.unit}${packInfo}`);
    }
  }
  return lines.join('\n');
}
