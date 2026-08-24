import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../design/tokens";

const QUICK_DURATIONS = [15, 30, 45, 60, 90] as const;

export type ActivityEditorMode = "add" | "edit";

export type ActivityEditorPractice = {
  id: string;
  name: string;
};

export type ActivityEditorValue = {
  practiceId: string;
  localDate: string;
  startedTime: string;
  durationMinutes: number | null;
};

export type ActivityEditorSheetProps = {
  mode: ActivityEditorMode;
  visible: boolean;
  practices: ActivityEditorPractice[];
  initialValue: ActivityEditorValue;
  minDate: string;
  maxDate: string;
  onDismiss: () => void;
  onSave: (value: ActivityEditorValue) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
  error?: string | null;
};

type ValidationErrors = Partial<
  Record<"practiceId" | "localDate" | "startedTime" | "durationMinutes", string>
>;

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidStartedTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function validate(
  value: Omit<ActivityEditorValue, "durationMinutes">,
  durationInput: string,
  practices: ActivityEditorPractice[],
  minDate: string,
  maxDate: string,
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!value.practiceId || !practices.some((practice) => practice.id === value.practiceId)) {
    errors.practiceId = "Choose a practice available on this date.";
  }

  if (!value.localDate.trim()) {
    errors.localDate = "Date is required.";
  } else if (!isValidLocalDate(value.localDate)) {
    errors.localDate = "Enter a valid date in YYYY-MM-DD format.";
  } else if (value.localDate < minDate || value.localDate > maxDate) {
    errors.localDate = `Choose a date from ${minDate} through ${maxDate}.`;
  }

  if (!value.startedTime.trim()) {
    errors.startedTime = "Start time is required.";
  } else if (!isValidStartedTime(value.startedTime)) {
    errors.startedTime = "Enter a valid time in 24-hour HH:mm format.";
  }

  const trimmedDuration = durationInput.trim();
  if (trimmedDuration && (!/^\d+$/.test(trimmedDuration) || Number(trimmedDuration) <= 0)) {
    errors.durationMinutes = "Duration must be a positive whole number or left blank.";
  }

  return errors;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <Text accessibilityRole="alert" style={styles.errorText}>
      {message}
    </Text>
  ) : null;
}

export function ActivityEditorSheet({
  mode,
  visible,
  practices,
  initialValue,
  minDate,
  maxDate,
  onDismiss,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
  error = null,
}: ActivityEditorSheetProps) {
  const [practiceId, setPracticeId] = useState(initialValue.practiceId);
  const [localDate, setLocalDate] = useState(initialValue.localDate);
  const [startedTime, setStartedTime] = useState(initialValue.startedTime);
  const [durationInput, setDurationInput] = useState(
    initialValue.durationMinutes === null ? "" : String(initialValue.durationMinutes),
  );
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setPracticeId(initialValue.practiceId);
    setLocalDate(initialValue.localDate);
    setStartedTime(initialValue.startedTime);
    setDurationInput(
      initialValue.durationMinutes === null ? "" : String(initialValue.durationMinutes),
    );
    setValidationErrors({});
    setConfirmingDelete(false);
  }, [
    initialValue.durationMinutes,
    initialValue.localDate,
    initialValue.practiceId,
    initialValue.startedTime,
    mode,
    visible,
  ]);

  if (!visible) {
    return null;
  }

  const mutationPending = isSaving || isDeleting;
  const title = mode === "add" ? "Add activity" : "Edit activity";

  function clearValidationError(field: keyof ValidationErrors) {
    setValidationErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleSave() {
    const draft = { practiceId, localDate, startedTime };
    const nextErrors = validate(draft, durationInput, practices, minDate, maxDate);
    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || mutationPending) {
      return;
    }

    const trimmedDuration = durationInput.trim();
    void onSave({
      ...draft,
      durationMinutes: trimmedDuration ? Number(trimmedDuration) : null,
    });
  }

  function handleDelete() {
    if (!onDelete || mutationPending) {
      return;
    }
    void onDelete();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!mutationPending) {
          onDismiss();
        }
      }}
      presentationStyle="formSheet"
      visible={visible}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === "add"
                    ? "Record work completed on this day."
                    : "Correct the saved practice, date, time, or duration."}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close activity editor"
                accessibilityRole="button"
                disabled={mutationPending}
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed ? styles.pressed : null,
                  mutationPending ? styles.disabled : null,
                ]}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Practice</Text>
              <View accessibilityRole="radiogroup" style={styles.practiceOptions}>
                {practices.map((practice) => {
                  const selected = practice.id === practiceId;
                  return (
                    <Pressable
                      key={practice.id}
                      accessibilityLabel={practice.name}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: mutationPending }}
                      disabled={mutationPending}
                      onPress={() => {
                        setPracticeId(practice.id);
                        clearValidationError("practiceId");
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        selected ? styles.optionSelected : null,
                        pressed ? styles.pressed : null,
                        mutationPending ? styles.disabled : null,
                      ]}
                    >
                      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                        {practice.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <FieldError message={validationErrors.practiceId} />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.flexField}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  accessibilityLabel="Activity date"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!mutationPending}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(value) => {
                    setLocalDate(value);
                    clearValidationError("localDate");
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.mutedInk}
                  style={styles.input}
                  value={localDate}
                />
                <Text style={styles.hint}>
                  {minDate}–{maxDate}
                </Text>
                <FieldError message={validationErrors.localDate} />
              </View>

              <View style={styles.flexField}>
                <Text style={styles.label}>Start time</Text>
                <TextInput
                  accessibilityLabel="Activity start time"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!mutationPending}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  onChangeText={(value) => {
                    setStartedTime(value);
                    clearValidationError("startedTime");
                  }}
                  placeholder="HH:mm"
                  placeholderTextColor={colors.mutedInk}
                  style={styles.input}
                  value={startedTime}
                />
                <Text style={styles.hint}>24-hour time</Text>
                <FieldError message={validationErrors.startedTime} />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Duration (optional)</Text>
              <View style={styles.durationOptions}>
                <Pressable
                  accessibilityLabel="No duration"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: durationInput.trim() === "", disabled: mutationPending }}
                  disabled={mutationPending}
                  onPress={() => {
                    setDurationInput("");
                    clearValidationError("durationMinutes");
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    durationInput.trim() === "" ? styles.optionSelected : null,
                    pressed ? styles.pressed : null,
                    mutationPending ? styles.disabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      durationInput.trim() === "" ? styles.optionTextSelected : null,
                    ]}
                  >
                    None
                  </Text>
                </Pressable>
                {QUICK_DURATIONS.map((duration) => {
                  const selected = durationInput === String(duration);
                  return (
                    <Pressable
                      key={duration}
                      accessibilityLabel={`${duration} min`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: mutationPending }}
                      disabled={mutationPending}
                      onPress={() => {
                        setDurationInput(String(duration));
                        clearValidationError("durationMinutes");
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        selected ? styles.optionSelected : null,
                        pressed ? styles.pressed : null,
                        mutationPending ? styles.disabled : null,
                      ]}
                    >
                      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                        {duration} min
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                accessibilityLabel="Custom duration in minutes"
                editable={!mutationPending}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  setDurationInput(value);
                  clearValidationError("durationMinutes");
                }}
                placeholder="Custom minutes"
                placeholderTextColor={colors.mutedInk}
                style={styles.input}
                value={durationInput}
              />
              <FieldError message={validationErrors.durationMinutes} />
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={styles.errorBanner}>
                {error}
              </Text>
            ) : null}

            <View style={styles.primaryActions}>
              <Pressable
                accessibilityRole="button"
                disabled={mutationPending}
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed ? styles.pressed : null,
                  mutationPending ? styles.disabled : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={mutationPending}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? styles.pressed : null,
                  mutationPending ? styles.disabled : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSaving ? "Saving…" : mode === "add" ? "Add activity" : "Save changes"}
                </Text>
              </Pressable>
            </View>

            {mode === "edit" && onDelete ? (
              <View style={styles.dangerZone}>
                {confirmingDelete ? (
                  <View style={styles.confirmation}>
                    <Text accessibilityRole="alert" style={styles.confirmationTitle}>
                      Delete this activity?
                    </Text>
                    <Text style={styles.confirmationCopy}>
                      It will disappear from progress and history summaries.
                    </Text>
                    <View style={styles.confirmationActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={mutationPending}
                        onPress={() => setConfirmingDelete(false)}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed ? styles.pressed : null,
                          mutationPending ? styles.disabled : null,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>Keep activity</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={mutationPending}
                        onPress={handleDelete}
                        style={({ pressed }) => [
                          styles.deleteConfirmButton,
                          pressed ? styles.pressed : null,
                          mutationPending ? styles.disabled : null,
                        ]}
                      >
                        <Text style={styles.deleteConfirmText}>
                          {isDeleting ? "Deleting…" : "Confirm delete"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={mutationPending}
                    onPress={() => setConfirmingDelete(true)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed ? styles.pressed : null,
                      mutationPending ? styles.disabled : null,
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>Delete activity</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
  closeButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  closeButtonText: {
    color: colors.verdigris,
    fontSize: 15,
    fontWeight: "600",
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  practiceOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  durationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  option: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  optionText: {
    color: colors.ink,
    fontSize: 15,
  },
  optionTextSelected: {
    color: colors.inkOnDark,
    fontWeight: "600",
  },
  twoColumnRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  flexField: {
    flex: 1,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.hairline,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hint: {
    color: colors.mutedInk,
    fontSize: 12,
  },
  errorText: {
    color: "#8B3A3A",
    fontSize: 13,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: "#F4E5E2",
    borderRadius: 10,
    color: "#7D302E",
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.md,
  },
  primaryActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.verdigris,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  dangerZone: {
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  deleteButtonText: {
    color: "#8B3A3A",
    fontSize: 15,
    fontWeight: "600",
  },
  confirmation: {
    backgroundColor: "#F4E5E2",
    borderRadius: 12,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  confirmationTitle: {
    color: "#7D302E",
    fontSize: 16,
    fontWeight: "700",
  },
  confirmationCopy: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmationActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  deleteConfirmButton: {
    alignItems: "center",
    backgroundColor: "#8B3A3A",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  deleteConfirmText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.55,
  },
});
