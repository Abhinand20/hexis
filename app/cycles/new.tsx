import { StyleSheet, Text, View } from "react-native";

/**
 * Placeholder so routing works end-to-end after Task 1. The real onboarding
 * flow (welcome -> duration -> practices -> review) is built in Task 5.
 */
export default function NewCycleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start a new cycle</Text>
      <Text style={styles.subtitle}>Cycle setup is coming soon.</Text>
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
