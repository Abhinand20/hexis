import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../src/db/DatabaseProvider";
import { colors, spacing } from "../../src/design/tokens";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import {
  buildRepeatCycleDraft,
  type RepeatCycleDraftFailureReason,
} from "../../src/features/cycles/domain/repeatCycleDraft";
import type { CycleDurationDays } from "../../src/features/cycles/domain/types";
import { useCycleSetupState } from "../../src/features/cycles/hooks/useCycleSetupState";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";

const DURATION_OPTIONS: CycleDurationDays[] = [30, 60, 90];

type RepeatLoadState =
  | { status: "idle" | "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function firstParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : null;
}

function repeatFailureMessage(reason: RepeatCycleDraftFailureReason): string {
  switch (reason) {
    case "source-cycle-not-ended":
      return "Only a finished cycle can be repeated.";
    case "no-final-practices":
      return "This cycle did not finish with any practices to repeat.";
    case "invalid-source":
      return "This cycle has incomplete data and cannot be repeated safely.";
  }
}

export default function DurationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    repeatCycleId?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { db, error: databaseError, isLoading: isDatabaseLoading } =
    useDatabase();
  const {
    durationDays,
    selectDuration,
    repeatSource,
    initializeFromRepeatDraft,
  } = useCycleSetupState();
  const repeatCycleId = firstParam(params.repeatCycleId);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [repeatLoadState, setRepeatLoadState] = useState<RepeatLoadState>({
    status: repeatCycleId ? "loading" : "idle",
  });

  useEffect(() => {
    if (!repeatCycleId) {
      setRepeatLoadState((current) =>
        current.status === "idle" ? current : { status: "idle" },
      );
      return;
    }
    if (repeatSource?.cycleId === repeatCycleId) {
      setRepeatLoadState({ status: "ready" });
      return;
    }
    if (isDatabaseLoading) {
      setRepeatLoadState({ status: "loading" });
      return;
    }
    if (!db) {
      setRepeatLoadState({
        status: "error",
        message:
          databaseError?.message ??
          "The cycle database is not available. Please try again.",
      });
      return;
    }

    let cancelled = false;
    const database = db;
    const sourceCycleId = repeatCycleId;
    setRepeatLoadState({ status: "loading" });

    async function loadRepeatDraft() {
      try {
        const cycle = await createCycleRepository(database).getCycleById(
          sourceCycleId,
        );
        if (!cycle) {
          throw new Error("The cycle you chose could not be found.");
        }

        const goalRepository = createGoalRepository(database);
        const goals = await goalRepository.listForCycle(cycle.id);
        const revisions = (
          await Promise.all(
            goals.map((goal) => goalRepository.listRevisions(goal.id)),
          )
        ).flat();
        const result = buildRepeatCycleDraft(cycle, goals, revisions);
        if (!result.ok) {
          throw new Error(repeatFailureMessage(result.reason));
        }
        if (cancelled) {
          return;
        }

        initializeFromRepeatDraft(
          { cycleId: cycle.id, cycleName: cycle.name },
          result.draft,
        );
        setRepeatLoadState({ status: "ready" });
      } catch (error) {
        if (!cancelled) {
          setRepeatLoadState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "This cycle could not be prepared for repeating.",
          });
        }
      }
    }

    void loadRepeatDraft();
    return () => {
      cancelled = true;
    };
  }, [
    databaseError,
    db,
    initializeFromRepeatDraft,
    isDatabaseLoading,
    loadAttempt,
    repeatCycleId,
    repeatSource?.cycleId,
  ]);

  if (repeatLoadState.status === "loading") {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color={colors.verdigris} />
        <Text style={styles.stateTitle}>Preparing your cycle…</Text>
        <Text style={styles.stateCopy}>
          Loading the practices that were active when it finished.
        </Text>
      </View>
    );
  }

  if (repeatLoadState.status === "error") {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Couldn’t repeat this cycle</Text>
        <Text style={styles.stateCopy}>{repeatLoadState.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setLoadAttempt((current) => current + 1)}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xxl + insets.bottom },
      ]}
    >
      <View style={styles.section}>
        {repeatSource ? (
          <View style={styles.repeatContext}>
            <Text style={styles.repeatLabel}>Repeating</Text>
            <Text style={styles.repeatName}>{repeatSource.cycleName}</Text>
            <Text style={styles.repeatCopy}>
              Its final practices are ready to edit before you start a fresh
              cycle.
            </Text>
          </View>
        ) : null}
        <Text style={styles.heading}>
          {repeatSource ? "Choose the new cycle length" : "Start a focus cycle"}
        </Text>
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
  centeredState: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  stateTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  stateCopy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  secondaryButton: {
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  repeatContext: {
    backgroundColor: "#E8EFEC",
    borderCurve: "continuous",
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  repeatLabel: {
    color: colors.verdigris,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  repeatName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  repeatCopy: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
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
