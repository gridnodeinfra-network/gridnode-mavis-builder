# GRID//NODE Pre-Commit Checklist

**Before you mark ANY candidate as ready, check all of these:**

## 1. Tokens
- [ ] No improvised font sizes (only `--gn-fs-xs` through `--gn-fs-hero`)
- [ ] No improvised colors (only `--gn-cyan/green/magenta/amber/orange-u100` + text ladder)
- [ ] No improvised spacing (only `--gn-space-1` through `--gn-space-10`)
- [ ] No invented brand hex codes — if a new color is needed, add it to `tokens/gridnode-design-tokens.json` first

## 2. Component Contract
- [ ] Component has a documented input/output contract (see `components/syringe-component.html` for example)
- [ ] `update()` function validates the contract on every call
- [ ] All required fields are checked, broken contracts log to console

## 3. State Machine
- [ ] Every state is enumerated (empty, normal, overflow, plus any custom states)
- [ ] Every transition has a trigger condition
- [ ] Every state has a documented visual output
- [ ] State diagram rendered to PNG and committed to `state-machines/`

## 4. Visual Regression
- [ ] Baseline screenshot exists for the previous version in `regression/baselines/`
- [ ] New screenshot saved to `regression/screenshots/`
- [ ] `python3 foundation/regression/regress.py <html> <name>` returns 0
- [ ] If diff > 0.5%, justify the change in `build-decisions/`

## 5. Tests
- [ ] All boundary states tested (0, 1, 50, 100, 101)
- [ ] Edge cases tested (NaN dose, negative, very small, very large)
- [ ] pa11y: 0 issues
- [ ] b12 scan: PASS
- [ ] Console errors: 0
- [ ] Mobile viewport: tested at 375px width

## 6. Before/After Proof
- [ ] Before screenshot saved
- [ ] After screenshot saved
- [ ] Side-by-side or annotated diff in commit message
- [ ] File:line references for all changes

## 7. Source of Truth Compliance
- [ ] Did NOT touch protected systems (SHOTS scanner, LOG SHOT, etc.) without explicit override
- [ ] Override documented in `build-decisions/` with date and reason
- [ ] No new IIFE wrappers, no new `<script>` tags, no new `<style>` tags (unless override allows)
- [ ] No patch stacking — edited existing functions in place

## 8. Size Budget
- [ ] Total delta from locked: <5KB (or override documented)
- [ ] No unused code added "just in case"
- [ ] No console.log statements left in production code

## 9. Brand
- [ ] All instances of "GRID//NODE" use exactly that form
- [ ] No variants: not "Gridnode", "Grid Node", "GRID NODE", "GRID / NODE"
- [ ] Filenames use filesystem-safe form: `gridnode-` prefix
- [ ] B2-B logo, Oskar dedication, and other protected elements untouched

## 10. Documentation
- [ ] STATE.md or equivalent in `build-decisions/` if behavior changed
- [ ] Commit message has: scope, what changed, why, file:line refs
- [ ] Update SOURCE_OF_TRUTH.md if a new protected system is added
