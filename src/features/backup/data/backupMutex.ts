let tail: Promise<void> = Promise.resolve();

export async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function resetBackupMutexForTests(): void {
  tail = Promise.resolve();
}
