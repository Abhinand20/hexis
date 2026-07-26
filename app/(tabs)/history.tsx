import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { CycleSummaryCard } from "../../src/features/cycles/components/CycleSummaryCard";
import { calendarDayIntensity } from "../../src/features/cycles/domain/cycleProgress";
import {
  buildCycleSummary,
  buildDaySummary,
  buildWeekSummary,
} from "../../src/features/cycles/domain/cycleSummary";
import {
  addLocalDays,
  todayLocalDate,
  weekStart,
} from "../../src/features/cycles/domain/date";
import { useCycleHistory } from "../../src/features/cycles/hooks/useCycleHistory";

type HistoryFilter = "day" | "week" | "cycle";

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "cycle", label: "Cycle" },
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDisplayDate(localDate: string): string {
  const [, month, day] = localDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const state = useCycleHistory();
  const [filter, setFilter] = useState<HistoryFilter>("week");
  const [weekPointer, setWeekPointer] = useState<string | null>(null);

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
        <Text style={styles.emptyCopy}>
          History arrives once Hexis has cycles to look back on.
        </Text>
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
        <Text style={styles.emptyCopy}>{state.message}</Text>
      </View>
    );
  }

  const { cycle, goals, revisions, logs } = state;
  const today = todayLocalDate();
  const upperBoundDate = today < cycle.endDate ? today : cycle.endDate;
  const minWeekStart = weekStart(cycle.startDate);
  const maxWeekStart = weekStart(upperBoundDate);
  const currentWeek = weekPointer ?? maxWeekStart;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.filterRow}>
        {FILTERS.map((option) => {
          const selected = filter === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option.key)}
              style={[styles.filterButton, selected ? styles.filterButtonSelected : null]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selected ? styles.filterButtonTextSelected : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filter === "day" ? (
        <DayFilterView goals={goals} revisions={revisions} logs={logs} today={today} />
      ) : null}

      {filter === "week" ? (
        <WeekFilterView
          goals={goals}
          revisions={revisions}
          logs={logs}
          currentWeek={currentWeek}
          minWeekStart={minWeekStart}
          maxWeekStart={maxWeekStart}
          onPrevious={() => setWeekPointer(addLocalDays(currentWeek, -7))}
          onNext={() => setWeekPointer(addLocalDays(currentWeek, 7))}
        />
      ) : null}

      {filter === "cycle" ? (
        <CycleFilterView
          cycle={cycle}
          goals={goals}
          revisions={revisions}
          logs={logs}
          today={today}
        />
      ) : null}
    </ScrollView>
  );
}

function DayFilterView({
  goals,
  revisions,
  logs,
  today,
}: {
  goals: Parameters<typeof buildDaySummary>[0];
  revisions: Parameters<typeof buildDaySummary>[1];
  logs: Parameters<typeof buildDaySummary>[2];
  today: string;
}) {
  const summary = buildDaySummary(goals, revisions, logs, today);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Today · {formatDisplayDate(today)}</Text>
      {summary.practices.map((practice) => (
        <View key={practice.goalId} style={styles.practiceRow}>
          <Text style={styles.practiceName}>{practice.name}</Text>
          <Text style={styles.practiceMeta}>
            {practice.logged ? "Logged" : "Not logged"}
          </Text>
          {practice.expectedDurationMinutes !== null ? (
            <Text style={styles.practiceMeta}>
              {practice.minutesLogged ?? 0} of {practice.expectedDurationMinutes} min
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function WeekFilterView({
  goals,
  revisions,
  logs,
  currentWeek,
  minWeekStart,
  maxWeekStart,
  onPrevious,
  onNext,
}: {
  goals: Parameters<typeof buildWeekSummary>[0];
  revisions: Parameters<typeof buildWeekSummary>[1];
  logs: Parameters<typeof buildWeekSummary>[2];
  currentWeek: string;
  minWeekStart: string;
  maxWeekStart: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const summary = buildWeekSummary(goals, revisions, logs, currentWeek);
  const prevDisabled = currentWeek <= minWeekStart;
  const nextDisabled = currentWeek >= maxWeekStart;

  return (
    <View style={styles.section}>
      <View style={styles.weekNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          accessibilityState={{ disabled: prevDisabled }}
          disabled={prevDisabled}
          onPress={onPrevious}
          style={[styles.navButton, prevDisabled ? styles.navButtonDisabled : null]}
        >
          <Text style={styles.navButtonText}>Prev</Text>
        </Pressable>
        <Text style={styles.weekLabel}>
          {formatDisplayDate(summary.weekStartDate)} –{" "}
          {formatDisplayDate(summary.weekEndDate)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          onPress={onNext}
          style={[styles.navButton, nextDisabled ? styles.navButtonDisabled : null]}
        >
          <Text style={styles.navButtonText}>Next</Text>
        </Pressable>
      </View>

      <Text style={styles.statLine}>
        {summary.sessionCount} session{summary.sessionCount === 1 ? "" : "s"} completed
      </Text>
      <Text style={styles.statLine}>{summary.minutesLogged} min logged</Text>

      <Text style={styles.sectionLabel}>Practices</Text>
      {summary.practiceProgress.map((practice) => (
        <Text key={practice.goalId} style={styles.practiceLine}>
          {practice.name} reached {practice.sessionCount} of {practice.sessionTarget}{" "}
          sessions
        </Text>
      ))}

      {summary.strongestDay ? (
        <Text style={styles.highlight}>
          Strongest day: {formatDisplayDate(summary.strongestDay.localDate)} ·{" "}
          {summary.strongestDay.completedGoalCount} practices ·{" "}
          {summary.strongestDay.minutesLogged} min
        </Text>
      ) : (
        <Text style={styles.fallback}>No strongest day this week</Text>
      )}

      {summary.missedTargetGoalNames.length > 0 ? (
        <View style={styles.missedBlock}>
          <Text style={styles.sectionLabel}>Practices that missed their target</Text>
          {summary.missedTargetGoalNames.map((name) => (
            <Text key={name} style={styles.practiceLine}>
              {name}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CycleFilterView({
  cycle,
  goals,
  revisions,
  logs,
  today,
}: {
  cycle: Parameters<typeof buildCycleSummary>[0];
  goals: Parameters<typeof buildCycleSummary>[1];
  revisions: Parameters<typeof buildCycleSummary>[2];
  logs: Parameters<typeof buildCycleSummary>[3];
  today: string;
}) {
  const summary = buildCycleSummary(cycle, goals, revisions, logs);
  const days = Array.from({ length: summary.activeDayCount }, (_, index) => {
    const localDate = addLocalDays(cycle.startDate, index);
    return {
      localDate,
      intensity: calendarDayIntensity(goals, logs, localDate),
    };
  });
  const todayIndex = days.findIndex((day) => day.localDate === today);

  return (
    <View style={styles.section}>
      <CycleCalendar
        durationDays={summary.activeDayCount}
        todayIndex={todayIndex}
        days={days}
      />
      <CycleSummaryCard cycleName={cycle.name} summary={summary} />
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
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  emptyCopy: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterButton: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterButtonSelected: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  filterButtonText: {
    color: colors.ink,
    fontSize: 15,
  },
  filterButtonTextSelected: {
    color: colors.inkOnDark,
    fontWeight: "600",
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  practiceRow: {
    gap: 2,
    paddingVertical: spacing.xs,
  },
  practiceName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  practiceMeta: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  practiceLine: {
    color: colors.ink,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  weekNav: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  weekLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  navButton: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  statLine: {
    color: colors.ink,
    fontSize: 16,
  },
  highlight: {
    color: colors.ink,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  fallback: {
    color: colors.mutedInk,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  missedBlock: {
    gap: spacing.xs,
  },
});
