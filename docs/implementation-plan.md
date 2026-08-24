# Hexis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Parallel execution:** Follow `docs/parallel-delivery-plan.md` for dependency gates, branch/worktree isolation, narrower file ownership, and merge order. That plan overrides broad file lists here when several agents are active.

**Goal:** Build a local-first iPhone app that helps a person complete a small group of practices during a 30-, 60-, or 90-day focus cycle.

**Architecture:** Expo Router owns navigation and screen composition. SQLite is the source of truth behind repositories for cycles, dated goal membership/configuration, immutable base session logs, and append-only session corrections. Pure domain functions resolve the effective records used for local-day boundaries, weekly progress, streaks, calendars, and dashboards; screens consume those functions through feature hooks.

The shipped migration chain is V3 session timestamps → V4 append-only session corrections → V5 dated practice membership → V6 database-level single-active-cycle enforcement. Application database connections explicitly enable SQLite foreign-key enforcement before migrations and writes.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, `expo-sqlite`, `expo-notifications`, `expo-glass-effect`, Jest, `jest-expo`, and React Native Testing Library.

## Global constraints

- iPhone-first; iOS 26+ is the visual target.
- A cycle lasts 30 days by default; valid lengths are exactly 30, 60, or 90.
- Practice membership may change during an active cycle only from an explicit effective local date forward. Earlier dates and logs keep their original membership context.
- Existing practices may receive forward-only configuration revisions; earlier logs retain their historical configuration.
- A session's base log is immutable. Edits and deletions append correction records; derived reads expose the latest effective state while retaining the audit trail.
- Logging is direct and duration-based; there is no in-app timer.
- There is one optional app-level daily reminder, not per-practice notifications.
- Use Porcelain & Ink tokens and one muted verdigris accent; do not use gradients or glass as the default content background.
- `expo-glass-effect` must always have a functional non-glass fallback.
- No auth, sync, widgets, HealthKit, payments, social features, or AI behavior in v1.
- Navigation is a persistent bottom tab bar (Home, History, Settings), always visible. Cycle setup and goal editing are full-screen modals with the tab bar hidden, not tabs of their own. Every stack screen — modal steps included — supports the native header back button and iOS edge-swipe-back gesture.
- A "week" means the same thing everywhere in the app: a calendar week (Monday–Sunday). Do not introduce a second, cycle-relative definition.
- History can select any cycle once the archive milestone lands. A selected cycle owns the bounds for its Day/Week/Cycle views.

---

## Target file structure

```text
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx        # Home
    history.tsx
    settings/
      index.tsx
  setup/
    _layout.tsx       # modal group, tab bar hidden
    duration.tsx
    practices.tsx
    review.tsx
  cycles/
    [cycleId]/
      edit-goal/[goalId].tsx
src/
  db/
    client.ts
    migrations.ts
    schema.ts
  design/
    tokens.ts
    GlassSurface.tsx
  features/
    cycles/
      data/cycleRepository.ts
      domain/cycleProgress.ts
      domain/cycleLifecycle.ts
      domain/cycleSummary.ts
      domain/date.ts
      domain/types.ts
      hooks/useActiveCycle.ts
      components/CycleCalendar.tsx
      components/CycleHeader.tsx
      components/GoalRow.tsx
      components/ProgressLine.tsx
    goals/
      data/goalRepository.ts
      components/GoalEditor.tsx
      components/GoalTemplateList.tsx
    logging/
      data/sessionRepository.ts
      components/LogSessionSheet.tsx
    reminders/
      reminderService.ts
  test/
    factories.ts
__tests__/
  domain/
  data/
  components/
```

## Preflight gate — Developer environment and GitHub

### Task 0: Prove the local development loop before MVP work

**Files:**
- Create: `.gitignore`, `package.json`, `app.json`, `tsconfig.json`
- Create: `app/_layout.tsx`, `app/index.tsx`
- Create: `.github/` repository metadata through GitHub

**Required outcome:** A private GitHub repository exists with an `origin` remote, the project has an initial commit, `npx expo start --go` starts Metro successfully, and the blank smoke screen appears in Expo Go on a physical iPhone. No feature milestone may begin before this is recorded in `progress/YYYY-MM-DD.md`.

- [ ] **Step 1: Initialize the local Git repository and create the GitHub remote.**

Run:

```bash
git init
git branch -M main
gh repo create hexis --private --source=. --remote=origin
```

- [ ] **Step 2: Create the smallest Expo Router app shell.**

Install Expo, Expo Router, React Native, Safe Area Context, and Screens using the Expo-compatible package installer. Set `main` to `expo-router/entry`; make `app/index.tsx` render exactly one visible `Text` value: `Hexis ready`.

- [ ] **Step 3: Start the Expo Go server and verify the physical-device loop.**

Run:

```bash
npx expo start --go
```

On the iPhone, scan the terminal QR code in Expo Go. Confirm `Hexis ready` appears. Change that literal to `Hexis development loop ready`, save, and confirm Fast Refresh updates the device without a manual reload.

- [ ] **Step 4: Record the verification and create the initial commit.**

```bash
git add .
git commit -m "chore: establish Expo Go development environment"
git push -u origin main
```

Record the physical-device result, Expo SDK version, and any setup issue in `progress/YYYY-MM-DD.md`. If the device verification fails, fix that issue before beginning Task 1.

## Phase 0 — Foundation and design system

### Task 1: Configure the application baseline and testing

**Files:**
- Modify: `package.json`, `app/_layout.tsx`, `app/index.tsx`
- Create: `jest.config.js`, `src/test/factories.ts`

**Produces:**

```ts
// src/features/cycles/domain/types.ts
export type CycleDurationDays = 30 | 60 | 90;

export type CycleStatus = "active" | "completed" | "ended_early";

export type Cycle = {
  id: string;
  name: string;
  startDate: string; // Local YYYY-MM-DD
  durationDays: CycleDurationDays;
  endDate: string; // Inclusive local YYYY-MM-DD
  status: CycleStatus;
  createdAt: string;
};
```

- [ ] **Step 1: Add feature and test dependencies to the verified Expo shell.**

Run:

```bash
npx expo install expo-sqlite expo-notifications expo-glass-effect
npm install --save-dev jest-expo @testing-library/react-native
```

- [ ] **Step 2: Configure Expo Router.**

Set `app/_layout.tsx` to render a stack navigator and make `app/index.tsx` redirect to the active cycle when one exists, otherwise to `cycles/new`.

- [ ] **Step 3: Configure tests before feature work.**

Use the `jest-expo` preset and add this smoke test:

```tsx
// __tests__/components/app.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

it("renders a native screen", () => {
  expect(render(<Text>Hexis</Text>).getByText("Hexis")).toBeTruthy();
});
```

- [ ] **Step 4: Run the smoke test.**

Run:

```bash
npx jest __tests__/components/app.test.tsx --runInBand
npx tsc --noEmit
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit the foundation.**

```bash
git add package.json app.json tsconfig.json jest.config.js app src __tests__
git commit -m "chore: scaffold Expo app foundation"
```

### Task 2: Establish Porcelain & Ink tokens and safe glass primitives

**Files:**
- Create: `src/design/tokens.ts`
- Create: `src/design/GlassSurface.tsx`
- Test: `__tests__/components/GlassSurface.test.tsx`

**Produces:**

```ts
export const colors = {
  porcelain: "#F7F5F0",
  ink: "#1B1B19",
  mutedInk: "#6B6964",
  hairline: "#DEDCD6",
  verdigris: "#477C70",
  porcelainDark: "#171715",
  inkOnDark: "#F4F2ED",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
```

- [ ] **Step 1: Write a failing rendering test for the fallback surface.**

```tsx
it("renders its children when native glass is unavailable", () => {
  const screen = render(
    <GlassSurface glassAvailable={false}>
      <Text>Log session</Text>
    </GlassSurface>,
  );
  expect(screen.getByText("Log session")).toBeTruthy();
});
```

- [ ] **Step 2: Implement `GlassSurface`.**

`GlassSurface` accepts `children`, `style`, and an optional `glassAvailable` test override. When the runtime Liquid Glass API is available, render `GlassView`; otherwise render a `View` with a porcelain/translucent token surface. Do not put business content behind unreadable glass.

- [ ] **Step 3: Run the component tests.**

```bash
npx jest __tests__/components/GlassSurface.test.tsx --runInBand
```

- [ ] **Step 4: Commit the visual foundation.**

```bash
git add src/design __tests__/components/GlassSurface.test.tsx
git commit -m "feat: add Porcelain and Ink design primitives"
```

## Phase 1 — Cycle domain and local persistence

### Task 3: Implement date and progress domain functions

**Files:**
- Create: `src/features/cycles/domain/date.ts`
- Create: `src/features/cycles/domain/cycleProgress.ts`
- Create: `src/features/cycles/domain/types.ts`
- Test: `__tests__/domain/date.test.ts`
- Test: `__tests__/domain/cycleProgress.test.ts`

**Interfaces:**

```ts
export type GoalCadence = "daily" | "weekly";

export type CycleGoal = {
  id: string;
  cycleId: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
  createdAt: string;
};

export type GoalRevision = {
  id: string;
  cycleGoalId: string;
  effectiveDate: string;
  name: string;
  cadence: GoalCadence;
  weeklyTargetCount: number;
  expectedDurationMinutes: number | null;
};

export type SessionLog = {
  id: string;
  cycleGoalId: string;
  localDate: string;
  startedAt: string;
  durationMinutes: number | null;
  createdAt: string;
};

export function addLocalDays(date: string, count: number): string;
export function cycleEndDate(startDate: string, durationDays: CycleDurationDays): string;
export function weekStart(date: string): string;
export function calculateGoalWeekProgress(
  goal: CycleGoal,
  revisions: GoalRevision[],
  logs: SessionLog[],
  today: string,
): { sessionCount: number; sessionTarget: number; minutesLogged: number; minutesTarget: number | null };
```

- [ ] **Step 1: Write failing deterministic date tests.**

```ts
it("sets the inclusive end of a 30-day cycle", () => {
  expect(cycleEndDate("2026-07-01", 30)).toBe("2026-07-30");
});

it("starts weeks on Monday", () => {
  expect(weekStart("2026-07-23")).toBe("2026-07-20");
});
```

- [ ] **Step 2: Write failing progress tests.**

```ts
it("counts sessions and minutes only inside the current week", () => {
  const progress = calculateGoalWeekProgress(strengthGoal, [], strengthLogs, "2026-07-23");
  expect(progress).toEqual({
    sessionCount: 2,
    sessionTarget: 3,
    minutesLogged: 128,
    minutesTarget: 180,
  });
});

it("uses the revision active on the log date", () => {
  expect(goalConfigurationOn("2026-07-22", revisions).weeklyTargetCount).toBe(2);
});
```

- [ ] **Step 3: Implement pure local-date parsing.**

Never parse a `YYYY-MM-DD` local date with `new Date("YYYY-MM-DD")`; construct dates from numeric local components to prevent UTC shifts. Keep date helpers free of React Native and database dependencies.

- [ ] **Step 4: Implement weekly progress and calendar intensity.**

Add:

```ts
export function calendarDayIntensity(
  cycleGoals: CycleGoal[],
  logs: SessionLog[],
  localDate: string,
): 0 | 1 | 2;
```

Return `0` for no logged practices, `1` when fewer than half of active practices have a log, and `2` when at least half have a log.

- [ ] **Step 5: Run the domain tests.**

```bash
npx jest __tests__/domain --runInBand
```

- [ ] **Step 6: Commit the domain layer.**

```bash
git add src/features/cycles/domain __tests__/domain
git commit -m "feat: add cycle progress domain"
```

### Task 4: Add SQLite schema, migrations, and repositories

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/migrations.ts`
- Create: `src/features/cycles/data/cycleRepository.ts`
- Create: `src/features/goals/data/goalRepository.ts`
- Create: `src/features/logging/data/sessionRepository.ts`
- Test: `__tests__/data/sessionRepository.test.ts`

**Schema:**

```sql
CREATE TABLE cycles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days IN (30, 60, 90)),
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'ended_early')),
  created_at TEXT NOT NULL
);

CREATE TABLE cycle_goals (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_id TEXT NOT NULL REFERENCES cycles(id),
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  weekly_target_count INTEGER NOT NULL CHECK (weekly_target_count > 0),
  expected_duration_minutes INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE goal_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  effective_date TEXT NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  weekly_target_count INTEGER NOT NULL CHECK (weekly_target_count > 0),
  expected_duration_minutes INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE session_logs (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_goal_id TEXT NOT NULL REFERENCES cycle_goals(id),
  local_date TEXT NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  created_at TEXT NOT NULL
);
```

- [ ] **Step 1: Write failing repository tests with a test database.**

```ts
it("creates one active cycle with goal snapshots", async () => {
  const cycle = await cycleRepository.createCycle(newCycleInput);
  expect(await cycleRepository.getActiveCycle()).toMatchObject({
    id: cycle.id,
    status: "active",
    durationDays: 30,
  });
  expect(await goalRepository.listForCycle(cycle.id)).toHaveLength(4);
});
```

- [ ] **Step 2: Implement ordered migrations.**

Use `PRAGMA user_version`; run each migration inside a transaction; set the next user version only after its statements succeed. Enable WAL mode during initialization.

- [ ] **Step 3: Implement repository boundaries.**

```ts
export interface CycleRepository {
  createCycle(input: CreateCycleInput): Promise<Cycle>;
  getActiveCycle(): Promise<Cycle | null>;
  endCycleEarly(cycleId: string, localDate: string): Promise<void>;
}

export interface GoalRepository {
  listForCycle(cycleId: string): Promise<CycleGoal[]>;
  createRevision(input: CreateGoalRevisionInput): Promise<GoalRevision>;
  listRevisions(cycleGoalId: string): Promise<GoalRevision[]>;
}

export interface SessionRepository {
  create(input: CreateSessionLogInput): Promise<SessionLog>;
  listForCycle(cycleId: string): Promise<SessionLog[]>;
}
```

- [ ] **Step 4: Enforce cycle invariants in repository code.**

`createCycle` rejects an active-cycle creation when another active cycle exists. `createRevision` rejects an effective date before the cycle start or after the cycle end. The repository must not expose a method for adding or deleting goals from an active cycle.

- [ ] **Step 5: Run repository tests and migration checks.**

```bash
npx jest __tests__/data/cycleRepository.test.ts --runInBand
npx tsc --noEmit
```

- [ ] **Step 6: Commit persistence.**

```bash
git add src/db src/features/cycles/data src/features/goals/data src/features/logging/data __tests__/data
git commit -m "feat: persist cycles goals and sessions"
```

## Phase 2 — First-time setup and active-goal editing

### Task 5: Build cycle creation onboarding

**Files:**
- Create: `app/cycles/new.tsx`
- Create: `src/features/goals/components/GoalTemplateList.tsx`
- Create: `src/features/goals/components/GoalEditor.tsx`
- Create: `src/features/cycles/hooks/useCreateCycle.ts`
- Test: `__tests__/components/cycleSetup.test.tsx`

**Behavior:**

- Welcome introduces a finite focus cycle.
- Duration is one of 30, 60, or 90 days; 30 is selected initially.
- Starter templates include Strength, Swim, Yoga, and Read, each editable before start.
- A custom practice accepts name, daily/weekly cadence, weekly target count, and optional expected duration.
- Review displays the full group and cycle length.
- Start creates the cycle and goal snapshots in one transaction, then routes to `cycles/[cycleId]`.

- [ ] **Step 1: Write a failing duration-selection test.**

```tsx
it("starts with 30 days and permits a 60-day cycle", async () => {
  const screen = render(<CycleSetupScreen />);
  expect(screen.getByRole("button", { name: "30 days" })).toHaveAccessibilityState({ selected: true });
  await userEvent.press(screen.getByRole("button", { name: "60 days" }));
  expect(screen.getByRole("button", { name: "60 days" })).toHaveAccessibilityState({ selected: true });
});
```

- [ ] **Step 2: Implement the four-step setup state machine.**

```ts
type SetupStep = "welcome" | "duration" | "practices" | "review";

const transitions: Record<SetupStep, SetupStep | null> = {
  welcome: "duration",
  duration: "practices",
  practices: "review",
  review: null,
};
```

- [ ] **Step 3: Validate all input before review.**

Require a non-empty cycle name and at least one practice. Reject zero/negative target counts and non-positive expected durations. Do not ask for notification permission.

- [ ] **Step 4: Implement create-and-route behavior.**

The submit handler calls `CycleRepository.createCycle` exactly once, disables the start button while pending, shows a recoverable error message on failure, and routes only after success.

- [ ] **Step 5: Run onboarding tests.**

```bash
npx jest __tests__/components/cycleSetup.test.tsx --runInBand
```

- [ ] **Step 6: Commit onboarding.**

```bash
git add app/cycles/new.tsx src/features/goals src/features/cycles/hooks __tests__/components/cycleSetup.test.tsx
git commit -m "feat: add cycle setup onboarding"
```

### Task 6: Build the returning-user active-goal editor

**Files:**
- Create: `app/cycles/[cycleId]/edit-goal/[goalId].tsx`
- Modify: `src/features/goals/components/GoalEditor.tsx`
- Create: `src/features/goals/hooks/useUpdateGoal.ts`
- Test: `__tests__/components/goalEditor.test.tsx`

**Behavior:**

- A returning user selects an existing goal from cycle settings.
- They can revise name, cadence, weekly count, and expected session duration.
- Saving creates a `GoalRevision` whose effective date is the current local day.
- The editor never offers add/remove goal actions while the cycle is active.
- Earlier session logs are not mutated.

- [ ] **Step 1: Write failing forward-only revision tests.**

```tsx
it("writes a revision for today without changing earlier logs", async () => {
  await userEvent.press(screen.getByRole("button", { name: "Save updates" }));
  expect(createRevision).toHaveBeenCalledWith(
    expect.objectContaining({ cycleGoalId: "goal-strength", effectiveDate: "2026-07-24" }),
  );
  expect(updateSessionLog).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement the editor using the shared pre-start form.**

Pass an `editingActiveGoal` mode to `GoalEditor`; show explicit helper copy: “Updates apply from today. Earlier logs remain unchanged.”

- [ ] **Step 3: Prevent invalid active-cycle changes.**

The route verifies that the goal belongs to the requested active cycle. It shows an unavailable state for completed/ended cycles and returns to the cycle landing page.

- [ ] **Step 4: Run editor tests and commit.**

```bash
npx jest __tests__/components/goalEditor.test.tsx --runInBand
git add app/cycles src/features/goals __tests__/components/goalEditor.test.tsx
git commit -m "feat: support forward-only goal updates"
```

## Phase 3 — Cycle landing page and direct logging

### Task 7: Build the active-cycle landing page

**Files:**
- Create: `app/cycles/[cycleId]/index.tsx`
- Create: `src/features/cycles/hooks/useActiveCycle.ts`
- Create: `src/features/cycles/components/CycleHeader.tsx`
- Create: `src/features/cycles/components/CycleCalendar.tsx`
- Create: `src/features/cycles/components/GoalRow.tsx`
- Create: `src/features/cycles/components/ProgressLine.tsx`
- Test: `__tests__/components/cycleLanding.test.tsx`

**Behavior:**

- Header shows cycle name, `Day X / duration`, days remaining, and total cycle progress.
- Calendar has exactly one cell per cycle day and marks the current day.
- A cell’s intensity is derived from that local day’s completed-practice count.
- All configured goals appear in one list, with no due-state grouping.
- Each row shows name, streak, weekly progress, and a direct **Log** button.

- [ ] **Step 1: Write a failing calendar test.**

```tsx
it("renders 30 cells and identifies the current day", () => {
  const screen = render(<CycleCalendar durationDays={30} todayIndex={11} days={dayData} />);
  expect(screen.getAllByRole("button", { name: /cycle day/i })).toHaveLength(30);
  expect(screen.getByRole("button", { name: "Cycle day 12, today" })).toBeTruthy();
});
```

- [ ] **Step 2: Implement accessible calendar labels.**

Each cell’s accessibility label includes day number, local date, completion intensity, and “today” when appropriate. Do not make color or dot size the only source of progress information.

- [ ] **Step 3: Implement the unified goal list.**

Use a flat list with stable keys. A `GoalRow` receives:

```ts
type GoalRowModel = {
  goalId: string;
  name: string;
  streakLabel: string;
  weeklyProgressLabel: string;
  weeklyProgressRatio: number;
};
```

- [ ] **Step 4: Run landing tests and commit.**

```bash
npx jest __tests__/components/cycleLanding.test.tsx --runInBand
git add app/cycles src/features/cycles/components src/features/cycles/hooks __tests__/components/cycleLanding.test.tsx
git commit -m "feat: add active cycle landing page"
```

### Task 8: Build quick session logging

**Files:**
- Create: `src/features/logging/components/LogSessionSheet.tsx`
- Create: `src/features/logging/hooks/useLogSession.ts`
- Modify: `src/features/cycles/components/GoalRow.tsx`
- Test: `__tests__/components/logSessionSheet.test.tsx`

**Behavior:**

- Tapping **Log** saves exactly one session immediately with the goal's expected duration, or no duration for a count-only practice.
- **Details** opens an elevated sheet before saving; it offers 15, 30, 45, 60, and 90 minute choices and includes any non-standard expected duration as a selected option.
- A pending-state lock prevents rapid taps from creating duplicate sessions. Failures leave the user on the current screen with a retryable inline error.
- Every successful save refreshes landing data. Details closes after its successful save.

- [ ] **Step 1: Write failing quick-duration tests.**

```tsx
it("preselects the expected duration and saves the actual selection", async () => {
  const screen = render(<LogSessionSheet goal={strengthGoal} visible onDismiss={jest.fn()} />);
  expect(screen.getByRole("button", { name: "60 min" })).toHaveAccessibilityState({ selected: true });
  await userEvent.press(screen.getByRole("button", { name: "45 min" }));
  await userEvent.press(screen.getByRole("button", { name: "Save 45 min" }));
  expect(createSessionLog).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 45 }));
});
```

- [ ] **Step 2: Implement the one-tap default and Details path.**

Keep the immediate default and the duration-selection path separate but route both through the same session repository. Disable each action while its save is pending; on failure, preserve Details' selected duration and show a retryable inline error.

- [ ] **Step 3: Run logging tests and commit.**

```bash
npx jest __tests__/components/logSessionSheet.test.tsx --runInBand
git add src/features/logging src/features/cycles/components/GoalRow.tsx __tests__/components/logSessionSheet.test.tsx
git commit -m "feat: add direct session logging"
```

## Phase 4 — Navigation shell: tabs, modals, and back-stack

### Task 9: Add the persistent bottom tab shell

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx` (Home)
- Create: `app/(tabs)/history.tsx` (placeholder content until Task 11)
- Create: `app/(tabs)/week.tsx` (placeholder content until Task 11)
- Create: `app/(tabs)/settings/index.tsx`
- Modify: `app/_layout.tsx`, `app/index.tsx`
- Test: `__tests__/components/tabShell.test.tsx`

**Behavior:**

- Four tabs — Home, History, Week, Settings — are always visible, whether or not a cycle is active.
- Home renders the existing active-cycle landing page when a cycle exists; otherwise it shows an empty state with a **Start a cycle** action that opens the setup modal.
- History and Week show a plain "No active cycle yet" placeholder until Task 11 fills in real summaries.
- Settings lists three rows: **Edit goals** (opens the active-goal editor modal per goal), **Reminder** (placeholder row, wired up in Task 12), and **End cycle early** (confirms, then calls `endCycleEarly` and returns to Home).
- `app/index.tsx` no longer performs the has-active-cycle redirect; that decision moves into the Home tab itself.

- [ ] **Step 1: Write a failing tab-shell test.**

```tsx
it("shows all four tabs and an empty-state CTA when no cycle is active", () => {
  const screen = render(<TabsLayout />);
  expect(screen.getByRole("tab", { name: "Home" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Week" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start a cycle" })).toBeTruthy();
});
```

- [ ] **Step 2: Implement the tab group and move the active-cycle landing page under Home.**

Use Expo Router's `(tabs)` group. Reuse the existing `CycleLandingScreen` implementation for the active-cycle case inside `app/(tabs)/index.tsx`; add the empty-state branch alongside it.

- [ ] **Step 3: Implement the Settings list and wire the debug reset panel into it (dev builds only).**

Keep the `__DEV__`-only "Reset all data" action; move it from the landing-page footer into Settings so the landing page stays focused on the active cycle.

- [ ] **Step 4: Run the tab-shell tests and commit.**

```bash
npx jest __tests__/components/tabShell.test.tsx --runInBand
git add app src/features/cycles __tests__/components/tabShell.test.tsx
git commit -m "feat: add persistent bottom tab shell"
```

### Task 10: Route the setup wizard and goal editor as back-navigable modals

**Files:**
- Create: `app/setup/_layout.tsx`, `app/setup/duration.tsx`, `app/setup/practices.tsx`, `app/setup/review.tsx`
- Modify: `app/cycles/[cycleId]/edit-goal/[goalId].tsx`
- Create: a shared setup-state provider (e.g. `src/features/cycles/hooks/useCycleSetupState.ts`) so wizard fields survive step navigation
- Test: `__tests__/components/cycleSetupNavigation.test.tsx`

**Behavior:**

- The setup wizard becomes three real routes instead of one screen with internal step state; each step pushes the next and supports the native header back button and edge-swipe-back gesture.
- The `setup` route group is presented modally over the tab bar; the tab bar is hidden for its duration and reappears on dismiss or completion.
- Backing out of the first step (duration) dismisses the modal back to whichever tab opened it.
- `edit-goal` keeps its existing validation and save behavior but adopts the same native header back instead of a custom "Cancel" affordance as the only way out.
- No wizard or editor field is lost when moving back a step; forward re-entry restores prior selections.

- [ ] **Step 1: Write a failing back-navigation test.**

```tsx
it("preserves the selected duration when navigating back from practices", async () => {
  const screen = render(<SetupNavigator />);
  await userEvent.press(screen.getByRole("button", { name: "60 days" }));
  await userEvent.press(screen.getByRole("button", { name: "Continue" }));
  await userEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByRole("button", { name: "60 days" })).toHaveAccessibilityState({ selected: true });
});
```

- [ ] **Step 2: Split `CycleSetupScreen` into three routed steps backed by shared state.**

Move `SetupStep`'s three post-welcome states (`duration`, `practices`, `review`) into `app/setup/*.tsx` routes; lift `durationDays`, `templates`, `customPractices`, and `cycleName` into the shared provider so each route reads/writes the same state.

- [ ] **Step 3: Present the setup group and edit-goal as modals with tabs hidden.**

Use Expo Router's modal presentation (`presentation: "modal"` or a dedicated stack group) so the tab bar is not visible while either flow is active.

- [ ] **Step 4: Run the navigation tests and commit.**

```bash
npx jest __tests__/components/cycleSetupNavigation.test.tsx --runInBand
npx tsc --noEmit
git add app/setup app/cycles src/features/cycles __tests__/components/cycleSetupNavigation.test.tsx
git commit -m "feat: route setup wizard and goal editor as back-navigable modals"
```

## Phase 5 — Cycle completion, unified history, reminder, and personal build

> This phase replaced an earlier, thinner "reviews + TestFlight" plan after a grilling session surfaced three real gaps: (1) `CycleStatus` already declares `"completed"`, but nothing ever sets it, so a cycle running past its end date has no way to finish and blocks starting a new one; (2) the separate Week/History tabs overlapped enough that they should be one tab with filters; (3) EAS cannot produce an installable iOS build without a paid Apple Developer account, so "release readiness" means a local Xcode build on a personal iPhone, not TestFlight.

### Task 11: Fix cycle completion and add Home's completed-cycle state

**Files:**
- Create: `src/features/cycles/domain/cycleLifecycle.ts`
- Create: `src/features/cycles/domain/cycleSummary.ts` (cycle-level selector only; Task 12 adds day/week selectors to this same file)
- Create: `src/features/cycles/components/CycleSummaryCard.tsx` (shared by Home's completed state and History's Cycle filter)
- Modify: `src/features/cycles/data/cycleRepository.ts`
- Modify: `src/features/cycles/hooks/useCycleLanding.ts`
- Modify: `app/(tabs)/index.tsx`
- Test: `__tests__/domain/cycleLifecycle.test.ts`
- Test: `__tests__/domain/cycleSummary.test.ts`
- Test: `__tests__/data/cycleRepository.test.ts` (extend existing file)
- Test: `__tests__/components/cycleLanding.test.tsx` (extend existing file)

**Behavior:**

- A cycle whose `endDate` has passed while `status` is still `"active"` transitions to `"completed"` the next time cycle state is read — lazily, with no background job. This must happen before the "one active cycle" uniqueness check `createCycle` performs, or a naturally finished cycle blocks starting a new one forever.
- `getActiveCycle` only ever returns a cycle that is genuinely still active (not past its end date); a new `getMostRecentCycle` returns the latest cycle regardless of status, used only to detect "a cycle just finished and nothing has replaced it yet."
- Home has three states: **active** (today's landing page, unchanged), **completed** (the most recent cycle has ended — naturally or early — and no new cycle exists yet: show `CycleSummaryCard` plus a prominent **Start a new cycle** action), and **empty** (no cycle has ever existed: today's plain "Start a cycle" state).
- `CycleSummaryCard` shows total active days and days with logged effort, practice-level completion and duration totals, and the strongest week and most consistent practice — the same content History's Cycle filter shows in Task 12, so build it once and share it.

**Interfaces:**

```ts
// src/features/cycles/domain/cycleLifecycle.ts
export function hasCycleEnded(cycle: Pick<Cycle, "endDate">, today: string): boolean;

// src/features/cycles/domain/cycleSummary.ts
export type CycleAchievementSummary = {
  activeDayCount: number;
  loggedDayCount: number;
  practiceTotals: { goalId: string; name: string; completedCount: number; minutesLogged: number }[];
  strongestWeekLabel: string | null;
  mostConsistentPracticeName: string | null;
};
export function buildCycleSummary(
  cycle: Cycle,
  goals: CycleGoal[],
  revisions: GoalRevision[],
  logs: SessionLog[],
): CycleAchievementSummary;

// src/features/cycles/data/cycleRepository.ts
export interface CycleRepository {
  createCycle(input: CreateCycleInput): Promise<Cycle>;
  getActiveCycle(today?: string): Promise<Cycle | null>; // defaults to todayLocalDate()
  getMostRecentCycle(): Promise<Cycle | null>;
  endCycleEarly(cycleId: string, localDate: string): Promise<void>;
}
```

- [ ] **Step 1: Write failing tests for the completion transition.**

```ts
it("transitions an active cycle to completed once its end date has passed, and allows a new cycle afterward", async () => {
  const cycle = await cycleRepository.createCycle(createCycleInput({ startDate: "2026-06-01", durationDays: 30 }));
  const dayAfterEnd = addLocalDays(cycle.endDate, 1);

  expect(await cycleRepository.getActiveCycle(dayAfterEnd)).toBeNull();
  expect(await cycleRepository.getMostRecentCycle()).toMatchObject({ id: cycle.id, status: "completed" });

  await expect(
    cycleRepository.createCycle(createCycleInput({ name: "Next", startDate: dayAfterEnd })),
  ).resolves.toMatchObject({ name: "Next", status: "active" });
});
```

- [ ] **Step 2: Implement `hasCycleEnded`, thread it through `getActiveCycle`/`createCycle`, and add `getMostRecentCycle`.**

`createCycle`'s existing-active-cycle check must call the same completion-resolving path as `getActiveCycle` (e.g. by calling it directly) rather than a separate raw query, so there is exactly one place that decides whether a cycle is still active.

- [ ] **Step 3: Implement `buildCycleSummary` as a pure function and `CycleSummaryCard`.**

Keep database reads out of `cycleSummary.ts`; it takes already-loaded cycle/goals/revisions/logs, matching the existing `cycleProgress.ts` convention.

- [ ] **Step 4: Add the `completed` state to `useCycleLanding` and Home.**

When `getActiveCycle` returns null, call `getMostRecentCycle`; if it returns a non-active cycle, load its goals/revisions/logs, build the summary, and return the `completed` state instead of `empty`.

- [ ] **Step 5: Run tests and commit.**

```bash
npx jest __tests__/domain/cycleLifecycle.test.ts __tests__/domain/cycleSummary.test.ts __tests__/data/cycleRepository.test.ts __tests__/components/cycleLanding.test.tsx --runInBand
npx tsc --noEmit
git add src/features/cycles app/"(tabs)"/index.tsx __tests__
git commit -m "fix: transition cycles to completed and show Home's completion summary"
```

### Task 12: Replace Week/History with a single History tab (Day / Week / Cycle filters)

**Files:**
- Modify: `src/features/cycles/domain/cycleSummary.ts` (add day and week selectors alongside Task 11's cycle selector)
- Modify: `app/(tabs)/history.tsx` (replaces placeholder with the full filtered view)
- Modify: `app/(tabs)/_layout.tsx` (remove the Week tab trigger)
- Delete: `app/(tabs)/week.tsx`
- Test: `__tests__/domain/cycleSummary.test.ts` (extend from Task 11)
- Test: `__tests__/components/cycleHistory.test.tsx`
- Test: `__tests__/components/tabShell.test.tsx` (update: three tabs, not four)

**Behavior:**

- History has a segmented Day / Week / Cycle control at the top, defaulting to Week.
- **Day** shows a per-goal breakdown for a selected local date: logged or not, and minutes logged versus expected duration when applicable. Defaults to today.
- **Week** shows the current *calendar* week (Monday–Sunday — the same definition `cycleProgress.ts` already uses for weekly targets and streaks, not a new cycle-relative one): sessions completed, time logged, target progress by practice, strongest day, and practices that missed their weekly target. Prev/next navigation is bounded to calendar weeks that overlap the active cycle's date range; the first/last week may be a partial week clipped to the cycle's actual start/end date.
- **Cycle** shows the full-cycle contribution grid (reusing `calendarDayIntensity`, like Home's calendar) plus `CycleSummaryCard` from Task 11 — the same card Home shows once the cycle is complete.
- History reads the current cycle only (active, or the most recent one if just completed) via the same `getActiveCycle`/`getMostRecentCycle` resolution Task 11 added; there is no cross-cycle picker in v1.

- [ ] **Step 1: Write failing summary-selector tests.**

```ts
it("identifies the strongest local day by completed practices then minutes", () => {
  expect(buildWeekSummary(cycleGoals, revisions, logs, weekStartDate).strongestDay).toEqual({
    localDate: "2026-07-22",
    completedGoalCount: 3,
    minutesLogged: 140,
  });
});
```

- [ ] **Step 2: Implement `buildDaySummary` and `buildWeekSummary`, reusing `weekStart`/`addLocalDays` from `date.ts` and `calculateGoalWeekProgress`/`goalConfigurationOn` from `cycleProgress.ts` where they already do the right calculation.**

- [ ] **Step 3: Build the History screen: segmented control, Day picker, Week pager, Cycle grid.**

Use a plain statement such as "Strength reached 2 of 3 sessions" rather than judgmental language. Ensure the grid and week pager work with VoiceOver and Dynamic Type, and that Week navigation cannot go earlier than the cycle's start or later than today/the cycle's end.

- [ ] **Step 4: Remove the Week tab.**

Update `app/(tabs)/_layout.tsx` to three triggers (Home, History, Settings) and delete `app/(tabs)/week.tsx`.

- [ ] **Step 5: Run tests and commit.**

```bash
npx jest __tests__/domain/cycleSummary.test.ts __tests__/components/cycleHistory.test.tsx __tests__/components/tabShell.test.tsx --runInBand
npx tsc --noEmit
git add "app/(tabs)" src/features/cycles/domain __tests__
git commit -m "feat: replace Week/History tabs with a single filtered History tab"
```

### Task 13: Add the daily reminder with a time picker

**Files:**
- Create: `src/db/schema.ts` addition (`SCHEMA_V2`: a single-row `reminder_settings` table) and register it in `src/db/migrations.ts`
- Create: `src/features/reminders/reminderService.ts`
- Modify: `app/(tabs)/settings/index.tsx` (replace the "Coming soon" placeholder with a toggle + time picker)
- Test: `__tests__/reminders/reminderService.test.ts`
- Test: `__tests__/components/tabShell.test.tsx` (extend Settings tests for the new reminder UI)

**Interfaces:**

```ts
export type DailyReminder = {
  enabled: boolean;
  hour: number;
  minute: number;
  notificationIdentifier: string | null;
};

export async function setDailyReminder(input: DailyReminder): Promise<DailyReminder>;
export async function clearDailyReminder(identifier: string | null): Promise<void>;
```

- [ ] **Step 1: Write failing permission-state tests.**

```ts
it("does not schedule when notification permission is denied", async () => {
  mockNotificationPermission("denied");
  await expect(setDailyReminder(enabledReminder)).resolves.toMatchObject({
    enabled: false,
    notificationIdentifier: null,
  });
});
```

- [ ] **Step 2: Add the `reminder_settings` migration and implement permission-on-intent behavior.**

Request permission only after the person enables the reminder. Once granted, show a time picker; schedule one repeating local notification for the chosen hour/minute with generic, calm copy (e.g. "Time to check in on today's practices") — no per-goal dynamic content. On denial, leave the reminder disabled and provide a route to iOS Settings; do not block tracking.

- [ ] **Step 3: Wire the Settings row: toggle, time picker, and persistence across app restarts.**

- [ ] **Step 4: Run tests and commit.**

```bash
npx jest __tests__/reminders/reminderService.test.ts __tests__/components/tabShell.test.tsx --runInBand
npx tsc --noEmit
git add src/db src/features/reminders "app/(tabs)/settings" __tests__
git commit -m "feat: add daily reminder with a time picker"
```

### Task 14: Full validation and a local personal-device build

EAS Build cannot produce an installable iPhone build without a paid Apple Developer Program membership — that's an Apple signing-certificate restriction, not an Expo limitation. v1 "release readiness" means a local Xcode build installed directly on one personal iPhone via a free Apple ID, which expires after 7 days and needs re-running; it explicitly does not mean TestFlight or App Store Connect.

**Files:**
- Create: `docs/release-checklist.md` (reframed as a personal-build runbook, not a TestFlight checklist)

**Steps:**

- [ ] **Step 1: Complete manual device validation.**

Verify on a physical iOS 26 device:

- cycle setup, restart, natural completion (fast-forward by adjusting device date, or seed data past the end date), and early-end behavior, including that a new cycle can be started after either
- Home's three states: active, completed-with-summary, and never-started
- History's Day/Week/Cycle filters, including Week navigation bounded to the cycle's date range
- local-day and weekly boundary behavior across a timezone change
- duration selection and offline persistence after app restart
- denied, granted, and revoked notification permissions; the reminder fires at the configured time
- Liquid Glass tab bar and regular fallback appearance
- Dynamic Type, VoiceOver labels, and reduced-motion behavior

- [ ] **Step 2: Run the complete automated suite.**

```bash
npx jest --runInBand
npx tsc --noEmit
npx expo-doctor
```

Expected: all commands exit with code `0`.

- [ ] **Step 3: Write `docs/release-checklist.md` as a reinstall runbook and commit.**

Cover: `npx expo prebuild`, opening `ios/*.xcworkspace` in Xcode, signing with a free Apple ID under Signing & Capabilities, connecting the iPhone via USB (or same-network wireless debugging) and enabling Developer Mode on it, and that the install expires after 7 days and needs re-running `npx expo run:ios --device` (no App Store Connect, no push notifications under free provisioning — the reminder only needs local notifications, which are unaffected).

```bash
git add docs/release-checklist.md
git commit -m "docs: add personal-device build runbook"
```

- [ ] **Step 4: Produce the local build.**

```bash
npx expo prebuild --platform ios
npx expo run:ios --device
```

## Phase 6 — Historical activity timeline and corrections

> This phase makes every elapsed cycle day trustworthy and correctable. It first records actual session times and exposes a chronological Day timeline, then adds historical activity creation plus append-only edits/deletions. Future dates remain unavailable, notes stay out of scope, and every summary is derived from the latest effective session state.

### Task 15: Persist each session's actual start time

**Files:**
- Modify: `src/db/schema.ts` (add `SCHEMA_V3`)
- Modify: `src/db/migrations.ts`
- Modify: `src/features/cycles/domain/types.ts`
- Modify: `src/features/cycles/domain/date.ts`
- Modify: `src/features/logging/data/sessionRepository.ts`
- Modify: `src/features/logging/hooks/useLogSession.ts`
- Modify: `src/features/cycles/components/GoalRow.tsx`
- Modify: `src/features/logging/components/LogSessionSheet.tsx`
- Test: `__tests__/db/migrations.test.ts`
- Test: `__tests__/data/sessionRepository.test.ts`
- Test: `__tests__/components/cycleLanding.test.tsx`
- Test: `__tests__/components/logSessionSheet.test.tsx`

**Behavior:**

- Add an immutable `startedAt` ISO timestamp to every `SessionLog`. For a new session, capture one current instant and derive both `startedAt` and `localDate` from it, so a midnight boundary cannot split the time and date across different days.
- Add migration V3 to backfill existing rows' `started_at` from `created_at`; all new writes persist both values. Retain `createdAt` as the record-creation timestamp.
- One-tap Log and Details both use the current actual time automatically. Details remains duration-only: this milestone adds no time/date picker, notes, backfill, or post-save editing.

- [ ] **Step 1: Write failing migration and repository tests.**

Seed a version-2 database with an existing session, migrate it, and assert `started_at` equals the original `created_at`. Freeze time for a new repository write and assert the returned and persisted `startedAt` and `localDate` come from the same instant.

- [ ] **Step 2: Add migration V3 and thread `startedAt` through the session model.**

Use a single clock read for each session creation. Keep the new timestamp database-owned rather than adding a user-facing time field to either logging path.

- [ ] **Step 3: Update logging mocks/tests and commit.**

```bash
npx jest __tests__/db/migrations.test.ts __tests__/data/sessionRepository.test.ts __tests__/components/cycleLanding.test.tsx __tests__/components/logSessionSheet.test.tsx --runInBand
npx tsc --noEmit
git add src/db src/features/cycles src/features/logging __tests__
git commit -m "feat: record actual session start times"
```

### Task 16: Open selected calendar days in History

**Files:**
- Modify: `src/features/cycles/components/CycleCalendar.tsx`
- Modify: `src/features/cycles/domain/cycleSummary.ts`
- Modify: `src/features/cycles/hooks/useCycleHistory.ts`
- Modify: `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`
- Test: `__tests__/domain/cycleSummary.test.ts`
- Test: `__tests__/components/cycleLanding.test.tsx`
- Test: `__tests__/components/cycleHistory.test.tsx`

**Behavior:**

- Home's calendar and History's Cycle calendar make dates from the cycle start through the active cycle's current local date—or through a completed cycle's end date—interactive. Selecting one navigates to `/history` with `filter=day` and that date as route parameters.
- Future dates remain visual calendar cells only. They must not navigate or masquerade as disabled day-progress controls.
- History consumes and validates the route parameters, selects the Day filter, and renders the requested day. Outside a calendar link, Day continues to default to today (bounded to the current cycle).
- The Day view has a date heading, total session count, total minutes, the existing per-practice status summary, and a chronological session list. Every session row shows practice name, actual start time, and duration when present. Task 16 establishes the timeline; Task 18 adds its creation and correction actions after Task 17 supplies persistence.
- Previous/Next day controls are bounded by the cycle start and the same maximum interactive date as the calendar. Their navigation updates the Day route parameters so the selected date is shareable and survives tab changes.

- [ ] **Step 1: Write failing selector and route-composition tests.**

Extend `buildDaySummary` tests to assert totals and session entries sorted by `startedAt` ascending. Add screen tests for Home and Cycle-calendar taps, route-selected Day state, future-date non-navigation, and the bounded day pager.

- [ ] **Step 2: Add calendar navigation and the richer Day selector/view.**

Give `CycleCalendar` an explicit day-selection callback plus a maximum interactive date. Route both calendar callers into the existing History tab, rather than creating a second day-detail screen. Have `buildDaySummary` join session logs to the effective goal name for its date and sort them chronologically; keep presentation logic in History.

- [ ] **Step 3: Implement the bounded Day pager.**

Use the selected local date as the pager source of truth. Disable or omit Previous/Next beyond the start and maximum date; never allow paging into a future day.

- [ ] **Step 4: Run the focused suite and commit.**

```bash
npx jest __tests__/domain/cycleSummary.test.ts __tests__/components/cycleLanding.test.tsx __tests__/components/cycleHistory.test.tsx --runInBand
npx tsc --noEmit
git add "app/(tabs)" src/features/cycles __tests__/domain __tests__/components
git commit -m "feat: open calendar days in history"
```

### Task 17: Add an append-only session correction model

**Files:**
- Modify: `src/db/schema.ts` (add `SCHEMA_V4`)
- Modify: `src/db/migrations.ts`
- Modify: `src/features/cycles/domain/types.ts`
- Modify: `src/features/logging/data/sessionRepository.ts`
- Test: `__tests__/db/migrations.test.ts`
- Test: `__tests__/data/sessionRepository.test.ts`

**Behavior:**

- Keep each row in `session_logs` as the immutable original fact. Add `session_log_revisions` with an auto-incrementing sequence, the source session id, effective goal id, local date, start timestamp, duration, tombstone flag, and correction creation timestamp.
- Every edit writes a complete replacement snapshot; every delete writes a tombstone. The repository resolves the highest-sequence revision as the effective session and hides tombstoned sessions from normal lists. The original plus revision history remains queryable for debugging and future audit UI.
- Editing may correct the practice, date, time, or duration. The effective local date must be derived from the chosen start timestamp in the device timezone and must remain inside the source cycle and no later than today.
- Replace the existing hard-delete quick undo with a tombstone correction so every removal path follows one rule.
- Normal repository reads become the enforcement boundary: all progress, calendar intensity, History, and completion summaries receive effective sessions only and therefore cannot count an original and its revision twice. Task 17 does not rewrite those selectors while Task 16 owns them.

- [ ] **Step 1: Lock the correction contract with failing migration/repository tests.**

Cover unchanged rows, one edit, multiple edits, deletion, deterministic latest-revision selection, persistence after reinitialization, invalid cross-cycle goal changes, cycle bounds, and a timezone boundary.

- [ ] **Step 2: Add `SCHEMA_V4` and effective-session repository reads.**

Keep raw/audit reads explicitly named and out of ordinary screen hooks. Make normal `listForCycle` and `listForDay` calls return only effective, non-deleted sessions.

- [ ] **Step 3: Switch normal repository reads to effective sessions and commit.**

```bash
npx jest __tests__/db/migrations.test.ts __tests__/data/sessionRepository.test.ts --runInBand
npx tsc --noEmit
git add src/db src/features __tests__
git commit -m "feat: preserve append-only session corrections"
```

### Task 18: Add, edit, and delete activities from the Day timeline

**Files:**
- Create: `src/features/logging/components/ActivityEditorSheet.tsx`
- Create: `src/features/logging/hooks/useEditSession.ts`
- Modify: `app/(tabs)/history.tsx`
- Modify: `src/features/cycles/hooks/useCycleHistory.ts`
- Modify: `docs/project-overview.md`
- Modify: `docs/release-checklist.md`
- Test: `__tests__/components/activityEditorSheet.test.tsx`
- Test: `__tests__/components/cycleHistory.test.tsx`
- Modify: `progress/YYYY-MM-DD.md`

**Behavior:**

- The selected Day view has **Add activity**. It preselects that date, allows choosing a practice and time, and offers the same duration choices as quick logging. Today defaults to the current time; an earlier day defaults to the current clock time on that date.
- Selecting a timeline row opens the same sheet in edit mode. Practice, date, time, and duration are editable. Saving appends a revision and returns to the effective day; moving a session to another date refreshes both affected dates.
- **Delete activity** requires confirmation and appends a tombstone. There is no bulk delete, future-date entry, outside-cycle entry, or note field.
- The screen exposes pending, retryable error, empty-day, and VoiceOver-labelled states. A successful mutation refreshes Day totals, per-practice status, weekly/cycle analytics, and both calendars without relaunching.

- [ ] **Step 1: Write failing add/edit/delete interaction tests.**

Include an earlier-day add, durationless activity, correcting the selected practice, moving between days, deletion confirmation/cancel, bounds rejection, error retry, and focus refresh.

- [ ] **Step 2: Build the shared editor and wire it to the timeline.**

Keep validation in domain/repository code as well as the form. Reuse date/time and quick-duration primitives rather than duplicating timestamp conversion in the screen.

- [ ] **Step 3: Run the full suite and physical-device pass.**

On the signed iPhone build, add two earlier activities, edit one across a local-midnight boundary, delete one, verify calendar/Day/Week/Cycle totals, and confirm future dates stay unavailable.

- [ ] **Step 4: Update M7 documentation and commit.**

```bash
npx jest --runInBand
npx tsc --noEmit
npx expo-doctor
git add "app/(tabs)" src __tests__ docs progress
git commit -m "feat: correct activities from day history"
```

## Phase 7 — Editable active-cycle membership

> This phase allows the practice set to evolve without rewriting the past. Membership changes are forward-only local-date events: a newly added practice becomes available today, and a stopped practice disappears from current logging today while remaining visible wherever it historically participated.

### Task 19: Add dated goal-membership boundaries

**Files:**
- Modify: `src/db/schema.ts` (add `SCHEMA_V5`)
- Modify: `src/db/migrations.ts`
- Modify: `src/features/cycles/domain/types.ts`
- Modify: `src/features/cycles/data/cycleRepository.ts`
- Modify: `src/features/goals/data/goalRepository.ts`
- Modify: `src/features/logging/data/sessionRepository.ts`
- Modify: `src/features/cycles/domain/cycleProgress.ts`
- Modify: `src/features/cycles/domain/cycleSummary.ts`
- Modify: `src/features/cycles/domain/historyInsights.ts`
- Modify: `src/test/factories.ts`
- Test: `__tests__/db/migrations.test.ts`
- Test: `__tests__/data/cycleRepository.test.ts`
- Test: `__tests__/data/goalRepository.test.ts`
- Test: `__tests__/data/sessionRepository.test.ts`
- Test: `__tests__/domain/cycleProgress.test.ts`
- Test: `__tests__/domain/historyInsights.test.ts`

**Behavior:**

- Add `activeFromDate` (inclusive) and `inactiveFromDate` (exclusive) to `CycleGoal`. Migration V5 backfills every existing goal's start boundary from its cycle start and leaves its end boundary open.
- Add repository operations to create an active-cycle goal effective today and to stop tracking one effective today. The stop operation transactionally prevents retiring the final active goal. Never physically delete a cycle goal with historical meaning.
- A goal is available for a new log only when active on the requested local date. Sessions already recorded before a same-day stop are grandfathered: they remain visible and may be corrected in place, but no new session can be added to that stopped goal. Day history includes goals active that day plus any effective sessions that remain for that day.
- Boundary-week semantics are explicit: a goal contributes to target-achievement/consistency denominators only when it is active for every in-cycle day of that calendar week. A partial membership week still shows raw sessions and minutes but is labelled **Partial week** rather than met/missed.
- Goal configuration revisions must fall inside the goal's membership window. Existing revisions and logs before an inactive boundary remain valid.

- [ ] **Step 1: Write failing migration, membership, and boundary-week tests.**

Cover existing-row backfill, new-cycle inserts, stable goal ordering, add today, stop today, final-active-goal protection, inactive-date logging/correction rejection, historical visibility, revision bounds, partial first/last membership weeks, and day/week/cycle summaries.

- [ ] **Step 2: Implement membership-aware repositories and pure selectors.**

Centralize `isGoalActiveOn` and membership-window helpers. Do not scatter string-date comparisons through screens.

- [ ] **Step 3: Run focused persistence/domain checks and commit.**

```bash
npx jest __tests__/db/migrations.test.ts __tests__/data/cycleRepository.test.ts __tests__/data/goalRepository.test.ts __tests__/data/sessionRepository.test.ts __tests__/domain/cycleProgress.test.ts __tests__/domain/historyInsights.test.ts --runInBand
npx tsc --noEmit
git add src/db src/features __tests__
git commit -m "feat: add dated practice membership"
```

### Task 20: Add a practice during an active cycle

**Files:**
- Create: `app/cycles/[cycleId]/add-goal.tsx`
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/settings/index.tsx`
- Modify: `src/features/goals/components/GoalEditor.tsx`
- Modify: `src/features/goals/components/GoalTemplateList.tsx`
- Test: `__tests__/components/addGoalMembership.test.tsx`
- Test: `__tests__/components/tabShell.test.tsx`

**Behavior:**

- Settings shows **Add practice** for an active cycle. It opens a focused modal using the existing template/custom-goal configuration controls.
- Review copy names the effective date and explains that earlier cycle days will not include the practice. Saving creates one goal snapshot with `activeFromDate=today`, closes the modal, and refreshes Home, History, and Settings.
- Validation matches setup: non-empty name, supported cadence, positive target, and optional positive duration. Duplicate names are allowed but the review must make them unambiguous.

- [ ] **Step 1: Write failing navigation, validation, and successful-add tests.**
- [ ] **Step 2: Reuse the setup/editor primitives in an add-goal modal.**
- [ ] **Step 3: Verify refresh behavior and commit.**

```bash
npx jest __tests__/components/addGoalMembership.test.tsx __tests__/components/tabShell.test.tsx --runInBand
npx tsc --noEmit
git add app src/features/goals __tests__/components
git commit -m "feat: add practices to active cycles"
```

### Task 21: Stop tracking a practice without erasing history

**Files:**
- Modify: `app/cycles/[cycleId]/edit-goal/[goalId].tsx`
- Test: `__tests__/components/stopGoalMembership.test.tsx`

**Behavior:**

- An active goal editor exposes **Stop tracking this practice** with confirmation that names today's effective date and states that earlier logs remain.
- After confirmation the practice disappears from current Home logging and the active Settings list. History before the boundary still renders its original configuration and sessions; the current boundary week is visibly partial.
- If stopping the last active practice, require adding another practice first or ending the cycle. This prevents an active cycle with no loggable goals.
- Re-adding a stopped concept creates a new goal identity; restoration/reactivation is intentionally deferred.

- [ ] **Step 1: Write failing stop/cancel/last-goal guard tests.**
- [ ] **Step 2: Implement the confirmation and focus refresh paths.**
- [ ] **Step 3: Run focused tests and commit.**

```bash
npx jest __tests__/components/stopGoalMembership.test.tsx --runInBand
npx tsc --noEmit
git add app src/features __tests__/components
git commit -m "feat: stop tracking active-cycle practices"
```

### Task 22: Validate editable membership and document the rules

**Files:**
- Modify: `src/features/cycles/hooks/useCycleLanding.ts`
- Modify: `src/features/cycles/hooks/useCycleHistory.ts`
- Test: `__tests__/components/goalMembership.integration.test.tsx`
- Modify: `docs/project-overview.md`
- Modify: `docs/release-checklist.md`
- Modify: `progress/YYYY-MM-DD.md`

- [ ] **Step 1: Run the full automated suite and Expo Doctor.**
- [ ] **Step 2: On device, add a goal, log it, stop another goal, and inspect dates on both sides of each boundary.**
- [ ] **Step 3: Document membership and partial-week semantics, mark M8 done, and commit.**

## Phase 8 — Useful active-cycle dashboard

> This phase changes Home from a collection of progress widgets into a concise answer to two questions: **What remains this week?** and **What has my recent rhythm looked like?** It stays descriptive and calm—no scores, shame language, coaching, or stored aggregate state.

### Task 23: Define one pure Home-dashboard summary

**Files:**
- Create: `src/features/cycles/domain/homeDashboard.ts`
- Modify: `src/features/cycles/hooks/useCycleLanding.ts`
- Test: `__tests__/domain/homeDashboard.test.ts`
- Test: `__tests__/components/cycleLandingHook.test.tsx`

**Behavior:**

- Build a single selector returning the current calendar-week bounds, days remaining in that week/cycle overlap, sessions and minutes logged, target and remaining sessions/minutes, previous-week session delta, and seven recent day buckets.
- Return per-practice session/minute progress, remaining amounts, met/in-progress/partial-week state, current streak, and today's effective sessions. Respect configuration revisions, membership boundaries, edited sessions, early cycle completion, and over-target caps. Partial-membership goals contribute raw work but not remaining-target totals until their next complete eligible week.
- Targets remain count-based; planned minutes equal the effective expected duration multiplied by the applicable session target. Missing duration targets never become zero-minute goals.
- Derive everything from source records. Do not add a dashboard cache or persistence table.

- [ ] **Step 1: Write deterministic selector tests for ordinary, empty, over-target, revised, added/stopped, and partial-week cases.**
- [ ] **Step 2: Implement and freeze the selector/type contract on its own branch.**
- [ ] **Step 3: In a short adapter commit after M8 integration, simplify `useCycleLanding` around the selector.**
- [ ] **Step 4: Run domain/hook tests and commit.**

### Task 24: Redesign Home around weekly remaining effort and recent rhythm

**Files:**
- Create: `src/features/cycles/components/WeekAtGlanceCard.tsx`
- Create: `src/features/cycles/components/RecentRhythm.tsx`
- Modify: `src/features/cycles/components/GoalRow.tsx`
- Modify: `src/features/cycles/components/CycleHeader.tsx`
- Modify: `app/(tabs)/index.tsx`
- Test: `__tests__/components/cycleLanding.test.tsx`
- Test: `__tests__/components/homeDashboard.test.tsx`

**Behavior:**

- The first useful block after the cycle title is **This week**: completed/target sessions, logged/planned minutes when applicable, sessions and minutes remaining, and calendar days left. Over-target work remains in raw totals while completion bars cap at 100%.
- A compact seven-day rhythm shows sessions per day and a neutral comparison with the preceding week. It must remain understandable without color.
- Practice rows keep stable user order and one-tap logging, but replace vague labels with explicit remaining language such as `2 of 3 sessions · 1 remaining`; partial-week membership is labelled rather than scored.
- Keep the cycle contribution calendar as secondary cycle context below the actionable weekly information. Preserve the under-five-second quick-log path and its undo confirmation.
- Loading, empty, completed, error, Dynamic Type, VoiceOver, reduced-motion, and small-screen layouts receive explicit coverage.

- [ ] **Step 1: Write the screen contract and accessibility tests before changing layout.**
- [ ] **Step 2: Implement the new hierarchy using Porcelain & Ink primitives.**
- [ ] **Step 3: Verify quick logging refreshes every dashboard value once and commit.**

### Task 25: Validate dashboard usefulness and finish M9

**Files:**
- Modify: `docs/project-overview.md`
- Modify: `docs/release-checklist.md`
- Modify: `progress/YYYY-MM-DD.md`

- [ ] **Step 1: Run the complete automated suite, TypeScript, and Expo Doctor.**
- [ ] **Step 2: Populate sparse, in-progress, target-met, over-target, and partial-membership states on device and visually verify hierarchy at default and large Dynamic Type.**
- [ ] **Step 3: Confirm a user can state sessions remaining, minutes remaining, and recent rhythm from Home without opening History; record the result and mark M9 done.**

## Phase 9 — Cross-cycle archive and repeat-cycle flow

> This phase turns completed cycles into a usable personal record. History can select any cycle without changing the active cycle, and a completed cycle can seed—but never silently create—the next setup flow.

### Task 26: Add cycle archive queries and compact summaries

**Files:**
- Modify: `src/features/cycles/data/cycleRepository.ts`
- Create: `src/features/cycles/domain/cycleArchive.ts`
- Modify: `src/features/cycles/hooks/useCycleHistory.ts`
- Test: `__tests__/data/cycleRepository.test.ts`
- Test: `__tests__/domain/cycleArchive.test.ts`

**Behavior:**

- Add `getCycleById` and `listCycles`, ordered active first and then by most recent start/creation date. Return all statuses without changing the single-active-cycle invariant.
- Build compact archive summaries with dates, status, practice count, session count, logged minutes, active-day count/ratio, and final active practice names. Use effective sessions and membership/configuration on each cycle's relevant dates.
- Keep archive summaries pure and computed on demand; do not introduce stored aggregates or pagination until real data volume requires it.

- [ ] **Step 1: Write repository ordering and archive-summary tests.**
- [ ] **Step 2: Implement the query/selector contract and selected-cycle hook state.**
- [ ] **Step 3: Run focused tests and commit.**

### Task 27: Browse every cycle from History

**Files:**
- Create: `src/features/cycles/components/CycleArchiveSheet.tsx`
- Modify: `app/(tabs)/history.tsx`
- Modify: `src/features/cycles/hooks/useCycleHistory.ts`
- Test: `__tests__/components/cycleHistory.test.tsx`
- Test: `__tests__/components/cycleArchive.test.tsx`

**Behavior:**

- History's header identifies the selected cycle and opens an archive selector containing the active, completed, and early-ended cycles with compact summaries.
- The `cycleId` route parameter is the selected-cycle source of truth. Day/Week/Cycle bounds, calendars, summaries, and activity edits all switch together; returning from another tab preserves a valid selection.
- Archived cycles are fully reviewable. M7 correction tools remain available inside their elapsed date bounds, but active-cycle membership controls stay in Settings and never appear in archived History.
- Empty, single-cycle, deleted/invalid parameter, and very long archive states have explicit behavior.

- [ ] **Step 1: Write failing selection, route, focus-refresh, and boundary tests.**
- [ ] **Step 2: Build the archive selector and route-driven History state.**
- [ ] **Step 3: Verify switching cycles never changes the active cycle and commit.**

### Task 28: Duplicate a cycle into editable setup

**Files:**
- Modify: `src/features/cycles/hooks/useCycleSetupState.tsx`
- Create: `src/features/cycles/domain/repeatCycleDraft.ts`
- Modify: `app/setup/duration.tsx`
- Modify: `app/setup/practices.tsx`
- Modify: `app/setup/review.tsx`
- Test: `__tests__/components/cycleSetupNavigation.test.tsx`
- Test: `__tests__/domain/repeatCycleDraft.test.ts`

**Behavior:**

- Completed and early-ended cycle summaries expose **Repeat cycle**. It opens the ordinary setup modal with the source duration and the final effective configuration of practices active on the source cycle's last date.
- Duplication is a prefill, not a write. The person can rename the cycle, change duration, and add/remove/edit practices before pressing **Start cycle**.
- Starting creates fresh cycle/goal ids and copies no sessions, membership boundaries, goal revisions, reminder settings, or archive metadata. Cancelling leaves the database untouched.
- If an active cycle already exists, **Repeat cycle** may prepare the setup state but cannot start until the active cycle ends; the UI explains the conflict before the final commit action.

- [ ] **Step 1: Write failing prefill, edit, cancel, new-identity, and active-cycle-guard tests.**
- [ ] **Step 2: Add source-cycle prefill to the existing setup provider without forking the wizard.**
- [ ] **Step 3: Expose a reusable repeat action contract; Task 27's History owner performs the final button wiring after both branches merge.**
- [ ] **Step 4: Run setup/domain tests and commit.**

### Task 29: Validate the archive/repeat flow and finish M10

**Files:**
- Modify: `docs/project-overview.md`
- Modify: `docs/release-checklist.md`
- Modify: `progress/YYYY-MM-DD.md`

- [ ] **Step 1: Run the full automated suite, TypeScript, and Expo Doctor.**
- [ ] **Step 2: On device, create at least three cycles across all statuses, switch among them, correct an archived session, and repeat a completed cycle with edited practices.**
- [ ] **Step 3: Confirm archive selection survives tab changes and app restart, record results, and mark M10 done.**

## Verification matrix

| Requirement | Verification |
| --- | --- |
| 30/60/90-day constraints | Domain test rejects other durations; setup UI exposes only the three values |
| Forward-only goal membership | Migration/repository tests backfill membership dates, allow add/stop from today, reject out-of-window logging, and preserve earlier dates |
| Forward-only goal configuration | Goal revision tests preserve earlier configuration and enforce the goal's membership window |
| Fast direct logging | Sheet test saves a selected duration in one repository write |
| Active-cycle context | Landing test renders `Day X / duration`, calendar cells, and all goals |
| Actual session times | Migration test backfills `startedAt`; repository test persists one current instant as both the session's local date and actual start time |
| Historical activity correction | Repository tests resolve append-only revisions/tombstones; screen tests cover bounded add/edit/delete; every summary receives only effective sessions |
| Calendar day progress | Home and History calendar tests navigate a past/current day into History Day; selector tests assert chronological rows; pager tests enforce cycle-date bounds |
| Useful Home dashboard | Pure-selector tests cover remaining sessions/minutes, recent rhythm, over-target caps, revisions, and partial membership; screen tests preserve fast logging and accessibility |
| Cross-cycle archive | Repository and screen tests cover cycle ordering/selection, per-cycle bounds, archived corrections, and repeat-cycle prefill with fresh identities |
| Local-only persistence | Repository integration test survives reinitialization without a network dependency |
| Reminder is optional | Permission-denied test keeps tracking usable |
| Glass fallback | `GlassSurface` test renders an ordinary surface when unavailable |
| Persistent navigation | Tab-shell test asserts Home, History, and Settings are present with and without an active cycle |
| Back-navigable modals | Navigation test confirms wizard/edit-goal state survives a back step and native back dismisses correctly |
| Cycle completion | Repository test asserts an active cycle past its end date reads as completed and no longer blocks creating a new one |
| Consistent week definition | `cycleSummary.ts`'s week selector reuses `weekStart` from `date.ts`; no second week-boundary implementation exists |

## Deferred follow-up plan

Create a separate plan only after M10 is stable for any of these independent additions:

- iCloud or account-backed sync
- Home Screen widget
- Apple Health integration
- Android/web support
- Per-practice notifications
- Session notes or attachments
- Reactivating a stopped practice as the same goal identity
- Pause/extend-cycle controls or cycle lengths outside 30/60/90 days
- Side-by-side cycle comparison charts
- Data export/import and encrypted backup
- TestFlight/App Store distribution (requires enrolling in the paid Apple Developer Program)
