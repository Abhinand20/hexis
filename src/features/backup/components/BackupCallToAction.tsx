import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";
import { useDatabase } from "../../../db/DatabaseProvider";
import { BackupCreateResult } from "./BackupCreateResult";
import { useBackupStatus } from "../hooks/useBackupStatus";
import {
  ICLOUD_DRIVE_INSTRUCTION,
  SHARE_HONESTY_COPY,
  useCreateBackup,
} from "../hooks/useCreateBackup";

/**
 * The completion-moment prompt to back up. Settings keeps the full data
 * section; this offers creation only, so it must not imply that checking or
 * restoring happens here.
 */
export function BackupCallToAction() {
  const { isBusy = false } = useDatabase();
  const backupStatus = useBackupStatus();
  const create = useCreateBackup();

  useEffect(() => {
    if (
      create.state.status === "success" ||
      create.state.status === "cancelled"
    ) {
      void backupStatus.reload();
    }
  }, [backupStatus.reload, create.state.status]);

  const working = create.state.status === "working";

  return (
    <View style={styles.block}>
      <Text style={styles.freshness}>
        {backupStatus.status.lastBackupCreatedAt
          ? `Last backup created ${backupStatus.ageLabel}.`
          : "No backup yet."}
      </Text>
      {backupStatus.hasChangesSinceBackup ? (
        <Text style={styles.freshness}>You have changes since then.</Text>
      ) : null}
      <Text style={styles.honesty}>{SHARE_HONESTY_COPY}</Text>
      <Text style={styles.instruction}>{ICLOUD_DRIVE_INSTRUCTION}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBusy || working }}
        disabled={isBusy || working}
        onPress={() => {
          void create.createBackup();
        }}
        style={({ pressed }) => [
          styles.button,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.buttonText}>
          {working ? "Backing up…" : "Back up data"}
        </Text>
      </Pressable>
      <BackupCreateResult
        state={create.state}
        onRetry={() => {
          void create.createBackup();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  freshness: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  honesty: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  instruction: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    paddingVertical: spacing.xs,
  },
  button: {
    alignItems: "center",
    borderColor: colors.verdigris,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
