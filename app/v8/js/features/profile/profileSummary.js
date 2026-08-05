const LABELS = {
  planningMode: { simple: 'einfach planen', macros: 'mit Kalorien und Makros' },
  goal: { lose: 'abnehmen', maintain: 'Gewicht halten', gain: 'zunehmen' },
  dietStyle: { omnivore: 'omnivor', vegetarian: 'vegetarisch', vegan: 'vegan', pescatarian: 'pescetarisch' },
  cookingStyle: { fresh: 'frisch kochen', meal_prep: 'Meal Prep', mixed: 'gemischt kochen' },
  simplicity: { simple: 'simpel', balanced: 'ausgewogen', experimental: 'experimentell' }
};

export function profileSummary(profile) {
  const enabledMeals = Object.entries(profile.enabledMeals || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => ({ breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack' }[key]))
    .filter(Boolean);

  const parts = [
    LABELS.planningMode[profile.planningMode],
    profile.goal ? LABELS.goal[profile.goal] : null,
    LABELS.dietStyle[profile.dietStyle],
    LABELS.cookingStyle[profile.cookingStyle],
    LABELS.simplicity[profile.simplicity],
    profile.maxCookingTime ? `maximal ${profile.maxCookingTime} Minuten` : null,
    profile.priorities?.length ? profile.priorities.join(', ') : null,
    enabledMeals.length ? enabledMeals.join(', ') : null,
    `${profile.persons || 1} ${Number(profile.persons) === 1 ? 'Person' : 'Personen'}`
  ];

  return parts.filter(Boolean).join(' · ');
}

export const buildProfileSummary = profileSummary;

export function shouldOfferPlanRefresh(previousProfile, nextProfile) {
  return JSON.stringify(previousProfile) !== JSON.stringify(nextProfile);
}
