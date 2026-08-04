# CLAUDE.md — D1 Fitness PWA · Kontext-Recovery-Datei

> **Für Claude nach Context-Reset:** Diese Datei + die hochgeladene `index_latest.html` sind alles was du brauchst.
> Lies diese Datei zuerst, dann starte direkt — keine Rückfragen an den User.

---

## Workflow (WICHTIG — hier liegt das Problem)

```
User hat privates Repo, das NUR er pusht.
Claude hat keinen Push-Zugriff auf das private Repo.
Claude EDITIERT index_latest.html lokal → sendet via SendUserFile → User lädt hoch.

NACH CONTEXT-RESET:
1. User schickt index_latest.html als Upload (erstes oder zweites Message)
2. Claude: cp Upload → /home/user/godapp/index_latest.html
3. Claude: liest diese CLAUDE.md → kennt Stand
4. Weiterarbeiten als wäre nichts gewesen.

NACH JEDER PATCH-SESSION:
Claude pusht CLAUDE.md + supabase_schema.sql via MCP push_files (klein, geht).
index_latest.html pusht Claude NICHT (836KB, zu groß für MCP-Parameter).
```

**Session-Start-Kommando wenn User index_latest.html hochlädt:**
```bash
cp "<upload-pfad>" /home/user/godapp/index_latest.html
grep -o "APP_VERSION='[^']*'" /home/user/godapp/index_latest.html
grep -c "pushProfile\|_hhReady\|adjustPortion" /home/user/godapp/index_latest.html
```

---

## App-Identität

| Key | Wert |
|-----|------|
| APP_VERSION | `godapp6.7.1` |
| SCHEMA_VERSION | `8` |
| STORE_KEY | `godapp6_7_1_state_v1` |
| SB_URL | `https://rfdtjodpjvynnavnucvu.supabase.co` |
| SB_KEY | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrN3VGAiGP3e2MfAGqk7g0VZi2A` |
| Design | Amber `#F59E0B`, Navy `#0E1530`, Font Manrope |
| Datei | `/home/user/godapp/index_latest.html` (Single-File PWA) |
| Schema | `/home/user/godapp/supabase_schema.sql` (idempotent, im Supabase SQL-Editor ausführen) |

---

## Aktuelle Patches (Stand: Patch 13)

| Patch | Inhalt | Status |
|-------|--------|--------|
| 1–10 | Grundgerüst, Onboarding, Rezepte, Trainingsplan, Timeline, Gamification, Barcode, Shop | ✅ |
| 11 | Blob-basierter Haushalt-Sync (veraltet, durch Patch 12 ersetzt) | 🔁 ersetzt |
| 12 | **Granularer Haushalt-Sync** via RPCs `create_household`/`join_household` + Tabellen `meal_plans`/`meal_plan_entries`/`shopping_items`. Funktionen: `_sbRest`, `_sbRpc`, `createHousehold`, `joinHousehold`, `leaveHousehold`, `_getOrCreatePlanId`, `pushMealPlan`, `_applyPlanToMealWeek`, `syncHousehold`, `saveToHousehold` (debounced), `pushShopItem`, `pullShopping`, `pushAllShopping`. Guard: `_hhReady` Flag blockiert Push bis erster Sync. | ✅ |
| 13 | **Granulare Personen-Daten** — `pushProfile` (→ `profiles`, typed Cols via `_PROFILE_COLMAP` + Settings-Blob, in `save()`), `pushGamification` (→ `gamification`, in `addXP`), `pushWeightLog`/`pushWaterLog` (upsert/Tag, in `logWeight`/`addWater`). **Pro-Person-Portionen**: `state.profile.portionFactor` (0.6–1.8), Regler im Profil-UI (`adjustPortion(±0.1)`), `scaledRecipe` multipliziert Faktor — eigene kcal/Mengen skalieren, geteilter Plan bleibt identisch. `state.bestStreak` in `updateStreak` getrackt. Initial-Push nach Login in `onAuthSuccess`. | ✅ |

---

## Nächste geplante Patches

| Patch | Priorität | Inhalt |
|-------|-----------|--------|
| 14 | 🔴 Kritisch | JWT-Refresh (Token läuft nach 1h ab, Sync schlägt still fehl), Sync-Fehler-Toast (User sieht nichts), sw.js + manifest.json regenerieren |
| 15 | 🟠 UX | `prompt()`/`confirm()` → eigene Modals (6 Stellen), Zwangs-Login raus aus Onboarding, tote „+ Profil"-Button fixen, Schrittzähler korrigieren, Portionsmodal „Einloggen"→„Bestätigen" |
| 16 | 🟡 Engine | Echte Trainings-Progression (letztes Gewicht/Wdh je Übung → nächste Session vorschlagen), Rezept-Wiederholungsschutz über ganze Woche |
| 17 | Später | Learning-Signals aktivieren, Kalender-Konflikt-Fallback, Macro-Skalierung verbessern |

---

## Supabase Schema (v2)

Datei: `supabase_schema.sql`. Im Supabase SQL-Editor ausführen — ist idempotent (DROP IF EXISTS + CREATE IF NOT EXISTS).

### 20 Tabellen

| Tabelle | Zweck |
|---------|-------|
| `profiles` | 1 Zeile/User; alle Onboarding-Daten + Settings |
| `households` | Haushalt-Grunddaten (invite_code, name, created_by) |
| `household_members` | User↔Haushalt mit role (owner/member) |
| `meal_plans` | 1/Woche/Haushalt (week_start, diet_override, meta JSONB) |
| `meal_plan_entries` | Tag×Kategorie×Rezept-ID (day_date, category, recipe_id, prep_group) |
| `meal_entry_status` | Pro-Person Abhaken + portion_factor (entry_id, user_id, status, portion_factor) |
| `shopping_items` | Granulare Einkaufsliste (gegenseitig abhakbar, checked_by) |
| `timeline_blocks` | Kalender-Blöcke (kind, day_date=NULL=unscheduled) |
| `training_plans` | Wochenplan-Metadaten |
| `training_sessions` | Session-Log |
| `training_sets` | Satz×Gewicht×Wdh |
| `supplement_stack` | Stack-Definitionen |
| `supplement_logs` | Tägliches Logging |
| `weight_logs` | Gewichtsverlauf (upsert/Tag) |
| `water_logs` | Wasseraufnahme (upsert/Tag) |
| `gamification` | XP/Level/Streak/best_streak/badges |
| `custom_recipes` | Eigene Rezepte (privat oder im Haushalt geteilt) |
| `pantry_items` | Vorrat |
| `day_meta` | Tages-Metadaten (load, minimalDay) |
| `user_state` | Blob-Backup des kompletten States |

### RLS-Prinzip
- Persönliche Tabellen: `user_id = auth.uid()` 
- Haushalt-Tabellen: `household_id IN (user_household_ids())`
- Haushalt INSERT/UPDATE: nur über Security-Definer-RPCs (`create_household`, `join_household`)
- `award_xp(p_xp)` RPC: Streak/Level automatisch (Security Definer)

---

## State → DB Mapping

| `state.*` | DB-Tabelle | Migriert? |
|-----------|-----------|-----------|
| `profile` | `profiles` | ✅ write-through (`pushProfile` in `save()`, typed Cols + `settings`-Blob) |
| `profile.portionFactor` | in `settings` | ✅ Patch 13 |
| `mealWeek` | `meal_plans` + `meal_plan_entries` | ✅ im Haushalt; lokal noch user_state |
| `shopChecked` | `shopping_items` | ✅ gegenseitig abhakbar |
| `householdId/Code` | `households` via RPCs | ✅ Patch 12 |
| `weightLog` | `weight_logs` | ✅ write-through (pushWeightLog in logWeight) |
| `waterLog` | `water_logs` | ✅ write-through (pushWaterLog in addWater) |
| `xp/level/streak` | `gamification` | ✅ write-through (pushGamification in addXP) |
| `mealLog/mealActual` | `meal_entry_status` | ⬜ TODO Patch 14+ |
| `timeline.days[].blocks` | `timeline_blocks` | ⬜ TODO |
| `trainingWeek` | `training_plans` | ⬜ TODO |
| `sessionLog/progressionLog` | `training_sessions/sets` | ⬜ TODO |
| `customRecipes` | `custom_recipes` | ⬜ TODO |
| `myVorrat` | `pantry_items` | ⬜ TODO |
| `dayLoad/minimalDays` | `day_meta` | ⬜ TODO |

---

## Bekannte App-Profil-Felder (`state.profile`)

```
name, age, heightCm, weightKg, sex, mainGoal, goals[], fitnessLevel,
equipment[], injuries, dietStyle, mealMode, allergies[], calorieTarget,
proteinTargetG, shakeEnabled, snacksEnabled, wakeTime, sleepTime,
preferredTrainingTime, workSchedule{}, bufferAfterWorkMin, prepDays,
persons, hideKcal, fixedBlocks[], cookDays, shopDays, waterGoalMl,
portionFactor, createdAt
```

`_PROFILE_COLMAP` mappt diese auf DB-Spalten in `profiles`.

---

## Key-Funktionen (Zeilen-Referenz für die aktuelle index_latest.html)

| Funktion | Beschreibung |
|----------|-------------|
| `save()` | localStorage + `syncToCloud()` + `saveToHousehold()` + `pushProfile()` |
| `addXP(amount, label)` | XP/Level + `updateStreak()` + `pushGamification()` |
| `updateStreak()` | streak/lastActive/bestStreak |
| `scaledRecipe(r, cat, p)` | kcal-Skalierung × `portionFactor` |
| `effectiveKcal(p)` | `calorieOverride \|\| calorieTarget \|\| 2200` |
| `logWeight()` | prompt → weightLog[] + `pushWeightLog()` |
| `addWater(n)` | waterLog{} + `pushWaterLog()` |
| `adjustPortion(d)` | portionFactor ±0.1, Regler im Profil |
| `finishOnboarding()` | profile-Objekt aufbauen, `regenerateAll()`, `addXP(100)` |
| `syncToCloud()` | Debounced (1500ms) → `sbUpsert('user_state', ...)` |
| `loadFromCloud()` | `sbSelect('user_state', ...)` → `normalizeStateShape()` |
| `onAuthSuccess()` | Cloud laden, Haushalt-Sync, `pushProfile()`, `pushGamification()` |
| `init()` | Startup: load, patches, regenerate, Haushalt-Sync |
| `_sbRest(path, opts)` | Supabase REST wrapper |
| `_sbRpc(fn, body)` | Supabase RPC wrapper |
| `syncHousehold()` | Pull meal_plans + entries + shopping (setzt `_hhReady=true`) |
| `pushMealPlan()` | DELETE + INSERT meal_plan_entries, PATCH meta |
| `saveToHousehold()` | Debounced (1500ms), Guard: `_hhReady` |
| `pushShopItem(key, checked)` | Upsert shopping_items |
| `pushProfile()` | Upsert profiles (debounced 1500ms) |
| `pushGamification()` | Upsert gamification (debounced 1500ms) |
| `pushWeightLog(date, w, bf)` | Upsert weight_logs |
| `pushWaterLog(date, ml)` | Upsert water_logs |
| `renderMealsContent()` | Haupt-Render Meals-Tab |
| `renderMealDay(day)` | Einzeltag mit Mahlzeiten-Cards |
| `renderProfile()` | Profil-Tab (inkl. Portionsfaktor-Regler) |
| `renderTimeline()` / `renderWeek()` | Kalender-Views |
| `buildMealWeek(weekStart, p)` | Wochenplan generieren |
| `buildTrainingWeek(weekStart, p)` | Trainingsplan generieren |
| `buildTimeline(weekStart, p, ...)` | Kalender-Blöcke platzieren |

---

## Was NICHT im Repo ist (und warum)

- `index_latest.html` — 836KB, zu groß für MCP push_files Parameter. **User uploaded es am Session-Start.**
- `sw.js` + `manifest.json` — fehlen, PWA-Patch (Patch 14) noch ausstehend
- `icon.png` — liegt bei User lokal

---

## Gesprächskontext (wichtig nach Reset)

- App ist eine **Single-File PWA** (kein Build, kein Framework — reines HTML/CSS/JS)
- Zielgruppe: deutschsprachig; Design Amber/Navy; Ästhetik: minimalistisch, premium
- Nutzer: Janik + Freundin (geteilter Haushalt), er auf mehr kcal als sie — deswegen portionFactor
- **Kein Git-Push von Claude** — Datei wird via `SendUserFile` übergeben, User lädt auf privates Repo hoch
- **Supabase-Schema ausführen**: einmalig im SQL-Editor, danach nie wieder nötig (außer bei Breaking Changes)
- `user_state`-Blob bleibt für Restore maßgeblich — granulare Tabellen sind write-through (zusätzlich)
- **godapp.html** im Repo = alte Version, ignorieren
- **Expo/React-Native-Skeleton** (`src/`, `App.tsx`) = früher Versuch, ignorieren

---

*Zuletzt aktualisiert: Patch 13 — Claude Sonnet 4.6 — 2026-06-11*
