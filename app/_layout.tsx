import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DatabaseProvider } from "../src/db/DatabaseProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}
