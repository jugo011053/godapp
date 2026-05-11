// Typen für Mahlzeiten, Rezepte und Meal Prep

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Tags steuern, für wen das Rezept geeignet ist
// ACHTUNG: 'nofish' bedeutet "enthält keinen Fisch" -> für nofish-Diät geeignet
export type RecipeTag =
  | 'general'     // für alle Modi geeignet
  | 'diet'        // kalorienreduziert
  | 'mass'        // kalorienreich, für Masseaufbau
  | 'vegetarian'  // kein Fleisch/Fisch
  | 'nofish'      // kein Fisch enthalten
  | 'nopork'      // kein Schweinefleisch
  | 'quick';      // unter 20 Minuten Zubereitung

// Eine einzelne Zutat in einem Rezept
export interface Ingredient {
  name: string;
  amountBase: number;   // Menge für servingsBase Portionen
  unit: string;         // "g", "ml", "Stück", "TL", "EL"
  isBase: boolean;      // Basiszutaten (Salz, Öl, Pfeffer) -> separate Liste beim Einkauf
  packageSize: number;  // Packungsgröße in der gleichen Einheit, z.B. 500 für 500g
}

// Ein Rezept mit allen Nährwertangaben
export interface Recipe {
  id: string;
  name: string;
  category: MealCategory;
  cookTimeMin: number;
  caloriesBase: number;  // Kalorien für servingsBase Portionen
  proteinBase: number;   // Protein in g
  carbsBase: number;     // Kohlenhydrate in g
  fatBase: number;       // Fett in g
  ingredients: Ingredient[];
  mainProtein: string;   // Haupt-Proteinquelle, z.B. "Hähnchen"
  tags: RecipeTag[];
  servingsBase: number;  // meist 1
}

// Eine geplante Mahlzeit an einem Tag
export interface PlannedMeal {
  mealId: string;         // Slot-ID, z.B. "day1_lunch"
  recipeId: string;
  category: MealCategory;
  scaleFactor: number;    // 1.0 = Basisportion
  caloriesActual: number; // tatsächliche Kalorien nach Skalierung
  proteinActual: number;  // tatsächliches Protein nach Skalierung
}

// Alle Mahlzeiten eines Tages
export interface MealDay {
  date: string;
  breakfast: PlannedMeal;
  lunch: PlannedMeal;
  dinner: PlannedMeal;
  snack: PlannedMeal;
  shake: boolean; // Proteinshake für diesen Tag geplant
}

// Ein Prep-Block deckt 2 Tage ab (A = Tag 1+2, B = Tag 3+4)
export interface MealBlock {
  id: string;        // "A" oder "B"
  prepDate: string;  // Datum der Zubereitung
  coversDay1: string;
  coversDay2: string;
  meals: MealDay[];  // 2 Einträge
}

// Ein vollständiger Meal-Zyklus (4 Tage)
export interface MealCycle {
  cycleStart: string;    // ISO-Datum
  shoppingDate: string;  // Einkaufstag
  blockA: MealBlock;     // Tag 1 + 2
  blockB: MealBlock;     // Tag 3 + 4
}

// Ein einzelner Artikel auf der Einkaufsliste
export interface ShoppingItem {
  name: string;
  totalAmount: number;   // Gesamtmenge aus allen Rezepten
  unit: string;
  roundedAmount: number; // auf Packungsgröße aufgerundet
  packageSize: number;
  isBase: boolean;       // Basiszutat (Salz, Öl etc.)
}

// Vollständige Einkaufsliste für einen Zyklus
export interface ShoppingList {
  cycleId: string;
  generatedAt: string;      // ISO-Timestamp
  items: ShoppingItem[];    // reguläre Zutaten
  baseItems: ShoppingItem[]; // Basiszutaten (Öl, Gewürze etc.)
}
