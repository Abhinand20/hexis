import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DatabaseProvider } from "../src/db/DatabaseProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="setup"
            options={{ presentation: "modal", headerShown: false }}
          />
          <Stack.Screen
            name="cycles/[cycleId]/edit-goal/[goalId]"
            options={{
              presentation: "modal",
              headerShown: true,
              title: "Edit practice",
            }}
          />
          <Stack.Screen
            name="cycles/[cycleId]/add-goal"
            options={{
              presentation: "modal",
              headerShown: true,
              title: "Add practice",
            }}
          />
        </Stack>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
