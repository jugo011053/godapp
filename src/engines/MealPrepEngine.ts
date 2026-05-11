// Meal Prep Engine: Erstellt Mahlzeitenzyklen, skaliert Rezepte und generiert Einkaufslisten

import type { UserProfile, DietStyle, MealMode } from '../types/profile';
import type {
  Recipe,
  MealCycle,
  MealBlock,
  MealDay,
  PlannedMeal,
  MealCategory,
  ShoppingList,
  ShoppingItem,
  RecipeTag,
  Ingredient,
} from '../types/meal';
import { nextShoppingDay } from '../data/holidays';
import { roundToPackageSize, scaleIngredientAmount } from '../utils/nutritionUtils';

// --- Hilfsfunktionen ---

/**
 * Berechnet ein ISO-Datum + n Tage
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Prüft ob ein Rezept für ein Profil geeignet ist (Diät, Allergien, Tags)
 * - nofish-Diät -> kein Rezept mit Fisch (d.h. Rezept braucht 'nofish'-Tag)
 * - nopork -> Rezept braucht 'nopork'-Tag
 * - vegetarian -> Rezept braucht 'vegetarian'-Tag
 * - Allergien: einfacher Name-Check in Zutaten
 */
function isRecipeSuitable(recipe: Recipe, profile: UserProfile): boolean {
  const { dietStyle, mealMode, allergies } = profile;

  // Diät-Filter
  if (dietStyle === 'nofish' && !recipe.tags.includes('nofish')) return false;
  if (dietStyle === 'nopork' && !recipe.tags.includes('nopork')) return false;
  if (dietStyle === 'vegetarian' && !recipe.tags.includes('vegetarian')) return false;

  // Modus-Filter: diet-Rezepte auch im general-Modus erlaubt
  if (mealMode === 'diet' && recipe.tags.includes('mass') && !recipe.tags.includes('diet')) {
    return false;
  }

  // Allergien: grobe Prüfung auf Zutatennamen
  if (allergies.length > 0) {
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase();
      const hasAllergen = recipe.ingredients.some(ing =>
        ing.name.toLowerCase().includes(allergyLower)
      );
      if (hasAllergen) return false;
    }
  }

  return true;
}

/**
 * Wählt ein geeignetes Rezept für eine Kategorie, ohne bereits verwendete Rezepte
 */
function pickRecipe(
  category: MealCategory,
  recipes: Recipe[],
  profile: UserProfile,
  usedIds: Set<string>
): Recipe | null {
  const suitable = recipes.filter(
    r => r.category === category &&
    isRecipeSuitable(r, profile) &&
    !usedIds.has(r.id)
  );
  if (suitable.length === 0) {
    // Fallback: Bereits verwendete erlauben
    const fallback = recipes.filter(
      r => r.category === category && isRecipeSuitable(r, profile)
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return suitable[Math.floor(Math.random() * suitable.length)];
}

// --- Hauptfunktionen ---

/**
 * scaleRecipe: Skaliert ein Rezept auf Kalorien- und Proteinziel
 *
 * - Berechnet Skalierungsfaktor
 * - Rundet Zutaten auf sinnvolle Schritte
 * - Eier nur ganze Zahlen
 * - Fleisch in 20g Schritten
 * - Reis/Pasta in 10g Schritten
 *
 * Beispiel:
 *   scaleRecipe(haehnchen, 600, 50) -> { scaleFactor: 1.15, scaledIngredients: [...] }
 */
export function scaleRecipe(
  recipe: Recipe,
  targetCalories: number,
  targetProtein: number
): { scaleFactor: number; scaledIngredients: Array<Ingredient & { scaledAmount: number }> } {
  // Skalierungsfaktor primär nach Kalorien, korrigiert durch Protein
  const calorieScale = targetCalories / recipe.caloriesBase;
  const proteinScale = targetProtein / recipe.proteinBase;

  // Mittlerer Skalierungsfaktor aus beiden Zielen
  const scaleFactor = (calorieScale * 0.6 + proteinScale * 0.4);

  const scaledIngredients = recipe.ingredients.map(ing => ({
    ...ing,
    scaledAmount: scaleIngredientAmount(ing.amountBase, scaleFactor, ing.unit, ing.name),
  }));

  return { scaleFactor, scaledIngredients };
}

/**
 * Erstellt eine geplante Mahlzeit für einen Slot
 */
function buildPlannedMeal(
  slotId: string,
  recipe: Recipe,
  profile: UserProfile
): PlannedMeal {
  // Kalorienanteil pro Mahlzeit je nach Kategorie
  const calorieTarget = profile.calorieTarget ?? 2000;
  const caloriesByCategory: Record<MealCategory, number> = {
    breakfast: calorieTarget * 0.25,
    lunch:     calorieTarget * 0.35,
    dinner:    calorieTarget * 0.30,
    snack:     calorieTarget * 0.10,
  };

  const targetCal = caloriesByCategory[recipe.category];
  const targetPro = (profile.proteinTargetG ?? 150) / 4; // Protein gleichmäßig auf 4 Mahlzeiten

  const { scaleFactor } = scaleRecipe(recipe, targetCal, targetPro);

  return {
    mealId: slotId,
    recipeId: recipe.id,
    category: recipe.category,
    scaleFactor,
    caloriesActual: Math.round(recipe.caloriesBase * scaleFactor),
    proteinActual: Math.round(recipe.proteinBase * scaleFactor),
  };
}

/**
 * Erstellt einen MealDay für ein gegebenes Datum
 */
function buildMealDay(
  date: string,
  dayIndex: number,
  recipes: Recipe[],
  profile: UserProfile,
  usedIds: Set<string>
): MealDay {
  const breakfastRecipe = pickRecipe('breakfast', recipes, profile, usedIds);
  const lunchRecipe     = pickRecipe('lunch', recipes, profile, usedIds);
  const dinnerRecipe    = pickRecipe('dinner', recipes, profile, usedIds);
  const snackRecipe     = profile.snacksEnabled
    ? pickRecipe('snack', recipes, profile, usedIds)
    : null;

  // Verwendete IDs merken (optional: gleiche Rezepte über Tage erlaubt für Prep)
  if (breakfastRecipe) usedIds.add(breakfastRecipe.id);

  const fallbackMeal = (category: MealCategory): PlannedMeal => ({
    mealId: `day${dayIndex}_${category}`,
    recipeId: '',
    category,
    scaleFactor: 1,
    caloriesActual: 0,
    proteinActual: 0,
  });

  return {
    date,
    breakfast: breakfastRecipe
      ? buildPlannedMeal(`day${dayIndex}_breakfast`, breakfastRecipe, profile)
      : fallbackMeal('breakfast'),
    lunch: lunchRecipe
      ? buildPlannedMeal(`day${dayIndex}_lunch`, lunchRecipe, profile)
      : fallbackMeal('lunch'),
    dinner: dinnerRecipe
      ? buildPlannedMeal(`day${dayIndex}_dinner`, dinnerRecipe, profile)
      : fallbackMeal('dinner'),
    snack: snackRecipe
      ? buildPlannedMeal(`day${dayIndex}_snack`, snackRecipe, profile)
      : fallbackMeal('snack'),
    shake: profile.shakeEnabled,
  };
}

/**
 * buildMealCycle: Erstellt einen vollständigen Meal-Zyklus (4 Tage, 2 Blöcke)
 *
 * - Bestimmt Einkaufstag (nicht Sonntag/Feiertag)
 * - Wählt Rezepte passend zu Profil (Mode, Tags, Allergien)
 * - Erstellt Block A (Tag 1+2) und Block B (Tag 3+4)
 * - Berechnet Skalierungsfaktor pro Rezept
 *
 * Beispiel:
 *   buildMealCycle("2024-01-15", profile, RECIPES)
 *   // -> MealCycle { cycleStart: "2024-01-15", shoppingDate: "2024-01-15", blockA: {...}, blockB: {...} }
 */
export function buildMealCycle(
  cycleStartDate: string,
  profile: UserProfile,
  recipes: Recipe[]
): MealCycle {
  // Einkaufstag: ab Zyklusstart, erster erlaubter Tag
  const shoppingDate = nextShoppingDay(cycleStartDate);

  // Prep-Tag für Block A: Einkaufstag oder nächster Tag
  const prepDateA = shoppingDate;
  // Prep-Tag für Block B: 2 Tage nach Block-A-Start
  const prepDateB = addDays(cycleStartDate, 3);

  const usedIds = new Set<string>();

  // Block A: Tag 1 und Tag 2
  const day1 = buildMealDay(cycleStartDate, 1, recipes, profile, usedIds);
  const day2 = buildMealDay(addDays(cycleStartDate, 1), 2, recipes, profile, usedIds);

  const blockA: MealBlock = {
    id: 'A',
    prepDate: prepDateA,
    coversDay1: cycleStartDate,
    coversDay2: addDays(cycleStartDate, 1),
    meals: [day1, day2],
  };

  // Block B: Tag 3 und Tag 4
  const day3 = buildMealDay(addDays(cycleStartDate, 2), 3, recipes, profile, new Set());
  const day4 = buildMealDay(addDays(cycleStartDate, 3), 4, recipes, profile, new Set());

  const blockB: MealBlock = {
    id: 'B',
    prepDate: prepDateB,
    coversDay1: addDays(cycleStartDate, 2),
    coversDay2: addDays(cycleStartDate, 3),
    meals: [day3, day4],
  };

  return {
    cycleStart: cycleStartDate,
    shoppingDate,
    blockA,
    blockB,
  };
}

/**
 * swapMeal: Tauscht eine Mahlzeit gegen eine andere geeignete Mahlzeit aus
 *
 * - Wählt ein anderes Rezept gleicher Kategorie
 * - Gleicher Mode, gleiche Einschränkungen
 * - Nicht das gleiche Rezept wie bisher
 *
 * Beispiel:
 *   swapMeal(mealDay, 'lunch', RECIPES, profile)
 *   // -> PlannedMeal { recipeId: 'linsen_salat', ... }
 */
export function swapMeal(
  mealDay: MealDay,
  category: MealCategory,
  recipes: Recipe[],
  profile: UserProfile
): PlannedMeal {
  // Aktuelles Rezept der Kategorie ermitteln
  const currentMeal = mealDay[category as keyof Pick<MealDay, 'breakfast' | 'lunch' | 'dinner' | 'snack'>] as PlannedMeal;
  const excludedIds = new Set<string>([currentMeal.recipeId]);

  const newRecipe = pickRecipe(category, recipes, profile, excludedIds);

  if (!newRecipe) {
    // Kein anderes Rezept verfügbar -> aktuelles beibehalten
    return currentMeal;
  }

  const dayIndex = mealDay.date.slice(-2); // einfacher Tagesindex aus Datum
  return buildPlannedMeal(`day${dayIndex}_${category}`, newRecipe, profile);
}

/**
 * generateShoppingList: Erstellt eine Einkaufsliste für einen Meal-Zyklus
 *
 * - Addiert alle Zutaten aller 4 Tage
 * - Rundet auf Packungsgrößen auf
 * - Trennt Basiszutaten (Öl, Salz, etc.)
 *
 * Beispiel:
 *   generateShoppingList(mealCycle, RECIPES)
 *   // -> ShoppingList { items: [...], baseItems: [...] }
 */
export function generateShoppingList(
  mealCycle: MealCycle,
  recipes: Recipe[]
): ShoppingList {
  // Alle PlannedMeals aus beiden Blöcken sammeln
  const allMeals: PlannedMeal[] = [];
  for (const block of [mealCycle.blockA, mealCycle.blockB]) {
    for (const day of block.meals) {
      allMeals.push(day.breakfast, day.lunch, day.dinner);
      if (day.snack?.recipeId) allMeals.push(day.snack);
    }
  }

  // Zutaten akkumulieren: Map von "Name_Einheit" -> ShoppingItem
  const itemMap = new Map<string, ShoppingItem>();

  for (const meal of allMeals) {
    if (!meal.recipeId) continue;

    const recipe = recipes.find(r => r.id === meal.recipeId);
    if (!recipe) continue;

    for (const ing of recipe.ingredients) {
      const scaledAmount = scaleIngredientAmount(
        ing.amountBase,
        meal.scaleFactor,
        ing.unit,
        ing.name
      );

      const key = `${ing.name}__${ing.unit}`;
      const existing = itemMap.get(key);

      if (existing) {
        existing.totalAmount += scaledAmount;
      } else {
        itemMap.set(key, {
          name: ing.name,
          totalAmount: scaledAmount,
          unit: ing.unit,
          roundedAmount: 0, // wird unten berechnet
          packageSize: ing.packageSize,
          isBase: ing.isBase,
        });
      }
    }
  }

  // Auf Packungsgrößen aufrunden
  const allItems = Array.from(itemMap.values()).map(item => ({
    ...item,
    roundedAmount: roundToPackageSize(item.totalAmount, item.packageSize),
  }));

  // In reguläre Zutaten und Basiszutaten trennen
  const items = allItems.filter(i => !i.isBase);
  const baseItems = allItems.filter(i => i.isBase);

  return {
    cycleId: mealCycle.cycleStart,
    generatedAt: new Date().toISOString(),
    items,
    baseItems,
  };
}
