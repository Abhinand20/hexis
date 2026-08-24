import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../src/db/DatabaseProvider";
import { colors, spacing } from "../../src/design/tokens";
import {
  createCycleRepository,
  type CreateCycleGoalInput,
} from "../../src/features/cycles/data/cycleRepository";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import { useCreateCycle } from "../../src/features/cycles/hooks/useCreateCycle";
import { useCycleSetupState } from "../../src/features/cycles/hooks/useCycleSetupState";
import type { GoalEditorValue } from "../../src/features/goals/components/GoalEditor";

function summarizePractice(practice: GoalEditorValue): string {
  const cadenceLabel = practice.cadence === "daily" ? "daily" : "weekly";
  const targetLabel = `${practice.weeklyTargetCount}/week`;
  const durationLabel =
    practice.expectedDurationMinutes == null
      ? "no duration"
      : `${practice.expectedDurationMinutes} min`;
  return `${cadenceLabel} · ${targetLabel} · ${durationLabel}`;
}

function toGoalInput(practice: GoalEditorValue): CreateCycleGoalInput {
  return {
    name: practice.name,
    cadence: practice.cadence,
    weeklyTargetCount: practice.weeklyTargetCount,
    expectedDurationMinutes: practice.expectedDurationMinutes,
  };
}

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { db } = useDatabase();
  const { createCycle, isPending } = useCreateCycle();
  const {
    durationDays,
    cycleName,
    setCycleName,
    includedPractices,
    hasPractices,
  } = useCycleSetupState();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewValidation, setReviewValidation] = useState<string | null>(null);
  const [isCheckingActiveCycle, setIsCheckingActiveCycle] = useState(false);
  const isSubmitting = isPending || isCheckingActiveCycle;

  async function handleStart() {
    const trimmedName = cycleName.trim();
    if (trimmedName.length === 0) {
      setReviewValidation("Cycle name is required.");
      return;
    }
    if (!hasPractices) {
      setReviewValidation("Add at least one practice to start.");
      return;
    }

    setReviewValidation(null);
    setSubmitError(null);

    if (!db) {
      setSubmitError("The cycle database is not available. Please try again.");
      return;
    }

    const startDate = todayLocalDate();
    setIsCheckingActiveCycle(true);
    try {
      const activeCycle = await createCycleRepository(db).getActiveCycle(
        startDate,
      );
      if (activeCycle) {
        setSubmitError(
          `“${activeCycle.name}” is still active. End that cycle before starting a new one. Your setup changes are still here.`,
        );
        return;
      }

      await createCycle({
        name: trimmedName,
        startDate,
        durationDays,
        goals: includedPractices.map(toGoalInput),
      });
      router.dismissTo("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setSubmitError(message);
    } finally {
      setIsCheckingActiveCycle(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.heading}>Review and start</Text>
          <Text style={styles.label}>Cycle name</Text>
          <TextInput
            accessibilityLabel="Cycle name"
            onChangeText={setCycleName}
            style={styles.input}
            value={cycleName}
          />
          <Text style={styles.subheading}>Duration</Text>
          <Text style={styles.copy}>{durationDays} days</Text>
          <Text style={styles.subheading}>Practices</Text>
          {includedPractices.map((practice) => (
            <View key={practice.id} style={styles.reviewRow}>
              <Text style={styles.reviewName}>{practice.name}</Text>
              <Text style={styles.reviewSummary}>
                {summarizePractice(practice)}
              </Text>
            </View>
          ))}
          {reviewValidation ? (
            <Text style={styles.error}>{reviewValidation}</Text>
          ) : null}
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={() => {
              void handleStart();
            }}
            style={[
              styles.primaryButton,
              isSubmitting ? styles.primaryButtonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>Start</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  label: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  input: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reviewRow: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  reviewName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
  },
  reviewSummary: {
    color: colors.mutedInk,
    fontSize: 13,
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
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "600",
  },
});
