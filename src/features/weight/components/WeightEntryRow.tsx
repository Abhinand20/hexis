import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { formatWeight } from "../domain/units";
import type { WeightEntry, WeightUnit } from "../domain/types";

export function WeightEntryRow({
  entry,
  unit,
  isEditing,
  draft,
  onChangeDraft,
  onEdit,
  onSave,
  onDelete,
}: {
  entry: WeightEntry;
  unit: WeightUnit;
  isEditing: boolean;
  draft: string;
  onChangeDraft: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const weightLabel = formatWeight(entry.weightGrams, unit);

  return (
    <View
      accessibilityLabel={`Weight for ${entry.localDate}, ${weightLabel}`}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text style={styles.date}>{entry.localDate}</Text>
        {isEditing ? (
          <TextInput
            accessibilityLabel={`Edit weight for ${entry.localDate}`}
            keyboardType="decimal-pad"
            onChangeText={onChangeDraft}
            style={styles.input}
            value={draft}
          />
        ) : (
          <Text style={styles.weight}>{weightLabel}</Text>
        )}
      </View>
      <View style={styles.actions}>
        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSave}
            style={styles.actionButton}
          >
            <Text style={styles.actionLabel}>Save</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onEdit}
            style={styles.actionButton}
          >
            <Text style={styles.actionLabel}>Edit</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete weight for ${entry.localDate}`}
          onPress={onDelete}
          style={styles.actionButton}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  copy: {
    gap: 2,
  },
  date: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  weight: {
    color: colors.mutedInk,
    fontSize: 15,
  },
  input: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  actionLabel: {
    color: colors.verdigris,
    fontSize: 15,
    fontWeight: "700",
  },
  deleteLabel: {
    color: "#8B3A3A",
    fontSize: 15,
    fontWeight: "700",
  },
});
