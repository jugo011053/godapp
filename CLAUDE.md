# CLAUDE.md — Preply · Kontext-Recovery-Datei

> **Für Claude nach Context-Reset:** Diese Datei allein reicht. Repo fetchen, das hier lesen, weiterarbeiten. **Keine Uploads mehr nötig** — der Code liegt im Repo.

---

## Die eine Regel

**Die lebende Datei ist `app/index.html`. Nur die.**

Alles unter `archive/` ist tot und wird nicht deployt — auch wenn es dieselbe `APP_VERSION` trägt. Verlass dich auf den Pfad, nie auf die Versionsnummer.

---

## Workflow

```
1. app/index.html bearbeiten
2. committen
3. nach main pushen
4. GitHub Actions deployt automatisch -> live in ~1 Minute
```

Kein Upload, kein SendUserFile-Umweg, kein manueller Schritt. Claude hat Push-Zugriff.

**Live:** https://jugo011053.github.io/godapp/
**Repo:** https://github.com/jugo011053/godapp — **öffentlich** (nicht privat!)

### Deploy-Details
- Workflow: `.github/workflows/deploy-pages.yml`
- Triggert auf Push nach `main`, wenn sich `app/**` ändert
- Lädt `app/` als Site-Root hoch → alle Pfade in der App sind **relativ**, damit sie unter `/godapp/` funktionieren. **Nie auf absolute Pfade (`/sw.js`, `/manifest.json`) umstellen** — das bricht den Unterpfad-Deploy.
- Pages deployt **nur vom Default-Branch**. Arbeit auf einem Feature-Branch muss nach `main` gemergt werden, sonst passiert nichts.

### Session-Start
```bash
cd /home/user/godapp
git fetch origin main && git checkout main && git pull
grep -oE "APP_VERSION='[^']*'" app/index.html
```

---

## App-Identität

| Key | Wert |
|-----|------|
| Produktname | **Preply** (Repo heißt noch `godapp`, App-interne Namen noch `godapp*` — Altlast) |
| APP_VERSION | `godapp7.0.0` |
| SCHEMA_VERSION | `9` |
| STORE_KEY | `godapp6_7_1_state_v1` — **nicht umbenennen**, sonst verlieren alle Nutzer ihre lokalen Daten |
| Supabase URL | `https://rfdtjodpjvynnavnucvu.supabase.co` (Projekt heißt im Dashboard noch `D1 DayOne`) |
| Supabase anon key | **steht in `app/index.html`** — hier bewusst nicht dupliziert, die frühere Kopie in dieser Datei war fehlerhaft und führte zu 401ern |
| Datei | `app/index.html` (Single-File-PWA, ~410 KB, kein Build, kein Framework) |

### Design (hell/grün — Preply)
```
--paper / --bg : #f7f7f4     --card  : #ffffff
--ink / --text : #111111     --muted : #72726d
--accent       : #78a800     --border: #e1e1db
```
Manifest + `theme-color` sind ebenfalls `#78A800`. **Das frühere Navy/Amber (`#0E1530`/`#F59E0B`) gilt nicht mehr** — es existiert nur noch als erster, überschriebener `:root`-Block im CSS. Beim Prüfen von Farben immer den **letzten** `:root` ansehen, sonst zieht man falsche Schlüsse.

---

## Struktur der App

**Bottom-Nav: Heute · Plan · Einkaufen.** Profil liegt als Icon oben rechts im Header (dort Haushaltscode + Konfiguration).

| Bereich | Inhalt |
|---|---|
| Heute | Mahlzeiten des heutigen Tages |
| Plan | Woche, Tage einzeln durchklickbar, Gerichte tauschbar |
| Einkaufen | Liste aus dem Plan, abhakbar, Pack-/Preisrechnung |
| Bibliothek | über „Bibliothek öffnen" aus Heute/Plan — nach Mahlzeit getrennt, mit Filtern |
| Profil | Header-Icon: Ziele, kcal/Protein, Portionsgröße, Personen, Haushaltscode |

**Nicht sichtbar (Code liegt noch da, ist keine Produktanforderung):** Training, Timeline mit Uhrzeiten, Supplements, XP/Level/Streak, Wasser-/Gewichts-Tracking.

---

## Rezepte

**600 Rezepte in Supabase** (`recipe_catalog_v1`), geladen via Supabase REST → IndexedDB-Cache:
- 100 Legacy-Rezepte (source=`legacy_v1`, original aus D1)
- 500 neue Rezepte (source=`catalog_v5`, aus `Preply_Seed_Datenbank_v5.0_clean.xlsx`)
- 87 Frühstück · 194 Mittag · 282 Abend · 30 Snack · 7 Shake

**Keine Inline-Rezepte mehr.** `RECIPES` ist initial leer und wird beim Start aus Supabase/Cache befüllt (`loadRecipeCatalog()`). Stale-while-revalidate: Cache wird nach 1h im Hintergrund aktualisiert.

**846 Foods** in der `foods`-Tabelle: Lebensmittel-Stammdaten mit USDA-Nährwerten pro 100g und Supermarktpreisen.

Jedes Rezept trägt `kcal/protein/fat/carbs/fiber/salt`, `time`, `prep_time`, `tags[]`, `allergens[]`, `diet_tags[]`, `steps[]` (echte Kochschritte!), `classification` (41 Felder), `quality_score`, `source_url` und `ingredients[]` **mit Einkaufsdaten** (`packSize`, `packPrice`, `step`, `category`). Einkaufsmetadaten sind weiterhin die Grundlage der Einkaufslisten-Engine.

Seed-DB v5.0: `docs/Preply_Seed_Datenbank_v5.0_clean.xlsx` (eingepflegt am 2026-08-05).

**Neue Rezepte HABEN echte `steps`.** `recipeSteps()` prüft zuerst `r.steps`, dann V2-Patches, dann Fallback-Generierung.

---

## Kern-Funktionen

| Funktion | Zweck |
|---|---|
| `navGo(dest)` | Bottom-Nav: `today` / `plan` / `shop` / `profile` |
| `renderTodayView()` / `renderMealsContent()` | Heute- bzw. Plan-Ansicht |
| `buildMealWeek(weekStart, p)` | Wochenplan erzeugen (Prep-Gruppen) |
| `scaledRecipe(r, cat, p)` | Portionsskalierung: `MEAL_SPLIT[cat] × portionFactor` |
| `MEAL_SPLIT` | Tagesziel-Verteilung: Frühstück .24 / Mittag .34 / Abend .32 / Snack .10 / Shake .10 |
| `swapMeal(date, cat, maxTime)` | Gericht tauschen (aktualisiert Plan + Einkauf) |
| `buildStructuredShoppingList()` | Einkaufsliste inkl. Packungen/Preise |
| `accumulateIngredients()` | Zutaten über Tage summieren |
| `createHousehold()` / `joinHousehold()` | Haushalt via RPC, Code-Format `PREP-XXXXXX` |
| `syncHousehold()` | Plan + Einkauf ziehen (Polling ~30 s, **kein Realtime**) |
| `_sbRest()` / `_sbRpc()` | Supabase-Wrapper |
| `loadRecipeCatalog()` | Rezepte aus Supabase/Cache laden → `RECIPES` befüllen |
| `_enrichRecipe(r)` | Katalog-Rezept mit App-kompatiblen Feldern anreichern |
| `_rcGet()` / `_rcSet()` | IndexedDB-Wrapper für Rezept-Cache |

---

## Supabase

Drei Daten-Bereiche:
- **Rezeptkatalog:** `recipe_catalog_v1` (600 Rezepte, öffentlich lesbar), `foods` (846 Lebensmittel)
- **Persönlich:** kompletter State als JSONB in `user_state`, dazu `profiles` u. a.
- **Haushalt:** `meal_plans` + `meal_plan_entries` (Plan), `shopping_items` (Häkchen)

RLS ist auf allen Tabellen aktiv. Details: `docs/CURRENT_BACKEND.md`.
Kein `service_role`-Key im Frontend — nur der anon key, der gehört dort hin.

**Vor jeder Schema-/RPC-/RLS-Änderung:** Ist-Zustand dokumentieren, Migration vorschlagen, Sicherheitsfolgen prüfen, **Zustimmung einholen**, danach Advisor erneut laufen lassen.

---

## Offene Punkte (Stand 2026-08-05)

### 🔴 Sicherheit — die App ist öffentlich erreichbar
1. **OAuth-Token-Injection.** `checkOAuthCallback()` läuft bei jedem Seitenaufruf und übernimmt jedes `#access_token` aus der URL ungeprüft (kein `state`/Nonce, keine Verifikation gegen `/auth/v1/user`). Ein präparierter Link loggt das Opfer still in einen fremden Account. → PKCE-Flow oder mindestens State-Check + Token-Verifikation.
2. **Registrierung offen:** keine Passwort-Policy, kein CAPTCHA, Leaked-Password-Schutz im Dashboard aus.
3. **RLS-Policies hängen an Rolle `public`** und wurden nie ausgelesen. Einmal `pg_policies` dumpen und prüfen.
4. Weitere Advisor-Warnungen: `docs/SECURITY_NOTES.md`.

### 🟠 Funktional
5. **Google-Login** schlägt fehl, bis in Supabase → Auth → URL Configuration **beide** Redirect-URLs erlaubt sind: `https://jugo011053.github.io/godapp/` **und** `.../godapp/index.html` (die installierte PWA startet über `index.html`).
6. ~~**Service Worker vergiftet seinen Cache**~~ ✅ Gefixt in v7.0.0: `response.ok && !response.redirected`-Check + neuer `CACHE_NAME`.
7. **Kein Token-Refresh.** Supabase-Token laufen nach 1 h ab; danach schlägt jeder Sync still fehl (`console.warn`, kein Toast).
8. **Haushaltsmengen** werden nicht über alle Mitglieder summiert — jeder rechnet mit seinem eigenen Profil.

### 🟡 Aufräumen
9. Legacy-Code (Training, Timeline, Supplements, XP) liegt ungenutzt in der Datei und kann versehentlich wieder sichtbar werden.
10. Interne Namen (`godapp*`) passen nicht zum Produktnamen Preply. `STORE_KEY` dabei **nicht** anfassen.

---

## Kontext

- Zielgruppe: deutschsprachig, mobile-first. Ton: aufgeräumt, erwachsen, funktional — keine Fitness-Influencer-Sprache, keine Gamification.
- Nutzer: Janik + Freundin (geteilter Haushalt), er auf mehr kcal als sie — deswegen `portionFactor`.
- Die App soll **vorab** sagen, was gekocht und eingekauft wird — nicht dokumentieren, was gegessen wurde.
- `docs/` enthält das Handoff-Paket (Vision, Backend, Merge-Landkarte, Testliste). `HANDOFF_NEW_APP.md` betrifft eine separate, noch nicht gebaute React-Native-App — **nicht** dieses Repo.

---

## Historie (D1 → Preply)

Die App hieß früher „D1 / Day One" und war ein Fitness-Planer mit Training, Timeline und Supplements. Patches 1–13 bauten Onboarding, Rezepte, Trainingsplan, Kalender, Gamification, Haushalt-Sync (RPCs `create_household`/`join_household`) und granulare Personen-Daten. Danach wurde auf **Food-Only** umgestellt: Kalender/Training/Supplements aus der UI genommen, Navigation auf Heute/Plan/Einkaufen reduziert, Design von Navy/Amber auf hell/grün gewechselt.

Der Rezept-, Einkaufs- und Haushalts-Code aus D1 ist die reife Grundlage und wurde bewusst **erhalten**, nicht neu gebaut.

---

*Zuletzt aktualisiert: 2026-08-05 — v7.0.0: 600 Rezepte aus Supabase, 846 Foods, IndexedDB-Cache, SW-Fix.*
