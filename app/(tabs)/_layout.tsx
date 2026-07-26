import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "../../src/design/tokens";

// A single icon per tab, tinted by `tintColor` for the active state.
// A distinct filled/outline pair per default/selected state was tried, but
// `NativeTabs.Trigger.VectorIcon` resolves each icon via an async
// `getImageSource` call, and when the two promises for a tab settle on
// different frames, RNScreens briefly sees a `selectedIcon` with no matching
// `icon` and throws. Using one glyph per tab avoids the race entirely.
function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return <NativeTabs.Trigger.VectorIcon family={Ionicons} name={name} />;
}

// `iconColor` must be set for both the default and selected states (not just
// `tintColor`), or expo-router derives asymmetric icon-tinting appearance for
// the two states (`selectedIconColor` falls back to `tintColor` while the
// base `iconColor` stays unset). That asymmetry makes RNScreens compute a
// different render mode ("original" vs "template") for `icon` vs
// `selectedIcon` even though both point at the same image, which it rejects
// with "[RNScreens] icon and selectedIcon must be same type."
const ICON_COLOR = { default: colors.mutedInk, selected: colors.verdigris };

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.verdigris} iconColor={ICON_COLOR}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIcon("home-outline")} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIcon("time-outline")} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week">
        <NativeTabs.Trigger.Label>Week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIcon("calendar-outline")} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings/index">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={tabIcon("settings-outline")} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
