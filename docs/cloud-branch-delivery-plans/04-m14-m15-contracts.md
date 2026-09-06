# Cloud handoff: shared M14/M15 persistence contracts

**Cloud branch:** `codex/cloud-m14-m15-contracts`  
**Base:** `<pushed-G2-SHA>`  
**Start mode:** serial; no M14/M15 feature task starts before this diff is merged and pushed  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** shared schema/archive contract ready for integration review.

## Objective

Create the G3 persistence contract that lets flexible cycles and measurements be implemented in parallel without competing migration numbers or archive definitions.

## Own

- `src/db/schema.ts`, `src/db/migrations.ts`, shared persistence types, and migration fixtures.
- M12 raw-table inventory, archive validation, data dictionary, and round-trip fixture updates for the new tables.
- Only the shared interfaces needed by the two later feature tasks.

Do not implement feature screens, repository behavior beyond contract helpers, shared Home/Settings/root wiring, device checks, or milestone/status changes.

## Deliver

- [ ] Allocate the next two migration versions from the actual G2 schema; never assume V7 or rewrite V1–V6.
- [ ] Add initial cycle plan, ordered dated full plan snapshots, and actual closure representation with safe legacy migration.
- [ ] Remove preset-only storage constraints safely while preserving IDs, foreign keys, dependent rows, indexes, and one-active-cycle enforcement.
- [ ] Add closed-set measurement daily identity, ordered revisions, canonical/original values and units, visibility, and unit preferences.
- [ ] Update archive inventory/validation/dictionary for every new raw table and preference.
- [ ] Add active/completed/early-ended legacy fixtures and measurement old/new raw round trips.
- [ ] Freeze repository-facing types and callback interfaces for M14/M15 tasks.
- [ ] Document unresolved native SQLite assumptions for local verification.

## Verify

```bash
npx jest --runInBand __tests__/db
npx jest --runInBand __tests__/data
npm run typecheck
```

Run all archive/round-trip fixtures added by M12. End with the standard cloud result format and the exact proposed G3 commit order. Do not mark M14 or M15 started/accepted.

