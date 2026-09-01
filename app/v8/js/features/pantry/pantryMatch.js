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
/* Deutsch klebt Woerter zusammen, und der gemeinsame Teil steht oft in der
   Mitte: Rinder-HACK und HACK-fleisch. Ein "steckt das eine im anderen"
   findet das nicht — "rinderhack" enthaelt "hackfleisch" ja gerade nicht.
   Also drei Wege, alle ab vier Zeichen (darunter passt "Ei" auf alles):
     1. gleich
     2. das eine ist Anfang oder Ende des anderen  (Nudel / Vollkornnudel)
     3. das Ende des einen ist der Anfang des anderen  (RinderHACK / HACKfleisch)
   Absichtlich kein freies "enthaelt": sonst waere "Reis" in "Preiselbeere". */
const KERN_AB = 4;

function gemeinsamerKern(a, b) {
  for (let n = Math.min(a.length, b.length); n >= KERN_AB; n -= 1) {
    if (a.endsWith(b.slice(0, n))) return true;
  }
  return false;
}

function verwandt(a, b) {
  if (a === b) return true;
  if (a.length >= KERN_AB && (b.startsWith(a) || b.endsWith(a))) return true;
  if (b.length >= KERN_AB && (a.startsWith(b) || a.endsWith(b))) return true;
  return gemeinsamerKern(a, b) || gemeinsamerKern(b, a);
}

function matches(ingredientName, itemTokenSets) {
  const zutat = tokens(ingredientName);
  if (!zutat.length) return false;
  return itemTokenSets.some((item) => [...item].some((wort) => zutat.some((z) => verwandt(z, wort))));
}

export function matchPantry(recipes, items, { limit = 12, minCoverage } = {}) {
  const list = parsePantryInput(Array.isArray(items) ? items.join(',') : items);
  if (!list.length) return [];
  const itemTokenSets = list.map((item) => new Set(tokens(item)));
  /* Frueher war die Huerde ein Anteil an den Rezeptzutaten: 15 % bei ein bis
     zwei genannten Zutaten, 34 % ab drei. Beides geht an der Wirklichkeit
     vorbei, weil ein echtes Rezept 8 bis 16 Zutaten hat. Eine davon sind
     hoechstens 12 % — "Hackfleisch" fand deshalb nichts, obwohl neun
     Gerichte welches enthalten. Und 34 % hiessen vier Treffer; wer fuenf
     Sachen nennt, von denen drei zu seiner Ernaehrung passen, konnte das
     nie erreichen.
     Gezaehlt wird jetzt, wie viele der GENANNTEN Zutaten vorkommen: eine
     reicht, ab drei genannten muessen es zwei sein. Der Anteil entscheidet
     weiterhin die Reihenfolge und steht als Quote auf der Karte. */
  const noetig = list.length >= 3 ? 2 : 1;

  const treffer = [];
  for (const recipe of recipes) {
    const zutaten = relevantIngredients(recipe);
    if (!zutaten.length) continue;

    const vorhanden = [];
    const fehlend = [];
    for (const name of zutaten) (matches(name, itemTokenSets) ? vorhanden : fehlend).push(name);
    if (!vorhanden.length) continue;

    /* Nicht wie viele Rezeptzutaten getroffen wurden, sondern wie viele der
       genannten — zwei Zutaten des Rezepts koennen dieselbe Angabe meinen. */
    const getroffen = itemTokenSets.filter((item) =>
      zutaten.some((name) => matches(name, [item]))).length;
    if (getroffen < noetig) continue;

    const abdeckung = vorhanden.length / zutaten.length;
    if (minCoverage != null && abdeckung < minCoverage) continue;

    treffer.push({
      recipe,
      have: vorhanden,
      missing: fehlend,
      coverage: abdeckung,
      /* Was zaehlt, ist wenig nachkaufen zu muessen — und dass moeglichst
         viel von dem wegkommt, was da ist. */
      /* Was zaehlt: viele der genannten Zutaten unterbringen, wenig
         nachkaufen muessen. */
      score: getroffen * 25 + abdeckung * 100 - fehlend.length * 6
    });
  }

  return treffer
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length)
    .slice(0, limit);
}
