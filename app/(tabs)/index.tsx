import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { CycleHeader } from "../../src/features/cycles/components/CycleHeader";
import { CycleSummaryCard } from "../../src/features/cycles/components/CycleSummaryCard";
import { GoalRow } from "../../src/features/cycles/components/GoalRow";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import type { SessionLog } from "../../src/features/cycles/domain/types";
import { useCycleLanding } from "../../src/features/cycles/hooks/useCycleLanding";

export default function CycleLandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [focusVersion, setFocusVersion] = useState(0);
  const [quickLogConfirmation, setQuickLogConfirmation] = useState<string | null>(null);
  const confirmationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (confirmationTimeout.current !== null) {
        clearTimeout(confirmationTimeout.current);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setFocusVersion((v) => v + 1);
    }, []),
  );

  const state = useCycleLanding(todayLocalDate(), focusVersion);

  const showQuickLogConfirmation = useCallback((log: SessionLog) => {
    if (confirmationTimeout.current !== null) {
      clearTimeout(confirmationTimeout.current);
    }

    setQuickLogConfirmation(
      log.durationMinutes === null ? "Logged" : `Logged · ${log.durationMinutes} min`,
    );
    confirmationTimeout.current = setTimeout(() => {
      setQuickLogConfirmation(null);
      confirmationTimeout.current = null;
    }, 2500);
  }, []);

  if (state.status === "loading") {
    return null;
  }

  if (state.status === "empty") {
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
          onPress={() => router.push("/setup/duration")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Start a cycle</Text>
        </Pressable>
      </View>
    );
  }

  if (state.status === "completed") {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.completedContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <CycleSummaryCard cycleName={state.cycleName} summary={state.summary} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/setup/duration")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Start a new cycle</Text>
        </Pressable>
      </ScrollView>
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
    <View style={styles.screen}>
      <FlatList
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
            onQuickLogged={showQuickLogConfirmation}
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

      {quickLogConfirmation ? (
        <View pointerEvents="none" style={[styles.confirmation, { bottom: insets.bottom + 72 }]}>
          <Text accessibilityLiveRegion="polite" style={styles.confirmationText}>
            {quickLogConfirmation}
          </Text>
        </View>
      ) : null}
    </View>
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
  completedContent: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  confirmation: {
    alignSelf: "center",
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    position: "absolute",
  },
  confirmationText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
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
    alignSelf: "center",
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
