// Timeline-Screen: Wochenübersicht mit Tagesblöcken
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, todayISO } from '../state/AppContext';
import { colors, spacing, radius } from '../ui/theme';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { resolveConflicts } from '../engines/TimelineEngine';
import { blockDurationMin } from '../utils/timeUtils';
import type {
  TimelineBlock,
  BlockType,
  DayTimeline,
  WeekTimeline,
} from '../types/timeline';

// Farbe pro Blocktyp (linke Leiste)
const TYPE_COLORS: Record<BlockType, string> = {
  work: '#6b7280',
  training: colors.accent,
  prep: colors.warning,
  shopping: colors.info,
  appointment: colors.danger,
  mobility: colors.purple,
  yoga: colors.purple,
  other: colors.muted,
};

const TYPE_LABELS: Record<BlockType, string> = {
  work: 'Arbeit',
  training: 'Training',
  prep: 'Meal Prep',
  shopping: 'Einkauf',
  appointment: 'Termin',
  mobility: 'Mobility',
  yoga: 'Yoga',
  other: 'Sonstiges',
};

const STATUS_LABELS: Record<string, string> = {
  done: 'Erledigt',
  shifted: 'Verschoben',
  skipped: 'Übersprungen',
  planned: 'Geplant',
};

const DAY_NAMES_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES_SHORT[d.getDay()]} ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;
}

function shortDayLabel(dateStr: string): { name: string; num: string } {
  const d = new Date(dateStr);
  return { name: DAY_NAMES_SHORT[d.getDay()], num: String(d.getDate()) };
}

export function TimelineScreen() {
  const { timeline, regenerate, setTimeline, profile } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = todayISO();
    if (timeline?.days.some(d => d.date === t)) return t;
    return timeline?.days[0]?.date ?? t;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Sicherheits-Fallback
  const days = timeline?.days ?? [];
  const selectedDay = days.find(d => d.date === selectedDate);

  const rangeLabel = useMemo(() => {
    if (days.length === 0) return '';
    const first = days[0].date;
    const last = days[days.length - 1].date;
    return `${dayLabel(first)} – ${dayLabel(last)}`;
  }, [days]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await regenerate();
    } finally {
      setRefreshing(false);
    }
  }, [regenerate]);

  function jumpToToday() {
    const t = todayISO();
    if (days.some(d => d.date === t)) setSelectedDate(t);
  }

  async function addCustomBlock(newBlock: TimelineBlock) {
    if (!timeline || !selectedDay) return;
    const { updatedDay, summary } = resolveConflicts(selectedDay, newBlock);
    const updatedDays = timeline.days.map(d =>
      d.date === selectedDay.date ? updatedDay : d,
    );
    const updatedTimeline: WeekTimeline = { ...timeline, days: updatedDays };
    await setTimeline(updatedTimeline);
    Alert.alert('Block hinzugefügt', summary);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Kein Profil vorhanden.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Timeline</Text>
          <Text style={styles.headerRange}>{rangeLabel}</Text>
        </View>
        <Pressable onPress={jumpToToday} style={styles.todayBtn}>
          <Text style={styles.todayBtnText}>Heute</Text>
        </Pressable>
      </View>

      {/* Tag-Picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayPicker}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {days.map(d => {
          const { name, num } = shortDayLabel(d.date);
          const isSelected = d.date === selectedDate;
          const isToday = d.date === todayISO();
          return (
            <Pressable
              key={d.date}
              onPress={() => setSelectedDate(d.date)}
              style={[
                styles.dayChip,
                isSelected && { backgroundColor: colors.accent },
                !isSelected && isToday && { borderColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.dayChipName,
                  isSelected && { color: '#0f1419' },
                ]}
              >
                {name}
              </Text>
              <Text
                style={[
                  styles.dayChipNum,
                  isSelected && { color: '#0f1419' },
                ]}
              >
                {num}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {selectedDay && selectedDay.blocks.length > 0 ? (
          selectedDay.blocks.map(block => (
            <BlockCard key={block.id} block={block} />
          ))
        ) : (
          <View style={styles.emptyDay}>
            <Text style={styles.emptyDayText}>Ruhetag – nichts geplant</Text>
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <AddBlockModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        date={selectedDate}
        onSubmit={addCustomBlock}
      />
    </SafeAreaView>
  );
}

function BlockCard({ block }: { block: TimelineBlock }) {
  const duration = blockDurationMin(block.startTime, block.endTime);
  return (
    <View style={styles.blockCard}>
      <View
        style={[
          styles.blockBar,
          { backgroundColor: TYPE_COLORS[block.type] ?? colors.muted },
        ]}
      />
      <View style={{ flex: 1, padding: spacing.md }}>
        <Text style={styles.blockTime}>
          {block.startTime} – {block.endTime}
        </Text>
        <Text style={styles.blockTitle}>{block.title}</Text>
        <View style={styles.blockMeta}>
          <Text style={styles.blockMetaText}>{duration} Min</Text>
          {block.status !== 'planned' && (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {STATUS_LABELS[block.status]}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// --- Modal zum Hinzufügen eines benutzerdefinierten Blocks ---

interface AddBlockModalProps {
  visible: boolean;
  onClose: () => void;
  date: string;
  onSubmit: (block: TimelineBlock) => void;
}

function AddBlockModal({ visible, onClose, date, onSubmit }: AddBlockModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<BlockType>('appointment');
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');

  function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Bitte Titel eingeben.');
      return;
    }
    const block: TimelineBlock = {
      id: `custom_${date}_${start.replace(':', '')}_${Date.now()}`,
      type,
      title: title.trim(),
      startTime: start,
      endTime: end,
      priority: 3,
      locked: false,
      shortModeAvailable: false,
      shortModeDurationMin: null,
      status: 'planned',
      date,
      notes: '',
    };
    onSubmit(block);
    // Felder zurücksetzen
    setTitle('');
    setStart('12:00');
    setEnd('13:00');
    setType('appointment');
    onClose();
  }

  const typeOptions: BlockType[] = [
    'appointment',
    'training',
    'shopping',
    'prep',
    'mobility',
    'other',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Neuer Block</Text>
          <Text style={styles.modalSub}>für {dayLabel(date)}</Text>

          <Text style={styles.label}>Typ</Text>
          <View style={styles.chipWrap}>
            {typeOptions.map(t => (
              <Chip
                key={t}
                label={TYPE_LABELS[t]}
                selected={type === t}
                onPress={() => setType(t)}
              />
            ))}
          </View>

          <Text style={styles.label}>Titel</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Arzttermin"
            placeholderTextColor={colors.muted}
            style={styles.modalInput}
          />

          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.label}>Start</Text>
              <TextInput
                value={start}
                onChangeText={setStart}
                placeholder="12:00"
                placeholderTextColor={colors.muted}
                style={styles.modalInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ende</Text>
              <TextInput
                value={end}
                onChangeText={setEnd}
                placeholder="13:00"
                placeholderTextColor={colors.muted}
                style={styles.modalInput}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            <Button
              title="Abbrechen"
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Hinzufügen"
              onPress={handleSubmit}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerRange: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  todayBtn: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayBtnText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  dayPicker: {
    maxHeight: 80,
    marginBottom: spacing.sm,
  },
  dayChip: {
    width: 56,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayChipNum: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  blockCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  blockBar: {
    width: 6,
  },
  blockTime: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  blockTitle: {
    color: colors.text,
    fontSize: 15,
    marginTop: 2,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  blockMetaText: {
    color: colors.muted,
    fontSize: 12,
  },
  statusPill: {
    marginLeft: spacing.sm,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  emptyDay: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  emptyDayText: {
    color: colors.muted,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  fabText: {
    color: '#0f1419',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSub: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  modalInput: {
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
  },
});
