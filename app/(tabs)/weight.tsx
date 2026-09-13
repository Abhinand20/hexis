import { useCallback, useEffect, useState } from "react";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../src/design/tokens";
import { todayLocalDate } from "../../src/features/cycles/domain/date";
import { WeightEntryRow } from "../../src/features/weight/components/WeightEntryRow";
import { WeightPeriodCard } from "../../src/features/weight/components/WeightPeriodCard";
import { gramsToUnit, unitToGrams } from "../../src/features/weight/domain/units";
import type { WeightUnit } from "../../src/features/weight/domain/types";
import { useWeightAverages } from "../../src/features/weight/hooks/useWeightAverages";
import { useWeightLog } from "../../src/features/weight/hooks/useWeightLog";

function parseDisplayWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function dateFromLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function WeightScreen() {
  const insets = useSafeAreaInsets();
  const [reloadToken, setReloadToken] = useState(0);
  const [todayInput, setTodayInput] = useState("");
  const [backfillInput, setBackfillInput] = useState("");
  const [backfillDate, setBackfillDate] = useState(todayLocalDate());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setReloadToken((value) => value + 1);
    }, []),
  );

  const log = useWeightLog(reloadToken);
  const averages = useWeightAverages(reloadToken);

  const today = log.state.status === "ready" ? log.state.today : todayLocalDate();
  const unit: WeightUnit = log.state.status === "ready" ? log.state.unit : "kg";
  const todayEntryGrams =
    log.state.status === "ready"
      ? (log.state.todayEntry?.weightGrams ?? null)
      : null;
  const todayEntryUpdatedAt =
    log.state.status === "ready"
      ? (log.state.todayEntry?.updatedAt ?? null)
      : null;

  useEffect(() => {
    if (log.state.status !== "ready") {
      return;
    }
    setTodayInput(
      todayEntryGrams === null
        ? ""
        : gramsToUnit(todayEntryGrams, unit).toFixed(1),
    );
  }, [log.state.status, todayEntryGrams, todayEntryUpdatedAt, unit]);

  const submitWeight = useCallback(
    async (localDate: string, raw: string) => {
      const value = parseDisplayWeight(raw);
      if (value === null) {
        setLocalError("Enter a weight using numbers.");
        return;
      }

      setLocalError(null);
      try {
        await log.save(localDate, unitToGrams(value, unit));
        setReloadToken((value) => value + 1);
        if (localDate !== today) {
          setBackfillInput("");
        }
        setEditingDate(null);
      } catch (reason) {
        log.recordActionError(reason);
      }
    },
    [log, today, unit],
  );

  const changeUnit = useCallback(
    (nextUnit: WeightUnit) => {
      // Today's field is re-derived from the stored entry, but these drafts
      // would keep a number typed in the old unit and save it as the new one.
      setBackfillInput("");
      setEditingDate(null);
      setEditingInput("");
      void log.changeUnit(nextUnit);
    },
    [log],
  );

  const handleBackfillDate = useCallback(
    (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
      setBackfillDate(todayLocalDate(selectedDate));
    },
    [],
  );

  const confirmDelete = useCallback(
    (localDate: string) => {
      Alert.alert(
        "Delete this weight?",
        `This removes the entry for ${localDate}. This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void log
                .deleteByDate(localDate)
                .then(() => {
                  setReloadToken((value) => value + 1);
                  setEditingDate((current) =>
                    current === localDate ? null : current,
                  );
                })
                .catch(log.recordActionError);
            },
          },
        ],
      );
    },
    [log],
  );

  const errorMessage = localError ?? log.actionError;

  if (log.state.status === "loading" || averages.status === "loading") {
    return (
      <View
        accessibilityLabel="Loading weight"
        accessibilityLiveRegion="polite"
        style={[
          styles.screen,
          styles.centered,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <ActivityIndicator color={colors.verdigris} size="small" />
        <Text style={styles.loadingLabel}>Loading your weights…</Text>
      </View>
    );
  }

  if (log.state.status === "error") {
    return (
      <StatusMessage
        title="Weight is unavailable."
        copy={log.state.message}
      />
    );
  }

  if (averages.status === "error") {
    return (
      <StatusMessage title="Weight is unavailable." copy={averages.message} />
    );
  }

  const { todayEntry, recentEntries, hasAnyEntries } = log.state;
  const hasTodayEntry = todayEntry !== null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xxl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text accessibilityRole="header" style={styles.screenTitle}>
        Weight
      </Text>

      <Text style={styles.sectionLabel}>Today</Text>
      <View style={styles.unitRow}>
        <UnitChip
          label="kg"
          selected={unit === "kg"}
          onPress={() => changeUnit("kg")}
        />
        <UnitChip
          label="lb"
          selected={unit === "lb"}
          onPress={() => changeUnit("lb")}
        />
      </View>
      <TextInput
        accessibilityLabel="Today's weight"
        keyboardType="decimal-pad"
        onChangeText={setTodayInput}
        placeholder={unit === "kg" ? "70.0" : "154.3"}
        placeholderTextColor={colors.mutedInk}
        style={styles.input}
        value={todayInput}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void submitWeight(today, todayInput);
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {hasTodayEntry ? "Update" : "Save"}
        </Text>
      </Pressable>
      {log.confirmation ? (
        <Text accessibilityLiveRegion="polite" style={styles.confirmation}>
          {log.confirmation}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}

      {!hasAnyEntries ? (
        <Text style={styles.emptyCopy}>No weights recorded yet.</Text>
      ) : (
        <>
          <WeightPeriodCard
            title="This week"
            comparison={averages.week}
            unit={unit}
            emptyComparisonCopy="Your next week will have a comparison"
          />
          <WeightPeriodCard
            title="This month"
            comparison={averages.month}
            unit={unit}
            emptyComparisonCopy="Your next month will have a comparison"
          />

          <Text style={styles.sectionLabel}>Recent</Text>
          {recentEntries.map((entry) => (
            <WeightEntryRow
              key={entry.id}
              entry={entry}
              unit={unit}
              isEditing={editingDate === entry.localDate}
              draft={editingInput}
              onChangeDraft={setEditingInput}
              onEdit={() => {
                setEditingDate(entry.localDate);
                setEditingInput(
                  gramsToUnit(entry.weightGrams, unit).toFixed(1),
                );
              }}
              onSave={() => {
                void submitWeight(entry.localDate, editingInput);
              }}
              onDelete={() => confirmDelete(entry.localDate)}
            />
          ))}

          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
            Add an earlier day
          </Text>
          <Text
            accessibilityLabel={`Earlier day ${backfillDate}`}
            style={styles.backfillDate}
          >
            {backfillDate}
          </Text>
          <View style={styles.picker}>
            <DateTimePicker
              mode="date"
              value={dateFromLocalDate(backfillDate)}
              maximumDate={dateFromLocalDate(today)}
              onValueChange={handleBackfillDate}
            />
          </View>
          <TextInput
            accessibilityLabel="Earlier day weight"
            keyboardType="decimal-pad"
            onChangeText={setBackfillInput}
            placeholder={unit === "kg" ? "70.0" : "154.3"}
            placeholderTextColor={colors.mutedInk}
            style={styles.input}
            value={backfillInput}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void submitWeight(backfillDate, backfillInput);
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Save earlier day</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function UnitChip({
  label,
  selected,
  onPress,
}: {
  label: WeightUnit;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusMessage({ title, copy }: { title: string; copy: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        styles.centered,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  centered: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  screenTitle: {
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  sectionSpacing: {
    marginTop: spacing.sm,
  },
  unitRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.hairline,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
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
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.verdigris,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  confirmation: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCopy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingLabel: {
    color: colors.mutedInk,
    fontSize: 15,
  },
  backfillDate: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  picker: {
    alignItems: "flex-start",
  },
});
