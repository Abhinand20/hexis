import Ionicons from "@expo/vector-icons/Ionicons";
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
  weeklySessionCount: number;
  weeklySessionTarget: number;
  todayLogs: SessionLog[];
  expectedDurationMinutes: number | null;
};

export type GoalRowProps = {
  model: GoalRowModel;
  onLogged?: (log: SessionLog) => void;
  onQuickLogged?: (log: SessionLog) => void;
  onUndoLog?: (log: SessionLog) => Promise<void>;
  isUndoPending?: boolean;
};

export function GoalRow({
  model,
  onLogged,
  onQuickLogged,
  onUndoLog,
  isUndoPending = false,
}: GoalRowProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [quickLogError, setQuickLogError] = useState<string | null>(null);
  const quickLogInFlight = useRef(false);
  const { logSession, isPending } = useLogSession();
  const targetMet = model.weeklySessionCount >= model.weeklySessionTarget;
  const sessionControlLabel = targetMet
    ? `${model.name}: weekly target met with ${model.weeklySessionCount} sessions. Log another session.`
    : `Log ${model.name}: ${model.weeklySessionCount} of ${model.weeklySessionTarget} sessions this week.`;

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
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Logs one session using the expected duration."
        accessibilityLabel={sessionControlLabel}
        accessibilityState={{ disabled: isPending }}
        disabled={isPending}
        onPress={() => {
          void handleQuickLog();
        }}
        style={[styles.sessionControl, isPending ? styles.buttonDisabled : null]}
      >
        <View
          style={[
            styles.sessionIndicator,
            targetMet ? styles.sessionIndicatorMet : null,
            model.weeklySessionCount > 0 && !targetMet
              ? styles.sessionIndicatorInProgress
              : null,
          ]}
        >
          {targetMet ? (
            <Ionicons color={colors.inkOnDark} name="checkmark" size={18} />
          ) : model.weeklySessionCount > 0 ? (
            <Text style={styles.sessionControlCount}>{model.weeklySessionCount}</Text>
          ) : null}
        </View>
      </Pressable>
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
          accessibilityLabel={`Log details for ${model.name}`}
          accessibilityState={{ disabled: isPending || isUndoPending }}
          disabled={isPending || isUndoPending}
          onPress={() => setSheetVisible(true)}
          style={[
            styles.detailsButton,
            isPending || isUndoPending ? styles.buttonDisabled : null,
          ]}
        >
          <Ionicons color={colors.mutedInk} name="ellipsis-horizontal" size={22} />
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
        onUndoLog={onUndoLog}
        todayLogs={model.todayLogs}
        undoPending={isUndoPending}
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
  sessionControl: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sessionIndicator: {
    alignItems: "center",
    borderColor: colors.mutedInk,
    borderRadius: 16,
    borderWidth: 1.5,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  sessionIndicatorInProgress: {
    backgroundColor: "#E4EEEA",
    borderColor: colors.verdigris,
  },
  sessionIndicatorMet: {
    backgroundColor: colors.verdigris,
    borderColor: colors.verdigris,
  },
  sessionControlCount: {
    color: colors.verdigris,
    fontSize: 13,
    fontWeight: "700",
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
  buttonDisabled: {
    opacity: 0.6,
  },
  detailsButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    width: 44,
  },
});
