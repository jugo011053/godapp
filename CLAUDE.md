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
| APP_VERSION | `godapp6.7.1` |
| SCHEMA_VERSION | `8` |
| STORE_KEY | `godapp6_7_1_state_v1` — **nicht umbenennen**, sonst verlieren alle Nutzer ihre lokalen Daten |
| Supabase URL | `https://rfdtjodpjvynnavnucvu.supabase.co` (Projekt heißt im Dashboard noch `D1 DayOne`) |
| Supabase anon key | **steht in `app/index.html`** — hier bewusst nicht dupliziert, die frühere Kopie in dieser Datei war fehlerhaft und führte zu 401ern |
| Datei | `app/index.html` (Single-File-PWA, ~890 KB, kein Build, kein Framework) |

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

100 Rezepte inline in `app/index.html` (`const RECIPES = [...]`):
25 Frühstück · 25 Mittag · 25 Abend · 20 Snack · 5 Shake.

Jedes Rezept trägt `kcal/protein/fat/carbs/fiber`, `time`, `tags[]`, `allergens[]` und `ingredients[]` **mit Einkaufsdaten** (`packSize`, `packPrice`, `buyType`, `step`, `category`, `role`). Diese Einkaufsmetadaten sind die Grundlage der Einkaufslisten-Engine — beim Austausch der Rezept-DB müssen sie erhalten bleiben.

Neuere Seed-DB: `docs/Preply_Seed_Datenbank_v4.3.xlsx` (noch nicht eingepflegt).

**Rezepte haben keine `steps` und kein `cuisine`-Feld.** Deshalb werden Kochschritte generiert (`recipeSteps()`), und ein Küche/Region-Filter ist nicht möglich.

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

---

## Supabase

Zwei getrennte Sync-Pfade:
- **Persönlich:** kompletter State als JSONB in `user_state`, dazu `profiles` u. a.
- **Haushalt:** `meal_plans` + `meal_plan_entries` (Plan), `shopping_items` (Häkchen)

RLS ist auf allen Tabellen aktiv. Details: `docs/CURRENT_BACKEND.md`.
Kein `service_role`-Key im Frontend — nur der anon key, der gehört dort hin.

**Vor jeder Schema-/RPC-/RLS-Änderung:** Ist-Zustand dokumentieren, Migration vorschlagen, Sicherheitsfolgen prüfen, **Zustimmung einholen**, danach Advisor erneut laufen lassen.

---

## Offene Punkte (Stand 2026-08-04)

### 🔴 Sicherheit — die App ist öffentlich erreichbar
1. **OAuth-Token-Injection.** `checkOAuthCallback()` läuft bei jedem Seitenaufruf und übernimmt jedes `#access_token` aus der URL ungeprüft (kein `state`/Nonce, keine Verifikation gegen `/auth/v1/user`). Ein präparierter Link loggt das Opfer still in einen fremden Account. → PKCE-Flow oder mindestens State-Check + Token-Verifikation.
2. **Registrierung offen:** keine Passwort-Policy, kein CAPTCHA, Leaked-Password-Schutz im Dashboard aus.
3. **RLS-Policies hängen an Rolle `public`** und wurden nie ausgelesen. Einmal `pg_policies` dumpen und prüfen.
4. Weitere Advisor-Warnungen: `docs/SECURITY_NOTES.md`.

### 🟠 Funktional
5. **Google-Login** schlägt fehl, bis in Supabase → Auth → URL Configuration **beide** Redirect-URLs erlaubt sind: `https://jugo011053.github.io/godapp/` **und** `.../godapp/index.html` (die installierte PWA startet über `index.html`).
6. **Service Worker vergiftet seinen Cache:** `app/sw.js` schreibt *jede* Antwort als `./index.html` — auch eine 404-Seite. Fix: `if (response.ok && !response.redirected)` plus `CACHE_NAME` hochzählen.
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

*Zuletzt aktualisiert: 2026-08-04 — nach Pages-Deploy und Repo-Aufräumen.*
