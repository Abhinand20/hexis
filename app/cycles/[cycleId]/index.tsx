import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDatabase } from "../../../src/db/DatabaseProvider";
import { colors, spacing } from "../../../src/design/tokens";

/**
 * Placeholder so routing works end-to-end after Task 5 (cycle creation
 * routes here) and the M1 index redirect. The real landing page (header,
 * calendar, goal list, logging) is built in Task 7.
 */
export default function CycleLandingScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetDatabase } = useDatabase();

  function confirmReset() {
    Alert.alert(
      "Reset all local data?",
      "This deletes every cycle, goal, and logged session on this device so you can walk through onboarding again. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetDatabase();
            router.replace("/cycles/new");
          },
        },
      ],
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Text style={styles.title}>Cycle {cycleId}</Text>
      <Text style={styles.subtitle}>The cycle landing page is coming soon.</Text>

      {__DEV__ ? (
        <View style={styles.debugPanel}>
          <Text style={styles.debugLabel}>Debug only</Text>
          <Pressable
            accessibilityRole="button"
            onPress={confirmReset}
            style={styles.debugButton}
          >
            <Text style={styles.debugButtonText}>Reset all data</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#F7F5F0",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#1B1B19",
    fontSize: 22,
    fontWeight: "600",
  },
  subtitle: {
    color: "#6B6964",
    fontSize: 15,
    textAlign: "center",
  },
  debugPanel: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  debugLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  debugButton: {
    backgroundColor: "#8B3A3A",
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  debugButtonText: {
    color: colors.inkOnDark,
    fontSize: 14,
    fontWeight: "600",
  },
});
