# Preply · Food-Master Audit Queue

Stand: 2026-08-26

Quelle: Live-Abfrage gegen `catalog.foods` und `catalog.recipe_ingredients`.

Ziel: Die 63 Namens-Dublettengruppen zuerst sauber klassifizieren, bevor irgendeine `food_id` gelöscht oder umgebogen wird.

## Zusammenfassung

| Klasse | Gruppen | Food-Zeilen | Zutatenvorkommen | Behandlung |
|---|---:|---:|---:|---|
| A · sichere Dublette | 37 | 75 | 721 | auf meistgenutzte ID konsolidieren |
| B · gleiches Food, Metadatenkonflikt | 2 | 6 | 121 | konsolidieren + Metadaten korrigieren |
| C · echter Food-/Quellkonflikt | 24 | 55 | 376 | manuell entscheiden |
| **Gesamt** | **63** | **136** | **1.218** | |

Die ID-Reihenfolge unten ist bereits nach aktueller Rezeptnutzung sortiert. Bei Klasse A ist die erste ID damit der natürliche Kandidat für die kanonische Ziel-ID.

---

# A · Sichere Dubletten

Definition: Zustand, Kategorie, kcal, Protein, Kohlenhydrate, Fett und Quelle sind innerhalb der Gruppe identisch.

Diese Gruppen sind sehr wahrscheinlich reine Mehrfachimporte.

| Food | IDs, Zielkandidat zuerst | Verwendungen |
|---|---|---:|
| Knoblauchzehe | `F0314` ← `F0187` | 163 |
| Rote Paprika | `F0611` ← `F0613` | 58 |
| Kreuzkümmelsamen | `F0231` ← `F0230` | 56 |
| Kichererbsen | `F0165` ← `F0164` | 55 |
| Tomatenpüree | `F0765` ← `F0764` | 54 |
| Hähnchenbrust | `F0152` ← `F0153` | 39 |
| Zucchini | `F0216` ← `F0217` | 29 |
| Lauch | `F0406` ← `F0407` | 27 |
| Babyspinat | `F0036` ← `F0032` | 26 |
| Schwarze Bohnen | `F0069` ← `F0068` | 24 |
| Rote Linsen | `F0606` ← `F0608`, `F0701` | 18 |
| Grüne Bohnen | `F0336` ← `F0335` | 17 |
| Glatte Petersilie | `F0290` ← `F0294` | 14 |
| Sesamsamen | `F0669` ← `F0668` | 14 |
| Mandelblättchen | `F0288` ← `F0289` | 12 |
| Fenchelsamen | `F0275` ← `F0274` | 9 |
| Rote Bete | `F0064` ← `F0063` | 9 |
| Granatapfelkerne | `F0564` ← `F0563` | 9 |
| Pinienkerne | `F0541` ← `F0540` | 9 |
| Schnittlauch | `F0178` ← `F0179` | 8 |
| Pastinaken | `F0518` ← `F0519` | 8 |
| Kürbiskerne | `F0584` ← `F0583` | 8 |
| Samen | `F0661` ← `F0662` | 6 |
| Grüne Linsen | `F0340` ← `F0339` | 6 |
| Koriandersamen | `F0206` ← `F0205` | 6 |
| Riesengarnelen | `F0393` ← `F0394` | 5 |
| Senfkörner | `F0477` ← `F0476` | 5 |
| Hähnchenbrust ohne Haut | `F0678` ← `F0679` | 5 |
| Getrocknete Steinpilze | `F0254` ← `F0255` | 3 |
| Kidneybohnen | `F0392` ← `F0391` | 3 |
| Zitronenschale | `F0413` ← `F0411` | 3 |
| Maiskolben | `F0210` ← `F0209` | 3 |
| Kakaonibs | `F0112` ← `F0188` | 2 |
| Eiernudeln | `F0263` ← `F0264` | 2 |
| Kümmel | `F0123` ← `F0124` | 2 |
| Perlcouscous | `F0319` ← `F0529` | 2 |
| Reisnudeln | `F0617` ← `F0619` | 2 |

**Wichtig:** „sicher“ bezieht sich nur auf die Dublettenentscheidung. Ein identischer falscher Quellmatch bleibt nach dem Merge weiterhin ein falscher Quellmatch und wird später im Nährwertaudit korrigiert.

Beispiele:

- `Hähnchenbrust` ist doppelt, aber beide Zeilen verwenden aktuell denselben unpassenden USDA-Eintrag `Chicken breast, roll, oven-roasted`.
- `Kidneybohnen` ist doppelt, aber beide Zeilen hängen am Datensatz `liquid from stewed kidney beans`.

Das Merge beseitigt also Daten-Duplikation, nicht automatisch Inhaltsfehler.

---

# B · Gleiches Food, Metadatenkonflikt

Nährwerte und Quelle sind gleich, aber mindestens eine Metadatenangabe unterscheidet sich.

## Gemüsebrühe

IDs nach Nutzung:

`F0792` ← `F0789`, `F0785`, `F0711`

103 Zutatenvorkommen.

Alle vier Zeilen verwenden dieselbe Quelle und dieselben Nährwerte. `F0789` steht jedoch fälschlich in Kategorie `Gemüse`, die anderen unter `Saucen`.

Entscheidung:

- auf eine ID konsolidieren
- spätere neue `aisle_category` nicht aus der heutigen Kategorie übernehmen, sondern bewusst setzen

## Griechischer Joghurt

IDs:

`F0333` ← `F0332`

18 Zutatenvorkommen.

Gleiche Quelle/Nährwerte, aber `F0332` steht fälschlich unter `Gemüse`, `F0333` unter `Milchprodukte`.

Entscheidung:

- `F0333` als natürlicher Zielkandidat
- neue Einkaufs-/Regalkategorie = `Kühlregal`

---

# C · Manueller Food-/Quellkonflikt

Hier unterscheiden sich Nährwerte, Quelle, Zustand oder Lebensmittelbedeutung. Kein automatisches Merge.

Sortiert nach aktueller Rezeptnutzung.

| Food | IDs nach Nutzung | Verwendungen | Hauptproblem |
|---|---|---:|---|
| Rapsöl | `F0595`, `F0594` | 141 | korrekter Öl-Datensatz vs. falscher Proxy |
| Naturjoghurt | `F0481`, `F0554` | 35 | beide sind eigentlich griechische Joghurtvarianten |
| Haferflocken | `F0570`, `F0569`, `F0493` | 25 | zwei gute Dubletten + Proxy |
| Basmatireis | `F0055`, `F0054` | 20 | 350 kcal Rohreis vs. 35-kcal-Proxy |
| Paprika | `F0515`, `F0536` | 18 | Gewürzpaprika vs. sonnengetrocknete Chili, beide heißen zu allgemein |
| Hähnchenschenkel | `F0162`, `F0163`, `F0157`, `F0158` | 18 | Haut/Fettzustand und Proxy vermischt |
| Champignons | `F0471`, `F0109`, `F0110` | 14 | White Button vs. gekochte Shiitake |
| Garnelen | `F0574`, `F0575`, `F0673` | 13 | mehrere Proxies mit stark verschiedenen Makros |
| Grünkohl | `F0387`, `F0232` | 12 | TK vs. roh, Name/Zustand nicht getrennt |
| Nudeln | `F0521`, `F0487`, `F0486` | 11 | Pasta vs. Eiernudeln unter identischem Namen |
| Cashewnüsse | `F0131`, `F0130` | 9 | gleiche Makros, aber F0131 hat falsche kcal/Kategorie |
| Maismehl | `F0212`, `F0213` | 8 | Maisstärke vs. echtes Maismehl |
| Salat | `F0645`, `F0419` | 7 | generischer Proxy vs. Römersalat |
| Vollkorn-Penne | `F0826`, `F0833` | 7 | Whole Grain vs. normale Pasta |
| Dicke Bohnen | `F0088`, `F0087` | 6 | Bohnen vs. Flüssigkeit von Kidneybohnen |
| Frischkäse | `F0221`, `F0302` | 5 | Cream Cheese vs. Cottage Cheese |
| Zuckerschoten | `F0435`, `F0716`, `F0715` | 5 | grüne Erbsen / Dosenerbsen statt Zuckerschote |
| Sonnenblumenkerne | `F0723`, `F0722` | 5 | zwei plausible Varianten mit abweichenden Nährwerten |
| Kichererbsenmehl | `F0329`, `F0330` | 4 | Besan vs. falsches 00-Mehl |
| Vollkornnudeln | `F0825`, `F0238` | 4 | Proxy vs. plausible Vollkornpasta |
| Brötchen | `F0629`, `F0102` | 3 | französisches Brötchen vs. Zimtschnecke |
| Getreide | `F0141`, `F0327` | 2 | Cream of Rice vs. Roggenkorn, Name zu unspezifisch |
| Kakaopulver | `F0113`, `F0189` | 2 | Proxy vs. USDA-Kakao |
| Cajun-Gewürzmischung | `F0114`, `F0115` | 2 | Safran vs. Paprika, beide kein Cajun-Mix |

---

# Erste redaktionelle Entscheidungen

Die folgenden Fälle sind bereits so eindeutig, dass sie als hohe Priorität für die spätere Migration markiert werden können:

## Offensichtliche Ziel-ID / Remap

- Rapsöl: `F0595` behalten, `F0594` umbiegen
- Basmatireis: `F0055` behalten, `F0054` umbiegen
- Champignons: `F0109` oder `F0110` als White-Button-Kandidat; `F0471` nicht als Champignon weiterführen
- Haferflocken: `F0570`/`F0569` zuerst untereinander deduplizieren; `F0493` Proxy entfernen
- Kichererbsenmehl: `F0329` behalten; `F0330` ist falsches 00-Mehl-Mapping
- Vollkornnudeln: `F0238` ist plausibler Vollkornpasta-Kandidat; `F0825` Proxy prüfen/entfernen
- Brötchen: `F0629` ist deutlich plausibler; `F0102` ist Zimtschnecke
- Frischkäse: `F0221` = Cream Cheese; `F0302` muss als Cottage Cheese/Hüttenkäse umbenannt oder remapped werden

## Muss als echte Variante getrennt werden

- Grünkohl roh vs. TK
- Hähnchenschenkel mit Haut vs. ohne Haut
- Naturjoghurt nach Fettstufe/Produktart
- Sonnenblumenkerne je nach tatsächlicher Roh-/Trocken-Definition

## Name ist selbst das Problem

- `Paprika` muss zwischen Gemüsepaprika und Paprikagewürz unterscheiden
- `Nudeln` darf Eiernudel und normale Pasta nicht zusammenwerfen
- `Getreide` ist als Food-Name zu unspezifisch
- `Salat` sollte auf konkrete Sorte bzw. generischen Blattsalat normalisiert werden
- `Cajun-Gewürzmischung` braucht entweder echten Gewürzmix-Datensatz oder eine Rezept-/Mix-Komponente, nicht Safran/Paprika als Ersatz

---

# Nächste technische Prüfung vor einer Merge-Migration

Vor dem tatsächlichen Umbiegen von `food_id` muss für jede geplante Ziel-ID geprüft werden:

1. `catalog.recipe_ingredients` → kann direkt remapped werden
2. `catalog.food_aliases` → Aliase auf Ziel-ID übernehmen
3. `catalog.recipe_allergens` → mögliche PK-Kollisionen bei gleichem Rezept/Allergen vor Update entfernen/zusammenführen
4. `public.foods` → erst nach Catalog-Migration neu projizieren/synchronisieren
5. `public.recipe_catalog_v1` → bis V2-Cutover nicht verändern

Erst danach wird die konkrete SQL-Migration für Klasse A/B geschrieben und separat zur Freigabe vorgelegt.
