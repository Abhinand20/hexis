# Cloud handoff: M16 accessibility code

**Cloud branch:** `codex/cloud-m16-accessibility-code`  
**Base:** `<pushed-G4-SHA>`  
**Runs with:** `codex/cloud-m16-scale-harness` and `codex/cloud-m16-docs-audit`  
**Authority:** [completion objective](../completion-objective-and-delivery-plan.md)  
**Cloud plan:** [cloud execution handoff](../cloud-execution-handoff-plan.md)  
**Cloud completion state:** source fixes and automated assertions complete; all physical accessibility evidence pending.

## Objective

Audit the integrated source and implement testable M16.3 accessibility/usability fixes without claiming that component tests prove VoiceOver or physical touch behavior.

## Own

- UI components/screens, design primitives, and presentation hooks when changes are strictly accessibility/usability related.
- Component/accessibility tests.
- A source-level accessibility evidence draft with a separate physical checklist.

Do not edit repositories/domain/schema/archive logic, performance fixtures, build config, or milestone/status docs.

## Deliver

- [ ] Roles, labels, values, hints, selected/disabled/busy state, and logical source focus order across all required flows.
- [ ] Programmatic focus behavior where testable for modal/error/save/restore transitions.
- [ ] Dynamic Type-safe layout changes and keyboard-safe required actions.
- [ ] Adequate non-overlapping hit regions, especially the current small calendar cells.
- [ ] Non-color cues, contrast-token corrections, and reduced-motion/transparency behavior expressible in source.
- [ ] Discoverable back/dismiss/cancel and explicit destructive consequences.
- [ ] Focused component assertions and a screen-by-screen physical VoiceOver/Dynamic Type/reduced-effects/touch checklist.

## Verify

```bash
npx jest --runInBand __tests__/components
npm run typecheck
```

Do not claim screenshots or test props establish physical accessibility acceptance. End with the standard cloud result format. Do not mark M16.3 or M16 accepted.

