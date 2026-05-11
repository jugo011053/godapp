// Hilfsfunktionen für Zeitberechnungen im Tagesplan

/**
 * Konvertiert "HH:MM" in Minuten seit Mitternacht
 * Beispiel: "07:30" -> 450
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Konvertiert Minuten seit Mitternacht in "HH:MM"
 * Beispiel: 450 -> "07:30"
 */
export function minutesToTime(minutes: number): string {
  const totalMinutes = ((minutes % 1440) + 1440) % 1440; // Wrap um Mitternacht
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Rastet eine Uhrzeit auf das nächste Raster (Standard: 15 Minuten) ein
 * Beispiel: "15:22" -> "15:30" (bei gridMin=15)
 */
export function snapToGrid(timeStr: string, gridMin = 15): string {
  const totalMin = timeToMinutes(timeStr);
  const snapped = Math.round(totalMin / gridMin) * gridMin;
  return minutesToTime(snapped);
}

/**
 * Addiert Minuten zu einer Uhrzeit
 * Beispiel: addMinutes("15:30", 90) -> "17:00"
 */
export function addMinutes(timeStr: string, minutes: number): string {
  const totalMin = timeToMinutes(timeStr) + minutes;
  return minutesToTime(totalMin);
}

/**
 * Formatiert eine Uhrzeit für die Anzeige
 * Beispiel: "15:30" -> "15:30 Uhr"
 */
export function formatTime(timeStr: string): string {
  return `${timeStr} Uhr`;
}

/**
 * Prüft ob zwei Zeitblöcke sich überlappen
 * Beispiel: timesOverlap("08:00","10:00","09:00","11:00") -> true
 */
export function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  // Überlappung wenn: s1 < e2 UND s2 < e1
  return s1 < e2 && s2 < e1;
}

/**
 * Berechnet die Überlappungsminuten zweier Zeitblöcke
 * Beispiel: getOverlapMinutes("08:00","10:00","09:00","11:00") -> 60
 */
export function getOverlapMinutes(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): number {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Berechnet die Dauer eines Zeitblocks in Minuten
 * Beispiel: blockDurationMin("15:00", "17:30") -> 150
 */
export function blockDurationMin(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}
