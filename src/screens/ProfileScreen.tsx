// Profil-Screen: Übersicht, Aktionen und Debug-Daten
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, spacing, radius } from '../ui/theme';
import { Button } from '../ui/Button';

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const GOAL_LABELS: Record<string, string> = {
  weightloss: 'Abnehmen',
  muscle: 'Muskelaufbau',
  fitness: 'Fitness',
  energy: 'Energie',
  structure: 'Struktur',
  boxing: 'Boxen',
  football: 'Fußball',
  tennis: 'Tennis',
  rehab: 'Rehab',
  mobility: 'Mobility',
};

export function ProfileScreen() {
  const { profile, mealCycle, trainingWeek, regenerate, resetAll } = useApp();
  const [showData, setShowData] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Kein Profil vorhanden.</Text>
      </SafeAreaView>
    );
  }

  async function handleRegenerate() {
    setBusy(true);
    try {
      await regenerate();
      Alert.alert('Plan neu erzeugt');
    } finally {
      setBusy(false);
    }
  }

  function handleResetConfirm() {
    Alert.alert(
      'Onboarding neu starten?',
      'Alle Daten werden gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await resetAll();
          },
        },
      ],
    );
  }

  const workdayStr = profile.workSchedule.days
    .slice()
    .sort()
    .map(d => WEEKDAY_NAMES[d])
    .join(', ') || '–';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.headerTitle}>Profil</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.meta}>
            {profile.age} Jahre · {profile.heightCm} cm · {profile.weightKg} kg
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Ziele</Text>
        <View style={styles.chipWrap}>
          {profile.goals.map(g => (
            <View key={g} style={styles.staticChip}>
              <Text style={styles.staticChipText}>
                {GOAL_LABELS[g] ?? g}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Tageswerte</Text>
        <View style={styles.statsCard}>
          <StatRow label="Kalorienziel" value={`${profile.calorieTarget ?? '–'} kcal`} />
          <StatRow label="Proteinziel" value={`${profile.proteinTargetG ?? '–'} g`} />
          <StatRow label="Arbeitstage" value={workdayStr} />
          <StatRow
            label="Arbeitszeit"
            value={`${profile.workSchedule.startTime} – ${profile.workSchedule.endTime}`}
          />
          <StatRow
            label="Schlaf"
            value={`${profile.wakeTime} – ${profile.sleepTime}`}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            title={busy ? 'Erzeuge …' : 'Plan neu erzeugen'}
            onPress={handleRegenerate}
            disabled={busy}
            fullWidth
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button
            title="Onboarding neu starten"
            onPress={handleResetConfirm}
            variant="danger"
            fullWidth
          />
        </View>

        <Pressable
          onPress={() => setShowData(s => !s)}
          style={styles.expander}
        >
          <Text style={styles.expanderText}>
            {showData ? '▾ Daten ausblenden' : '▸ Daten anzeigen'}
          </Text>
        </Pressable>

        {showData && (
          <View style={styles.debugCard}>
            <Text style={styles.debugLabel}>Profil</Text>
            <Text style={styles.debugJson}>
              {JSON.stringify(profile, null, 2)}
            </Text>
            <Text style={styles.debugLabel}>Meal Cycle</Text>
            <Text style={styles.debugJson}>
              {JSON.stringify(mealCycle, null, 2)}
            </Text>
            <Text style={styles.debugLabel}>Training Week</Text>
            <Text style={styles.debugJson}>
              {JSON.stringify(trainingWeek, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  staticChip: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  staticChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  expander: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  expanderText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  debugCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  debugLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  debugJson: {
    color: colors.text,
    fontSize: 10,
    fontFamily: 'Courier',
  },
});
