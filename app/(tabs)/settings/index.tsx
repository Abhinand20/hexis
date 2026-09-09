import { useCallback, useEffect, useState } from "react";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../../src/db/DatabaseProvider";
import { colors, spacing } from "../../../src/design/tokens";
import { createCycleRepository } from "../../../src/features/cycles/data/cycleRepository";
import { todayLocalDate } from "../../../src/features/cycles/domain/date";
import type { CycleGoal } from "../../../src/features/cycles/domain/types";
import { useActiveCycle } from "../../../src/features/cycles/hooks/useActiveCycle";
import { createGoalRepository } from "../../../src/features/goals/data/goalRepository";
import {
  DEFAULT_REMINDER,
  loadReminderSettings,
  saveReminderSettings,
  setDailyReminder,
  type DailyReminder,
} from "../../../src/features/reminders/reminderService";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { db, resetDatabase } = useDatabase();
  const { cycle, isLoading } = useActiveCycle();
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [reminder, setReminder] = useState<DailyReminder>(DEFAULT_REMINDER);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const cycleId = cycle?.id;
  useFocusEffect(
    useCallback(() => {
      if (!db || !cycleId) {
        setGoals([]);
        setGoalsError(null);
        return;
      }

      let cancelled = false;
      setGoalsError(null);

      createGoalRepository(db)
        .listActiveForCycle(cycleId, todayLocalDate())
        .then((listed) => {
          if (!cancelled) {
            setGoals(listed);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setGoalsError(
              error instanceof Error
                ? error.message
                : "Couldn't load practices. Try again.",
            );
          }
        });

      return () => {
        cancelled = true;
      };
    }, [cycleId, db]),
  );

  useEffect(() => {
    if (!db) {
      return;
    }

    let cancelled = false;

    async function load() {
      const loaded = await loadReminderSettings(db!);
      if (!cancelled) {
        setReminder(loaded);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db]);

  async function handleReminderToggle(nextValue: boolean) {
    if (!db) {
      return;
    }

    const nextInput: DailyReminder = { ...reminder, enabled: nextValue };
    const result = await setDailyReminder(nextInput);
    await saveReminderSettings(db, result);
    setReminder(result);
    setPermissionDenied(nextValue === true && result.enabled === false);
  }

  async function handleReminderTimeChange(
    _event: DateTimePickerChangeEvent,
    selectedDate: Date,
  ) {
    if (!db) {
      return;
    }

    const hour = selectedDate.getHours();
    const minute = selectedDate.getMinutes();
    const nextInput: DailyReminder = { ...reminder, hour, minute };
    const result = await setDailyReminder(nextInput);
    await saveReminderSettings(db, result);
    setReminder(result);
  }

  function confirmEndCycleEarly() {
    if (!cycle || !db) {
      return;
    }

    Alert.alert(
      "End cycle early?",
      "This marks the current cycle as ended. You can start a new one afterward. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End cycle",
          style: "destructive",
          onPress: async () => {
            await createCycleRepository(db).endCycleEarly(cycle.id, todayLocalDate());
            router.navigate("/");
          },
        },
      ],
    );
  }

  function confirmReset() {
    Alert.alert(
      "Reset all local data?",
      "This deletes every cycle, goal, and logged session on this device so you can walk through onboarding again. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetDatabase();
            router.navigate("/");
          },
        },
      ],
    );
  }

  if (isLoading) {
    return null;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.sectionLabel}>Practices</Text>
      {cycle ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/cycles/${cycle.id}/add-goal`)}
            style={styles.addPracticeButton}
          >
            <Text style={styles.addPracticeLabel}>Add practice</Text>
          </Pressable>
          {goalsError ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorCopy}>
              {goalsError}
            </Text>
          ) : null}
          {goals.map((goal, index) => (
            <View key={goal.id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/cycles/${cycle.id}/edit-goal/${goal.id}`)}
                style={styles.row}
              >
                <Text style={styles.rowLabel}>{goal.name}</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.emptyCopy}>Start a cycle to configure practices.</Text>
      )}

      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Reminder</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Daily reminder</Text>
        <Switch
          accessibilityLabel="Daily reminder"
          value={reminder.enabled}
          onValueChange={(nextValue) => {
            void handleReminderToggle(nextValue);
          }}
        />
      </View>
      {permissionDenied ? (
        <View style={styles.permissionDenied}>
          <Text style={styles.rowCaption}>Notifications are off in Settings.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Linking.openSettings();
            }}
          >
            <Text style={styles.openSettingsLabel}>Open Settings</Text>
          </Pressable>
        </View>
      ) : null}
      {reminder.enabled ? (
        <View style={styles.timePicker}>
          <DateTimePicker
            mode="time"
            value={new Date(2000, 0, 1, reminder.hour, reminder.minute)}
            onValueChange={handleReminderTimeChange}
          />
        </View>
      ) : null}

      {cycle ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Cycle</Text>
          <Pressable
            accessibilityRole="button"
            onPress={confirmEndCycleEarly}
            style={styles.row}
          >
            <Text style={styles.destructiveLabel}>End cycle early</Text>
          </Pressable>
        </>
      ) : null}

      {__DEV__ ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugLabel}>Debug only</Text>
          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={styles.debugButton}
          >
            <Text style={styles.debugButtonText}>Reset all data</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  sectionLabel: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  sectionSpacing: {
    marginTop: spacing.xxl,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
  },
  addPracticeButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.verdigris,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addPracticeLabel: {
    color: colors.verdigris,
    fontSize: 15,
    fontWeight: "600",
  },
  errorCopy: {
    color: "#8B3A3A",
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  rowCaption: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  permissionDenied: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  openSettingsLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  timePicker: {
    alignItems: "flex-start",
    paddingBottom: spacing.md,
  },
  emptyCopy: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.sm,
  },
  destructiveLabel: {
    color: "#8B3A3A",
    fontSize: 16,
    fontWeight: "500",
  },
  separator: {
    backgroundColor: colors.hairline,
    height: StyleSheet.hairlineWidth,
  },
  debugPanel: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  debugLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  debugButton: {
    backgroundColor: "#8B3A3A",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  debugButtonText: {
    color: colors.inkOnDark,
    fontSize: 14,
    fontWeight: "600",
  },
});
