// Training Engine: Erstellt Trainingspläne und berechnet Progressionen
// Berücksichtigt Verletzungen, Pausen und Deload-Phasen

import type { UserProfile } from '../types/profile';
import type {
  TrainingWeek,
  TrainingGoal,
  WorkoutSlot,
  WorkoutExercise,
  WorkoutSet,
  ProgressionEntry,
  Exercise,
} from '../types/training';
import {
  WORKOUT_TEMPLATES,
  WEEKLY_PLAN_BY_GOAL,
  WorkoutTemplate,
} from '../data/workoutTemplates';
import { EXERCISES, getExerciseById } from '../data/exercises';

// --- Hilfsfunktionen ---

/**
 * Mappt Profil-Goals auf TrainingGoal für die Engine
 */
function resolveTrainingGoal(profile: UserProfile): TrainingGoal {
  if (profile.goals.includes('boxing') && profile.goals.includes('muscle')) return 'boxing-muscle';
  if (profile.goals.includes('boxing')) return 'boxing';
  if (profile.goals.includes('muscle')) return 'muscle';
  if (profile.goals.includes('weightloss') || profile.goals.includes('fitness')) return 'diet';
  return 'general';
}

/**
 * Prüft ob eine Übung für das Verletzungsprofil geeignet ist
 */
function isExerciseSafeForProfile(exercise: Exercise, profile: UserProfile): boolean {
  const injuries = profile.injuries;
  if (injuries.includes('knee') && !exercise.tags.includes('knee-friendly')) {
    // Knieübungen für Knieverletzte sperren
    const kneeExercises = ['kniebeugen', 'ausfallschritte', 'goblet_squat'];
    if (kneeExercises.includes(exercise.id)) return false;
  }
  if (injuries.includes('shoulder') && !exercise.tags.includes('shoulder-friendly')) {
    const shoulderExercises = ['bankdruecken', 'schulter_druecken'];
    if (shoulderExercises.includes(exercise.id)) return false;
  }
  if (injuries.includes('back') && !exercise.tags.includes('back-friendly')) {
    const backExercises = ['kreuzheben'];
    if (backExercises.includes(exercise.id)) return false;
  }
  return true;
}

/**
 * Filtert Übungen aus einem Template nach Verletzungsprofil
 * Ersetzt gesperrte Übungen durch sichere Alternativen wenn möglich
 */
function filterExercisesForProfile(
  exerciseIds: string[],
  profile: UserProfile
): string[] {
  const safe: string[] = [];

  for (const id of exerciseIds) {
    const exercise = getExerciseById(id);
    if (!exercise) {
      safe.push(id); // Unbekannte ID behalten
      continue;
    }

    if (isExerciseSafeForProfile(exercise, profile)) {
      safe.push(id);
    } else {
      // Alternativen suchen: gleiche Tags ohne verletzungskritische Übungen
      const mainTag = exercise.tags.find(t => ['upper', 'lower', 'core', 'cardio'].includes(t));
      if (mainTag) {
        const alternatives = EXERCISES.filter(
          e =>
            e.id !== id &&
            e.tags.includes(mainTag as any) &&
            isExerciseSafeForProfile(e, profile) &&
            !safe.includes(e.id)
        );
        if (alternatives.length > 0) {
          safe.push(alternatives[0].id);
        }
        // Falls keine Alternative: Übung weglassen
      }
    }
  }

  return safe;
}

/**
 * Erstellt WorkoutSets für eine Übung basierend auf Template-Vorgaben
 */
function buildWorkoutSets(
  exercise: Exercise,
  numSets: number,
  targetReps: number,
  progressionHistory: ProgressionEntry[]
): WorkoutSet[] {
  // Gewicht aus letztem Progressionseintrag oder Standard
  const lastEntry = progressionHistory
    .filter(e => e.exerciseId === exercise.id)
    .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

  const startWeight = lastEntry?.nextWeightKg ?? exercise.defaultWeightKg ?? 0;

  return Array.from({ length: numSets }, (_, i) => ({
    setNumber: i + 1,
    targetReps,
    actualReps: null, // Wird beim Training gefüllt
    weightKg: startWeight,
    rating: null,
  }));
}

// --- Hauptfunktionen ---

/**
 * buildTrainingWeek: Erstellt eine Trainingswoche passend zum Profil
 *
 * - Wählt Template passend zu Ziel (general, muscle, diet, boxing, boxing-muscle)
 * - Verteilt Training auf Wochentage (nicht an Arbeitstagen wenn möglich)
 * - Passt Übungen an Verletzungen und Equipment an
 *
 * Beispiel:
 *   buildTrainingWeek("2024-01-15", profile, [])
 *   // -> TrainingWeek { weekStart: "2024-01-15", goal: 'muscle', slots: [3 Slots] }
 */
export function buildTrainingWeek(
  weekStart: string,
  profile: UserProfile,
  progressionHistory: ProgressionEntry[] = []
): TrainingWeek {
  const goal = resolveTrainingGoal(profile);
  const templateIds = WEEKLY_PLAN_BY_GOAL[goal] ?? WEEKLY_PLAN_BY_GOAL['general'];

  // Wochentage bestimmen (Montag = 0, Sonntag = 6 im Array)
  const weekDays: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // Trainingstage: Nicht-Arbeitstage bevorzugen, dann Rest
  const workDays = new Set(
    weekDays.filter(date => {
      const dow = new Date(date).getDay();
      return profile.workSchedule.days.includes(dow);
    })
  );

  const freeDays    = weekDays.filter(d => !workDays.has(d));
  const allDays     = [...freeDays, ...weekDays.filter(d => workDays.has(d))];

  // Template-Slots auf verfügbare Tage verteilen (mindestens 1 Ruhetag zwischen Trainings)
  const slots: WorkoutSlot[] = [];
  let lastTrainingIdx = -2; // Mindestabstand von 1 Tag

  let templateIdx = 0;
  for (let dayIdx = 0; dayIdx < allDays.length && templateIdx < templateIds.length; dayIdx++) {
    // Mindestens 1 Ruhetag zwischen Einheiten (außer Technikeinheiten/Boxen)
    if (dayIdx - lastTrainingIdx < 1) continue;

    const templateId = templateIds[templateIdx];
    const template = WORKOUT_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      templateIdx++;
      continue;
    }

    const date = allDays[dayIdx];

    // Übungen für dieses Profil filtern
    const safeExerciseIds = filterExercisesForProfile(template.exerciseIds, profile);

    // WorkoutExercises bauen
    const exercises: WorkoutExercise[] = safeExerciseIds.map(exerciseId => {
      const exercise = getExerciseById(exerciseId);
      if (!exercise) return { exerciseId, sets: [] };

      const sets = buildWorkoutSets(
        exercise,
        template.setsPerExercise,
        template.repsPerSet,
        progressionHistory
      );

      return { exerciseId, sets };
    });

    const slot: WorkoutSlot = {
      id: `${template.type}_${date}`,
      type: template.type,
      title: template.title,
      durationMin: template.durationMin,
      shortModeDurationMin: template.shortModeDurationMin,
      exercises,
      date,
      status: 'planned',
      isShortMode: false,
    };

    slots.push(slot);
    lastTrainingIdx = dayIdx;
    templateIdx++;
  }

  return { weekStart, goal, slots };
}

/**
 * calcProgression: Berechnet das empfohlene Gewicht für die nächste Einheit
 *
 * Logik:
 * - Rating 5 (zu leicht)  -> +2 Schritte
 * - Rating 4 (leicht)     -> +1 Schritt
 * - Rating 3 (optimal)    -> gleich
 * - Rating 1-2 (zu schwer)-> -1 Schritt
 * - unter 8 Reps erreicht -> -1 Schritt
 * - 2 Fehlschläge in Folge -> Deload (-3 Schritte)
 *
 * Beispiel:
 *   calcProgression(lastEntry, 4, 10) -> 82.5  (war 80kg, Schritt 2.5kg)
 */
export function calcProgression(
  entry: ProgressionEntry,
  rating: 1 | 2 | 3 | 4 | 5,
  actualReps: number
): number {
  const exercise = getExerciseById(entry.exerciseId);
  if (!exercise) return entry.nextWeightKg;

  const step = exercise.stepSizeKg || 2.5;
  let nextWeight = entry.nextWeightKg;

  // Reps-Check: Unter 8 Reps -> einen Schritt zurück
  if (actualReps < 8) {
    nextWeight -= step;
  } else {
    // Rating-basierte Anpassung
    if (rating === 5) nextWeight += 2 * step;
    else if (rating === 4) nextWeight += step;
    else if (rating <= 2) nextWeight -= step;
    // rating 3 -> unverändert
  }

  // Minimum: Körpergewicht-Übungen bleiben bei 0, andere bei Starthürde
  const minWeight = exercise.defaultWeightKg !== null
    ? Math.max(exercise.defaultWeightKg * 0.5, 0)
    : 0;

  return Math.max(nextWeight, minWeight);
}

/**
 * checkDeload: Prüft ob ein Deload nötig ist (2+ Fehlschläge in Folge)
 *
 * Beispiel:
 *   checkDeload('kniebeugen', progressionHistory) -> true
 */
export function checkDeload(
  exerciseId: string,
  history: ProgressionEntry[]
): boolean {
  const exerciseHistory = history
    .filter(e => e.exerciseId === exerciseId)
    .sort((a, b) => (a.date > b.date ? -1 : 1)); // Neueste zuerst

  if (exerciseHistory.length < 2) return false;

  // 2 aufeinanderfolgende Fehlschläge (Rating <= 2)
  const lastTwo = exerciseHistory.slice(0, 2);
  return lastTwo.every(entry => {
    const avgRating = entry.sets
      .filter(s => s.rating !== null)
      .reduce((sum, s) => sum + (s.rating ?? 3), 0) /
      Math.max(entry.sets.filter(s => s.rating !== null).length, 1);
    return avgRating <= 2;
  });
}

/**
 * handleReturn: Berechnet das Startgewicht nach einer Trainingspause
 *
 * - 7-13 Tage Pause  -> -1 Schritt (leichter Abbau)
 * - 14-27 Tage Pause -> -2 Schritte oder -10%
 * - 28+ Tage Pause   -> -15-20%, weniger Sätze empfohlen
 *
 * Gibt empfohlenes Startgewicht zurück.
 *
 * Beispiel:
 *   handleReturn("2024-01-01", 80, exercise) -> 75  (21 Tage Pause, -2 Schritte)
 */
export function handleReturn(
  lastWorkoutDate: string,
  currentWeightKg: number,
  exercise: Exercise
): number {
  const now = new Date();
  const last = new Date(lastWorkoutDate);
  const daysPaused = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  const step = exercise.stepSizeKg || 2.5;

  if (daysPaused < 7) {
    // Kurze Pause: kein Abzug
    return currentWeightKg;
  } else if (daysPaused < 14) {
    // 7-13 Tage: -1 Schritt
    return Math.max(currentWeightKg - step, 0);
  } else if (daysPaused < 28) {
    // 14-27 Tage: -2 Schritte oder -10%
    const bySteps   = currentWeightKg - 2 * step;
    const byPercent = currentWeightKg * 0.9;
    return Math.max(Math.min(bySteps, byPercent), 0);
  } else {
    // 28+ Tage: -15-20%
    const reductionFactor = daysPaused < 56 ? 0.85 : 0.80;
    return Math.max(Math.round(currentWeightKg * reductionFactor / step) * step, 0);
  }
}

/**
 * buildProgressionEntry: Erstellt einen Progressionseintrag nach einem Training
 *
 * Beispiel:
 *   buildProgressionEntry('kniebeugen', completedSets, history)
 *   // -> ProgressionEntry { exerciseId: 'kniebeugen', nextWeightKg: 82.5, ... }
 */
export function buildProgressionEntry(
  exerciseId: string,
  completedSets: WorkoutSet[],
  history: ProgressionEntry[]
): ProgressionEntry {
  const exercise = getExerciseById(exerciseId);
  const today = new Date().toISOString().split('T')[0];

  // Durchschnitts-Rating aus allen Sätzen
  const ratingSets = completedSets.filter(s => s.rating !== null);
  const avgRating = ratingSets.length > 0
    ? Math.round(ratingSets.reduce((sum, s) => sum + (s.rating ?? 3), 0) / ratingSets.length) as 1 | 2 | 3 | 4 | 5
    : 3 as const;

  const avgReps = completedSets.length > 0
    ? Math.round(completedSets.reduce((sum, s) => sum + (s.actualReps ?? s.targetReps), 0) / completedSets.length)
    : 0;

  // Letzten Eintrag für dieses Exercise finden
  const lastEntry = history
    .filter(e => e.exerciseId === exerciseId)
    .sort((a, b) => (a.date > b.date ? -1 : 1))[0];

  const currentWeight = completedSets[0]?.weightKg ?? exercise?.defaultWeightKg ?? 0;

  const fakeEntry: ProgressionEntry = {
    exerciseId,
    date: today,
    sets: completedSets,
    nextWeightKg: currentWeight,
    deloadActive: false,
  };

  const nextWeight = calcProgression(lastEntry ?? fakeEntry, avgRating, avgReps);
  const deloadActive = checkDeload(exerciseId, [...history, fakeEntry]);

  // Bei Deload: 3 Schritte zurück
  const finalWeight = deloadActive
    ? Math.max(nextWeight - (exercise?.stepSizeKg ?? 2.5) * 3, 0)
    : nextWeight;

  return {
    exerciseId,
    date: today,
    sets: completedSets,
    nextWeightKg: finalWeight,
    deloadActive,
  };
}
