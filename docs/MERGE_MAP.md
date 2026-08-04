# Merge-Landkarte

## Maßgebliche Quellen

| Thema | Primäre Quelle | Umgang |
|---|---|---|
| Aktueller sichtbarer Stand | `CURRENT_APP/index.html` | Ausgangspunkt für weitere Änderungen |
| Einkaufslogik | `REFERENCE/ORIGINAL_D1/index_latest_8.html` | funktionale Logik erhalten/extrahieren |
| Haushalt und Cloud | aktueller Stand plus Supabase-Dokumentation | nicht optisch simulieren; gegen Backend testen |
| Preply-Informationshierarchie | `REFERENCE/LAYOUT_PROTOTYPE/app/page.tsx` | UX-Struktur übernehmen, nicht blind Demo-Daten |
| Visuelle Sprache | `REFERENCE/LAYOUT_PROTOTYPE/app/globals.css` und aktueller Preply-CSS-Block | weiter schärfen |
| Rezeptwahrheit | `DATA/Preply_Seed_Datenbank_v4.3.xlsx` | eingebettete Demo-/Legacy-Rezepte später ersetzen |

## Aus D1 behalten

- Zutatenaggregation und Einkaufslogik
- Mengenskalierung und Einheiten
- Rezeptdetail/Cook Mode, soweit fachlich korrekt
- stabiles lokales Speichern inklusive Migrationsstrategie
- Login/Cloud-Grundlage
- granularer Haushaltsplan und gemeinsame Checkliste
- funktionierende Fehler- und Offline-Fallbacks

## Aus dem Preply-Prototypen behalten

- helle, klare mobile Struktur
- persönlicher Plan als Startpunkt
- einfache Heute-/Wochen-Navigation
- schneller Tausch ohne unnötige Zwischenschritte
- klare Trennung der Mahlzeiten in Entdecken
- direkte Verbindung von Plan, Rezept und Einkauf

## Entfernen oder intern isolieren

- Timeline-/Kalenderengine mit Uhrzeiten
- Trainingspläne und Workout-Sessions
- Supplement-Stack
- XP, Level, Streak und Badges
- alte D1-Einführungen, Markenreste und Storage-Namen
- nicht mehr erreichbare Legacy-Modale und Styles

## Reihenfolge für die nächste Entwicklung

1. Verhalten des aktuellen Stands mit der Testliste sichern.
2. Food-Domainfunktionen aus der Single-File-Datei isolieren, ohne UI-Verhalten zu ändern.
3. Rezeptdatenmodell auf die Excel-/spätere Supabase-Struktur abbilden.
4. Onboarding um Gewicht halten und maximale Kochzeit ergänzen.
5. Plan-Engine für echte Tagesziel-Toleranz und nachvollziehbare fünf Tage schärfen.
6. Entdecken-Filter vervollständigen.
7. Haushaltsmengen pro Mitglied korrekt aggregieren.
8. Polling optional durch abgesichertes Realtime-Verhalten ersetzen.
9. Legacy-Code entfernen, sobald die extrahierten Food-Module nachweislich gleich funktionieren.
10. Erst danach finales visuelles Feintuning und Markenassets.

## Datenbankregel

Das vorhandene Supabase-Projekt ist live. Vor jeder Schema-, RPC- oder RLS-Änderung zuerst:

1. Ist-Zustand dokumentieren.
2. konkrete Migration samt Rückwirkung vorschlagen.
3. Sicherheitsfolgen prüfen.
4. Zustimmung einholen.
5. Änderung testen und Advisor erneut ausführen.
