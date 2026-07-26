import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";

export type ProgressLineProps = {
  ratio: number;
  label: string;
};

export function ProgressLine({ ratio, label }: ProgressLineProps) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const percent = Math.round(clampedRatio * 100);

  return (
    <View style={styles.container}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  track: {
    backgroundColor: colors.hairline,
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    backgroundColor: colors.verdigris,
    height: "100%",
  },
  label: {
    color: colors.mutedInk,
    fontSize: 13,
  },
});
