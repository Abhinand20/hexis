# Branch handoff: M16 years-scale verification

**Branch:** `codex/m16-years-scale`  
**Task:** M16.4 and its focused portion of M16.5  
**Start gate:** G4  
**Runs with:** `codex/m16-accessibility` and `codex/m16-device-handoff`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** create a deterministic ten-year fixture, measure the integrated Release app, and make only evidence-justified query/index improvements.

## Dispatch fields

- Dependency commit: `<G4-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Reference iPhone/iOS: `<model-and-version-or-unavailable>`
- Assigned next migration version, if needed: `<none-or-version>`

Read M16.4 performance budgets, migration policy, years-history acceptance row, and device-evidence rules.

## Owned files

- Deterministic fixture/seed tooling and focused tests under an appropriate test/dev-only path.
- Data-loading/query/pagination/index changes proven necessary by measurements.
- Long-history calculation/query-bound tests.
- `docs/acceptance/m16-years-scale.md` with fixture definition and measurements.

Do not edit accessibility styling, backup semantics, build/signing config, or top-level status docs. Feature UI is also out of scope except for a narrowly approved visible-progress or pagination adapter. Do not add caches as new authoritative facts.

Schema/migration files remain integration-owned unless measurements justify an index and the integrator assigns the exact next migration version exclusively to this branch. Never rewrite an earlier migration.

## Required fixture

Use a reproducible seed representing roughly ten years with at least:

- 120 cycles across completed and ended-early states;
- 50,000 source sessions;
- session corrections and tombstones;
- practice membership and target/cadence/configuration changes;
- cycle plan revisions and long/custom cycles; and
- both daily measurement kinds, gaps, corrections, deletions, restores, units, and preferences.

The fixture must remain disposable, deterministic, and safe to rebuild. It must not use private personal data or production-only reset controls.

## Work checklist

- [ ] Build and verify the deterministic fixture with known counts/invariants.
- [ ] Add correctness assertions for representative summaries before measuring speed.
- [ ] Measure warm log-save acknowledgement, cold usable Home, selected History, and selected Measurements in Release.
- [ ] Record a small repeated sample plus worst result, not one favorable run.
- [ ] Profile the current all-cycle archive loading and other outliers.
- [ ] Add bounded selected-cycle queries, pagination, or indexes only where evidence shows need.
- [ ] Keep any cache rebuildable and non-authoritative; prefer direct bounded queries.
- [ ] Rerun correctness, archive/restore, and performance after each optimization.
- [ ] Document device/build/fixture, measurement method, raw samples, worst result, and any justified budget exception.

## Starting budgets

- Warm log save acknowledgement: within 1 second.
- Usable cold Home: within 3 seconds.
- Selected History and Measurements: within 2 seconds.
- Longer backup/restore work: visible progress; no invented exact duration promise.

A material relaxation requires explicit rationale and owner acceptance; do not shrink the fixture or omit audit history to pass.

## Automated checks

Run fixture invariants, long-history domain/query tests, affected data suites, full archive/migration round trips if indexes change, then:

```bash
npx jest --runInBand
npm run typecheck
```

## Physical checks

Measure a Release build on the supported iPhone with the deterministic fixture. State whether timings are cold/warm, how many samples were taken, and what event defines completion. Simulator/host timings may aid diagnosis but are not device acceptance.

## Stop and escalate

Stop for: an unassigned migration, denormalized authoritative scores, dropping revisions/tombstones, smaller-than-required fixtures, broad UI rewrites, or hidden relaxation of budgets.

## Handoff requirements

Provide commits, fixture invocation and invariants, raw timing samples, profiles/bottlenecks, optimizations and rationale, test results, archive/migration impact, and pending device measurements. Do not mark M16 accepted.
