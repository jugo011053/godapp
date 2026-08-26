# Auftrag: Datenbank in Ordnung bringen

> Geschrieben am 2026-08-26 aus der App-Entwicklung heraus. Alle Zahlen sind
> gegen den echten Datenbestand geprüft, die Abfragen zum Nachrechnen stehen
> dabei. Projekt `rfdtjodpjvynnavnucvu`, im Dashboard noch „D1 DayOne".

## Warum das ein eigener Auftrag ist

Die App hat in den letzten Wochen mehrfach denselben Fehler gehabt: **der Code
erwartet ein Format, die Datenbank liefert ein anderes, und niemand merkt es.**
Wir haben inzwischen die Symptome im Code abgefangen — Diätfilter aus Zutaten
statt aus Etiketten, Allergene aus Zutaten, Zutatenkategorien nach Namen. Das
sind Notverbände. Die Ursachen liegen alle in den Daten.

---

## 0. Die Struktur, bevor es um Inhalte geht

Es gibt **zwei Kopien derselben Zutatendaten, ohne Verbindung zueinander**:

| | `foods` | `recipe_catalog_v1.ingredients` (JSONB) |
|---|---|---|
| Zeilen | 846 Lebensmittel | 5 971 Vorkommen, 812 verschiedene Namen |
| Felder | `category`, `pack_size`, `pack_unit`, `pack_price_eur`, `kcal_100`, … | `category`, `packSize`, `packUnit`, `packPrice`, … |
| Verweis auf die andere Seite | — | **keiner** |
| Wird von der App gelesen | **nein, gar nicht** | ja, ausschließlich |

Nachprüfen:

```sql
-- Zutaten mit Verweis auf foods: 0
select count(*) from recipe_catalog_v1 r,
  lateral jsonb_array_elements(r.ingredients) i
where i ? 'foodId' or i ? 'food_id' or i ? 'ingredientId';
```

Die Zutatendaten wurden beim Einpflegen einmal aus `foods` in jedes Rezept
hineinkopiert. Seitdem driften beide auseinander, und `foods` ist toter
Ballast — 846 gepflegte Zeilen, die nichts bewirken.

**Die gute Nachricht:** ein Abgleich über den Namen trifft zu 95 %.
768 der 812 Zutatennamen entsprechen exakt einem `foods.canonical_name_de`.

**Erste Empfehlung, vor allen inhaltlichen Korrekturen:**
`foods` wird die einzige Quelle. Jede Zutat im Rezept bekommt ein `food_id`.
Kategorie, Packung und Preis stehen dann nur noch an einer Stelle. Wer das
nicht macht, korrigiert jeden folgenden Fehler zweimal.

Die 44 Namen ohne Treffer brauchen entweder einen neuen `foods`-Eintrag oder
eine Zuordnung von Hand. Beispiele: `TK-Beerenmix`, `Magerquark`, `Eiklar`,
`Spinat TK`, `Tofu natur`, `Vollkorn-Wrap`, `Milch 1,5 %`, `Putenbrust`,
`Whey-Proteinpulver`, `Sojadrink ungesüßt`.

---

## 1. Die Kategorien sind zur Hälfte ein Standardwert

**In `foods`: 396 von 846 stehen auf „Gemüse".**
**In den Rezeptzutaten: 359 von 812 Namen.**

Darunter: `Ei`, `Mittelgroßes Ei`, `Rosinen`, `Meeresfrüchte`, `All-Bran`,
`Aprikose`, `Kardamomkapsel`, `Vanilleextrakt`.

```sql
select category, count(*) from foods group by 1 order by 2 desc;
```

**Was die App damit macht:** die Einkaufsliste wird danach nach Regalen
sortiert. Wer im Laden unter „Obst & Gemüse" nach Eiern und Meeresfrüchten
sucht, findet sie nicht.

**Zielzustand:** eine feste, kurze Liste von Gängen — vorher festlegen, sonst
rät jeder Durchlauf neu. Vorschlag, orientiert am Supermarkt und nicht an der
Nährwertlehre:
`Obst & Gemüse · Kühlregal · Fleisch & Fisch · Trockenwaren · Konserven & Gläser ·
Backen & Gewürze · Tiefkühl · Getränke`

Die heutigen elf Kategorien (`Gemüse`, `Kohlenhydrate`, `Pflanzliche Proteine`,
`Fette / Öle` …) beschreiben Makronährstoffe, nicht Regale. Beides in einem
Feld geht nicht — wenn die Nährstoffrolle gebraucht wird, gehört sie in eine
zweite Spalte.

---

## 2. Die Preise sind ein Platzhalter

**419 der 846 `foods` tragen exakt `500 g / 1,79 €`.** In den Rezeptzutaten
sind es 378 Namen bzw. 2 145 Vorkommen. **Jede** Packung in `foods` ist
150–2500 g, aber 500 g ist so überrepräsentiert, dass es kein Zufall ist.

```sql
select pack_size, pack_unit, pack_price_eur, count(*)
from foods group by 1,2,3 order by 4 desc limit 10;
```

**Was die App damit macht:** sie zeigt pro Posten „ca. 1,79 €" und rechnet
daraus eine Wochensumme. Das steht ausgerechnet an der Stelle, an der das
Produktversprechen hängt („günstiger als eine Kochbox").

`source_confidence` (0,5–0,9) und `source_note` beziehen sich ausschließlich
auf die **Nährwerte** aus USDA. Für die Preise gibt es **keine Quelle**.

**Zielzustand:** entweder echte Packungsgrößen und Preise eines konkreten
Händlers, mit Datum und Quelle in `source_note` — oder das Feld wird als
„unbekannt" markiert, und die App zeigt keinen Preis. Ein falscher Preis ist
schlechter als kein Preis.

---

## 3. Die Nährwerte hängen an den falschen USDA-Einträgen

Stichprobe gegen allgemein bekannte Werte:

| Lebensmittel | in `foods` | tatsächlich | verknüpfter USDA-Eintrag |
|---|---|---|---|
| Ei | 376 kcal | ~143 | `Egg, white, dried` |
| Champignons | 56 kcal | ~22 | `Mushrooms, shiitake, cooked` |
| Kartoffeln | 106 kcal | ~77 | `Potatoes, mashed, ready-to-eat` |
| Linsen | 120 kcal | ~350 (trocken) | `Lentils, dry` — Wert ist aber gekocht |
| Hähnchenbrust | 134 kcal | ~110 | `Chicken breast, roll, oven-roasted` |
| Brokkoli | 26 kcal | ~34 | `Broccoli, chinese, raw` |

Richtig sind unter anderem Olivenöl (884), Banane (89), Haferflocken (350).
Das Muster: der Abgleich hat den **erstbesten** USDA-Treffer genommen, nicht
den passenden — getrocknetes Eiweiß statt ganzem Ei, Shiitake statt
Champignon, Kartoffelpüree statt roher Kartoffel.

Zwei wiederkehrende Fehlerarten, die getrennt behandelt werden müssen:
1. **Falsche Sorte** (Shiitake ≠ Champignon)
2. **Falscher Zustand** roh/gekocht/getrocknet — das Feld `state` gibt es
   bereits (`roh/handelsüblich`), es wird beim Abgleich nur nicht beachtet.
   Bei Linsen, Reis und Nudeln entscheidet das über den Faktor 3.

**Was die App damit macht:** heute nichts — sie liest `foods` gar nicht. Die
Rezept-Kalorien stehen eigenständig in `recipe_catalog_v1` und sind in sich
schlüssig (nur 1 von 600 Rezepten hat Makros, die nicht zur kcal-Angabe
passen: *Fischsuppe*, 248 kcal angegeben, 100 aus den Makros). **Sobald `foods`
aber zur Quelle wird — siehe Punkt 0 — schlagen diese Fehler auf jede
Portionsberechnung durch.** Deshalb gehört das vor die Zusammenführung, nicht
danach.

---

## 4. Die Diät- und Allergen-Etiketten widersprechen sich

**69 Rezepte**, bei denen `diet_tags` und `classification.dietary_style`
etwas Verschiedenes behaupten.

```sql
select id, name, diet_tags, classification->>'dietary_style'
from recipe_catalog_v1
where classification->>'dietary_style' is not null
  and not (diet_tags ? (classification->>'dietary_style'));
```

Zwei Sprachen in zwei Feldern: `diet_tags` englisch (`vegetarian`),
`classification.dietary_style` deutsch (`vegetarisch`). Das ist die Ursache
eines Sicherheitsfehlers, der bis v8.28 in der App war: 21 Gerichte mit
Fleisch oder Fisch waren als vegan gelistet und wurden Veganern eingeplant —
unter anderem *Sardinen-Tomaten-Pasta* und *Koreanische Schweinefleisch-Bowl*.

Bei den Allergenen fehlten Angaben zu **63 Nuss-, 32 Gluten-, 26 Milch-,
19 Krebstier-, 6 Ei-, 3 Fisch- und 2 Soja-Rezepten**.

**Der Code fängt das inzwischen ab** (v8.29): Diät und Allergene werden aus
den Zutaten abgeleitet, das Etikett kann nur strenger sein, nie lockerer.
Doppelte Arbeit ist also nicht nötig — aber die Daten bleiben falsch, und
jede spätere Auswertung außerhalb der App zieht wieder die falschen Schlüsse.

**Zielzustand:** ein Feld statt zwei, eine Sprache, aus den Zutaten abgeleitet
und nicht von Hand gesetzt.

---

## 5. Kleinere, klar umrissene Lücken

- **100 Rezepte ohne Kochschritte.** Alle mit `source = 'legacy_v1'`, alle ohne
  `source_url`. Die App erzeugt dafür einen generischen Ersatztext, der sich
  entsprechend liest.
  `select count(*) from recipe_catalog_v1 where jsonb_array_length(coalesce(steps,'[]')) = 0;`
- **7 Rezepte in der Kategorie `shake` sind unerreichbar.** Die Planung kennt
  nur `breakfast`, `lunch`, `dinner`, `snack`. Entweder umkategorisieren oder
  ersatzlos streichen — sie tauchen nur beim Stöbern auf, nie in einem Plan.
- **5 Zutaten ohne Packungsdaten**, deren Preis dadurch still ignoriert wird:
  Bacon, Geräuchertes Schweinefleisch, Schweinefilet, Schweinehackfleisch, Kimchi.
- **Vage Mengeneinheiten** (`nach Geschmack`, `Handvoll`, `Prise`) sind in
  Ordnung und werden von der App als solche behandelt — nicht „reparieren".

---

## 6. Herkunft der Rezepte — betrifft auch die Bilderfrage

**491 der 600 Rezepte stammen von `bbcgoodfood.com`**, erkennbar an
`source_url`. Die deutschen Texte sind Übersetzungen davon; das erklärt die
holprigen Formulierungen und die Zutaten, die im deutschen Handel so nicht
heißen.

```sql
select count(*) from recipe_catalog_v1 where source_url like '%bbcgoodfood%';
```

Zwei Konsequenzen, die zusammengehören:

1. **Bilder.** Der Katalog hat **kein** Bildfeld. Die naheliegende Quelle wären
   die Fotos von BBC Good Food — die sind urheberrechtlich geschützt und für
   eine öffentlich erreichbare App keine Option, weder kopiert noch verlinkt.
   Wer Bilder will, braucht eine eigene Quelle: frei lizenzierte Bestände,
   selbst fotografiert, oder generiert. Das ist eine Entscheidung, keine
   Fleißarbeit.
2. **Die Texte selbst.** Übersetzte fremde Rezepte auf einer öffentlichen
   Seite sind dasselbe Thema in klein. Das gehört einmal bewusst entschieden,
   bevor die App weitergegeben wird — nicht nebenbei beim Aufräumen.

---

## Abnahmekriterien

Der Auftrag ist erledigt, wenn:

- [ ] jede Rezeptzutat ein `food_id` trägt, das in `foods` existiert
- [ ] `category` in `foods` aus einer festen Gangliste stammt, keine Zeile
      mehr auf dem Standardwert steht, und Stichproben (Ei, Rosinen,
      Meeresfrüchte, Vanilleextrakt) im richtigen Gang landen
- [ ] Packung und Preis entweder eine benannte Quelle mit Datum haben oder
      als unbekannt markiert sind — kein Wert häufiger als 5 % der Zeilen
- [ ] die zwölf Stichproben aus Punkt 3 innerhalb von ±10 % der bekannten
      Werte liegen und `state` beim USDA-Abgleich berücksichtigt ist
- [ ] die Abfrage aus Punkt 4 null Zeilen liefert
- [ ] kein Rezept mehr ohne Kochschritte in der Planung landet
- [ ] die Kategorie `shake` ist aufgelöst

**Vor jeder Schema-Änderung** gilt weiter, was in `CLAUDE.md` steht:
Ist-Zustand dokumentieren, Migration vorschlagen, Sicherheitsfolgen prüfen,
Zustimmung einholen, danach den Advisor erneut laufen lassen.

---

## Was der Code schon abfängt — bitte nicht doppelt machen

Diese Notverbände bleiben nach der Bereinigung bestehen. Sie schaden nicht,
sie werden nur wirkungslos:

| Datei | fängt ab |
|---|---|
| `recipeNormalizer.js` → `dietFromIngredients()` | falsche Diät-Etiketten |
| `recipeNormalizer.js` → `allergensFromIngredients()` | fehlende Allergene |
| `featureEnhancementsV2.js` → `NAME_CATEGORY_HINTS` | 18 falsch einsortierte Zutaten |
| `recipeNormalizer.js` → `recipeSteps()` | fehlende Kochschritte |
| `shoppingEngine.js` → `formatAmount()` | krumme Mengen wie „82,2 g" |
