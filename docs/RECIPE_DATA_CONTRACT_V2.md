# Preply V8 · Recipe Data Contract

## Zweck

Dieser Vertrag trennt die bestehende Supabase-Tabelle `public.recipe_catalog_v1` von der V8-Planungslogik. Die produktive Tabelle bleibt zunächst unverändert. V8 normalisiert vorhandene Felder beim Lesen und blockiert unplausible Rezepte vor der Planung.

## Aktueller Datenbestand

`recipe_catalog_v1` enthält unter anderem:

- Identität: `id`, `source`, `code`, `name`
- Kategorie: `cat`
- Nährwerte: `kcal`, `protein`, `fat`, `carbs`, `fiber`, `salt`
- Zubereitung: `time`, `prep_time`, `servings`, `difficulty`, `steps`
- Kompatibilität: `diet_tags`, `tags`, `allergens`
- Einkauf: `ingredients`
- Klassifikation: `classification`
- Qualität: `quality_score`, `is_plan_eligible`

Die 500 neueren Rezepte besitzen in `classification` bereits Felder wie `meal_role`, `dish_type`, `novelty_level`, `meal_prep_score_v2`, `cost_band`, `dietary_style` und Allergenstatus. Die 100 Legacy-Rezepte sind weniger vollständig.

## V8-normalisierte Felder

Jedes gelesene Rezept liefert mindestens:

```js
{
  id,
  code,
  name,
  category,
  mealRole,
  kcal,
  protein,
  carbs,
  fat,
  time,
  servings,
  difficulty,
  simplicity,
  mealPrepScore,
  noveltyLevel,
  costBand,
  tags,
  allergens,
  dietTags,
  planEligible,
  qualityStatus,
  qualityIssues,
  familyKey,
  primaryProtein,
  dishType,
  ingredientNames
}
```

## Kanonische Allergene

V8 verwendet ausschließlich:

- `eggs`
- `dairy`
- `nuts`
- `soy`
- `fish`
- `shellfish`
- `gluten`
- `sesame`
- `mustard`
- `celery`
- `sulphites`

Varianten wie `egg`, `milk`, `nuts_peanuts` oder deutsche Begriffe werden beim Lesen normalisiert.

Schwein und Fischverzicht sind keine Allergene. Sie werden später als Ernährungs- oder Zutatenrestriktion behandelt.

## Rollen von Rezepten

- `complete_meal`: als eigenständige Mahlzeit planbar
- `light_meal`: nur für leichte Slots oder bewusste Kombinationen
- `side`: Beilage
- `base`: Brühe, Sauce, Dip oder Rezeptgrundlage

Mittag- und Abendessen dürfen in V8 nur automatisch aus `complete_meal` gewählt werden.

## Einfachheit

- `simple`: leicht, maximal etwa 30 Minuten, begrenzte Zutatenanzahl, geringe Neuartigkeit
- `balanced`: normale Alltagskomplexität
- `experimental`: hoher Aufwand, viele Zutaten oder hohe Neuartigkeit

Die Klassifikation ist eine Planungspräferenz, keine Bewertung der Rezeptqualität.

## Qualitätsstatus

- `approved`: ohne erkannte Auffälligkeit planbar
- `review`: verwendbar, aber redaktionell zu prüfen
- `blocked`: nicht automatisch planbar

Blockierende Regeln umfassen derzeit:

- fehlende Identität oder Zutaten
- ungültige Kategorie, Portionen oder Kalorien
- nichtpositive Zutatenmengen
- offensichtlich zu leichte Hauptmahlzeiten
- Hauptmahlzeiten mit 0 g Protein
- extrem hohe Kalorienwerte

`planEligible` ist nur wahr, wenn sowohl der bestehende Datenbankstatus als auch die V8-Qualitätsprüfung zustimmen.

## Kompakter Abruf und Detailabruf

- Übersichten und Planer nutzen `listCards()`.
- Rezeptseiten nutzen `getRecipe(id)` und erhalten Zutaten und Schritte.
- Qualitätsprüfung nutzt `listForQualityAudit()`.

Die momentane Tabelle speichert Zutaten und Schritte im selben Datensatz. Deshalb kann PostgREST noch keinen vollständig schlanken Kartenabruf liefern, ohne dass ein zusätzlicher View oder RPC eingeführt wird. Eine solche Datenbankänderung erfolgt nur als getrennte, geprüfte Migration.

## Vorgeschlagene spätere Migration

Noch **nicht angewendet**:

1. Security-Invoker-View für kompakte Rezeptkarten
2. kanonische Felder oder generierte Projektion für `meal_role`, `simplicity` und `quality_status`
3. Qualitätsreport als private Admin-View
4. keine Schreibrechte für `anon` oder `authenticated`
5. RLS- und Advisor-Prüfung nach Anwendung

Bis dahin bleibt die V8-Normalisierung vollständig rückwärtskompatibel zur laufenden V7-App.
