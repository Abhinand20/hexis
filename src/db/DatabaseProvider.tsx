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
import { DatabaseStartupError } from "../features/backup/components/DatabaseStartupError";

type DatabaseContextValue = {
  db: SQLiteDatabase | null;
  isLoading: boolean;
  error: Error | null;
  /** Increments when the underlying dataset is replaced wholesale. */
  dataVersion: number;
  /** Marks every reader stale after a restore. */
  reloadAll: () => void;
  /** True while an exclusive backup or restore holds the database. */
  isBusy: boolean;
  setBusy: (busy: boolean) => void;
  /** Adopt a connection opened during unreadable-database recovery. */
  acceptDatabase: (db: SQLiteDatabase) => void;
  retryOpen: () => Promise<void>;
  /** Dev-only: wipes all persisted data and reopens a fresh database. */
  resetDatabase: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  error: null,
  dataVersion: 0,
  reloadAll: () => {},
  isBusy: false,
  setBusy: () => {},
  acceptDatabase: () => {},
  retryOpen: async () => {},
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
  const [dataVersion, setDataVersion] = useState(0);
  const [isBusy, setBusy] = useState(false);
  const dbRef = useRef<SQLiteDatabase | null>(null);

  const connect = useCallback(async () => {
    setState({ db: null, isLoading: true, error: null });
    try {
      const db = await openDatabase();
      dbRef.current = db;
      setState({ db, isLoading: false, error: null });
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error(String(error));
      dbRef.current = null;
      setState({ db: null, isLoading: false, error: nextError });
    }
  }, []);

  useEffect(() => {
    void connect();
  }, [connect]);

  const reloadAll = useCallback(() => {
    setDataVersion((value) => value + 1);
  }, []);

  const acceptDatabase = useCallback((db: SQLiteDatabase) => {
    dbRef.current = db;
    setState({ db, isLoading: false, error: null });
    setDataVersion((value) => value + 1);
  }, []);

  const resetDatabase = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const nextDb = dbRef.current
        ? await resetDatabaseFile(dbRef.current)
        : await openDatabase();
      dbRef.current = nextDb;
      setState({ db: nextDb, isLoading: false, error: null });
      setDataVersion((value) => value + 1);
    } catch (error) {
      const nextError =
        error instanceof Error ? error : new Error(String(error));
      setState({ db: null, isLoading: false, error: nextError });
      throw nextError;
    }
  }, []);

  const value: DatabaseContextValue = {
    ...state,
    dataVersion,
    reloadAll,
    isBusy,
    setBusy,
    acceptDatabase,
    retryOpen: connect,
    resetDatabase,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {state.error && !state.isLoading ? (
        <DatabaseStartupError message={state.error.message} />
      ) : (
        children
      )}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
