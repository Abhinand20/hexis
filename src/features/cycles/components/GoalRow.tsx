import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { LogSessionSheet } from "../../logging/components/LogSessionSheet";
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
};

export function GoalRow({ model, onLogged }: GoalRowProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{model.name}</Text>
        <Text style={styles.streak}>{model.streakLabel}</Text>
        <ProgressLine
          ratio={model.weeklyProgressRatio}
          label={model.weeklyProgressLabel}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Log ${model.name}`}
        onPress={() => setSheetVisible(true)}
        style={styles.logButton}
      >
        <Text style={styles.logButtonText}>Log</Text>
      </Pressable>

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
  logButton: {
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  logButtonText: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
});
