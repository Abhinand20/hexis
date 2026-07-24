import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { GlassSurface } from "../../src/design/GlassSurface";

it("renders its children when native glass is unavailable", async () => {
  const screen = await render(
    <GlassSurface glassAvailable={false}>
      <Text>Log session</Text>
    </GlassSurface>,
  );
  expect(screen.getByText("Log session")).toBeTruthy();
});
