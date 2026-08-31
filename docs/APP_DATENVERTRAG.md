# Was die App aus den Daten liest — und was dabei brechen kann

> Für den Datenbank-Strang geschrieben, Stand 2026-08-31, App-Build v8.43.
> Der **Plan** steht in `DATABASE_MASTERPLAN_V2.md`. Dieses Dokument ergänzt
> ihn um die Gegenrichtung: welche Annahmen die laufende App über die Daten
> macht, und welche Umbenennung sie still kaputt macht.

---

## 0. Die eine Regel

**Die App liest ausschließlich `public.recipe_catalog_v1`.**
Nicht `public.foods`, nicht `catalog.*`. Eine Änderung, die dort nicht ankommt,
ist für den Nutzer nicht passiert.

`recipe_catalog_v2` ist im Masterplan als Projektion mit gleichem Vertrag
vorgesehen — das passt. **Der Cutover ist aber ein App-Commit**, kein reiner
Datenbankschritt: `app/v8/js/data/recipeRepository.js`, Zeile 3. Er braucht
eine Absprache, keinen Alleingang, und beide Tabellen sollten eine Weile
parallel stehen.

---

## 1. Was tatsächlich gelesen wird

`recipeRepository.listCards()` holt genau diese Spalten:

```
id · source · code · name · cat · kcal · protein · carbs · fat
time · servings · difficulty · tags · allergens · diet_tags
ingredients · steps · classification · quality_score · is_plan_eligible
```

Aus `ingredients[]` (JSONB) verwendet die App:

| Feld | wofür |
|---|---|
| `name` | Einkaufsliste, „Was hast du da?", **Diät- und Allergenableitung** |
| `amount`, `unit` | Mengen, Packungsrechnung, Anzeige |
| `category` | Sortierung nach Regal in der Einkaufsliste |
| `packSize`, `packUnit`, `packPrice` | Packungen und Preisschätzung |

Alles andere im Zutatenobjekt (`base`, `buyType`, `step`, `pieceWeight`,
`role`, `rawOrCooked`) wird derzeit **nicht** gelesen. Es darf verschwinden
oder sich ändern.

---

## 2. Fünf Bruchstellen

### 2.1 Rezept-`id` ist ein Fremdschlüssel in Nutzerdaten

`id` steht in `favorites.recipe_id`, `recipe_feedback.recipe_id`,
`meal_plan_entries.recipe_id` und in jedem gespeicherten Plan — im
localStorage jedes Geräts **und** in `user_state.state`.

**Ändert sich eine Rezept-`id`, verlieren Nutzer Favoriten, ausgeblendete
Rezepte und laufende Pläne.** Umbenennen ja, Umnummerieren nur mit
Migrationsschritt für alle vier Orte.

### 2.2 Zutatennamen entscheiden über Diät und Allergene

Seit v8.29 traut die App den Etiketten `diet_tags` und `allergens` nicht mehr.
Sie leitet beides aus den **Zutatennamen** ab und lässt das Etikett nur
strenger sein, nie lockerer (`recipeNormalizer.js`,
`dietFromIngredients()` / `allergensFromIngredients()`).

Das heißt: **eine Umbenennung ist eine sicherheitsrelevante Änderung.**
Wird aus „Schweinehackfleisch" ein „Hackfleisch (Schwein)", muss das Muster
weiter greifen. Wird aus „Kokosmilch" ein „Milch, Kokos", meldet die App
plötzlich eine Milchallergie, wo keine ist.

Betroffene Musterlisten in `app/v8/js/data/recipeNormalizer.js`:
`MEAT`, `FISH`, `DAIRY_EGG`, `PLANT_OVERRIDE`, `ALLERGEN_PATTERNS`,
`ALLERGEN_EXCEPTIONS`.

**Vorgehen:** vor dem Schreiben die Liste der Umbenennungen herüberreichen.
Ich prüfe sie gegen die Muster und passe an, bevor die Daten wechseln.

### 2.3 Vorratszutaten werden über den Namen erkannt

Die Einkaufsliste blendet Grundzutaten in eine eigene Gruppe aus und lässt
sie aus der Preisschätzung heraus. Erkannt am **ganzen Wort**:

```
salz · pfeffer · olivenöl · rapsöl · sonnenblumenöl · kokosöl · öl · essig
balsamico · sojasauce · sojasoße · senf · tomatenmark · zucker · honig
ahornsirup · mehl · backpulver · hefe · zimt · vanille · paprikapulver
kreuzkümmel · kurkuma · currypulver · chiliflocken · oregano · thymian
rosmarin · lorbeerblatt · gemüsebrühe · hühnerbrühe · gemüsebrühpulver
brühe · sesamöl · wasser
```

Aus „Olivenöl" darf kein „Öl, Oliven" werden — sonst steht die Flasche
plötzlich mit Preis in der Wochenrechnung. Neue Namen für Grundzutaten
bitte melden, dann wandert die Liste mit.

### 2.4 Einheiten sind ein geschlossenes Vokabular

Zählbar (wird aufgerundet, nie halbiert):
`Stück · Stk · Zehe(n) · Scheibe(n) · Bund · Kopf · Dose(n) · Packung(en) · Glas · Blatt · Zweig`

Unbestimmt (die App zeigt dann **keine Zahl**, nur das Wort):
`nach Geschmack · etwas · Prise(n) · Handvoll · nach Bedarf`

Gerechnet wird mit `g · kg · ml · l`. Löffelmaße (`EL`, `TL`) werden auf
halbe Löffel gerundet.

**Ein unbekanntes Einheitenwort fällt still in den Löffel-Zweig** und wird auf
halbe Einheiten gerundet — „0,5 Msp." statt einer Fehlermeldung. Neue
Einheiten deshalb nur nach Absprache.

### 2.5 `cat` und `is_plan_eligible` steuern, was überhaupt sichtbar ist

- Geplant werden **nur** `breakfast`, `lunch`, `dinner`, `snack`.
  Die 7 Rezepte mit `cat = 'shake'` sind unerreichbar — auflösen oder
  umkategorisieren, aber nicht liegen lassen.
- `listCards()` filtert auf `is_plan_eligible = true`. Ein Rezept, das den
  Status verliert, **verschwindet aus dem Katalog** — inklusive aus bereits
  gespeicherten Plänen, die es dann nur noch dem Namen nach zeigen.

---

## 3. Der Befund, um den es geht: ein Namensverzeichnis statt einer Lebensmittelliste

Der Masterplan zählt 63 Gruppen mit **identischem** `canonical_name_de`.
Normalisiert man zusätzlich Groß-/Kleinschreibung, Umlaute und die häufigen
Pluralendungen, werden daraus:

| | |
|---|---|
| Lebensmittel in `catalog.foods` | **882** |
| Gruppen aus reinen Schreibvarianten | **126** |
| überzählige Einträge darin | **143** |
| davon mit **abweichenden Nährwerten** in derselben Gruppe | **30** |
| ohne Nährwerte | 171 |
| ohne Preis | 460 |

Belege aus dem Bestand:

| Rezeptname | `food_id` | kcal/100 g |
|---|---|---|
| Zwiebel | F0500 | 40 |
| Zwiebeln | F0503 | 40 |
| Rote Zwiebel | F0609 | 44 |
| Rote Zwiebeln | F0610 | 44 |
| Frühlingszwiebel | F0705 | 27 |
| Frühlingszwiebeln | F0706 | 27 |
| Gehackte Tomate | F0180 | 35 |
| **Gehackte Tomaten** | **F0181** | **302** |

Singular und Plural sind zwei verschiedene Lebensmittel. Bei „Gehackte
Tomate(n)" weichen die Nährwerte um den Faktor neun ab — einer der beiden
Werte ist falsch, und welcher gilt, entscheidet der Zufall der Schreibweise
im Rezept.

**`catalog.food_aliases` ist keine Synonymtabelle.** 1786 Aliase auf 790
Lebensmittel, und alle 810 Zutatennamen aus den Rezepten lösen sich auf —
aber jede Schreibweise zeigt auf ihren *eigenen* Eintrag. Die Tabelle
verdoppelt das Problem, statt es zu lösen.

Hinzu kommen die Fälle, die keine Normalisierung findet, weil sie
inhaltliches Urteil brauchen:
`Rinderhack mager` / `Rinderhackfleisch` · `Kirschtomaten` / `Cherrytomaten` /
`Babytomaten` · `Joghurt` / `Naturjoghurt` / `Bio-Joghurt` / `Töpfe Bio-Joghurt`

---

## 4. Benennungsregeln, die zur App passen

1. **Ein Lebensmittel, ein Eintrag, ein Name.** Jede andere Schreibweise wird
   ein `food_alias` auf diesen Eintrag — dafür ist die Tabelle da.
2. **Singular.** „Zwiebel", nicht „Zwiebeln".
3. **Unterschieden wird nur, was sich unterscheidet.** Andere Nährwerte oder
   ein anderer Einkauf → eigener Eintrag (Rinderhackfleisch ≠ Putenhackfleisch).
   Nur eine andere Schreibweise → Alias.
4. **Der Zustand gehört ins Feld `state`, nicht in den Namen.**
   „Linsen, trocken" → Name `Linsen`, `state = 'trocken'`. Das ist zugleich die
   Ursache mehrerer Nährwertfehler (Linsen trocken 350 vs. gekocht 120 kcal).
5. **Keine Mengen, keine Marken, keine Zubereitung im Namen.**
   „Töpfe Bio-Joghurt" → `Naturjoghurt`. „All-Bran" → `Weizenkleie-Cerealien`.
6. **Zusammengesetzte Wörter bleiben zusammen.** `Olivenöl`, nicht `Öl, Oliven`
   — siehe 2.3 und 2.2.
7. **Kategorie = Supermarktgang**, nicht Nährstoffrolle. Die Nährstoffrolle
   gehört in eine zweite Spalte, wenn sie gebraucht wird.

**Nebenertrag:** Wird die Alias-Tabelle zu einer echten Synonymtabelle, kann
„Was hast du da?" sie benutzen, statt deutsche Komposita zu raten. Heute
vergleicht die App Wortstämme und Wortkerne (`pantryMatch.js`) — funktionierend,
aber Heuristik. Mit echten Aliassen wird daraus ein Nachschlagen.

---

## 5. Reihenfolge, damit unterwegs nichts kaputt ist

1. **Zusammenführen, nicht löschen.** Erst `recipe_ingredients.food_id` und
   `food_aliases.food_id` auf den überlebenden Eintrag umbiegen, dann die
   verwaisten Zeilen entfernen. (Steht so schon im Masterplan.)
2. **Nährwerte vor dem Zusammenführen entscheiden.** Bei den 30 Gruppen mit
   abweichenden Werten muss geklärt sein, welcher stimmt — sonst zementiert
   das Zusammenführen den falschen.
3. **Umbenennungsliste herüberreichen**, bevor sie in `recipe_catalog_v1`
   ankommt. Ich prüfe gegen die Muster aus 2.2 und 2.3 und passe die App an.
4. **Erst danach der Abzug in die öffentliche Schicht.**
5. **Danach den Advisor laufen lassen** und mir Bescheid geben — ich lasse die
   20 Testläufe der App gegen die neuen Daten laufen. Mehrere davon prüfen
   direkt gegen den Katalog (Diät, Allergene, Einkaufsmengen, Planung).

---

## 6. Woran man merkt, dass es gelungen ist

- [ ] `catalog.foods` enthält keine zwei Einträge mehr, die nach Normalisierung
      (klein, ohne Umlaute, ohne Pluralendung) denselben Schlüssel ergeben
- [ ] jede in Rezepten vorkommende Schreibweise ist ein `food_alias` auf genau
      einen Eintrag
- [ ] keine Gruppe mehr mit widersprüchlichen Nährwerten
- [ ] die zwölf Stichproben aus `DATENBANK_AUFTRAG.md` Punkt 3 liegen innerhalb
      ±10 % der bekannten Werte
- [ ] `cat` enthält nur noch `breakfast`, `lunch`, `dinner`, `snack`
- [ ] die 20 Testläufe der App sind grün

```sql
-- Schreibvarianten, die noch übrig sind
with norm as (
  select food_id, canonical_name_de,
         regexp_replace(regexp_replace(lower(translate(canonical_name_de,'äöüßÄÖÜ','aousAOU')),
                        '(en|er|n|e|s)$',''), '[^a-z]','','g') as schluessel
  from catalog.foods
)
select schluessel, count(*), string_agg(canonical_name_de,' | ')
from norm group by schluessel having count(*) > 1 order by 2 desc;
```
