# Hexis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first iPhone app that helps a person complete a small group of practices during a 30-, 60-, or 90-day focus cycle.

**Architecture:** Expo Router owns navigation and screen composition. SQLite is the source of truth behind repositories for cycles, cycle-goal revisions, and immutable session logs. Pure domain functions calculate local-day boundaries, weekly progress, streaks, and calendar intensity from those records; screens consume those functions through feature hooks.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, `expo-sqlite`, `expo-notifications`, `expo-glass-effect`, Jest, `jest-expo`, and React Native Testing Library.

## Global constraints

- iPhone-first; iOS 26+ is the visual target.
- A cycle lasts 30 days by default; valid lengths are exactly 30, 60, or 90.
- The selected practice group cannot change during an active cycle in v1.
- Existing practices may receive forward-only configuration revisions; earlier logs retain their historical configuration.
- A session log is immutable once saved; corrections create an edit record only when that capability is intentionally added.
- Logging is direct and duration-based; there is no in-app timer.
- There is one optional app-level daily reminder, not per-practice notifications.
- Use Porcelain & Ink tokens and one muted verdigris accent; do not use gradients or glass as the default content background.
- `expo-glass-effect` must always have a functional non-glass fallback.
- No auth, sync, widgets, HealthKit, payments, social features, or AI behavior in v1.
- Navigation is a persistent bottom tab bar (Home, History, Settings), always visible. Cycle setup and goal editing are full-screen modals with the tab bar hidden, not tabs of their own. Every stack screen — modal steps included — supports the native header back button and iOS edge-swipe-back gesture.
- A "week" means the same thing everywhere in the app: a calendar week (Monday–Sunday). Do not introduce a second, cycle-relative definition.
- History is scoped to the current cycle (active or just completed) only in v1; browsing multiple past cycles is deferred.

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
- Test: `__tests__/data/cycleRepository.test.ts`

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

- Tapping **Log** opens an elevated sheet.
- Quick duration choices are 15, 30, 45, 60, and 90 minutes.
- The goal’s expected duration is selected initially when it matches an available choice.
- Count-only practices allow saving with no duration.
- Saving creates exactly one immutable `SessionLog`, refreshes landing data, and closes the sheet.

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

- [ ] **Step 2: Implement one submission path.**

Disable Save while the repository call is pending. On failure, preserve the selected duration and show a retryable inline error. On success, invalidate active-cycle query state before dismissing the sheet.

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

## Verification matrix

| Requirement | Verification |
| --- | --- |
| 30/60/90-day constraints | Domain test rejects other durations; setup UI exposes only the three values |
| Fixed active-cycle membership | Repository exports no active-cycle add/remove methods; route tests show no such action |
| Forward-only edits | Goal revision test preserves earlier logs and uses today as effective date |
| Fast direct logging | Sheet test saves a selected duration in one repository write |
| Active-cycle context | Landing test renders `Day X / duration`, calendar cells, and all goals |
| Accessible calendar | Component test asserts descriptive accessibility labels for every cell |
| Local-only persistence | Repository integration test survives reinitialization without a network dependency |
| Reminder is optional | Permission-denied test keeps tracking usable |
| Glass fallback | `GlassSurface` test renders an ordinary surface when unavailable |
| Persistent navigation | Tab-shell test asserts Home, History, and Settings are present with and without an active cycle |
| Back-navigable modals | Navigation test confirms wizard/edit-goal state survives a back step and native back dismisses correctly |
| Cycle completion | Repository test asserts an active cycle past its end date reads as completed and no longer blocks creating a new one |
| Consistent week definition | `cycleSummary.ts`'s week selector reuses `weekStart` from `date.ts`; no second week-boundary implementation exists |

## Deferred follow-up plan

Create a separate plan only after version one is stable for any of these independent additions:

- iCloud or account-backed sync
- Home Screen widget
- Apple Health integration
- Goal membership changes in an active cycle
- Android/web support
- Per-practice notifications
- Cross-cycle history browsing (v1 keeps History scoped to the current cycle only)
- TestFlight/App Store distribution (requires enrolling in the paid Apple Developer Program)

