import { StyleSheet, Text } from "react-native";

import { GlassSurface } from "../../../design/GlassSurface";
import { colors, spacing } from "../../../design/tokens";
import { formatWeight, gramsToUnit } from "../domain/units";
import type { WeightUnit } from "../domain/types";
import type { WeightPeriodComparison } from "../domain/weightAverages";

function formatSignedWeight(grams: number, unit: WeightUnit): string {
  const value = gramsToUnit(grams, unit);
  const formatted = `${value.toFixed(1)} ${unit}`;
  return value > 0 ? `+${formatted}` : formatted;
}

function formatRange(lowestGrams: number, highestGrams: number, unit: WeightUnit): string {
  return `${gramsToUnit(lowestGrams, unit).toFixed(1)}–${formatWeight(highestGrams, unit)}`;
}

export function WeightPeriodCard({
  title,
  comparison,
  unit,
  emptyComparisonCopy,
}: {
  title: string;
  comparison: WeightPeriodComparison;
  unit: WeightUnit;
  emptyComparisonCopy: string;
}) {
  const { period, averageDifferenceGrams } = comparison;
  const averageLabel =
    period.averageGrams === null
      ? "No average yet"
      : formatWeight(period.averageGrams, unit);
  const showCoverage = period.recordedDays < period.periodDays;
  const rangeLabel =
    period.lowestGrams !== null && period.highestGrams !== null
      ? formatRange(period.lowestGrams, period.highestGrams, unit)
      : null;
  const changeLabel =
    averageDifferenceGrams === null
      ? emptyComparisonCopy
      : formatSignedWeight(averageDifferenceGrams, unit);

  return (
    <GlassSurface style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text
        accessibilityLabel={`${title} average, ${averageLabel}`}
        style={styles.average}
      >
        {averageLabel}
      </Text>
      {showCoverage ? (
        <Text
          accessibilityLabel={`${title} coverage, ${period.recordedDays} of ${period.periodDays} days`}
          style={styles.meta}
        >
          {period.recordedDays} of {period.periodDays} days
        </Text>
      ) : null}
      {rangeLabel ? (
        <Text accessibilityLabel={`${title} range, ${rangeLabel}`} style={styles.meta}>
          {rangeLabel}
        </Text>
      ) : null}
      <Text
        accessibilityLabel={
          averageDifferenceGrams === null
            ? `${title} comparison unavailable`
            : `${title} change, ${changeLabel}`
        }
        style={styles.meta}
      >
        {changeLabel}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  average: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 28,
    fontVariant: ["tabular-nums"],
    lineHeight: 34,
  },
  meta: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
});
