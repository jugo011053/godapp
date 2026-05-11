// Workout-Templates für verschiedene Trainingsziele
// Jedes Template enthält Übungen mit Sätzen und Wiederholungen

import type { WorkoutType, TrainingGoal } from '../types/training';

// Beschreibung eines Workout-Templates (vor der Personalisierung)
export interface WorkoutTemplate {
  id: string;
  type: WorkoutType;
  title: string;
  goal: TrainingGoal;
  durationMin: number;
  shortModeDurationMin: number;
  exerciseIds: string[];       // IDs aus exercises.ts
  setsPerExercise: number;
  repsPerSet: number;
  restBetweenSetsMin: number;
  description: string;
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // 1. Ganzkörper – Allgemeine Fitness
  {
    id: 'fullbody_general',
    type: 'fullbody',
    title: 'Ganzkörper – Allgemeine Fitness',
    goal: 'general',
    durationMin: 60,
    shortModeDurationMin: 45,
    exerciseIds: [
      'goblet_squat',      // Beine
      'bankdruecken',      // Brust/Drücken
      'klimmzuege',        // Rücken/Ziehen
      'schulter_druecken', // Schulter
      'romanian_deadlift', // Hintere Kette
      'plank',             // Core
    ],
    setsPerExercise: 3,
    repsPerSet: 10,
    restBetweenSetsMin: 1.5,
    description:
      'Ausgewogenes Ganzkörper-Workout für allgemeine Fitness. ' +
      'Kurzversion: Letzte 2 Übungen weglassen oder 2 Sätze statt 3.',
  },

  // 2. Push-Tag (Brust, Schulter, Trizeps)
  {
    id: 'push',
    type: 'push',
    title: 'Push – Brust, Schulter, Trizeps',
    goal: 'muscle',
    durationMin: 60,
    shortModeDurationMin: 45,
    exerciseIds: [
      'bankdruecken',       // Hauptübung Brust
      'schulter_druecken',  // Hauptübung Schulter
      'trizeps_druecken',   // Isolationsübung Trizeps
      'goblet_squat',       // Zusatzübung Beine/Stabilität
      'plank',              // Core-Abschluss
    ],
    setsPerExercise: 4,
    repsPerSet: 8,
    restBetweenSetsMin: 2,
    description:
      'Drück-orientierter Oberkörperfokus. ' +
      'Bankdrücken und Schulterdrücken als Hauptübungen mit progressiver Überlast.',
  },

  // 3. Pull-Tag (Rücken, Bizeps)
  {
    id: 'pull',
    type: 'pull',
    title: 'Pull – Rücken und Bizeps',
    goal: 'muscle',
    durationMin: 60,
    shortModeDurationMin: 45,
    exerciseIds: [
      'klimmzuege',         // Hauptübung Rücken
      'rudern_kh',          // Hauptübung Rücken/Bizeps
      'bizeps_curl',        // Isolationsübung Bizeps
      'kreuzheben',         // Rücken/Hintere Kette
      'crunch',             // Core-Abschluss
    ],
    setsPerExercise: 4,
    repsPerSet: 8,
    restBetweenSetsMin: 2,
    description:
      'Zieh-orientierter Oberkörperfokus. ' +
      'Klimmzüge und Rudern als Basis für breiten, kräftigen Rücken.',
  },

  // 4. Bein-Tag
  {
    id: 'legs',
    type: 'legs',
    title: 'Beine – Kraft und Masse',
    goal: 'muscle',
    durationMin: 65,
    shortModeDurationMin: 50,
    exerciseIds: [
      'kniebeugen',         // Hauptübung Quadrizeps
      'romanian_deadlift',  // Hauptübung Oberschenkelrückseite
      'ausfallschritte',    // Volumen Beine
      'goblet_squat',       // Zusatzvolumen
      'plank',              // Core-Abschluss
    ],
    setsPerExercise: 4,
    repsPerSet: 10,
    restBetweenSetsMin: 2.5,
    description:
      'Kraftorientiertes Beintraining. Kniebeugen als Haupt-Kompoundübung. ' +
      'Kurzversion: Goblet Squat weglassen, 3 Sätze statt 4.',
  },

  // 5. Boxen – Technik und Kondition
  {
    id: 'boxing_technique',
    type: 'technique',
    title: 'Boxen – Technik und Kondition',
    goal: 'boxing',
    durationMin: 75,
    shortModeDurationMin: 45,
    exerciseIds: [
      'seilspringen',  // Aufwärmen + Ausdauer
      'burpees',       // Explosivkraft + Kondition
      'plank',         // Core-Stabilität
      'crunch',        // Core-Kraft
    ],
    setsPerExercise: 4,
    repsPerSet: 60, // Sekunden bei Cardio-Übungen
    restBetweenSetsMin: 1,
    description:
      'Boxen-spezifisches Konditions- und Techniktraining. ' +
      'Enthält: Seilspringen (Aufwärmen 5min), Schattenboxen 3x3min Runden, ' +
      'Pratzen/Sandsack 3x3min Runden, Core-Abschluss. ' +
      'Kurzversion: Je 2 Runden Schattenboxen und Sandsack, kein Core.',
  },
];

/**
 * Template nach ID suchen
 * Beispiel: getTemplateById('push') -> WorkoutTemplate { title: 'Push...', ... }
 */
export function getTemplateById(id: string): WorkoutTemplate | undefined {
  return WORKOUT_TEMPLATES.find(t => t.id === id);
}

/**
 * Templates nach Ziel filtern
 * Beispiel: getTemplatesByGoal('boxing') -> [boxing_technique]
 */
export function getTemplatesByGoal(goal: TrainingGoal): WorkoutTemplate[] {
  return WORKOUT_TEMPLATES.filter(t => t.goal === goal);
}

/**
 * Standard-Trainingsplan-Konfiguration je nach Trainingsziel
 * Gibt die Template-IDs zurück, die pro Woche verwendet werden sollen
 */
export const WEEKLY_PLAN_BY_GOAL: Record<TrainingGoal, string[]> = {
  general:       ['fullbody_general', 'fullbody_general', 'fullbody_general'],
  muscle:        ['push', 'pull', 'legs', 'push', 'pull'],
  diet:          ['fullbody_general', 'fullbody_general', 'fullbody_general'],
  boxing:        ['boxing_technique', 'boxing_technique', 'fullbody_general'],
  'boxing-muscle': ['boxing_technique', 'push', 'pull', 'legs'],
};
