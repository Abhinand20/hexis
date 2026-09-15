> **Document status:** never executed as this cloud handoff (dispatch fields still placeholders). CSV export was never built; SQLite backup/restore later shipped under a different plan. Retained as historical context.

# Cloud handoff: M12 recovery core

**Cloud branch:** `codex/cloud-m12-recovery-core`  
**Base:** `<pushed-G1-SHA>`  
**Runs with:** `codex/cloud-m13-correctness`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** archive/restore implementation and automated evidence complete; native Files and promotion checks pending.

## Objective

Implement M12's machine archive, readable CSV, bounded candidate validation, replace-only restore state machine, and append-only deleted-activity restoration using the M11 interfaces. Native filesystem operations must be isolated behind adapters and tested with fault injection.

## Own

- New `src/features/data-recovery/` domain/data/manifest/validation/export/promotion/hooks/components.
- A dedicated recovery route that does not edit shared tab/root shells.
- Recovery-specific deleted-activity restoration API/component.
- Recovery/archive/CSV/promotion tests and fixtures.
- Data-format and recovery-protocol documentation drafts.

Do not edit M13 evaluator files, shared Home/Settings/root wiring, schema/migrations without reassignment, Release config, or top-level milestone/status docs.

## Deliver

- [ ] One versioned manifest plus consistent SQLite payload contract and bounded size/checksum/count validation.
- [ ] Complete raw-table inventory for the G1 schema and readable effective CSV with safe quoting/formula handling.
- [ ] Candidate staging and structural/business/integrity/reference/order validation.
- [ ] Preview/confirm/cancel replace-only state machine.
- [ ] Quiesce/protect/promote/reopen protocol expressed through injected filesystem/database adapters.
- [ ] Fault-injection tests at every promotion state; prior or new complete database is selected, never a mixture.
- [ ] Append-only deleted-session restoration with later unrelated facts preserved.
- [ ] Expired-active-cycle, reminder-ID reset, repeated restore, invalid/oversized/truncated input, cancellation, and full raw round-trip fixtures.
- [ ] Exact local checklist for Files/share, open-WAL snapshot, handle closing, interruption, unavailable cloud file, and clean-install restore.

## Intersection

Expose a narrow pure evaluator input for readable exports. Do not duplicate M13 historical calculations. The integration owner connects the final M13 evaluator after both cloud diffs are reviewed.

## Verify

```bash
npx jest --runInBand __tests__/db __tests__/data
npx jest --runInBand __tests__/components/activityHistoryIntegration.test.tsx
npm run typecheck
```

Run all new recovery suites explicitly. End with the standard cloud result format. Do not mark M12 accepted.

