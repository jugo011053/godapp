// Essen-Screen: 4-Tage-Mealprep mit 3 Sub-Tabs (Block A, Block B, Einkauf)
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { colors, spacing, radius } from '../ui/theme';
import { getRecipeById } from '../data/recipes';
import { RECIPES } from '../data/recipes';
import {
  swapMeal,
  generateShoppingList,
} from '../engines/MealPrepEngine';
import type {
  MealBlock,
  MealDay,
  MealCategory,
  PlannedMeal,
  ShoppingList,
  ShoppingItem,
  MealCycle,
} from '../types/meal';

type SubTab = 'A' | 'B' | 'shop';

const CATEGORY_LABEL: Record<MealCategory, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
};

const DAY_NAMES_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_NAMES_SHORT[d.getDay()]} ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;
}

export function MealsScreen() {
  const { mealCycle, setMealCycle, profile } = useApp();
  const [tab, setTab] = useState<SubTab>('A');
  // Lokaler State für Einkauf-Häkchen
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const shoppingList: ShoppingList | null = useMemo(() => {
    if (!mealCycle) return null;
    return generateShoppingList(mealCycle, RECIPES);
  }, [mealCycle]);

  async function handleSwap(blockId: 'A' | 'B', dayIdx: number, category: MealCategory) {
    if (!mealCycle || !profile) return;
    const block = blockId === 'A' ? mealCycle.blockA : mealCycle.blockB;
    const day = block.meals[dayIdx];
    if (!day) return;

    const newMeal = swapMeal(day, category, RECIPES, profile);
    const updatedDay: MealDay = { ...day, [category]: newMeal };
    const updatedMeals = block.meals.map((m, i) => (i === dayIdx ? updatedDay : m));
    const updatedBlock: MealBlock = { ...block, meals: updatedMeals };
    const updatedCycle: MealCycle = blockId === 'A'
      ? { ...mealCycle, blockA: updatedBlock }
      : { ...mealCycle, blockB: updatedBlock };

    await setMealCycle(updatedCycle);
  }

  function toggleCheck(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!mealCycle) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Kein Mealplan vorhanden.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Essen</Text>
        <Text style={styles.headerSub}>Zyklus ab {dateLabel(mealCycle.cycleStart)}</Text>
      </View>

      {/* Sub-Tab-Bar */}
      <View style={styles.tabBar}>
        <TabBtn label="Block A" active={tab === 'A'} onPress={() => setTab('A')} />
        <TabBtn label="Block B" active={tab === 'B'} onPress={() => setTab('B')} />
        <TabBtn label="Einkauf" active={tab === 'shop'} onPress={() => setTab('shop')} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        {tab === 'A' && (
          <BlockView
            block={mealCycle.blockA}
            onSwap={(dayIdx, cat) => handleSwap('A', dayIdx, cat)}
          />
        )}
        {tab === 'B' && (
          <BlockView
            block={mealCycle.blockB}
            onSwap={(dayIdx, cat) => handleSwap('B', dayIdx, cat)}
          />
        )}
        {tab === 'shop' && shoppingList && (
          <ShoppingView
            list={shoppingList}
            checked={checked}
            onToggle={toggleCheck}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Block-Ansicht: 2 Tage mit je 4 Mahlzeiten ---

function BlockView({
  block,
  onSwap,
}: {
  block: MealBlock;
  onSwap: (dayIdx: number, cat: MealCategory) => void;
}) {
  return (
    <View>
      <View style={styles.prepInfo}>
        <Text style={styles.prepInfoLabel}>Prep am</Text>
        <Text style={styles.prepInfoValue}>{dateLabel(block.prepDate)}</Text>
        <Text style={styles.prepInfoLabel}>deckt ab</Text>
        <Text style={styles.prepInfoValue}>
          {dateLabel(block.coversDay1)} & {dateLabel(block.coversDay2)}
        </Text>
      </View>

      {block.meals.map((day, idx) => (
        <DayView
          key={day.date}
          day={day}
          dayIdx={idx}
          dayNumber={idx + 1}
          onSwap={cat => onSwap(idx, cat)}
        />
      ))}
    </View>
  );
}

function DayView({
  day,
  dayIdx: _dayIdx,
  dayNumber,
  onSwap,
}: {
  day: MealDay;
  dayIdx: number;
  dayNumber: number;
  onSwap: (cat: MealCategory) => void;
}) {
  const meals: Array<{ key: MealCategory; meal: PlannedMeal }> = [
    { key: 'breakfast', meal: day.breakfast },
    { key: 'lunch', meal: day.lunch },
    { key: 'dinner', meal: day.dinner },
    { key: 'snack', meal: day.snack },
  ];

  // Tagessummen
  const totalKcal = meals.reduce((s, m) => s + (m.meal.caloriesActual || 0), 0)
    + (day.shake ? 120 : 0);
  const totalProtein = meals.reduce((s, m) => s + (m.meal.proteinActual || 0), 0)
    + (day.shake ? 25 : 0);

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderTitle}>Tag {dayNumber}</Text>
        <Text style={styles.dayHeaderDate}>{dateLabel(day.date)}</Text>
      </View>

      {day.shake && (
        <View style={styles.shakeBadge}>
          <Text style={styles.shakeBadgeText}>+1 Proteinshake</Text>
        </View>
      )}

      {meals.map(m => (
        <MealCard
          key={m.key}
          category={m.key}
          meal={m.meal}
          onSwap={() => onSwap(m.key)}
        />
      ))}

      <View style={styles.daySummary}>
        <Text style={styles.daySummaryText}>
          Gesamt: {totalKcal} kcal · {totalProtein}g Protein
        </Text>
      </View>
    </View>
  );
}

function MealCard({
  category,
  meal,
  onSwap,
}: {
  category: MealCategory;
  meal: PlannedMeal;
  onSwap: () => void;
}) {
  const recipe = meal.recipeId ? getRecipeById(meal.recipeId) : undefined;

  return (
    <View style={styles.mealCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.mealCategory}>{CATEGORY_LABEL[category]}</Text>
        <Text style={styles.mealName}>{recipe?.name ?? 'Keine Mahlzeit'}</Text>
        {recipe && (
          <Text style={styles.mealMeta}>
            {meal.caloriesActual} kcal · {meal.proteinActual}g Protein · {recipe.cookTimeMin} Min
          </Text>
        )}
      </View>
      {recipe && (
        <Pressable onPress={onSwap} style={styles.swapBtn}>
          <Text style={styles.swapBtnText}>Tauschen</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Einkaufsliste ---

function ShoppingView({
  list,
  checked,
  onToggle,
}: {
  list: ShoppingList;
  checked: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Einkauf</Text>
      {list.items.length === 0 && (
        <Text style={styles.empty}>Keine Artikel.</Text>
      )}
      {list.items.map(item => (
        <ShopItem
          key={`${item.name}_${item.unit}`}
          item={item}
          checked={checked.has(`${item.name}_${item.unit}`)}
          onToggle={() => onToggle(`${item.name}_${item.unit}`)}
        />
      ))}

      <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
        Basiszutaten (prüfen)
      </Text>
      {list.baseItems.map(item => (
        <ShopItem
          key={`base_${item.name}_${item.unit}`}
          item={item}
          checked={checked.has(`base_${item.name}_${item.unit}`)}
          onToggle={() => onToggle(`base_${item.name}_${item.unit}`)}
        />
      ))}
    </View>
  );
}

function ShopItem({
  item,
  checked,
  onToggle,
}: {
  item: ShoppingItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.shopRow}>
      <View
        style={[
          styles.checkbox,
          checked && { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text
        style={[
          styles.shopRowText,
          checked && { textDecorationLine: 'line-through', color: colors.muted },
        ]}
      >
        {item.name}
      </Text>
      <Text style={styles.shopRowAmount}>
        {item.roundedAmount} {item.unit}
      </Text>
    </Pressable>
  );
}

// --- Subtab-Button ---

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: colors.accent,
  },
  tabBtnText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 14,
  },
  tabBtnTextActive: {
    color: colors.text,
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
  prepInfo: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  prepInfoLabel: {
    color: colors.muted,
    fontSize: 12,
    marginRight: spacing.sm,
  },
  prepInfoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginRight: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  dayHeaderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  dayHeaderDate: {
    color: colors.muted,
    fontSize: 13,
  },
  shakeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  shakeBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  mealCategory: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  mealMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  swapBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swapBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  daySummary: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  daySummaryText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkmark: {
    color: '#0f1419',
    fontWeight: '800',
    fontSize: 14,
  },
  shopRowText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  shopRowAmount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
