import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../../src/design/tokens";
import { CycleSetupProvider } from "../../src/features/cycles/hooks/useCycleSetupState";

export function CancelButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Cancel"
      accessibilityRole="button"
      onPress={() => router.dismiss()}
    >
      <Text style={styles.cancel}>Cancel</Text>
    </Pressable>
  );
}

export default function SetupLayout() {
  return (
    <CycleSetupProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen
          name="duration"
          options={{ title: "Cycle length", headerLeft: () => <CancelButton /> }}
        />
        <Stack.Screen name="practices" options={{ title: "Practices" }} />
        <Stack.Screen name="review" options={{ title: "Review and start" }} />
      </Stack>
    </CycleSetupProvider>
  );
}

const styles = StyleSheet.create({
  cancel: {
    color: colors.ink,
    fontSize: 17,
  },
});
