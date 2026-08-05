import { LEGACY_STORE_KEY, createDefaultProfile, createPreferenceSignals } from '../data/contracts.js';

const V8_STATE_KEY = 'preply_v8_state_v1';
const LEGACY_BACKUP_KEY = 'preply_v7_backup_v1';

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

  try {
    localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(legacy));
  } catch (error) {
    console.warn('[Preply V8] V7-Sicherung konnte nicht gespeichert werden', error);
  }

  const migrated = migrateLegacyState(legacy);
  saveState(migrated);
  return migrated;
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

  migrated.preferences = {
    ...migrated.preferences,
    favoriteRecipeIds: Array.isArray(legacy.favoriteRecipeIds) ? legacy.favoriteRecipeIds : [],
    excludedRecipeIds: Array.isArray(legacy.excludedRecipeIds) ? legacy.excludedRecipeIds : [],
    excludedIngredients: Array.isArray(sourceProfile.excludedIngredients) ? sourceProfile.excludedIngredients : []
  };

  migrated.currentPlan = null;
  migrated.onboardingCompleted = Boolean(legacy.profile);
  migrated.migration = {
    source: LEGACY_STORE_KEY,
    backupKey: LEGACY_BACKUP_KEY,
    migratedAt: new Date().toISOString(),
    legacyPlanAvailable: Boolean(legacy.mealWeek)
  };
  return migrated;
}
