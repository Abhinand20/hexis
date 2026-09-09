import { useCallback, useState } from "react";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "../../../src/design/GlassSurface";
import { colors, spacing } from "../../../src/design/tokens";
import { formatCycleDateRange } from "../../../src/features/cycles/domain/cycleArchive";
import type {
  WrapUpComparison,
  WrapUpMetrics,
} from "../../../src/features/cycles/domain/cycleWrapUp";
import type { Cycle } from "../../../src/features/cycles/domain/types";
import { useCycleWrapUp } from "../../../src/features/cycles/hooks/useCycleWrapUp";

function parameterValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatOneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatWholeOrOne(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSigned(value: number, asDecimal: boolean): string {
  const text = asDecimal ? formatOneDecimal(value) : formatWholeOrOne(value);
  if (value > 0 && !text.startsWith("+")) {
    return `+${text}`;
  }
  return text;
}

function statusLabel(status: Cycle["status"]): string {
  return status === "ended_early" ? "Ended early" : "Completed";
}

function mostLoggedLabel(metrics: WrapUpMetrics): string | null {
  if (metrics.mostLoggedPractices.length === 0) {
    return null;
  }
  if (metrics.mostLoggedPractices.length === 1) {
    return metrics.mostLoggedPractices[0].name;
  }
  return `joint most-logged: ${metrics.mostLoggedPractices
    .map((practice) => practice.name)
    .join(", ")}`;
}

export default function CycleWrapUpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cycleId?: string | string[] }>();
  const cycleId = parameterValue(params.cycleId);
  const [baselineCycleId, setBaselineCycleId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshVersion((version) => version + 1);
    }, []),
  );

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const state = useCycleWrapUp(cycleId, baselineCycleId, refreshVersion);

  const repeatCycle = useCallback(() => {
    if (state.status !== "ready") {
      return;
    }
    router.push(
      `/setup/duration?repeatCycleId=${encodeURIComponent(state.cycle.id)}`,
    );
  }, [router, state]);

  const seeFullActivity = useCallback(() => {
    if (state.status !== "ready") {
      return;
    }
    router.push(`/history?cycleId=${encodeURIComponent(state.cycle.id)}`);
  }, [router, state]);

  if (state.status === "loading") {
    return (
      <View
        accessibilityLabel="Loading cycle wrap-up"
        accessibilityLiveRegion="polite"
        style={[
          styles.screen,
          styles.centered,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <ActivityIndicator color={colors.verdigris} size="small" />
        <Text style={styles.loadingLabel}>Loading this wrap-up…</Text>
      </View>
    );
  }

  if (state.status === "not_found") {
    return (
      <StatusMessage
        title="This wrap-up could not be found."
        copy="The cycle may have been removed."
        onBack={goBack}
      />
    );
  }

  if (state.status === "active_cycle") {
    return (
      <StatusMessage
        title="This cycle is still in progress."
        copy="Wrap-up is available after the cycle completes or ends early."
        onBack={goBack}
      />
    );
  }

  if (state.status === "error") {
    return (
      <StatusMessage
        title="This wrap-up is unavailable."
        copy={state.message}
        onBack={goBack}
      />
    );
  }

  const { cycle, metrics, baselines, comparison } = state;
  const mostLogged = mostLoggedLabel(metrics);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <Text accessibilityRole="header" style={styles.cycleName}>
        {cycle.name}
      </Text>
      <Text style={styles.meta}>
        {formatCycleDateRange(cycle.startDate, cycle.endDate)}
      </Text>
      <Text style={styles.meta}>
        {metrics.cycleDays} {metrics.cycleDays === 1 ? "day" : "days"} ·{" "}
        {statusLabel(cycle.status)}
      </Text>

      {metrics.sessions === 0 ? (
        <Text style={styles.emptySessions}>No sessions recorded</Text>
      ) : null}

      <GlassSurface style={styles.metricsCard}>
        <Metric
          value={String(metrics.sessions)}
          label={metrics.sessions === 1 ? "session" : "sessions"}
        />
        <Metric
          value={String(metrics.recordedMinutes)}
          label="recorded minutes"
        />
        <Metric
          value={`${metrics.activeDays} of ${metrics.cycleDays}`}
          label="active days"
        />
        <Metric
          value={`${formatWholeOrOne(metrics.activityDayPercentage)}%`}
          label="activity-day percentage"
        />
        {metrics.sessions > 0 &&
        metrics.sessionsWithRecordedDuration < metrics.sessions ? (
          <Text style={styles.coverage}>
            Minutes recorded for {metrics.sessionsWithRecordedDuration} of{" "}
            {metrics.sessions} sessions
          </Text>
        ) : null}
        <Text style={styles.rateLine}>
          {formatOneDecimal(metrics.sessionsPerWeek)} sessions/week ·{" "}
          {formatOneDecimal(metrics.recordedMinutesPerWeek)} recorded minutes/week
        </Text>
      </GlassSurface>

      <Text style={styles.sectionLabel}>Comparison</Text>
      {baselines.length === 0 ? (
        <Text style={styles.fallback}>
          Your next cycle will have a comparison.
        </Text>
      ) : (
        <ComparisonBlock
          baselines={baselines}
          comparison={comparison}
          selectedBaselineId={comparison?.baseline.id ?? baselines[0].id}
          onSelectBaseline={setBaselineCycleId}
        />
      )}

      <Text style={styles.sectionLabel}>Highlights</Text>
      <Text style={styles.highlight}>
        Longest active-day run: {metrics.longestActiveDayRun}{" "}
        {metrics.longestActiveDayRun === 1 ? "day" : "days"}
      </Text>
      {metrics.busiestWeek ? (
        <Text style={styles.highlight}>
          Busiest week: {formatCycleDateRange(
            metrics.busiestWeek.weekStartDate,
            metrics.busiestWeek.weekEndDate,
          )}{" "}
          · {metrics.busiestWeek.sessions}{" "}
          {metrics.busiestWeek.sessions === 1 ? "session" : "sessions"}
          {metrics.busiestWeek.isPartialWeek ? " · Partial week" : ""}
        </Text>
      ) : (
        <Text style={styles.fallback}>No busiest week</Text>
      )}
      {mostLogged ? (
        <Text style={styles.highlight}>
          {mostLogged.startsWith("joint most-logged")
            ? mostLogged.charAt(0).toUpperCase() + mostLogged.slice(1)
            : `Most logged: ${mostLogged}`}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={repeatCycle}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>Repeat cycle</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={seeFullActivity}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>See full activity</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatusMessage({
  title,
  copy,
  onBack,
}: {
  title: string;
  copy: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        styles.centered,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Go back</Text>
      </Pressable>
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ComparisonBlock({
  baselines,
  comparison,
  selectedBaselineId,
  onSelectBaseline,
}: {
  baselines: Cycle[];
  comparison: WrapUpComparison | null;
  selectedBaselineId: string;
  onSelectBaseline: (cycleId: string) => void;
}) {
  return (
    <View style={styles.comparison}>
      <Text style={styles.selectorKicker}>Earlier finished cycle</Text>
      {baselines.map((baseline) => {
        const selected = baseline.id === selectedBaselineId;
        return (
          <Pressable
            key={baseline.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${baseline.name}, ${statusLabel(baseline.status)}`}
            onPress={() => onSelectBaseline(baseline.id)}
            style={[
              styles.baselineButton,
              selected ? styles.baselineButtonSelected : null,
            ]}
          >
            <Text style={styles.baselineName}>{baseline.name}</Text>
            <Text style={styles.baselineMeta}>
              {formatCycleDateRange(baseline.startDate, baseline.endDate)} ·{" "}
              {statusLabel(baseline.status)}
            </Text>
          </Pressable>
        );
      })}
      {comparison ? <ComparisonValues comparison={comparison} /> : null}
    </View>
  );
}

function ComparisonValues({ comparison }: { comparison: WrapUpComparison }) {
  const { selected, baselineMetrics, differences } = comparison;
  return (
    <View style={styles.comparisonValues}>
      {comparison.hasDifferentLengths ? (
        <Text style={styles.lengthNote}>
          Cycles have different lengths ({selected.cycleDays} days vs{" "}
          {baselineMetrics.cycleDays} days). Activity-day percentage and
          sessions per week describe pace across those lengths.
        </Text>
      ) : null}
      <ComparisonRow
        label="Sessions"
        selected={String(selected.sessions)}
        baseline={String(baselineMetrics.sessions)}
        difference={formatSigned(differences.sessions, false)}
      />
      <ComparisonRow
        label="Recorded minutes"
        selected={String(selected.recordedMinutes)}
        baseline={String(baselineMetrics.recordedMinutes)}
        difference={formatSigned(differences.recordedMinutes, false)}
      />
      <ComparisonRow
        label="Active days"
        selected={String(selected.activeDays)}
        baseline={String(baselineMetrics.activeDays)}
        difference={formatSigned(differences.activeDays, false)}
      />
      <ComparisonRow
        label="Activity-day percentage"
        selected={`${formatWholeOrOne(selected.activityDayPercentage)}%`}
        baseline={`${formatWholeOrOne(baselineMetrics.activityDayPercentage)}%`}
        difference={`${formatSigned(differences.activityDayPercentagePoints, true)} percentage points`}
      />
      <ComparisonRow
        label="Sessions per week"
        selected={formatOneDecimal(selected.sessionsPerWeek)}
        baseline={formatOneDecimal(baselineMetrics.sessionsPerWeek)}
        difference={formatSigned(differences.sessionsPerWeek, true)}
      />
      <ComparisonRow
        label="Recorded minutes per week"
        selected={formatOneDecimal(selected.recordedMinutesPerWeek)}
        baseline={formatOneDecimal(baselineMetrics.recordedMinutesPerWeek)}
        difference={formatSigned(differences.recordedMinutesPerWeek, true)}
      />
      {selected.sessions > 0 &&
      selected.sessionsWithRecordedDuration < selected.sessions ? (
        <Text style={styles.coverage}>
          Minutes recorded for {selected.sessionsWithRecordedDuration} of{" "}
          {selected.sessions} sessions in this cycle
        </Text>
      ) : null}
      {baselineMetrics.sessions > 0 &&
      baselineMetrics.sessionsWithRecordedDuration < baselineMetrics.sessions ? (
        <Text style={styles.coverage}>
          Minutes recorded for {baselineMetrics.sessionsWithRecordedDuration} of{" "}
          {baselineMetrics.sessions} sessions in the compared cycle
        </Text>
      ) : null}
    </View>
  );
}

function ComparisonRow({
  label,
  selected,
  baseline,
  difference,
}: {
  label: string;
  selected: string;
  baseline: string;
  difference: string;
}) {
  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonLabel}>{label}</Text>
      <Text style={styles.comparisonFigures}>
        {selected} vs {baseline} ({difference})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  centered: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  cycleName: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
  },
  meta: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
  emptySessions: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  metricsCard: {
    borderRadius: 16,
    gap: spacing.md,
    overflow: "hidden",
    padding: spacing.lg,
  },
  metric: {
    gap: 2,
  },
  metricValue: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    lineHeight: 34,
  },
  metricLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  coverage: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
  rateLine: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  fallback: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
  highlight: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  comparison: {
    gap: spacing.sm,
  },
  selectorKicker: {
    color: colors.verdigris,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  baselineButton: {
    backgroundColor: "#FFFEFA",
    borderColor: colors.hairline,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  baselineButtonSelected: {
    borderColor: colors.verdigris,
  },
  baselineName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  baselineMeta: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  comparisonValues: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  lengthNote: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  comparisonRow: {
    gap: 2,
  },
  comparisonLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  comparisonFigures: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.verdigris,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.verdigris,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyCopy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  loadingLabel: {
    color: colors.mutedInk,
    fontSize: 15,
  },
});
