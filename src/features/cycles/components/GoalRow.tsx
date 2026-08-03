import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { LogSessionSheet } from "../../logging/components/LogSessionSheet";
import { useLogSession } from "../../logging/hooks/useLogSession";
import { todayLocalDate } from "../domain/date";
import type { SessionLog } from "../domain/types";
import { ProgressLine } from "./ProgressLine";

export type GoalRowModel = {
  goalId: string;
  name: string;
  streakLabel: string;
  weeklyProgressLabel: string;
  weeklyProgressRatio: number;
  expectedDurationMinutes: number | null;
};

export type GoalRowProps = {
  model: GoalRowModel;
  onLogged?: (log: SessionLog) => void;
  onQuickLogged?: (log: SessionLog) => void;
};

export function GoalRow({ model, onLogged, onQuickLogged }: GoalRowProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [quickLogError, setQuickLogError] = useState<string | null>(null);
  const quickLogInFlight = useRef(false);
  const { logSession, isPending } = useLogSession();

  async function handleQuickLog() {
    if (quickLogInFlight.current || isPending) {
      return;
    }

    quickLogInFlight.current = true;
    setQuickLogError(null);
    try {
      const log = await logSession({
        cycleGoalId: model.goalId,
        localDate: todayLocalDate(),
        durationMinutes: model.expectedDurationMinutes,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onQuickLogged?.(log);
      onLogged?.(log);
    } catch (err) {
      setQuickLogError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      quickLogInFlight.current = false;
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{model.name}</Text>
        <Text style={styles.streak}>{model.streakLabel}</Text>
        <ProgressLine
          ratio={model.weeklyProgressRatio}
          label={model.weeklyProgressLabel}
        />
        {quickLogError ? <Text style={styles.error}>{quickLogError}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Log ${model.name}`}
          accessibilityState={{ disabled: isPending }}
          disabled={isPending}
          onPress={() => {
            void handleQuickLog();
          }}
          style={[styles.logButton, isPending ? styles.buttonDisabled : null]}
        >
          <Text style={styles.logButtonText}>Log</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Log details for ${model.name}`}
          accessibilityState={{ disabled: isPending }}
          disabled={isPending}
          onPress={() => setSheetVisible(true)}
          style={[styles.detailsButton, isPending ? styles.buttonDisabled : null]}
        >
          <Text style={styles.detailsButtonText}>Details</Text>
        </Pressable>
      </View>

      <LogSessionSheet
        goal={{
          id: model.goalId,
          name: model.name,
          expectedDurationMinutes: model.expectedDurationMinutes,
        }}
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}
        onLogged={onLogged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  streak: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 13,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  logButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logButtonText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
  detailsButton: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailsButtonText: {
    color: colors.verdigris,
    fontSize: 13,
    fontWeight: "600",
  },
});
