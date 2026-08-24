import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabase } from "../../src/db/client";
import { createCycleRepository } from "../../src/features/cycles/data/cycleRepository";
import { createGoalRepository } from "../../src/features/goals/data/goalRepository";
import { createSessionRepository } from "../../src/features/logging/data/sessionRepository";
import { createCycleInput } from "../../src/test/factories";

describe("session repository timestamps", () => {
  let db: SQLiteDatabase;
  let goalId: string;

  beforeEach(async () => {
    db = await openDatabase(":memory:");
    const cycle = await createCycleRepository(db).createCycle(createCycleInput());
    const [goal] = await createGoalRepository(db).listForCycle(cycle.id);
    goalId = goal.id;
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
});
