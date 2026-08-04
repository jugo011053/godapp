# Testcheckliste

## Gast und Onboarding

- [ ] App öffnet auf Mobilbreite ohne leeren Screen.
- [ ] Startbutton ist sichtbar und reagiert.
- [ ] Alter, Größe, Gewicht, Geschlecht, Ziel, Aktivität, Ernährung und Mahlzeiten lassen sich setzen.
- [ ] Abschluss erzeugt einen Plan ohne Login.
- [ ] Kalorien- und Proteinwerte sind plausibel und nicht `NaN`.

## Plan

- [ ] Fünf Tage sind vorhanden und einzeln anklickbar.
- [ ] Umschaltung Heute/Woche funktioniert.
- [ ] Jede aktivierte Mahlzeit wird angezeigt.
- [ ] Rezept öffnet aus Plan und Woche.
- [ ] Portionsmengen und Makros reagieren auf das persönliche Ziel.
- [ ] Neu zusammenstellen erzeugt einen vollständigen neuen Plan.

## Tausch und Entdecken

- [ ] Frühstück, Mittag, Abend, Snack und Shake sind getrennte Einstiege.
- [ ] Suche und Schnellfilter funktionieren gemeinsam.
- [ ] Ausschlüsse aus dem Profil werden eingehalten.
- [ ] Tausch zeigt nur passende Alternativen.
- [ ] Ein gewähltes Rezept ersetzt das richtige Gericht bzw. die richtige Prep-Gruppe.
- [ ] Planwerte und Einkaufsliste ändern sich danach konsistent.

## Einkauf und Kochen

- [ ] Zutaten aus allen fünf Tagen werden zusammengeführt.
- [ ] Einheiten und Mengen bleiben plausibel.
- [ ] Häkchen bleiben nach Reload erhalten.
- [ ] Rezeptdetail zeigt skalierte Zutaten und verständliche Schritte.
- [ ] Cook Mode lässt sich vor/zurück bedienen und schließen.

## Account und Haushalt

- [ ] Registrierung, Login, Reload der Sitzung und Logout funktionieren.
- [ ] Persönlicher Stand wird auf ein zweites Gerät geladen.
- [ ] Person A kann einen Haushalt erstellen und Code kopieren.
- [ ] Person B kann mit `PREP-...` beitreten.
- [ ] Beide sehen denselben Plan.
- [ ] Gerichtstausch von A erscheint nach Sync bei B.
- [ ] Einkaufs-Häkchen von A erscheinen nach Sync bei B.
- [ ] Verlassen entfernt nur die eigene Mitgliedschaft.
- [ ] Persönliche kcal/Portionsfaktoren bleiben getrennt.
- [ ] Bekannte Lücke wird nicht falsch als gelöst dargestellt: Mengen werden aktuell nicht für beide Profile addiert.

## PWA und Regression

- [ ] `manifest.json` lädt ohne 404.
- [ ] Service Worker registriert sich unter HTTP(S).
- [ ] Nach erstem Laden ist die UI offline erneut aufrufbar.
- [ ] Supabase-Fehler machen die lokale Gast-App nicht unbenutzbar.
- [ ] Keine sichtbaren D1-, Timeline-, Training-, Supplement- oder XP-Einstiege.
- [ ] Profil, Login, Modale und Haushalt nutzen dieselbe helle Grün-/Weiß-Sprache.
- [ ] Keine JavaScript-Syntaxfehler in der Konsole.

