import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../src/design/tokens";
import { useDatabase } from "../../../../src/db/DatabaseProvider";
import { createCycleRepository } from "../../../../src/features/cycles/data/cycleRepository";
import { goalConfigurationOn } from "../../../../src/features/cycles/domain/cycleProgress";
import { todayLocalDate } from "../../../../src/features/cycles/domain/date";
import type { GoalConfiguration } from "../../../../src/features/cycles/domain/types";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../../../src/features/goals/components/GoalEditor";
import { createGoalRepository } from "../../../../src/features/goals/data/goalRepository";
import { useUpdateGoal } from "../../../../src/features/goals/hooks/useUpdateGoal";

type LoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      initialValue: GoalEditorValue;
      today: string;
      goalName: string;
      canStopTracking: boolean;
    };

function stopTrackingErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === "An active cycle must keep at least one practice"
  ) {
    return "Add another practice first, or end this cycle before stopping its last practice.";
  }

  return error instanceof Error
    ? error.message
    : "Unable to stop tracking this practice. Try again.";
}

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
  const [stopPending, setStopPending] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

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

      const today = todayLocalDate();
      const config: GoalConfiguration = goalConfigurationOn(
        goal,
        revisions,
        today,
      );

      setLoadState({
        status: "ready",
        today,
        goalName: config.name,
        canStopTracking:
          goal.activeFromDate < today &&
          (goal.inactiveFromDate === null || goal.inactiveFromDate > today),
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
    router.back();
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
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setSubmitError(message);
    }
  }

  function openStopConfirmation() {
    if (
      loadState.status !== "ready" ||
      !loadState.canStopTracking ||
      stopPending
    ) {
      return;
    }

    setStopError(null);
    const effectiveDate = todayLocalDate();
    Alert.alert(
      `Stop tracking ${loadState.goalName}?`,
      `This takes effect today, ${effectiveDate}. Earlier logs and history for this practice will remain unchanged.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop tracking",
          style: "destructive",
          onPress: () => {
            void handleStopTracking(effectiveDate);
          },
        },
      ],
    );
  }

  async function handleStopTracking(effectiveDate: string) {
    if (
      loadState.status !== "ready" ||
      !loadState.canStopTracking ||
      stopPending
    ) {
      return;
    }

    setStopPending(true);
    setStopError(null);

    try {
      await createGoalRepository(db!).stopTracking(goalId, effectiveDate);
      router.back();
    } catch (error) {
      setStopError(stopTrackingErrorMessage(error));
      setStopPending(false);
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
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <View style={styles.section}>
        <Text style={styles.copy}>
          Changes apply from today. Earlier logged sessions won't change.
        </Text>
      </View>

      <GoalEditor
        initialValue={loadState.initialValue}
        isSaving={isPending || stopPending}
        mode="editingActiveGoal"
        onCancel={goBack}
        onSave={(value) => {
          if (!isPending && !stopPending) {
            void handleSave(value);
          }
        }}
        secondaryAction={
          loadState.canStopTracking
            ? {
                accessibilityHint:
                  "Stops future tracking without changing earlier history",
                disabled: stopPending,
                label: stopPending
                  ? "Stopping practice…"
                  : "Stop tracking this practice",
                onPress: openStopConfirmation,
              }
            : undefined
        }
        submitError={stopError ?? submitError}
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
