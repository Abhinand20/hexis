> **Document status:** never executed as this cloud handoff (dispatch fields still placeholders). Retained as historical context.

# Cloud handoff: M16 documentation and acceptance audit

**Cloud branch:** `codex/cloud-m16-docs-audit`  
**Base:** `<pushed-G4-SHA>`  
**Runs with:** `codex/cloud-m16-accessibility-code` and `codex/cloud-m16-scale-harness`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** documentation drafts and consistency audit complete; native evidence and final acceptance decision pending.

## Objective

Prepare M16.6 documentation from the integrated implementation, identify contradictions or missing operational detail, and create evidence placeholders without inventing physical results.

## Own

- Draft data/backup format reference, recovery/migration protocol, maintenance guide, Release/renewal runbook, dependency policy, and known-limit documentation.
- A proposed reconciliation patch or precise recommendations for `docs/project-overview.md`, `docs/milestones.md`, and `docs/release-checklist.md`.
- An acceptance matrix populated with automated evidence and explicit native placeholders.

The integration owner retains final status ownership. Do not mark milestone boxes accepted, fabricate device metadata, modify product code, or change requirements to match implementation gaps.

## Deliver

- [ ] Document actual schema/migrations, archive compatibility, recovery protocol, date/target rules, measurement precision, and failure semantics from code/tests.
- [ ] Draft free-Apple-ID Release and same-identity renewal steps with all Xcode/device commands clearly marked `local verification required` until proven.
- [ ] Explain weekly external-backup exposure, local snapshot limits, sensitive export destinations, and destructive reinstall separation.
- [ ] Reconcile duration-only, Week-tab, forward-only, distribution, and completion-status claims.
- [ ] Map each authority section 8 row to automated evidence, local procedure, and empty result field.
- [ ] Map each section 10 item to implemented evidence, local pending evidence, or a concrete product blocker.
- [ ] List exact post-cloud documentation edits needed after accessibility, performance, and device results land.

## Verify

```bash
npm run typecheck
npx jest --runInBand
```

Also validate local Markdown links and inspect the final diff for unsupported acceptance language. End with the standard cloud result format. Do not declare “Hexis is finished.”

