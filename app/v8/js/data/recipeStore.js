import { RecipeRepository } from './recipeRepository.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/supabaseConfig.js';


export const repository = new RecipeRepository({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });

let cardsPromise = null;
let cards = [];

export async function loadCards() {
  if (!cardsPromise) cardsPromise = repository.listCards();
  try {
    cards = await cardsPromise;
    return cards;
  } catch (error) {
    /* Ein abgelehntes Promise darf nicht im Cache bleiben, sonst scheitert
       jeder spätere Versuch mit demselben alten Fehler. */
    cardsPromise = null;
    throw error;
  }
}

export function getCards() {
  return cards;
}

export async function getRecipe(id) {
  return repository.getRecipe(id);
}
