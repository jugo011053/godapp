// Timeline-Engine: Erstellt und verwaltet Tages- und Wochenpläne
// Koordiniert Arbeit, Training, Einkauf und Meal Prep

import type { UserProfile } from '../types/profile';
import type { TimelineBlock, DayTimeline, WeekTimeline, BlockType, Priority } from '../types/timeline';
import type { MealCycle } from '../types/meal';
import type { TrainingWeek, WorkoutSlot } from '../types/training';
import { timeToMinutes, minutesToTime, addMinutes, timesOverlap, snapToGrid } from '../utils/timeUtils';
import { isShoppingAllowed } from '../data/holidays';

// --- Hilfsfunktionen ---

/**
 * Generiert eine einfache Block-ID aus Typ und Uhrzeit
 */
function makeBlockId(type: BlockType, time: string, date: string): string {
  return `${type}_${date}_${time.replace(':', '')}`;
}

/**
 * Erstellt einen neuen TimelineBlock mit Standardwerten
 */
function createBlock(
  type: BlockType,
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  priority: Priority,
  extras: Partial<TimelineBlock> = {}
): TimelineBlock {
  return {
    id: makeBlockId(type, startTime, date),
    type,
    title,
    startTime,
    endTime,
    priority,
    locked: false,
    shortModeAvailable: false,
    shortModeDurationMin: null,
    status: 'planned',
    date,
    notes: '',
    ...extras,
  };
}

/**
 * Prüft ob ein Datum ein Arbeitstag für den Nutzer ist
 */
function isWorkDay(dateStr: string, profile: UserProfile): boolean {
  const dayOfWeek = new Date(dateStr).getDay(); // 0=Sonntag
  return profile.workSchedule.days.includes(dayOfWeek);
}

/**
 * Findet den ersten freien Zeitslot nach einem Zeitpunkt, der lang genug ist
 */
function findFreeSlot(
  existingBlocks: TimelineBlock[],
  afterTime: string,
  durationMin: number,
  latestStart: string
): string | null {
  let candidate = timeToMinutes(afterTime);
  const latest = timeToMinutes(latestStart);

  // Kandidaten in 15-Minuten-Schritten prüfen
  while (candidate + durationMin <= latest + durationMin) {
    const candidateEnd = candidate + durationMin;
    const candidateTimeStr = minutesToTime(candidate);
    const candidateEndStr = minutesToTime(candidateEnd);

    // Prüfen ob dieser Slot frei ist
    const hasConflict = existingBlocks.some(block =>
      timesOverlap(candidateTimeStr, candidateEndStr, block.startTime, block.endTime)
    );

    if (!hasConflict) return candidateTimeStr;

    // Zum nächsten 15-Minuten-Schritt
    candidate += 15;
    if (candidate > latest) break;
  }

  return null; // Kein freier Slot gefunden
}

// --- Hauptfunktionen ---

/**
 * buildDay: Erstellt einen vollständigen Tagesplan
 *
 * - Liest Arbeit aus Profil
 * - Fügt Puffer nach Arbeit ein
 * - Platziert Training nach Arbeit (+ Puffer)
 * - Platziert Einkauf wenn nötig
 * - Platziert Prep wenn nötig
 * - Gibt fertigen Tagesplan zurück
 *
 * Beispiel:
 *   const day = buildDay("2024-01-15", profile, mealCycle, workoutSlot)
 *   // -> DayTimeline { date: "2024-01-15", blocks: [workBlock, trainingBlock, ...] }
 */
export function buildDay(
  date: string,
  profile: UserProfile,
  mealCycle: MealCycle | null,
  workoutSlot: WorkoutSlot | null
): DayTimeline {
  const blocks: TimelineBlock[] = [];

  // 1. Arbeitsblock hinzufügen wenn Arbeitstag
  if (isWorkDay(date, profile)) {
    const workBlock = createBlock(
      'work',
      'Arbeit',
      date,
      profile.workSchedule.startTime,
      profile.workSchedule.endTime,
      1, // Höchste Priorität
      { locked: true }
    );
    blocks.push(workBlock);
  }

  // 2. Training platzieren
  if (workoutSlot) {
    const workEndMin = isWorkDay(date, profile)
      ? timeToMinutes(profile.workSchedule.endTime)
      : timeToMinutes(profile.wakeTime) + 60; // Mindestens 1h nach Aufwachen

    // Puffer nach Arbeit berücksichtigen
    const earliestTrainingMin = workEndMin + profile.bufferAfterWorkMin;
    const earliestTrainingTime = minutesToTime(earliestTrainingMin);

    // Verfügbarer Zeitraum bis Schlafenszeit minus Trainingsdauer
    const latestTrainingStart = addMinutes(
      profile.sleepTime,
      -(workoutSlot.durationMin + 60) // mindestens 1h vor Schlaf fertig
    );

    const trainingStart = snapToGrid(earliestTrainingTime);
    const trainingEnd = addMinutes(trainingStart, workoutSlot.durationMin);

    // Nur hinzufügen wenn noch vor Schlafenszeit
    if (timeToMinutes(trainingStart) < timeToMinutes(latestTrainingStart)) {
      const trainingBlock = createBlock(
        'training',
        workoutSlot.title,
        date,
        trainingStart,
        trainingEnd,
        4, // Priorität 4
        {
          shortModeAvailable: workoutSlot.shortModeDurationMin > 0,
          shortModeDurationMin: workoutSlot.shortModeDurationMin,
        }
      );
      blocks.push(trainingBlock);
    }
  }

  // 3. Einkauf platzieren wenn erlaubt und Meal Cycle vorhanden
  if (mealCycle && isShoppingAllowed(date) && mealCycle.shoppingDate === date) {
    const shoppingDurationMin = 60;

    // Einkauf am Vormittag platzieren (nach Aufstehen + 30min)
    const shoppingStart = snapToGrid(addMinutes(profile.wakeTime, 30));

    // Prüfen ob der Slot frei ist
    const freeStart = findFreeSlot(blocks, shoppingStart, shoppingDurationMin, '18:00');
    if (freeStart) {
      const shoppingBlock = createBlock(
        'shopping',
        'Einkaufen (Meal Prep)',
        date,
        freeStart,
        addMinutes(freeStart, shoppingDurationMin),
        2 // Priorität 2
      );
      blocks.push(shoppingBlock);
    }
  }

  // 4. Meal Prep platzieren wenn nötig
  const isPrepDay =
    mealCycle &&
    (mealCycle.blockA.prepDate === date || mealCycle.blockB.prepDate === date);

  if (isPrepDay) {
    const prepDurationMin = 90;
    const prepStart = findFreeSlot(blocks, '12:00', prepDurationMin, '19:00');
    if (prepStart) {
      const prepBlock = createBlock(
        'prep',
        'Meal Prep',
        date,
        prepStart,
        addMinutes(prepStart, prepDurationMin),
        3 // Priorität 3
      );
      blocks.push(prepBlock);
    }
  }

  // Blöcke nach Startzeit sortieren
  blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  return { date, blocks };
}

/**
 * buildWeek: Erstellt einen vollständigen Wochenplan
 *
 * - Ruft buildDay für jeden Tag der Woche auf
 * - weekStart muss ein Montag (ISO-Datum) sein
 *
 * Beispiel:
 *   const week = buildWeek("2024-01-15", profile, mealCycle, trainingWeek)
 *   // -> WeekTimeline { weekStart: "2024-01-15", days: [7x DayTimeline] }
 */
export function buildWeek(
  weekStart: string,
  profile: UserProfile,
  mealCycle: MealCycle | null,
  trainingWeek: TrainingWeek | null
): WeekTimeline {
  const days: DayTimeline[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // Workout-Slot für diesen Tag finden
    const workoutSlot = trainingWeek
      ? trainingWeek.slots.find(s => s.date === dateStr) ?? null
      : null;

    days.push(buildDay(dateStr, profile, mealCycle, workoutSlot));
  }

  return { weekStart, days };
}

/**
 * resolveConflicts: Löst Konflikte zwischen einem neuen Block und bestehenden Blöcken
 *
 * - Prüft ob newBlock mit existierenden Blöcken kollidiert
 * - Löst Konflikte nach Priorität (Priorität 5 zuerst streichen, dann 4, etc.)
 * - Gesperrte Blöcke werden nie entfernt
 * - Gibt aktualisierten Tag + kurze Zusammenfassung zurück
 *
 * Beispiel:
 *   const result = resolveConflicts(day, newBlock)
 *   // -> { updatedDay: DayTimeline, summary: "Training verschoben." }
 */
export function resolveConflicts(
  day: DayTimeline,
  newBlock: TimelineBlock
): { updatedDay: DayTimeline; summary: string } {
  const conflicting = day.blocks.filter(block =>
    timesOverlap(newBlock.startTime, newBlock.endTime, block.startTime, block.endTime) &&
    !block.locked
  );

  // Keine Konflikte -> direkt einfügen
  if (conflicting.length === 0) {
    const updatedBlocks = [...day.blocks, newBlock].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
    return {
      updatedDay: { ...day, blocks: updatedBlocks },
      summary: 'Kein Konflikt – Block eingefügt.',
    };
  }

  // Konflikte nach Priorität sortieren (höchste Prioritätsnummer = unwichtigster Block zuerst)
  const sortedConflicts = [...conflicting].sort((a, b) => b.priority - a.priority);

  const removedTitles: string[] = [];
  let updatedBlocks = [...day.blocks];

  for (const conflict of sortedConflicts) {
    // Prüfen ob Konflikt immer noch besteht nach evtl. vorherigen Entfernungen
    if (timesOverlap(newBlock.startTime, newBlock.endTime, conflict.startTime, conflict.endTime)) {
      if (newBlock.priority <= conflict.priority) {
        // Neuer Block ist wichtiger -> konfliktierenden entfernen
        updatedBlocks = updatedBlocks.filter(b => b.id !== conflict.id);
        removedTitles.push(conflict.title);
      }
    }
  }

  // Neuen Block einfügen
  updatedBlocks.push(newBlock);
  updatedBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const summary =
    removedTitles.length > 0
      ? `Entfernt wegen Priorität: ${removedTitles.join(', ')}.`
      : 'Block eingefügt ohne Entfernung (Prioritäten gleich oder niedriger).';

  return {
    updatedDay: { ...day, blocks: updatedBlocks },
    summary,
  };
}

/**
 * lockBlock: Sperrt einen Block (kann nicht mehr verschoben/entfernt werden)
 *
 * - Setzt locked=true auf dem Block mit der angegebenen ID
 *
 * Beispiel:
 *   const updatedDay = lockBlock(day, "work_2024-01-15_0700")
 *   // -> DayTimeline mit gesperrtem Arbeitsblock
 */
export function lockBlock(day: DayTimeline, blockId: string): DayTimeline {
  const updatedBlocks = day.blocks.map(block =>
    block.id === blockId ? { ...block, locked: true } : block
  );
  return { ...day, blocks: updatedBlocks };
}

/**
 * updateBlockStatus: Aktualisiert den Status eines Blocks
 *
 * Beispiel:
 *   const updatedDay = updateBlockStatus(day, "training_2024-01-15_1530", 'done')
 */
export function updateBlockStatus(
  day: DayTimeline,
  blockId: string,
  status: TimelineBlock['status']
): DayTimeline {
  const updatedBlocks = day.blocks.map(block =>
    block.id === blockId ? { ...block, status } : block
  );
  return { ...day, blocks: updatedBlocks };
}
