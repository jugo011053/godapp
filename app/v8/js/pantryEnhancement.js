import { getState } from './core/store.js';
import { haptic } from './core/feel.js';
import { getCards } from './data/recipeStore.js';
import { matchPantry, parsePantryInput } from './features/pantry/pantryMatch.js';
import { recipeEligible } from './data/recipeScoring.js';

/* "Was hast du da?" — der Nutzer wirft hin, was im Kuehlschrank liegt, wir
   suchen im Katalog, was daraus wird. Laeuft ganz im Geraet: die 600 Rezepte
   samt Zutaten sind ohnehin da. */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const VORSCHLAEGE = [
  'Eier', 'Hackfleisch', 'Hähnchenbrust', 'Lachs', 'Tofu', 'Kichererbsen',
  'Linsen', 'Nudeln', 'Reis', 'Kartoffeln', 'Tomaten', 'Zwiebeln',
  'Paprika', 'Zucchini', 'Brokkoli', 'Spinat', 'Feta', 'Joghurt'
];

const ui = { text: '', ergebnisse: null };

function closeOverlay(overlay) { overlay?.remove(); }

/* Was der Nutzer nicht essen darf, taucht auch hier nicht auf. Der Abgleich
   ist eine Suchhilfe, keine Umgehung der Ausschluesse. */
function erlaubt(recipe, state) {
  return recipeEligible(recipe, {
    category: recipe.category,
    profile: state.profile || {},
    preferences: state.preferences || {}
  });
}

function ergebnisHtml(treffer) {
  if (!treffer) return '';
  if (!treffer.length) {
    return `<p class="pantry-leer">Dazu findet sich nichts. Versuch es mit weniger Zutaten oder anderen Begriffen — oder schau unter „Alle Rezepte durchsehen“.</p>`;
  }
  return `<div class="pantry-treffer">${treffer.map((t) => `
    <button class="pantry-karte" type="button" data-recipe-id="${esc(t.recipe.id)}">
      <span class="pantry-quote">${Math.round(t.coverage * 100)}%</span>
      <span class="pantry-text">
        <strong>${esc(t.recipe.name)}</strong>
        <em>${Math.round(t.recipe.kcal || 0)} kcal · ${Math.round(t.recipe.protein || 0)} g Protein · ${Math.round(t.recipe.time || 0)} Min</em>
        ${t.missing.length
          ? `<small class="pantry-fehlt">Fehlt: ${esc(t.missing.slice(0, 4).join(', '))}${t.missing.length > 4 ? ` und ${t.missing.length - 4} mehr` : ''}</small>`
          : '<small class="pantry-komplett">Alles da</small>'}
      </span>
      <b>›</b>
    </button>`).join('')}</div>`;
}

export function openPantrySheet(root, onRecipe) {
  root.querySelector('.v8-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'v8-overlay plan-menu-overlay';
  overlay.dataset.dismissible = 'true';
  overlay.innerHTML = `<section class="v8-dialog plan-menu-sheet pantry-sheet" role="dialog" aria-modal="true" aria-labelledby="pantry-title">
    <div class="sheet-head">
      <h2 id="pantry-title">Was hast du da?</h2>
      <button class="sheet-close" type="button" data-sheet-close aria-label="Schließen">×</button>
    </div>
    <p class="account-copy">Schreib auf, was im Kühlschrank liegt — mit Komma getrennt. Wir suchen, was sich daraus kochen lässt.</p>

    <label class="master-form-field">
      <span>Vorhandene Zutaten</span>
      <textarea data-pantry-input rows="2" placeholder="Eier, Spinat, Feta">${esc(ui.text)}</textarea>
    </label>

    <div class="pantry-chips">${VORSCHLAEGE.map((wort) =>
      `<button class="pantry-chip" type="button" data-pantry-add="${esc(wort)}">${esc(wort)}</button>`).join('')}</div>

    <button class="sheet-action primary" type="button" data-pantry-search>Passende Gerichte suchen</button>
    <div data-pantry-results>${ergebnisHtml(ui.ergebnisse)}</div>
  </section>`;

  root.appendChild(overlay);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(overlay); });
  overlay.querySelector('[data-sheet-close]').addEventListener('click', () => closeOverlay(overlay));

  const feld = overlay.querySelector('[data-pantry-input]');
  const ausgabe = overlay.querySelector('[data-pantry-results]');

  const suchen = () => {
    ui.text = feld.value;
    const state = getState();
    const katalog = getCards().filter((recipe) => erlaubt(recipe, state));
    ui.ergebnisse = matchPantry(katalog, ui.text);
    ausgabe.innerHTML = ergebnisHtml(ui.ergebnisse);
    binden();
    haptic('tap');
  };

  const binden = () => {
    ausgabe.querySelectorAll('[data-recipe-id]').forEach((karte) => karte.addEventListener('click', () => {
      const id = karte.dataset.recipeId;
      closeOverlay(overlay);
      onRecipe?.(id);
    }));
  };

  overlay.querySelectorAll('[data-pantry-add]').forEach((chip) => chip.addEventListener('click', () => {
    const wort = chip.dataset.pantryAdd;
    const vorhanden = parsePantryInput(feld.value);
    /* Zweimal antippen nimmt es wieder heraus — sonst muesste man im
       Textfeld herumeditieren. */
    const neu = vorhanden.some((e) => e.toLowerCase() === wort.toLowerCase())
      ? vorhanden.filter((e) => e.toLowerCase() !== wort.toLowerCase())
      : [...vorhanden, wort];
    feld.value = neu.join(', ');
    chip.classList.toggle('active');
    haptic('tap');
  }));

  overlay.querySelector('[data-pantry-search]').addEventListener('click', suchen);
  feld.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) suchen();
  });
  binden();
  return overlay;
}

/* Einstieg auf der Rezeptseite, direkt unter der Ueberschrift. */
export function refreshPantry(root, onRecipe) {
  const titel = root.querySelector('.v8-main .master-screen-title');
  if (!titel || titel.textContent.trim() !== 'Rezepte') return;
  if (root.querySelector('[data-pantry-open]')) return;

  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.dataset.pantryOpen = 'true';
  knopf.className = 'pantry-einstieg';
  knopf.innerHTML = '<strong>Was hast du da?</strong><span>Zutaten eintippen — wir suchen passende Gerichte</span><b>›</b>';
  knopf.addEventListener('click', () => {
    haptic('tap');
    openPantrySheet(root, onRecipe);
  });
  titel.insertAdjacentElement('afterend', knopf);
}
