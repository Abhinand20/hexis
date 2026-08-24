import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../../../design/tokens";

export type RecentRhythmDay = {
  localDate: string;
  sessionCount: number;
};

export type RecentRhythmProps = {
  days: RecentRhythmDay[];
  previousWeekSessionDelta: number | null;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayLabels(localDate: string): {
  weekday: string;
  shortDate: string;
  accessibleDate: string;
} {
  const date = parseLocalDate(localDate);
  const month = MONTH_NAMES[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();

  return {
    weekday: WEEKDAY_NAMES[date.getUTCDay()],
    shortDate: `${month} ${day}`,
    accessibleDate: `${WEEKDAY_NAMES[date.getUTCDay()]}, ${month} ${day}, ${year}`,
  };
}

function sessionLabel(count: number): string {
  return `${count} ${count === 1 ? "session" : "sessions"}`;
}

function deltaLabels(delta: number | null): {
  visible: string;
  accessible: string;
} {
  if (delta === null) {
    return {
      visible: "Previous week · comparison unavailable",
      accessible: "Previous-week comparison unavailable.",
    };
  }

  if (delta === 0) {
    return {
      visible: "Previous week · no change",
      accessible: "Compared with the previous week: no change in sessions.",
    };
  }

  const magnitude = Math.abs(delta);
  const signedDelta = delta > 0 ? `+${delta}` : `−${magnitude}`;
  const direction = delta > 0 ? "more" : "fewer";
  const unit = magnitude === 1 ? "session" : "sessions";

  return {
    visible: `Previous week · ${signedDelta} ${unit}`,
    accessible: `Compared with the previous week: ${magnitude} ${direction} ${unit}.`,
  };
}

export function RecentRhythm({
  days,
  previousWeekSessionDelta,
}: RecentRhythmProps) {
  const delta = deltaLabels(previousWeekSessionDelta);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Recent rhythm
        </Text>
        <Text style={styles.subtitle}>Last 7 days</Text>
      </View>

      <View style={styles.days}>
        {days.map((day) => {
          const labels = dayLabels(day.localDate);
          const sessions = sessionLabel(day.sessionCount);

          return (
            <View
              accessible
              accessibilityLabel={`${labels.accessibleDate}. ${sessions}.`}
              key={day.localDate}
              style={styles.day}
            >
              <Text accessibilityElementsHidden style={styles.weekday}>
                {labels.weekday}
              </Text>
              <Text accessibilityElementsHidden style={styles.date}>
                {labels.shortDate}
              </Text>
              <Text accessibilityElementsHidden style={styles.count}>
                {day.sessionCount}
              </Text>
              <Text accessibilityElementsHidden style={styles.sessionUnit}>
                {day.sessionCount === 1 ? "session" : "sessions"}
              </Text>
            </View>
          );
        })}
      </View>

      <Text accessibilityLabel={delta.accessible} style={styles.delta}>
        {delta.visible}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.hairline,
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    padding: spacing.lg,
    width: "100%",
  },
  heading: {
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
  days: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  day: {
    alignItems: "flex-start",
    backgroundColor: "#E4EEEA",
    borderCurve: "continuous",
    borderRadius: 10,
    flexBasis: 64,
    flexGrow: 1,
    gap: 2,
    minWidth: 64,
    padding: spacing.sm,
  },
  weekday: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  date: {
    color: colors.mutedInk,
    fontSize: 13,
  },
  count: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
  },
  sessionUnit: {
    color: colors.mutedInk,
    fontSize: 12,
  },
  delta: {
    color: colors.mutedInk,
    fontSize: 14,
  },
});
