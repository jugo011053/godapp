# Preply · Implementierte Datenbank-Fixes

Stand: 2026-08-26

Dieses Dokument beschreibt ausschließlich Änderungen, die tatsächlich in der produktiven Supabase `rfdtjodpjvynnavnucvu` angewendet wurden.

## 1. Food-Master-Grundlage

Migration: `catalog_food_master_foundation_and_safe_dedup`

### Neue Felder in `catalog.foods`

- `merged_into_food_id`
- `aisle_category`
- `nutrition_role`
- `nutrition_status`
- `price_status`
- `price_source_note`
- `price_checked_at`

`aisle_category` und `nutrition_role` sind bewusst getrennt. Die bisherige Spalte `category` vermischte Supermarktgang und Nährstoffrolle.

### Neue Tabellen

#### `catalog.food_price_observations`

Künftige Preisbeobachtungen hängen an Food + Händler + Region + Packung + Datum. Die bisherigen Packungs-/Preisfelder werden vorerst aus Kompatibilitätsgründen nicht gelöscht.

#### `catalog.food_merge_log`

Enthält vollständige Snapshots aller soft-gemergten Food-Datensätze.

### Preisstatus

Offensichtliche Platzhalter werden nicht gelöscht, sondern markiert:

- `placeholder_suspected`: insbesondere 500 g / 1,79 EUR
- `unknown`: Packung oder Preis fehlt
- `unreviewed`: übrige bisher nicht belegte Werte

Die aktuelle App liest weiterhin `public.recipe_catalog_v1`; dadurch wurde die Live-Preisberechnung mit dieser Migration noch nicht verändert.

### Nährwertstatus

- offensichtliche Proxy-Foods -> `proxy`
- bekannte falsche bzw. widersprüchliche Matches -> `review_required`
- restliche Foods -> `unreviewed`

Es wurden absichtlich keine Nährwerte erfunden oder pauschal überschrieben.

## 2. Sichere Food-Dubletten konsolidiert

Batch: `safe_dedup_20260826`

42 überzählige Food-IDs aus den zuvor geprüften Klassen A/B wurden soft-gemergt.

Technik:

1. vollständiger Source-Snapshot in `catalog.food_merge_log`
2. `catalog.recipe_ingredients.food_id` auf Ziel-ID umgebogen
3. `catalog.recipe_allergens.trigger_food_id` auf Ziel-ID umgebogen
4. `catalog.food_aliases.food_id` auf Ziel-ID umgebogen
5. Source-Food bleibt physisch erhalten, wird aber `active=false`
6. `merged_into_food_id` verweist auf die kanonische Ziel-ID

Kein Food wurde physisch gelöscht.

Postflight nach Migration:

- `catalog.foods`: 846 gesamt
- aktive Foods: 804
- soft-gemergt: 42
- Merge-Log: 42
- `catalog.recipe_ingredients`: weiterhin 5.403
- kaputte Food-FKs: 0
- kaputte Allergen-FKs: 0
- `public.recipe_catalog_v1`: weiterhin 600
- `public.foods`: weiterhin 846

## 3. Rezept-Guardrails

Migration: `recipe_planning_guardrails_and_shake_cleanup`

### Neue Tabelle `catalog.data_patch_log`

Speichert vor produktiven Datenpatches vollständige Snapshots betroffener Datensätze.

Batch: `recipe_guardrails_20260826`

102 Snapshots:

- 100 Legacy-Rezepte ohne Kochschritte
- 7 Shake-Rezepte, wobei sich Überschneidungen ergeben

### Rezepte ohne Kochschritte

Alle 100 Legacy-Rezepte ohne echte `steps` bleiben im Katalog sichtbar, sind aber ab jetzt:

`is_plan_eligible = false`

Damit kann die App sie nicht mehr automatisch in einen Plan setzen, bis echte Kochanweisungen redaktionell ergänzt wurden.

Postflight:

- Rezepte ohne Schritte: 100
- davon weiterhin automatisch planbar: 0

### Kategorie `shake`

Die zwei vollständigen V5-Smoothies:

- `v5-sh-056` Rote-Bete-Smoothie
- `v5-sh-057` Vitamin-Smoothie

wurden auf `cat='snack'` umgestellt.

Ihre `dish_type`-Information `Smoothie/Shake` bleibt erhalten. `meal_role` wurde auf `Leichte Mahlzeit` gesetzt. Das normalisierte `catalog`-Schema wurde parallel angepasst.

Die fünf Legacy-Shakes bleiben wegen fehlender Kochschritte nicht planbar und vorerst als `shake` erhalten.

Aktueller Postflight:

- verbleibende `shake`-Zeilen: 5
- migrierte vollständige Smoothies: 2
- beide weiterhin planbar: 2

## 4. Diätkonflikte sichtbar gemacht

112 aktuell nach Sprach-Normalisierung widersprüchliche Kombinationen zwischen `diet_tags` und `classification.dietary_style` wurden als `catalog.quality_issues` mit Priorität `hoch`, Bereich `Klassifikation`, dokumentiert.

Die Werte selbst wurden noch nicht pauschal überschrieben. Die V8-App leitet Diätverträglichkeit bereits defensiv aus Zutaten ab. Die endgültige Datenkorrektur erfolgt erst, wenn Food-Eigenschaften und Legacy-Mapping vollständig sauber sind.

## 5. Security Advisor nach DDL

Die neuen privaten `catalog`-Tabellen haben RLS aktiviert und keine Policies. Das ist beabsichtigt: Sie sollen nicht über die öffentliche API zugänglich sein.

Der Advisor meldet dies als INFO `rls_enabled_no_policy`; es ist für diese privaten Tabellen kein Fehler.

Weiterhin bestehende, nicht durch diese Datenmigration verursachte Warnungen betreffen u. a. öffentliche SECURITY-DEFINER-Funktionen und deaktivierten Leaked-Password-Schutz. Diese gehören in den separaten Security-Track.

## 6. Bewusst noch nicht geändert

Nicht automatisch korrigiert wurden:

- 24 konfliktbehaftete Food-Dublettengruppen (z. B. Champignons, Basmatireis, Rapsöl, Hähnchenschenkel)
- bekannte falsche USDA-Matches durch frei erfundene Ersatzwerte
- 44 Legacy-Zutatennamen ohne eindeutiges Food-Mapping
- Kochschritte der 100 Legacy-Rezepte
- die 112 Diätkonflikte selbst
- BBC-Good-Food-Texte/Bilder
- öffentliche Umstellung auf `recipe_catalog_v2`

Diese Punkte brauchen redaktionelle bzw. quellenbasierte Entscheidungen und werden nicht durch heuristische Massenupdates verschleiert.

## Rollback

### Food-Dedupe

Alle Source-Foods sind physisch vorhanden und über `catalog.food_merge_log` vollständig gesichert. Ein Rollback kann Referenzen anhand des Batches `safe_dedup_20260826` auf die Source-IDs zurücksetzen und `active/merged_into_food_id` wiederherstellen.

### Recipe Guardrails

Die Originalzeilen der betroffenen `public.recipe_catalog_v1`-Datensätze liegen vollständig im `catalog.data_patch_log` unter Batch `recipe_guardrails_20260826`.

Keine der beiden Migrationen hat bestehende Nutzerpläne, Historie oder Rezept-IDs umnummeriert.
