# Handoff: New App — "D1 Performance" (Arbeitstitel)

## Kontext: Was existiert bereits

Ich habe eine laufende Single-File PWA (`index_latest.html`, ~836KB) die ich dir mitgebe.
Diese App enthält bereits voll funktionsfähigen Code den wir **direkt wiederverwenden**:

- **Design-System**: Amber `#F59E0B` + Navy `#0E1530`, Font Manrope, alle CSS-Variablen
- **Kalender-Engine**: `renderWeekView()` mit Zeitachse, Drag & Drop, Lane-Assignment für überlappende Blöcke — das ist guter Code, übernehmen
- **Mahlzeiten-Engine**: `buildMealWeek()`, Rezept-Datenbank (~60 Rezepte), Makro-Berechnung, Portionsfaktor
- **Trainingsplan-Generator**: `buildTrainingWeek()` mit Geräte-/Ziel-Logik
- **Supabase-Integration**: Auth, RLS, RPC-Pattern (`_sbRest`, `_sbRpc`), alle Tabellen-Schemas
- **Gamification**: XP/Level/Streak-System
- **State-Management Pattern**: localStorage + write-through zu Supabase

**Supabase-Projekt**: `https://rfdtjodpjvynnavnucvu.supabase.co`  
Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZHRqb2RwanZ5bm5hdm51Y3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Nzc0NTAsImV4cCI6MjA5NTM1MzQ1MH0._TFOq21ghEbcTrqAbrN3VGAiGP3e2MfAGqk7g0VZi2A`  
Schema (20 Tabellen): `supabase_schema.sql` liegt im Repo — idempotent, kann neu ausgeführt werden.

---

## Was wir jetzt bauen

Eine **neue, schlanke React Native App** (kein PWA-Umbau — Neubau).  
Die bestehende PWA läuft weiter separat.

### Zielgruppe
High Performer / Young Professionals (20–35):
- Tragen Apple Watch oder Google-kompatible Health Bands (Fitbit, Garmin, Pixel Watch)
- Leben vollen, oft stressigen Alltag
- Sind offen für Evidence-Based Micro-Optimierungen
- Wollen kein Studium — wollen Klarheit: **was tue ich, wann, warum**

### Kern-Vision
> Die App identifiziert kleine Stellschrauben im Alltag und macht sie mit minimalem Aufwand sichtbar und umsetzbar.

Beispiel: User schläft schlecht → App erkennt das via HRV/Sleep Score → zeigt kontextuell: "Magnesium-Bisglycinat 300mg vor dem Schlafen + Glycin 3g — kein Citrat, falsche Absorptionsform" → verlinkt Qualitäts-Produkt → User trackt Wirkung.

---

## Tech Stack

```
Mobile:      React Native + Expo (managed workflow)
Health Data: expo-health (HealthKit iOS + Health Connect Android)
Backend:     Supabase (gleicher Account, neues Projekt anlegen)
Web Companion: Next.js + Supabase (später — Auswertungen, Admin)
Auth:        Supabase Auth (Apple Sign-In + Google Sign-In)
Navigation:  Expo Router (file-based)
State:       Zustand (leichtgewichtig, kein Redux)
```

**Plattformen**: iOS (HealthKit) + Android (Health Connect) — beide von Anfang an.

---

## App-Struktur (3 Haupt-Tabs)

### Tab 1: Heute
- Tagesplan auf Zeitachse (Kalender-Engine aus der PWA portieren — Logik 1:1 übernehmen)
- Oben: Health-Snapshot (Schlaf letzte Nacht, HRV, Steps heute) — wird automatisch vom Band geholt
- Contextual Alert wenn Werte schlecht: "Du hast 5.2h geschlafen → heute: kein High-Intensity, +1 Erholungsblock"

### Tab 2: Essen
- Wochenplan mit Quick-Rezepten (Rezept-DB aus PWA übernehmen + erweitern)
- Filter: `⚡ 5 min`, `🏪 Supermarkt-ready`, `💪 High Protein`
- Snack-Suggestions basierend auf verbleibenden Makros des Tages

### Tab 3: Fixes
- Kuratierte Micro-Optimierungen nach Kategorie: Schlaf / Energie / Fokus / Recovery / Ernährung
- Jeder Fix: Problem → Lösung → Warum (2 Sätze, Evidence-Based) → Produkt-Link (Qualität)
- Beispiele:
  - Schlaf: Magnesium-Bisglycinat + Glycin, Timing, Dosierung
  - Fokus: Creatin (nicht nur für Muskeln), L-Theanin + Koffein Ratio
  - Recovery: HRV-Tracking Interpretation, Kältetherapie-Protokoll
  - Ernährung: Protein-Timing, welche Protein-Quellen aus dem Supermarkt (Quark, Eier, Skyr)

---

## Was von der PWA übernommen wird (80%)

| Komponente | Übernahme |
|------------|-----------|
| Rezept-Datenbank (60+ Rezepte) | 1:1 als JS-Array/JSON |
| Makro-Berechnungslogik | 1:1 portieren |
| Kalender-Zeitachsen-Logik (`wcMinToY`, `wcBounds`, `assignLanes`) | 1:1 portieren → in RN-Canvas oder Animated rendern |
| Design-Token (Farben, Abstände, Typografie) | Als RN StyleSheet / Theme-Objekt |
| Supabase-Wrapper (`_sbRest`, `_sbRpc`) | Ersetzen durch `@supabase/supabase-js` Client (sauberer in RN) |
| `buildMealWeek()` Algorithmus | 1:1 portieren |
| `buildTrainingWeek()` Algorithmus | 1:1 portieren |
| Onboarding-Felder (Profil-Shape) | Gleiche DB-Tabelle `profiles` nutzen |

---

## Supabase DB-Strategie

Gleicher Supabase-Account, **neues Projekt** anlegen (`d1-performance` o.ä.) damit die Daten sauber getrennt sind. Schema von `supabase_schema.sql` als Basis nehmen und erweitern um:

```sql
-- Neu für die neue App:
health_snapshots    -- tägliche Wearable-Daten (HRV, sleep_h, sleep_score, steps, rhr)
fix_interactions    -- welche Fixes hat User gesehen/gestartet/abgeschlossen
product_links       -- kuratierte Supplement-Empfehlungen mit Links
```

---

## Neue DB-Tabellen (zusätzlich zum bestehenden Schema)

```sql
CREATE TABLE health_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  hrv_ms float,           -- Heart Rate Variability (ms)
  sleep_h float,          -- Schlafdauer in Stunden
  sleep_score int,        -- 0-100 (falls Band das liefert)
  rhr_bpm int,            -- Resting Heart Rate
  steps int,
  active_cal int,
  source text,            -- 'apple_health' | 'health_connect'
  raw jsonb,              -- alle weiteren Rohdaten
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE fix_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  fix_id text NOT NULL,   -- z.B. 'mag_bisglycinate_sleep'
  status text DEFAULT 'seen', -- seen | started | completed | dismissed
  started_at timestamptz,
  completed_at timestamptz,
  rating int              -- 1-5 nach Abschluss
);
```

---

## Design-Prinzipien (aus der PWA übernehmen)

```
Farben:    --accent: #F59E0B  --bg: #0E1530  --text: #F1F5F9
Font:      Manrope (Google Fonts oder expo-font)
Radius:    Cards 12-14px, Buttons 11px, Pills 999px
Shadows:   Sparsam, dunkel (rgba(0,0,0,.28))
Stil:      Minimalistisch, Premium — kein Noise, kein Overload
Sprache:   Deutsch (Zielgruppe DE/AT/CH)
```

---

## Erstes Sprint-Ziel

1. Expo-Projekt aufsetzen (managed, TypeScript)
2. Supabase-Client + Auth (Apple + Google Sign-In)
3. Health-Permissions anfordern + ersten Snapshot lesen (Schlaf + HRV von gestern)
4. Tab-Navigation (3 Tabs: Heute / Essen / Fixes)
5. "Heute"-Screen: Health-Snapshot-Card oben + Tagesplan-Zeitachse (leere Blöcke)
6. Ersten "Fix" hardcoded zeigen: Magnesium-Bisglycinat

---

## Was ich dir mitliefere

- `index_latest.html` — komplette PWA mit allen Algorithmen, Rezepten, Designs
- `supabase_schema.sql` — 20-Tabellen-Schema, idempotent
- `CLAUDE.md` — vollständiger Kontext der bestehenden App

Lies die `index_latest.html` und extrahiere die relevanten Funktionen wenn du sie brauchst — alles ist in einem `<script>`-Block, gut greifbar.
