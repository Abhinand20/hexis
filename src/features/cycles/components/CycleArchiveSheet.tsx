import { memo, useCallback } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { colors, spacing } from "../../../design/tokens";

export type CycleArchiveItem = {
  id: string;
  name: string;
  dateRange: string;
  status: "active" | "completed" | "ended_early";
  sessionCount: number;
  minutesLogged: number;
  activeDayRatio: number;
  practiceNames: string[];
};

export type CycleArchiveSheetProps = {
  visible: boolean;
  items: CycleArchiveItem[];
  selectedCycleId: string | null;
  onSelectCycle: (id: string) => void;
  onDismiss: () => void;
};

const STATUS_LABELS: Record<CycleArchiveItem["status"], string> = {
  active: "Active",
  completed: "Completed",
  ended_early: "Ended early",
};

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function activeDayPercentage(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function keyExtractor(item: CycleArchiveItem): string {
  return item.id;
}

function ArchiveSeparator() {
  return <View style={styles.separator} />;
}

function ArchiveEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No cycles yet</Text>
      <Text style={styles.emptyBody}>
        Finished and active cycles will appear here.
      </Text>
    </View>
  );
}

type CycleArchiveRowProps = {
  id: string;
  name: string;
  dateRange: string;
  status: CycleArchiveItem["status"];
  sessionCount: number;
  minutesLogged: number;
  activeDayRatio: number;
  practiceLabel: string;
  selected: boolean;
  onSelectCycle: (id: string) => void;
};

const CycleArchiveRow = memo(function CycleArchiveRow({
  id,
  name,
  dateRange,
  status,
  sessionCount,
  minutesLogged,
  activeDayRatio,
  practiceLabel,
  selected,
  onSelectCycle,
}: CycleArchiveRowProps) {
  const handlePress = useCallback(() => {
    onSelectCycle(id);
  }, [id, onSelectCycle]);
  const statusLabel = STATUS_LABELS[status];
  const sessionLabel = pluralize(sessionCount, "session");
  const minuteLabel = pluralize(minutesLogged, "minute");
  const activeDaysLabel = `${activeDayPercentage(activeDayRatio)}% active days`;

  return (
    <Pressable
      accessibilityHint="Shows this cycle in History."
      accessibilityLabel={`${name}, ${statusLabel}, ${dateRange}, ${sessionLabel}, ${minuteLabel}, ${activeDaysLabel}, ${practiceLabel}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={[styles.row, selected ? styles.rowSelected : null]}
    >
      <View style={styles.rowHeading}>
        <Text numberOfLines={2} style={styles.cycleName}>
          {name}
        </Text>
        <View
          style={[
            styles.statusBadge,
            status === "active" ? styles.statusBadgeActive : null,
            status === "ended_early" ? styles.statusBadgeEndedEarly : null,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              status === "active" ? styles.statusTextActive : null,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.dateRange}>{dateRange}</Text>
      <Text style={styles.summary}>
        {sessionLabel} · {minuteLabel} · {activeDaysLabel}
      </Text>
      <Text numberOfLines={2} style={styles.practices}>
        {practiceLabel}
      </Text>

      {selected ? (
        <Text accessibilityElementsHidden style={styles.selectedLabel}>
          Selected
        </Text>
      ) : null}
    </Pressable>
  );
});

export function CycleArchiveSheet({
  visible,
  items,
  selectedCycleId,
  onSelectCycle,
  onDismiss,
}: CycleArchiveSheetProps) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CycleArchiveItem>) => (
      <CycleArchiveRow
        activeDayRatio={item.activeDayRatio}
        dateRange={item.dateRange}
        id={item.id}
        minutesLogged={item.minutesLogged}
        name={item.name}
        onSelectCycle={onSelectCycle}
        practiceLabel={
          item.practiceNames.length === 0
            ? "No practices"
            : item.practiceNames.join(", ")
        }
        selected={item.id === selectedCycleId}
        sessionCount={item.sessionCount}
        status={item.status}
      />
    ),
    [onSelectCycle, selectedCycleId],
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onDismiss}
      presentationStyle="formSheet"
      testID="cycle-archive-modal"
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Cycle archive
            </Text>
            <Text style={styles.subtitle}>Choose a cycle to review</Text>
          </View>
          <Pressable
            accessibilityLabel="Close cycle archive"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDismiss}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          extraData={selectedCycleId}
          ItemSeparatorComponent={ArchiveSeparator}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ArchiveEmptyState}
          renderItem={renderItem}
          testID="cycle-archive-list"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  closeButtonText: {
    color: colors.verdigris,
    fontSize: 16,
    fontWeight: "600",
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
  row: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 44,
    padding: spacing.lg,
  },
  rowSelected: {
    backgroundColor: "#EEF3F1",
    borderColor: colors.verdigris,
    borderWidth: 2,
  },
  rowHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cycleName: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
  },
  statusBadge: {
    backgroundColor: "#EFEEE9",
    borderCurve: "continuous",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeActive: {
    backgroundColor: colors.verdigris,
  },
  statusBadgeEndedEarly: {
    backgroundColor: "#F3E9E5",
  },
  statusText: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextActive: {
    color: colors.inkOnDark,
  },
  dateRange: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  summary: {
    color: colors.ink,
    fontSize: 14,
  },
  practices: {
    color: colors.mutedInk,
    fontSize: 14,
  },
  selectedLabel: {
    color: colors.verdigris,
    fontSize: 13,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBody: {
    color: colors.mutedInk,
    fontSize: 14,
    textAlign: "center",
  },
});
