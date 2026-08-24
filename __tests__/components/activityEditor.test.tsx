import { render, userEvent } from "@testing-library/react-native";

import {
  ActivityEditorSheet,
  type ActivityEditorSheetProps,
} from "../../src/features/logging/components/ActivityEditorSheet";

const practices = [
  { id: "goal-strength", name: "Strength" },
  { id: "goal-read", name: "Read" },
];

const baseProps: ActivityEditorSheetProps = {
  mode: "add",
  visible: true,
  practices,
  initialValue: {
    practiceId: "goal-strength",
    localDate: "2026-08-20",
    startedTime: "09:30",
    durationMinutes: 30,
  },
  minDate: "2026-08-01",
  maxDate: "2026-08-23",
  onDismiss: jest.fn(),
  onSave: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing while hidden", async () => {
  const screen = await render(<ActivityEditorSheet {...baseProps} visible={false} />);

  expect(screen.queryByText("Add activity")).toBeNull();
});

it("renders the add draft and saves updated structured values", async () => {
  const onSave = jest.fn();
  const screen = await render(<ActivityEditorSheet {...baseProps} onSave={onSave} />);
  const user = userEvent.setup();

  expect(screen.getByRole("radio", { name: "Strength" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "30 min" })).toBeChecked();

  await user.press(screen.getByRole("radio", { name: "Read" }));
  await user.clear(screen.getByLabelText("Activity date"));
  await user.type(screen.getByLabelText("Activity date"), "2026-08-19");
  await user.clear(screen.getByLabelText("Activity start time"));
  await user.type(screen.getByLabelText("Activity start time"), "18:45");
  await user.press(screen.getByRole("radio", { name: "45 min" }));
  await user.press(screen.getByRole("button", { name: "Add activity" }));

  expect(onSave).toHaveBeenCalledWith({
    practiceId: "goal-read",
    localDate: "2026-08-19",
    startedTime: "18:45",
    durationMinutes: 45,
  });
});

it("allows a durationless activity and custom positive minutes", async () => {
  const onSave = jest.fn();
  const screen = await render(<ActivityEditorSheet {...baseProps} onSave={onSave} />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("radio", { name: "No duration" }));
  await user.press(screen.getByRole("button", { name: "Add activity" }));
  expect(onSave).toHaveBeenLastCalledWith({
    ...baseProps.initialValue,
    durationMinutes: null,
  });

  await user.clear(screen.getByLabelText("Custom duration in minutes"));
  await user.type(screen.getByLabelText("Custom duration in minutes"), "25");
  await user.press(screen.getByRole("button", { name: "Add activity" }));
  expect(onSave).toHaveBeenLastCalledWith({
    ...baseProps.initialValue,
    durationMinutes: 25,
  });
});

it("shows required, format, bounds, and duration validation before saving", async () => {
  const onSave = jest.fn();
  const screen = await render(
    <ActivityEditorSheet
      {...baseProps}
      practices={[]}
      initialValue={{
        practiceId: "",
        localDate: "2026-08-31",
        startedTime: "25:90",
        durationMinutes: 0,
      }}
      onSave={onSave}
    />,
  );
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Add activity" }));

  expect(screen.getByText("Choose a practice available on this date.")).toBeTruthy();
  expect(screen.getByText("Choose a date from 2026-08-01 through 2026-08-23.")).toBeTruthy();
  expect(screen.getByText("Enter a valid time in 24-hour HH:mm format.")).toBeTruthy();
  expect(
    screen.getByText("Duration must be a positive whole number or left blank."),
  ).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();

  await user.clear(screen.getByLabelText("Activity date"));
  await user.press(screen.getByRole("button", { name: "Add activity" }));
  expect(screen.getByText("Date is required.")).toBeTruthy();

  await user.type(screen.getByLabelText("Activity date"), "not-a-date");
  await user.clear(screen.getByLabelText("Activity start time"));
  await user.press(screen.getByRole("button", { name: "Add activity" }));
  expect(screen.getByText("Enter a valid date in YYYY-MM-DD format.")).toBeTruthy();
  expect(screen.getByText("Start time is required.")).toBeTruthy();
});

it("requires explicit confirmation before deleting an edited activity", async () => {
  const onDelete = jest.fn();
  const screen = await render(
    <ActivityEditorSheet
      {...baseProps}
      mode="edit"
      onDelete={onDelete}
    />,
  );
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Delete activity" }));
  expect(screen.getByText("Delete this activity?")).toBeTruthy();
  expect(onDelete).not.toHaveBeenCalled();

  await user.press(screen.getByRole("button", { name: "Keep activity" }));
  expect(screen.queryByText("Delete this activity?")).toBeNull();
  expect(onDelete).not.toHaveBeenCalled();

  await user.press(screen.getByRole("button", { name: "Delete activity" }));
  await user.press(screen.getByRole("button", { name: "Confirm delete" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it("surfaces retryable errors and locks controls while a mutation is pending", async () => {
  const screen = await render(
    <ActivityEditorSheet
      {...baseProps}
      error="Could not save. Try again."
      isSaving
    />,
  );

  expect(screen.getByRole("alert", { name: "Could not save. Try again." })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("radio", { name: "Strength" })).toBeDisabled();
});

it("delegates dismissal from both close actions", async () => {
  const onDismiss = jest.fn();
  const screen = await render(<ActivityEditorSheet {...baseProps} onDismiss={onDismiss} />);
  const user = userEvent.setup();

  await user.press(screen.getByRole("button", { name: "Close activity editor" }));
  await user.press(screen.getByRole("button", { name: "Cancel" }));

  expect(onDismiss).toHaveBeenCalledTimes(2);
});
