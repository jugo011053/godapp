import { createDefaultProfile, createPreferenceSignals } from './data/contracts.js';
import { emit } from './core/events.js';

export const runtime = {
  profile: createDefaultProfile(),
  preferences: createPreferenceSignals(),
  currentPlan: null,
  initializedAt: new Date().toISOString()
};

window.PreplyV8 = Object.freeze({
  getRuntime: () => structuredClone(runtime)
});

emit('app:ready', runtime);
console.info('[Preply V8] Foundation geladen.');
