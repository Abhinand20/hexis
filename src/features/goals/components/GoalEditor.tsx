import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../design/tokens";
import type { GoalCadence } from "../../cycles/domain/types";

export type GoalEditorValue = {
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export type GoalEditorProps = {
  mode: "create" | "edit" | "editingActiveGoal";
  initialValue: GoalEditorValue;
  onSave: (value: GoalEditorValue) => void;
  onCancel: () => void;
  helperText?: string;
  submitError?: string | null;
  isSaving?: boolean;
  saveLabel?: string;
  secondaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    accessibilityHint?: string;
  };
};

function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? value : null;
}

export function GoalEditor({
  mode,
  initialValue,
  onSave,
  onCancel,
  helperText,
  submitError,
  isSaving = false,
  saveLabel,
  secondaryAction,
}: GoalEditorProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialValue.name);
  const [cadence, setCadence] = useState<GoalCadence>(initialValue.cadence);
  const [weeklyTargetCount, setWeeklyTargetCount] = useState(
    String(initialValue.weeklyTargetCount),
  );
  const [expectedDurationMinutes, setExpectedDurationMinutes] = useState(
    initialValue.expectedDurationMinutes == null
      ? ""
      : String(initialValue.expectedDurationMinutes),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  function handleSave() {
    const trimmedName = name.trim();
    const target = parsePositiveInt(weeklyTargetCount);
    const durationRaw = expectedDurationMinutes.trim();
    const duration =
      durationRaw === "" ? null : parsePositiveInt(expectedDurationMinutes);

    if (trimmedName.length === 0) {
      setValidationMessage("Name is required.");
      return;
    }
    if (target == null || target <= 0) {
      setValidationMessage("Weekly target must be a positive whole number.");
      return;
    }
    if (durationRaw !== "" && (duration == null || duration <= 0)) {
      setValidationMessage(
        "Expected duration must be empty or a positive whole number.",
      );
      return;
    }

    setValidationMessage(null);
    onSave({
      name: trimmedName,
      cadence,
      weeklyTargetCount: target,
      expectedDurationMinutes: duration,
    });
  }

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View
          style={[styles.sheet, { paddingBottom: spacing.xxl + insets.bottom }]}
        >
          <Text style={styles.title}>
            {mode === "create" ? "Add practice" : "Edit practice"}
          </Text>

          {helperText || mode === "editingActiveGoal" ? (
            <Text style={styles.helper}>
              {helperText ?? "Applies from today; earlier logs are unchanged."}
            </Text>
          ) : null}

          <Text style={styles.label}>Practice name</Text>
          <TextInput
            accessibilityLabel="Practice name"
            onChangeText={setName}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Cadence</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: cadence === "daily" }}
              onPress={() => setCadence("daily")}
              style={[
                styles.chip,
                cadence === "daily" ? styles.chipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  cadence === "daily" ? styles.chipTextSelected : null,
                ]}
              >
                Daily
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: cadence === "weekly" }}
              onPress={() => setCadence("weekly")}
              style={[
                styles.chip,
                cadence === "weekly" ? styles.chipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  cadence === "weekly" ? styles.chipTextSelected : null,
                ]}
              >
                Weekly
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Weekly target count</Text>
          <TextInput
            accessibilityLabel="Weekly target count"
            keyboardType="number-pad"
            onChangeText={setWeeklyTargetCount}
            style={styles.input}
            value={weeklyTargetCount}
          />

          <Text style={styles.label}>Expected duration (minutes)</Text>
          <TextInput
            accessibilityLabel="Expected duration (minutes)"
            keyboardType="number-pad"
            onChangeText={setExpectedDurationMinutes}
            placeholder="Optional"
            placeholderTextColor={colors.mutedInk}
            style={styles.input}
            value={expectedDurationMinutes}
          />

          {validationMessage ? (
            <Text style={styles.validation}>{validationMessage}</Text>
          ) : null}

          {submitError ? (
            <Text accessibilityLiveRegion="polite" style={styles.validation}>
              {submitError}
            </Text>
          ) : null}

          {secondaryAction ? (
            <Pressable
              accessibilityHint={secondaryAction.accessibilityHint}
              accessibilityRole="button"
              accessibilityState={{ disabled: secondaryAction.disabled }}
              disabled={secondaryAction.disabled}
              onPress={secondaryAction.onPress}
              style={[
                styles.destructiveButton,
                secondaryAction.disabled ? styles.buttonDisabled : null,
              ]}
            >
              <Text style={styles.destructiveButtonText}>
                {secondaryAction.label}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving }}
              disabled={isSaving}
              onPress={handleSave}
              style={[
                styles.primaryButton,
                isSaving ? styles.buttonDisabled : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSaving
                  ? "Saving…"
                  : saveLabel ??
                    (mode === "editingActiveGoal" ? "Save updates" : "Save")}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    gap: spacing.sm,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  helper: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.mutedInk,
    fontSize: 13,
    marginTop: spacing.xs,
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
  row: {
    flexDirection: "row",
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
  validation: {
    color: "#8B3A3A",
    fontSize: 14,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  destructiveButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  destructiveButtonText: {
    color: "#8B3A3A",
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
