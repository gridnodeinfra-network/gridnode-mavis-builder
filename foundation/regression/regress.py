#!/usr/bin/env python3
"""
visual-regression.py — Take a screenshot, compare against baseline, report diff.

Usage:
    python3 visual-regression.py <html-or-url> <name> [--update]

If --update is passed, the screenshot becomes the new baseline.
Otherwise, the screenshot is compared against the existing baseline and
the script exits with code 1 if there's a meaningful pixel difference.
"""
import asyncio
import sys
import os
import hashlib
from pathlib import Path
from playwright.async_api import async_playwright

BASELINE_DIR = Path('/workspace/.skills/gridnode-mavis-builder/foundation/regression/baselines')
SCREENSHOTS_DIR = Path('/workspace/.skills/gridnode-mavis-builder/foundation/regression/screenshots')
DIFF_THRESHOLD = 0.005  # 0.5% pixel difference

async def shoot(target_url, name, viewport=(1280, 900), preset=None):
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox'])
        ctx = await browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]})
        page = await ctx.new_page()
        await page.goto(target_url, wait_until='networkidle')
        await page.wait_for_timeout(1500)
        # If a preset is specified, click the matching button before screenshotting
        if preset:
            try:
                await page.click(f'button.preset[data-dose="{preset["dose"]}"][data-conc="{preset["conc"]}"]', timeout=2000)
                await page.wait_for_timeout(800)
            except Exception as e:
                print(f'  warning: preset {preset} not found ({e})')
        out_path = SCREENSHOTS_DIR / f'{name}.png'
        out_path.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out_path), full_page=True)
        await browser.close()
        return out_path

def hash_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()

def compare(baseline, current):
    """Compare two images using real pixel-level diff via pixelmatch.
    Invokes Node sidecar at foundation/regression/diff.mjs."""
    import subprocess
    if not baseline.exists():
        return 1.0, 'no baseline'
    if not current.exists():
        return 1.0, 'current screenshot missing'
    diff_script = Path(__file__).parent / 'diff.mjs'
    try:
        result = subprocess.run(
            ['node', str(diff_script), str(baseline), str(current), '0.5'],
            capture_output=True, text=True, timeout=30,
            cwd=str(diff_script.parent.parent),  # foundation dir, has node_modules
        )
        out = (result.stdout + result.stderr).strip()
        # Parse "pct=N.NNN%" from output
        import re
        m = re.search(r'pct=([\d.]+)%', out)
        if m:
            pct = float(m.group(1)) / 100
            return pct, out.split('\n')[-1] if out else f'exit={result.returncode}'
        return 1.0, f'unparseable: {out}'
    except subprocess.TimeoutExpired:
        return 1.0, 'pixelmatch timed out (>30s)'
    except Exception as e:
        return 1.0, f'pixelmatch error: {e}'

async def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    target = sys.argv[1]
    name = sys.argv[2]
    update = '--update' in sys.argv
    BASELINE_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    if not target.startswith('file://') and not target.startswith('http'):
        target = 'file://' + os.path.abspath(target)
    print(f'  shooting {target}...')
    # Optional preset: --preset dose,conc
    preset = None
    for i, a in enumerate(sys.argv):
        if a == '--preset' and i+1 < len(sys.argv):
            d, c = sys.argv[i+1].split(',')
            preset = {'dose': d, 'conc': c}
    current = await shoot(target, name, preset=preset)
    print(f'  saved {current}')
    baseline = BASELINE_DIR / f'{name}.png'
    if update:
        baseline.parent.mkdir(parents=True, exist_ok=True)
        baseline.write_bytes(current.read_bytes())
        print(f'  ✓ baseline updated → {baseline}')
        return
    if not baseline.exists():
        print(f'  ⚠ no baseline at {baseline}; run with --update to create one')
        sys.exit(1)
    diff, msg = compare(baseline, current)
    print(f'  diff: {diff*100:.2f}% ({msg})')
    if diff > DIFF_THRESHOLD:
        print(f'  ✗ FAIL: exceeds {DIFF_THRESHOLD*100:.2f}% threshold')
        sys.exit(1)
    print(f'  ✓ PASS')

if __name__ == '__main__':
    asyncio.run(main())
