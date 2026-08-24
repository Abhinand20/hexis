import { fireEvent, render } from "@testing-library/react-native";

import {
  CycleArchiveSheet,
  type CycleArchiveItem,
} from "../../src/features/cycles/components/CycleArchiveSheet";

const archiveItems: CycleArchiveItem[] = [
  {
    id: "cycle-current",
    name: "Autumn Foundation",
    dateRange: "Aug 1–Aug 30, 2026",
    status: "active",
    sessionCount: 9,
    minutesLogged: 405,
    activeDayRatio: 0.72,
    practiceNames: ["Strength", "Read"],
  },
  {
    id: "cycle-completed",
    name: "Summer Focus",
    dateRange: "Jul 1–Jul 30, 2026",
    status: "completed",
    sessionCount: 1,
    minutesLogged: 60,
    activeDayRatio: 1,
    practiceNames: ["Run"],
  },
  {
    id: "cycle-ended",
    name: "Spring Reset",
    dateRange: "Apr 1–Apr 18, 2026",
    status: "ended_early",
    sessionCount: 0,
    minutesLogged: 0,
    activeDayRatio: 0,
    practiceNames: [],
  },
];

async function renderArchive(
  overrides: Partial<React.ComponentProps<typeof CycleArchiveSheet>> = {},
) {
  const props: React.ComponentProps<typeof CycleArchiveSheet> = {
    visible: true,
    items: archiveItems,
    selectedCycleId: "cycle-current",
    onSelectCycle: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides,
  };

  return { ...(await render(<CycleArchiveSheet {...props} />)), props };
}

it("renders compact summaries for every cycle status", async () => {
  const screen = await renderArchive();

  expect(screen.getByRole("header", { name: "Cycle archive" })).toBeTruthy();
  expect(screen.getByText("Active")).toBeTruthy();
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.getByText("Ended early")).toBeTruthy();
  expect(screen.getByText("9 sessions · 405 minutes · 72% active days")).toBeTruthy();
  expect(screen.getByText("1 session · 60 minutes · 100% active days")).toBeTruthy();
  expect(screen.getByText("No practices")).toBeTruthy();
});

it("marks the current cycle selected and delegates another selection", async () => {
  const onSelectCycle = jest.fn();
  const screen = await renderArchive({ onSelectCycle });
  const currentCycle = screen.getByRole("button", {
    name: /Autumn Foundation, Active/,
  });
  const completedCycle = screen.getByRole("button", {
    name: /Summer Focus, Completed/,
  });

  expect(currentCycle).toBeSelected();
  expect(completedCycle).not.toBeSelected();

  await fireEvent.press(completedCycle);

  expect(onSelectCycle).toHaveBeenCalledTimes(1);
  expect(onSelectCycle).toHaveBeenCalledWith("cycle-completed");
});

it("dismisses from both the native request and the visible close action", async () => {
  const onDismiss = jest.fn();
  const screen = await renderArchive({ onDismiss });

  await fireEvent.press(
    screen.getByRole("button", { name: "Close cycle archive" }),
  );
  await fireEvent(screen.getByTestId("cycle-archive-modal"), "requestClose");

  expect(onDismiss).toHaveBeenCalledTimes(2);
});

it("shows a useful empty state without a loading dependency", async () => {
  const screen = await renderArchive({ items: [], selectedCycleId: null });

  expect(screen.getByText("No cycles yet")).toBeTruthy();
  expect(
    screen.getByText("Finished and active cycles will appear here."),
  ).toBeTruthy();
});

it("keeps a single cycle explicitly selectable", async () => {
  const screen = await renderArchive({ items: [archiveItems[0]] });

  expect(
    screen.getByRole("button", { name: /Autumn Foundation, Active/ }),
  ).toBeSelected();
  expect(screen.queryByText("No cycles yet")).toBeNull();
});

it("virtualizes a long archive instead of expanding it into the modal tree", async () => {
  const longArchive = Array.from({ length: 120 }, (_, index) => ({
    ...archiveItems[1],
    id: `cycle-${index}`,
    name: `Cycle ${index + 1}`,
  }));
  const screen = await renderArchive({
    items: longArchive,
    selectedCycleId: "cycle-0",
  });

  const list = screen.getByTestId("cycle-archive-list");
  expect(list.props.data).toHaveLength(120);
  expect(screen.getByText("Cycle 1")).toBeTruthy();
});

it("does not expose archive content while hidden", async () => {
  const screen = await renderArchive({ visible: false });

  expect(screen.queryByText("Cycle archive")).toBeNull();
});
