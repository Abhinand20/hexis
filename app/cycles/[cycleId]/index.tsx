import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../../src/db/DatabaseProvider";
import { colors, spacing } from "../../../src/design/tokens";
import { CycleCalendar } from "../../../src/features/cycles/components/CycleCalendar";
import { CycleHeader } from "../../../src/features/cycles/components/CycleHeader";
import { GoalRow } from "../../../src/features/cycles/components/GoalRow";
import { useCycleLanding } from "../../../src/features/cycles/hooks/useCycleLanding";

export default function CycleLandingScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetDatabase } = useDatabase();
  const state = useCycleLanding(cycleId);

  function confirmReset() {
    Alert.alert(
      "Reset all local data?",
      "This deletes every cycle, goal, and logged session on this device so you can walk through onboarding again. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetDatabase();
            router.replace("/cycles/new");
          },
        },
      ],
    );
  }

  const debugPanel = __DEV__ ? (
    <View style={styles.debugPanel}>
      <Text style={styles.debugLabel}>Debug only</Text>
      <Pressable
        accessibilityRole="button"
        onPress={confirmReset}
        style={styles.debugButton}
      >
        <Text style={styles.debugButtonText}>Reset all data</Text>
      </Pressable>
    </View>
  ) : null;

  if (state.status === "loading") {
    return null;
  }

  if (state.status === "unavailable") {
    return (
      <View
        style={[
          styles.screen,
          styles.centered,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Text style={styles.emptyTitle}>There's no active cycle right now.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/cycles/new")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Start a new cycle</Text>
        </Pressable>
        {debugPanel}
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View
        style={[
          styles.screen,
          styles.centered,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Text style={styles.emptyTitle}>{state.message}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
      data={state.goals}
      keyExtractor={(item) => item.goalId}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <GoalRow
          model={item}
          // Task 8 wires this to the real logging sheet + repository write.
          onLogPress={() => {}}
        />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <CycleHeader
            cycleName={state.header.cycleName}
            dayLabel={state.header.dayLabel}
            daysRemainingLabel={state.header.daysRemainingLabel}
            overallProgressRatio={state.header.overallProgressRatio}
          />
          <CycleCalendar
            durationDays={state.calendarDays.length}
            todayIndex={state.calendarDays.findIndex((day) => day.isToday)}
            days={state.calendarDays}
          />
          <Text style={styles.sectionLabel}>Practices</Text>
        </View>
      }
      ListFooterComponent={debugPanel}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  separator: {
    backgroundColor: colors.hairline,
    height: StyleSheet.hairlineWidth,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "600",
  },
  debugPanel: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  debugLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  debugButton: {
    backgroundColor: "#8B3A3A",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  debugButtonText: {
    color: colors.inkOnDark,
    fontSize: 14,
    fontWeight: "600",
  },
});
