type NodeFs = {
  existsSync(path: string): boolean;
  unlinkSync(path: string): void;
  mkdirSync(path: string, options: { recursive: boolean }): void;
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array): void;
  statSync(path: string): { size: number };
  readdirSync(path: string): string[];
};

type NodeOs = {
  tmpdir(): string;
};

type NodeFsHelper = NodeFs & {
  tmpdir: string;
  unlinkIfPresent(path: string): void;
};

type ProcessWithBuiltins = {
  versions?: { node?: string };
  getBuiltinModule?: (id: string) => unknown;
};

/**
 * Node's `fs` exists in Jest, where `expo-sqlite-mock` writes real files via
 * `VACUUM INTO`. Native builds have no `process.versions.node`, so this returns
 * null on device. Prefer `process.getBuiltinModule` over `require('fs')` so
 * Metro does not treat `fs` as a production dependency, and so Jest can still
 * load it — `Function("return require")` does not see CommonJS `require`.
 */
export function tryNodeFs(): NodeFsHelper | null {
  const proc = (
    typeof process === "undefined" ? null : process
  ) as ProcessWithBuiltins | null;
  if (proc?.versions?.node == null) {
    return null;
  }

  try {
    const fs = proc.getBuiltinModule?.("fs") as NodeFs | undefined;
    const os = proc.getBuiltinModule?.("os") as NodeOs | undefined;
    if (!fs?.existsSync || !os?.tmpdir) {
      return null;
    }
    return wrap(fs, os);
  } catch {
    return null;
  }
}

function wrap(fs: NodeFs, os: NodeOs): NodeFsHelper {
  return {
    existsSync: (path) => fs.existsSync(path),
    unlinkSync: (path) => fs.unlinkSync(path),
    mkdirSync: (path, options) => fs.mkdirSync(path, options),
    readFileSync: (path) => fs.readFileSync(path),
    writeFileSync: (path, data) => fs.writeFileSync(path, data),
    statSync: (path) => fs.statSync(path),
    readdirSync: (path) => fs.readdirSync(path),
    tmpdir: os.tmpdir(),
    unlinkIfPresent(path: string) {
      for (const candidate of uniquePaths(path)) {
        try {
          if (fs.existsSync(candidate)) {
            fs.unlinkSync(candidate);
          }
        } catch {
          // Missing or already gone.
        }
      }
    },
  };
}

function uniquePaths(path: string): string[] {
  const paths = [path];
  if (path.startsWith("/var/")) {
    paths.push(`/private${path}`);
  }
  if (path.startsWith("/private/var/")) {
    paths.push(path.replace("/private", ""));
  }
  return [...new Set(paths)];
}
