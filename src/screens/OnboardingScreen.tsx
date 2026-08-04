// Onboarding-Wizard: 5 Schritte zum Profil
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { colors, spacing, radius } from '../ui/theme';
import { useApp } from '../state/AppContext';
import {
  calcCalorieTarget,
  calcProteinTarget,
} from '../utils/nutritionUtils';
import type {
  UserProfile,
  Goal,
  FitnessLevel,
  Equipment,
  DietStyle,
  MealMode,
  InjuryTag,
} from '../types/profile';

// Verfügbare Optionen
const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'weightloss', label: 'Abnehmen' },
  { value: 'muscle', label: 'Muskelaufbau' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'energy', label: 'Energie' },
  { value: 'structure', label: 'Struktur' },
  { value: 'boxing', label: 'Boxen' },
  { value: 'rehab', label: 'Rehab' },
  { value: 'mobility', label: 'Mobility' },
];

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const TRAINING_TIMES: { value: 'morning' | 'afterwork' | 'evening'; label: string }[] = [
  { value: 'morning', label: 'Morgens' },
  { value: 'afterwork', label: 'Nach der Arbeit' },
  { value: 'evening', label: 'Abends' },
];

const DIET_OPTIONS: { value: DietStyle; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'nofish', label: 'Kein Fisch' },
  { value: 'nopork', label: 'Kein Schwein' },
];

const MEAL_MODE_OPTIONS: { value: MealMode; label: string }[] = [
  { value: 'general', label: 'Standard' },
  { value: 'diet', label: 'Diät' },
  { value: 'mass', label: 'Masse' },
];

const LEVEL_OPTIONS: { value: FitnessLevel; label: string }[] = [
  { value: 'beginner', label: 'Anfänger' },
  { value: 'intermediate', label: 'Fortgeschritten' },
  { value: 'advanced', label: 'Profi' },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'gym', label: 'Studio' },
  { value: 'home', label: 'Zuhause' },
  { value: 'bodyweight', label: 'Körpergewicht' },
  { value: 'dumbbells', label: 'Hanteln' },
  { value: 'running', label: 'Laufen' },
];

const INJURY_OPTIONS: { value: InjuryTag; label: string }[] = [
  { value: 'knee', label: 'Knie' },
  { value: 'shoulder', label: 'Schulter' },
  { value: 'back', label: 'Rücken' },
  { value: 'hip', label: 'Hüfte' },
];

export function OnboardingScreen() {
  const { setProfile, regenerate } = useApp();
  const [step, setStep] = useState(0);

  // Schritt 1: Basis
  const [name, setName] = useState('');
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('180');
  const [weightKg, setWeightKg] = useState('80');

  // Schritt 2: Ziele
  const [goals, setGoals] = useState<Goal[]>(['fitness']);

  // Schritt 3: Alltag
  const [wakeTime, setWakeTime] = useState('06:30');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workStart, setWorkStart] = useState('07:00');
  const [workEnd, setWorkEnd] = useState('15:00');
  const [preferredTrainingTime, setPreferredTrainingTime] =
    useState<'morning' | 'afterwork' | 'evening'>('afterwork');
  const [bufferAfterWork, setBufferAfterWork] = useState('30');

  // Schritt 4: Ernährung
  const [dietStyle, setDietStyle] = useState<DietStyle>('normal');
  const [mealMode, setMealMode] = useState<MealMode>('general');
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [snacksEnabled, setSnacksEnabled] = useState(true);
  const [allergies, setAllergies] = useState('');

  // Schritt 5: Training
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('intermediate');
  const [equipment, setEquipment] = useState<Equipment[]>(['gym']);
  const [injuries, setInjuries] = useState<InjuryTag[]>([]);

  // Hilfsfunktion: Multi-Select Toggle
  function toggleArr<T>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }

  function toggleWorkDay(day: number) {
    setWorkDays(d => (d.includes(day) ? d.filter(x => x !== day) : [...d, day]));
  }

  async function handleFinish() {
    // Profil zusammenbauen
    const ageNum = parseInt(age, 10) || 30;
    const heightNum = parseInt(heightCm, 10) || 180;
    const weightNum = parseFloat(weightKg) || 80;
    const bufferNum = parseInt(bufferAfterWork, 10) || 30;
    const allergyList = allergies
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    // Primäres Ziel für Kalorienberechnung
    const primaryGoal: Goal = goals[0] ?? 'fitness';
    const calorieTarget = calcCalorieTarget(weightNum, primaryGoal);
    const proteinTargetG = calcProteinTarget(weightNum);

    const profile: UserProfile = {
      id: `user_${Date.now()}`,
      name: name.trim() || 'Du',
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      goals,
      fitnessLevel,
      equipment,
      injuries,
      dietStyle,
      mealMode,
      allergies: allergyList,
      calorieTarget,
      proteinTargetG,
      shakeEnabled,
      barEnabled: false,
      snacksEnabled,
      wakeTime,
      sleepTime,
      preferredTrainingTime,
      workSchedule: {
        days: workDays,
        startTime: workStart,
        endTime: workEnd,
        isShiftWork: false,
      },
      bufferAfterWorkMin: bufferNum,
      guest: {
        active: false,
        name: '',
        calorieTarget: 0,
        proteinTarget: 0,
      },
      createdAt: new Date().toISOString(),
    };

    try {
      await setProfile(profile);
      await regenerate();
    } catch (e) {
      Alert.alert('Fehler', 'Plan konnte nicht erstellt werden.');
      console.warn(e);
    }
  }

  // Validierung pro Schritt
  function canProceed(): boolean {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return goals.length > 0;
    if (step === 4) return equipment.length > 0;
    return true;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Onboarding</Text>
          <Text style={styles.headerStep}>Schritt {step + 1} von 5</Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${((step + 1) / 5) * 100}%` }]}
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <View>
              <Text style={styles.title}>Basisdaten</Text>
              <Text style={styles.subtitle}>Erzähl uns kurz von dir.</Text>

              <Label text="Name" />
              <Input value={name} onChange={setName} placeholder="Dein Name" />

              <Label text="Alter" />
              <Input
                value={age}
                onChange={setAge}
                placeholder="30"
                keyboardType="number-pad"
              />

              <Label text="Größe (cm)" />
              <Input
                value={heightCm}
                onChange={setHeightCm}
                placeholder="180"
                keyboardType="number-pad"
              />

              <Label text="Gewicht (kg)" />
              <Input
                value={weightKg}
                onChange={setWeightKg}
                placeholder="80"
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.title}>Deine Ziele</Text>
              <Text style={styles.subtitle}>Wähle alles, was passt.</Text>
              <View style={styles.chipWrap}>
                {GOAL_OPTIONS.map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={goals.includes(opt.value)}
                    onPress={() => setGoals(g => toggleArr(g, opt.value))}
                  />
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>Dein Alltag</Text>
              <Text style={styles.subtitle}>
                Wann arbeitest du, wann schläfst du?
              </Text>

              <Label text="Aufstehzeit" />
              <Input
                value={wakeTime}
                onChange={setWakeTime}
                placeholder="06:30"
              />

              <Label text="Schlafenszeit" />
              <Input
                value={sleepTime}
                onChange={setSleepTime}
                placeholder="22:30"
              />

              <Label text="Arbeitstage" />
              <View style={styles.chipWrap}>
                {WEEKDAYS.map((d, i) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={workDays.includes(i)}
                    onPress={() => toggleWorkDay(i)}
                  />
                ))}
              </View>

              <Label text="Arbeitsstart" />
              <Input
                value={workStart}
                onChange={setWorkStart}
                placeholder="07:00"
              />

              <Label text="Arbeitsende" />
              <Input
                value={workEnd}
                onChange={setWorkEnd}
                placeholder="15:00"
              />

              <Label text="Bevorzugte Trainingszeit" />
              <View style={styles.chipWrap}>
                {TRAINING_TIMES.map(t => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    selected={preferredTrainingTime === t.value}
                    onPress={() => setPreferredTrainingTime(t.value)}
                  />
                ))}
              </View>

              <Label text="Puffer nach Arbeit (Minuten)" />
              <Input
                value={bufferAfterWork}
                onChange={setBufferAfterWork}
                placeholder="30"
                keyboardType="number-pad"
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Ernährung</Text>
              <Text style={styles.subtitle}>So sollen deine Mahlzeiten sein.</Text>

              <Label text="Ernährungsstil" />
              <View style={styles.chipWrap}>
                {DIET_OPTIONS.map(d => (
                  <Chip
                    key={d.value}
                    label={d.label}
                    selected={dietStyle === d.value}
                    onPress={() => setDietStyle(d.value)}
                  />
                ))}
              </View>

              <Label text="Modus" />
              <View style={styles.chipWrap}>
                {MEAL_MODE_OPTIONS.map(m => (
                  <Chip
                    key={m.value}
                    label={m.label}
                    selected={mealMode === m.value}
                    onPress={() => setMealMode(m.value)}
                  />
                ))}
              </View>

              <Label text="Proteinshake aktiv" />
              <View style={styles.chipWrap}>
                <Chip
                  label="Ja"
                  selected={shakeEnabled}
                  onPress={() => setShakeEnabled(true)}
                />
                <Chip
                  label="Nein"
                  selected={!shakeEnabled}
                  onPress={() => setShakeEnabled(false)}
                />
              </View>

              <Label text="Snacks erlaubt" />
              <View style={styles.chipWrap}>
                <Chip
                  label="Ja"
                  selected={snacksEnabled}
                  onPress={() => setSnacksEnabled(true)}
                />
                <Chip
                  label="Nein"
                  selected={!snacksEnabled}
                  onPress={() => setSnacksEnabled(false)}
                />
              </View>

              <Label text="Allergien (Komma-getrennt)" />
              <Input
                value={allergies}
                onChange={setAllergies}
                placeholder="z.B. Nüsse, Laktose"
              />
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.title}>Training</Text>
              <Text style={styles.subtitle}>Letzter Schritt!</Text>

              <Label text="Fitness-Level" />
              <View style={styles.chipWrap}>
                {LEVEL_OPTIONS.map(l => (
                  <Chip
                    key={l.value}
                    label={l.label}
                    selected={fitnessLevel === l.value}
                    onPress={() => setFitnessLevel(l.value)}
                  />
                ))}
              </View>

              <Label text="Equipment" />
              <View style={styles.chipWrap}>
                {EQUIPMENT_OPTIONS.map(e => (
                  <Chip
                    key={e.value}
                    label={e.label}
                    selected={equipment.includes(e.value)}
                    onPress={() =>
                      setEquipment(eq => toggleArr(eq, e.value))
                    }
                  />
                ))}
              </View>

              <Label text="Verletzungen" />
              <View style={styles.chipWrap}>
                {INJURY_OPTIONS.map(i => (
                  <Chip
                    key={i.value}
                    label={i.label}
                    selected={injuries.includes(i.value)}
                    onPress={() => setInjuries(inj => toggleArr(inj, i.value))}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <Button
              title="Zurück"
              variant="secondary"
              onPress={() => setStep(s => s - 1)}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
          )}
          {step < 4 ? (
            <Button
              title="Weiter"
              onPress={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              title="Plan erstellen"
              onPress={handleFinish}
              disabled={!canProceed()}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Kleine Hilfs-Komponenten innerhalb der Datei ---

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}

function Input({ value, onChange, placeholder, keyboardType = 'default' }: InputProps) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerStep: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
