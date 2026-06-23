// Syringe component JS — extracted into its own file so vitest can import it
// Same logic as the IIFE in syringe-component.html, but as ES modules

import { z } from 'zod';

export const SyringePropsSchema = z.object({
  state:     z.enum(['empty', 'normal', 'overflow']),
  unit:      z.union([z.string(), z.number()]),
  drawLabel: z.string(),
  volume:    z.string().regex(/^[\d.]+ mL$|^— mL$/, 'volume must be "{N} mL" or "— mL"'),
  conc:      z.string().regex(/^[\d.]+ mg\/mL$|^— mg\/mL$/),
  target:    z.string(),
  status:    z.enum(['READY', 'LOCKED', 'OVERFLOW', 'EMPTY']),
  fluid:     z.number().min(0).max(100),
  stopper:   z.number().min(0).max(100),
  headroom:  z.string(),
  pkVisible: z.boolean(),
  caution:   z.string().nullable(),
  formula:   z.string(),
});

export function compute(dose, conc, peptide = '') {
  if (!dose || !conc) {
    return {
      state: 'empty', unit: '—',
      drawLabel: 'DRAW TO THE — UNIT LINE',
      volume: '— mL', conc: '— mg/mL',
      target: '— of 100 U', volumeResult: '— mL', status: 'READY',
      fluid: 0, stopper: 0, headroom: 'HEADROOM —',
      pkVisible: false, caution: null,
      formula: 'Educational math only. Enter dose and concentration.',
    };
  }
  const ml = dose / conc;
  const unitsRaw = ml * 100;
  const units = Math.round(unitsRaw);
  const mlTxt = ml.toFixed(2);
  const concTxt = conc.toFixed(3);
  const doseTxt = parseFloat(dose).toFixed(3);

  if (unitsRaw > 100) {
    return {
      state: 'overflow', unit: 'OVER',
      drawLabel: 'EXCEEDS 100-UNIT BARREL',
      volume: `${ml.toFixed(3)} mL`, conc: `${concTxt} mg/mL`,
      target: `OVER 100 U (${units})`, volumeResult: `${mlTxt} mL`, status: 'OVERFLOW',
      fluid: 100, stopper: 100, headroom: `OVERAGE +${Math.round(unitsRaw - 100)}U`,
      pkVisible: false,
      caution: `Result exceeds 100-unit U-100 barrel by ${Math.round(unitsRaw - 100)}U. Educational math only — confirm handling decisions with a licensed clinician.`,
      formula: `${doseTxt} mg ÷ ${concTxt} mg/mL = ${mlTxt} mL = ${units} units`,
    };
  }
  return {
    state: 'normal', unit: units,
    drawLabel: `DRAW TO THE ${units} UNIT LINE`,
    volume: `${ml.toFixed(3)} mL`, conc: `${concTxt} mg/mL`,
    target: `${units} of 100 U`, volumeResult: `${mlTxt} mL`, status: 'LOCKED',
    fluid: unitsRaw, stopper: unitsRaw, headroom: `HEADROOM ${Math.round(100 - unitsRaw)}U`,
    pkVisible: true,
    caution: conc >= 30
      ? 'High concentration value entered. Double-check your vial label, concentration units, and decimal placement before using this calculation.'
      : null,
    formula: `${doseTxt} mg ÷ ${concTxt} mg/mL = ${mlTxt} mL = ${units} units`,
  };
}

export function update(el, props) {
  // Validate via zod — throws on broken contract
  const result = SyringePropsSchema.safeParse(props);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    console.error(`SyringeVisual contract broken: ${issues}`, { props });
    return false;
  }

  el.dataset.state = props.state;
  el.dataset.units = String(props.unit);
  el.dataset.pkVisible = props.pkVisible ? 'true' : 'false';

  const numEl    = el.querySelector('.syr-num-val');
  const drawEl   = el.querySelector('.syr-draw');
  const volEl    = el.querySelector('[data-field="volume"]');
  const targetEl = el.querySelector('[data-field="target"]');
  const statusEl = el.querySelector('[data-field="status"]');
  const headEl   = el.querySelector('[data-field="headroom"]');
  const fluid    = el.querySelector('.syr-fluid');
  const stopper  = el.querySelector('.syr-stopper');
  const target   = el.querySelector('.syr-target');
  const pk       = el.querySelector('.syr-pk');
  const caution  = el.querySelector('.syr-caution');
  const formula  = el.querySelector('.syr-formula');

  if (numEl)    numEl.textContent    = props.unit;
  if (drawEl)   drawEl.textContent   = props.drawLabel;
  if (volEl)    volEl.textContent    = props.volume;
  if (targetEl) targetEl.textContent = props.target;
  if (statusEl) statusEl.textContent = props.status;
  if (headEl)   headEl.textContent   = props.headroom;
  if (fluid)    fluid.style.width    = props.fluid + '%';
  if (stopper)  stopper.style.left   = props.stopper + '%';
  if (target) {
    if (props.state === 'normal' && props.fluid > 0) {
      target.style.display = 'block';
      target.style.left = props.fluid + '%';
    } else {
      target.style.display = 'none';
    }
  }
  if (pk)     pk.style.display    = props.pkVisible ? 'flex' : 'none';
  if (caution){
    if (props.caution) {
      caution.style.display = 'block';
      caution.textContent = props.caution;
    } else {
      caution.style.display = 'none';
    }
  }
  if (formula) formula.textContent = props.formula || '';
  return true;
}

export function initMarkings(el) {
  const ticks = el.querySelector('.syr-ticks');
  if (!ticks || ticks.dataset.initialized) return;
  for (let u = 0; u <= 100; u += 2) {
    const tick = document.createElement('div');
    tick.className = 'syr-tick' + (u % 10 === 0 ? ' major' : '');
    tick.style.left = u + '%';
    tick.dataset.unit = u;
    ticks.appendChild(tick);
  }
  [0, 25, 50, 75, 100].forEach(u => {
    const label = document.createElement('div');
    label.className = 'syr-tick-label';
    label.style.left = u + '%';
    label.textContent = u;
    ticks.appendChild(label);
  });
  ticks.dataset.initialized = '1';
}

// Browser-side auto-init
if (typeof window !== 'undefined') {
  window.SyringeVisual = { update, compute, initMarkings, SyringePropsSchema };
  document.querySelectorAll('syringe-visual').forEach(el => {
    if (el.children.length === 0) {
      const tpl = document.getElementById('syringe-visual-template');
      if (tpl) el.appendChild(tpl.content.cloneNode(true));
    }
    initMarkings(el);
  });
}
