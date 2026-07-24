import { render } from "@testing-library/react-native";
import { Text } from "react-native";

it("renders a native screen", async () => {
  expect((await render(<Text>Hexis</Text>)).getByText("Hexis")).toBeTruthy();
});
