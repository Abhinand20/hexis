import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { ProgressLine } from "./ProgressLine";

export type WeekAtGlanceMetric = {
  logged: number;
  target: number | null;
  remaining: number | null;
  progressRatio: number | null;
};

export type WeekAtGlanceCardProps = {
  sessions: WeekAtGlanceMetric;
  minutes: WeekAtGlanceMetric | null;
  daysRemaining: number;
  hasPartialMembership: boolean;
};

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function hasEligibleTarget(metric: WeekAtGlanceMetric): boolean {
  return metric.target !== null && metric.target > 0;
}

type ProgressMetricProps = {
  metric: WeekAtGlanceMetric;
  noun: "session" | "minute";
};

function ProgressMetric({ metric, noun }: ProgressMetricProps) {
  const eligible = hasEligibleTarget(metric);
  const loggedLabel = pluralize(metric.logged, noun);

  if (!eligible) {
    return (
      <View
        accessible
        accessibilityLabel={`${loggedLabel} logged. No eligible weekly ${noun} target.`}
        style={styles.metric}
      >
        <Text accessibilityElementsHidden style={styles.metricValue}>
          {metric.logged === 0 ? `No ${noun}s logged yet` : `${loggedLabel} logged`}
        </Text>
        <Text accessibilityElementsHidden style={styles.metricDetail}>
          No eligible weekly target
        </Text>
      </View>
    );
  }

  const target = metric.target as number;
  const remaining = metric.remaining ?? Math.max(0, target - metric.logged);
  const ratio = metric.progressRatio ?? metric.logged / target;
  const targetLabel = pluralize(target, noun);
  const remainingLabel = `${pluralize(remaining, noun)} remaining`;
  const title = `${metric.logged} of ${target} ${noun}s`;
  const progressPercent = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const progressLabel = `${progressPercent}% of weekly ${noun} target`;

  return (
    <View style={styles.metric}>
      <View
        accessible
        accessibilityLabel={`${loggedLabel} logged of ${targetLabel}. ${remainingLabel}.`}
        style={styles.metricHeading}
      >
        <Text accessibilityElementsHidden style={styles.metricValue}>
          {title}
        </Text>
        <Text accessibilityElementsHidden style={styles.remaining}>
          {remainingLabel}
        </Text>
      </View>
      <ProgressLine label={progressLabel} ratio={ratio} />
    </View>
  );
}

export function WeekAtGlanceCard({
  sessions,
  minutes,
  daysRemaining,
  hasPartialMembership,
}: WeekAtGlanceCardProps) {
  const daysLabel = `${pluralize(daysRemaining, "calendar day")} left`;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          This week
        </Text>
        <Text accessibilityLabel={daysLabel} style={styles.daysRemaining}>
          {daysLabel}
        </Text>
      </View>

      <ProgressMetric metric={sessions} noun="session" />
      {minutes ? <ProgressMetric metric={minutes} noun="minute" /> : null}

      {hasPartialMembership ? (
        <View
          accessible
          accessibilityLabel="Partial week. New or stopped practices show their work, but do not add a target until a complete eligible week."
          style={styles.partialNotice}
        >
          <Text accessibilityElementsHidden style={styles.partialTitle}>
            Partial week
          </Text>
          <Text accessibilityElementsHidden style={styles.partialBody}>
            New or stopped practices show their work without adding a target until
            a complete eligible week.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    padding: spacing.lg,
    width: "100%",
  },
  heading: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  daysRemaining: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  metric: {
    gap: spacing.sm,
  },
  metricHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  metricDetail: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  remaining: {
    color: colors.verdigris,
    fontSize: 14,
    fontWeight: "600",
  },
  partialNotice: {
    backgroundColor: "#E4EEEA",
    borderCurve: "continuous",
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  partialTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  partialBody: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
});
