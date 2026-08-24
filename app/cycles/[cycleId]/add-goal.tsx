import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../../src/db/DatabaseProvider";
import { colors, spacing } from "../../../src/design/tokens";
import { createCycleRepository } from "../../../src/features/cycles/data/cycleRepository";
import { todayLocalDate } from "../../../src/features/cycles/domain/date";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../../src/features/goals/components/GoalEditor";
import {
  GoalTemplatePicker,
  STARTER_PRACTICES,
} from "../../../src/features/goals/components/GoalTemplateList";
import { createGoalRepository } from "../../../src/features/goals/data/goalRepository";

const EMPTY_GOAL: GoalEditorValue = {
  name: "",
  cadence: "weekly",
  weeklyTargetCount: 1,
  expectedDurationMinutes: null,
};

type LoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; cycleName: string; today: string };

export default function AddGoalScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { db, isLoading: isDatabaseLoading } = useDatabase();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startingPoint, setStartingPoint] = useState<string | "custom">(
    "custom",
  );
  const savingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isSaving,
      headerBackVisible: !isSaving,
    });
  }, [isSaving, navigation]);

  const starterPractice = STARTER_PRACTICES.find(
    (practice) => practice.id === startingPoint,
  );
  const initialValue: GoalEditorValue = starterPractice
    ? {
        name: starterPractice.name,
        cadence: starterPractice.cadence,
        weeklyTargetCount: starterPractice.weeklyTargetCount,
        expectedDurationMinutes: starterPractice.expectedDurationMinutes,
      }
    : EMPTY_GOAL;

  useEffect(() => {
    if (!db) {
      if (!isDatabaseLoading) {
        setLoadState({ status: "unavailable" });
      }
      return;
    }

    let cancelled = false;
    createCycleRepository(db)
      .getActiveCycle()
      .then((cycle) => {
        if (cancelled) {
          return;
        }
        if (!cycle || cycle.id !== cycleId) {
          setLoadState({ status: "unavailable" });
          return;
        }
        setLoadState({
          status: "ready",
          cycleName: cycle.name,
          today: todayLocalDate(),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState({ status: "unavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cycleId, db, isDatabaseLoading]);

  async function handleSave(value: GoalEditorValue) {
    if (!db || loadState.status !== "ready" || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setSubmitError(null);

    try {
      await createGoalRepository(db).createForActiveCycle(
        {
          cycleId,
          name: value.name,
          cadence: value.cadence,
          weeklyTargetCount: value.weeklyTargetCount,
          expectedDurationMinutes: value.expectedDurationMinutes,
        },
        loadState.today,
      );
      router.back();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Couldn't add this practice. Try again.",
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function goBack() {
    if (!savingRef.current) {
      router.back();
    }
  }

  if (loadState.status === "loading") {
    return (
      <View style={styles.centered}>
        <Text style={styles.copy}>Loading practice editor…</Text>
      </View>
    );
  }

  if (loadState.status === "unavailable") {
    return (
      <View
        style={[
          styles.centered,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Text style={styles.copy}>
          Practices can only be added to the active cycle.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Back to settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.pickerContainer}>
        <GoalTemplatePicker
          disabled={isSaving}
          onSelect={(id) => {
            if (!savingRef.current) {
              setSubmitError(null);
              setStartingPoint(id);
            }
          }}
          selectedId={startingPoint}
        />
      </View>
      <GoalEditor
        helperText={`Selected: ${starterPractice?.name ?? "Custom practice"}. Adding one practice to ${loadState.cycleName}. It starts today (${loadState.today}); earlier cycle days stay unchanged. Duplicate names are allowed—this practice keeps its own activity history.`}
        initialValue={initialValue}
        isSaving={isSaving}
        key={startingPoint}
        mode="create"
        onCancel={goBack}
        onSave={(value) => {
          void handleSave(value);
        }}
        presentation="inline"
        saveLabel="Add practice"
        submitError={submitError}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    paddingTop: spacing.lg,
  },
  pickerContainer: {
    paddingHorizontal: spacing.xl,
  },
  centered: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    flex: 1,
    gap: spacing.lg,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  copy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "600",
  },
});
