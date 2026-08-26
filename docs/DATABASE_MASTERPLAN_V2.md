# Preply · Datenbank-Masterplan V2

Stand: 2026-08-26

## Ziel

Die Datenbank wird nicht neu erfunden. Das bereits vorhandene normalisierte Schema `catalog.*` wird zur einzigen redaktionellen Source of Truth für Lebensmittel und Rezepte ausgebaut. Die heute von der App gelesene Tabelle `public.recipe_catalog_v1` bleibt während der Bereinigung unverändert als stabile Kompatibilitätsschicht bestehen.

Erst wenn Datenmodell und Inhalte sauber sind, wird eine neue öffentliche Projektion `public.recipe_catalog_v2` aufgebaut und die App gezielt darauf umgestellt.

Es gilt ausdrücklich:

- keine Rezept-IDs beiläufig ändern
- keine vorhandenen Nutzerpläne zerstören
- keine Produktionsdaten ohne vorherige Migration und Rückfallpfad überschreiben
- keine dritte parallele Rezeptstruktur neben `catalog.*` und `public.recipe_catalog_v1` anlegen
- keine Schema-/RPC-/RLS-Änderung ohne vorherige Zustimmung

---

# 1. Tatsächlicher Ist-Zustand

## 1.1 Öffentliche App-Schicht

### `public.recipe_catalog_v1`

Aktuell von der App gelesen.

Bestand:

- 600 Rezepte
- 500 `catalog_v5`
- 100 `legacy_v1`
- 87 Frühstück
- 194 Mittagessen
- 282 Abendessen
- 30 Snacks
- 7 Shakes

Die Tabelle ist physisch gespeichert, keine View.

Sie enthält pro Rezept bereits den kompletten App-Datensatz inklusive eingebetteter JSONB-Zutaten.

### `public.foods`

846 Lebensmittel. Praktisch eine öffentliche Kopie von `catalog.foods`.

- gleiche 846 `food_id`
- 846/846 IDs überlappen
- nur 2 Datensätze unterscheiden sich derzeit in mindestens einem verglichenen Feld

Langfristig soll diese Tabelle nicht parallel gepflegt werden.

### `public.recipes`

100 Legacy-Rezepte. Alle 100 IDs überlappen mit den 100 `legacy_v1`-Zeilen in `recipe_catalog_v1`.

Nach erfolgreicher Migration der Legacy-Rezepte ins `catalog`-Schema ist diese Tabelle nur noch Altbestand und darf nicht mehr als führende Rezeptquelle behandelt werden.

---

# 2. Bereits vorhandene saubere Basis: `catalog.*`

Das `catalog`-Schema ist der richtige Unterbau und wird zum Master ausgebaut.

Aktueller Bestand:

| Tabelle | Zeilen | Rolle |
|---|---:|---|
| `catalog.recipes` | 500 | stabile Rezeptidentität |
| `catalog.recipe_versions` | 500 | versionierte Rezeptfassung |
| `catalog.recipe_ingredients` | 5.403 | normalisierte Rezeptzutaten |
| `catalog.recipe_steps` | 5.429 | Kochschritte |
| `catalog.foods` | 846 | Lebensmittel-Master |
| `catalog.food_aliases` | 1.692 | Namens-/Sprachaliase |
| `catalog.recipe_macros` | 500 | Rezept- und Portionsmakros |
| `catalog.recipe_classification` | 500 | Planungs-/Inhaltsklassifikation |
| `catalog.recipe_allergens` | 704 | abgeleitete Allergenbeziehungen |
| `catalog.recipe_tags` | 14.474 | normalisierte Tags |
| `catalog.quality_issues` | 25 | bekannte redaktionelle Probleme |
| `catalog.import_runs` | 1 | Importhistorie |

Die 500 neueren Rezepte sind hier bereits relational aufgebaut.

Wichtig: Alle 5.403 `catalog.recipe_ingredients` besitzen einen Foreign Key auf `catalog.foods.food_id`.

---

# 3. Was heute falsch oder doppelt ist

## 3.1 Die 100 Legacy-Rezepte sind nicht in `catalog.*`

Die 500 neuen Rezepte sind sauber normalisiert. Die 100 alten Rezepte existieren dagegen nur in der Public-/Legacy-Schicht.

Legacy-Bestand:

- 100 Rezepte
- 589 Zutatenvorkommen
- 93 verschiedene Zutatennamen
- 100 Rezepte ohne echte Kochschritte
- 100 Rezepte ohne `diet_tags`
- vorhandene App-IDs wie `chicken_rice_broccoli`, `lentil_bolognese_pasta` usw.

Von den 93 verschiedenen Legacy-Zutatennamen:

- 38 haben einen eindeutigen exakten Namensmatch in `catalog.foods`
- 10 treffen auf mehrere gleich benannte Foods
- 45 haben keinen exakten Match

Diese 100 Rezepte werden als neue Versionen in `catalog.*` aufgenommen, ihre bestehenden App-IDs bleiben aber als stabile öffentliche IDs erhalten.

---

## 3.2 `catalog.foods` enthält echte Dubletten und falsche Varianten

Aktuell:

- 846 Food-Zeilen
- 63 Gruppen mit identischem `canonical_name_de`
- 136 Zeilen liegen in diesen Gruppen
- 73 überzählige Zeilen gegenüber genau einer Zeile je Name
- maximal 4 Foods mit demselben deutschen Namen

Fast alle sind aktiv in Rezepten referenziert:

- 840 von 846 Foods werden von Rezeptzutaten verwendet
- alle 136 Food-Zeilen aus Namens-Dublettengruppen werden derzeit referenziert

Deshalb dürfen Dubletten niemals einfach gelöscht werden. Zuerst müssen `recipe_ingredients.food_id` und `food_aliases.food_id` auf einen geprüften kanonischen Datensatz umgebogen werden.

Beispiele:

- `Champignons`: 3 Datensätze, davon einer fälschlich auf gekochte Shiitake gematcht
- `Basmatireis`: ein Proxy mit 35 kcal und ein plausibler Rohreis-Datensatz mit 350 kcal
- `Gemüsebrühe`: 4 nahezu identische Zeilen
- `Haferflocken`: 3 Zeilen, davon zwei praktisch identisch
- `Rote Linsen`: 3 nahezu identische Zeilen

---

## 3.3 Lebensmittelkategorien vermischen Regal und Nährstoffrolle

`catalog.foods.category` ist derzeit keine verlässliche Einkaufs-/Regalkategorie.

Verteilung:

- Gemüse: 396
- Kohlenhydrate: 77
- Nüsse / Samen: 59
- Pflanzliche Proteine: 57
- Saucen: 46
- Gewürze: 45
- Obst: 42
- Milchprodukte: 40
- Fleisch: 34
- Fette / Öle: 27
- Fisch: 23

396 Foods unter `Gemüse` zeigen einen offensichtlichen Default-/Mappingfehler.

Ziel:

`aisle_category` = Einkaufs-/Regalgruppe

Empfohlene feste Werte:

- Obst & Gemüse
- Kühlregal
- Fleisch & Fisch
- Trockenwaren
- Konserven & Gläser
- Backen & Gewürze
- Tiefkühl
- Getränke
- Sonstiges

Falls eine Nährstoffrolle gebraucht wird, kommt sie in ein separates Feld wie `nutrition_role`; sie wird nicht mehr mit dem Supermarktgang vermischt.

---

## 3.4 Preisfelder sind aktuell nicht produktionsreif

In `catalog.foods` sind Packung und Preis massiv durch Platzhalter geprägt.

Beispiel:

- 419 von 846 Foods tragen exakt `500 g / 1,79 €`
- weitere große Blöcke tragen ebenfalls standardisierte 500-g-Werte

Daraus darf keine seriöse Preiszusage oder Wochensumme abgeleitet werden.

Ziel:

Preise erhalten eine eigene Provenienz:

- `retailer`
- `pack_size`
- `pack_unit`
- `price_eur`
- `observed_at`
- `source_url` oder dokumentierte manuelle Quelle
- optional `region`

Ein fehlender Preis ist zulässig. Ein erfundener Preis nicht.

Langfristig wird Preisverlauf nicht direkt im Food-Master überschrieben, sondern in einer separaten Preisbeobachtungstabelle geführt.

---

## 3.5 Nährwertquellen müssen geprüft werden

Das heutige `catalog.foods` enthält richtige und falsche USDA-/Proxy-Matches.

Beispiele aus der Live-Datenbank:

- Basmatireis F0054: 35 kcal/100 g, Proxy; F0055: 350 kcal/100 g, plausibler Rohreis
- Champignons F0471: auf gekochte Shiitake gematcht
- Hähnchenbrust F0152/F0153: Quelle ist `Chicken breast, roll, oven-roasted`, obwohl State `roh/handelsüblich` lautet

`state` und tatsächlicher Quellzustand dürfen künftig nicht widersprechen.

Nährwerte werden künftig nur als freigegeben markiert, wenn Lebensmittelart und Zustand zusammenpassen.

---

## 3.6 Rezeptmakros sind überwiegend brauchbar, aber nicht vollständig konsistent

Für 600 Rezepte wurde kcal gegen 4/4/9 aus Protein/Kohlenhydraten/Fett geprüft.

Ergebnis:

- durchschnittliche absolute Abweichung: ca. 18 kcal
- 130 Rezepte über 25 kcal Differenz
- 4 Rezepte über 50 kcal Differenz
- größter Ausreißer: 211 kcal

Größte Fälle:

1. `Spaghetti mit Pilzen und Grünkohl`: 305 kcal angegeben vs. ca. 94 kcal aus Makros
2. `Cremige Fisch-Muschel-Suppe`: 185 kcal vs. ca. 383 kcal
3. `Fischsuppe`: 248 kcal vs. ca. 100 kcal

Diese Rezepte müssen manuell bzw. aus der Primärquelle geprüft werden.

Makros dürfen nicht blind neu aus den aktuell fehlerhaften `foods` berechnet werden. Erst Foods korrigieren, danach Rezeptmakros gegen Zutaten plausibilisieren.

---

## 3.7 Diät- und Allergenfelder sind semantisch doppelt

Aktuell existieren parallel:

- `recipe_versions.diet_tags`
- `recipe_classification.dietary_style`
- `recipe_allergens`
- `recipe_classification.allergen_flags`
- Public-Arrays `diet_tags` und `allergens`

Zusätzlich existieren Sprachunterschiede wie:

- `vegetarian` vs. `vegetarisch`
- `pescatarian` vs. `pescetarisch`
- `milk` / `dairy`
- `egg` / `eggs`
- `nuts_peanuts` / `nuts`

Ziel:

- kanonische Codes ausschließlich Englisch im Backend
- Diätstatus aus Zutaten ableiten und redaktionell überschreibbar machen
- Allergene ausschließlich aus `catalog.recipe_allergens` erzeugen
- Public-Arrays nur Projektion, keine zweite Wahrheit

Kanonische Allergen-Codes der App bleiben:

`eggs`, `dairy`, `nuts`, `soy`, `fish`, `shellfish`, `gluten`, `sesame`, `mustard`, `celery`, `sulphites`

---

# 4. Zielarchitektur

## 4.1 Master-/Admin-Schicht: `catalog`

### `catalog.foods`

Bleibt Lebensmittel-Master.

Künftig verantwortlich für:

- stabile `food_id`
- kanonische Namen
- Zustand
- Nährwerte pro 100 g/ml
- Einkaufs-/Regalkategorie
- Basis-Allergen-/Diet-Eigenschaften
- Datenherkunft und Prüfstatus

Packungs-/Preisdaten werden mittelfristig aus dem Master herausgelöst.

### `catalog.food_aliases`

Bleibt Mapping-Schicht für:

- alternative deutsche Bezeichnungen
- englische Bezeichnungen
- Schreibvarianten
- alte Legacy-Zutatennamen

Dadurch können Legacy-Zutaten und spätere Imports sauber gematcht werden, ohne den kanonischen Food-Namen zu verbiegen.

### `catalog.recipes`

Stabile Rezeptidentität.

Zusätzlich wird eine stabile öffentliche App-ID benötigt. Bestehende IDs dürfen nicht verloren gehen.

Ziel:

- `recipe_code`: interne redaktionelle ID
- `public_id`: stabile ID für App, Pläne, Favoriten und Historie
- `current_version_id`

Für die 500 neuen Rezepte kann `public_id` zunächst die heutige `v5-*`-ID bleiben.
Für Legacy-Rezepte bleibt die heutige ID wie `chicken_rice_broccoli` bestehen.

### `catalog.recipe_versions`

Bleibt versionierte Inhaltsfassung.

Führt redaktionelle Eigenschaften wie:

- Titel
- Mahlzeitenkategorie
- Portionen
- Zeit
- Schwierigkeit
- Meal-Prep-Eigenschaften
- Beschreibung/Storage-Hinweise
- Herkunft
- Qualitätsstatus

### `catalog.recipe_ingredients`

Bleibt alleinige strukturierte Zutatenbeziehung.

Source of Truth pro Rezeptzutat:

- `recipe_version_id`
- `position`
- `food_id`
- `amount`
- `unit`
- `preparation_note`

Nährwert- und Kostensnapshot-Felder dürfen als historischer Snapshot bleiben, sind aber nicht Masterdaten. Sie müssen eindeutig als Snapshot/derived behandelt werden.

### `catalog.recipe_steps`

Bleibt Source of Truth für Kochschritte.

Alle 100 Legacy-Rezepte müssen hier echte redaktionelle Schritte erhalten, bevor sie als vollständig geprüft gelten.

### `catalog.recipe_macros`

Bleibt freigegebene Rezept-/Portionsmakro-Schicht.

Wichtig:

- `recipe_macros` ist die veröffentlichte Makro-Wahrheit
- Zutatenberechnung dient zur Validierung
- Makros werden nicht automatisch überschrieben, solange Food-Masterdaten noch in Bereinigung sind

### `catalog.recipe_allergens`

Bleibt kanonische Allergenquelle.

Jede Allergenbeziehung sollte mindestens enthalten:

- Rezeptversion
- kanonischen Allergen-Code
- auslösende `food_id`
- derivation (`derived`, `manual`, `source`)

### `catalog.recipe_tags`

Bleibt normalisierte Tag-Tabelle.

`tag_type` und `derivation` sind ausdrücklich sinnvoll und werden beibehalten.

### `catalog.recipe_classification`

Bleibt Planungs-/Redaktionsklassifikation.

Aber: Felder, die bereits in `recipe_versions` oder `recipe_macros` autoritativ vorhanden sind, sind künftig nur noch abgeleitete Projektion und dürfen nicht unabhängig gepflegt werden.

Beispiele:

- `difficulty` → aus `recipe_versions`
- `prep_time_min` → aus `recipe_versions`
- `kcal_serving` → aus `recipe_macros`
- `protein_serving_g` → aus `recipe_macros`

Das verhindert erneutes Auseinanderdriften.

---

## 4.2 Öffentliche App-Schicht: `public.recipe_catalog_v2`

Die App soll langfristig nicht direkt auf `catalog.*` zugreifen.

`public.recipe_catalog_v2` wird eine read-only Projektion mit dem gleichen ergonomischen Vertrag wie heute:

- stabile `id`
- `source`
- `code`
- `name`
- `cat`
- Makros
- Zeit
- Portionen
- Schwierigkeit
- kanonische `diet_tags`
- kanonische `allergens`
- `tags`
- eingebettete `ingredients`
- `steps`
- `classification`
- `quality_score`
- `is_plan_eligible`

Der Unterschied: Die Daten werden aus den normalisierten Mastertabellen erzeugt und nicht mehr parallel kopiert/gepflegt.

`recipe_catalog_v1` bleibt bis zum App-Cutover unverändert.

---

## 4.3 Öffentliche Lebensmittelprojektion

`public.foods` soll langfristig keine zweite eigenständige Tabelle mehr sein.

Ziel:

- read-only View oder kontrollierte Projektion aus `catalog.foods`
- keine doppelte manuelle Pflege

---

# 5. Nutzer-/Haushaltsdaten: behalten, aber vom Katalog trennen

Aktueller echter Nutzungsstand:

- 3 `user_state`
- 1 `meal_plan`
- 35 `meal_plan_entries`
- 1 Haushalt
- 2 Haushaltsmitglieder
- 1 `shopping_item`
- 0 Cloud-Favoriten
- 0 Cloud-Rezeptfeedback

Die 35 vorhandenen Plan-Einträge referenzieren ausschließlich Legacy-Rezept-IDs.

Deshalb gilt ID-Kompatibilität als harte Migrationsanforderung.

Behalten:

- `profiles`
- `user_state`
- `households`
- `household_members`
- `meal_plans`
- `meal_plan_entries`
- `meal_entry_status`
- `shopping_items`
- `pantry_items`
- `custom_recipes`
- `favorites`
- `recipe_feedback`

Später als Legacy separat archivieren/deprecaten, nicht im Rahmen der Rezeptmigration löschen:

- `training_plans`
- `training_sessions`
- `training_sets`
- `timeline_blocks`
- `supplement_stack`
- `supplement_logs`
- `weight_logs`
- `water_logs`
- `gamification`
- `day_meta`

Das Entfernen dieser Tabellen ist ein eigener Auftrag und ausdrücklich nicht Teil der ersten Rezeptdatenmigration.

---

# 6. Migrationsreihenfolge

## Phase A — Food-Master sanieren

1. 63 Dublettengruppen klassifizieren:
   - echte Dublette
   - anderer Zustand
   - anderes Produkt
   - falscher Quellmatch
2. kanonische `food_id` je echter Dublettengruppe bestimmen
3. Foreign Keys in `recipe_ingredients`, `recipe_allergens` und `food_aliases` umbiegen
4. überzählige Food-Zeilen erst danach deaktivieren/löschen
5. feste Einkaufs-/Regalkategorien einführen
6. falsche USDA-/Proxy-Matches korrigieren
7. Preisfelder als unbestätigt markieren, bis echte Preisquelle vorhanden ist

## Phase B — 100 Legacy-Rezepte in `catalog.*`

1. jedem Legacy-Rezept interne `recipe_code`/Version geben
2. bestehende Public-ID unverändert als `public_id` erhalten
3. 93 Legacy-Zutatennamen über `food_aliases` mappen
4. 38 eindeutige Matches automatisch übernehmen
5. 10 mehrdeutige Namen manuell entscheiden
6. 45 fehlende Namen entweder Alias oder neues Food
7. echte Kochschritte schreiben
8. Makros prüfen
9. Diät/Allergene aus Zutaten ableiten
10. Classification und Quality Score erzeugen
11. erst nach Prüfung `approved` / planbar setzen

## Phase C — 500 V5-Rezepte redaktionell bereinigen

1. bekannte 25 `quality_issues` abarbeiten
2. 4 Makro-Großausreißer prüfen
3. Diät- und Allergenwidersprüche auflösen
4. deutsche Titel/Zutatenbezeichnungen glätten
5. unplausible Zutatenmengen prüfen
6. `shake`-Kategorie auflösen
7. Herkunft/Veröffentlichungsrecht bewusst entscheiden

## Phase D — Public V2 erzeugen

1. `public.recipe_catalog_v2` aus `catalog.*` bauen
2. kanonische Codes und IDs projizieren
3. Zutaten-JSON aus `recipe_ingredients + foods` erzeugen
4. Steps aus `recipe_steps`
5. Allergene aus `recipe_allergens`
6. Makros aus `recipe_macros`
7. Classification aus kontrollierter Projektion
8. ausschließlich SELECT für `anon`/`authenticated`

## Phase E — App-Cutover

1. App-Repository auf `recipe_catalog_v2` umstellen
2. alle Plan-, Swap-, Shopping-, Filter- und History-Tests laufen lassen
3. bestehende Legacy-IDs gegen aktuelle Nutzerpläne testen
4. Deployment mit Rückfallpunkt
5. `recipe_catalog_v1` zunächst weiterhin stehen lassen

---

# 7. Qualitätsgates

Ein Food gilt als freigegeben, wenn:

- kanonische Identität eindeutig
- Zustand korrekt
- Kategorie aus fester Liste
- Nährwerte plausibel und Quelle dokumentiert
- keine ungeklärte Dublette
- Preis entweder belegt oder bewusst unbekannt

Ein Rezept gilt als freigegeben, wenn:

- stabile ID vorhanden
- Kategorie planbar
- Portionen > 0
- Zutaten vollständig und auf gültige `food_id` referenziert
- echte Kochschritte vorhanden
- Makros plausibel
- Allergene aus Zutaten abgeleitet
- Diet-Status widerspruchsfrei
- keine offene High-Priority-Quality-Issue
- Herkunft/Source dokumentiert

---

# 8. Sicherheits-/Performance-Status vor Migration

Supabase Advisor meldet aktuell unter anderem:

- `catalog.*` besitzt RLS, aber absichtlich keine Public-Policies; das Schema ist damit für Clients nicht direkt lesbar
- mehrere alte SECURITY-DEFINER-Funktionen im `public`-Schema sind ausführbar und müssen separat sicherheitsseitig geprüft werden
- mehrere alte Nutzer-/Fitness-Tabellen haben suboptimale RLS-Prädikate und fehlende FK-Indizes
- Leaked-Password-Protection ist deaktiviert

Diese Probleme werden nicht mit der Rezeptmigration vermischt. Nach jeder DDL-/RLS-Migration werden Security- und Performance-Advisor erneut ausgeführt.

Supabase Linter Referenz:
https://supabase.com/docs/guides/database/database-linter

---

# 9. Unmittelbar nächster Arbeitsschritt

Noch ohne Schemaänderung:

**Food-Master Audit Queue erzeugen.**

Zuerst werden die 63 Dublettengruppen und die größten Nährwert-/Kategoriefehler in eine nachvollziehbare Korrekturliste gebracht. Jede Entscheidung erhält:

- betroffene `food_id`
- kanonische Ziel-ID
- Entscheidung: merge / keep variant / rename / remap source
- neue Kategorie
- korrekter Zustand
- Nährwertquelle
- Preisstatus
- betroffene Rezeptanzahl

Erst danach wird eine Migration für Phase A geschrieben und zur Freigabe vorgelegt.
