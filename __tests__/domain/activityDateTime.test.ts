import {
  activityInstantFromLocalFields,
  currentLocalClockTime,
  localClockTimeForInstant,
} from "../../src/features/logging/domain/activityDateTime";

it("round-trips ordinary local calendar fields through an ISO instant", () => {
  const instant = activityInstantFromLocalFields("2026-08-20", "17:45");

  expect(localClockTimeForInstant(instant)).toBe("17:45");
  expect(new Date(instant).getFullYear()).toBe(2026);
  expect(new Date(instant).getMonth()).toBe(7);
  expect(new Date(instant).getDate()).toBe(20);
});

it("rejects normalized dates and nonexistent daylight-saving times", () => {
  expect(() => activityInstantFromLocalFields("2026-02-30", "09:00")).toThrow(
    /does not exist/i,
  );

  if (Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Los_Angeles") {
    expect(() => activityInstantFromLocalFields("2026-03-08", "02:30")).toThrow(
      /does not exist/i,
    );
  }
});

it("formats the current local clock as zero-padded 24-hour time", () => {
  expect(currentLocalClockTime(new Date(2026, 7, 20, 7, 5))).toBe("07:05");
});
