import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import {
  ICLOUD_DRIVE_INSTRUCTION,
  type CreateBackupState,
} from "../hooks/useCreateBackup";

/**
 * Shared so Settings and the wrap-up call to action cannot drift into making
 * different durability claims about the same outcome.
 */
export function BackupCreateResult({
  state,
  onRetry,
}: {
  state: CreateBackupState;
  onRetry: () => void;
}) {
  if (state.status === "success") {
    return (
      <View style={styles.panel}>
        <Text style={styles.body}>
          Backup file {state.fileName} is ready. Completing the share sheet does
          not prove iCloud has the file.
        </Text>
        <Text style={styles.instruction}>{ICLOUD_DRIVE_INSTRUCTION}</Text>
      </View>
    );
  }

  if (state.status === "cancelled") {
    return (
      <Text style={styles.caption}>
        Share was cancelled. No backup time was recorded.
      </Text>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.panel}>
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {state.message}
        </Text>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={styles.actionLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.xs,
  },
  instruction: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    paddingVertical: spacing.sm,
  },
  caption: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: spacing.sm,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
  actionLabel: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "500",
  },
});
