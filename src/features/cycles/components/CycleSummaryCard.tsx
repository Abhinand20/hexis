import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import type { CycleAchievementSummary } from "../domain/cycleSummary";

export type CycleSummaryCardProps = {
  cycleName: string;
  summary: CycleAchievementSummary;
};

function practiceLine(practice: CycleAchievementSummary["practiceTotals"][number]): string {
  const sessions = `${practice.completedCount} session${
    practice.completedCount === 1 ? "" : "s"
  }`;
  const minutes = `${practice.minutesLogged} min`;
  return `${sessions} · ${minutes}`;
}

export function CycleSummaryCard({ cycleName, summary }: CycleSummaryCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{cycleName}</Text>
      <Text style={styles.meta}>
        {summary.activeDayCount} active days · {summary.loggedDayCount} days with
        logged effort
      </Text>

      <Text style={styles.sectionLabel}>Practices</Text>
      {summary.practiceTotals.length === 0 ? (
        <Text style={styles.fallback}>No practices in this cycle</Text>
      ) : (
        summary.practiceTotals.map((practice) => (
          <View key={practice.goalId} style={styles.practiceRow}>
            <Text style={styles.practiceName}>{practice.name}</Text>
            <Text style={styles.practiceMeta}>{practiceLine(practice)}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Highlights</Text>
      {summary.strongestWeekLabel ? (
        <Text style={styles.highlight}>
          Strongest week: {summary.strongestWeekLabel}
        </Text>
      ) : (
        <Text style={styles.fallback}>No sessions logged</Text>
      )}
      {summary.mostLoggedPracticeName ? (
        <Text style={styles.highlight}>
          Most logged: {summary.mostLoggedPracticeName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: "100%",
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "600",
  },
  meta: {
    color: colors.mutedInk,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: spacing.md,
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
  highlight: {
    color: colors.ink,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  fallback: {
    color: colors.mutedInk,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
