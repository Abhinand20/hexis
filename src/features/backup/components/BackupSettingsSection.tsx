import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { useRouter } from "expo-router";

import { colors, spacing } from "../../../design/tokens";
import { useDatabase } from "../../../db/DatabaseProvider";
import { BackupPreviewCopy } from "./BackupPreviewCopy";
import { BackupCreateResult } from "./BackupCreateResult";
import {
  ICLOUD_DRIVE_INSTRUCTION,
  SHARE_HONESTY_COPY,
  useCreateBackup,
} from "../hooks/useCreateBackup";
import { useBackupStatus } from "../hooks/useBackupStatus";
import { useRestoreBackup } from "../hooks/useRestoreBackup";

export function BackupSettingsSection() {
  const router = useRouter();
  const { isBusy = false } = useDatabase();
  const backupStatus = useBackupStatus();
  const create = useCreateBackup();
  const restore = useRestoreBackup();

  useEffect(() => {
    if (
      restore.state.status === "success" &&
      restore.state.reminderWarning == null
    ) {
      router.replace("/");
    }
  }, [restore.state, router]);

  useEffect(() => {
    if (create.state.status === "success" || create.state.status === "cancelled") {
      void backupStatus.reload();
    }
  }, [backupStatus.reload, create.state.status]);

  const disabled = isBusy || create.state.status === "working" || restore.state.status === "working";

  return (
    <View>
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Data & backup</Text>
      {backupStatus.status.lastBackupCreatedAt ? (
        <Text style={styles.body}>
          Last backup created {backupStatus.ageLabel}.
        </Text>
      ) : (
        <Text style={styles.body}>No backup yet.</Text>
      )}
      <Text style={styles.honesty}>{SHARE_HONESTY_COPY}</Text>
      {backupStatus.hasChangesSinceBackup ? (
        <Text style={styles.body}>You have changes since then.</Text>
      ) : null}
      {backupStatus.isStale ? (
        <Text style={styles.body}>
          Save a copy to iCloud Drive this week if you have not already.
        </Text>
      ) : null}
      <Text style={styles.instruction}>{ICLOUD_DRIVE_INSTRUCTION}</Text>
      <Text style={styles.caption}>
        The backup file is unencrypted personal data. Keep it somewhere private.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          void create.createBackup();
        }}
        style={styles.row}
      >
        <Text style={styles.actionLabel}>Create backup</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          void restore.checkBackup();
        }}
        style={styles.row}
      >
        <Text style={styles.actionLabel}>Check a backup file</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          void restore.startRestore();
        }}
        style={styles.row}
      >
        <Text style={styles.actionLabel}>Restore backup</Text>
      </Pressable>

      <BackupCreateResult
        state={create.state}
        onRetry={() => {
          void create.createBackup();
        }}
      />

      {restore.state.status === "check" ? (
        <View style={styles.panel}>
          <Text style={styles.body}>This file looks like a Hexis backup.</Text>
          <BackupPreviewCopy preview={restore.state.preview} />
          <Text style={styles.caption}>
            Checking a file does not mark it verified. Hexis does not persist a
            verified state it cannot honestly maintain.
          </Text>
        </View>
      ) : null}

      {restore.state.status === "preview" ? (
        <View style={styles.panel}>
          <Text style={styles.body}>
            This replaces all data on this phone and does not merge.
          </Text>
          <BackupPreviewCopy preview={restore.state.staged.preview} />
          {!restore.state.installationEmpty ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void restore.backupCurrentFirst();
              }}
              style={styles.row}
            >
              <Text style={styles.actionLabel}>Back up current data first</Text>
            </Pressable>
          ) : null}
          <Text style={styles.caption}>
            Hexis also keeps a local pre-restore snapshot as insurance against a
            restore bug. That copy does not survive losing this phone.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restore.confirmRestore();
            }}
            style={styles.row}
          >
            <Text style={styles.destructiveLabel}>Confirm restore</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void restore.cancelPreview();
            }}
            style={styles.row}
          >
            <Text style={styles.actionLabel}>Cancel restore</Text>
          </Pressable>
        </View>
      ) : null}

      {restore.state.status === "error" ? (
        <View style={styles.panel}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {restore.state.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              restore.reset();
              void restore.startRestore();
            }}
          >
            <Text style={styles.actionLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {restore.state.status === "success" && restore.state.reminderWarning ? (
        <View style={styles.panel}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {restore.state.reminderWarning}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.replace("/");
            }}
          >
            <Text style={styles.actionLabel}>Continue to Home</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.xs,
  },
  honesty: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
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
  row: {
    paddingVertical: spacing.md,
  },
  actionLabel: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "500",
  },
  destructiveLabel: {
    color: "#8B3A3A",
    fontSize: 16,
    fontWeight: "500",
  },
  error: {
    color: "#8B3A3A",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
  panel: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
