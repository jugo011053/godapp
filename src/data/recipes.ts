// Rezeptdatenbank – 10 vollständige Rezepte für Meal Prep
// Nährwerte immer für 1 Portion (servingsBase = 1)

import type { Recipe } from '../types/meal';

export const RECIPES: Recipe[] = [
  // 1. Rührei mit Champignons (Frühstück, vegetarisch, schnell)
  {
    id: 'ruehrei_champignons',
    name: 'Rührei mit Champignons',
    category: 'breakfast',
    cookTimeMin: 10,
    caloriesBase: 340,
    proteinBase: 26,
    carbsBase: 6,
    fatBase: 23,
    servingsBase: 1,
    mainProtein: 'Eier',
    tags: ['general', 'vegetarian', 'nofish', 'nopork', 'quick'],
    ingredients: [
      { name: 'Eier', amountBase: 3, unit: 'Stück', isBase: false, packageSize: 6 },
      { name: 'Champignons', amountBase: 150, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Olivenöl', amountBase: 1, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
      { name: 'Pfeffer', amountBase: 0.5, unit: 'TL', isBase: true, packageSize: 50 },
      { name: 'Schnittlauch', amountBase: 10, unit: 'g', isBase: false, packageSize: 30 },
    ],
  },

  // 2. Overnight Oats (Frühstück, vegetarisch, Diät)
  {
    id: 'overnight_oats',
    name: 'Overnight Oats mit Beeren',
    category: 'breakfast',
    cookTimeMin: 5,
    caloriesBase: 380,
    proteinBase: 22,
    carbsBase: 52,
    fatBase: 8,
    servingsBase: 1,
    mainProtein: 'Magerquark',
    tags: ['general', 'diet', 'vegetarian', 'nofish', 'nopork', 'quick'],
    ingredients: [
      { name: 'Haferflocken (Zartblatt)', amountBase: 80, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Magerquark', amountBase: 100, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Milch (1,5%)', amountBase: 150, unit: 'ml', isBase: false, packageSize: 1000 },
      { name: 'Tiefkühl-Beerenmix', amountBase: 100, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Chiasamen', amountBase: 10, unit: 'g', isBase: false, packageSize: 200 },
      { name: 'Honig', amountBase: 1, unit: 'TL', isBase: false, packageSize: 500 },
    ],
  },

  // 3. Hähnchen mit Reis und Brokkoli (Mittagessen, allgemein, Masse)
  {
    id: 'haehnchen_reis_brokkoli',
    name: 'Hähnchenbrust mit Reis und Brokkoli',
    category: 'lunch',
    cookTimeMin: 30,
    caloriesBase: 520,
    proteinBase: 48,
    carbsBase: 52,
    fatBase: 8,
    servingsBase: 1,
    mainProtein: 'Hähnchen',
    tags: ['general', 'mass', 'nofish', 'nopork'],
    ingredients: [
      { name: 'Hähnchenbrust', amountBase: 200, unit: 'g', isBase: false, packageSize: 1000 },
      { name: 'Basmatireis (trocken)', amountBase: 80, unit: 'g', isBase: false, packageSize: 1000 },
      { name: 'Brokkoli', amountBase: 200, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Olivenöl', amountBase: 1, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Knoblauch', amountBase: 1, unit: 'Stück', isBase: false, packageSize: 1 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
      { name: 'Paprikapulver', amountBase: 1, unit: 'TL', isBase: true, packageSize: 50 },
    ],
  },

  // 4. Lachs mit Süßkartoffel (Abendessen, allgemein, Diät)
  {
    id: 'lachs_suesskartoffel',
    name: 'Lachsfilet mit Süßkartoffel und Spinat',
    category: 'dinner',
    cookTimeMin: 35,
    caloriesBase: 480,
    proteinBase: 40,
    carbsBase: 38,
    fatBase: 16,
    servingsBase: 1,
    mainProtein: 'Lachs',
    tags: ['general', 'diet', 'nopork'],
    ingredients: [
      { name: 'Lachsfilet', amountBase: 180, unit: 'g', isBase: false, packageSize: 360 },
      { name: 'Süßkartoffel', amountBase: 250, unit: 'g', isBase: false, packageSize: 1000 },
      { name: 'Babyspinat', amountBase: 100, unit: 'g', isBase: false, packageSize: 200 },
      { name: 'Olivenöl', amountBase: 1.5, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Zitronensaft', amountBase: 1, unit: 'EL', isBase: false, packageSize: 250 },
      { name: 'Dill (getrocknet)', amountBase: 1, unit: 'TL', isBase: true, packageSize: 10 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
    ],
  },

  // 5. Türkischer Linsensalat (Mittagessen, vegetarisch, Diät)
  {
    id: 'linsen_salat',
    name: 'Türkischer Roten-Linsen-Salat',
    category: 'lunch',
    cookTimeMin: 25,
    caloriesBase: 380,
    proteinBase: 22,
    carbsBase: 54,
    fatBase: 8,
    servingsBase: 1,
    mainProtein: 'Linsen',
    tags: ['diet', 'vegetarian', 'nofish', 'nopork'],
    ingredients: [
      { name: 'Rote Linsen (trocken)', amountBase: 100, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Tomate', amountBase: 150, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Gurke', amountBase: 100, unit: 'g', isBase: false, packageSize: 300 },
      { name: 'Rote Zwiebel', amountBase: 60, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Petersilie', amountBase: 20, unit: 'g', isBase: false, packageSize: 30 },
      { name: 'Olivenöl', amountBase: 2, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Zitronensaft', amountBase: 2, unit: 'EL', isBase: false, packageSize: 250 },
      { name: 'Kreuzkümmel', amountBase: 1, unit: 'TL', isBase: true, packageSize: 30 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
    ],
  },

  // 6. Rinderhack-Bowl (Mittagessen, Masse)
  {
    id: 'rinderhack_bowl',
    name: 'Rinderhack-Bowl mit Quinoa',
    category: 'lunch',
    cookTimeMin: 30,
    caloriesBase: 620,
    proteinBase: 46,
    carbsBase: 58,
    fatBase: 18,
    servingsBase: 1,
    mainProtein: 'Rindfleisch',
    tags: ['general', 'mass', 'nofish', 'nopork'],
    ingredients: [
      { name: 'Rinderhackfleisch (20% Fett)', amountBase: 200, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Quinoa (trocken)', amountBase: 80, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Paprika (rot)', amountBase: 100, unit: 'g', isBase: false, packageSize: 200 },
      { name: 'Mais (Dose)', amountBase: 80, unit: 'g', isBase: false, packageSize: 340 },
      { name: 'Zwiebel', amountBase: 80, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Olivenöl', amountBase: 1, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Tomatenmark', amountBase: 2, unit: 'EL', isBase: false, packageSize: 200 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
      { name: 'Pfeffer', amountBase: 0.5, unit: 'TL', isBase: true, packageSize: 50 },
    ],
  },

  // 7. Griechischer Joghurt mit Beeren (Snack, Diät, vegetarisch, schnell)
  {
    id: 'joghurt_beeren',
    name: 'Griechischer Joghurt mit Beeren und Nüssen',
    category: 'snack',
    cookTimeMin: 3,
    caloriesBase: 250,
    proteinBase: 18,
    carbsBase: 22,
    fatBase: 10,
    servingsBase: 1,
    mainProtein: 'Joghurt',
    tags: ['diet', 'vegetarian', 'nofish', 'nopork', 'quick'],
    ingredients: [
      { name: 'Griechischer Joghurt (0%)', amountBase: 200, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Tiefkühl-Beerenmix', amountBase: 80, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Walnüsse', amountBase: 20, unit: 'g', isBase: false, packageSize: 200 },
      { name: 'Honig', amountBase: 1, unit: 'TL', isBase: false, packageSize: 500 },
    ],
  },

  // 8. Magerquark-Schüssel (Snack, Diät, vegetarisch)
  {
    id: 'magerquark_schuessel',
    name: 'Magerquark-Schüssel mit Banane und Proteinpulver',
    category: 'snack',
    cookTimeMin: 5,
    caloriesBase: 300,
    proteinBase: 38,
    carbsBase: 28,
    fatBase: 2,
    servingsBase: 1,
    mainProtein: 'Magerquark',
    tags: ['diet', 'vegetarian', 'nofish', 'nopork', 'quick'],
    ingredients: [
      { name: 'Magerquark', amountBase: 250, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Banane', amountBase: 100, unit: 'g', isBase: false, packageSize: 150 },
      { name: 'Vanille-Proteinpulver', amountBase: 30, unit: 'g', isBase: false, packageSize: 1000 },
      { name: 'Zimt', amountBase: 0.5, unit: 'TL', isBase: true, packageSize: 20 },
    ],
  },

  // 9. Thunfisch-Wraps (Mittagessen, Diät, enthält Fisch)
  // ACHTUNG: kein 'nofish'-Tag, da Fisch enthalten -> wird für nofish-Diät gefiltert
  {
    id: 'thunfisch_wraps',
    name: 'Thunfisch-Wraps mit Avocado',
    category: 'lunch',
    cookTimeMin: 10,
    caloriesBase: 420,
    proteinBase: 36,
    carbsBase: 38,
    fatBase: 12,
    servingsBase: 1,
    mainProtein: 'Thunfisch',
    tags: ['diet', 'nopork', 'quick'],
    ingredients: [
      { name: 'Thunfisch in Wasser (Dose)', amountBase: 150, unit: 'g', isBase: false, packageSize: 185 },
      { name: 'Vollkorn-Wraps', amountBase: 2, unit: 'Stück', isBase: false, packageSize: 6 },
      { name: 'Avocado', amountBase: 80, unit: 'g', isBase: false, packageSize: 150 },
      { name: 'Eisbergsalat', amountBase: 50, unit: 'g', isBase: false, packageSize: 300 },
      { name: 'Tomate', amountBase: 80, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Limettensaft', amountBase: 1, unit: 'EL', isBase: false, packageSize: 200 },
      { name: 'Salz', amountBase: 0.5, unit: 'TL', isBase: true, packageSize: 500 },
    ],
  },

  // 10. Vollkorn-Pasta mit Hähnchen (Abendessen, allgemein, Masse)
  {
    id: 'pasta_haehnchen',
    name: 'Vollkorn-Pasta mit Hähnchen und Tomatensauce',
    category: 'dinner',
    cookTimeMin: 30,
    caloriesBase: 580,
    proteinBase: 44,
    carbsBase: 72,
    fatBase: 10,
    servingsBase: 1,
    mainProtein: 'Hähnchen',
    tags: ['general', 'mass', 'nofish', 'nopork'],
    ingredients: [
      { name: 'Vollkorn-Penne (trocken)', amountBase: 90, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Hähnchenbrust', amountBase: 180, unit: 'g', isBase: false, packageSize: 1000 },
      { name: 'Tomaten (stückig, Dose)', amountBase: 200, unit: 'g', isBase: false, packageSize: 400 },
      { name: 'Zwiebel', amountBase: 60, unit: 'g', isBase: false, packageSize: 500 },
      { name: 'Knoblauch', amountBase: 2, unit: 'Stück', isBase: false, packageSize: 1 },
      { name: 'Olivenöl', amountBase: 1, unit: 'EL', isBase: true, packageSize: 750 },
      { name: 'Basilikum (getrocknet)', amountBase: 1, unit: 'TL', isBase: true, packageSize: 10 },
      { name: 'Oregano (getrocknet)', amountBase: 1, unit: 'TL', isBase: true, packageSize: 10 },
      { name: 'Salz', amountBase: 1, unit: 'TL', isBase: true, packageSize: 500 },
    ],
  },
];

/**
 * Rezept nach ID suchen
 * Beispiel: getRecipeById('haehnchen_reis_brokkoli') -> Recipe { name: 'Hähnchenbrust...', ... }
 */
export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id);
}

/**
 * Rezepte nach Tags filtern (alle angegebenen Tags müssen vorhanden sein)
 * Beispiel: filterRecipes(['diet', 'vegetarian']) -> [overnight_oats, linsen_salat, ...]
 */
export function filterRecipes(requiredTags: string[]): Recipe[] {
  return RECIPES.filter(r =>
    requiredTags.every(tag => r.tags.includes(tag as any))
  );
}
