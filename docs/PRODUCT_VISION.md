# Produktvision und verbindliche Entscheidungen

## Problem

Die App richtet sich an Menschen, die grundsätzlich gesund essen möchten, aber im Alltag an fehlenden Ideen, unstrukturiertem Einkauf oder zu viel Planungsaufwand scheitern. Preply soll nicht primär dokumentieren, was bereits gegessen wurde. Die App soll vorab sagen, was gekocht werden kann und was dafür eingekauft werden muss.

## Kernablauf

`Onboarding → persönlicher Plan → Gericht tauschen → Einkaufsliste → Rezept/Cook Mode`

Nach dem Onboarding öffnet sich direkt der persönliche Essensplan. Die App soll schnell Nutzen zeigen und keinen Account erzwingen. Login ist nur für Cloud- und Haushaltsfunktionen nötig.

## Onboarding

Abzufragen sind:

- Alter, Größe, Gewicht und Geschlecht für einen groben Kalorien-Richtwert
- einfache Aktivitätsstufe: wenig, normal, aktiv, sehr aktiv
- Ziel: abnehmen, Gewicht halten, Muskelaufbau oder ausgewogen/gesünder essen
- Ernährungsweise und Ausschlüsse: vegetarisch, vegan, kein Fisch, kein Schwein, halal, glutenfrei, laktosefrei und Allergien
- genutzte Mahlzeiten: Frühstück, Mittagessen, Abendessen, Snack und gegebenenfalls Shake
- maximale Kochzeit

Der berechnete Kalorienwert ist eine Orientierung. Der vollständige Tagesplan soll ungefähr innerhalb von ±5 Prozent des Tagesziels liegen. Das Tagesziel wird sinnvoll auf die aktivierten Mahlzeiten verteilt. Ein einzelnes Rezept wird nicht auf den kompletten Tagesbedarf aufgeblasen.

Protein wird bei Muskelaufbau automatisch stärker priorisiert und bleibt zusätzlich als Filter verfügbar.

## Plan

- Der erste Plan umfasst fünf Tage.
- Es gibt eine gut lesbare **Heute-Ansicht** und eine kompakte **Wochenansicht**.
- Die Tage lassen sich direkt durchklicken.
- Es gibt keine Uhrzeiten, Trainingsblöcke oder komplizierte Kalenderplanung im sichtbaren Produkt.
- Gerichte lassen sich mit einem Klick gegen passende Alternativen tauschen.
- Tausch und Portionsänderung aktualisieren Plan und Einkaufsliste gemeinsam.
- Die Struktur soll helfen, ohne sich wie ein starrer Ernährungsplan anzufühlen.

## Entdecken

Rezepte müssen sichtbar nach Mahlzeit getrennt sein:

- Frühstück
- Mittagessen
- Abendessen
- Snacks
- Shakes
- später optional Meal Prep und Beilagen als eigene Einstiege

Relevante Filter:

- Kalorienbereich bzw. Ziel
- proteinreich
- Ernährungsweise und Ausschlüsse
- Allergien sowie gluten- oder laktosefrei
- maximale Kochzeit
- Küche/Region
- Meal Prep

Die Oberfläche soll keine überladene Tag-Wolke werden. Wenige starke Einstiege und verständliche Filter sind wichtiger als möglichst viele Labels auf jeder Karte.

## Einkauf

Die Einkaufsliste entsteht aus dem tatsächlichen Plan. Gleiche Zutaten werden zusammengeführt, Mengen und Einheiten berücksichtigt und Änderungen aus dem Tausch übernommen. Die Liste ist abhakbar. Die bestehende reifere D1-Logik ist hierfür die funktionale Referenz.

## Haushalt

Eine Person kann per Code einen Haushalt erstellen oder beitreten. Im Zielbild gelten:

- gemeinsamer Essensplan
- gemeinsam abhakbare Einkaufsliste
- jede Person behält ihr eigenes kcal- und Proteinprofil
- Rezeptportionen werden pro Person berechnet
- gemeinsame Einkaufsmengen werden aus den Bedarfen aller Haushaltsmitglieder addiert

Der letzte Punkt ist im aktuellen Stand noch nicht umgesetzt.

## Design

- mobile-first
- aufgeräumt, direkt, erwachsen und funktional
- warmes Weiß bzw. sehr helles Grau, dunkle Typografie, klares Grün als Akzent
- kein dunkler D1-Look, kein Fitness-Influencer-Stil, keine unnötige Gamification
- keine Werbeslogans oder übertriebene Lifestyle-Sprache
- Food hochwertig darstellen, aber nicht wie ein Pinterest-Kochbuch
- Plan und Entscheidungen stehen stärker im Mittelpunkt als dekorative Rezeptkarten

## Nicht sichtbar im Zielprodukt

- Training
- Supplements
- Timeline mit Uhrzeiten und Alltagsterminen
- Wasser-/Gewichts-Tracking als Hauptnavigation
- XP, Streaks und Fitness-Gamification

Code dafür ist im aktuellen Single-File-Merge teilweise noch vorhanden. Er ist keine Produktanforderung.

