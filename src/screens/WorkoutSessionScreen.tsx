// Workout-Session-Screen: Aktiver Trainingsablauf mit Sätzen, Rating, Rest-Timer
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../state/AppContext';
import { colors, spacing, radius } from '../ui/theme';
import { Button } from '../ui/Button';
import { getExerciseById } from '../data/exercises';
import { WORKOUT_TEMPLATES } from '../data/workoutTemplates';
import { buildProgressionEntry } from '../engines/TrainingEngine';
import {
  appendProgressionEntry,
  loadProgressionHistory,
} from '../storage/store';
import type {
  WorkoutSlot,
  WorkoutSet,
  TrainingWeek,
} from '../types/training';
import type { TrainingStackParamList } from '../navigation/MainTabs';

type NavProp = NativeStackNavigationProp<TrainingStackParamList, 'WorkoutSession'>;
type RouteP = RouteProp<TrainingStackParamList, 'WorkoutSession'>;

type Phase = 'warmup' | 'exercise' | 'done';

// Rating-Skala mit Beschriftungen
const RATING_DESCRIPTIONS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Viel zu schwer',
  2: 'Schwer',
  3: 'Passend',
  4: 'Leicht',
  5: 'Sehr leicht',
};

export function WorkoutSessionScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteP>();
  const { slotId } = route.params;
  const { trainingWeek, setTrainingWeek } = useApp();

  const slot: WorkoutSlot | undefined = trainingWeek?.slots.find(
    s => s.id === slotId,
  );

  // Rest-Dauer aus Template (falls vorhanden)
  const restMinFromTemplate = useMemo(() => {
    if (!slot) return 2;
    const tpl = WORKOUT_TEMPLATES.find(t => t.type === slot.type);
    return tpl?.restBetweenSetsMin ?? 2;
  }, [slot]);

  // Tiefe Kopie der Sätze, die lokal mutiert werden
  const [exercises, setExercises] = useState<
    Array<{ exerciseId: string; sets: WorkoutSet[] }>
  >(() =>
    slot
      ? slot.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets.map(s => ({ ...s })),
        }))
      : [],
  );

  const [phase, setPhase] = useState<Phase>('warmup');
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [setDone, setSetDone] = useState(false); // True nach "Satz erledigt", zeigt Rating
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest-Timer
  useEffect(() => {
    if (restRunning && restSeconds > 0) {
      restTimerRef.current = setInterval(() => {
        setRestSeconds(s => {
          if (s <= 1) {
            setRestRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [restRunning, restSeconds]);

  if (!slot) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Workout nicht gefunden.</Text>
        <View style={{ padding: spacing.lg }}>
          <Button title="Zurück" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  if (exercises.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Dieses Workout hat keine Übungen.</Text>
        <View style={{ padding: spacing.lg }}>
          <Button title="Zurück" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const currentExercise = exercises[exerciseIdx];
  const currentExerciseDef = getExerciseById(currentExercise.exerciseId);
  const currentSet = currentExercise.sets[setIdx];

  // Aktualisiere ein Feld am aktuellen Satz
  function updateSet(patch: Partial<WorkoutSet>) {
    setExercises(prev => {
      const next = prev.map((ex, i) => {
        if (i !== exerciseIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, j) =>
            j === setIdx ? { ...s, ...patch } : s,
          ),
        };
      });
      return next;
    });
  }

  function adjustWeight(delta: number) {
    if (!currentSet) return;
    const step = currentExerciseDef?.stepSizeKg ?? 2.5;
    const newWeight = Math.max(0, currentSet.weightKg + delta * step);
    updateSet({ weightKg: newWeight });
  }

  function adjustReps(delta: number) {
    if (!currentSet) return;
    const cur = currentSet.actualReps ?? currentSet.targetReps;
    const newReps = Math.max(0, cur + delta);
    updateSet({ actualReps: newReps });
  }

  function handleSetDone() {
    if (!currentSet) return;
    // Falls Reps noch nicht gesetzt, übernehme targetReps als Default
    if (currentSet.actualReps === null) {
      updateSet({ actualReps: currentSet.targetReps });
    }
    setSetDone(true);
  }

  function handleRating(rating: 1 | 2 | 3 | 4 | 5) {
    updateSet({ rating });
    // Rest-Timer starten
    setRestSeconds(restMinFromTemplate * 60);
    setRestRunning(true);
  }

  function skipRest() {
    setRestRunning(false);
    setRestSeconds(0);
  }

  function nextSet() {
    setSetDone(false);
    skipRest();

    if (setIdx + 1 < currentExercise.sets.length) {
      setSetIdx(setIdx + 1);
    } else if (exerciseIdx + 1 < exercises.length) {
      setExerciseIdx(exerciseIdx + 1);
      setSetIdx(0);
    } else {
      setPhase('done');
    }
  }

  async function handleSave() {
    if (!trainingWeek) return;

    // Für jede Übung Progressionseintrag erstellen
    for (const ex of exercises) {
      const completedSets = ex.sets.filter(s => s.actualReps !== null);
      if (completedSets.length === 0) continue;
      const history = await loadProgressionHistory(ex.exerciseId);
      const entry = buildProgressionEntry(ex.exerciseId, completedSets, history);
      await appendProgressionEntry(ex.exerciseId, entry);
    }

    // Slot-Status aktualisieren
    const updatedSlots = trainingWeek.slots.map(s =>
      s.id === slotId
        ? { ...s, status: 'done' as const, exercises }
        : s,
    );
    const updatedWeek: TrainingWeek = { ...trainingWeek, slots: updatedSlots };
    await setTrainingWeek(updatedWeek);

    Alert.alert('Gespeichert', 'Dein Training wurde gespeichert.', [
      {
        text: 'OK',
        onPress: () => navigation.goBack(),
      },
    ]);
  }

  function formatTimer(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Trainings-Zusammenfassung berechnen
  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((s, set) => {
      const reps = set.actualReps ?? 0;
      return s + reps * set.weightKg;
    }, 0);
  }, 0);

  const totalSetsCompleted = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.actualReps !== null).length,
    0,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Zurück</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{slot.title}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        {phase === 'warmup' && (
          <View style={styles.warmupCard}>
            <Text style={styles.warmupTitle}>Aufwärmen</Text>
            <Text style={styles.warmupTime}>5 Min</Text>
            <Text style={styles.warmupHint}>
              Mobilisiere Gelenke, leichte Cardio-Bewegung. Wenn du bereit bist,
              starte das Training.
            </Text>
            <Button
              title="Bereit"
              onPress={() => setPhase('exercise')}
              fullWidth
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}

        {phase === 'exercise' && currentExercise && currentSet && (
          <View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressInfoText}>
                Übung {exerciseIdx + 1} von {exercises.length}
              </Text>
            </View>

            <Text style={styles.exerciseName}>
              {currentExerciseDef?.name ?? currentExercise.exerciseId}
            </Text>
            {currentExerciseDef?.notes ? (
              <Text style={styles.exerciseNotes}>
                {currentExerciseDef.notes}
              </Text>
            ) : null}

            <View style={styles.setCard}>
              <Text style={styles.setHeader}>
                Satz {currentSet.setNumber} von {currentExercise.sets.length}
              </Text>
              <Text style={styles.setTarget}>
                Ziel: {currentSet.targetReps} Wdh.
              </Text>

              {/* Gewicht */}
              <Text style={styles.fieldLabel}>Gewicht (kg)</Text>
              <View style={styles.adjustRow}>
                <AdjustBtn label="–" onPress={() => adjustWeight(-1)} />
                <Text style={styles.adjustValue}>{currentSet.weightKg}</Text>
                <AdjustBtn label="+" onPress={() => adjustWeight(1)} />
              </View>

              {/* Wiederholungen */}
              <Text style={styles.fieldLabel}>Wiederholungen</Text>
              <View style={styles.adjustRow}>
                <AdjustBtn label="–" onPress={() => adjustReps(-1)} />
                <Text style={styles.adjustValue}>
                  {currentSet.actualReps ?? currentSet.targetReps}
                </Text>
                <AdjustBtn label="+" onPress={() => adjustReps(1)} />
              </View>

              {!setDone ? (
                <Button
                  title="Satz erledigt"
                  onPress={handleSetDone}
                  fullWidth
                  style={{ marginTop: spacing.lg }}
                />
              ) : (
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={styles.fieldLabel}>
                    Wie hat sich der Satz angefühlt?
                  </Text>
                  <View style={styles.ratingRow}>
                    {([1, 2, 3, 4, 5] as const).map(r => (
                      <Pressable
                        key={r}
                        onPress={() => handleRating(r)}
                        style={[
                          styles.ratingBtn,
                          currentSet.rating === r && styles.ratingBtnActive,
                          r === 3 && currentSet.rating !== r && styles.ratingBtnHinted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.ratingBtnNum,
                            currentSet.rating === r && { color: '#0f1419' },
                          ]}
                        >
                          {r}
                        </Text>
                        <Text
                          style={[
                            styles.ratingBtnLabel,
                            currentSet.rating === r && { color: '#0f1419' },
                          ]}
                        >
                          {RATING_DESCRIPTIONS[r]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {restSeconds > 0 || restRunning ? (
                    <View style={styles.timerCard}>
                      <Text style={styles.timerLabel}>Pause</Text>
                      <Text style={styles.timerValue}>
                        {formatTimer(restSeconds)}
                      </Text>
                      <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
                        {!restRunning && restSeconds > 0 && (
                          <Button
                            title="Start"
                            onPress={() => setRestRunning(true)}
                            style={{ flex: 1, marginRight: spacing.sm }}
                          />
                        )}
                        <Button
                          title="Pause überspringen"
                          variant="secondary"
                          onPress={skipRest}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                  ) : currentSet.rating !== null ? (
                    <Button
                      title={
                        setIdx + 1 < currentExercise.sets.length
                          ? 'Nächster Satz'
                          : exerciseIdx + 1 < exercises.length
                          ? 'Nächste Übung'
                          : 'Training abschließen'
                      }
                      onPress={nextSet}
                      fullWidth
                      style={{ marginTop: spacing.lg }}
                    />
                  ) : null}
                </View>
              )}
            </View>
          </View>
        )}

        {phase === 'done' && (
          <View>
            <Text style={styles.doneTitle}>Geschafft!</Text>
            <Text style={styles.doneSub}>
              Du hast alle Übungen abgeschlossen.
            </Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="Übungen" value={String(exercises.length)} />
              <SummaryRow label="Sätze gesamt" value={String(totalSetsCompleted)} />
              <SummaryRow
                label="Volumen"
                value={`${Math.round(totalVolume)} kg`}
              />
            </View>

            <Button
              title="Speichern"
              onPress={handleSave}
              fullWidth
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AdjustBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.adjustBtn}>
      <Text style={styles.adjustBtnText}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginBottom: spacing.xs,
  },
  backBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  warmupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  warmupTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  warmupTime: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  warmupHint: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  progressInfo: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  progressInfoText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  exerciseNotes: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  setCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  setHeader: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  setTarget: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  adjustValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginHorizontal: spacing.xl,
    minWidth: 80,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'column',
  },
  ratingBtn: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  ratingBtnHinted: {
    borderColor: colors.accent,
  },
  ratingBtnNum: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    width: 32,
  },
  ratingBtnLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  timerCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  timerLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  timerValue: {
    color: colors.accent,
    fontSize: 44,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  doneSub: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
