// Globaler App-State: Profil, MealCycle, TrainingWeek, Timeline
// Lädt aus AsyncStorage und bietet Setter mit Persistenz

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile } from '../types/profile';
import type { MealCycle } from '../types/meal';
import type { TrainingWeek } from '../types/training';
import type { WeekTimeline } from '../types/timeline';
import {
  loadProfile,
  saveProfile,
  loadMealCycle,
  saveMealCycle,
  loadTrainingWeek,
  saveTrainingWeek,
  loadTimeline,
  saveTimeline,
  clearAll,
} from '../storage/store';
import { buildMealCycle } from '../engines/MealPrepEngine';
import { buildTrainingWeek } from '../engines/TrainingEngine';
import { buildWeek } from '../engines/TimelineEngine';
import { RECIPES } from '../data/recipes';

// Liefert den Montag der aktuellen Woche als ISO-Datum
export function getMondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sonntag
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

interface AppContextValue {
  profile: UserProfile | null;
  mealCycle: MealCycle | null;
  trainingWeek: TrainingWeek | null;
  timeline: WeekTimeline | null;
  loading: boolean;
  setProfile: (p: UserProfile) => Promise<void>;
  setMealCycle: (m: MealCycle) => Promise<void>;
  setTrainingWeek: (t: TrainingWeek) => Promise<void>;
  setTimeline: (t: WeekTimeline) => Promise<void>;
  regenerate: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [mealCycle, setMealCycleState] = useState<MealCycle | null>(null);
  const [trainingWeek, setTrainingWeekState] = useState<TrainingWeek | null>(null);
  const [timeline, setTimelineState] = useState<WeekTimeline | null>(null);
  const [loading, setLoading] = useState(true);

  // Initiales Laden aus Storage
  useEffect(() => {
    (async () => {
      try {
        const p = await loadProfile();
        if (p) {
          setProfileState(p);
          const weekStart = getMondayOfWeek();
          const today = todayISO();
          const mc = await loadMealCycle(today);
          if (mc) setMealCycleState(mc);
          const tw = await loadTrainingWeek(weekStart);
          if (tw) setTrainingWeekState(tw);
          const tl = await loadTimeline(weekStart);
          if (tl) setTimelineState(tl);
        }
      } catch (e) {
        console.warn('Fehler beim Laden:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    await saveProfile(p);
  }, []);

  const setMealCycle = useCallback(async (m: MealCycle) => {
    setMealCycleState(m);
    await saveMealCycle(m);
  }, []);

  const setTrainingWeek = useCallback(async (t: TrainingWeek) => {
    setTrainingWeekState(t);
    await saveTrainingWeek(t);
  }, []);

  const setTimeline = useCallback(async (t: WeekTimeline) => {
    setTimelineState(t);
    await saveTimeline(t);
  }, []);

  // Komplettes Neugenerieren von MealCycle, TrainingWeek und Timeline
  const regenerate = useCallback(async () => {
    if (!profile) return;
    const today = todayISO();
    const weekStart = getMondayOfWeek();

    const newMealCycle = buildMealCycle(today, profile, RECIPES);
    const newTrainingWeek = buildTrainingWeek(weekStart, profile, []);
    const newTimeline = buildWeek(weekStart, profile, newMealCycle, newTrainingWeek);

    setMealCycleState(newMealCycle);
    setTrainingWeekState(newTrainingWeek);
    setTimelineState(newTimeline);
    await Promise.all([
      saveMealCycle(newMealCycle),
      saveTrainingWeek(newTrainingWeek),
      saveTimeline(newTimeline),
    ]);
  }, [profile]);

  const resetAll = useCallback(async () => {
    await clearAll();
    setProfileState(null);
    setMealCycleState(null);
    setTrainingWeekState(null);
    setTimelineState(null);
  }, []);

  const value: AppContextValue = {
    profile,
    mealCycle,
    trainingWeek,
    timeline,
    loading,
    setProfile,
    setMealCycle,
    setTrainingWeek,
    setTimeline,
    regenerate,
    resetAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
