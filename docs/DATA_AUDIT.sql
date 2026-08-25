-- Datenaudit Rezeptkatalog — beantwortet: greifen die Filter überhaupt?
-- Ausführen, sobald das Supabase-Projekt wieder aktiv ist.
-- Reines Lesen, keine Änderungen.

-- 1) Sind die Felder gefüllt, auf denen Filter und Sortierung beruhen?
SELECT
  count(*)                                                                    AS gesamt,
  count(*) FILTER (WHERE is_plan_eligible)                                    AS plan_faehig,
  count(*) FILTER (WHERE classification IS NULL OR classification = '{}')     AS ohne_classification,
  count(*) FILTER (WHERE diet_tags IS NULL OR jsonb_array_length(diet_tags)=0) AS ohne_diet_tags,
  count(*) FILTER (WHERE allergens IS NULL OR jsonb_array_length(allergens)=0) AS ohne_allergens,
  count(*) FILTER (WHERE classification->>'novelty_level'      IS NULL)       AS ohne_novelty,
  count(*) FILTER (WHERE classification->>'dish_type'          IS NULL)       AS ohne_dish_type,
  count(*) FILTER (WHERE classification->>'meal_prep_score_v2' IS NULL)       AS ohne_prep_score,
  count(*) FILTER (WHERE classification->>'cost_band'          IS NULL)       AS ohne_cost_band,
  count(*) FILTER (WHERE difficulty IS NULL)                                  AS ohne_difficulty,
  count(*) FILTER (WHERE "time" IS NULL OR "time" = 0)                        AS ohne_zeit,
  count(*) FILTER (WHERE quality_score IS NULL)                               AS ohne_quality_score
FROM recipe_catalog_v1;

-- 2) Alltagstauglichkeit: wie exotisch ist der Katalog wirklich?
--    Erwartung des Produkts: Hausmannskost ist der Normalfall.
SELECT
  coalesce(classification->>'novelty_level','(leer)') AS novelty_level,
  count(*),
  round(100.0*count(*)/sum(count(*)) OVER (), 1) AS prozent
FROM recipe_catalog_v1 WHERE is_plan_eligible
GROUP BY 1 ORDER BY 1;

-- 3) Wie verteilt sich die abgeleitete simplicity (Code-Logik nachgebaut)?
SELECT CASE
    WHEN difficulty='easy' AND "time"<=30
     AND jsonb_array_length(ingredients)<=12
     AND coalesce((classification->>'novelty_level')::int,0)<=2            THEN 'simple'
    WHEN difficulty='hard' OR "time">60
     OR coalesce((classification->>'novelty_level')::int,0)>=4
     OR jsonb_array_length(ingredients)>20                                 THEN 'experimental'
    ELSE 'balanced' END AS simplicity,
  count(*), round(100.0*count(*)/sum(count(*)) OVER (),1) AS prozent
FROM recipe_catalog_v1 WHERE is_plan_eligible GROUP BY 1 ORDER BY 2 DESC;

-- 4) Kochzeit gegen das Standardprofil (maxCookingTime = 30) je Kategorie.
--    Zeigt, ob der Planer je Mahlzeit genug Auswahl hat.
SELECT cat,
  count(*) AS gesamt,
  count(*) FILTER (WHERE "time" <= 30) AS bis_30_min,
  count(*) FILTER (WHERE "time" <= 30 AND difficulty='easy') AS bis_30_und_einfach
FROM recipe_catalog_v1 WHERE is_plan_eligible GROUP BY cat ORDER BY 2 DESC;

-- 5) Einkaufsliste: tragen die Zutaten die Einkaufsdaten, die die Engine braucht?
WITH z AS (
  SELECT jsonb_array_elements(ingredients) AS i FROM recipe_catalog_v1 WHERE is_plan_eligible
)
SELECT
  count(*) AS zutaten_gesamt,
  count(*) FILTER (WHERE i->>'category'   IS NULL) AS ohne_kategorie,
  count(*) FILTER (WHERE i->>'pack_size'  IS NULL AND i->>'packSize'  IS NULL) AS ohne_packsize,
  count(*) FILTER (WHERE i->>'pack_unit'  IS NULL AND i->>'packUnit'  IS NULL) AS ohne_packunit,
  count(*) FILTER (WHERE i->>'pack_price_eur' IS NULL AND i->>'packPrice' IS NULL) AS ohne_packpreis,
  count(*) FILTER (WHERE i->>'unit'       IS NULL) AS ohne_einheit
FROM z;

-- 6) Welche Zutaten-Kategorien gibt es? Muss zu displayCategory() im Code passen,
--    sonst landet alles unter "Sonstiges".
WITH z AS (
  SELECT jsonb_array_elements(ingredients) AS i FROM recipe_catalog_v1 WHERE is_plan_eligible
)
SELECT i->>'category' AS kategorie, count(*) FROM z GROUP BY 1 ORDER BY 2 DESC;

-- 7) Kandidaten für eine Vorratsliste: was taucht überall auf und wird nie gekauft?
WITH z AS (
  SELECT jsonb_array_elements(ingredients)->>'name' AS name FROM recipe_catalog_v1 WHERE is_plan_eligible
)
SELECT name, count(*) AS in_rezepten FROM z GROUP BY 1 ORDER BY 2 DESC LIMIT 40;
