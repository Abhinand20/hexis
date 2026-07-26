import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../src/design/tokens";
import { useDatabase } from "../../../../src/db/DatabaseProvider";
import { createCycleRepository } from "../../../../src/features/cycles/data/cycleRepository";
import { goalConfigurationOn } from "../../../../src/features/cycles/domain/cycleProgress";
import type { GoalConfiguration } from "../../../../src/features/cycles/domain/types";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../../../src/features/goals/components/GoalEditor";
import { createGoalRepository } from "../../../../src/features/goals/data/goalRepository";
import { useUpdateGoal } from "../../../../src/features/goals/hooks/useUpdateGoal";

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      initialValue: GoalEditorValue;
      today: string;
    };

export default function EditGoalScreen() {
  const { cycleId, goalId } = useLocalSearchParams<{
    cycleId: string;
    goalId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { db } = useDatabase();
  const { updateGoal, isPending } = useUpdateGoal();

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      return;
    }

    let cancelled = false;

    async function load() {
      const cycle = await createCycleRepository(db!).getActiveCycle();
      if (cancelled) {
        return;
      }

      if (!cycle || cycle.id !== cycleId) {
        setLoadState({ status: "unavailable" });
        return;
      }

      const goals = await createGoalRepository(db!).listForCycle(cycleId);
      if (cancelled) {
        return;
      }

      const goal = goals.find((entry) => entry.id === goalId);
      if (!goal) {
        setLoadState({ status: "unavailable" });
        return;
      }

      const revisions = await createGoalRepository(db!).listRevisions(goalId);
      if (cancelled) {
        return;
      }

      const today = formatLocalDate(new Date());
      const config: GoalConfiguration = goalConfigurationOn(
        goal,
        revisions,
        today,
      );

      setLoadState({
        status: "ready",
        today,
        initialValue: {
          name: config.name,
          cadence: config.cadence,
          weeklyTargetCount: config.weeklyTargetCount,
          expectedDurationMinutes: config.expectedDurationMinutes,
        },
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db, cycleId, goalId]);

  function goBack() {
    router.replace(`/cycles/${cycleId}`);
  }

  async function handleSave(value: GoalEditorValue) {
    if (loadState.status !== "ready") {
      return;
    }

    setSubmitError(null);

    try {
      await updateGoal({
        cycleGoalId: goalId,
        effectiveDate: loadState.today,
        name: value.name,
        cadence: value.cadence,
        weeklyTargetCount: value.weeklyTargetCount,
        expectedDurationMinutes: value.expectedDurationMinutes,
      });
      router.replace(`/cycles/${cycleId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setSubmitError(message);
    }
  }

  if (loadState.status === "loading") {
    return null;
  }

  if (loadState.status === "unavailable") {
    return (
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.section}>
          <Text style={styles.copy}>This cycle is no longer active.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={goBack}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Back to cycle</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.section}>
        <Text style={styles.heading}>Edit practice</Text>
        <Text style={styles.copy}>
          Changes apply from today. Earlier logged sessions won't change.
        </Text>
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      </View>

      <GoalEditor
        initialValue={loadState.initialValue}
        mode="editingActiveGoal"
        onCancel={goBack}
        onSave={(value) => {
          if (!isPending) {
            void handleSave(value);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  heading: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "600",
  },
  copy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
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
