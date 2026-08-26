import { createDefaultProfile } from '../../data/contracts.js';
import { ONBOARDING_STEPS, styleSettings } from './onboardingSteps.js';
import { calorieTargetFor, proteinTargetFor, BODY_LIMITS } from './nutrition.js';

export { ONBOARDING_STEPS };

export function createOnboardingDraft(profile = createDefaultProfile()) {
  const base = createDefaultProfile();
  return {
    stepIndex: 0,
    /* Vorbelegen mit sinnvollen Mitten, damit kein Regler bei null steht und
       der Nutzer sofort eine plausible Zahl sieht. */
    profile: {
      ...base,
      ...structuredClone(profile || {}),
      age: profile?.age ?? BODY_LIMITS.age.fallback,
      height: profile?.height ?? BODY_LIMITS.height.fallback,
      weight: profile?.weight ?? BODY_LIMITS.weight.fallback,
      activity: profile?.activity ?? 'light',
      style: profile?.style ?? 'balanced',
      persons: Math.max(1, Number(profile?.persons) || 1)
    },
    completed: false
  };
}

export function currentStep(draft) {
  return ONBOARDING_STEPS[draft.stepIndex] || ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
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

export function isLastStep(draft) {
  return draft.stepIndex >= ONBOARDING_STEPS.length - 1;
}

/* Am Ende wird aus Koerperdaten, Ziel und Stil ein fertiges Profil —
   der Nutzer hat nie eine Kalorienzahl eingetippt. */
export function completeOnboarding(draft) {
  const p = draft.profile;
  const settings = styleSettings(p.style);
  return {
    ...draft,
    completed: true,
    stepIndex: ONBOARDING_STEPS.length - 1,
    profile: {
      ...p,
      ...settings,
      calorieTarget: calorieTargetFor(p, p.goal || 'maintain'),
      proteinTarget: proteinTargetFor(p, p.goal || 'maintain'),
      persons: Math.max(1, Number(p.persons) || 1)
    }
  };
}

export function validateOnboardingStep(draft) {
  const step = currentStep(draft);
  const p = draft.profile;
  if (step === 'body' && !p.sex) return 'Bitte wähle eine Angabe, damit wir rechnen können.';
  if (step === 'goal' && !p.goal) return 'Bitte wähle ein Ziel.';
  if (step === 'diet' && !p.dietStyle) return 'Bitte wähle eine Ernährungsweise.';
  if (step === 'style') {
    if (!p.style) return 'Bitte wähle, wie es laufen soll.';
    if (!Object.values(p.enabledMeals || {}).some(Boolean)) return 'Wähle mindestens eine Mahlzeit.';
  }
  return null;
}
