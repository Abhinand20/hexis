import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { CycleHeader } from "../../src/features/cycles/components/CycleHeader";
import { CycleSummaryCard } from "../../src/features/cycles/components/CycleSummaryCard";
import { GoalRow } from "../../src/features/cycles/components/GoalRow";
import { RecentRhythm } from "../../src/features/cycles/components/RecentRhythm";
import { WeekAtGlanceCard } from "../../src/features/cycles/components/WeekAtGlanceCard";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import type { SessionLog } from "../../src/features/cycles/domain/types";
import { useCycleLanding } from "../../src/features/cycles/hooks/useCycleLanding";
import { useLogSession } from "../../src/features/logging/hooks/useLogSession";

export default function CycleLandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [focusVersion, setFocusVersion] = useState(0);
  const [quickLogConfirmation, setQuickLogConfirmation] =
    useState<SessionLog | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const confirmationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { removeSession, isPending: isUndoPending } = useLogSession();

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
  const refresh = state.status === "ready" ? state.refresh : null;

  const handleLogged = useCallback(() => {
    void refresh?.();
  }, [refresh]);

  const showQuickLogConfirmation = useCallback((log: SessionLog) => {
    if (confirmationTimeout.current !== null) {
      clearTimeout(confirmationTimeout.current);
    }

    setUndoError(null);
    setQuickLogConfirmation(log);
    confirmationTimeout.current = setTimeout(() => {
      setQuickLogConfirmation(null);
      setUndoError(null);
      confirmationTimeout.current = null;
    }, 5000);
  }, []);

  const removeLog = useCallback(
    async (log: SessionLog) => {
      await removeSession(log.id);
      if (quickLogConfirmation?.id === log.id) {
        setQuickLogConfirmation(null);
        setUndoError(null);
        if (confirmationTimeout.current !== null) {
          clearTimeout(confirmationTimeout.current);
          confirmationTimeout.current = null;
        }
      }
      await refresh?.();
    },
    [quickLogConfirmation, refresh, removeSession],
  );

  const handleUndoQuickLog = useCallback(() => {
    if (!quickLogConfirmation || isUndoPending) {
      return;
    }

    void removeLog(quickLogConfirmation).catch((err) => {
      setUndoError(
        err instanceof Error ? err.message : "Could not undo. Try again.",
      );
    });
  }, [isUndoPending, quickLogConfirmation, removeLog]);

  const navigateToHistoryDay = useCallback(
    (localDate: string) => {
      router.push(`/history?filter=day&date=${localDate}`);
    },
    [router],
  );

  if (state.status === "loading") {
    return (
      <View
        accessibilityLabel="Loading your cycle"
        accessibilityLiveRegion="polite"
        style={[
          styles.screen,
          styles.centered,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <ActivityIndicator color={colors.verdigris} size="small" />
        <Text style={styles.loadingLabel}>Loading your cycle…</Text>
      </View>
    );
  }

  if (state.status === "empty") {
    return (
      <View
        style={[
          styles.screen,
          styles.centered,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
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
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
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
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Text style={styles.emptyTitle}>{state.message}</Text>
      </View>
    );
  }

  const maximumInteractiveDate =
    state.calendarDays.find((day) => day.isToday)?.localDate ?? todayLocalDate();
  const minutesMetric =
    state.dashboard.minutes.target !== null || state.dashboard.minutes.logged > 0
      ? state.dashboard.minutes
      : null;

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        data={state.actionablePractices}
        keyExtractor={(item) => item.goalId}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <GoalRow
            model={item}
            onQuickLogged={showQuickLogConfirmation}
            onUndoLog={removeLog}
            isUndoPending={isUndoPending}
            onLogged={handleLogged}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <CycleHeader
              cycleName={state.header.cycleName}
              dayLabel={state.header.dayLabel}
              daysRemainingLabel={state.header.daysRemainingLabel}
            />
            <WeekAtGlanceCard
              daysRemaining={state.dashboard.week.calendarDaysRemaining}
              hasPartialMembership={state.dashboard.hasPartialMembership}
              minutes={minutesMetric}
              sessions={state.dashboard.sessions}
            />
            <RecentRhythm
              days={state.dashboard.recentDays}
              previousWeekSessionDelta={state.dashboard.previousWeekSessionDelta}
            />
            <Text style={styles.sectionLabel}>Practices</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.calendarSection}>
            <View style={styles.calendarHeading}>
              <Text accessibilityRole="header" style={styles.calendarTitle}>
                Cycle contribution
              </Text>
              <Text style={styles.calendarDescription}>
                Tap an elapsed day to review its activities.
              </Text>
            </View>
            <CycleCalendar
              durationDays={state.calendarDays.length}
              todayIndex={state.calendarDays.findIndex((day) => day.isToday)}
              days={state.calendarDays}
              maximumInteractiveDate={maximumInteractiveDate}
              onSelectDay={navigateToHistoryDay}
              selectedDate={maximumInteractiveDate}
            />
          </View>
        }
      />

      {quickLogConfirmation ? (
        <View style={[styles.confirmation, { bottom: insets.bottom + 72 }]}>
          <Text accessibilityLiveRegion="polite" style={styles.confirmationText}>
            {undoError ?? (quickLogConfirmation.durationMinutes === null
              ? "Logged"
              : `Logged · ${quickLogConfirmation.durationMinutes} min`)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo last log"
            accessibilityState={{ disabled: isUndoPending }}
            disabled={isUndoPending}
            onPress={handleUndoQuickLog}
            style={styles.undoAction}
          >
            <Text style={styles.undoActionText}>
              {isUndoPending ? "Undoing…" : "Undo"}
            </Text>
          </Pressable>
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
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    position: "absolute",
  },
  confirmationText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
  undoAction: {
    minHeight: 36,
    justifyContent: "center",
  },
  undoActionText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  header: {
    gap: spacing.xl,
    paddingBottom: spacing.md,
  },
  calendarSection: {
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
  },
  calendarHeading: {
    gap: spacing.xs,
  },
  calendarTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  calendarDescription: {
    color: colors.mutedInk,
    fontSize: 14,
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
  loadingLabel: {
    color: colors.mutedInk,
    fontSize: 15,
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
