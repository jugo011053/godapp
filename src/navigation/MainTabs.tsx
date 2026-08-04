// Haupt-Tabs: Timeline, Essen, Training, Profil
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TimelineScreen } from '../screens/TimelineScreen';
import { MealsScreen } from '../screens/MealsScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';
import { colors } from '../ui/theme';

export type TrainingStackParamList = {
  TrainingHome: undefined;
  WorkoutSession: { slotId: string };
};

const Tab = createBottomTabNavigator();
const TrainingStack = createNativeStackNavigator<TrainingStackParamList>();

function TrainingStackNav() {
  return (
    <TrainingStack.Navigator screenOptions={{ headerShown: false }}>
      <TrainingStack.Screen name="TrainingHome" component={TrainingScreen} />
      <TrainingStack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
    </TrainingStack.Navigator>
  );
}

function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{ tabBarIcon: tabIcon('📅') }}
      />
      <Tab.Screen
        name="Essen"
        component={MealsScreen}
        options={{ tabBarIcon: tabIcon('🍽️') }}
      />
      <Tab.Screen
        name="Training"
        component={TrainingStackNav}
        options={{ tabBarIcon: tabIcon('💪') }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('⚙️') }}
      />
    </Tab.Navigator>
  );
}
