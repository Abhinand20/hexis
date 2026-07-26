import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { ProgressLine } from "./ProgressLine";

export type CycleHeaderProps = {
  cycleName: string;
  dayLabel: string;
  daysRemainingLabel: string;
  overallProgressRatio: number;
};

export function CycleHeader({
  cycleName,
  dayLabel,
  daysRemainingLabel,
  overallProgressRatio,
}: CycleHeaderProps) {
  const activePercent = Math.round(
    Math.max(0, Math.min(1, overallProgressRatio)) * 100,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{cycleName}</Text>
      <Text style={styles.dayLabel}>{dayLabel}</Text>
      <Text style={styles.remaining}>{daysRemainingLabel}</Text>
      <ProgressLine
        ratio={overallProgressRatio}
        label={`${activePercent}% of days active`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "600",
  },
  dayLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
  },
  remaining: {
    color: colors.mutedInk,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
