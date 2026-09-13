import { useCallback, useState } from "react";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, spacing } from "../src/design/tokens";
import { todayLocalDate } from "../src/features/cycles/domain/date";
import { parseDisplayWeight, unitToGrams } from "../src/features/weight/domain/units";
import { useWeightLog } from "../src/features/weight/hooks/useWeightLog";

function dateFromLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function LogWeightScreen() {
  const log = useWeightLog();
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDateChange = useCallback(
    (_event: DateTimePickerChangeEvent, date: Date) => {
      setSelectedDate(todayLocalDate(date));
    },
    [],
  );

  const unit = log.state.status === "ready" ? log.state.unit : null;

  const save = useCallback(async () => {
    if (unit === null) {
      return;
    }

    const value = parseDisplayWeight(draft);
    if (value === null) {
      setLocalError("Enter a weight using numbers.");
      return;
    }

    setLocalError(null);
    try {
      await log.save(selectedDate, unitToGrams(value, unit));
      router.back();
    } catch (reason) {
      log.recordActionError(reason);
    }
  }, [draft, log, selectedDate, unit]);

  if (unit === null) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.verdigris} size="small" />
      </View>
    );
  }

  const existing =
    log.state.status === "ready"
      ? log.state.recentEntries.find(
          (entry) => entry.localDate === selectedDate,
        )
      : undefined;
  const errorMessage = localError ?? log.actionError;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.copy}>
        Pick the day this weight belongs to. Future days cannot be recorded.
      </Text>

      <View style={styles.picker}>
        <DateTimePicker
          mode="date"
          value={dateFromLocalDate(selectedDate)}
          maximumDate={dateFromLocalDate(todayLocalDate())}
          onValueChange={handleDateChange}
        />
      </View>

      <Text accessibilityLabel={`Selected day ${selectedDate}`} style={styles.selectedDate}>
        {selectedDate}
      </Text>

      {existing ? (
        <Text style={styles.existing}>
          This day already has a weight. Saving replaces it.
        </Text>
      ) : null}

      <TextInput
        accessibilityLabel="Weight to record"
        autoFocus
        keyboardType="decimal-pad"
        onChangeText={setDraft}
        placeholder={unit === "kg" ? "70.0" : "154.3"}
        placeholderTextColor={colors.mutedInk}
        style={styles.input}
        value={draft}
      />
      <Text style={styles.unitHint}>Recording in {unit}.</Text>

      {errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void save();
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {existing ? "Replace weight" : "Save weight"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
  picker: {
    alignItems: "center",
  },
  selectedDate: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  existing: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
  },
  input: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unitHint: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 15,
    lineHeight: 21,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.verdigris,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.inkOnDark,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
