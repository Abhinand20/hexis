# Cloud handoff: M13 correctness and reliability

**Cloud branch:** `codex/cloud-m13-correctness`  
**Base:** `<pushed-G1-SHA>`  
**Runs with:** `codex/cloud-m12-recovery-core`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** implementation and automated evidence complete; lifecycle/timezone/reminder device checks pending.

## Objective

Implement M13.1–M13.5 in code and automated tests: one historical evaluator, mutation-time guards, precise activity corrections, screen/day freshness, failure handling, and reminder reconciliation.

## Own

- Cycle-domain evaluators and in-app consumer adapters.
- Goal/session repositories, relevant mutation hooks/editors, cycle refresh hooks, Home/History/Settings screens, and reminder service.
- Focused domain/data/component/reminder tests and cloud evidence.

Do not edit M12 archive/export modules, root recovery boundary, schema/migrations without reassignment, Release configuration, or top-level milestone/status docs. Preserve fixes already present in the pushed base.

## Deliver

- [ ] One Monday–Sunday practice-week evaluator implementing the authority's eligibility, changed-week, label, denominator, and streak rules.
- [ ] Required 3 × 60 to 2 × 45 Wednesday fixture across Home, Week, Cycle, archive adapter, and export-facing pure output.
- [ ] Active/today/membership/bounds revalidation at mutation time, including forms spanning midnight.
- [ ] Non-time activity edits that preserve reporting date and exact UTC instant/precision.
- [ ] DST gap/fold, leap day, travel, legacy unknown-zone, and explicit time-edit tests.
- [ ] Focus/foreground/day-rollover refresh while preserving intentional History selection.
- [ ] Pending guards, input preservation, retryable errors, and duplicate-tap coverage.
- [ ] Reminder permission/preference/schedule reconciliation and rapid-change orphan prevention.
- [ ] Exact local checklist for real foreground, midnight, timezone, reminder, keyboard, and target-change checks.

If persisted timezone metadata is essential, do not allocate a migration. Return the smallest proposed schema/archive contract to the integration owner and continue all schema-independent work.

## Verify

```bash
npx jest --runInBand __tests__/domain __tests__/data __tests__/reminders
npx jest --runInBand __tests__/components
npm run typecheck
```

End with the standard cloud result format. Do not mark M13 accepted.

