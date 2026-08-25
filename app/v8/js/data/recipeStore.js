import { RecipeRepository } from './recipeRepository.js';

const SUPABASE_URL = 'https://rfdtjodpjvynnavnucvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrNRV-ogNAYt2cCoNHDXoKZ8GzE';

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
