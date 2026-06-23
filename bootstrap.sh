#!/bin/bash
# bootstrap.sh — MAVIS builder baseline setup
#
# Rebuilds the full builder environment from scratch in a fresh Mavis sandbox.
# Use when you (or future Mavis instances) need to recreate the working setup
# for GRID//NODE-style projects: design, code, QA, browser automation.
#
# Time: ~6-10 minutes total (mostly downloads)
# Disk: ~1.8-2.2 GB after completion (added: tig, inotify-tools, asciinema, pixelmatch, zod, vite, vitest, surge)
# Idempotent: safe to re-run, checks before installing
#
# Usage:
#   bash /workspace/.skills/gridnode-mavis-builder/bootstrap.sh
#
# Sections can be skipped via env vars:
#   SKIP_BROWSER=1     skip chromium + firefox install
#   SKIP_TOOLS=1       skip apt installs (incl. lazygit, delta, neovim, bat)
#   SKIP_NPM=1         skip npm global packages
#   SKIP_PYTHON=1      skip Python 3.13 install
#   SKIP_OPTIMIZE=1    skip .pyc precompile + sqlite + git config
#   SKIP_GH=1          skip GitHub CLI install

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "==============================================="
echo "  MAVIS builder baseline bootstrap"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "==============================================="
echo

# ============================================================
# 1. System tools (apt)
# ============================================================
if [ "$SKIP_TOOLS" != "1" ]; then
  echo "[1/8] Installing system tools (apt)..."
  apt-get update -qq 2>&1 | tail -1
  apt install -y \
    git curl wget jq \
    zstd unrar-free zip \
    sqlite3 \
    fzf ripgrep shellcheck btop neovim bat \
    tig inotify-tools asciinema \
    locales \
    python3 python3-pip \
    libgtk-3-0 libgdk-pixbuf-2.0-0 libnss3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 \
    2>&1 | tail -2

  # Generate locale
  if ! grep -q "^en_US.UTF-8" /etc/locale.gen 2>/dev/null; then
    echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
  fi
  locale-gen en_US.UTF-8 2>&1 | tail -1

  # Debian installs bat as 'batcat' — symlink to 'bat' for muscle memory
  if [ -x /usr/bin/batcat ] && [ ! -e /usr/local/bin/bat ]; then
    ln -sf /usr/bin/batcat /usr/local/bin/bat
    echo "  ✓ linked batcat → bat"
  fi

  echo "  ✓ system tools installed (includes neovim + bat + Firefox GTK deps)"
  echo
fi

# ============================================================
# 1b. delta (git diff enhancer)
# ============================================================
if [ "$SKIP_TOOLS" != "1" ]; then
  echo "[1b/8] Installing delta..."
  if ! command -v delta >/dev/null 2>&1; then
    DELTA_VERSION=$(curl -sSL "https://api.github.com/repos/dandavison/delta/releases/latest" 2>/dev/null \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])" 2>/dev/null || echo "0.19.2")
    cd /tmp
    curl -sSL -o delta.deb "https://github.com/dandavison/delta/releases/download/${DELTA_VERSION}/git-delta_${DELTA_VERSION}_amd64.deb"
    dpkg -i delta.deb 2>&1 | tail -1
    rm -f delta.deb
    cd - >/dev/null
  fi
  echo "  ✓ delta installed: $(delta --version)"
  echo
fi

# ============================================================
# 1c. lazygit (terminal UI for git)
# ============================================================
if [ "$SKIP_TOOLS" != "1" ]; then
  echo "[1c/8] Installing lazygit..."
  if ! command -v lazygit >/dev/null 2>&1; then
    LAZYGIT_VERSION=$(curl -sSL -o /dev/null -w '%{url_effective}' \
      "https://github.com/jesseduffield/lazygit/releases/latest" | sed 's|.*/v||')
    cd /tmp
    curl -sSL -o lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz"
    tar xzf lazygit.tar.gz lazygit
    mv lazygit /usr/local/bin/lazygit
    chmod +x /usr/local/bin/lazygit
    rm -f lazygit.tar.gz
    cd - >/dev/null
  fi
  echo "  ✓ lazygit installed: $(lazygit --version | head -1)"
  echo
fi

# ============================================================
# 2. Timezone + locale env
# ============================================================
echo "[2/8] Setting timezone + locale..."
if [ -f /usr/share/zoneinfo/America/New_York ]; then
  ln -sf /usr/share/zoneinfo/America/New_York /etc/localtime
  echo "America/New_York" > /etc/timezone
fi
# Persist for future shells
if ! grep -q "America/New_York" /root/.bashrc 2>/dev/null; then
  cat >> /root/.bashrc << 'EOF'

# MAVIS environment
export TZ="America/New_York"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"
EOF
fi
echo "  ✓ TZ=America/New_York, locale=en_US.UTF-8"
echo

# ============================================================
# 3. Python 3.13 via uv + pre-compile .pyc
# ============================================================
if [ "$SKIP_PYTHON" != "1" ]; then
  echo "[3/8] Setting up Python 3.13 + pre-compile .pyc..."
  # Install uv if missing
  if ! command -v uv >/dev/null 2>&1; then
    echo "  installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
  fi
  # Install Python 3.13
  uv python install 3.13 >/dev/null 2>&1
  PY313=/root/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13
  if [ -x "$PY313" ]; then
    # Alias python3 to 3.13
    if ! grep -q "alias python3=" /root/.bashrc 2>/dev/null; then
      cat >> /root/.bashrc << EOF
alias python3='$PY313'
alias python='$PY313'
EOF
    fi
    # Pre-compile stdlib + site-packages
    $PY313 -m compileall -q -j 0 /usr/lib/python3.11 /usr/local/lib/python3.11 2>&1 | tail -1
    echo "  ✓ Python 3.13 + pre-compiled .pyc"

    # 'pi' shortcut for pip (uses uv-managed Python 3.13)
    if [ ! -e /usr/local/bin/pi ]; then
      cat > /usr/local/bin/pi << EOF
#!/bin/bash
exec $PY313 -m pip "\$@"
EOF
      chmod +x /usr/local/bin/pi
      echo "  ✓ created 'pi' shortcut for pip"
    fi
  else
    echo "  ✗ Python 3.13 install failed"
  fi
  echo
fi

# ============================================================
# 4. Browsers (chromium-headless-shell + firefox)
# ============================================================
if [ "$SKIP_BROWSER" != "1" ]; then
  echo "[4/8] Setting up lean chromium + firefox..."
  PY="${PYTHON:-/root/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13}"
  if ! "$PY" -c "import playwright" 2>/dev/null; then
    "$PY" -m pip install --break-system-packages --quiet playwright 2>&1 | tail -1
  fi
  if [ ! -d /root/.cache/ms-playwright/chromium_headless_shell-* ]; then
    rm -rf /root/.cache/ms-playwright/ 2>/dev/null
    "$PY" -m playwright install chromium-headless-shell 2>&1 | tail -1
  fi
  if [ ! -d /root/.cache/ms-playwright/firefox-* ]; then
    "$PY" -m playwright install firefox 2>&1 | tail -1
  fi
  echo "  ✓ chromium-headless-shell + firefox installed"
  echo
fi

# ============================================================
# 5. NPM global packages
# ============================================================
if [ "$SKIP_NPM" != "1" ]; then
  echo "[5/8] Installing npm globals..."
  npm install -g svgo 2>&1 | tail -1
  npm install -g @mermaid-js/mermaid-cli 2>&1 | tail -1
  npm install -g axe-core pa11y 2>&1 | tail -1
  npm install -g pixelmatch zod vite vitest surge 2>&1 | tail -1

  # Mermaid + pa11y need --no-sandbox for root puppeteer
  mkdir -p /root/.config/mermaid-cli /root/.config/pa11y
  # mmdc v11+ uses config.json (not puppeteer-config.json)
  cat > /root/.config/mermaid-cli/config.json << 'EOF'
{
  "args": ["--no-sandbox", "--disable-setuid-sandbox"]
}
EOF
  cat > /root/.config/pa11y/config.json << 'EOF'
{
  "chromeLaunchConfig": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  }
}
EOF

  # Foundation deps: zod + pngjs (pixelmatch peer) — install in foundation dir
  if [ -d "$SCRIPT_DIR/foundation" ]; then
    cd "$SCRIPT_DIR/foundation"
    [ -d node_modules/zod ]    || npm install --no-audit --no-fund zod    2>&1 | tail -1
    [ -d node_modules/pixelmatch ] || npm install --no-audit --no-fund pixelmatch 2>&1 | tail -1
    [ -d node_modules/pngjs ]  || npm install --no-audit --no-fund pngjs  2>&1 | tail -1
    [ -d node_modules/vite ]   || npm install --no-audit --no-fund vite   2>&1 | tail -1
    [ -d node_modules/vitest ] || npm install --no-audit --no-fund -D vitest jsdom 2>&1 | tail -1
    cd "$SCRIPT_DIR"
  fi

  echo "  ✓ svgo + mermaid-cli + axe-core + pa11y + pixelmatch + zod + vite + vitest + surge installed"
  echo
fi

# ============================================================
# 6. GitHub CLI (gh)
# ============================================================
if [ "$SKIP_GH" != "1" ]; then
  echo "[6/8] Installing gh CLI..."
  if ! command -v gh >/dev/null 2>&1; then
    cd /tmp
    LATEST_URL=$(curl -sSL -o /dev/null -w '%{url_effective}' https://github.com/cli/cli/releases/latest)
    TAG=$(basename "$LATEST_URL")
    DEB="gh_${TAG#v}_linux_amd64.deb"
    curl -sSL -o "/tmp/$DEB" "https://github.com/cli/cli/releases/download/$TAG/$DEB" 2>&1 | tail -1
    dpkg -i "/tmp/$DEB" >/dev/null 2>&1
    rm -f "/tmp/$DEB"
    cd - >/dev/null
  fi
  echo "  ✓ gh CLI installed"
  echo
fi

# ============================================================
# 7. Optimization: git config + sqlite pragmas
# ============================================================
if [ "$SKIP_OPTIMIZE" != "1" ]; then
  echo "[7/8] Optimizing git, sqlite, shell..."
  # Make `pi` shortcut visible system-wide
  if [ -x /root/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin/python3.13 ] && [ -e /usr/local/bin/pi ]; then
    chmod +x /usr/local/bin/pi
  fi
  # pa11y a11y-audit wrapper — runs full audit and exits nonzero on errors
  if [ ! -e /usr/local/bin/a11y-audit ]; then
    cat > /usr/local/bin/a11y-audit << 'EOF'
#!/bin/bash
# a11y-audit — run pa11y against an HTML file and report WCAG 2 AA issues.
# Usage: a11y-audit <path-to-html>
# Exit: 0 if 0 issues, 1 otherwise
URL="${1:-}"
if [ -z "$URL" ]; then
  echo "usage: a11y-audit <path-to-html>"
  exit 2
fi
# Normalize to file:// URL
[[ "$URL" != file://* ]] && URL="file://$(realpath "$URL" 2>/dev/null || echo "$URL")"
echo "=== pa11y WCAG 2 AA audit ==="
echo "URL: $URL"
echo
JSON=$(pa11y --config /root/.config/pa11y/config.json --reporter json "$URL" 2>/dev/null)
COUNT=$(echo "$JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
echo "Issues: $COUNT"
echo
echo "$JSON" | python3 -c "
import json,sys
from collections import Counter
try:
  data = json.load(sys.stdin)
  codes = Counter(i.get('code', '?') for i in data)
  for c, n in codes.most_common():
    print(f'  {n}x {c}')
except Exception as e:
  print(f'  parse error: {e}', file=sys.stderr)
" 2>/dev/null
[ "$COUNT" = "0" ] && exit 0 || exit 1
EOF
    chmod +x /usr/local/bin/a11y-audit
    echo "  ✓ created 'a11y-audit' shortcut (pa11y wrapper)"
  fi

  # Git config
  git config --global user.name "Pipe (via MAVIS)"
  git config --global user.email "noreply@gridnode.local"
  git config --global init.defaultBranch main
  git config --global core.pager delta
  git config --global core.editor nano
  git config --global pull.rebase true
  git config --global push.autoSetupRemote true
  git config --global color.ui auto
  git config --global diff.algorithm histogram
  git config --global rerere.enabled true

  # SQLite performance pragmas
  cat > /root/.sqliterc << 'EOF'
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -2000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
EOF

  echo "  ✓ git configured (delta pager), sqlite tuned"
  echo
fi

# ============================================================
# 8. Project setup: GRID//NODE git init (if needed)
# ============================================================
echo "[8/8] Setting up /workspace/gridnode-project as a git repo (if not already)..."
if [ -d /workspace/gridnode-project ]; then
  cd /workspace/gridnode-project 2>/dev/null
  if [ ! -d .git ]; then
    git init -q
    git config user.name "Pipe (via MAVIS)"
    git config user.email "noreply@gridnode.local"
    # Basic .gitignore for render artifacts
    [ ! -f .gitignore ] && cat > .gitignore << 'GIEOF'
_render_*.py
__pycache__/
*.pyc
screenshots/*.png
*.svg-test/
test-*.mmd
*.tmp
GIEOF
    git add .gitignore 2>/dev/null
    git commit -q -m "chore: initial workspace + .gitignore" 2>/dev/null
  fi
  cd - >/dev/null
fi
echo "  ✓ /workspace/gridnode-project ready"
echo

# ============================================================
# Final summary
# ============================================================
echo "==============================================="
echo "  ✓ MAVIS builder baseline complete"
echo "==============================================="
echo
echo "Installed:"
echo "  • Python 3.13 (default) + pre-compiled .pyc"
echo "  • Browsers: chromium-headless-shell + firefox"
echo "  • npm: svgo, mermaid-cli, axe-core, pa11y, pixelmatch, zod, vite, vitest, surge"
echo "  • Tools: fzf, ripgrep, btop, shellcheck, sqlite3, jq, zstd, zip, unrar,"
echo "    neovim, lazygit, delta, gh, bat, tig, inotify-tools, asciinema"
echo "  • Shortcuts: pi (= pip), bat (linked from batcat)"
echo "  • Locale en_US.UTF-8 + TZ America/New_York"
echo "  • git config (delta pager, rebase, autosetupremote) + sqlite WAL + mermaid configs"
echo "  • Foundation deps installed (zod, pixelmatch, pngjs, vite, vitest, jsdom) at"
echo "    $SCRIPT_DIR/foundation/node_modules/"
echo
echo "Source /root/.bashrc in any new shell to pick up aliases."
echo "Total disk: $(df -h / 2>/dev/null | tail -1 | awk '{print $3 " used of " $2}')"