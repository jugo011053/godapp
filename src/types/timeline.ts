// Typen für den Tages- und Wochenplan

export type BlockType =
  | 'work'        // Arbeit
  | 'appointment' // Arzttermin, etc.
  | 'shopping'    // Einkaufen
  | 'prep'        // Meal Prep
  | 'training'    // Sport
  | 'mobility'    // Stretching, Yoga
  | 'yoga'        // Yoga-Session
  | 'other';      // Sonstiges

export type BlockStatus = 'planned' | 'done' | 'shifted' | 'skipped';

// Priorität: 1 = muss sein, 5 = nice to have
// 1=Arbeit/Arzt, 2=Einkauf, 3=Prep, 4=Training, 5=Mobility
export type Priority = 1 | 2 | 3 | 4 | 5;

// Ein einzelner Zeitblock im Tagesplan
export interface TimelineBlock {
  id: string;
  type: BlockType;
  title: string;
  startTime: string;             // "15:30"
  endTime: string;               // "17:00"
  priority: Priority;
  locked: boolean;               // true = darf nicht verschoben werden
  shortModeAvailable: boolean;   // kann auf Kurzversion reduziert werden
  shortModeDurationMin: number | null; // Dauer der Kurzversion
  status: BlockStatus;
  date: string;                  // "2024-01-15" ISO-Datum
  notes: string;
}

// Alle Blöcke eines Tages
export interface DayTimeline {
  date: string;
  blocks: TimelineBlock[];
}

// Alle Tage einer Woche (Montag bis Sonntag)
export interface WeekTimeline {
  weekStart: string; // Montag als ISO-Datum
  days: DayTimeline[];
}
