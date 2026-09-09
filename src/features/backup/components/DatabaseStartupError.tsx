import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../design/tokens";
import { useDatabase } from "../../../db/DatabaseProvider";
import { BackupPreviewCopy } from "./BackupPreviewCopy";
import { useRestoreBackup } from "../hooks/useRestoreBackup";

export function DatabaseStartupError({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  const { retryOpen, isBusy } = useDatabase();
  const restore = useRestoreBackup();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.title}>Hexis could not open its database</Text>
      <Text style={styles.body}>
        Your data was not deleted. Retry the open, or restore from a backup you
        saved to iCloud Drive. A damaged database file is renamed aside rather
        than erased.
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.error}>
        {message}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={() => {
          void retryOpen();
        }}
        style={styles.primary}
      >
        <Text style={styles.primaryLabel}>Retry</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || restore.state.status === "working"}
        onPress={() => {
          void restore.startRestore();
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryLabel}>Restore from backup</Text>
      </Pressable>

      {restore.state.status === "preview" ? (
        <View style={styles.preview}>
          <BackupPreviewCopy preview={restore.state.staged.preview} />
          <Text style={styles.body}>
            This replaces all data on this phone and does not merge. The current
            file is unreadable, so Hexis will rename it aside and restore into a
            new database.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restore.confirmRestore();
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>Confirm restore</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restore.cancelPreview();
            }}
          >
            <Text style={styles.secondaryLabel}>Cancel restore</Text>
          </Pressable>
        </View>
      ) : null}

      {restore.state.status === "error" ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {restore.state.message}
        </Text>
      ) : null}

      {restore.state.status === "success" && restore.state.reminderWarning ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {restore.state.reminderWarning}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "600",
  },
  body: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
    lineHeight: 20,
  },
  primary: {
    alignSelf: "flex-start",
    backgroundColor: colors.verdigris,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryLabel: {
    color: colors.inkOnDark,
    fontSize: 15,
    fontWeight: "600",
  },
  secondary: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
  },
  secondaryLabel: {
    color: colors.verdigris,
    fontSize: 15,
    fontWeight: "600",
  },
  preview: {
    gap: spacing.md,
  },
});
