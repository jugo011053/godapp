// Training-Screen: Liste der geplanten Workouts der Woche
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp, todayISO } from '../state/AppContext';
import { colors, spacing, radius } from '../ui/theme';
import { Button } from '../ui/Button';
import type { WorkoutSlot } from '../types/training';
import type { TrainingStackParamList } from '../navigation/MainTabs';

type NavProp = NativeStackNavigationProp<TrainingStackParamList, 'TrainingHome'>;

const DAY_NAMES_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES_SHORT[d.getDay()]} ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;
}

const STATUS_LABEL: Record<WorkoutSlot['status'], string> = {
  planned: 'Geplant',
  done: 'Erledigt',
  skipped: 'Übersprungen',
};

export function TrainingScreen() {
  const { trainingWeek } = useApp();
  const navigation = useNavigation<NavProp>();

  if (!trainingWeek) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Kein Trainingsplan vorhanden.</Text>
      </SafeAreaView>
    );
  }

  const totalCount = trainingWeek.slots.length;
  const doneCount = trainingWeek.slots.filter(s => s.status === 'done').length;
  const today = todayISO();

  function isStartable(slot: WorkoutSlot): boolean {
    return slot.status === 'planned' && slot.date <= today;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Training</Text>
        <Text style={styles.headerSub}>
          {doneCount} von {totalCount} Trainings erledigt
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        {trainingWeek.slots.length === 0 && (
          <Text style={styles.empty}>Keine Trainings diese Woche.</Text>
        )}

        {trainingWeek.slots.map(slot => (
          <Pressable
            key={slot.id}
            style={styles.slotCard}
            onPress={() =>
              navigation.navigate('WorkoutSession', { slotId: slot.id })
            }
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.slotTitle}>{slot.title}</Text>
                <View style={[styles.statusPill, statusPillColor(slot.status)]}>
                  <Text style={styles.statusPillText}>
                    {STATUS_LABEL[slot.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.slotMeta}>
                {dateLabel(slot.date)} · {slot.durationMin} Min · {slot.exercises.length} Übungen
              </Text>

              {isStartable(slot) && (
                <View style={{ marginTop: spacing.md }}>
                  <Button
                    title="Training starten"
                    onPress={() =>
                      navigation.navigate('WorkoutSession', { slotId: slot.id })
                    }
                  />
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusPillColor(status: WorkoutSlot['status']) {
  if (status === 'done') return { backgroundColor: colors.accentDark };
  if (status === 'skipped') return { backgroundColor: colors.danger };
  return { backgroundColor: colors.cardAlt };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  slotCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  slotTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  slotMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  statusPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
});
