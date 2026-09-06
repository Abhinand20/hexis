# Cloud handoff: M11 startup core

**Cloud branch:** `codex/cloud-m11-startup-core`  
**Base:** `<pushed-C0-SHA>`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** implementation and automated evidence complete; native recovery checks pending.

## Objective

Implement M11.1, M11.3, M11.4, the platform-neutral parts of M11.2, and repository evidence from M11.6. Startup must expose actionable states, refuse future schemas before writes, preserve recoverability around migration failures, and coordinate overlapping writes.

## Own

- `src/db/client.ts`, `DatabaseProvider.tsx`, `schema.ts`, and `migrations.ts` for M11 changes only.
- New database startup-state, write-coordinator, snapshot contract, and recovery-state modules.
- `app/_layout.tsx` and focused recovery presentation needed for automated tests.
- `__tests__/db/*`, focused provider/component tests, and cloud evidence for M11.

Do not implement archive format/UI, Files/share behavior, Release signing, iPhone checks, or feature work. Do not claim native snapshot/promotion behavior from mocks.

## Deliver

- [ ] Explicit `opening`, `ready`, `recoverable-error`, and `incompatible-data` provider states.
- [ ] Future `user_version` guard before normal writes.
- [ ] Per-migration failure/retry handling without rewriting released migrations.
- [ ] Protected-copy/snapshot interface with deterministic retention and injected-failure behavior.
- [ ] Scoped write coordination and overlap/idempotency tests.
- [ ] Fresh plus populated V1–V6 fixtures, future schema, open failure, retry, bad constraints, snapshot failure, and concurrency coverage.
- [ ] A local follow-up checklist for native SQLite/file interruption tests.

## Verify

```bash
npx jest --runInBand __tests__/db
npx jest --runInBand __tests__/components/app.test.tsx
npm run typecheck
```

Report all new suites. End with the standard cloud result format. Do not mark M11 accepted.

