import { RecipeRepository } from './recipeRepository.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/supabaseConfig.js';
import { idbGet, idbSet } from '../core/idb.js';
import { emit } from '../core/events.js';

export const repository = new RecipeRepository({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });

/* --- Rezeptkatalog mit Cache ---------------------------------------------

   Bis v8.35 wurde der Katalog bei jedem Start frisch aus Supabase geholt.
   Ohne Netz blieb die Einkaufsliste leer — ausgerechnet im Supermarkt, wo
   der Empfang am schlechtesten ist. Jetzt liegt er in IndexedDB (rund 4 MB,
   zu viel fuer localStorage) und wird im Hintergrund erneuert:
   erst zeigen, was da ist, dann nachladen. */

const CACHE_KEY = 'recipe-cards-v1';
const MAX_AGE_MS = 60 * 60 * 1000;

let cards = [];
let refreshPromise = null;

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = repository.listCards()
    .then(async (fresh) => {
      cards = fresh;
      await idbSet(CACHE_KEY, { at: Date.now(), cards: fresh });
      emit('catalog:updated', { count: fresh.length });
      return fresh;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function loadCards() {
  if (cards.length) return cards;

  const cached = await idbGet(CACHE_KEY);
  if (cached?.cards?.length) {
    cards = cached.cards;
    /* Veraltet? Im Hintergrund nachziehen, ohne den Start aufzuhalten.
       Ein Fehlschlag ist hier belanglos — wir haben ja etwas zu zeigen. */
    if (Date.now() - (cached.at || 0) > MAX_AGE_MS) refresh().catch(() => {});
    return cards;
  }

  /* Nichts im Cache: jetzt fuehrt kein Weg am Netz vorbei. */
  return refresh();
}

export function getCards() {
  return cards;
}

/* Der Katalog traegt Zutaten und Schritte bereits mit sich. Eine
   Einzelabfrage lohnt nur fuer Felder, die in der Liste fehlen — und wenn
   sie scheitert, ist die Karte immer noch besser als nichts. */
export async function getRecipe(id) {
  /* Die Karte traegt Zutaten und Schritte mit sich — fuer alles, was die App
     anzeigt, reicht sie. Erst wenn sie fehlt, wird nachgefragt.
     Der Katalog muss dafuer geladen sein: sonst kaeme diese Abfrage zu frueh,
     faende nichts und ginge doch wieder ans Netz. Aus dem Cache kostet das
     nichts. */
  if (!cards.length) await loadCards().catch(() => {});
  const known = cards.find((recipe) => recipe.id === id);
  if (known?.ingredients?.length) return known;
  try {
    return await repository.getRecipe(id) || known || null;
  } catch (error) {
    if (known) return known;
    throw error;
  }
}

/* Nur fuer Tests und den Notfall. */
export async function clearCatalogCache() {
  cards = [];
  await idbSet(CACHE_KEY, null);
}
