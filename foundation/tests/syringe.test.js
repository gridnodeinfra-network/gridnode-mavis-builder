import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compute, update, SyringePropsSchema, initMarkings } from '../components/syringe-component.js';

describe('compute() — state transitions', () => {
  describe('empty state', () => {
    it('returns empty when dose=0', () => {
      const r = compute(0, 18, 'Tirzepatide');
      expect(r.state).toBe('empty');
      expect(r.unit).toBe('—');
      expect(r.status).toBe('READY');
      expect(r.fluid).toBe(0);
      expect(r.pkVisible).toBe(false);
    });

    it('returns empty when conc=0', () => {
      const r = compute(7.5, 0);
      expect(r.state).toBe('empty');
    });

    it('returns empty when both are 0', () => {
      const r = compute(0, 0);
      expect(r.state).toBe('empty');
    });
  });

  describe('normal state (0 < units <= 100)', () => {
    it('7.5mg at 18mg/mL = 0.42mL = 42 units', () => {
      const r = compute(7.5, 18, 'Tirzepatide');
      expect(r.state).toBe('normal');
      expect(r.unit).toBe(42);
      expect(r.fluid).toBeCloseTo(41.67, 1);
      expect(r.status).toBe('LOCKED');
      expect(r.pkVisible).toBe(true);
      expect(r.drawLabel).toBe('DRAW TO THE 42 UNIT LINE');
      expect(r.headroom).toBe('HEADROOM 58U');
    });

    it('5mg at 10mg/mL = 0.50mL = 50 units (exactly half)', () => {
      const r = compute(5, 10);
      expect(r.state).toBe('normal');
      expect(r.unit).toBe(50);
      expect(r.fluid).toBe(50);
    });

    it('10mg at 10mg/mL = 1.00mL = 100 units (exactly full)', () => {
      const r = compute(10, 10);
      expect(r.state).toBe('normal');
      expect(r.unit).toBe(100);
      expect(r.fluid).toBe(100);
      expect(r.headroom).toBe('HEADROOM 0U');
    });

    it('handles 0.1mg at 1mg/mL = 0.1mL = 10 units (small dose)', () => {
      const r = compute(0.1, 1);
      expect(r.state).toBe('normal');
      expect(r.unit).toBe(10);
    });

    it('caution message shows for high concentration (>=30 mg/mL)', () => {
      const r = compute(5, 50);
      expect(r.state).toBe('normal');
      expect(r.caution).toContain('High concentration');
    });

    it('no caution message for normal concentration', () => {
      const r = compute(5, 10);
      expect(r.caution).toBeNull();
    });
  });

  describe('overflow state (units > 100)', () => {
    it('25mg at 18mg/mL = 1.39mL = 139 units → overflow', () => {
      const r = compute(25, 18);
      expect(r.state).toBe('overflow');
      expect(r.unit).toBe('OVER');
      expect(r.fluid).toBe(100);  // pinned
      expect(r.status).toBe('OVERFLOW');
      expect(r.pkVisible).toBe(false);
      expect(r.target).toBe('OVER 100 U (139)');
      expect(r.headroom).toBe('OVERAGE +39U');
      expect(r.caution).toContain('exceeds 100-unit');
    });

    it('10mg at 5mg/mL = 2.00mL = 200 units → overflow', () => {
      const r = compute(10, 5);
      expect(r.state).toBe('overflow');
      expect(r.unit).toBe('OVER');
    });
  });

  describe('formula output', () => {
    it('formats the educational math correctly', () => {
      const r = compute(7.5, 18);
      expect(r.formula).toBe('7.500 mg ÷ 18.000 mg/mL = 0.42 mL = 42 units');
    });
  });
});

describe('SyringePropsSchema — contract enforcement', () => {
  it('accepts a valid empty-state object', () => {
    const valid = {
      state: 'empty', unit: '—',
      drawLabel: 'DRAW TO THE — UNIT LINE',
      volume: '— mL', conc: '— mg/mL',
      target: '— of 100 U', status: 'READY',
      fluid: 0, stopper: 0, headroom: 'HEADROOM —',
      pkVisible: false, caution: null, formula: '...',
    };
    expect(SyringePropsSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects bad state enum', () => {
    const bad = { ...validBase(), state: 'halfway' };
    expect(SyringePropsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects fluid out of range', () => {
    const bad = { ...validBase(), fluid: 150 };
    expect(SyringePropsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects status not in enum', () => {
    const bad = { ...validBase(), status: 'WAT' };
    expect(SyringePropsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects volume without mL suffix', () => {
    const bad = { ...validBase(), volume: '0.42' };
    expect(SyringePropsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing required field', () => {
    const bad = validBase();
    delete bad.formula;
    expect(SyringePropsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('update() — DOM application', () => {
  let el;
  beforeEach(() => {
    el = document.createElement('syringe-visual');
    el.innerHTML = `
      <div class="syr-num"><span class="syr-num-val">—</span></div>
      <div class="syr-draw">X</div>
      <span data-field="volume">X</span>
      <span data-field="target">X</span>
      <span data-field="status">X</span>
      <span data-field="headroom">X</span>
      <div class="syr-fluid" style="width:0%"></div>
      <div class="syr-stopper" style="left:0%"></div>
      <div class="syr-target" style="display:none"></div>
      <div class="syr-pk" style="display:none"></div>
      <div class="syr-caution" style="display:none"></div>
      <div class="syr-formula">X</div>
    `;
    document.body.appendChild(el);
  });
  afterEach(() => el.remove());

  it('applies valid 42u state to the DOM', () => {
    const props = compute(7.5, 18);
    const ok = update(el, props);
    expect(ok).toBe(true);
    expect(el.dataset.state).toBe('normal');
    expect(el.dataset.units).toBe('42');
    expect(el.querySelector('.syr-num-val').textContent).toBe('42');
    expect(el.querySelector('[data-field="status"]').textContent).toBe('LOCKED');
    expect(parseFloat(el.querySelector('.syr-fluid').style.width)).toBeCloseTo(41.67, 1);
  });

  it('applies overflow state and pins fluid to 100%', () => {
    const props = compute(25, 18);
    update(el, props);
    expect(el.dataset.state).toBe('overflow');
    expect(el.querySelector('.syr-num-val').textContent).toBe('OVER');
    expect(el.querySelector('.syr-fluid').style.width).toBe('100%');
    expect(el.querySelector('.syr-pk').style.display).toBe('none');
  });

  it('hides PK beam in empty state', () => {
    const props = compute(0, 0);
    update(el, props);
    expect(el.dataset.state).toBe('empty');
    expect(el.querySelector('.syr-pk').style.display).toBe('none');
  });

  it('returns false and logs error on broken contract', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { state: 'normal', unit: 42 };  // missing most fields
    const ok = update(el, broken);
    expect(ok).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

function validBase() {
  return {
    state: 'normal', unit: 42,
    drawLabel: 'DRAW TO THE 42 UNIT LINE',
    volume: '0.417 mL', conc: '18.000 mg/mL',
    target: '42 of 100 U', status: 'LOCKED',
    fluid: 41.67, stopper: 41.67, headroom: 'HEADROOM 58U',
    pkVisible: true, caution: null,
    formula: '7.5 mg ÷ 18 mg/mL = 0.42 mL = 42 units',
  };
}
