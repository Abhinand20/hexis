import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "./tokens";

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  glassAvailable?: boolean;
};

export function GlassSurface({
  children,
  style,
  glassAvailable,
}: GlassSurfaceProps) {
  const available =
    glassAvailable !== undefined ? glassAvailable : isLiquidGlassAvailable();

  if (available) {
    return <GlassView style={style}>{children}</GlassView>;
  }

  return <View style={[stylesFallback.surface, style]}>{children}</View>;
}

const stylesFallback = StyleSheet.create({
  surface: {
    backgroundColor: `${colors.porcelain}EB`,
    borderColor: colors.hairline,
    borderWidth: StyleSheet.hairlineWidth,
  },
});