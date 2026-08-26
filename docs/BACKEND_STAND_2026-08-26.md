# Backend-Stand und Migration vom 2026-08-26

Vor dem Wiederanschluss von Anmeldung und Haushalt an die v8-App wurde die
Datenbank zum ersten Mal vollständig ausgelesen. Das war ein offener Punkt in
`CLAUDE.md` („RLS-Policies hängen an Rolle `public` und wurden nie ausgelesen").

## Ergebnis der Prüfung

**Der Befund aus CLAUDE.md entkräftet sich.** `public` heißt in Postgres „alle
Rollen", aber jede Policy prüft zusätzlich `auth.uid()`. Für einen nicht
angemeldeten Aufrufer ist das `NULL`, und `user_id = NULL` trifft nie zu. Die
Absicherung sitzt. Öffentlich lesbar sind nur `recipe_catalog_v1`, `foods` und
`recipes` — beabsichtigt, das ist der Katalog.

**Bestand:** 3 Konten, 1 Haushalt mit 2 Mitgliedern, 1 Plan, 1 Einkaufsposten,
3 Zeilen `user_state`. `profiles` hatte **0 Zeilen** — die Tabelle existiert
seit v7, wurde aber nie benutzt; alles lag im JSONB von `user_state`.

**Drei Ebenen im Datenmodell**, siehe `DATENBANK_AUFTRAG.md` Punkt 0: das
normalisierte Schema `catalog` (14 Tabellen, `recipe_ingredients.food_id`
vollständig gefüllt), die Kopie `public.foods`, und der flache Abzug
`public.recipe_catalog_v1` — den als einziges die App liest.

## Gefundene Schwachstellen

1. **`join_household` war ohne Anmeldung aufrufbar.** `SECURITY DEFINER` mit
   `EXECUTE` für `anon`. Die Funktion nimmt einen sechsstelligen Code, gibt bei
   Treffer die ganze Haushaltszeile zurück und wirft bei Fehlschlag eine
   Ausnahme — ein Rateorakel ohne Anmeldung und ohne Bremse. Dasselbe galt für
   `create_household` und `award_xp`.
2. **Der Einladungscode ließ sich umgehen.** Die INSERT-Policy `p_hm_ins` auf
   `household_members` erlaubte `user_id = auth.uid()`. Wer eine Haushalts-UUID
   kannte, trug sich direkt ein, ohne je einen Code zu sehen.
3. **`households` UPDATE hatte kein `WITH CHECK`.** Ein Mitglied konnte die
   Zeile beliebig umschreiben, `invite_code` und `created_by` eingeschlossen.
4. **`join_household` fand einen `PREP-`-Code nie.** Die Funktion entfernte nur
   das alte Präfix `D1-`; ein Code im heutigen Format wurde als Ganzes gesucht.
   Das Haushalts-Feature wäre nach dem Wiederanschluss stillschweigend kaputt
   gewesen.
5. **Zwei konkurrierende Haushaltsmodelle:** `household` (genau zwei Personen,
   `member_a_id`/`member_b_id`, Wochenplan als JSONB) neben `households` +
   `household_members`. Ersteres leer.
6. Leaked-Password-Schutz aus, `touch_updated_at` mit veränderlichem
   `search_path`.

## Durchgeführte Migration

Vier benannte Schritte, nach ausdrücklicher Zustimmung:

| Migration | Inhalt |
|---|---|
| `harden_household_rpcs` | `EXECUTE` für `anon` auf `create_household`, `join_household`, `award_xp` entzogen. `join_household` neu geschrieben: prüft auf Anmeldung, entfernt jedes Präfix vor dem Bindestrich. `touch_updated_at` mit festem `search_path`. |
| `household_join_only_via_code` | Policy `p_hm_ins` entfernt — Beitritt nur noch über die RPC. `p_hh_upd` mit `WITH CHECK` neu. `UPDATE` auf `households` auf die Spalten `name`, `settings`, `updated_at` beschränkt. Leere Alt-Tabelle `household` gelöscht. |
| `favorites_and_recipe_feedback` | Neue Tabellen `favorites` und `recipe_feedback` mit RLS je Nutzer. |
| `profiles_fields_for_v8` | Spalten `activity`, `cooking_style`, `max_cooking_time`, `simplicity`, `goal`, `priorities`, `excluded_ingredients`, `enabled_meals`, `onboarding_version`. Dazu `CHECK`-Bedingungen auf `cooking_style`, `prep_days`, `diet_style`, `goal`. |

Die `CHECK`-Bedingungen sind eine Lehre aus einem realen Fehler: der
Auswahlkasten „Kochstil" in der App schrieb `simple`/`mixed`/`ambitious`,
gelesen wurden `fresh`/`mixed`/`meal_prep`. Der Wert versackte wirkungslos.
Auf Datenbankebene fliegt so etwas jetzt sofort auf.

**`user_household_ids()` bleibt bewusst für alle Rollen aufrufbar.** Sie steht
in den RLS-Ausdrücken mehrerer Tabellen; entzieht man `anon` das Recht,
scheitert eine anonyme Abfrage mit einem Rechtefehler statt mit einem leeren
Ergebnis. Für `anon` gibt sie ohnehin nichts zurück. Der Advisor warnt
weiterhin — das ist hier die richtige Antwort, nicht die falsche.

## Nachweis

Gegen echte Daten durchgespielt und danach zurückgesetzt:

| Prüfung | Ergebnis |
|---|---|
| direkter INSERT in `household_members` ohne Code | abgewiesen: *new row violates row-level security policy* |
| Beitritt über `join_household('PREP-…')` | funktioniert, 2 → 3 Mitglieder |
| falscher Code `PREP-ZZZZZZ` | abgewiesen: *Code nicht gefunden* |
| Aufräumen | wieder 2 Mitglieder, Ausgangszustand |

Advisor danach: keine Warnung mehr zu `create_household`, `join_household`,
`award_xp` für `anon`.

## Bleibt offen

- **Leaked-Password-Schutz** lässt sich nur im Dashboard einschalten:
  Authentication → Policies → *Leaked password protection*. Kein SQL-Weg.
- Die 14 Tabellen in `catalog` haben RLS an und keine Policies. Der Advisor
  meldet das als INFO; sie sind damit über die API unerreichbar, was für
  interne Aufbereitungstabellen richtig ist.
