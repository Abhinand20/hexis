import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "../../src/design/tokens";

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.verdigris}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="time-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="time" />,
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week">
        <NativeTabs.Trigger.Label>Week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="calendar-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="calendar" />,
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings/index">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="settings-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="settings" />,
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
