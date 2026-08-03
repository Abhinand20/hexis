import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import { calendarDayIntensity } from "../../src/features/cycles/domain/cycleProgress";
import {
  buildDaySummary,
  buildWeekSummary,
  type WeekPracticeProgress,
} from "../../src/features/cycles/domain/cycleSummary";
import {
  buildHistoryInsights,
  type HistoryInsights,
} from "../../src/features/cycles/domain/historyInsights";
import {
  addLocalDays,
  todayLocalDate,
  weekStart,
} from "../../src/features/cycles/domain/date";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";
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

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDisplayDate(localDate: string): string {
  const [, month, day] = localDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function formatLongDate(localDate: string): string {
  const date = parseLocalDate(localDate);
  return `${WEEKDAY_NAMES[date.getUTCDay()]}, ${formatDisplayDate(localDate)}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function percentage(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

function cycleDayNumber(cycle: Cycle, localDate: string): number {
  let day = 1;
  let cursor = cycle.startDate;
  while (cursor < localDate) {
    day += 1;
    cursor = addLocalDays(cursor, 1);
  }
  return day;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [focusVersion, setFocusVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusVersion((version) => version + 1);
    }, []),
  );
  const state = useCycleHistory(focusVersion);
  const [filter, setFilter] = useState<HistoryFilter>("week");
  const [dayPointer, setDayPointer] = useState<string | null>(null);
  const [weekPointer, setWeekPointer] = useState<string | null>(null);

  if (state.status === "loading") {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.verdigris} />
        <Text style={styles.stateKicker}>Reading your practice ledger</Text>
      </View>
    );
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
        <Text style={styles.emptyTitle}>Your history starts with a cycle.</Text>
        <Text style={styles.emptyCopy}>
          Each session will become part of a calm record you can review by day,
          week, or cycle.
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
        <Text style={styles.emptyTitle}>History is unavailable.</Text>
        <Text style={styles.emptyCopy}>{state.message}</Text>
      </View>
    );
  }

  const { cycle, goals, revisions, logs } = state;
  const today = todayLocalDate();
  const upperBoundDate = today < cycle.endDate ? today : cycle.endDate;
  const selectedDay = dayPointer ?? upperBoundDate;
  const minWeekStart = weekStart(cycle.startDate);
  const maxWeekStart = weekStart(upperBoundDate);
  const currentWeek = weekPointer ?? maxWeekStart;
  const statusLabel = cycle.status === "active" ? "Active cycle" : "Completed cycle";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 96 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          {statusLabel} · Day {cycleDayNumber(cycle, upperBoundDate)} of {cycle.durationDays}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          Look back without losing the shape of where you’re going.
        </Text>
      </View>

      <View accessibilityRole="tablist" style={styles.filterRow}>
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
        <DayFilterView
          cycle={cycle}
          goals={goals}
          revisions={revisions}
          logs={logs}
          selectedDate={selectedDay}
          minDate={cycle.startDate}
          maxDate={upperBoundDate}
          onPrevious={() => setDayPointer(addLocalDays(selectedDay, -1))}
          onNext={() => setDayPointer(addLocalDays(selectedDay, 1))}
        />
      ) : null}

      {filter === "week" ? (
        <WeekFilterView
          cycle={cycle}
          goals={goals}
          revisions={revisions}
          logs={logs}
          currentWeek={currentWeek}
          minWeekStart={minWeekStart}
          maxWeekStart={maxWeekStart}
          today={today}
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
  cycle,
  goals,
  revisions,
  logs,
  selectedDate,
  minDate,
  maxDate,
  onPrevious,
  onNext,
}: {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const summary = buildDaySummary(goals, revisions, logs, selectedDate);
  const sessionCount = logs.filter((log) => log.localDate === selectedDate).length;
  const minutesLogged = summary.practices.reduce(
    (total, practice) => total + (practice.minutesLogged ?? 0),
    0,
  );
  const prevDisabled = selectedDate <= minDate;
  const nextDisabled = selectedDate >= maxDate;

  return (
    <View style={styles.section}>
      <PeriodNavigator
        label={formatLongDate(selectedDate)}
        sublabel={`Cycle day ${cycleDayNumber(cycle, selectedDate)}`}
        previousLabel="Previous day"
        nextLabel="Next day"
        previousDisabled={prevDisabled}
        nextDisabled={nextDisabled}
        onPrevious={onPrevious}
        onNext={onNext}
      />

      <View style={styles.metricRow}>
        <MetricCard value={String(sessionCount)} label="sessions" />
        <MetricCard value={formatMinutes(minutesLogged)} label="logged" />
      </View>

      <SectionHeading label="Practice record" detail={`${summary.practices.length} practices`} />
      <View style={styles.paperCard}>
        {summary.practices.map((practice, index) => (
          <View
            key={practice.goalId}
            style={[styles.dayPracticeRow, index > 0 ? styles.rowDivider : null]}
          >
            <View
              accessibilityLabel={practice.logged ? "Logged" : "Not logged"}
              style={[
                styles.statusMark,
                practice.logged ? styles.statusMarkComplete : null,
              ]}
            >
              <Text style={styles.statusMarkText}>{practice.logged ? "✓" : ""}</Text>
            </View>
            <View style={styles.practiceCopy}>
              <Text style={styles.practiceName}>{practice.name}</Text>
              <Text style={styles.practiceMeta}>
                {practice.logged ? "Logged" : "Not logged"}
                {practice.expectedDurationMinutes !== null
                  ? ` · ${practice.minutesLogged ?? 0} of ${practice.expectedDurationMinutes} min`
                  : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekFilterView({
  cycle,
  goals,
  revisions,
  logs,
  currentWeek,
  minWeekStart,
  maxWeekStart,
  today,
  onPrevious,
  onNext,
}: {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
  currentWeek: string;
  minWeekStart: string;
  maxWeekStart: string;
  today: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const summary = buildWeekSummary(goals, revisions, logs, currentWeek);
  const previousSummary = currentWeek > minWeekStart
    ? buildWeekSummary(goals, revisions, logs, addLocalDays(currentWeek, -7))
    : null;
  const prevDisabled = currentWeek <= minWeekStart;
  const nextDisabled = currentWeek >= maxWeekStart;
  const reachedTargetCount = summary.practiceProgress.filter((practice) => practice.met).length;
  const sessionDelta = previousSummary
    ? summary.sessionCount - previousSummary.sessionCount
    : null;
  const dailyActivity = Array.from({ length: 7 }, (_, index) => {
    const localDate = addLocalDays(summary.weekStartDate, index);
    const dayLogs = logs.filter(
      (log) =>
        log.localDate === localDate &&
        localDate >= cycle.startDate &&
        localDate <= cycle.endDate,
    );
    return {
      localDate,
      sessionCount: dayLogs.length,
      isOutsideCycle: localDate < cycle.startDate || localDate > cycle.endDate,
      isFuture: localDate > today,
    };
  });
  const maxDailySessions = Math.max(1, ...dailyActivity.map((day) => day.sessionCount));

  return (
    <View style={styles.section}>
      <PeriodNavigator
        label={`${formatDisplayDate(summary.weekStartDate)} – ${formatDisplayDate(summary.weekEndDate)}`}
        sublabel={currentWeek === maxWeekStart ? "Current week" : "Calendar week"}
        previousLabel="Previous week"
        nextLabel="Next week"
        previousDisabled={prevDisabled}
        nextDisabled={nextDisabled}
        onPrevious={onPrevious}
        onNext={onNext}
      />

      <View style={styles.metricRow}>
        <MetricCard value={String(summary.sessionCount)} label="sessions" />
        <MetricCard value={formatMinutes(summary.minutesLogged)} label="logged" />
        <MetricCard
          value={`${reachedTargetCount}/${summary.practiceProgress.length}`}
          label="targets reached"
        />
      </View>

      <View style={styles.momentumNote}>
        <Text style={styles.momentumKicker}>Week over week</Text>
        <Text style={styles.momentumText}>
          {sessionDelta === null
            ? "This is the first week in this cycle."
            : sessionDelta === 0
              ? "Session count is level with the previous week."
              : `${Math.abs(sessionDelta)} ${Math.abs(sessionDelta) === 1 ? "session" : "sessions"} ${sessionDelta > 0 ? "ahead of" : "behind"} the previous week.`}
        </Text>
      </View>

      <SectionHeading label="Daily rhythm" detail="Mon – Sun" />
      <View style={styles.rhythmChart}>
        {dailyActivity.map((day) => (
          <View key={day.localDate} style={styles.rhythmColumn}>
            <Text style={styles.rhythmValue}>
              {day.isOutsideCycle || day.isFuture ? "·" : day.sessionCount}
            </Text>
            <View style={styles.rhythmTrack}>
              {!day.isOutsideCycle && !day.isFuture && day.sessionCount > 0 ? (
                <View
                  style={[
                    styles.rhythmFill,
                    { height: `${Math.max(18, (day.sessionCount / maxDailySessions) * 100)}%` },
                  ]}
                />
              ) : null}
            </View>
            <Text style={styles.rhythmDay}>
              {WEEKDAY_NAMES[parseLocalDate(day.localDate).getUTCDay()].slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeading label="Practice pace" detail="Sessions toward weekly target" />
      <View style={styles.practiceStack}>
        {summary.practiceProgress.map((practice) => (
          <WeekPracticeCard key={practice.goalId} practice={practice} />
        ))}
      </View>

      {summary.strongestDay ? (
        <View style={styles.observationCard}>
          <Text style={styles.observationKicker}>Strongest day</Text>
          <Text style={styles.observationTitle}>
            {formatLongDate(summary.strongestDay.localDate)}
          </Text>
          <Text style={styles.observationMeta}>
            {summary.strongestDay.completedGoalCount} practices · {formatMinutes(summary.strongestDay.minutesLogged)} logged
          </Text>
        </View>
      ) : (
        <View style={styles.quietState}>
          <Text style={styles.quietStateText}>No sessions recorded in this week yet.</Text>
        </View>
      )}
    </View>
  );
}

function WeekPracticeCard({ practice }: { practice: WeekPracticeProgress }) {
  const ratio = practice.sessionTarget === 0
    ? 0
    : Math.min(1, practice.sessionCount / practice.sessionTarget);

  return (
    <View style={styles.paperCard}>
      <View style={styles.practiceHeader}>
        <Text style={styles.practiceName}>{practice.name}</Text>
        <Text style={styles.practiceRatio}>{percentage(ratio)}</Text>
      </View>
      <Text style={styles.practiceLine}>
        {practice.name} reached {practice.sessionCount} of {practice.sessionTarget} sessions
      </Text>
      <ProgressMeter
        ratio={ratio}
        label={`${practice.name}: ${practice.sessionCount} of ${practice.sessionTarget} sessions`}
      />
      {practice.minutesTarget !== null ? (
        <Text style={styles.practiceMeta}>
          {formatMinutes(practice.minutesLogged)} of {formatMinutes(practice.minutesTarget)} planned time
        </Text>
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
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
  today: string;
}) {
  const insights = buildHistoryInsights(cycle, goals, revisions, logs, today);
  const days = Array.from({ length: cycle.durationDays }, (_, index) => {
    const localDate = addLocalDays(cycle.startDate, index);
    return {
      localDate,
      intensity: calendarDayIntensity(goals, logs, localDate),
    };
  });
  const todayIndex = days.findIndex((day) => day.localDate === today);

  return (
    <View style={styles.section}>
      <View style={styles.cycleHero}>
        <Text style={styles.cycleHeroKicker}>{cycle.name}</Text>
        <Text style={styles.cycleHeroValue}>{percentage(insights.activeDayRatio)}</Text>
        <Text style={styles.cycleHeroLabel}>
          of elapsed days include logged effort
        </Text>
        <View style={styles.cycleHeroRule} />
        <Text style={styles.cycleHeroFootnote}>
          {insights.loggedDayCount} active {insights.loggedDayCount === 1 ? "day" : "days"} across {insights.elapsedDayCount} elapsed · {insights.remainingDayCount} remaining
        </Text>
      </View>

      <View style={styles.metricRow}>
        <MetricCard value={String(insights.sessionCount)} label="sessions" />
        <MetricCard value={formatMinutes(insights.minutesLogged)} label="logged" />
        <MetricCard value={String(insights.currentEffortStreak)} label="day streak" />
      </View>

      <CycleTrend insights={insights} />

      <SectionHeading label="Practice consistency" detail="Targets across this cycle" />
      <View style={styles.practiceStack}>
        {insights.practices.map((practice) => (
          <View key={practice.goalId} style={styles.paperCard}>
            <View style={styles.practiceHeader}>
              <View style={styles.practiceCopy}>
                <Text style={styles.practiceName}>{practice.name}</Text>
                <Text style={styles.practiceMeta}>
                  {practice.sessionCount} {practice.sessionCount === 1 ? "session" : "sessions"} · {formatMinutes(practice.minutesLogged)}
                </Text>
              </View>
              <Text style={styles.practiceRatio}>{percentage(practice.completionRatio)}</Text>
            </View>
            <ProgressMeter
              ratio={practice.completionRatio}
              label={`${practice.name}: ${percentage(practice.completionRatio)} of cycle targets reached`}
            />
            <Text style={styles.streakNote}>
              Current {practice.cadence === "daily" ? "daily" : "weekly"} streak · {practice.currentStreak}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeading label="Effort map" detail={`${cycle.durationDays} active days`} />
      <View style={styles.calendarCard}>
        <CycleCalendar
          durationDays={cycle.durationDays}
          todayIndex={todayIndex}
          days={days}
        />
        <View style={styles.calendarLegend}>
          <Text style={styles.calendarLegendText}>Quiet</Text>
          <View style={[styles.legendDot, styles.legendDotEmpty]} />
          <View style={[styles.legendDot, styles.legendDotLow]} />
          <View style={[styles.legendDot, styles.legendDotHigh]} />
          <Text style={styles.calendarLegendText}>Full</Text>
        </View>
      </View>

      <View style={styles.observationCard}>
        <Text style={styles.observationKicker}>Cycle note</Text>
        <Text style={styles.observationTitle}>
          {cycle.status === "active" ? "The pattern is still forming." : "This cycle is complete."}
        </Text>
        <Text style={styles.observationMeta}>
          Longest active-day run: {insights.longestEffortStreak} {insights.longestEffortStreak === 1 ? "day" : "days"}. These numbers describe the record; they do not score it.
        </Text>
      </View>
    </View>
  );
}

function CycleTrend({ insights }: { insights: HistoryInsights }) {
  const visibleTrend = insights.trend.slice(-6);
  const maxSessions = Math.max(1, ...visibleTrend.map((week) => week.sessionCount));
  const delta = insights.sessionDeltaFromPreviousWeek;

  return (
    <View style={styles.trendSection}>
      <SectionHeading
        label="Weekly trend"
        detail={
          delta === null
            ? "First week"
            : delta === 0
              ? "Level with last week"
              : `${delta > 0 ? "+" : ""}${delta} vs last week`
        }
      />
      <View style={styles.trendChart}>
        {visibleTrend.map((week, index) => {
          const isLatest = index === visibleTrend.length - 1;
          return (
            <View key={week.weekStartDate} style={styles.trendColumn}>
              <Text style={styles.trendValue}>{week.sessionCount}</Text>
              <View style={styles.trendTrack}>
                <View
                  style={[
                    styles.trendFill,
                    isLatest ? styles.trendFillCurrent : null,
                    { height: `${Math.max(8, (week.sessionCount / maxSessions) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.trendLabel, isLatest ? styles.trendLabelCurrent : null]}>
                {formatDisplayDate(week.weekStartDate)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PeriodNavigator({
  label,
  sublabel,
  previousLabel,
  nextLabel,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
}: {
  label: string;
  sublabel: string;
  previousLabel: string;
  nextLabel: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.periodNavigator}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        accessibilityState={{ disabled: previousDisabled }}
        disabled={previousDisabled}
        onPress={onPrevious}
        style={[styles.navButton, previousDisabled ? styles.navButtonDisabled : null]}
      >
        <Text style={styles.navButtonText}>‹</Text>
      </Pressable>
      <View style={styles.periodCopy}>
        <Text style={styles.periodLabel}>{label}</Text>
        <Text style={styles.periodSublabel}>{sublabel}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityState={{ disabled: nextDisabled }}
        disabled={nextDisabled}
        onPress={onNext}
        style={[styles.navButton, nextDisabled ? styles.navButtonDisabled : null]}
      >
        <Text style={styles.navButtonText}>›</Text>
      </Pressable>
    </View>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionHeading({ label, detail }: { label: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

function ProgressMeter({ ratio, label }: { ratio: number; label: string }) {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(safeRatio * 100) }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${safeRatio * 100}%` }]} />
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
  stateKicker: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.mutedInk,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 320,
    textAlign: "center",
  },
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    width: "100%",
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: colors.verdigris,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 42,
    letterSpacing: -1.1,
    lineHeight: 48,
  },
  subtitle: {
    color: colors.mutedInk,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 340,
  },
  filterRow: {
    alignItems: "center",
    backgroundColor: "#ECE9E2",
    borderCurve: "continuous",
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    width: "100%",
  },
  filterButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  filterButtonSelected: {
    backgroundColor: "#FFFEFA",
    boxShadow: "0 1px 3px rgba(27, 27, 25, 0.12)",
  },
  filterButtonText: {
    color: colors.mutedInk,
    fontSize: 14,
    fontWeight: "600",
  },
  filterButtonTextSelected: {
    color: colors.ink,
  },
  section: {
    gap: spacing.xl,
    width: "100%",
  },
  periodNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    width: "100%",
  },
  periodCopy: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  periodLabel: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 20,
    textAlign: "center",
  },
  periodSublabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  navButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  navButtonDisabled: {
    opacity: 0.28,
  },
  navButtonText: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  metricCard: {
    backgroundColor: "#EFEEE8",
    borderCurve: "continuous",
    borderRadius: 14,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  metricValue: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 25,
    fontVariant: ["tabular-nums"],
    lineHeight: 30,
  },
  metricLabel: {
    color: colors.mutedInk,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionHeading: {
    alignItems: "baseline",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    width: "100%",
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionDetail: {
    color: colors.mutedInk,
    flexShrink: 1,
    fontSize: 12,
    textAlign: "right",
  },
  paperCard: {
    backgroundColor: "#FFFEFA",
    borderColor: "#E8E5DE",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  dayPracticeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowDivider: {
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  statusMark: {
    alignItems: "center",
    borderColor: "#C9C6BF",
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  statusMarkComplete: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  statusMarkText: {
    color: colors.inkOnDark,
    fontSize: 12,
    fontWeight: "800",
  },
  practiceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  practiceName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  practiceMeta: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  practiceLine: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 19,
  },
  practiceStack: {
    gap: spacing.sm,
    width: "100%",
  },
  practiceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  practiceRatio: {
    color: colors.verdigris,
    fontFamily: "Georgia",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    backgroundColor: "#E6E3DC",
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: colors.verdigris,
    borderRadius: 999,
    height: "100%",
  },
  streakNote: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
  },
  momentumNote: {
    borderLeftColor: colors.verdigris,
    borderLeftWidth: 3,
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
  },
  momentumKicker: {
    color: colors.verdigris,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  momentumText: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 23,
  },
  rhythmChart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
    height: 138,
    width: "100%",
  },
  rhythmColumn: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    height: "100%",
    justifyContent: "flex-end",
  },
  rhythmValue: {
    color: colors.mutedInk,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  rhythmTrack: {
    backgroundColor: "#E8E5DE",
    borderRadius: 6,
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%",
  },
  rhythmFill: {
    backgroundColor: colors.verdigris,
    borderRadius: 6,
    width: "100%",
  },
  rhythmDay: {
    color: colors.mutedInk,
    fontSize: 11,
    fontWeight: "700",
  },
  observationCard: {
    backgroundColor: "#E2E9E5",
    borderCurve: "continuous",
    borderRadius: 16,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  observationKicker: {
    color: colors.verdigris,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  observationTitle: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 24,
  },
  observationMeta: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 19,
  },
  quietState: {
    borderColor: colors.hairline,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    padding: spacing.lg,
  },
  quietStateText: {
    color: colors.mutedInk,
    fontSize: 14,
    textAlign: "center",
  },
  cycleHero: {
    backgroundColor: colors.ink,
    borderCurve: "continuous",
    borderRadius: 22,
    gap: spacing.xs,
    overflow: "hidden",
    padding: spacing.xl,
  },
  cycleHeroKicker: {
    color: "#A9C4BC",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cycleHeroValue: {
    color: colors.inkOnDark,
    fontFamily: "Georgia",
    fontSize: 58,
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
    lineHeight: 64,
  },
  cycleHeroLabel: {
    color: "#CBC8C0",
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 260,
  },
  cycleHeroRule: {
    backgroundColor: "#3B3B37",
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  cycleHeroFootnote: {
    color: "#A9A69F",
    fontSize: 12,
    lineHeight: 18,
  },
  trendSection: {
    gap: spacing.lg,
  },
  trendChart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
    height: 170,
    width: "100%",
  },
  trendColumn: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    height: "100%",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  trendValue: {
    color: colors.mutedInk,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  trendTrack: {
    backgroundColor: "#E8E5DE",
    borderRadius: 6,
    flex: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%",
  },
  trendFill: {
    backgroundColor: "#A9C4BC",
    borderRadius: 6,
    width: "100%",
  },
  trendFillCurrent: {
    backgroundColor: colors.verdigris,
  },
  trendLabel: {
    color: colors.mutedInk,
    fontSize: 9,
    fontWeight: "600",
  },
  trendLabelCurrent: {
    color: colors.ink,
    fontWeight: "800",
  },
  calendarCard: {
    backgroundColor: "#FFFEFA",
    borderColor: "#E8E5DE",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  calendarLegend: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "flex-end",
  },
  calendarLegendText: {
    color: colors.mutedInk,
    fontSize: 10,
    fontWeight: "600",
  },
  legendDot: {
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  legendDotEmpty: {
    backgroundColor: colors.hairline,
  },
  legendDotLow: {
    backgroundColor: "#A9C4BC",
  },
  legendDotHigh: {
    backgroundColor: colors.verdigris,
  },
});
