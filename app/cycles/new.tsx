import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { colors, spacing } from "../../src/design/tokens";
import type { CreateCycleGoalInput } from "../../src/features/cycles/data/cycleRepository";
import type { CycleDurationDays } from "../../src/features/cycles/domain/types";
import { useCreateCycle } from "../../src/features/cycles/hooks/useCreateCycle";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../src/features/goals/components/GoalEditor";
import {
  GoalTemplateList,
  type CustomPractice,
  type TemplatePractice,
} from "../../src/features/goals/components/GoalTemplateList";

type SetupStep = "duration" | "practices" | "review";

type EditorTarget =
  | { kind: "create" }
  | { kind: "edit-template"; id: string }
  | { kind: "edit-custom"; id: string };

const DEFAULT_TEMPLATES: TemplatePractice[] = [
  {
    id: "strength",
    name: "Strength",
    cadence: "weekly",
    weeklyTargetCount: 3,
    expectedDurationMinutes: 60,
    selected: true,
  },
  {
    id: "swim",
    name: "Swim",
    cadence: "weekly",
    weeklyTargetCount: 2,
    expectedDurationMinutes: 60,
    selected: true,
  },
  {
    id: "yoga",
    name: "Yoga",
    cadence: "weekly",
    weeklyTargetCount: 1,
    expectedDurationMinutes: 60,
    selected: true,
  },
  {
    id: "read",
    name: "Read",
    cadence: "daily",
    weeklyTargetCount: 7,
    expectedDurationMinutes: 30,
    selected: true,
  },
];

const EMPTY_GOAL: GoalEditorValue = {
  name: "",
  cadence: "weekly",
  weeklyTargetCount: 1,
  expectedDurationMinutes: null,
};

const DURATION_OPTIONS: CycleDurationDays[] = [30, 60, 90];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultCycleName(durationDays: CycleDurationDays): string {
  return `${durationDays}-Day Cycle`;
}

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

export function CycleSetupScreen() {
  const router = useRouter();
  const { createCycle, isPending } = useCreateCycle();

  const [step, setStep] = useState<SetupStep>("duration");
  const [durationDays, setDurationDays] = useState<CycleDurationDays>(30);
  const [templates, setTemplates] =
    useState<TemplatePractice[]>(DEFAULT_TEMPLATES);
  const [customPractices, setCustomPractices] = useState<CustomPractice[]>([]);
  const [cycleName, setCycleName] = useState(defaultCycleName(30));
  const [nameTouched, setNameTouched] = useState(false);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewValidation, setReviewValidation] = useState<string | null>(null);
  const [nextCustomId, setNextCustomId] = useState(1);

  const includedPractices = useMemo(
    () => [
      ...templates.filter((template) => template.selected),
      ...customPractices,
    ],
    [templates, customPractices],
  );

  const hasPractices = includedPractices.length > 0;

  function selectDuration(next: CycleDurationDays) {
    setDurationDays(next);
    if (!nameTouched) {
      setCycleName(defaultCycleName(next));
    }
  }

  function openEditor(target: EditorTarget) {
    setEditorTarget(target);
  }

  function closeEditor() {
    setEditorTarget(null);
  }

  function editorInitialValue(): GoalEditorValue {
    if (editorTarget?.kind === "edit-template") {
      const template = templates.find((item) => item.id === editorTarget.id);
      if (template) {
        return {
          name: template.name,
          cadence: template.cadence,
          weeklyTargetCount: template.weeklyTargetCount,
          expectedDurationMinutes: template.expectedDurationMinutes,
        };
      }
    }
    if (editorTarget?.kind === "edit-custom") {
      const practice = customPractices.find(
        (item) => item.id === editorTarget.id,
      );
      if (practice) {
        return {
          name: practice.name,
          cadence: practice.cadence,
          weeklyTargetCount: practice.weeklyTargetCount,
          expectedDurationMinutes: practice.expectedDurationMinutes,
        };
      }
    }
    return EMPTY_GOAL;
  }

  function handleEditorSave(value: GoalEditorValue) {
    if (!editorTarget) {
      return;
    }

    if (editorTarget.kind === "create") {
      setCustomPractices((current) => [
        ...current,
        { ...value, id: `custom-${nextCustomId}` },
      ]);
      setNextCustomId((current) => current + 1);
    } else if (editorTarget.kind === "edit-template") {
      setTemplates((current) =>
        current.map((template) =>
          template.id === editorTarget.id ? { ...template, ...value } : template,
        ),
      );
    } else {
      setCustomPractices((current) =>
        current.map((practice) =>
          practice.id === editorTarget.id ? { ...practice, ...value } : practice,
        ),
      );
    }

    closeEditor();
  }

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

    try {
      const cycle = await createCycle({
        name: trimmedName,
        startDate: formatLocalDate(new Date()),
        durationDays,
        goals: includedPractices.map(toGoalInput),
      });
      router.replace(`/cycles/${cycle.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setSubmitError(message);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === "duration" ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Start a focus cycle</Text>
            <Text style={styles.copy}>
              This is a finite focus cycle — a short, deliberate window to
              practice a small group of habits together, then take stock.
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
              onPress={() => setStep("practices")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "practices" ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Choose your practices</Text>
            <Text style={styles.copy}>
              Start with these templates, adjust them, or add your own. You need
              at least one practice to continue.
            </Text>
            <GoalTemplateList
              customPractices={customPractices}
              onAddCustom={() => openEditor({ kind: "create" })}
              onEditCustom={(id) => openEditor({ kind: "edit-custom", id })}
              onEditTemplate={(id) => openEditor({ kind: "edit-template", id })}
              onRemoveCustom={(id) =>
                setCustomPractices((current) =>
                  current.filter((practice) => practice.id !== id),
                )
              }
              onToggleTemplate={(id) =>
                setTemplates((current) =>
                  current.map((template) =>
                    template.id === id
                      ? { ...template, selected: !template.selected }
                      : template,
                  ),
                )
              }
              templates={templates}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasPractices }}
              disabled={!hasPractices}
              onPress={() => {
                if (hasPractices) {
                  setStep("review");
                }
              }}
              style={[
                styles.primaryButton,
                !hasPractices ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "review" ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Review and start</Text>
            <Text style={styles.label}>Cycle name</Text>
            <TextInput
              accessibilityLabel="Cycle name"
              onChangeText={(value) => {
                setNameTouched(true);
                setCycleName(value);
              }}
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
              accessibilityState={{ disabled: isPending }}
              disabled={isPending}
              onPress={() => {
                void handleStart();
              }}
              style={[
                styles.primaryButton,
                isPending ? styles.primaryButtonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>Start</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {editorTarget ? (
        <GoalEditor
          initialValue={editorInitialValue()}
          mode={editorTarget.kind === "create" ? "create" : "edit"}
          onCancel={closeEditor}
          onSave={handleEditorSave}
        />
      ) : null}
    </View>
  );
}

export default function NewCycleScreen() {
  return <CycleSetupScreen />;
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
