// Hilfsfunktionen für Nährwertberechnungen

import type { Goal } from '../types/profile';

/**
 * Berechnet den Kalorienbedarf basierend auf Gewicht und Ziel
 * Vereinfachte Mifflin-St-Jeor-Formel + Aktivitätsfaktor
 * Beispiel: calcCalorieTarget(85, 'muscle') -> 2800
 */
export function calcCalorieTarget(weightKg: number, goal: Goal): number {
  // Grundumsatz (vereinfacht, ohne Geschlecht/Größe da diese optional sind)
  const bmr = 10 * weightKg + 500; // vereinfacht

  // Aktivitätsfaktor je nach Ziel
  const activityFactors: Record<Goal, number> = {
    weightloss: 1.3,
    muscle:     1.6,
    fitness:    1.4,
    energy:     1.4,
    structure:  1.3,
    boxing:     1.6,
    football:   1.6,
    tennis:     1.5,
    rehab:      1.2,
    mobility:   1.2,
  };

  const tdee = bmr * (activityFactors[goal] ?? 1.4);

  // Kalorienanpassung je nach Ziel
  if (goal === 'weightloss') return Math.round(tdee - 500);
  if (goal === 'muscle')     return Math.round(tdee + 200);
  return Math.round(tdee);
}

/**
 * Berechnet das Proteinziel in Gramm (1.8g pro kg Körpergewicht)
 * Beispiel: calcProteinTarget(85) -> 153
 */
export function calcProteinTarget(weightKg: number): number {
  return Math.round(1.8 * weightKg);
}

/**
 * Rundet eine Menge auf die nächste Packungsgröße auf
 * Beispiel: roundToPackageSize(650, 500) -> 1000 (2 Packungen à 500g)
 */
export function roundToPackageSize(amount: number, packageSize: number): number {
  if (packageSize <= 0) return amount;
  return Math.ceil(amount / packageSize) * packageSize;
}

/**
 * Skaliert eine Zutatenmenge sinnvoll je nach Einheit
 * - Eier (Stück): immer ganze Zahlen
 * - Fleisch/Fisch (g): 20g-Schritte
 * - Gemüse (g): 25g-Schritte
 * - Pasta/Reis (g): 10g-Schritte
 * - Flüssigkeiten (ml): 10ml-Schritte
 * - Sonstiges: 1er-Schritte
 * Beispiel: scaleIngredientAmount(180, 1.3, 'g') -> 180 (Fleisch -> nächste 20g)
 */
export function scaleIngredientAmount(
  baseAmount: number,
  scaleFactor: number,
  unit: string,
  ingredientName = ''
): number {
  const scaled = baseAmount * scaleFactor;
  const nameLower = ingredientName.toLowerCase();

  // Eier -> immer ganze Stück
  if (unit === 'Stück' || nameLower.includes('ei')) {
    return Math.max(1, Math.round(scaled));
  }

  // Gramm: Schrittgröße je nach Zutat
  if (unit === 'g') {
    // Fleisch/Fisch -> 20g Schritte
    const meatKeywords = ['hähnchen', 'fleisch', 'fisch', 'lachs', 'rind', 'schwein', 'pute', 'thunfisch', 'beef', 'chicken'];
    if (meatKeywords.some(k => nameLower.includes(k))) {
      return Math.round(scaled / 20) * 20;
    }
    // Pasta, Reis, Haferflocken -> 10g Schritte
    const grainKeywords = ['pasta', 'reis', 'hafer', 'nudel', 'couscous', 'quinoa'];
    if (grainKeywords.some(k => nameLower.includes(k))) {
      return Math.round(scaled / 10) * 10;
    }
    // Gemüse -> 25g Schritte
    return Math.round(scaled / 25) * 25;
  }

  // Milliliter -> 10ml Schritte
  if (unit === 'ml') {
    return Math.round(scaled / 10) * 10;
  }

  // TL, EL, sonstige -> auf 0.5 runden
  return Math.round(scaled * 2) / 2;
}

/**
 * Berechnet tatsächliche Kalorien nach Skalierung
 * Beispiel: scaleCalories(400, 1.5) -> 600
 */
export function scaleCalories(baseCalories: number, scaleFactor: number): number {
  return Math.round(baseCalories * scaleFactor);
}

/**
 * Berechnet tatsächliches Protein nach Skalierung
 * Beispiel: scaleProtein(30, 1.5) -> 45
 */
export function scaleProtein(baseProtein: number, scaleFactor: number): number {
  return Math.round(baseProtein * scaleFactor);
}
