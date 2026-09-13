import { useCallback, useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import { todayLocalDate } from "../../cycles/domain/date";
import { createWeightRepository } from "../data/weightRepository";
import type { WeightEntry, WeightUnit } from "../domain/types";
import { formatWeight } from "../domain/units";

const RECENT_LIMIT = 30;

export type WeightLogReady = {
  status: "ready";
  today: string;
  todayEntry: WeightEntry | null;
  recentEntries: WeightEntry[];
  unit: WeightUnit;
  hasAnyEntries: boolean;
};

export type WeightLogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | WeightLogReady;

export function useWeightLog(
  reloadToken = 0,
  today: string = todayLocalDate(),
) {
  const { db, dataVersion = 0 } = useDatabase();
  const [state, setState] = useState<WeightLogState>({ status: "loading" });
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db) {
      return;
    }

    const repository = createWeightRepository(db);
    const [todayEntry, recentEntries, unit] = await Promise.all([
      repository.getByDate(today),
      repository.listRecent(RECENT_LIMIT),
      repository.getUnit(),
    ]);
    return {
      status: "ready" as const,
      today,
      todayEntry,
      recentEntries,
      unit,
      hasAnyEntries: recentEntries.length > 0,
    };
  }, [db, today, reloadToken, dataVersion]);

  useEffect(() => {
    if (!db) {
      return;
    }

    let cancelled = false;
    void load()
      .then((next) => {
        if (!cancelled && next) {
          setState(next);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              reason instanceof Error
                ? reason.message
                : "Something went wrong. Try again.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [db, load]);

  const save = useCallback(
    async (localDate: string, weightGrams: number) => {
      if (!db) {
        throw new Error("Database is not available yet");
      }

      setActionError(null);
      const repository = createWeightRepository(db);
      const saved = await repository.save({ localDate, weightGrams });
      const unit = await repository.getUnit();
      setConfirmation(`Recorded ${formatWeight(saved.weightGrams, unit)}.`);
      const next = await load();
      if (next) {
        setState(next);
      }
    },
    [db, load],
  );

  const deleteByDate = useCallback(
    async (localDate: string) => {
      if (!db) {
        throw new Error("Database is not available yet");
      }

      setActionError(null);
      setConfirmation(null);
      await createWeightRepository(db).deleteByDate(localDate);
      const next = await load();
      if (next) {
        setState(next);
      }
    },
    [db, load],
  );

  const changeUnit = useCallback(
    async (unit: WeightUnit) => {
      if (!db) {
        throw new Error("Database is not available yet");
      }

      await createWeightRepository(db).setUnit(unit);
      setState((current) =>
        current.status === "ready" ? { ...current, unit } : current,
      );
    },
    [db],
  );

  const recordActionError = useCallback((reason: unknown) => {
    setConfirmation(null);
    setActionError(
      reason instanceof Error ? reason.message : "Could not save this weight.",
    );
  }, []);

  return {
    state,
    confirmation,
    actionError,
    save,
    deleteByDate,
    changeUnit,
    recordActionError,
  };
}
