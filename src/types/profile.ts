// Profil-Typen für den Nutzer und seinen Gast

export type Goal =
  | 'weightloss' | 'muscle' | 'fitness' | 'energy'
  | 'structure' | 'boxing' | 'football' | 'tennis'
  | 'rehab' | 'mobility';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'gym' | 'home' | 'bodyweight' | 'dumbbells' | 'running';
export type DietStyle = 'normal' | 'vegetarian' | 'nofish' | 'nopork';
export type MealMode = 'general' | 'diet' | 'mass';
export type InjuryTag = 'knee' | 'shoulder' | 'back' | 'hip';

// Arbeitszeiten des Nutzers inkl. Schichtarbeit
export interface WorkSchedule {
  days: number[];       // 0=Sonntag, 1=Montag ... 6=Samstag
  startTime: string;    // z.B. "07:00"
  endTime: string;      // z.B. "15:00"
  isShiftWork: boolean; // Wechselschicht -> Zeiten können variieren
}

// Gastprofil (z.B. Partner, der mitisst)
export interface GuestProfile {
  active: boolean;
  name: string;
  calorieTarget: number;
  proteinTarget: number;
}

// Hauptprofil des Nutzers
export interface UserProfile {
  id: string;
  name: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goals: Goal[];
  fitnessLevel: FitnessLevel;
  equipment: Equipment[];
  injuries: InjuryTag[];
  dietStyle: DietStyle;
  mealMode: MealMode;
  allergies: string[];
  calorieTarget: number | null;   // null = automatisch berechnen
  proteinTargetG: number | null;  // null = auto (1.8 * Gewicht)
  shakeEnabled: boolean;          // Proteinshakes erlaubt
  barEnabled: boolean;            // Proteinriegel erlaubt
  snacksEnabled: boolean;         // Zwischenmahlzeiten erlaubt
  wakeTime: string;               // "06:30"
  sleepTime: string;              // "22:30"
  preferredTrainingTime: 'morning' | 'afterwork' | 'evening';
  workSchedule: WorkSchedule;
  bufferAfterWorkMin: number;     // Puffer nach Arbeit in Minuten, Standard 30
  guest: GuestProfile;
  createdAt: string;              // ISO-Datum
}
