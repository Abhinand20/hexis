import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { CycleArchiveSheet } from "../../src/features/cycles/components/CycleArchiveSheet";
import { CycleCalendar } from "../../src/features/cycles/components/CycleCalendar";
import {
  calendarDayIntensity,
  goalConfigurationOn,
} from "../../src/features/cycles/domain/cycleProgress";
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
import { isGoalActiveOn } from "../../src/features/cycles/domain/goalMembership";
import type {
  Cycle,
  CycleGoal,
  GoalRevision,
  SessionLog,
} from "../../src/features/cycles/domain/types";
import { useCycleHistory } from "../../src/features/cycles/hooks/useCycleHistory";
import {
  ActivityEditorSheet,
  type ActivityEditorValue,
} from "../../src/features/logging/components/ActivityEditorSheet";
import {
  activityInstantFromLocalFields,
  currentLocalClockTime,
  localClockTimeForInstant,
} from "../../src/features/logging/domain/activityDateTime";
import { useEditSession } from "../../src/features/logging/hooks/useEditSession";

type HistoryFilter = "day" | "week" | "cycle";

type EditorState =
  | { mode: "add"; localDate: string; practiceId: string; startedTime: string }
  | { mode: "edit"; session: SessionLog };

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

function parameterValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isValidLocalDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = parseLocalDate(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

function formatSessionTime(startedAt: string): string {
  return new Date(startedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const router = useRouter();
  const params = useLocalSearchParams<{
    cycleId?: string | string[];
    filter?: string | string[];
    date?: string | string[];
  }>();
  const routeCycleId = parameterValue(params.cycleId);
  const routeFilter = parameterValue(params.filter);
  const routeDate = parameterValue(params.date);
  const [focusVersion, setFocusVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusVersion((version) => version + 1);
    }, []),
  );
  const state = useCycleHistory(focusVersion, routeCycleId);
  const activityMutation = useEditSession();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorLocalError, setEditorLocalError] = useState<string | null>(null);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>(
    routeFilter === "day" || routeFilter === "week" || routeFilter === "cycle"
      ? routeFilter
      : "week",
  );
  const [dayPointer, setDayPointer] = useState<string | null>(
    isValidLocalDate(routeDate) ? routeDate : null,
  );
  const [weekPointer, setWeekPointer] = useState<string | null>(null);
  const loadedCycleIdRef = useRef<string | null>(null);
  const canonicalizedSelectionRef = useRef<string | null>(null);
  const resolvedCycleId = state.status === "ready" ? state.cycle.id : undefined;

  useEffect(() => {
    if (routeFilter === "day") {
      setFilter("day");
      setDayPointer(isValidLocalDate(routeDate) ? routeDate : null);
      return;
    }

    if (routeFilter === "week" || routeFilter === "cycle") {
      setFilter(routeFilter);
    }
  }, [routeDate, routeFilter]);

  useEffect(() => {
    if (!resolvedCycleId) {
      return;
    }

    const canonicalSelection = `${routeCycleId ?? ""}->${resolvedCycleId}`;
    if (
      routeCycleId !== resolvedCycleId &&
      canonicalizedSelectionRef.current !== canonicalSelection
    ) {
      canonicalizedSelectionRef.current = canonicalSelection;
      router.setParams({ cycleId: resolvedCycleId });
    } else if (routeCycleId === resolvedCycleId) {
      canonicalizedSelectionRef.current = null;
    }

    if (
      loadedCycleIdRef.current !== null &&
      loadedCycleIdRef.current !== resolvedCycleId
    ) {
      setDayPointer(null);
      setWeekPointer(null);
      setEditor(null);
      setEditorLocalError(null);
      activityMutation.clearError();
    }
    loadedCycleIdRef.current = resolvedCycleId;
  }, [
    activityMutation.clearError,
    resolvedCycleId,
    routeCycleId,
    router,
  ]);

  const navigateToDay = useCallback(
    (localDate: string) => {
      setFilter("day");
      setDayPointer(localDate);
      router.setParams({ filter: "day", date: localDate });
    },
    [router],
  );

  const dismissEditor = useCallback(() => {
    setEditor(null);
    setEditorLocalError(null);
    activityMutation.clearError();
  }, [activityMutation.clearError]);

  const openArchive = useCallback(() => {
    setArchiveVisible(true);
  }, []);

  const dismissArchive = useCallback(() => {
    setArchiveVisible(false);
  }, []);

  const selectArchiveCycle = useCallback((cycleId: string) => {
    setArchiveVisible(false);
    router.setParams({ cycleId });
  }, [router]);

  const repeatSelectedCycle = useCallback(() => {
    if (!resolvedCycleId) {
      return;
    }

    router.push(
      `/setup/duration?repeatCycleId=${encodeURIComponent(resolvedCycleId)}`,
    );
  }, [resolvedCycleId, router]);

  const openSelectedWrapUp = useCallback(() => {
    if (!resolvedCycleId) {
      return;
    }

    router.push(`/cycles/${encodeURIComponent(resolvedCycleId)}/summary`);
  }, [resolvedCycleId, router]);

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

  const { archiveItems, cycle, cycles, goals, revisions, logs } = state;
  const today = todayLocalDate();
  const upperBoundDate = cycle.status === "active" && today < cycle.endDate
    ? today
    : cycle.endDate;
  const selectedDay = dayPointer !== null &&
    dayPointer >= cycle.startDate &&
    dayPointer <= upperBoundDate
    ? dayPointer
    : upperBoundDate;
  const minWeekStart = weekStart(cycle.startDate);
  const maxWeekStart = weekStart(upperBoundDate);
  const currentWeek = weekPointer !== null &&
    weekPointer >= minWeekStart &&
    weekPointer <= maxWeekStart
    ? weekPointer
    : maxWeekStart;
  const statusLabel = cycle.status === "active"
    ? "Active cycle"
    : cycle.status === "ended_early"
      ? "Ended early"
      : "Completed cycle";
  const selectedArchiveItem = archiveItems.find((item) => item.id === cycle.id);

  const openAddEditor = (
    localDate: string,
    practiceId = goals.find((goal) => isGoalActiveOn(goal, localDate))?.id ?? "",
  ) => {
    activityMutation.clearError();
    setEditorLocalError(null);
    setEditor({
      mode: "add",
      localDate,
      practiceId,
      startedTime: currentLocalClockTime(),
    });
  };

  const openEditEditor = (sourceSessionId: string) => {
    const session = logs.find((candidate) => candidate.id === sourceSessionId);
    if (!session) {
      return;
    }
    activityMutation.clearError();
    setEditorLocalError(null);
    setEditor({ mode: "edit", session });
  };

  const finishMutation = (effectiveDate: string) => {
    setEditor(null);
    setEditorLocalError(null);
    navigateToDay(effectiveDate);
    setFocusVersion((version) => version + 1);
  };

  const saveActivity = async (value: ActivityEditorValue) => {
    if (!editor) {
      return;
    }

    setEditorLocalError(null);
    try {
      const startedAt = activityInstantFromLocalFields(
        value.localDate,
        value.startedTime,
      );
      const saved = editor.mode === "add"
        ? await activityMutation.createSession({
            cycleGoalId: value.practiceId,
            startedAt,
            durationMinutes: value.durationMinutes,
          })
        : await activityMutation.correctSession(editor.session.id, {
            cycleGoalId: value.practiceId,
            startedAt,
            durationMinutes: value.durationMinutes,
          });
      finishMutation(saved.localDate);
    } catch (reason) {
      setEditorLocalError(
        reason instanceof Error ? reason.message : "Could not save this activity.",
      );
    }
  };

  const deleteActivity = async () => {
    if (editor?.mode !== "edit") {
      return;
    }
    try {
      await activityMutation.deleteSession(editor.session.id);
      finishMutation(editor.session.localDate);
    } catch {
      // The hook retains a retryable error while the editor stays open.
    }
  };

  const editorInitialValue: ActivityEditorValue | null = editor === null
    ? null
    : editor.mode === "add"
      ? {
          practiceId: editor.practiceId,
          localDate: editor.localDate,
          startedTime: editor.startedTime,
          durationMinutes: null,
        }
      : {
          practiceId: editor.session.cycleGoalId,
          localDate: editor.session.localDate,
          startedTime: localClockTimeForInstant(editor.session.startedAt),
          durationMinutes: editor.session.durationMinutes,
        };
  const grandfatheredSession = editor?.mode === "edit" ? editor.session : null;

  return (
    <>
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
        <Pressable
          accessibilityHint="Opens the cycle archive."
          accessibilityLabel={`Cycle archive, ${cycles.length} ${cycles.length === 1 ? "cycle" : "cycles"}`}
          accessibilityRole="button"
          onPress={openArchive}
          style={({ pressed }) => [
            styles.cycleSelector,
            pressed ? styles.cycleSelectorPressed : null,
          ]}
        >
          <View style={styles.cycleSelectorCopy}>
            <Text style={styles.cycleSelectorKicker}>{statusLabel}</Text>
            <Text numberOfLines={1} style={styles.cycleSelectorName}>
              {cycle.name}
            </Text>
            {selectedArchiveItem ? (
              <Text style={styles.cycleSelectorDates}>
                {selectedArchiveItem.dateRange}
              </Text>
            ) : null}
          </View>
          <Text accessibilityElementsHidden style={styles.cycleSelectorAction}>
            Browse
          </Text>
        </Pressable>
        {cycle.status === "completed" || cycle.status === "ended_early" ? (
          <View style={styles.finishedActions}>
            <Pressable
              accessibilityHint="Opens the wrap-up for this finished cycle."
              accessibilityRole="button"
              onPress={openSelectedWrapUp}
              style={({ pressed }) => [
                styles.repeatButton,
                pressed ? styles.repeatButtonPressed : null,
              ]}
            >
              <Text style={styles.repeatButtonText}>View wrap-up</Text>
            </Pressable>
            <Pressable
              accessibilityHint="Prefills a new editable setup without copying activity."
              accessibilityRole="button"
              onPress={repeatSelectedCycle}
              style={({ pressed }) => [
                styles.repeatButton,
                pressed ? styles.repeatButtonPressed : null,
              ]}
            >
              <Text style={styles.repeatButtonText}>Repeat cycle</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View accessibilityRole="tablist" style={styles.filterRow}>
        {FILTERS.map((option) => {
          const selected = filter === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (option.key === "day") {
                  navigateToDay(selectedDay);
                  return;
                }
                setFilter(option.key);
              }}
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
          onPrevious={() => navigateToDay(addLocalDays(selectedDay, -1))}
          onNext={() => navigateToDay(addLocalDays(selectedDay, 1))}
          onAddActivity={() => openAddEditor(selectedDay)}
          onEditActivity={openEditEditor}
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
          maximumInteractiveDate={upperBoundDate}
          selectedDate={selectedDay}
          onSelectDay={navigateToDay}
        />
      ) : null}
      </ScrollView>

      <CycleArchiveSheet
        visible={archiveVisible}
        items={archiveItems}
        selectedCycleId={cycle.id}
        onSelectCycle={selectArchiveCycle}
        onDismiss={dismissArchive}
      />

      {editorInitialValue ? (
        <ActivityEditorSheet
          mode={editor!.mode}
          visible
          practices={[]}
          practicesForDate={(localDate) =>
            goals
              .filter(
                (goal) =>
                  isGoalActiveOn(goal, localDate) ||
                  (grandfatheredSession !== null &&
                    goal.id === grandfatheredSession.cycleGoalId &&
                    localDate === grandfatheredSession.localDate),
              )
              .map((goal) => ({
                id: goal.id,
                name: goalConfigurationOn(goal, revisions, localDate).name,
              }))
          }
          initialValue={editorInitialValue}
          minDate={cycle.startDate}
          maxDate={upperBoundDate}
          onDismiss={dismissEditor}
          onSave={saveActivity}
          onDelete={editor!.mode === "edit" ? deleteActivity : undefined}
          isSaving={activityMutation.isSaving}
          isDeleting={activityMutation.isDeleting}
          error={editorLocalError ?? activityMutation.error?.message ?? null}
        />
      ) : null}
    </>
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
  onAddActivity,
  onEditActivity,
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
  onAddActivity: () => void;
  onEditActivity: (sourceSessionId: string) => void;
}) {
  const summary = buildDaySummary(goals, revisions, logs, selectedDate);
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
        <MetricCard value={String(summary.sessionCount)} label="sessions" />
        <MetricCard value={formatMinutes(summary.minutesLogged)} label="logged" />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onAddActivity}
        style={({ pressed }) => [
          styles.addActivityButton,
          pressed ? styles.addActivityButtonPressed : null,
        ]}
      >
        <Text style={styles.addActivityButtonText}>Add activity</Text>
      </Pressable>

      <SectionHeading
        label="Activity timeline"
        detail={`${summary.sessionCount} ${summary.sessionCount === 1 ? "session" : "sessions"}`}
      />
      {summary.sessions.length > 0 ? (
        <View style={styles.paperCard}>
          {summary.sessions.map((session, index) => {
            const time = formatSessionTime(session.startedAt);
            const duration = session.durationMinutes === null
              ? "Duration not recorded"
              : formatMinutes(session.durationMinutes);
            return (
              <Pressable
                key={session.id}
                accessibilityLabel={`Edit ${session.practiceName} activity, ${time}, ${duration}`}
                accessibilityRole="button"
                onPress={() => onEditActivity(session.id)}
                style={({ pressed }) => [
                  styles.timelineRow,
                  index > 0 ? styles.rowDivider : null,
                  pressed ? styles.timelineRowPressed : null,
                ]}
              >
                <View style={styles.timelineTimeColumn}>
                  <Text style={styles.timelineTime}>{time}</Text>
                  <View style={styles.timelineDot} />
                </View>
                <View style={styles.practiceCopy}>
                  <Text style={styles.practiceName}>{session.practiceName}</Text>
                  <Text style={styles.practiceMeta}>{duration}</Text>
                </View>
                <Text accessibilityElementsHidden style={styles.editAffordance}>Edit</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.quietState}>
          <Text style={styles.quietStateText}>No activities logged on this day.</Text>
        </View>
      )}

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
  const summary = buildWeekSummary(goals, revisions, logs, currentWeek, cycle);
  const previousSummary = currentWeek > minWeekStart
    ? buildWeekSummary(
        goals,
        revisions,
        logs,
        addLocalDays(currentWeek, -7),
        cycle,
      )
    : null;
  const prevDisabled = currentWeek <= minWeekStart;
  const nextDisabled = currentWeek >= maxWeekStart;
  const eligiblePractices = summary.practiceProgress.filter(
    (practice) => practice.membership === "full",
  );
  const reachedTargetCount = eligiblePractices.filter((practice) => practice.met).length;
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
          value={`${reachedTargetCount}/${eligiblePractices.length}`}
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
      {practice.membership === "partial" ? (
        <Text style={styles.practiceMeta}>
          Partial week · sessions and minutes shown, target not scored
        </Text>
      ) : null}
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
  maximumInteractiveDate,
  selectedDate,
  onSelectDay,
}: {
  cycle: Cycle;
  goals: CycleGoal[];
  revisions: GoalRevision[];
  logs: SessionLog[];
  today: string;
  maximumInteractiveDate: string;
  selectedDate: string;
  onSelectDay: (localDate: string) => void;
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
          maximumInteractiveDate={maximumInteractiveDate}
          onSelectDay={onSelectDay}
          selectedDate={selectedDate}
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
  cycleSelector: {
    alignItems: "center",
    backgroundColor: "#FFFEFA",
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cycleSelectorPressed: {
    opacity: 0.72,
  },
  cycleSelectorCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cycleSelectorKicker: {
    color: colors.verdigris,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  cycleSelectorName: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 19,
  },
  cycleSelectorDates: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  cycleSelectorAction: {
    color: colors.verdigris,
    fontSize: 14,
    fontWeight: "700",
  },
  finishedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  repeatButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.verdigris,
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  repeatButtonPressed: {
    opacity: 0.7,
  },
  repeatButtonText: {
    color: colors.verdigris,
    fontSize: 14,
    fontWeight: "700",
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
  addActivityButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.verdigris,
    borderCurve: "continuous",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  addActivityButtonPressed: {
    opacity: 0.78,
  },
  addActivityButtonText: {
    color: colors.inkOnDark,
    fontSize: 14,
    fontWeight: "700",
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
  timelineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  timelineRowPressed: {
    opacity: 0.65,
  },
  timelineTimeColumn: {
    alignItems: "center",
    gap: spacing.xs,
    width: 72,
  },
  timelineTime: {
    color: colors.mutedInk,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  timelineDot: {
    backgroundColor: colors.verdigris,
    borderCurve: "continuous",
    borderRadius: 4,
    height: 6,
    width: 6,
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
  editAffordance: {
    color: colors.verdigris,
    fontSize: 13,
    fontWeight: "700",
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
