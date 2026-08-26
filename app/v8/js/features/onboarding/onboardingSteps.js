import { SEXES, ACTIVITY_LEVELS, GOALS, BODY_LIMITS } from './nutrition.js';

export { SEXES, ACTIVITY_LEVELS, GOALS, BODY_LIMITS };

/* Vier Bildschirme statt zehn. Nicht weil weniger gefragt wird, sondern weil
   Zusammengehoeriges auf einer Flaeche steht — was sich lang anfuehlt, sind
   Bildschirmwechsel, nicht die Menge der Angaben. */
export const ONBOARDING_STEPS = Object.freeze(['body', 'goal', 'diet', 'style']);

export const STEP_TITLES = Object.freeze({
  body:  { title: 'Erst mal zu dir', copy: 'Daraus rechnen wir deinen Tagesbedarf aus.' },
  goal:  { title: 'Was ist dein Ziel?', copy: 'Wir passen die Portionen daran an.' },
  diet:  { title: 'Wie isst du?', copy: 'Was hier nicht reinsoll, taucht nie im Plan auf.' },
  style: { title: 'Wie soll es laufen?', copy: 'Das lässt sich später jederzeit ändern.' }
});

export const DIET_OPTIONS = Object.freeze([
  ['omnivore', 'Mischkost', 'Alles dabei'],
  ['vegetarian', 'Vegetarisch', 'Ohne Fleisch und Fisch'],
  ['vegan', 'Vegan', 'Rein pflanzlich'],
  ['pescatarian', 'Pescetarisch', 'Fisch ja, Fleisch nein']
]);

/* Senf, Sellerie und Sulfite kommen im Katalog vor (40 / 21 / 7 Rezepte),
   waren aber nicht auswaehlbar — betroffene Personen konnten sie nicht
   ausschliessen. Sellerie und Senf gehoeren zu den 14 EU-Hauptallergenen. */
export const ALLERGEN_OPTIONS = Object.freeze([
  ['gluten', 'Gluten'], ['dairy', 'Milch'], ['eggs', 'Eier'],
  ['nuts', 'Nüsse'], ['soy', 'Soja'], ['fish', 'Fisch'],
  ['shellfish', 'Schalentiere'], ['sesame', 'Sesam'],
  ['mustard', 'Senf'], ['celery', 'Sellerie'], ['sulphites', 'Sulfite']
]);

/* Der Stil ist die dauerhafte Grundhaltung — im Gegensatz zu den Richtungen,
   die eine einzelne Neuplanung korrigieren. Beide greifen auf dieselben
   Achsen zu, nur mit unterschiedlicher Haltbarkeit. */
/* prepDays gehoert zu jedem Stil dazu, nicht nur zu "Meal Prep". Vorher
   stand ueberall der Standardwert 2 — "Abwechslungsreich" wiederholte damit
   jedes Gericht zwei Tage lang und widersprach seinem eigenen Namen. */
export const STYLE_OPTIONS = Object.freeze([
  ['easy',     'Einfach & schnell', 'Wenig Zutaten, meist unter 30 Minuten',
   { simplicity: 'simple', priorities: ['quick'], maxCookingTime: 30, cookingStyle: 'mixed', prepDays: 2 }],
  ['balanced', 'Ausgewogen', 'Gute Mischung aus schnell und besonders',
   { simplicity: 'balanced', priorities: [], maxCookingTime: 45, cookingStyle: 'mixed', prepDays: 2 }],
  ['protein',  'Proteinreich', 'Mehr Eiweiß in jeder Mahlzeit',
   { simplicity: 'balanced', priorities: ['high_protein'], maxCookingTime: 45, cookingStyle: 'mixed', prepDays: 2 }],
  ['budget',   'Günstig', 'Preiswerte Zutaten, große Portionen',
   { simplicity: 'simple', priorities: ['budget'], maxCookingTime: 40, cookingStyle: 'mixed', prepDays: 2 }],
  ['prep',     'Meal Prep', 'Einmal kochen, drei Tage essen',
   { simplicity: 'balanced', priorities: ['meal_prep'], cookingStyle: 'meal_prep', maxCookingTime: 60, prepDays: 3 }],
  ['varied',   'Abwechslungsreich', 'Jeden Tag etwas anderes',
   { simplicity: 'experimental', priorities: ['varied'], maxCookingTime: 60, cookingStyle: 'fresh', prepDays: 1 }]
]);

export function styleSettings(key) {
  return STYLE_OPTIONS.find(([id]) => id === key)?.[3] || STYLE_OPTIONS[1][3];
}

export const MEAL_OPTIONS = Object.freeze([
  ['breakfast', 'Frühstück'],
  ['lunch', 'Mittagessen'],
  ['dinner', 'Abendessen'],
  ['snack', 'Snack']
]);

/* Bleibt fuer den Profil-Editor erhalten. */
export const STEP_DEFINITIONS = Object.freeze({});
