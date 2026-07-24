import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import type { GoalEditorValue } from "./GoalEditor";

export type TemplatePractice = GoalEditorValue & {
  id: string;
  selected: boolean;
};

export type CustomPractice = GoalEditorValue & {
  id: string;
};

export type GoalTemplateListProps = {
  templates: TemplatePractice[];
  customPractices: CustomPractice[];
  onToggleTemplate: (id: string) => void;
  onEditTemplate: (id: string) => void;
  onEditCustom: (id: string) => void;
  onRemoveCustom: (id: string) => void;
  onAddCustom: () => void;
};

function summarizePractice(practice: GoalEditorValue): string {
  const cadenceLabel = practice.cadence === "daily" ? "daily" : "weekly";
  const targetLabel = `${practice.weeklyTargetCount}/week`;
  const durationLabel =
    practice.expectedDurationMinutes == null
      ? "no duration"
      : `${practice.expectedDurationMinutes} min`;
  return `${cadenceLabel} · ${targetLabel} · ${durationLabel}`;
}

export function GoalTemplateList({
  templates,
  customPractices,
  onToggleTemplate,
  onEditTemplate,
  onEditCustom,
  onRemoveCustom,
  onAddCustom,
}: GoalTemplateListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Starter practices</Text>
      {templates.map((template) => (
        <View key={template.id} style={styles.row}>
          <View style={styles.rowMain}>
            <Pressable
              accessibilityLabel={template.name}
              accessibilityRole="switch"
              accessibilityState={{ checked: template.selected }}
              onPress={() => onToggleTemplate(template.id)}
              style={[
                styles.toggle,
                template.selected ? styles.toggleOn : null,
              ]}
            >
              <Text style={styles.toggleText}>
                {template.selected ? "On" : "Off"}
              </Text>
            </Pressable>
            <View style={styles.copy}>
              <Text style={styles.name}>{template.name}</Text>
              <Text style={styles.summary}>{summarizePractice(template)}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => onEditTemplate(template.id)}
          >
            <Text style={styles.action}>Edit</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Custom practices</Text>
      {customPractices.length === 0 ? (
        <Text style={styles.empty}>No custom practices yet.</Text>
      ) : (
        customPractices.map((practice) => (
          <View key={practice.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{practice.name}</Text>
              <Text style={styles.summary}>{summarizePractice(practice)}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onEditCustom(practice.id)}
              >
                <Text style={styles.action}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onRemoveCustom(practice.id)}
              >
                <Text style={styles.action}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        accessibilityRole="button"
        onPress={onAddCustom}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>Add custom practice</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
  },
  toggle: {
    backgroundColor: colors.hairline,
    borderRadius: 16,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleOn: {
    backgroundColor: colors.verdigris,
  },
  toggleText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
  },
  summary: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  action: {
    color: colors.verdigris,
    fontSize: 15,
    fontWeight: "500",
  },
  rowActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  empty: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  addButton: {
    alignSelf: "flex-start",
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500",
  },
});
