import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../design/tokens";
import { todayLocalDate } from "../../cycles/domain/date";
import type { SessionLog } from "../../cycles/domain/types";
import { useLogSession } from "../hooks/useLogSession";

const QUICK_DURATIONS = [15, 30, 45, 60, 90] as const;

function durationOptions(expectedDurationMinutes: number | null): number[] {
  if (
    expectedDurationMinutes === null ||
    (QUICK_DURATIONS as readonly number[]).includes(expectedDurationMinutes)
  ) {
    return [...QUICK_DURATIONS];
  }

  return [...QUICK_DURATIONS, expectedDurationMinutes].sort((a, b) => a - b);
}

export type LogSessionGoal = {
  id: string;
  name: string;
  expectedDurationMinutes: number | null;
};

export type LogSessionSheetProps = {
  goal: LogSessionGoal;
  visible: boolean;
  onDismiss: () => void;
  onLogged?: (log: SessionLog) => void;
};

export function LogSessionSheet({
  goal,
  visible,
  onDismiss,
  onLogged,
}: LogSessionSheetProps) {
  const insets = useSafeAreaInsets();
  const { logSession, isPending } = useLogSession();

  const initialDuration = goal.expectedDurationMinutes;
  const selectableDurations = durationOptions(goal.expectedDurationMinutes);

  const [selectedDuration, setSelectedDuration] = useState<number | null>(
    initialDuration,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  function toggleDuration(duration: number) {
    setSubmitError(null);
    setSelectedDuration((current) => (current === duration ? null : duration));
  }

  async function handleSave() {
    setSubmitError(null);
    try {
      const log = await logSession({
        cycleGoalId: goal.id,
        localDate: todayLocalDate(),
        durationMinutes: selectedDuration,
      });
      onLogged?.(log);
      onDismiss();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  const saveLabel =
    selectedDuration === null ? "Save" : `Save ${selectedDuration} min`;

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}
        >
          <Text style={styles.title}>Log {goal.name}</Text>

          <View style={styles.row}>
            {selectableDurations.map((duration) => {
              const selected = selectedDuration === duration;
              return (
                <Pressable
                  key={duration}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => toggleDuration(duration)}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text
                    style={[styles.chipText, selected ? styles.chipTextSelected : null]}
                  >
                    {duration} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isPending}
              onPress={() => {
                if (!isPending) {
                  void handleSave();
                }
              }}
              style={[
                styles.primaryButton,
                isPending ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(27, 27, 25, 0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.porcelain,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  chipText: {
    color: colors.ink,
    fontSize: 15,
  },
  chipTextSelected: {
    color: colors.inkOnDark,
    fontWeight: "600",
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
  },
});
