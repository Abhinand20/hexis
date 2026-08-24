import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { createCycleInput } from "../../src/test/factories";

describe("dated goal membership repository", () => {
  let db: SQLiteDatabase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function setup() {
    db = await openDatabase(":memory:");
    const cycle = await createCycleRepository(db).createCycle(
      createCycleInput({ startDate: "2026-07-01" }),
    );
    const repository = createGoalRepository(db);
    return { cycle, repository };
  }

  it("stores initial goals from cycle start and lists all goals deterministically", async () => {
    const { cycle, repository } = await setup();

    const first = await repository.listForCycle(cycle.id);
    const second = await repository.listForCycle(cycle.id);

    expect(first).toHaveLength(4);
    expect(first.every((goal) => goal.activeFromDate === cycle.startDate)).toBe(
      true,
    );
    expect(first.every((goal) => goal.inactiveFromDate === null)).toBe(true);
    expect(second.map((goal) => goal.id)).toEqual(first.map((goal) => goal.id));
  });

  it("adds a validated practice today and exposes it only from today", async () => {
    const { cycle, repository } = await setup();

    const added = await repository.createForActiveCycle(
      {
        cycleId: cycle.id,
        name: "Mobility",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 15,
      },
      "2026-07-15",
    );

    expect(added).toMatchObject({
      activeFromDate: "2026-07-15",
      inactiveFromDate: null,
    });
    expect(
      (await repository.listActiveForCycle(cycle.id, "2026-07-14")).map(
        (goal) => goal.id,
      ),
    ).not.toContain(added.id);
    expect(
      (await repository.listActiveForCycle(cycle.id, "2026-07-15")).map(
        (goal) => goal.id,
      ),
    ).toContain(added.id);
  });

  it("rejects backdated, future-dated, and invalid add inputs", async () => {
    const { cycle, repository } = await setup();
    const valid = {
      cycleId: cycle.id,
      name: "Mobility",
      cadence: "daily" as const,
      weeklyTargetCount: 5,
      expectedDurationMinutes: 15,
    };

    await expect(
      repository.createForActiveCycle(valid, "2026-07-14"),
    ).rejects.toThrow(/today/i);
    await expect(
      repository.createForActiveCycle(valid, "2026-07-16"),
    ).rejects.toThrow(/today/i);
    await expect(
      repository.createForActiveCycle({ ...valid, name: "  " }, "2026-07-15"),
    ).rejects.toThrow(/name/i);
    await expect(
      repository.createForActiveCycle(
        { ...valid, weeklyTargetCount: 0 },
        "2026-07-15",
      ),
    ).rejects.toThrow(/weeklyTargetCount/i);
    await expect(
      repository.createForActiveCycle(
        { ...valid, expectedDurationMinutes: -1 },
        "2026-07-15",
      ),
    ).rejects.toThrow(/expectedDurationMinutes/i);
  });

  it("stops today without deleting history and protects the final active goal", async () => {
    const { cycle, repository } = await setup();
    const goals = await repository.listForCycle(cycle.id);

    const stopped = await repository.stopTracking(goals[0].id, "2026-07-15");
    expect(stopped.inactiveFromDate).toBe("2026-07-15");
    expect(
      (await repository.listActiveForCycle(cycle.id, "2026-07-14")).map(
        (goal) => goal.id,
      ),
    ).toContain(stopped.id);
    expect(
      (await repository.listActiveForCycle(cycle.id, "2026-07-15")).map(
        (goal) => goal.id,
      ),
    ).not.toContain(stopped.id);
    expect((await repository.listForCycle(cycle.id)).map((goal) => goal.id)).toContain(
      stopped.id,
    );

    await repository.stopTracking(goals[1].id, "2026-07-15");
    await repository.stopTracking(goals[2].id, "2026-07-15");
    await expect(
      repository.stopTracking(goals[3].id, "2026-07-15"),
    ).rejects.toThrow(/at least one practice/i);
  });

  it("rejects stopping on the join date or on a date other than today", async () => {
    const { cycle, repository } = await setup();
    const added = await repository.createForActiveCycle(
      {
        cycleId: cycle.id,
        name: "Mobility",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: null,
      },
      "2026-07-15",
    );

    await expect(
      repository.stopTracking(added.id, "2026-07-15"),
    ).rejects.toThrow(/not active/i);
    await expect(
      repository.stopTracking((await repository.listForCycle(cycle.id))[0].id, "2026-07-14"),
    ).rejects.toThrow(/today/i);
  });

  it("keeps goal revisions inside the membership window", async () => {
    const { cycle, repository } = await setup();
    const [goal] = await repository.listForCycle(cycle.id);
    await repository.stopTracking(goal.id, "2026-07-15");

    await expect(
      repository.createRevision({
        cycleGoalId: goal.id,
        effectiveDate: "2026-07-14",
        name: "Write mornings",
        cadence: "daily",
        weeklyTargetCount: 4,
        expectedDurationMinutes: 25,
      }),
    ).resolves.toMatchObject({ effectiveDate: "2026-07-14" });
    await expect(
      repository.createRevision({
        cycleGoalId: goal.id,
        effectiveDate: "2026-07-15",
        name: "Write evenings",
        cadence: "daily",
        weeklyTargetCount: 4,
        expectedDurationMinutes: 25,
      }),
    ).rejects.toThrow(/membership/i);
  });
});
