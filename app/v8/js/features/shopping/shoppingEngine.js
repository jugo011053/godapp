function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/* Der Schluessel darf die Einheit NICHT enthalten. Sonst wird aus Rapsoel
   in Millilitern und Rapsoel in Essloeffeln zweimal derselbe Einkauf. */
function ingredientKey(ingredient) {
  const id = ingredient.ingredientId || ingredient.foodId;
  if (id) return String(id);
  return normalizeName(ingredient.name);
}

/* Singular und Plural sind derselbe Einkauf: "Knoblauchzehe" und
   "Knoblauchzehen" standen bisher als zwei Posten in der Liste. */
function normalizeName(name = '') {
  return String(name).trim().toLowerCase()
    .replace(/[()]/g, '')
    .replace(/(en|er|n|e)$/, '')
    .replace(/\s+/g, ' ');
}

/* Zaehlbare Einheiten. Bruchteile davon kann man nicht kaufen. */
const COUNTABLE = new Set(['stück', 'stueck', 'stk', 'zehe', 'zehen', 'scheibe', 'scheiben',
  'bund', 'kopf', 'dose', 'dosen', 'packung', 'packungen', 'glas', 'blatt', 'zweig']);

/* Masse, die nur beschreiben, wie viel man beim Kochen nimmt — daraus wird
   kein Einkauf. Steht das als einzige Angabe da, zeigen wir keine Zahl. */
const VAGUE_UNITS = new Set(['nach geschmack', 'etwas', 'prise', 'prisen', 'handvoll', 'nach bedarf']);

export function isCountable(unit) {
  return COUNTABLE.has(String(unit || '').trim().toLowerCase());
}
export function isVague(unit) {
  return VAGUE_UNITS.has(String(unit || '').trim().toLowerCase());
}

/* --- Mengen lesbar machen ------------------------------------------------
   "82,2 g Beeren" ist keine Einkaufsmenge, sondern ein Messwert. Im Laden
   liest das niemand. Der Rundungsschritt waechst mit der Menge, damit jede
   Zahl gleich grob wirkt: 7 g, 80 g, 350 g, 1,2 kg.
   Ausnahme ist `exact` — steht die Menge fuer gekaufte Packungen, ist sie
   schon eine echte Zahl (3 x 250 g) und darf nicht verschoben werden. */

/* Fuenfer-Schritte, keine Zehner: sonst wird aus der Standardpackung
   "125 g" ploetzlich "130 g", und die Zahl stimmt mit nichts mehr ueberein. */
const AMOUNT_STEPS = [
  { below: 10, step: 1 },
  { below: Infinity, step: 5 }
];

function stepFor(value) {
  return AMOUNT_STEPS.find((entry) => value < entry.below).step;
}

/* Deutsches Komma, und keine Nachkommastelle, die nur Null ist. */
function decimal(value, digits) {
  return String(Number(value.toFixed(digits))).replace('.', ',');
}

function withUnit(text, unit) {
  return [text, unit].filter(Boolean).join(' ');
}

export function formatAmount(amount, unit, { exact = false } = {}) {
  const label = String(unit || '').trim();
  const u = label.toLowerCase();
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
  /* "1,2 nach Geschmack" waere Unsinn — dann bleibt nur das Wort stehen. */
  if (isVague(u)) return label;
  if (value <= 0) return '';

  /* Zaehlbares immer aufrunden: ein halbes Ei kauft man nicht. */
  if (isCountable(u)) return withUnit(String(Math.ceil(value - 0.05)), label);

  if (u === 'g' || u === 'ml') {
    const step = stepFor(value);
    /* Erst runden, dann die Einheit waehlen — sonst steht bei 999 g "1000 g"
       statt "1 kg". */
    const rounded = exact ? value : Math.max(step, Math.round(value / step) * step);
    if (rounded >= 1000) return withUnit(decimal(rounded / 1000, 1), u === 'g' ? 'kg' : 'l');
    return withUnit(decimal(rounded, 1), u);
  }

  if (u === 'kg' || u === 'l') {
    /* Unter einer Einheit liest sich die kleine Schwester besser. */
    if (value < 1) return formatAmount(value * 1000, u === 'kg' ? 'g' : 'ml', { exact });
    return withUnit(decimal(value, 2), u);
  }

  /* Loeffelmasse: ein halber Loeffel ist die feinste Angabe, die noch zaehlt. */
  return withUnit(decimal(Math.max(0.5, Math.round(value * 2) / 2), 1), label);
}

/* Grundzutaten, die praktisch jeder vorraetig hat. Sie verschwinden nicht,
   sondern wandern in eine eigene, eingeklappte Gruppe — wer nachsehen will,
   kann es, aber sie blaehen die Liste nicht mehr auf. */
export const STAPLE_NAMES = new Set([
  'salz', 'pfeffer', 'olivenöl', 'rapsöl', 'sonnenblumenöl', 'kokosöl', 'öl',
  'essig', 'balsamico', 'sojasauce', 'sojasoße', 'senf', 'tomatenmark',
  'zucker', 'honig', 'ahornsirup', 'mehl', 'backpulver', 'hefe', 'zimt',
  'vanille', 'paprikapulver', 'kreuzkümmel', 'kurkuma', 'currypulver',
  'chiliflocken', 'oregano', 'thymian', 'rosmarin', 'lorbeerblatt',
  'gemüsebrühe', 'hühnerbrühe', 'gemüsebrühpulver', 'brühe',
  'sesamöl', 'wasser'
]);

const STAPLE_NORMALIZED = new Set([...STAPLE_NAMES].map(normalizeName));

/* Nur ganze Woerter vergleichen. Ein Praefixvergleich machte aus
   "Zuckermais" faelschlich Vorrat, weil "Zucker" darin steckt. */
export function isStaple(name = '') {
  const n = normalizeName(name);
  if (STAPLE_NORMALIZED.has(n)) return true;
  return n.split(/[\s-]+/).some((word) => STAPLE_NORMALIZED.has(word));
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

const WEIGHT_UNITS = new Set(['g', 'kg', 'ml', 'l']);

function unitsCompatible(ingredientUnit, packUnit) {
  const a = (ingredientUnit || '').toLowerCase();
  const b = (packUnit || '').toLowerCase();
  if (a === b) return true;
  if (WEIGHT_UNITS.has(a) && WEIGHT_UNITS.has(b)) return true;
  return false;
}

function convertToPackUnit(amount, ingredientUnit, packUnit) {
  const from = (ingredientUnit || '').toLowerCase();
  const to = (packUnit || '').toLowerCase();
  if (from === to) return amount;
  if (from === 'kg' && to === 'g') return amount * 1000;
  if (from === 'g' && to === 'kg') return amount / 1000;
  if (from === 'l' && to === 'ml') return amount * 1000;
  if (from === 'ml' && to === 'l') return amount / 1000;
  return amount;
}

function packEstimate(amount, ingredient) {
  const packSize = Number(ingredient.packSize || ingredient.pack_size || 0);
  const packPrice = Number(ingredient.packPrice || ingredient.pack_price_eur || 0);
  const packUnit = (ingredient.packUnit || ingredient.pack_unit || '').toLowerCase();
  const ingredientUnit = (ingredient.unit || '').toLowerCase();

  if (!packSize || amount <= 0 || !unitsCompatible(ingredientUnit, packUnit)) {
    return { packs: null, buyAmount: round(amount), estimatedPrice: null };
  }
  const converted = convertToPackUnit(amount, ingredientUnit, packUnit);
  const packs = Math.ceil(converted / packSize);
  return {
    packs,
    buyAmount: round(packs * packSize),
    buyUnit: packUnit || ingredientUnit,
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
            /* Mengen je Einheit getrennt sammeln — 500 g und 1,2 EL sind
               derselbe Einkauf, aber nicht dieselbe Zahl. */
            byUnit: {},
            staple: isStaple(ingredient.name),
            packSize: Number(ingredient.packSize || ingredient.pack_size || 0) || null,
            packPrice: Number(ingredient.packPrice || ingredient.pack_price_eur || 0) || null,
            /* Ohne packUnit hält packEstimate() die Einheiten für unvereinbar und
               liefert nie Packungen oder Preise. */
            packUnit: ingredient.packUnit || ingredient.pack_unit || null,
            sources: [],
            checked: Boolean(previousChecks[key])
          });
        }
        const item = aggregated.get(key);
        const unit = ingredient.unit || 'g';
        item.byUnit[unit] = (item.byUnit[unit] || 0) + amount;
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
    /* Die Einkaufseinheit ist die, fuer die es Packungsdaten gibt — sonst die
       mit der groessten Menge. Nebenmasse wie "1,2 EL Oel" aendern nichts
       daran, dass man eine Flasche kauft. */
    const units = Object.entries(item.byUnit);
    const packUnit = String(item.packUnit || '').toLowerCase();
    const buyable = units.find(([u]) => unitsCompatible(u, packUnit) && item.packSize);
    const [chosenUnit, chosenAmount] = buyable
      || units.slice().sort((a, b) => b[1] - a[1])[0]
      || [item.unit, item.amount];

    const usable = units.filter(([u]) => !isVague(u));
    const displayUnit = isVague(chosenUnit) && usable.length ? usable[0][0] : chosenUnit;
    const displayAmountRaw = isVague(chosenUnit) && usable.length ? usable[0][1] : chosenAmount;

    /* Zaehlbares aufrunden: 2,4 Eier gibt es nicht. */
    const total = isCountable(displayUnit)
      ? Math.ceil(round(displayAmountRaw))
      : round(displayAmountRaw);

    const estimate = packEstimate(total, { ...item, unit: displayUnit });
    return {
      ...item,
      unit: displayUnit,
      amount: total,
      /* Nur anzeigen, wenn die Zahl etwas bedeutet. */
      showAmount: !isVague(displayUnit),
      otherUnits: units.filter(([u]) => u !== displayUnit && !isVague(u))
        .map(([u, v]) => ({ unit: u, amount: round(v) })),
      ...estimate
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const staples = items.filter((item) => item.staple);
  const regular = items.filter((item) => !item.staple);

  const groups = Object.values(regular.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = { category: item.category, items: [] };
    acc[item.category].items.push(item);
    return acc;
  }, {}));

  return {
    selectedDates: activeDates,
    availableDates: availableShoppingDates(plan),
    items,
    regular,
    staples,
    groups,
    byRecipe,
    /* Grundzutaten zaehlen nicht in die Schaetzung — sonst steht da ein Preis
       fuer eine Flasche Oel, die laengst im Schrank steht. */
    estimatedTotal: round(regular.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0))
  };
}

export function toggleShoppingDate(currentDates, date, plan) {
  const available = new Set(availableShoppingDates(plan).map((entry) => entry.date));
  if (!available.has(date)) return normalizeSelectedDates(plan, currentDates);
  const next = new Set(normalizeSelectedDates(plan, currentDates));
  if (next.has(date)) {
    /* Der letzte Tag bleibt stehen — eine leere Auswahl würde von
       normalizeSelectedDates wieder auf "alle Tage" zurückfallen. */
    if (next.size === 1) return [...next];
    next.delete(date);
  } else {
    next.add(date);
  }
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
      const amount = item.packs ? item.buyAmount : item.amount;
      const packInfo = item.packs ? ` (${item.packs} Packung${item.packs === 1 ? '' : 'en'})` : '';
      const menge = formatAmount(amount, item.buyUnit || item.unit, { exact: Boolean(item.packs) });
      lines.push(`${item.checked ? '✓' : '○'} ${item.name}${menge ? `: ${menge}` : ''}${packInfo}`);
    }
  }
  if (list.estimatedTotal) lines.push('', `Geschätzt: ca. ${list.estimatedTotal.toFixed(2).replace('.', ',')} €`);
  return lines.join('\n');
}
