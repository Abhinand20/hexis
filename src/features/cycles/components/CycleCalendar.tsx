import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";

export type CycleCalendarDayInput = {
  localDate: string;
  intensity: 0 | 1 | 2;
};

export type CycleCalendarProps = {
  durationDays: number;
  todayIndex: number;
  days: CycleCalendarDayInput[];
  maximumInteractiveDate: string;
  onSelectDay: (localDate: string) => void;
  selectedDate?: string;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDisplayDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function intensityDescription(intensity: 0 | 1 | 2): string {
  if (intensity === 0) {
    return "No sessions logged";
  }
  if (intensity === 1) {
    return "Some sessions logged";
  }
  return "Most sessions logged";
}

export function CycleCalendar({
  durationDays,
  todayIndex,
  days,
  maximumInteractiveDate,
  onSelectDay,
  selectedDate,
}: CycleCalendarProps) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: durationDays }).map((_, index) => {
        const day = days[index];
        const dayNumber = index + 1;
        const isToday = index === todayIndex;
        const isSelected = day?.localDate === selectedDate;
        const label = isToday ? `Cycle day ${dayNumber}, today` : `Cycle day ${dayNumber}`;
        const hint = day
          ? `${formatDisplayDate(day.localDate)}. ${intensityDescription(day.intensity)}.`
          : undefined;

        if (!day || day.localDate > maximumInteractiveDate) {
          return (
            <View
              key={day?.localDate ?? `cycle-day-${dayNumber}`}
              testID={`cycle-day-${dayNumber}`}
              style={[
                styles.cell,
                day?.intensity === 1 ? styles.cellLow : null,
                day?.intensity === 2 ? styles.cellHigh : null,
                isToday ? styles.cellToday : null,
                styles.cellUnavailable,
              ]}
            />
          );
        }

        return (
          <Pressable
            key={day?.localDate ?? `cycle-day-${dayNumber}`}
            testID={`cycle-day-${dayNumber}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelectDay(day.localDate)}
            style={[
              styles.cell,
              day?.intensity === 1 ? styles.cellLow : null,
              day?.intensity === 2 ? styles.cellHigh : null,
              isToday ? styles.cellToday : null,
              isSelected ? styles.cellSelected : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const CELL_SIZE = 22;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cell: {
    backgroundColor: colors.hairline,
    borderRadius: 4,
    borderCurve: "continuous",
    height: CELL_SIZE,
    width: CELL_SIZE,
  },
  cellLow: {
    backgroundColor: "#A9C4BC",
  },
  cellHigh: {
    backgroundColor: colors.verdigris,
  },
  cellToday: {
    borderColor: colors.ink,
    borderWidth: 2,
  },
  cellSelected: {
    borderColor: colors.verdigris,
    borderWidth: 3,
  },
  cellUnavailable: {
    opacity: 0.45,
  },
});
