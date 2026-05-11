// Persistenz-Schicht: AsyncStorage Wrapper für alle App-Daten
// Alle Funktionen sind async und geben typisierte Daten zurück

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '../types/profile';
import type { WeekTimeline } from '../types/timeline';
import type { MealCycle } from '../types/meal';
import type { TrainingWeek, ProgressionEntry } from '../types/training';

// Storage-Schlüssel (zentral definiert, kein Magic-String-Chaos)
const KEYS = {
  PROFILE:             'godapp_profile',
  TIMELINE_PREFIX:     'godapp_timeline_',  // + weekStart-Datum
  MEAL_CYCLE_PREFIX:   'godapp_mealcycle_', // + cycleStart-Datum
  TRAINING_WEEK_PREFIX:'godapp_trainweek_', // + weekStart-Datum
  PROGRESSION_PREFIX:  'godapp_progression_', // + exerciseId
} as const;

// --- PROFIL ---

/**
 * Speichert das Nutzerprofil
 * Beispiel: await saveProfile(myProfile)
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

/**
 * Lädt das Nutzerprofil, oder null wenn noch keins existiert
 * Beispiel: const profile = await loadProfile()
 */
export async function loadProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.PROFILE);
  if (!raw) return null;
  return JSON.parse(raw) as UserProfile;
}

// --- TIMELINE ---

/**
 * Speichert einen Wochenplan (Schlüssel = weekStart-Datum)
 * Beispiel: await saveTimeline(weekTimeline)
 */
export async function saveTimeline(timeline: WeekTimeline): Promise<void> {
  const key = KEYS.TIMELINE_PREFIX + timeline.weekStart;
  await AsyncStorage.setItem(key, JSON.stringify(timeline));
}

/**
 * Lädt einen Wochenplan nach Startdatum, oder null
 * Beispiel: const timeline = await loadTimeline("2024-01-15")
 */
export async function loadTimeline(weekStart: string): Promise<WeekTimeline | null> {
  const key = KEYS.TIMELINE_PREFIX + weekStart;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as WeekTimeline;
}

// --- MEAL CYCLE ---

/**
 * Speichert einen Meal-Zyklus
 * Beispiel: await saveMealCycle(mealCycle)
 */
export async function saveMealCycle(cycle: MealCycle): Promise<void> {
  const key = KEYS.MEAL_CYCLE_PREFIX + cycle.cycleStart;
  await AsyncStorage.setItem(key, JSON.stringify(cycle));
}

/**
 * Lädt einen Meal-Zyklus nach Startdatum, oder null
 * Beispiel: const cycle = await loadMealCycle("2024-01-15")
 */
export async function loadMealCycle(cycleStart: string): Promise<MealCycle | null> {
  const key = KEYS.MEAL_CYCLE_PREFIX + cycleStart;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as MealCycle;
}

// --- TRAININGSWOCHE ---

/**
 * Speichert eine Trainingswoche
 * Beispiel: await saveTrainingWeek(trainingWeek)
 */
export async function saveTrainingWeek(week: TrainingWeek): Promise<void> {
  const key = KEYS.TRAINING_WEEK_PREFIX + week.weekStart;
  await AsyncStorage.setItem(key, JSON.stringify(week));
}

/**
 * Lädt eine Trainingswoche nach Startdatum, oder null
 * Beispiel: const week = await loadTrainingWeek("2024-01-15")
 */
export async function loadTrainingWeek(weekStart: string): Promise<TrainingWeek | null> {
  const key = KEYS.TRAINING_WEEK_PREFIX + weekStart;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as TrainingWeek;
}

// --- PROGRESSIONSVERLAUF ---

/**
 * Speichert den gesamten Progressionsverlauf einer Übung
 * Beispiel: await saveProgressionHistory('kniebeugen', [entry1, entry2])
 */
export async function saveProgressionHistory(
  exerciseId: string,
  history: ProgressionEntry[]
): Promise<void> {
  const key = KEYS.PROGRESSION_PREFIX + exerciseId;
  await AsyncStorage.setItem(key, JSON.stringify(history));
}

/**
 * Lädt den Progressionsverlauf einer Übung, oder leeres Array
 * Beispiel: const history = await loadProgressionHistory('kniebeugen')
 */
export async function loadProgressionHistory(
  exerciseId: string
): Promise<ProgressionEntry[]> {
  const key = KEYS.PROGRESSION_PREFIX + exerciseId;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw) as ProgressionEntry[];
}

/**
 * Hängt einen neuen Progressionseintrag an die History an
 * Beispiel: await appendProgressionEntry('kniebeugen', newEntry)
 */
export async function appendProgressionEntry(
  exerciseId: string,
  entry: ProgressionEntry
): Promise<void> {
  const history = await loadProgressionHistory(exerciseId);
  history.push(entry);
  await saveProgressionHistory(exerciseId, history);
}

// --- RESET ---

/**
 * Löscht alle App-Daten (für Onboarding-Reset oder Tests)
 * Beispiel: await clearAll()
 */
export async function clearAll(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const appKeys = allKeys.filter(k => k.startsWith('godapp_'));
  if (appKeys.length > 0) {
    // multiRemove nicht in allen Versionen verfügbar -> einzeln löschen
    await Promise.all(appKeys.map(k => AsyncStorage.removeItem(k)));
  }
}
