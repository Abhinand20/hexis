import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { CycleHeader } from "../../src/features/cycles/components/CycleHeader";
import { GoalRow } from "../../src/features/cycles/components/GoalRow";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import { useCycleLanding } from "../../src/features/cycles/hooks/useCycleLanding";

export default function CycleLandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [focusVersion, setFocusVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusVersion((v) => v + 1);
    }, []),
  );

  const state = useCycleLanding(todayLocalDate(), focusVersion);

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
          onPress={() => router.push("/cycles/new")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Start a cycle</Text>
        </Pressable>
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
          onLogged={() => {
            void state.refresh();
          }}
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
});
