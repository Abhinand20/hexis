import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { createSessionRepository } from "../../src/features/logging/data/sessionRepository";
import { createCycleInput } from "../../src/test/factories";

describe("session repository timestamps and corrections", () => {
  let db: SQLiteDatabase;
  let cycleId: string;
  let goalId: string;
  let secondGoalId: string;

  beforeEach(async () => {
    db = await openDatabase(":memory:");
    const cycle = await createCycleRepository(db).createCycle(createCycleInput());
    cycleId = cycle.id;
    const [goal, secondGoal] = await createGoalRepository(db).listForCycle(
      cycle.id,
    );
    goalId = goal.id;
    secondGoalId = secondGoal.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses one current instant for a live session's timestamp and local date", async () => {
    const localStart = new Date(2026, 6, 24, 23, 59, 59, 999);
    jest.useFakeTimers().setSystemTime(localStart);

    const session = await createSessionRepository(db).create({
      cycleGoalId: goalId,
      durationMinutes: 30,
    });

    expect(session).toMatchObject({
      cycleGoalId: goalId,
      localDate: "2026-07-24",
      startedAt: localStart.toISOString(),
      createdAt: localStart.toISOString(),
      durationMinutes: 30,
    });
    expect(
      await db.getFirstAsync(
        `SELECT local_date, started_at, created_at
         FROM session_logs WHERE id = ?`,
        [session.id],
      ),
    ).toEqual({
      local_date: "2026-07-24",
      started_at: localStart.toISOString(),
      created_at: localStart.toISOString(),
    });
  });

  it("derives the local date from an explicit historical start timestamp", async () => {
    const localStart = new Date(2026, 6, 2, 8, 15);
    const startedAt = localStart.toISOString();

    const session = await createSessionRepository(db).create({
      cycleGoalId: goalId,
      startedAt,
      durationMinutes: null,
    });

    expect(session.startedAt).toBe(startedAt);
    expect(session.localDate).toBe("2026-07-02");
  });

  it("rejects an invalid explicit start timestamp before writing", async () => {
    await expect(
      createSessionRepository(db).create({
        cycleGoalId: goalId,
        startedAt: "not-an-instant",
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/valid ISO timestamp/i);

    expect(await db.getFirstAsync("SELECT id FROM session_logs")).toBeNull();
  });

  it("resolves complete revisions while keeping the immutable source id", async () => {
    const repository = createSessionRepository(db);
    const source = await repository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 2, 8, 15).toISOString(),
      durationMinutes: 30,
    });
    const correctedStart = new Date(2026, 6, 5, 0, 15);

    const corrected = await repository.correct(source.id, {
      cycleGoalId: secondGoalId,
      startedAt: correctedStart.toISOString(),
      durationMinutes: null,
    });

    expect(corrected).toEqual({
      ...source,
      cycleGoalId: secondGoalId,
      localDate: "2026-07-05",
      startedAt: correctedStart.toISOString(),
      durationMinutes: null,
    });
    expect(await repository.listForCycle(cycleId)).toEqual([corrected]);
    expect(await repository.listForDay(cycleId, "2026-07-02")).toEqual([]);
    expect(await repository.listForDay(cycleId, "2026-07-05")).toEqual([
      corrected,
    ]);
    expect(
      await db.getFirstAsync(
        `SELECT cycle_goal_id, local_date, started_at, duration_minutes
         FROM session_logs WHERE id = ?`,
        [source.id],
      ),
    ).toEqual({
      cycle_goal_id: goalId,
      local_date: source.localDate,
      started_at: source.startedAt,
      duration_minutes: 30,
    });
  });

  it("selects the highest correction sequence after repository recreation", async () => {
    const repository = createSessionRepository(db);
    const source = await repository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 2, 8).toISOString(),
      durationMinutes: 30,
    });
    await repository.correct(source.id, {
      cycleGoalId: secondGoalId,
      startedAt: new Date(2026, 6, 3, 9).toISOString(),
      durationMinutes: 20,
    });
    const latest = await repository.correct(source.id, {
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 4, 10).toISOString(),
      durationMinutes: 45,
    });

    expect(await createSessionRepository(db).listForCycle(cycleId)).toEqual([
      latest,
    ]);
    const audit = await repository.getAuditHistory(source.id);
    expect(audit?.original).toEqual(source);
    expect(audit?.revisions).toEqual([
      expect.objectContaining({
        sequence: 1,
        sourceSessionId: source.id,
        cycleGoalId: secondGoalId,
        localDate: "2026-07-03",
        durationMinutes: 20,
        tombstone: false,
      }),
      expect.objectContaining({
        sequence: 2,
        sourceSessionId: source.id,
        cycleGoalId: goalId,
        localDate: "2026-07-04",
        durationMinutes: 45,
        tombstone: false,
      }),
    ]);
  });

  it("deletes with an idempotent tombstone and rejects implicit resurrection", async () => {
    const repository = createSessionRepository(db);
    const source = await repository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 2, 8).toISOString(),
      durationMinutes: 30,
    });

    await repository.deleteById(source.id);
    await repository.deleteById(source.id);

    expect(await repository.listForCycle(cycleId)).toEqual([]);
    await expect(
      repository.correct(source.id, {
        cycleGoalId: goalId,
        startedAt: new Date(2026, 6, 3, 8).toISOString(),
        durationMinutes: 20,
      }),
    ).rejects.toThrow(/deleted session/i);
    expect((await repository.getAuditHistory(source.id))?.revisions).toEqual([
      expect.objectContaining({
        sequence: 1,
        sourceSessionId: source.id,
        tombstone: true,
        durationMinutes: 30,
      }),
    ]);
  });

  it("rejects corrections to a goal in another cycle", async () => {
    const cycleRepository = createCycleRepository(db);
    const repository = createSessionRepository(db);
    const source = await repository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 2, 8).toISOString(),
      durationMinutes: 30,
    });
    await cycleRepository.endCycleEarly(cycleId, "2026-07-10");
    const otherCycle = await cycleRepository.createCycle(
      createCycleInput({ name: "Next cycle", startDate: "2026-08-01" }),
    );
    const [otherGoal] = await createGoalRepository(db).listForCycle(
      otherCycle.id,
    );

    await expect(
      repository.correct(source.id, {
        cycleGoalId: otherGoal.id,
        startedAt: new Date(2026, 6, 3, 8).toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/source cycle/i);
    expect((await repository.getAuditHistory(source.id))?.revisions).toEqual(
      [],
    );
  });

  it("rejects correction timestamps outside the source cycle", async () => {
    const repository = createSessionRepository(db);
    const source = await repository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 2, 8).toISOString(),
      durationMinutes: 30,
    });

    await expect(
      repository.correct(source.id, {
        cycleGoalId: goalId,
        startedAt: new Date(2026, 5, 30, 23, 59).toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/within the source cycle/i);
    await expect(
      repository.correct(source.id, {
        cycleGoalId: goalId,
        startedAt: new Date(2026, 6, 31, 0, 1).toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/within the source cycle/i);
  });

  it("rejects future sessions even when their cycle has already started", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 23, 12));
    const cycleRepository = createCycleRepository(db);
    await cycleRepository.getActiveCycle("2026-08-23");
    const currentCycle = await cycleRepository.createCycle(
      createCycleInput({ name: "Current cycle", startDate: "2026-08-20" }),
    );
    const [currentGoal] = await createGoalRepository(db).listForCycle(
      currentCycle.id,
    );

    await expect(
      createSessionRepository(db).create({
        cycleGoalId: currentGoal.id,
        startedAt: new Date(2026, 7, 24, 8).toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/future/i);
  });

  it("rejects a missing source id and exposes no audit history for it", async () => {
    const repository = createSessionRepository(db);
    await expect(repository.deleteById("missing-log")).rejects.toThrow(
      /not found/i,
    );
    await expect(repository.getAuditHistory("missing-log")).resolves.toBeNull();
  });

  it("rejects new sessions outside a practice membership window", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15, 12));
    const goalRepository = createGoalRepository(db);
    const added = await goalRepository.createForActiveCycle(
      {
        cycleId,
        name: "Mobility",
        cadence: "daily",
        weeklyTargetCount: 5,
        expectedDurationMinutes: 15,
      },
      "2026-07-15",
    );

    await expect(
      createSessionRepository(db).create({
        cycleGoalId: added.id,
        startedAt: new Date(2026, 6, 14, 8).toISOString(),
        durationMinutes: 15,
      }),
    ).rejects.toThrow(/not active/i);
  });

  it("grandfathers same-day sessions after stop but rejects new or moved work", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15, 12));
    const sessionRepository = createSessionRepository(db);
    const goalRepository = createGoalRepository(db);
    const stoppedSource = await sessionRepository.create({
      cycleGoalId: goalId,
      startedAt: new Date(2026, 6, 15, 8).toISOString(),
      durationMinutes: 30,
    });
    const movableSource = await sessionRepository.create({
      cycleGoalId: secondGoalId,
      startedAt: new Date(2026, 6, 15, 9).toISOString(),
      durationMinutes: 20,
    });

    await goalRepository.stopTracking(goalId, "2026-07-15");

    expect(await sessionRepository.listForDay(cycleId, "2026-07-15")).toHaveLength(
      2,
    );
    await expect(
      sessionRepository.correct(stoppedSource.id, {
        cycleGoalId: goalId,
        startedAt: new Date(2026, 6, 15, 10).toISOString(),
        durationMinutes: 45,
      }),
    ).resolves.toMatchObject({
      id: stoppedSource.id,
      cycleGoalId: goalId,
      localDate: "2026-07-15",
      durationMinutes: 45,
    });
    await expect(
      sessionRepository.create({
        cycleGoalId: goalId,
        startedAt: new Date(2026, 6, 15, 11).toISOString(),
        durationMinutes: 30,
      }),
    ).rejects.toThrow(/not active/i);
    await expect(
      sessionRepository.correct(movableSource.id, {
        cycleGoalId: goalId,
        startedAt: new Date(2026, 6, 15, 11).toISOString(),
        durationMinutes: 20,
      }),
    ).rejects.toThrow(/not active/i);
  });
});
