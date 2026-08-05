import { createDefaultProfile } from '../../data/contracts.js';

export const ONBOARDING_STEPS = Object.freeze([
  'planningMode',
  'goal',
  'diet',
  'restrictions',
  'meals',
  'cooking',
  'simplicity',
  'priorities',
  'details',
  'summary'
]);

export function createOnboardingDraft(profile = createDefaultProfile()) {
  return {
    stepIndex: 0,
    profile: structuredClone(profile),
    completed: false
  };
}

export function currentStep(draft) {
  return ONBOARDING_STEPS[draft.stepIndex] || 'summary';
}

export function updateDraft(draft, patch) {
  return {
    ...draft,
    profile: {
      ...draft.profile,
      ...patch,
      enabledMeals: patch.enabledMeals
        ? { ...draft.profile.enabledMeals, ...patch.enabledMeals }
        : draft.profile.enabledMeals
    }
  };
}

export function nextStep(draft) {
  return { ...draft, stepIndex: Math.min(draft.stepIndex + 1, ONBOARDING_STEPS.length - 1) };
}

export function previousStep(draft) {
  return { ...draft, stepIndex: Math.max(draft.stepIndex - 1, 0) };
}

export function completeOnboarding(draft) {
  return { ...draft, completed: true, stepIndex: ONBOARDING_STEPS.length - 1 };
}

export function validateOnboardingStep(draft) {
  const step = currentStep(draft);
  const profile = draft.profile;

  if (step === 'meals' && !Object.values(profile.enabledMeals).some(Boolean)) {
    return 'Wähle mindestens eine Mahlzeit aus.';
  }
  if (step === 'details' && (!Number.isFinite(Number(profile.persons)) || Number(profile.persons) < 1)) {
    return 'Die Personenzahl muss mindestens 1 sein.';
  }
  return null;
}
