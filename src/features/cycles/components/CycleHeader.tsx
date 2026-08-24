import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";

export type CycleHeaderProps = {
  cycleName: string;
  dayLabel: string;
  daysRemainingLabel: string;
};

export function CycleHeader({
  cycleName,
  dayLabel,
  daysRemainingLabel,
}: CycleHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Active cycle</Text>
      <Text accessibilityRole="header" style={styles.name}>
        {cycleName}
      </Text>
      <View
        accessible
        accessibilityLabel={`${dayLabel}. ${daysRemainingLabel}.`}
        style={styles.context}
      >
        <Text accessibilityElementsHidden style={styles.dayLabel}>
          {dayLabel}
        </Text>
        <Text accessibilityElementsHidden style={styles.dot}>
          ·
        </Text>
        <Text accessibilityElementsHidden style={styles.remaining}>
          {daysRemainingLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.verdigris,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "700",
  },
  context: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dayLabel: {
    color: colors.mutedInk,
    fontSize: 15,
    fontWeight: "600",
  },
  dot: {
    color: colors.mutedInk,
    fontSize: 15,
  },
  remaining: {
    color: colors.mutedInk,
    fontSize: 15,
  },
});
