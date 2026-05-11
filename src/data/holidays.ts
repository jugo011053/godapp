// Hilfsfunktionen für Feiertage und Einkaufsplanung
// Feiertage: Deutschland (bundesweite gesetzliche Feiertage 2024–2026)

const GERMAN_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', // Neujahr
  '2024-03-29', // Karfreitag
  '2024-04-01', // Ostermontag
  '2024-05-01', // Tag der Arbeit
  '2024-05-09', // Christi Himmelfahrt
  '2024-05-20', // Pfingstmontag
  '2024-10-03', // Tag der Deutschen Einheit
  '2024-12-25', // 1. Weihnachtstag
  '2024-12-26', // 2. Weihnachtstag
  // 2025
  '2025-01-01', // Neujahr
  '2025-04-18', // Karfreitag
  '2025-04-21', // Ostermontag
  '2025-05-01', // Tag der Arbeit
  '2025-05-29', // Christi Himmelfahrt
  '2025-06-09', // Pfingstmontag
  '2025-10-03', // Tag der Deutschen Einheit
  '2025-12-25', // 1. Weihnachtstag
  '2025-12-26', // 2. Weihnachtstag
  // 2026
  '2026-01-01', // Neujahr
  '2026-04-03', // Karfreitag
  '2026-04-06', // Ostermontag
  '2026-05-01', // Tag der Arbeit
  '2026-05-14', // Christi Himmelfahrt
  '2026-05-25', // Pfingstmontag
  '2026-10-03', // Tag der Deutschen Einheit
  '2026-12-25', // 1. Weihnachtstag
  '2026-12-26', // 2. Weihnachtstag
];

/**
 * Prüft ob ein Datum ein Sonntag ist
 * Beispiel: isSunday("2024-01-07") -> true
 */
export function isSunday(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date.getDay() === 0;
}

/**
 * Prüft ob ein Datum ein gesetzlicher Feiertag in Deutschland ist
 * Beispiel: isHoliday("2024-12-25") -> true
 */
export function isHoliday(dateStr: string): boolean {
  return GERMAN_HOLIDAYS.includes(dateStr);
}

/**
 * Prüft ob an einem Datum eingekauft werden kann
 * (kein Sonntag, kein Feiertag)
 * Beispiel: isShoppingAllowed("2024-12-25") -> false
 */
export function isShoppingAllowed(dateStr: string): boolean {
  return !isSunday(dateStr) && !isHoliday(dateStr);
}

/**
 * Findet den nächsten erlaubten Einkaufstag ab einem Startdatum
 * Beispiel: nextShoppingDay("2024-12-24") -> "2024-12-27" (nach Weihnachten)
 */
export function nextShoppingDay(dateStr: string): string {
  const date = new Date(dateStr);
  let attempts = 0;
  while (attempts < 14) {
    const iso = date.toISOString().split('T')[0];
    if (isShoppingAllowed(iso)) return iso;
    date.setDate(date.getDate() + 1);
    attempts++;
  }
  // Fallback: Ursprungsdatum zurückgeben
  return dateStr;
}
