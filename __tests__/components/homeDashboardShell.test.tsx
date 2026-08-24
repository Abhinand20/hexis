import { render } from "@testing-library/react-native";

import { RecentRhythm } from "../../src/features/cycles/components/RecentRhythm";
import { WeekAtGlanceCard } from "../../src/features/cycles/components/WeekAtGlanceCard";

const rhythmDays = [
  { localDate: "2026-08-17", sessionCount: 0 },
  { localDate: "2026-08-18", sessionCount: 1 },
  { localDate: "2026-08-19", sessionCount: 2 },
  { localDate: "2026-08-20", sessionCount: 0 },
  { localDate: "2026-08-21", sessionCount: 3 },
  { localDate: "2026-08-22", sessionCount: 1 },
  { localDate: "2026-08-23", sessionCount: 0 },
];

it("shows weekly session, minute, remaining, and calendar-day totals", async () => {
  const screen = await render(
    <WeekAtGlanceCard
      daysRemaining={3}
      hasPartialMembership={false}
      minutes={{ logged: 90, target: 150, remaining: 60, progressRatio: 0.6 }}
      sessions={{ logged: 3, target: 5, remaining: 2, progressRatio: 0.6 }}
    />,
  );

  expect(screen.getByRole("header", { name: "This week" })).toBeTruthy();
  expect(screen.getByLabelText("3 calendar days left")).toBeTruthy();
  expect(
    screen.getByLabelText("3 sessions logged of 5 sessions. 2 sessions remaining."),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("90 minutes logged of 150 minutes. 60 minutes remaining."),
  ).toBeTruthy();
});

it("keeps over-target raw totals while capping visual progress", async () => {
  const screen = await render(
    <WeekAtGlanceCard
      daysRemaining={1}
      hasPartialMembership={false}
      minutes={{ logged: 210, target: 150, remaining: 0, progressRatio: 1.4 }}
      sessions={{ logged: 7, target: 5, remaining: 0, progressRatio: 1.4 }}
    />,
  );

  expect(
    screen.getByLabelText("7 sessions logged of 5 sessions. 0 sessions remaining."),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("210 minutes logged of 150 minutes. 0 minutes remaining."),
  ).toBeTruthy();
  expect(
    screen.getByLabelText("100% of weekly session target").props.accessibilityValue,
  ).toEqual({ min: 0, max: 100, now: 100 });
  expect(
    screen.getByLabelText("100% of weekly minute target").props.accessibilityValue,
  ).toEqual({ min: 0, max: 100, now: 100 });
});

it("communicates an empty partial week without inventing eligible targets", async () => {
  const screen = await render(
    <WeekAtGlanceCard
      daysRemaining={5}
      hasPartialMembership
      minutes={null}
      sessions={{ logged: 0, target: null, remaining: null, progressRatio: null }}
    />,
  );

  expect(
    screen.getByLabelText(
      "0 sessions logged. No eligible weekly session target.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByLabelText(
      "Partial week. New or stopped practices show their work, but do not add a target until a complete eligible week.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it("renders seven dated buckets with counts that do not rely on color", async () => {
  const screen = await render(
    <RecentRhythm days={rhythmDays} previousWeekSessionDelta={2} />,
  );

  expect(screen.getByRole("header", { name: "Recent rhythm" })).toBeTruthy();
  expect(screen.getByText("Last 7 days")).toBeTruthy();
  expect(screen.getByLabelText("Mon, Aug 17, 2026. 0 sessions.")).toBeTruthy();
  expect(screen.getByLabelText("Tue, Aug 18, 2026. 1 session.")).toBeTruthy();
  expect(screen.getByLabelText("Fri, Aug 21, 2026. 3 sessions.")).toBeTruthy();
  expect(screen.getAllByLabelText(/2026\. \d+ sessions?\./)).toHaveLength(7);
  expect(screen.getByText("Previous week · +2 sessions")).toBeTruthy();
});

it("describes a zero week comparison neutrally", async () => {
  const screen = await render(
    <RecentRhythm days={rhythmDays} previousWeekSessionDelta={0} />,
  );
  expect(screen.getByText("Previous week · no change")).toBeTruthy();
});

it("describes an unavailable week comparison neutrally", async () => {
  const screen = await render(
    <RecentRhythm days={rhythmDays} previousWeekSessionDelta={null} />,
  );
  expect(
    screen.getByText("Previous week · comparison unavailable"),
  ).toBeTruthy();
});
