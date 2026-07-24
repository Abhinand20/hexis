import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

/**
 * Placeholder so routing works end-to-end after Task 5 (cycle creation
 * routes here) and the M1 index redirect. The real landing page (header,
 * calendar, goal list, logging) is built in Task 7.
 */
export default function CycleLandingScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cycle {cycleId}</Text>
      <Text style={styles.subtitle}>The cycle landing page is coming soon.</Text>
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
});
