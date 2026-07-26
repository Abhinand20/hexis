import { Tabs } from "expo-router";

import { colors } from "../../src/design/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.verdigris,
        tabBarInactiveTintColor: colors.mutedInk,
        tabBarStyle: { backgroundColor: colors.porcelain, borderTopColor: colors.hairline },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="week" options={{ title: "Week" }} />
      <Tabs.Screen name="settings/index" options={{ title: "Settings" }} />
    </Tabs>
  );
}
