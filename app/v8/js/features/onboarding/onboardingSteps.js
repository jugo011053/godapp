export const STEP_DEFINITIONS = Object.freeze({
  planningMode: {
    title: 'Wie möchtest du planen?',
    options: [
      { value: 'simple', label: 'Einfach planen', description: 'Die App rechnet grob im Hintergrund.' },
      { value: 'macros', label: 'Mit Kalorien und Makros', description: 'Ziele und Nährwerte bleiben sichtbar.' }
    ]
  },
  goal: {
    title: 'Was ist dein Ziel?',
    options: [
      { value: null, label: 'Kein konkretes Ziel' },
      { value: 'lose', label: 'Abnehmen' },
      { value: 'maintain', label: 'Gewicht halten' },
      { value: 'gain', label: 'Zunehmen' }
    ]
  },
  diet: {
    title: 'Wie ernährst du dich?',
    options: [
      { value: 'omnivore', label: 'Omnivor' },
      { value: 'vegetarian', label: 'Vegetarisch' },
      { value: 'vegan', label: 'Vegan' },
      { value: 'pescatarian', label: 'Pescetarisch' }
    ]
  },
  cooking: {
    title: 'Wie möchtest du kochen?',
    options: [
      { value: 'fresh', label: 'Frisch kochen' },
      { value: 'meal_prep', label: 'Meal Prep' },
      { value: 'mixed', label: 'Gemischt' }
    ]
  },
  simplicity: {
    title: 'Wie ausgefallen darf es sein?',
    options: [
      { value: 'simple', label: 'Simpel', description: 'Bekannte Zutaten, wenig Schritte, meist unter 30 Minuten.' },
      { value: 'balanced', label: 'Ausgewogen', description: 'Mischung aus einfachen und abwechslungsreichen Rezepten.' },
      { value: 'experimental', label: 'Experimentell', description: 'Mehr internationale und ungewöhnliche Gerichte.' }
    ]
  },
  priorities: {
    title: 'Was ist dir besonders wichtig?',
    multiple: true,
    options: [
      { value: 'high_protein', label: 'Proteinreich' },
      { value: 'quick', label: 'Schnell' },
      { value: 'budget', label: 'Günstig' },
      { value: 'meal_prep', label: 'Meal Prep' },
      { value: 'varied', label: 'Abwechslungsreich' }
    ]
  }
});

export const MEAL_OPTIONS = Object.freeze([
  ['breakfast', 'Frühstück'],
  ['lunch', 'Mittagessen'],
  ['dinner', 'Abendessen'],
  ['snack', 'Snack']
]);
