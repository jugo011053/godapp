// Typen für Trainingsplanung und Progression

export type ExerciseTag =
  | 'knee-friendly'     // kniefreundlich
  | 'shoulder-friendly' // schulterfreundlich
  | 'back-friendly'     // rückenfreundlich
  | 'beginner'          // für Anfänger geeignet
  | 'advanced'          // für Fortgeschrittene
  | 'gym'               // braucht Fitnessstudio
  | 'home'              // zuhause möglich
  | 'bodyweight'        // nur Körpergewicht
  | 'upper'             // Oberkörper
  | 'lower'             // Unterkörper
  | 'core'              // Rumpf
  | 'cardio'            // Ausdauer
  | 'mobility';         // Beweglichkeit

export type TrainingGoal =
  | 'general'         // allgemeine Fitness
  | 'muscle'          // Muskelaufbau
  | 'diet'            // Abnehmen
  | 'boxing'          // Boxen
  | 'boxing-muscle';  // Boxen + Muskelaufbau

export type WorkoutType =
  | 'fullbody'   // Ganzkörper
  | 'push'       // Drücken (Brust, Schulter, Trizeps)
  | 'pull'       // Ziehen (Rücken, Bizeps)
  | 'legs'       // Beine
  | 'interval'   // Intervalltraining
  | 'technique'  // Techniktraining (Boxen etc.)
  | 'mobility';  // Beweglichkeit

// Eine einzelne Übung in der Datenbank
export interface Exercise {
  id: string;
  name: string;
  tags: ExerciseTag[];
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null; // null = Körpergewicht
  stepSizeKg: number;             // Steigerungsschritt in kg
  notes: string;
}

// Ein einzelner Satz während des Trainings
export interface WorkoutSet {
  setNumber: number;
  targetReps: number;
  actualReps: number | null;           // null = noch nicht gemacht
  weightKg: number;
  rating: 1 | 2 | 3 | 4 | 5 | null;  // Feedback: 1=zu schwer, 5=zu leicht
}

// Eine Übung innerhalb eines Workouts
export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

// Ein einzelner Trainingsblock (ein Training)
export interface WorkoutSlot {
  id: string;
  type: WorkoutType;
  title: string;
  durationMin: number;           // geplante Dauer
  shortModeDurationMin: number;  // Dauer Kurzversion
  exercises: WorkoutExercise[];
  date: string;
  status: 'planned' | 'done' | 'skipped';
  isShortMode: boolean;          // wurde die Kurzversion gemacht
}

// Trainingsplan für eine Woche
export interface TrainingWeek {
  weekStart: string;  // Montag ISO-Datum
  goal: TrainingGoal;
  slots: WorkoutSlot[];
}

// Progressionseintrag nach einem abgeschlossenen Training
export interface ProgressionEntry {
  exerciseId: string;
  date: string;
  sets: WorkoutSet[];
  nextWeightKg: number;   // empfohlenes Gewicht für nächste Einheit
  deloadActive: boolean;  // aktiver Deload nach zu vielen Fehlschlägen
}
