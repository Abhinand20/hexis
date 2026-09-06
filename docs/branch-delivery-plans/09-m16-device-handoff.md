# Branch handoff: M16 Release, recovery drills, and maintenance handoff

**Branch:** `codex/m16-device-handoff`  
**Tasks:** M16.1, M16.2, M16.5, and M16.6 artifacts; final pass occurs after all M16 branches merge  
**Start gate:** G4  
**Runs with:** `codex/m16-accessibility` and `codex/m16-years-scale`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** make Release build/renewal, backup/recovery, and routine maintenance reproducible, and collect truthful device evidence for final integration.

## Dispatch fields

- Dependency commit: `<G4-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Reference iPhone/iOS: `<model-and-version>`
- Signing team/profile expiry: `<details>`
- Disposable fixture/backup: `<identifier-and-location-class>`

Read the accepted maintenance boundary, M16.1–M16.2/M16.5–M16.6, section 8 matrix, section 10 objective, and platform-reference cautions.

## Owned files

- Narrow Release/build config or scripts proven necessary by the installed toolchain.
- `docs/release-build-and-renewal.md` updates from the M11 proof.
- New maintenance guide, device/recovery acceptance record, and any missing operational/data-documentation drafts.
- Branch-owned evidence files under `docs/acceptance/`.

Do not edit product/domain/repository/UI code, schema/migrations, performance fixture, accessibility evidence, or integration-owned `docs/project-overview.md`, `docs/milestones.md`, and `docs/release-checklist.md`. Report product defects to the integrator with reproduction steps.

## Required operational contract

- Free Apple ID and seven-day renewal are accepted; no paid membership, TestFlight, or App Store dependency.
- Use standalone Release, not Debug/Metro.
- Routine renewal installs over the existing app with the same bundle identifier/signing identity. It does not delete the app.
- Back up externally before renewal/upgrades/planned deletion. A local snapshot or dismissed share sheet is not proven off-device protection.
- Deletion/reinstall is a separate destructive drill using only disposable data and a verified external archive.
- Do not change the phone clock to imitate profile expiration. A real expiry result may remain pending.

## Work checklist

- [ ] Reinspect installed Node/npm/Expo/Xcode/iOS toolchain and finalize the exact Release command.
- [ ] Record lockfile/config/plugins, bundle identity, signing/profile, app/build versions, and Release-vs-Debug distinction.
- [ ] Build/install Release and prove cold offline launch with Metro/Mac unavailable while provisioning is valid.
- [ ] Verify Release excludes developer-only reset controls.
- [ ] Perform same-identity in-place renewal and confirm records plus notifications remain intact.
- [ ] When actual profile expiry occurs, record the real expiry/renewal result; otherwise leave that row pending.
- [ ] Execute clean install/restore, old-schema upgrade, failed/invalid import, interrupted replacement, external Files reopen, and disposable deletion/reinstall drills.
- [ ] Exercise actual reminders, denial/revocation, midnight/foreground, target-change, cycle end/repeat, measurement units/gaps, and ordinary use across a date change.
- [ ] Draft maintenance, backup cadence/exposure, recovery, migration, dependency, and known-limit instructions.
- [ ] Map every section 8 row to evidence or an explicit pending/blocker entry.
- [ ] Give the integrator exact reconciliation changes for overview/milestones/release checklist and section 10.

## Preliminary versus final evidence

This branch can validate build/runbooks and many device scenarios in parallel. It cannot issue final M16 acceptance because accessibility and performance commits are not yet merged. After all three M16 branches merge, the integration owner must build one identified final artifact and rerun all affected device scenarios. Preserve preliminary evidence but label its commit/build accurately.

## Automated/build checks

Run and record:

```bash
npm run typecheck
npx jest --runInBand
```

Also run installed Expo configuration/dependency checks and the actual iOS Release build/bundle process. Do not install broad upgrades merely to satisfy diagnostics.

## Evidence record fields

Every physical row includes commit/build, iPhone model, iOS version, profile expiry when relevant, fixture or safe data context, action, expected result, actual result, date, and whether the result is preliminary or final.

## Stop and escalate

Stop for: bundle/signing identity changes, destructive use of personal history, paid distribution, false external-upload claims, custom cloud/encryption scope, product-code fixes, or an acceptance claim unsupported by the final integrated build.

## Handoff requirements

Provide commits, exact Release/renewal commands, config diff, runbook/document links, build/device/profile identity, scenario-by-scenario results, pending actual-expiry or destructive drills, reproduced defects, and exact final-build reruns. Do not mark M16 or “Hexis is finished” accepted.
