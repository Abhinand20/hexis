import type { SQLiteDatabase } from "expo-sqlite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { openDatabase, resetDatabase as resetDatabaseFile } from "./client";

type DatabaseContextValue = {
  db: SQLiteDatabase | null;
  isLoading: boolean;
  error: Error | null;
  /** Dev-only: wipes all persisted data and reopens a fresh database. */
  resetDatabase: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  error: null,
  resetDatabase: async () => {},
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    db: SQLiteDatabase | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    db: null,
    isLoading: true,
    error: null,
  });
  const dbRef = useRef<SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;

    openDatabase()
      .then((db) => {
        if (!cancelled) {
          dbRef.current = db;
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

  const resetDatabase = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const nextDb = dbRef.current
        ? await resetDatabaseFile(dbRef.current)
        : await openDatabase();
      dbRef.current = nextDb;
      setState({ db: nextDb, isLoading: false, error: null });
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error(String(error));
      setState({ db: null, isLoading: false, error: nextError });
      throw nextError;
    }
  }, []);

  return (
    <DatabaseContext.Provider value={{ ...state, resetDatabase }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
