# GRID//NODE Foundation

The design + build foundation for all GRID//NODE work. Built to make the next iteration **better**, not just faster.

## What this is

| Piece | What it does | Why it matters |
|-------|--------------|----------------|
| `tokens/gridnode-design-tokens.json` | JSON spec of every color/font/space token | Single source of truth, machine-readable |
| `tokens/gridnode-tokens.css` | CSS variables for every token | One file to import, no improvised values |
| `components/syringe-component.html` | The syringe as a real component with a documented contract | No more 5 different prototypes with different styles |
| `components/syringe-component.js` | ES module with zod schema + `compute()` / `update()` / `initMarkings()` | Importable from vitest, vite, anywhere |
| `components/syringe-component.css` | Component styles reading from `--gn-*` tokens | Tokens + components = consistent visual language |
| `components/syringe-template.html` | Standalone `<template>` for embedding | Drag-and-drop into any page |
| `regression/regress.py` | Screenshot + diff against baseline (uses pixelmatch sidecar) | "Did I break the look?" answered in 3 seconds with real pixel data |
| `regression/diff.mjs` | The pixelmatch sidecar (called by regress.py) | Real pixel-level image diff, not size-only |
| `state-machines/SYRINGE_VISUAL_STATE.mmd` | Mermaid state diagram for the syringe | Documented behavior, not "verified" prose |
| `state-machines/SYRINGE_VISUAL_STATE.png` | Rendered state diagram | Visual reference for the build |
| `tests/syringe.test.js` | 22 vitest tests covering all states, contract, DOM | Real test suite that proves the component works |
| `vitest.config.js` | Vitest config (jsdom environment) | Tests run in a real browser-like env |
| `package.json` | Local deps: zod, pixelmatch, pngjs, vite, vitest, jsdom | Tools available in this dir without global install |
| `checklist/PRE_COMMIT_CHECKLIST.md` | 10-item pre-commit checklist | "Ready for Founder Android QA" actually means something |
| `demo.html` | Live demo of all the above | Proof the foundation works |

## How to use it

### Run the test suite (proves it works)

```bash
cd foundation
node_modules/.bin/vitest run
# 22/22 tests passing in ~1.9s
```

### Start the dev server

```bash
cd foundation
npx vite
# Serves demo.html on http://localhost:5173 with HMR
```

### Run visual regression

```bash
# Capture initial baseline (one-time per state)
python3 foundation/regression/regress.py <url> <name> --update --preset 7.5,18

# Compare current against baseline (every subsequent change)
python3 foundation/regression/regress.py <url> <name> --preset 7.5,18
# Exits 0 if pixel diff < 0.5%, 1 otherwise
# Writes a .diff.png image when it fails
```

### Deploy via surge (no platform watermark)

```bash
surge <dir> <subdomain>.surge.sh
# e.g.: surge foundation/ gridnode-foundation.surge.sh
```

### For a new page

1. Add the tokens CSS at the top of your `<style>`:
   ```html
   <link rel="stylesheet" href="path/to/tokens/gridnode-tokens.css">
   ```

2. Add the syringe component styles:
   ```html
   <link rel="stylesheet" href="path/to/components/syringe-component.css">
   ```

3. Add the `<template>` and the component JS:
   ```html
   <template id="syringe-visual-template">...</template>
   <script type="module" src="path/to/components/syringe-component.js"></script>
   ```

4. Use the component:
   ```html
   <syringe-visual data-variant="bd-neon"></syringe-visual>
   <script type="module">
     import SyringeVisual from './components/syringe-component.js';
     const el = document.querySelector('syringe-visual');
     const props = SyringeVisual.compute(7.5, 18, 'Tirzepatide');
     SyringeVisual.update(el, props);
   </script>
   ```

### For a new visual component

1. Add the spec to `tokens/gridnode-design-tokens.json` if you need new tokens
2. Add a `<template>` to `components/<name>-template.html`
3. Add a contract to the component JS (see syringe for example)
4. Add a state machine diagram to `state-machines/<NAME>_STATE.mmd`
5. Render it: `mmdc -i <NAME>_STATE.mmd -o <NAME>_STATE.png`
6. Add CSS that uses `--gn-*` tokens only
7. Capture baseline + run regression

## The contract pattern

Every component has a documented input → output contract. The `update()` function validates the contract on every call and throws/logs a clear error if it's broken.

```js
const CONTRACT = {
  unit:      { type: 'string|number', required: true },
  drawLabel: { type: 'string', required: true },
  status:    { type: 'string', required: true, enum: ['READY','LOCKED','OVERFLOW','EMPTY'] },
  // ...
};

function update(el, props) {
  for (const [key, def] of Object.entries(CONTRACT)) {
    if (def.required && props[key] === undefined) {
      console.error(`Contract broken: ${key} missing`, { props });
      return;
    }
  }
  // ...apply to DOM...
}
```

This means: if a state is missing, the DOM is broken, or a field is null when it shouldn't be, the console tells you immediately. No more "looks wrong but I don't know why."

## Why this is better than the last approach

Before the foundation:
- 5 hand-rolled prototypes, each with different fonts, colors, spacing
- 3 v1.3 attempts because the integration kept breaking
- "All 4 states verified" by eyeballing a single screenshot
- New CSS classes invented on the spot
- No way to show "what changed" between iterations

After the foundation:
- 1 component, 5 visual variants
- 1 update function with a contract that fails loudly
- All boundary states have a baseline + a regression test
- Every value comes from a token
- Every state has a diagram, a screenshot, and a documented output

The result: the next time we add a feature, it takes minutes, not hours. The next time we change a token, every component updates. The next time we say "this looks right," we have a baseline to prove it.

## Auto-trigger

This foundation activates when:
- "use the GRID//NODE foundation" / "build it on the foundation"
- "apply the new tokens" / "refactor to the component contract"
- "run regression" / "capture a baseline"
- "show me the state machine"
- "pre-commit checklist" / "is this ready for Founder Android QA"
- Any reference to "syringe-visual" / "compute()" / "update()" / "SyringeVisual"
