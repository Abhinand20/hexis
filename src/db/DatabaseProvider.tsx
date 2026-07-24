import type { SQLiteDatabase } from "expo-sqlite";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { openDatabase } from "./client";

type DatabaseContextValue = {
  db: SQLiteDatabase | null;
  isLoading: boolean;
  error: Error | null;
};

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  error: null,
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatabaseContextValue>({
    db: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    openDatabase()
      .then((db) => {
        if (!cancelled) {
          setState({ db, isLoading: false, error: null });
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setState({ db: null, isLoading: false, error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={state}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
