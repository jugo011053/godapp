import { isStaple } from '../shopping/shoppingEngine.js';

/* --- "Was hast du da?" ----------------------------------------------------

   Der Nutzer wirft hin, was im Kuehlschrank liegt; wir suchen im Katalog, was
   sich daraus kochen laesst. Bewusst ohne Sprachmodell: die 600 Rezepte samt
   Zutaten liegen ohnehin im Geraet, der Abgleich ist eine Rechnung und keine
   Frage. Das ist nicht nur billiger, es ist auch richtiger — ein erfundenes
   Gericht haette weder Naehrwerte noch Allergene, und genau die entscheiden
   hier darueber, ob jemand es essen darf. */

/* Grundzutaten zaehlen nicht mit. Wer Salz, Pfeffer und Oel im Haus hat, will
   deswegen nicht gefragt werden — und ein Rezept gilt nicht als "fehlt dir",
   weil Salz fehlt. */
function relevantIngredients(recipe) {
  return (recipe.ingredients || [])
    .map((item) => item?.name)
    .filter(Boolean)
    .filter((name) => !isStaple(name));
}

/* Fuer den Vergleich zaehlen Wortstaemme, nicht Schreibweisen: "Tomaten",
   "Kirschtomaten" und "Tomate" sollen einander finden. */
export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[(),.;:/]/g, ' ')
    .split(/[\s-]+/)
    /* Nur die haeufigen Pluralendungen abschneiden. Ein "s" bleibt stehen —
       sonst wird aus "Reis" ein "Rei" und findet nichts mehr. */
    .map((word) => word.replace(/(en|er|n|e)$/, ''))
    .filter((word) => word.length >= 2);
}

export function parsePantryInput(text) {
  return [...new Set(
    String(text || '')
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 1)
  )];
}

/* Ein Treffer, wenn sich die Wortstaemme ueberschneiden. "Passierte Tomaten"
   trifft auf "Tomate", "Rote Zwiebeln" auf "Zwiebel". */
/* Deutsch klebt Woerter zusammen: "Rinderhackfleisch" ist Hackfleisch,
   "Kirschtomaten" sind Tomaten, "Basmatireis" ist Reis. Ein reiner
   Wortvergleich findet davon nichts. Also zusaetzlich pruefen, ob ein Wort im
   anderen steckt — aber erst ab vier Zeichen, sonst passt "Ei" auf alles. */
const TEILWORT_AB = 4;

function matches(ingredientName, itemTokenSets) {
  const zutat = tokens(ingredientName);
  if (!zutat.length) return false;
  return itemTokenSets.some((item) => [...item].some((wort) => zutat.some((z) => (
    z === wort
    || (z.length >= TEILWORT_AB && wort.length >= TEILWORT_AB && (z.includes(wort) || wort.includes(z)))
  ))));
}

export function matchPantry(recipes, items, { limit = 12, minCoverage = 0.34 } = {}) {
  const list = parsePantryInput(Array.isArray(items) ? items.join(',') : items);
  if (!list.length) return [];
  const itemTokenSets = list.map((item) => new Set(tokens(item)));

  const treffer = [];
  for (const recipe of recipes) {
    const zutaten = relevantIngredients(recipe);
    if (!zutaten.length) continue;

    const vorhanden = [];
    const fehlend = [];
    for (const name of zutaten) (matches(name, itemTokenSets) ? vorhanden : fehlend).push(name);
    if (!vorhanden.length) continue;

    const abdeckung = vorhanden.length / zutaten.length;
    if (abdeckung < minCoverage) continue;

    treffer.push({
      recipe,
      have: vorhanden,
      missing: fehlend,
      coverage: abdeckung,
      /* Was zaehlt, ist wenig nachkaufen zu muessen — und dass moeglichst
         viel von dem wegkommt, was da ist. */
      score: abdeckung * 100 - fehlend.length * 6 + Math.min(vorhanden.length, 6) * 2
    });
  }

  return treffer
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length)
    .slice(0, limit);
}
