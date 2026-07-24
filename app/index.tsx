import { StyleSheet, Text, View } from "react-native";

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hexis ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#F7F5F0",
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#1B1B19",
    fontSize: 24,
    fontWeight: "600",
  },
});
