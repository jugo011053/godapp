// Übungsdatenbank – 15 Grundübungen mit Tags und Progressionsschritten

import type { Exercise } from '../types/training';

export const EXERCISES: Exercise[] = [
  {
    id: 'bankdruecken',
    name: 'Bankdrücken',
    tags: ['upper', 'gym', 'advanced'],
    defaultSets: 4,
    defaultReps: 8,
    defaultWeightKg: 60,
    stepSizeKg: 2.5,
    notes: 'Schulterblätter zusammenziehen, kontrolliert absenken',
  },
  {
    id: 'kniebeugen',
    name: 'Kniebeugen (Barbell)',
    tags: ['lower', 'gym', 'advanced'],
    defaultSets: 4,
    defaultReps: 8,
    defaultWeightKg: 80,
    stepSizeKg: 2.5,
    notes: 'Oberschenkel parallel zum Boden, Knie verfolgt Zehenrichtung',
  },
  {
    id: 'kreuzheben',
    name: 'Kreuzheben',
    tags: ['lower', 'upper', 'gym', 'advanced'],
    defaultSets: 3,
    defaultReps: 6,
    defaultWeightKg: 100,
    stepSizeKg: 5,
    notes: 'Rücken gerade halten, Hüfte nach hinten schieben',
  },
  {
    id: 'klimmzuege',
    name: 'Klimmzüge',
    tags: ['upper', 'back-friendly', 'gym', 'home', 'bodyweight'],
    defaultSets: 3,
    defaultReps: 8,
    defaultWeightKg: null,
    stepSizeKg: 0,
    notes: 'Schulterblätter am Ende zusammenziehen, kontrolliertes Absenken',
  },
  {
    id: 'schulter_druecken',
    name: 'Schulterdrücken (Kurzhantel)',
    tags: ['upper', 'gym', 'home'],
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 16,
    stepSizeKg: 2,
    notes: 'Arme nicht vollständig strecken, Kernspannung halten',
  },
  {
    id: 'rudern_kh',
    name: 'Rudern (Kurzhantel, einarmig)',
    tags: ['upper', 'back-friendly', 'gym', 'home'],
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 20,
    stepSizeKg: 2,
    notes: 'Ellenbogen eng am Körper führen, Schulterblatt einziehen',
  },
  {
    id: 'bizeps_curl',
    name: 'Bizepscurl',
    tags: ['upper', 'gym', 'home', 'shoulder-friendly', 'beginner'],
    defaultSets: 3,
    defaultReps: 12,
    defaultWeightKg: 12,
    stepSizeKg: 2,
    notes: 'Ellenbogen fixiert, keine Schwungbewegung',
  },
  {
    id: 'trizeps_druecken',
    name: 'Trizepsdrücken (Kabelzug / Band)',
    tags: ['upper', 'gym', 'home', 'shoulder-friendly', 'beginner'],
    defaultSets: 3,
    defaultReps: 12,
    defaultWeightKg: 20,
    stepSizeKg: 2.5,
    notes: 'Ellenbogen fixiert seitlich am Körper, volle Streckung',
  },
  {
    id: 'ausfallschritte',
    name: 'Ausfallschritte (Kurzhantel)',
    tags: ['lower', 'knee-friendly', 'gym', 'home', 'beginner'],
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 12,
    stepSizeKg: 2,
    notes: 'Knie der vorderen Seite bleibt über dem Fuß, Rücken gerade',
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift (Kurzhantel)',
    tags: ['lower', 'back-friendly', 'gym', 'home'],
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: 20,
    stepSizeKg: 2.5,
    notes: 'Leicht gebeugte Knie, Hantel nah am Körper, Dehnung in den Oberschenkeln spüren',
  },
  {
    id: 'plank',
    name: 'Plank',
    tags: ['core', 'back-friendly', 'home', 'bodyweight', 'beginner'],
    defaultSets: 3,
    defaultReps: 60, // Sekunden
    defaultWeightKg: null,
    stepSizeKg: 0,
    notes: 'Körper gerade wie ein Brett, Gesäß nicht hochstrecken. Reps = Sekunden.',
  },
  {
    id: 'crunch',
    name: 'Crunch',
    tags: ['core', 'home', 'bodyweight', 'beginner'],
    defaultSets: 3,
    defaultReps: 20,
    defaultWeightKg: null,
    stepSizeKg: 0,
    notes: 'Nur der Oberkörper hebt sich, Lendenwirbel bleibt am Boden',
  },
  {
    id: 'burpees',
    name: 'Burpees',
    tags: ['cardio', 'core', 'home', 'bodyweight', 'advanced'],
    defaultSets: 3,
    defaultReps: 10,
    defaultWeightKg: null,
    stepSizeKg: 0,
    notes: 'Explosive Bewegung, Liegestütz am Boden optional für Anfänger',
  },
  {
    id: 'seilspringen',
    name: 'Seilspringen',
    tags: ['cardio', 'home', 'bodyweight', 'beginner'],
    defaultSets: 4,
    defaultReps: 60, // Sekunden
    defaultWeightKg: null,
    stepSizeKg: 0,
    notes: 'Gleichmäßiges Tempo, auf Zehenballen landen. Reps = Sekunden.',
  },
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    tags: ['lower', 'knee-friendly', 'core', 'gym', 'home', 'beginner'],
    defaultSets: 3,
    defaultReps: 12,
    defaultWeightKg: 16,
    stepSizeKg: 2,
    notes: 'Kurzhantel oder Kettlebell vor der Brust halten, tiefe Kniebeuge möglich',
  },
];

/**
 * Sucht eine Übung nach ID
 * Beispiel: getExerciseById('kniebeugen') -> Exercise { name: 'Kniebeugen', ... }
 */
export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find(e => e.id === id);
}

/**
 * Filtert Übungen nach Tags
 * Beispiel: getExercisesByTag('beginner') -> [bizeps_curl, ausfallschritte, ...]
 */
export function getExercisesByTag(tag: string): Exercise[] {
  return EXERCISES.filter(e => e.tags.includes(tag as any));
}
