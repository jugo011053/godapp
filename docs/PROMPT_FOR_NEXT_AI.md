# Prompt für die nächste KI

Du erhältst ein vollständiges Handoff-Paket für die mobile Food-PWA **Preply**.

Lies zuerst in dieser Reihenfolge:

1. `START_HERE.md`
2. alle Dateien unter `DOCS/`
3. `SUPABASE/CURRENT_BACKEND.md`
4. `SUPABASE/SECURITY_NOTES.md`
5. danach `CURRENT_APP/index.html`

Die maßgebliche App ist `CURRENT_APP/index.html`. `REFERENCE/ORIGINAL_D1/` und `REFERENCE/LAYOUT_PROTOTYPE/` sind nur Vergleichsquellen.

Ziel: eine eigenständige, helle, mobile Preply-Essensplaner-PWA. Sichtbar bleiben Plan, Heute/Woche, Entdecken, Einkauf, Rezept/Cook Mode, Profil und optional Login/Haushalt. Training, Timeline, Supplements und Gamification gehören nicht ins sichtbare Produkt.

Wichtig:

- Einkaufs-, Portions-, Speicher- und Haushaltslogik nicht durch Attrappen ersetzen.
- Die vorhandene Datenbank ist live; keine Schema-/RLS-/RPC-Änderung ohne vorherige konkrete Analyse und Zustimmung.
- Keine Demo-Rezepte erfinden, wenn die Seed-Datenbank eine passende Quelle enthält.
- Den sichtbaren Flow mobil testen: Onboarding → Plan → Tag/Woche → Tausch → Einkauf → Rezept/Cook Mode.
- Haushalt mit zwei Accounts testen; gemeinsame Mengen gelten ausdrücklich noch als offene Lücke.
- Das aktuelle Single File ist eine Übergangslösung. Legacy-Code schrittweise extrahieren und erst nach nachgewiesener Funktionsgleichheit löschen.

Deine erste Antwort soll noch keinen großen Rewrite durchführen. Liefere zunächst kurz:

1. dein Verständnis des aktuellen Systems,
2. die wichtigsten technischen Risiken,
3. einen schrittweisen Merge-/Refactor-Plan,
4. die erste kleine, sicher testbare Änderung.

