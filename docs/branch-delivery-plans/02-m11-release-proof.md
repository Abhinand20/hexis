> **Document status:** partially implemented later, in different form. A personal-device install runbook exists; this M11 Release-proof branch was not executed as written. Retained as historical context.

# Branch handoff: M11 early standalone Release proof

**Branch:** `codex/m11-release-proof`  
**Task:** M11.5 plus reusable input to M16.1–M16.2  
**Start gate:** G0; runs in parallel with `codex/m11-startup-recovery`  
**Authority:** [completion objective and delivery plan](../completion-objective-and-delivery-plan.md)  
**Coordinates:** [completion parallel delivery plan](../completion-parallel-delivery-plan.md)  
**Objective:** prove or precisely document what remains to prove for a free-signed, standalone Release build on the owner's iPhone.

## Dispatch fields

- Dependency commit: `<G0-commit>`
- Worktree: `<absolute-path>`
- Assignee: `<name-or-agent>`
- Reference iPhone/iOS: `<model-and-version-or-unavailable>`
- Apple profile expires: `<date-or-unknown>`

Read the authority's accepted maintenance boundary, M11.5, M16.1–M16.2, and device-evidence rules.

## Owned files

- `app.json` and narrowly required Expo/iOS build configuration only after inspecting the installed toolchain.
- A narrowly scoped package script only if it makes the proven Release command reproducible.
- New `docs/release-build-and-renewal.md` and `docs/acceptance/m11-release-proof.md`.

Do not edit database/provider code, feature code, migrations, existing milestone/status docs, lockfiles, generated native projects without a demonstrated need, or Debug behavior beyond documenting its separation from Release.

## Required proof

- Use a standalone Release configuration signed with the owner's free Apple ID.
- Preserve the existing bundle identifier/signing identity used for later in-place renewal.
- Confirm the installed app opens after Metro is stopped and the Mac/network are disconnected.
- Record actual command, Xcode/Expo/iOS versions, build/commit, bundle identifier, signing team/profile expiry, and expected seven-day limit.
- Distinguish build success from on-device offline cold-launch success.
- Confirm Release omits developer-only reset controls, or record that as an M16 blocker.

The expected command is only a starting hypothesis:

```bash
npx expo run:ios --device --configuration Release
```

Inspect locally installed CLI help/config before treating it as authoritative. Do not introduce TestFlight, App Store distribution, or paid membership.

## Work checklist

- [ ] Record installed Node/npm/Expo/Xcode versions and relevant app config.
- [ ] Determine the exact Release build/install command without upgrading dependencies.
- [ ] Build and install with the stable bundle/signing identity when device access exists.
- [ ] Stop Metro, disconnect the Mac, enable airplane mode, terminate the app, and cold-launch it.
- [ ] Record expected versus actual result and profile expiry.
- [ ] Draft the repeatable Release and in-place renewal procedure for later M16 validation.
- [ ] Record any required config diff separately from device evidence.

## Automated checks

Run the relevant installed Expo config/dependency diagnostic, `npm run typecheck`, and a production iOS bundle/build check. Record environment failures rather than adding broad dependency churn.

## Device unavailable path

If no eligible iPhone/signing session is available, complete read-only toolchain inspection and a step-exact runbook, but record the result as `pending`. Never claim a simulator, bundle generation, or earlier Debug install proves standalone device behavior.

## Stop and escalate

Stop if success would require a bundle-identifier/signing-team change, destructive uninstall, paid enrollment, dependency upgrade, or changes that overlap the M11 startup branch. Report the smallest conflict to the integrator.

## Handoff requirements

Provide commit(s), config diff, exact commands/results, device/build/profile identity, cold-launch evidence or pending steps, and M16 renewal risks. Do not mark M11 or M16 accepted.
