-- PROPOSAL ONLY — NICHT AUTOMATISCH AUSFÜHREN
-- Preply catalog food deduplication, Klassen A + B
-- Stand 2026-08-26
--
-- Wirkung:
--   - nur catalog.*
--   - public.recipe_catalog_v1 bleibt unverändert
--   - public.foods bleibt unverändert
--   - aktuelle App wird dadurch nicht verändert
--
-- Vor Ausführung erneut Live-Zahlen prüfen.

begin;

create temporary table _food_merge_map (
  source_id text primary key,
  target_id text not null
) on commit drop;

insert into _food_merge_map(source_id,target_id) values
  ('F0032','F0036'),
  ('F0264','F0263'),
  ('F0274','F0275'),
  ('F0711','F0792'),
  ('F0785','F0792'),
  ('F0789','F0792'),
  ('F0255','F0254'),
  ('F0294','F0290'),
  ('F0563','F0564'),
  ('F0332','F0333'),
  ('F0335','F0336'),
  ('F0339','F0340'),
  ('F0153','F0152'),
  ('F0679','F0678'),
  ('F0188','F0112'),
  ('F0164','F0165'),
  ('F0391','F0392'),
  ('F0187','F0314'),
  ('F0205','F0206'),
  ('F0230','F0231'),
  ('F0124','F0123'),
  ('F0583','F0584'),
  ('F0407','F0406'),
  ('F0209','F0210'),
  ('F0289','F0288'),
  ('F0519','F0518'),
  ('F0529','F0319'),
  ('F0540','F0541'),
  ('F0619','F0617'),
  ('F0394','F0393'),
  ('F0063','F0064'),
  ('F0608','F0606'),
  ('F0701','F0606'),
  ('F0613','F0611'),
  ('F0662','F0661'),
  ('F0179','F0178'),
  ('F0068','F0069'),
  ('F0476','F0477'),
  ('F0668','F0669'),
  ('F0764','F0765'),
  ('F0411','F0413'),
  ('F0217','F0216');

-- -------------------------------------------------------------------------
-- Preflight: Abbruch, wenn der Live-Stand nicht mehr dem geprüften Stand
-- entspricht. Lieber eine Migration verweigern als still auf veralteten
-- Annahmen weiterarbeiten.
-- -------------------------------------------------------------------------
do $$
declare
  v_map_count integer;
  v_missing_source integer;
  v_missing_target integer;
  v_ingredient_rows integer;
  v_allergen_collisions integer;
begin
  select count(*) into v_map_count from _food_merge_map;
  if v_map_count <> 42 then
    raise exception 'Preflight: erwartet 42 Merge-Mappings, gefunden %', v_map_count;
  end if;

  select count(*) into v_missing_source
  from _food_merge_map m
  left join catalog.foods f on f.food_id=m.source_id
  where f.food_id is null;
  if v_missing_source <> 0 then
    raise exception 'Preflight: % Source-Foods fehlen', v_missing_source;
  end if;

  select count(*) into v_missing_target
  from _food_merge_map m
  left join catalog.foods f on f.food_id=m.target_id
  where f.food_id is null;
  if v_missing_target <> 0 then
    raise exception 'Preflight: % Target-Foods fehlen', v_missing_target;
  end if;

  select count(*) into v_ingredient_rows
  from catalog.recipe_ingredients ri
  join _food_merge_map m on m.source_id=ri.food_id;
  if v_ingredient_rows <> 164 then
    raise exception 'Preflight: erwartet 164 betroffene Zutatenzeilen, gefunden %', v_ingredient_rows;
  end if;

  select count(*) into v_allergen_collisions
  from catalog.recipe_allergens ra
  join _food_merge_map m on m.source_id=ra.trigger_food_id
  where exists (
    select 1
    from catalog.recipe_allergens rb
    where rb.recipe_version_id=ra.recipe_version_id
      and rb.allergen_code=ra.allergen_code
      and rb.trigger_food_id=m.target_id
  );
  if v_allergen_collisions <> 0 then
    raise exception 'Preflight: % Allergen-PK-Kollisionen', v_allergen_collisions;
  end if;
end $$;

-- -------------------------------------------------------------------------
-- Foreign-Key-Referenzen zuerst auf die Ziel-ID umbiegen.
-- -------------------------------------------------------------------------
update catalog.recipe_ingredients ri
set food_id=m.target_id
from _food_merge_map m
where ri.food_id=m.source_id;

update catalog.recipe_allergens ra
set trigger_food_id=m.target_id
from _food_merge_map m
where ra.trigger_food_id=m.source_id;

update catalog.food_aliases fa
set food_id=m.target_id
from _food_merge_map m
where fa.food_id=m.source_id;

-- Nach dem Remap können identische Aliaszeilen für dasselbe Food entstehen.
-- Pro food_id / alias / language / is_primary bleibt deterministisch eine Zeile.
with ranked as (
  select alias_id,
         row_number() over (
           partition by food_id,lower(trim(alias)),language,is_primary
           order by alias_id
         ) as rn
  from catalog.food_aliases
)
delete from catalog.food_aliases fa
using ranked r
where fa.alias_id=r.alias_id
  and r.rn>1;

-- Erst wenn alle FKs umgebogen sind, werden die überzähligen Food-Zeilen
-- entfernt. Public-Kopien bleiben bewusst unangetastet.
delete from catalog.foods f
using _food_merge_map m
where f.food_id=m.source_id;

-- -------------------------------------------------------------------------
-- Postflight innerhalb derselben Transaktion.
-- -------------------------------------------------------------------------
do $$
declare
  v_sources_left integer;
  v_broken_ingredients integer;
  v_broken_aliases integer;
  v_broken_allergens integer;
begin
  select count(*) into v_sources_left
  from catalog.foods f join _food_merge_map m on m.source_id=f.food_id;
  if v_sources_left <> 0 then
    raise exception 'Postflight: % Source-Foods wurden nicht entfernt', v_sources_left;
  end if;

  select count(*) into v_broken_ingredients
  from catalog.recipe_ingredients ri
  left join catalog.foods f on f.food_id=ri.food_id
  where f.food_id is null;
  if v_broken_ingredients <> 0 then
    raise exception 'Postflight: % Zutaten ohne gültiges Food', v_broken_ingredients;
  end if;

  select count(*) into v_broken_aliases
  from catalog.food_aliases fa
  left join catalog.foods f on f.food_id=fa.food_id
  where f.food_id is null;
  if v_broken_aliases <> 0 then
    raise exception 'Postflight: % Aliase ohne gültiges Food', v_broken_aliases;
  end if;

  select count(*) into v_broken_allergens
  from catalog.recipe_allergens ra
  left join catalog.foods f on f.food_id=ra.trigger_food_id
  where f.food_id is null;
  if v_broken_allergens <> 0 then
    raise exception 'Postflight: % Allergene ohne gültiges Trigger-Food', v_broken_allergens;
  end if;
end $$;

-- Wenn dieser Vorschlag über Supabase apply_migration ausgeführt wird,
-- wird die Transaktion dort committed. Für manuelles Dry-Run kann COMMIT
-- vorübergehend durch ROLLBACK ersetzt werden.
commit;
