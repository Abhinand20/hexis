import { buildRepeatCycleDraft } from "../../src/features/cycles/domain/repeatCycleDraft";
import type {
  CycleGoal,
  GoalRevision,
} from "../../src/features/cycles/domain/types";
import { createCycle, createCycleGoal } from "../../src/test/factories";

const sourceCycle = createCycle({
  id: "cycle-ended",
  name: "Summer reset",
  startDate: "2026-07-01",
  endDate: "2026-07-30",
  status: "completed",
});

function goal(overrides: Partial<CycleGoal> = {}): CycleGoal {
  return createCycleGoal({
    id: "goal-strength",
    cycleId: sourceCycle.id,
    name: "Strength",
    cadence: "weekly",
    weeklyTargetCount: 3,
    expectedDurationMinutes: 60,
    activeFromDate: sourceCycle.startDate,
    inactiveFromDate: null,
    createdAt: "2026-07-01T08:00:00.000Z",
    ...overrides,
  });
}

function revision(overrides: Partial<GoalRevision> = {}): GoalRevision {
  return {
    id: "revision-strength",
    cycleGoalId: "goal-strength",
    effectiveDate: "2026-07-15",
    name: "Strength training",
    cadence: "weekly",
    weeklyTargetCount: 4,
    expectedDurationMinutes: 45,
    ...overrides,
  };
}

describe("buildRepeatCycleDraft", () => {
  it("prefills only setup fields using the final effective revision", () => {
    const result = buildRepeatCycleDraft(
      sourceCycle,
      [goal()],
      [
        revision(),
        revision({
          id: "revision-final",
          effectiveDate: sourceCycle.endDate,
          name: "Final strength plan",
          cadence: "daily",
          weeklyTargetCount: 6,
          expectedDurationMinutes: 25,
        }),
        revision({
          id: "revision-after-end",
          effectiveDate: "2026-07-31",
          name: "Future plan",
        }),
      ],
    );

    expect(result).toEqual({
      ok: true,
      draft: {
        cycleName: "Summer reset",
        durationDays: 30,
        practices: [
          {
            name: "Final strength plan",
            cadence: "daily",
            weeklyTargetCount: 6,
            expectedDurationMinutes: 25,
          },
        ],
      },
    });
    expect(result.ok && Object.keys(result.draft).sort()).toEqual([
      "cycleName",
      "durationDays",
      "practices",
    ]);
    expect(
      result.ok && Object.keys(result.draft.practices[0]).sort(),
    ).toEqual([
      "cadence",
      "expectedDurationMinutes",
      "name",
      "weeklyTargetCount",
    ]);
  });

  it("includes goals added before the last date and excludes stopped goals", () => {
    const stopped = goal({
      id: "goal-stopped",
      inactiveFromDate: "2026-07-20",
    });
    const added = goal({
      id: "goal-added",
      name: "Swim",
      activeFromDate: "2026-07-20",
      createdAt: "2026-07-20T08:00:00.000Z",
    });
    const stoppedOnLastDate = goal({
      id: "goal-stopped-on-end",
      inactiveFromDate: sourceCycle.endDate,
    });

    const result = buildRepeatCycleDraft(
      sourceCycle,
      [stopped, added, stoppedOnLastDate],
      [],
    );

    expect(result.ok && result.draft.practices).toEqual([
      {
        name: "Swim",
        cadence: "weekly",
        weeklyTargetCount: 3,
        expectedDurationMinutes: 60,
      },
    ]);
  });

  it("uses an early-ended cycle's shortened end date as the final date", () => {
    const earlyCycle = {
      ...sourceCycle,
      endDate: "2026-07-18",
      status: "ended_early" as const,
    };
    const result = buildRepeatCycleDraft(
      earlyCycle,
      [goal()],
      [
        revision({ effectiveDate: "2026-07-15", name: "At early end" }),
        revision({ effectiveDate: "2026-07-20", name: "After early end" }),
      ],
    );

    expect(result.ok && result.draft.practices[0].name).toBe("At early end");
  });

  it("orders final practices by their original creation order and then ID", () => {
    const result = buildRepeatCycleDraft(
      sourceCycle,
      [
        goal({ id: "goal-z", name: "Third", createdAt: "2026-07-03" }),
        goal({ id: "goal-b", name: "Second", createdAt: "2026-07-02" }),
        goal({ id: "goal-a", name: "First", createdAt: "2026-07-02" }),
      ],
      [],
    );

    expect(
      result.ok && result.draft.practices.map((practice) => practice.name),
    ).toEqual(["First", "Second", "Third"]);
  });

  it("returns explicit failures for empty, active, or invalid sources", () => {
    expect(buildRepeatCycleDraft(sourceCycle, [], [])).toEqual({
      ok: false,
      reason: "no-final-practices",
    });
    expect(
      buildRepeatCycleDraft({ ...sourceCycle, status: "active" }, [goal()], []),
    ).toEqual({
      ok: false,
      reason: "source-cycle-not-ended",
    });
    expect(
      buildRepeatCycleDraft(
        { ...sourceCycle, name: "", endDate: "2026-02-31" },
        [goal()],
        [],
      ),
    ).toEqual({ ok: false, reason: "invalid-source" });
    expect(
      buildRepeatCycleDraft(
        sourceCycle,
        [goal()],
        [revision({ name: "", weeklyTargetCount: 0 })],
      ),
    ).toEqual({ ok: false, reason: "invalid-source" });
    expect(
      buildRepeatCycleDraft(
        sourceCycle,
        [goal({ activeFromDate: "2026-06-30" })],
        [],
      ),
    ).toEqual({ ok: false, reason: "invalid-source" });
  });

  it("returns fresh drafts and never mutates source objects", () => {
    const sourceGoal = goal();
    const sourceRevision = revision();
    const first = buildRepeatCycleDraft(
      sourceCycle,
      [sourceGoal],
      [sourceRevision],
    );
    const second = buildRepeatCycleDraft(
      sourceCycle,
      [sourceGoal],
      [sourceRevision],
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("Expected repeat drafts");
    }

    expect(first.draft).not.toBe(second.draft);
    expect(first.draft.practices).not.toBe(second.draft.practices);
    expect(first.draft.practices[0]).not.toBe(second.draft.practices[0]);
    first.draft.practices[0].name = "Changed draft only";

    expect(sourceGoal.name).toBe("Strength");
    expect(sourceRevision.name).toBe("Strength training");
    expect(second.draft.practices[0].name).toBe("Strength training");
  });
});
