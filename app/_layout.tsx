import { Stack } from "expo-router";

import { DatabaseProvider } from "../src/db/DatabaseProvider";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DatabaseProvider>
  );
}
