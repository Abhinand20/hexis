import { useEffect, useState } from "react";

import { useDatabase } from "../../../db/DatabaseProvider";
import {
  addLocalDays,
  monthKey,
  monthStart,
  todayLocalDate,
  weekStart,
} from "../../cycles/domain/date";
import { createWeightRepository } from "../data/weightRepository";
import {
  buildMonthlyPeriods,
  buildWeeklyPeriods,
  compareWithPrevious,
  type WeightPeriodComparison,
} from "../domain/weightAverages";

export type WeightAveragesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      week: WeightPeriodComparison;
      month: WeightPeriodComparison;
    };

function averagesRangeStart(today: string): string {
  const previousWeekStart = addLocalDays(weekStart(today), -7);
  const previousMonthStart = monthStart(addLocalDays(monthStart(today), -1));
  return previousWeekStart < previousMonthStart
    ? previousWeekStart
    : previousMonthStart;
}

export function useWeightAverages(
  reloadToken = 0,
  today: string = todayLocalDate(),
): WeightAveragesState {
  const { db, dataVersion = 0 } = useDatabase();
  const [state, setState] = useState<WeightAveragesState>({ status: "loading" });

  useEffect(() => {
    if (!db) {
      return;
    }

    let cancelled = false;
    const database = db;

    async function load() {
      try {
        const entries = await createWeightRepository(database).listRange(
          averagesRangeStart(today),
          today,
        );
        const weeks = buildWeeklyPeriods(entries, today);
        const months = buildMonthlyPeriods(entries, today);
        if (!cancelled) {
          setState({
            status: "ready",
            week: compareWithPrevious(weeks, weekStart(today)),
            month: compareWithPrevious(months, monthKey(today)),
          });
        }
      } catch (reason) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              reason instanceof Error
                ? reason.message
                : "Something went wrong. Try again.",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, today, reloadToken, dataVersion]);

  return state;
}
