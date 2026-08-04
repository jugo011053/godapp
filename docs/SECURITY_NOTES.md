# Supabase-Sicherheitshinweise

Dies ist eine Bestandsaufnahme, keine bereits ausgeführte Reparatur.

## Aktuelle Advisor-Warnungen

1. `touch_updated_at` hat einen veränderbaren `search_path`.
   - https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

2. Folgende `SECURITY DEFINER`-Funktionen sind laut Advisor für `anon` ausführbar:
   - `award_xp(p_xp integer)`
   - `create_household(p_name text)`
   - `join_household(p_code text)`
   - `user_household_ids()`
   - https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

3. Dieselben Funktionen werden auch für `authenticated` als bewusst zu prüfende `SECURITY DEFINER`-Oberfläche gemeldet.
   - https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

4. Schutz vor geleakten Passwörtern ist deaktiviert.
   - https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Relevante Funktionsdefinitionen

### `create_household`

- `SECURITY DEFINER`
- fester `search_path = public`
- erzeugt Einladungscode, Haushalt, Owner-Mitgliedschaft und Legacy-Gamification-Zeile
- nutzt `auth.uid()`

### `join_household`

- `SECURITY DEFINER`
- fester `search_path = public`
- sucht den Einladungscode und fügt `auth.uid()` als Mitglied hinzu
- Backend entfernt historisch nur `D1-`; das aktuelle Frontend entfernt `PREP-` bereits vor dem RPC

### `user_household_ids`

- `STABLE SECURITY DEFINER`
- liefert Haushalte des aktuellen `auth.uid()`
- wird von mehreren RLS-Policies verwendet

## Vor einer Änderung prüfen

- Muss `anon` diese RPCs überhaupt ausführen können? Für Haushalte ist ein angemeldeter User vorgesehen.
- Welche direkte Ausführbarkeit braucht `user_household_ids()`, wenn die Funktion primär innerhalb der RLS-Policies verwendet wird?
- Sind `USING` und `WITH CHECK` für alle Schreiboperationen ausreichend eng?
- Kann ein Mitglied fremde Owner-/Haushaltsfelder verändern?
- Was passiert, wenn ein Haushalt verlassen wird oder der Owner gelöscht wird?
- Sind Einladungsversuche begrenzt und Codes ausreichend langlebig/sicher?
- Wird bei einer möglichen Realtime-Erweiterung ein privater Channel mit eigener Autorisierung verwendet?

Keine dieser Warnungen durch pauschales Abschalten von RLS oder Einbau eines Secret-/Service-Role-Keys in den Client „lösen“.

