# CLAUDE.md — Preply · Kontext-Recovery-Datei

> **Für Claude nach Context-Reset:** Diese Datei allein reicht. Repo fetchen,
> das hier lesen, weiterarbeiten. Der Code liegt im Repo, keine Uploads nötig.

---

## Die eine Regel

**Die lebende App ist `app/v8/`.** Ein Modul pro Aufgabe, kein Build, kein
Framework. Die frühere Single-File-App (`app/index.html` mit ~10 000 Zeilen)
ist abgelöst und gelöscht — sie liegt nur noch in der Git-Historie.

---

## Was wo liegt

```
app/
  index.html        Werbeseite — das ist die Wurzel-Adresse /godapp/
  marketing/        die drei Screenshots darauf, echt aus der App aufgenommen
  icon*.png|svg     gemeinsam genutzt von Werbeseite und App
  sw.js             Selbstzerstörer für alte v7-Clients, kein Fetch-Handler
  v8/               DIE APP
    index.html      Hülle, registriert v8/sw.js
    manifest.json   PWA-Manifest (verweist mit ../icon.png nach oben)
    sw.js           echter Service Worker, CACHE_NAME muss zu APP_BUILD passen
    assets/css/     Gestaltung, tokens.css zuerst
    js/
      app.js                   Einstieg, Renderpfad, rAF-Bündelung
      core/                    events · router · store · storage · supabase
                               supabaseConfig · version · feel · toast
      data/                    contracts · recipeRepository · recipeNormalizer
                               recipeScoring · recipeStore
      features/                auth · discover · favorites · history · household
                               onboarding · planner · profile · shell · shopping
                               sync
      integrationController.js Hauptansichten (Woche · Heute · Profil)
      featureEnhancementsV2.js Rezepte, Einkauf
      accountEnhancement.js    Konto und Haushalt im Profil
      planManagementEnhancement.js  Neuplanen, Plan bearbeiten
      profileMasterEnhancement.js   Profilseite
      historyEnhancement.js         Verlauf
docs/     nur noch das, was zum Weiterbauen gebraucht wird — siehe unten
```

**Zwei Versionsnummern müssen zusammen hochgezählt werden:**
`app/v8/js/core/version.js` (`APP_BUILD`) und `app/v8/sw.js` (`CACHE_NAME`).
Sonst zeigt die App eine andere Version an, als der Service Worker ausliefert.

---

## Workflow

```
1. app/v8/** bearbeiten
2. APP_BUILD und CACHE_NAME hochzählen
3. committen, nach main pushen
4. GitHub Actions deployt automatisch -> live in ~1 Minute
```

**Live:** https://jugo011053.github.io/godapp/ (Werbeseite)
· https://jugo011053.github.io/godapp/v8/ (App)
**Repo:** https://github.com/jugo011053/godapp — öffentlich

Pages deployt **nur vom Default-Branch**. Arbeit auf einem Feature-Branch muss
nach `main` gemergt werden, sonst passiert nichts. Alle Pfade sind **relativ**,
damit der Unterpfad funktioniert — nie auf absolute Pfade umstellen.

### Session-Start
```bash
cd /home/user/godapp
git fetch origin main && git checkout main && git pull
grep APP_BUILD app/v8/js/core/version.js
```

---

## App-Identität

| Key | Wert |
|-----|------|
| Produktname | **Preply** (Repo heißt noch `godapp` — Altlast) |
| APP_BUILD | siehe `app/v8/js/core/version.js` |
| Zustandsschlüssel | `preply_v8_state_v1` im localStorage — **nicht umbenennen** |
| Supabase | `https://rfdtjodpjvynnavnucvu.supabase.co` (Dashboard: „D1 DayOne") |
| anon key | in `app/v8/js/core/supabaseConfig.js`. Kein `service_role` im Frontend |

### Design (hell/grün)
```
--paper #f7f7f4   --card #ffffff   --ink #111111
--ink-secondary #51564d   --accent #78a800   --border #e1e1db
```
Alle Tokens in `app/v8/assets/css/tokens.css`.

---

## Struktur der App

**Bottom-Nav: Woche · Heute · Einkauf.** Profil als Icon oben rechts im Header.

| Bereich | Inhalt |
|---|---|
| Woche | Tage einzeln aufklappbar, Gerichte tauschbar und anpinnbar |
| Heute | Mahlzeiten des heutigen Tages, Zutaten und Schritte beim Antippen |
| Einkauf | Liste nach Regal **oder** nach Gericht, beides abhakbar |
| Rezepte | über „Alle Rezepte durchsehen", mit Suche und Filtern |
| Profil | Ziele, Bedarf, Vorkochen, Ausschlüsse, Halal, **Konto und Haushalt** |

---

## Rezepte

**600 Rezepte** in `recipe_catalog_v1`, bei jedem Start aus Supabase geladen
(kein lokaler Cache — ohne Netz startet die App nicht).
100 Legacy-Rezepte (`legacy_v1`, ohne Kochschritte) und 500 aus `catalog_v5`.
87 Frühstück · 194 Mittag · 282 Abend · 30 Snack · 7 Shake (letztere sind
**nicht planbar**, die Planung kennt nur die ersten vier).

Jedes Rezept trägt Nährwerte, Zeiten, Tags, Allergene, Diät-Etiketten,
Kochschritte, `classification` und `ingredients[]` mit Einkaufsdaten.

**Die Zutatennamen sind vereinheitlicht: 811 Schreibweisen wurden auf 455
Namen zusammengelegt** (2026-09-01, 513 Rezepte betroffen). „Zwiebeln" und
„Zwiebel", „Kirschtomaten"/„Cherrytomaten"/„Babytomaten", „Rinderhack mager"
und „Rinderhackfleisch" sind jetzt jeweils dasselbe. Die Zuordnung steht in
der Tabelle `zutat_alias` (alt → neu) und muss bei jedem Import erneut
angewendet werden, sonst wuchert es wieder. Der Stand davor liegt in
`backup_recipe_catalog_v1_20260831`.

**Den Etiketten für Diät und Allergene wird nicht vertraut.** Beides wird in
`recipeNormalizer.js` aus den Zutaten abgeleitet; das Etikett darf nur strenger
sein, nie lockerer. Grund: 21 Gerichte mit Fleisch oder Fisch waren als vegan
gelistet. Details in `docs/DATENBANK_AUFTRAG.md`.

---

## Kern-Funktionen

| Funktion | Datei | Zweck |
|---|---|---|
| `buildPlan()` | `features/planner/plannerEngine.js` | Wochenplan, inkl. Vorkoch-Gruppen |
| `rankRecipes()` / `recipeEligible()` | `data/recipeScoring.js` | Auswahl und harte Filter |
| `dietFromIngredients()` | `data/recipeNormalizer.js` | Diät aus den Zutaten |
| `containsHaram()` | `data/recipeNormalizer.js` | Schwein, Alkohol, Gelatine |
| `allergensFromIngredients()` | `data/recipeNormalizer.js` | Allergene aus den Zutaten |
| `buildShoppingList()` | `features/shopping/shoppingEngine.js` | Liste, Packungen, Preise |
| `formatAmount()` | `features/shopping/shoppingEngine.js` | „80 g" statt „82,2 g" |
| `calorieTargetFor()` | `features/onboarding/nutrition.js` | Mifflin-St Jeor |
| `signIn()` / `signInWithGoogle()` | `features/auth/account.js` | Anmeldung (PKCE) |
| `syncNow()` | `features/sync/userSync.js` | Zusammenführen, nicht ersetzen |
| `createHousehold()` / `joinHousehold()` | `features/household/household.js` | Haushalt |

---

## Supabase

- **Katalog:** `recipe_catalog_v1` (600), `foods` (846), Schema `catalog` (14
  normalisierte Tabellen, von der App **nicht** gelesen)
- **Persönlich:** `profiles`, `user_state`, `favorites`, `recipe_feedback`
- **Haushalt:** `households`, `household_members`, `meal_plans`,
  `meal_plan_entries`, `shopping_items`; RPCs `create_household`, `join_household`

RLS ist überall aktiv und geprüft. Stand und Migration: `docs/BACKEND_STAND_2026-08-26.md`.

**Vor jeder Schema-/RPC-/RLS-Änderung:** Ist-Zustand dokumentieren, Migration
vorschlagen, Sicherheitsfolgen prüfen, **Zustimmung einholen**, danach den
Advisor erneut laufen lassen.

---

## Offene Punkte

### 🔴 Daten — eigener Arbeitsstrang, läuft in einem Parallel-Chat
Auftrag und Zahlen: **`docs/DATENBANK_AUFTRAG.md`**. Kurz:
359 von 812 Zutaten pauschal als „Gemüse" abgelegt (die Namen sind seit
2026-09-01 vereinheitlicht, die Kategorien noch nicht) · 419 Lebensmittel mit
demselben Platzhalterpreis 500 g / 1,79 € · Nährwerte teils am falschen
USDA-Eintrag (Ei = *Egg, white, dried*) · 491 der 600 Rezepte sind Übersetzungen
von bbcgoodfood.com, was Bilder und Texte zu einer Rechtsfrage macht.
Die Arbeitsdokumente des Parallel-Chats liegen daneben: `DATABASE_MASTERPLAN_V2.md`,
`FOOD_MASTER_AUDIT_QUEUE.md`, `PROPOSAL_MIGRATION_CATALOG_DEDUP_AB.sql`,
`DATABASE_FIXES_IMPLEMENTED_2026-08-26.md`. **Nicht anfassen.**

### 🟠 Funktional
- **Kein Offline-Betrieb.** Der Rezeptkatalog wird bei jedem Start neu geladen.
  Ein IndexedDB-Cache wäre der nächste sinnvolle Schritt.
- **Keine Bilder** zu den Rezepten. Der Katalog hat kein Bildfeld.
- **Leaked-Password-Schutz** ist aus; nur im Dashboard einschaltbar.
- **Google-Anmeldung** braucht in Supabase unter Authentication → URL
  Configuration beide Redirect-URLs: `…/godapp/v8/` **und** `…/godapp/v8/index.html`.

### 🟡 Aufräumen
- Interne Namen (`godapp*`, Supabase-Projekt „D1 DayOne") passen nicht zum
  Produktnamen. Den Zustandsschlüssel dabei **nicht** anfassen.

---

## Ton und Zielgruppe

Deutschsprachig, mobile-first. Aufgeräumt, erwachsen, funktional — keine
Fitness-Influencer-Sprache, keine Gamification. Die App sagt **vorab**, was
gekocht und eingekauft wird; sie dokumentiert nicht, was gegessen wurde.
Nutzer: Janik und seine Freundin, geteilter Haushalt, unterschiedlicher Bedarf.

---

*Zuletzt aktualisiert: 2026-09-01 — Zutatennamen vereinheitlicht (811 → 455),
Halal-Filter ergänzt. Davor: 2026-08-26 — Repo aufgeräumt: v7-App, Archiv, alte Tests
und 19 Branches entfernt; die Werbeseite ist jetzt die Wurzel-Adresse.*
