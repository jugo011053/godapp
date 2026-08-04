# Aktueller Stand und bekannte Lücken

## Aktueller Hauptstand

`CURRENT_APP/index.html` ist eine rund 884 KB große Single-File-App. Sie enthält den ursprünglichen D1-Code und darüber eine spätere Preply-Übergangsschicht. Sichtbar sind aktuell nur:

- Onboarding
- Plan mit Heute-/Wochen-Umschaltung
- fünf durchklickbare Tage
- Entdecken
- Einkauf
- Rezeptdetail und Cook Mode
- Profil, Login und Haushalt

Training, Timeline und Supplements sind in der Navigation ausgeblendet, intern aber noch vorhanden. Das erklärt alte Namen und große Teile ungenutzten Codes.

## Was bereits funktioniert

- Food-Only-Navigation `Plan · Entdecken · Einkauf`
- kurzes Preply-Onboarding ohne Login-Zwang
- Kalorien- und Proteinziel aus Basisdaten
- fünf intern erzeugte Plantage
- Heute- und Wochenansicht
- Kategorien in Entdecken: Frühstück, Mittag, Abend, Snack und Shake
- einfache Filter: alle, proteinreich, schnell und Meal Prep
- Rezeptdetail mit skalierten Mengen
- Cook Mode
- Gerichte tauschen
- Einkaufsliste aus dem aktuellen Plan berechnen und abhaken
- lokales Speichern im Browser
- E-Mail/Passwort-Login und Cloud-Speicherung über Supabase
- Haushalt erstellen oder per `PREP-...`-Code beitreten
- gemeinsamer Plan und gemeinsame Häkchen der Einkaufsliste
- Abruf des Haushalts beim Öffnen/Tabwechsel/Fokus, regelmäßig etwa alle 30 Sekunden und manuell

## Wichtige technische Realität

Der Haushalts-Sync ist derzeit kein echtes Supabase-Realtime-Abonnement. Änderungen werden verzögert geschrieben und durch Polling bzw. erneuten Abruf geladen. In der UI darf deshalb nicht „Live-Sync“ behauptet werden.

Cloud-Sync und Haushalt sind getrennt:

- Cloud-Sync sichert den persönlichen `user_state`, Profil und weitere persönliche Daten.
- Haushalt teilt einen granularen Plan über `meal_plans`/`meal_plan_entries` sowie Einkaufsstatus über `shopping_items`.

## Bekannte Lücken

1. **Haushaltsmengen**: Beide Personen sehen Plan und Häkchen gemeinsam, aber die benötigten Einkaufsmengen werden nicht aus beiden individuellen Profilen addiert.
2. **Maximale Kochzeit**: als Produktentscheidung vorhanden, im aktuellen kurzen Onboarding noch nicht enthalten.
3. **Ziel „Gewicht halten“**: in der Vision vorgesehen, im aktuellen Preply-Onboarding fehlt eine eigene Auswahl.
4. **Erweiterte Filter**: Kalorienbereich, Küche/Region und einzelne Ausschlüsse sind in Entdecken noch nicht vollständig steuerbar.
5. **Fünf Tage**: der aktuelle Plan beginnt am heutigen Datum und schneidet auf fünf Tage ab. Die genaue Logik Montag–Freitag gegenüber frei gewählten fünf Tagen ist noch nicht final modelliert.
6. **±5-Prozent-Garantie**: Mengen werden auf Mahlzeitenziele skaliert, aber durch Skalierungsgrenzen ist nicht technisch garantiert, dass jeder gesamte Tag exakt innerhalb von ±5 Prozent endet.
7. **Alte interne Namen**: beispielsweise Local-Storage-Key `godapp6_7_1_state_v1`, Session-Key `sb_godapp_session` und Supabase-Projektname `D1 DayOne`.
8. **Legacy-Code**: Training, Supplements, XP, Timeline und alte Modale erhöhen Komplexität und können unabsichtlich wieder sichtbar werden.
9. **Single File**: HTML, CSS, Rezeptdaten und Logik sind stark gekoppelt; weitere Arbeit wird dadurch zunehmend riskant.
10. **Backend-Sicherheit**: mehrere aktuelle Supabase-Warnungen müssen vor einem breiten öffentlichen Produktstart geprüft und behoben werden.

## PWA-Dateien in diesem Paket

Der ursprüngliche Upload enthielt `manifest.json`, `sw.js` und Icons nicht. Dieses Handoff ergänzt minimale Begleitdateien, damit `CURRENT_APP/` lokal und auf statischem Hosting als Paket funktioniert. Sie verändern das sichtbare App-Layout nicht und sind nicht als finales Branding zu verstehen.

## Zielarchitektur

Langfristig soll Preply eine eigenständige Food-PWA ohne D1-/GodApp-Hülle werden. Bewährte Logik wird extrahiert und sauber neu strukturiert; alte Bereiche werden nicht einfach weiter mitgeschleppt. Ein sinnvoller Schnitt wäre:

- `ui/`: Plan, Entdecken, Einkauf, Rezept, Profil
- `domain/`: Kalorien, Portionsskalierung, Planerstellung, Swap, Zutatenaggregation
- `storage/`: Local Storage und Migration
- `supabase/`: Auth, persönlicher Sync, Haushalt
- `data/`: Rezepte, Lebensmittel und Mapping zur Seed-Datenbank

Dieser Umbau soll schrittweise erfolgen, mit funktionalen Tests nach jedem extrahierten Modul.

