// Screens use `useSafeAreaInsets`, which throws outside a real
// `SafeAreaProvider`. Use the library's official Jest mock (zero insets by
// default) so component tests don't need to wrap every render in a provider.
jest.mock("react-native-safe-area-context", () => {
  const mock = require("react-native-safe-area-context/jest/mock");
  // The mock's source only has a default export; unwrap it so named
  // imports like `useSafeAreaInsets` resolve correctly under ts-jest/babel
  // CJS interop.
  return mock.default ?? mock;
});
