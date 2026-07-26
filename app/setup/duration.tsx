import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import type { CycleDurationDays } from "../../src/features/cycles/domain/types";
import { useCycleSetupState } from "../../src/features/cycles/hooks/useCycleSetupState";

const DURATION_OPTIONS: CycleDurationDays[] = [30, 60, 90];

export default function DurationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { durationDays, selectDuration } = useCycleSetupState();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xxl + insets.bottom },
      ]}
    >
      <View style={styles.section}>
        <Text style={styles.heading}>Start a focus cycle</Text>
        <Text style={styles.copy}>
          This is a finite focus cycle — a short, deliberate window to practice a
          small group of habits together, then take stock.
        </Text>
        <Text style={styles.subheading}>How long?</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((option) => {
            const selected = durationDays === option;
            const label = `${option} days`;
            return (
              <Pressable
                key={option}
                accessibilityLabel={label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => selectDuration(option)}
                style={[
                  styles.durationButton,
                  selected ? styles.durationButtonSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.durationButtonText,
                    selected ? styles.durationButtonTextSelected : null,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/setup/practices")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "600",
  },
  subheading: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  copy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
  },
  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  durationButton: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  durationButtonSelected: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  durationButtonText: {
    color: colors.ink,
    fontSize: 15,
  },
  durationButtonTextSelected: {
    color: colors.inkOnDark,
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "600",
  },
});
