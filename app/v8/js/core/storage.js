import { LEGACY_STORE_KEY, createDefaultProfile, createPreferenceSignals } from '../data/contracts.js';

const V8_STATE_KEY = 'preply_v8_state_v1';

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('[Preply V8] Ungültiger lokaler Zustand', error);
    return null;
  }
}

export function createEmptyState() {
  return {
    schemaVersion: 10,
    profile: createDefaultProfile(),
    preferences: createPreferenceSignals(),
    currentPlan: null,
    planHistory: [],
    onboardingCompleted: false
  };
}

export function loadState() {
  const current = safeParse(localStorage.getItem(V8_STATE_KEY));
  if (current) return { ...createEmptyState(), ...current };

  const legacy = safeParse(localStorage.getItem(LEGACY_STORE_KEY));
  if (!legacy) return createEmptyState();

  return migrateLegacyState(legacy);
}

export function saveState(state) {
  localStorage.setItem(V8_STATE_KEY, JSON.stringify(state));
}

export function migrateLegacyState(legacy) {
  const migrated = createEmptyState();
  const sourceProfile = legacy.profile || {};

  migrated.profile = {
    ...migrated.profile,
    persons: Number(sourceProfile.persons || 1),
    calorieTarget: Number(sourceProfile.calorieTarget || sourceProfile.targetKcal || 0) || null,
    proteinTarget: Number(sourceProfile.proteinTargetG || sourceProfile.proteinTarget || 0) || null,
    maxCookingTime: Number(sourceProfile.maxCookingTime || 30),
    prepDays: [1, 2, 3].includes(Number(sourceProfile.prepDays)) ? Number(sourceProfile.prepDays) : 2
  };

  migrated.currentPlan = legacy.mealWeek || null;
  migrated.onboardingCompleted = Boolean(legacy.profile);
  migrated.migration = {
    source: LEGACY_STORE_KEY,
    migratedAt: new Date().toISOString()
  };
  return migrated;
}
