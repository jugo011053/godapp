# Preply V8 Workplan

## Ziel

Preply V8 wird als neue modulare App unter `app/v8/` aufgebaut. Die bestehende Produktion unter `app/index.html` bleibt bis zur finalen Abnahme unverändert. Erst der Integrations-PR schaltet die neue Version live.

## Produktentscheidungen

- Responsive für Smartphone, Tablet und Desktop.
- Hauptnavigation: Plan · Rezepte · Einkauf · Profil.
- Zwei Einstiege: „Was esse ich heute?“ und „Essensplan erstellen“.
- Onboarding: kurzer Pflichtteil plus freiwillige Vertiefung.
- Zwei Planungsmodi: einfach sowie Kalorien/Makros.
- Planung für einzelne Tage, mehrere Tage oder eine komplette Woche.
- Meal-Prep-Modi: frisch, Meal Prep, gemischt.
- Rezeptstil: simpel, ausgewogen, experimentell.
- Personalisierung zunächst regelbasiert mit Favoriten, Ausschlüssen und Ablehnungsgründen.
- Einkaufsliste über auswählbare Tages-Chips und Ansichten nach Kategorie oder Gericht.
- Account erst nach dem ersten erzeugten Plan anbieten.
- Alte Pläne werden historisiert; abgelaufene Pläne gelten nicht als aktuell.

## Architektur

```text
app/v8/
├── index.html
├── manifest.json
├── sw.js
├── assets/css/
│   ├── tokens.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── app.js
│   ├── core/
│   ├── data/
│   └── features/
└── tests/
```

Die V8-App bleibt eine statische PWA und verwendet ausschließlich relative Pfade, damit GitHub Pages unter `/godapp/` funktioniert.

## Arbeitsphasen

### Phase 0: Foundation

Branch: `agent/v8-foundation`

- modulare Grundstruktur unter `app/v8/`
- gemeinsame Verträge
- Event-Bus, Router, State- und Storage-Schnittstellen
- Test-Fixtures
- keine Änderung der laufenden App

### Phase 1: parallele Features

Alle Feature-Branches starten vom gemergten Foundation-Commit.

1. `agent/v8-responsive-shell`
2. `agent/v8-onboarding-profile`
3. `agent/v8-planner-engine`
4. `agent/v8-catalog-quality`
5. `agent/v8-discover-favorites`
6. `agent/v8-shopping-scope`
7. `agent/v8-session-history`

### Phase 2: Integration

Branch: `agent/v8-integration`

Merge-Reihenfolge:

1. Catalog und Datenadapter
2. Storage, Migration und Auth
3. Responsive Shell
4. Onboarding und Profil
5. Planner
6. Discover und Favoriten
7. Einkaufsliste
8. End-to-End-Tests
9. Umschalten der Produktion auf V8

## Dateibesitz

Feature-Arbeiter bearbeiten ausschließlich ihre zugewiesenen Verzeichnisse. Gemeinsame Verträge dürfen nur über den Foundation- beziehungsweise Integrations-Branch geändert werden.

## Unveränderliche Regeln

- `STORE_KEY = godapp6_7_1_state_v1` bleibt erhalten.
- Kein `service_role`-Schlüssel im Frontend.
- Kein direktes Arbeiten auf `main`.
- Keine Änderung an der laufenden `app/index.html` vor dem Integrations-PR.
- Supabase-Schemaänderungen ausschließlich als dokumentierte Migration.
- Keine Reaktivierung alter Fitness-, Timeline-, XP- oder Supplement-Funktionen.

## Pflichtszenarien

- Nutzung ohne Account
- Inspiration nur für heute
- Plan von Mittwoch bis Freitag
- Arbeitswoche und ganze Woche
- einzelne Mahlzeit, Tag und Gesamtplan neu generieren
- Favoriten und dauerhafte Ausschlüsse
- Allergiefilter
- Tages-Chips in der Einkaufsliste
- Rückkehr nach abgelaufenem Plan
- abgelaufene Supabase-Session
- Offline-Nutzung nach erstem Rezeptabruf
- Migration bestehender V7-Daten
