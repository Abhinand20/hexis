# Cloud handoff: M16 years-scale harness

**Cloud branch:** `codex/cloud-m16-scale-harness`  
**Base:** `<pushed-G4-SHA>`  
**Runs with:** `codex/cloud-m16-accessibility-code` and `codex/cloud-m16-docs-audit`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** deterministic fixture, correctness/query work, and host measurements complete; iPhone Release timings pending.

## Objective

Implement M16.4's reproducible ten-year fixture and bounded-query verification. Use cloud/host metrics to find obvious problems, but reserve the actual performance budgets for the reference iPhone Release build.

## Own

- Test/dev-only deterministic seed tooling.
- Long-history correctness and query-bound tests.
- Data query/pagination/index work justified by collected evidence.
- Cloud measurement report and exact iPhone measurement procedure.

Do not edit feature presentation except an approved progress/pagination adapter, accessibility code, backup semantics, signing config, or milestone/status docs. Do not allocate a migration unless the integration owner assigns the exact version after reviewing evidence.

## Deliver

- [ ] Deterministic fixture with at least 120 cycles, 50,000 source sessions, corrections/tombstones, membership/config changes, plan revisions, long cycles, and both measurement kinds with audit history.
- [ ] Known count/invariant and representative-summary assertions.
- [ ] Repeated cloud/host timings for relevant repository/domain operations, clearly labeled non-device evidence.
- [ ] Profile of all-cycle archive loading and other outliers.
- [ ] Bounded queries, pagination, or assigned index migration only where evidence justifies them.
- [ ] Full correctness/archive/migration regression after optimization.
- [ ] Exact Release-device protocol for warm save, cold Home, selected History, and selected Measurements, including event definitions and sample count.

## Verify

```bash
npx jest --runInBand
npm run typecheck
```

Do not shrink the fixture, drop audit facts, or relax budgets. End with the standard cloud result format. Do not mark M16.4 or M16 accepted.

