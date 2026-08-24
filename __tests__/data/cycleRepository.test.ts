import type { SQLiteDatabase } from "expo-sqlite";
import { openDatabase } from "../../src/db/client";
import {
  createCycleRepository,
  type CycleRepository,
} from "../../src/features/cycles/data/cycleRepository";
import { addLocalDays } from "../../src/features/cycles/domain/date";
import {
  createGoalRepository,
  type GoalRepository,
} from "../../src/features/goals/data/goalRepository";
import {
  createSessionRepository,
  type SessionRepository,
} from "../../src/features/logging/data/sessionRepository";
import { createCycleInput } from "../../src/test/factories";

describe("cycle, goal, and session repositories", () => {
  let db: SQLiteDatabase;
  let cycleRepository: CycleRepository;
  let goalRepository: GoalRepository;
  let sessionRepository: SessionRepository;

  beforeEach(async () => {
    db = await openDatabase(":memory:");
    cycleRepository = createCycleRepository(db);
    goalRepository = createGoalRepository(db);
    sessionRepository = createSessionRepository(db);
  });

  it("rejects a revision effectiveDate before the cycle startDate", async () => {
    const cycle = await cycleRepository.createCycle(createCycleInput());
    const [goal] = await goalRepository.listForCycle(cycle.id);

    await expect(
      goalRepository.createRevision({
        cycleGoalId: goal.id,
        effectiveDate: "2026-06-30",
        name: "Write less",
        cadence: "daily",
        weeklyTargetCount: 3,
        expectedDurationMinutes: 20,
      }),
    ).rejects.toThrow(/effective date must fall within the cycle/i);
  });

  it("rejects a revision effectiveDate after the cycle endDate", async () => {
    const cycle = await cycleRepository.createCycle(createCycleInput());
    const [goal] = await goalRepository.listForCycle(cycle.id);

    await expect(
      goalRepository.createRevision({
        cycleGoalId: goal.id,
        effectiveDate: "2026-07-31",
        name: "Write more",
        cadence: "daily",
        weeklyTargetCount: 6,
        expectedDurationMinutes: 40,
      }),
    ).rejects.toThrow(/effective date must fall within the cycle/i);
  });

  it("creates a revision for a valid in-range date and lists it", async () => {
    const cycle = await cycleRepository.createCycle(createCycleInput());
    const [goal] = await goalRepository.listForCycle(cycle.id);

    const revision = await goalRepository.createRevision({
      cycleGoalId: goal.id,
      effectiveDate: "2026-07-15",
      name: "Write mornings",
      cadence: "daily",
      weeklyTargetCount: 4,
      expectedDurationMinutes: 25,
    });

    expect(revision).toMatchObject({
      cycleGoalId: goal.id,
      effectiveDate: "2026-07-15",
      name: "Write mornings",
      cadence: "daily",
      weeklyTargetCount: 4,
      expectedDurationMinutes: 25,
    });

    expect(await goalRepository.listRevisions(goal.id)).toEqual([revision]);
  });

  it("persists session logs and filters listForCycle by cycle", async () => {
    const firstCycle = await cycleRepository.createCycle(createCycleInput());
    const [firstGoal] = await goalRepository.listForCycle(firstCycle.id);
    const firstLog = await sessionRepository.create({
      cycleGoalId: firstGoal.id,
      localDate: "2026-07-02",
      durationMinutes: 30,
    });

    await cycleRepository.endCycleEarly(firstCycle.id, "2026-07-10");

    const secondCycle = await cycleRepository.createCycle(
      createCycleInput({
        name: "Fall Focus",
        startDate: "2026-08-01",
      }),
    );
    const [secondGoal] = await goalRepository.listForCycle(secondCycle.id);
    const secondLog = await sessionRepository.create({
      cycleGoalId: secondGoal.id,
      localDate: "2026-08-02",
      durationMinutes: 15,
    });

    expect(await sessionRepository.listForCycle(firstCycle.id)).toEqual([
      firstLog,
    ]);
    expect(await sessionRepository.listForCycle(secondCycle.id)).toEqual([
      secondLog,
    ]);
  });

  it("removes a session by id for a mistaken log", async () => {
    const cycle = await cycleRepository.createCycle(createCycleInput());
    const [goal] = await goalRepository.listForCycle(cycle.id);
    const log = await sessionRepository.create({
      cycleGoalId: goal.id,
      localDate: "2026-07-02",
      durationMinutes: 30,
    });

    await sessionRepository.deleteById(log.id);

    expect(await sessionRepository.listForCycle(cycle.id)).toEqual([]);
  });

  it("ends a cycle early and shortens endDate when localDate is earlier", async () => {
    const cycle = await cycleRepository.createCycle(createCycleInput());
    expect(cycle.endDate).toBe("2026-07-30");

    await cycleRepository.endCycleEarly(cycle.id, "2026-07-10");

    expect(await cycleRepository.getActiveCycle()).toBeNull();

    const row = await db.getFirstAsync<{ status: string; end_date: string }>(
      "SELECT status, end_date FROM cycles WHERE id = ?",
      [cycle.id],
    );
    expect(row).toEqual({ status: "ended_early", end_date: "2026-07-10" });
  });

  it("transitions an active cycle to completed once its end date has passed, and allows a new cycle afterward", async () => {
    const cycle = await cycleRepository.createCycle(
      createCycleInput({ startDate: "2026-06-01", durationDays: 30 }),
    );
    const dayAfterEnd = addLocalDays(cycle.endDate, 1);

    expect(await cycleRepository.getActiveCycle(dayAfterEnd)).toBeNull();
    expect(await cycleRepository.getMostRecentCycle()).toMatchObject({
      id: cycle.id,
      status: "completed",
    });

    await expect(
      cycleRepository.createCycle(
        createCycleInput({ name: "Next", startDate: dayAfterEnd }),
      ),
    ).resolves.toMatchObject({ name: "Next", status: "active" });
  });

  it("gets a cycle by id without changing its stored status", async () => {
    const cycle = await cycleRepository.createCycle(
      createCycleInput({ startDate: "2025-01-01", durationDays: 30 }),
    );

    await expect(cycleRepository.getCycleById(cycle.id)).resolves.toEqual(cycle);
    await expect(cycleRepository.getCycleById("missing-cycle")).resolves.toBeNull();

    const stored = await db.getFirstAsync<{ status: string }>(
      "SELECT status FROM cycles WHERE id = ?",
      [cycle.id],
    );
    expect(stored).toEqual({ status: "active" });
  });

  it("lists every cycle with active first and deterministic recency ordering without completing cycles", async () => {
    const rows = [
      [
        "ended-recent",
        "Ended recent",
        "2026-08-01",
        30,
        "2026-08-30",
        "ended_early",
        "2026-08-02T00:00:00.000Z",
      ],
      [
        "completed-created-first",
        "Completed created first",
        "2026-07-01",
        30,
        "2026-07-30",
        "completed",
        "2026-07-02T00:00:00.000Z",
      ],
      [
        "completed-tie-a",
        "Completed tie A",
        "2026-07-01",
        30,
        "2026-07-30",
        "completed",
        "2026-07-03T00:00:00.000Z",
      ],
      [
        "completed-tie-b",
        "Completed tie B",
        "2026-07-01",
        30,
        "2026-07-30",
        "completed",
        "2026-07-03T00:00:00.000Z",
      ],
      [
        "active-old",
        "Active old",
        "2025-01-01",
        30,
        "2025-01-30",
        "active",
        "2025-01-01T00:00:00.000Z",
      ],
    ] as const;

    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO cycles (
          id, name, start_date, duration_days, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [...row],
      );
    }

    const cycles = await cycleRepository.listCycles();

    expect(cycles.map((cycle) => cycle.id)).toEqual([
      "active-old",
      "ended-recent",
      "completed-tie-b",
      "completed-tie-a",
      "completed-created-first",
    ]);
    expect(cycles.map((cycle) => cycle.status)).toEqual([
      "active",
      "ended_early",
      "completed",
      "completed",
      "completed",
    ]);

    const storedActive = await db.getFirstAsync<{ status: string }>(
      "SELECT status FROM cycles WHERE id = ?",
      ["active-old"],
    );
    expect(storedActive).toEqual({ status: "active" });
  });
});
