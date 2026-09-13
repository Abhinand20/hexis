import appConfig from "../app.json";

/**
 * `src/design/tokens.ts` defines one light palette and every screen hardcodes
 * it. Under "automatic", `expo-glass-effect` surfaces, the native tab bar,
 * modal headers, the date picker and alerts all follow the system, so a phone
 * in dark mode renders dark chrome and dark glass under near-black text.
 * Declaring dark support is a design decision, not a config flip.
 */
it("declares a light interface style to match the light-only palette", () => {
  expect(appConfig.expo.userInterfaceStyle).toBe("light");
});
