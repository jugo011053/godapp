/* Energiebedarf nach Mifflin-St Jeor — der heute gebraeuchliche Standard,
   genauer als Harris-Benedict und ohne Koerperfettmessung auskommend.
   Alles hier ist reine Rechnung ohne Zustand, damit es pruefbar bleibt. */

export const SEXES = Object.freeze([
  ['female', 'Weiblich'],
  ['male', 'Männlich'],
  ['diverse', 'Divers']
]);

/* Aktivitaetsfaktoren nach WHO/FAO. Die Beschreibungen sind wichtiger als
   die Zahlen — niemand weiss, ob er "moderat aktiv" ist. */
export const ACTIVITY_LEVELS = Object.freeze([
  ['sedentary', 'Kaum', 'Sitzender Beruf, wenig Sport', 1.3],
  ['light', 'Etwas', 'Leichte Bewegung, 1–2× Sport', 1.45],
  ['moderate', 'Regelmäßig', '3–5× Sport pro Woche', 1.6],
  ['high', 'Viel', 'Täglich aktiv oder körperliche Arbeit', 1.8]
]);

export const GOALS = Object.freeze([
  ['lose', 'Abnehmen', 'Etwa 0,5 kg pro Woche', -0.18],
  ['maintain', 'Gewicht halten', 'Bedarf decken', 0],
  ['gain', 'Aufbauen', 'Langsam und sauber zunehmen', 0.12]
]);

export const BODY_LIMITS = Object.freeze({
  age: { min: 16, max: 90, step: 1, unit: 'Jahre', fallback: 30 },
  height: { min: 140, max: 210, step: 1, unit: 'cm', fallback: 175 },
  weight: { min: 40, max: 160, step: 1, unit: 'kg', fallback: 75 }
});

function clamp(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function activityFactor(key) {
  return ACTIVITY_LEVELS.find(([id]) => id === key)?.[3] ?? 1.45;
}

export function goalAdjustment(key) {
  return GOALS.find(([id]) => id === key)?.[3] ?? 0;
}

/* Grundumsatz: was der Koerper in voelliger Ruhe verbraucht. */
export function basalRate({ sex, age, height, weight } = {}) {
  const a = clamp(age, BODY_LIMITS.age);
  const h = clamp(height, BODY_LIMITS.height);
  const w = clamp(weight, BODY_LIMITS.weight);
  const base = 10 * w + 6.25 * h - 5 * a;
  /* Mifflin-St Jeor kennt nur zwei Konstanten. Fuer "divers" nehmen wir die
     Mitte, statt jemanden in eine Kategorie zu zwingen. */
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78;
}

/* Gesamtumsatz: Grundumsatz mal Bewegung. */
export function dailyEnergy(body = {}) {
  return basalRate(body) * activityFactor(body.activity);
}

/* Tagesziel inklusive Zielkorrektur, auf 10 kcal gerundet. */
export function calorieTargetFor(body = {}, goal = 'maintain') {
  const target = dailyEnergy(body) * (1 + goalAdjustment(goal));
  /* Unter 1200 kcal wird keine sinnvolle Wochenplanung mehr daraus. */
  return Math.max(1200, Math.round(target / 10) * 10);
}

/* Protein pro Tag. Beim Abnehmen hoeher, um Muskeln zu halten. */
export function proteinTargetFor(body = {}, goal = 'maintain') {
  const weight = clamp(body.weight, BODY_LIMITS.weight);
  const perKilo = goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6;
  return Math.round(weight * perKilo);
}

export function hasBodyData(profile = {}) {
  return Boolean(profile.sex && profile.age && profile.height && profile.weight);
}

/* Kurze Begruendung fuer die Anzeige — die Zahl soll nicht vom Himmel fallen. */
export function explainTarget(body = {}, goal = 'maintain') {
  const basal = Math.round(basalRate(body));
  const total = Math.round(dailyEnergy(body));
  const label = GOALS.find(([id]) => id === goal)?.[1] || 'Gewicht halten';
  return `Grundumsatz ${basal} kcal, mit Bewegung ${total} kcal, angepasst fürs Ziel „${label}“.`;
}
