# Preply – vollständiges KI-Handoff

Stand: 4. August 2026

## Was dieses Paket ist

Dieses Paket dokumentiert den aktuellen Merge aus zwei unterschiedlichen Entwicklungsständen:

1. **D1 / Day One**: technisch reifere Single-File-PWA mit Rezept-, Plan-, Einkaufs-, Login- und Haushaltslogik.
2. **Preply-Layout-Prototyp**: deutlich klarere Food-UX mit persönlichem Plan, einfachem Tausch, Entdecken und Einkauf.

`CURRENT_APP/index.html` ist der aktuelle Arbeitsstand und damit die maßgebliche Datei. Die Inhalte unter `REFERENCE/` sind nur Quellen zum Vergleichen. Sie dürfen nicht blind über den aktuellen Stand kopiert werden.

Öffentliche Referenz zum Durchklicken:

https://preply-prototype.jugo011053.chatgpt.site

## Zielbild in einem Satz

Preply nimmt Menschen, denen Ideen oder Struktur für gesundes Essen und Einkaufen fehlen, möglichst viele Entscheidungen ab: kurzes Profil ausfüllen, passenden Essensplan erhalten, Gerichte kinderleicht tauschen und daraus automatisch einkaufen.

## Als Erstes lesen

1. `DOCS/PRODUCT_VISION.md`
2. `DOCS/CURRENT_STATE_AND_GAPS.md`
3. `DOCS/MERGE_MAP.md`
4. `SUPABASE/CURRENT_BACKEND.md`
5. `DOCS/TEST_CHECKLIST.md`

Danach erst `CURRENT_APP/index.html` bearbeiten.

## Lokal starten

Nicht nur per Doppelklick öffnen, weil Service Worker und einige Browserfunktionen einen lokalen Webserver erwarten.

```bash
cd CURRENT_APP
python3 -m http.server 8080
```

Dann `http://localhost:8080` im Browser öffnen. Die Hauptoberfläche funktioniert als Gast lokal. Login und Haushalt benötigen Internetzugang zum vorhandenen Supabase-Projekt.

## Paketstruktur

- `CURRENT_APP/`: aktueller Food-Only-Merge, inklusive PWA-Begleitdateien
- `REFERENCE/ORIGINAL_D1/`: ursprüngliche reifere D1-Single-File-PWA
- `REFERENCE/LAYOUT_PROTOTYPE/`: React/TypeScript-Quellcode des neueren Layout-Prototyps
- `DATA/`: aktuelle Rezept- und Seed-Datenbank v4.3
- `DOCS/`: Produktentscheidungen, Merge-Regeln und Tests
- `SUPABASE/`: Backend-Struktur, Sync-Logik und bekannte Sicherheitswarnungen

## Wichtigste Arbeitsregel

Die nächste KI soll zuerst eine kurze Bestandsaufnahme liefern und danach schrittweise arbeiten. Einkaufs- und Haushaltslogik dürfen nicht durch rein optische Nachbauten ersetzt werden. Gleichzeitig ist der alte D1-/Training-/Timeline-Code keine gewünschte Produktfunktion, sondern nur eine technische Übergangsschicht.
