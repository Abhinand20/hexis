import { Text } from "react-native";

import { colors } from "../../../design/tokens";
import type { SnapshotPreview } from "../data/snapshotValidation";

export function BackupPreviewCopy({ preview }: { preview: SnapshotPreview }) {
  return (
    <>
      <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>
        {preview.createdAt
          ? `Snapshot created ${preview.createdAt}`
          : "This file has no backup creation date."}
      </Text>
      <Text style={{ color: colors.mutedInk, fontSize: 14, lineHeight: 20 }}>
        App {preview.appVersion ?? "unknown"} · schema {preview.schemaVersion}
      </Text>
      <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 22 }}>
        {preview.cycleCount} cycle{preview.cycleCount === 1 ? "" : "s"},{" "}
        {preview.sessionCount} session{preview.sessionCount === 1 ? "" : "s"},{" "}
        {preview.correctionCount} correction
        {preview.correctionCount === 1 ? "" : "s"},{" "}
        {preview.weightEntryCount} weight
        {preview.weightEntryCount === 1 ? " entry" : " entries"}.
        {preview.hasActiveCycle
          ? " It contains an active cycle."
          : " It does not contain an active cycle."}
      </Text>
    </>
  );
}
