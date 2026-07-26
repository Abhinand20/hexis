import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import {
  useCycleSetupState,
  type EditorTarget,
} from "../../src/features/cycles/hooks/useCycleSetupState";
import {
  GoalEditor,
  type GoalEditorValue,
} from "../../src/features/goals/components/GoalEditor";
import { GoalTemplateList } from "../../src/features/goals/components/GoalTemplateList";

const EMPTY_GOAL: GoalEditorValue = {
  name: "",
  cadence: "weekly",
  weeklyTargetCount: 1,
  expectedDurationMinutes: null,
};

export default function PracticesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    templates,
    setTemplates,
    customPractices,
    setCustomPractices,
    nextCustomId,
    setNextCustomId,
    hasPractices,
  } = useCycleSetupState();

  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);

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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.heading}>Choose your practices</Text>
          <Text style={styles.copy}>
            Start with these templates, adjust them, or add your own. You need at
            least one practice to continue.
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
                router.push("/setup/review");
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
  copy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
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
