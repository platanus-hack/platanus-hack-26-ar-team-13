#!/bin/bash
# safe-claude — wrapper de Claude Code que escanea .claude/settings.json
# antes de lanzar claude para detectar hooks maliciosos.
#
# Instalación:
#   chmod +x safe-claude.sh
#   sudo cp safe-claude.sh /usr/local/bin/safe-claude
#   alias claude='safe-claude'   # agregar a ~/.zshrc o ~/.bashrc

ANALYZER_URL="${CLAUDE_ANALYZER_URL:-http://localhost:3000}"
REAL_CLAUDE="${REAL_CLAUDE_PATH:-$(which claude 2>/dev/null || echo '')}"
SETTINGS_FILE=".claude/settings.json"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

# ──────────────────────────────────────────────
# Verificar si existe .claude/settings.json
# ──────────────────────────────────────────────
if [ ! -f "$SETTINGS_FILE" ]; then
  # Sin settings del proyecto, lanzar directo
  exec "$REAL_CLAUDE" "$@"
fi

echo -e "${BOLD}[safe-claude]${RESET} Found .claude/settings.json — scanning for malicious hooks..."

# ──────────────────────────────────────────────
# Verificar que el backend está corriendo
# ──────────────────────────────────────────────
if ! curl -s --max-time 10 "$ANALYZER_URL/analyze" -X POST \
    -H "Content-Type: application/json" \
    -d '{"tool_name":"ping","tool_input":{},"session_id":"ping","cwd":"/"}' > /dev/null 2>&1; then
  echo -e "${YELLOW}[safe-claude] WARNING: Analyzer backend not reachable at $ANALYZER_URL${RESET}"
  echo -e "${YELLOW}             Proceeding without hook analysis (start backend to enable protection)${RESET}"
  exec "$REAL_CLAUDE" "$@"
fi

# ──────────────────────────────────────────────
# Enviar settings al backend para análisis
# ──────────────────────────────────────────────
SETTINGS_CONTENT=$(cat "$SETTINGS_FILE")
PAYLOAD=$(printf '{"settings": %s, "cwd": "%s"}' "$SETTINGS_CONTENT" "$PWD")

RESPONSE=$(curl -s --max-time 5 -X POST "$ANALYZER_URL/analyze/settings" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
  echo -e "${YELLOW}[safe-claude] WARNING: Could not analyze settings — proceeding anyway${RESET}"
  exec "$REAL_CLAUDE" "$@"
fi

VERDICT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('verdict','allow'))" 2>/dev/null)
RISK=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('risk_score',0))" 2>/dev/null)
REASON=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reason',''))" 2>/dev/null)
THREATS=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data.get('threats', []):
    print(f\"  Event: {t['event']}\")
    print(f\"  Command: {t['command'][:120]}...\")
    print(f\"  Patterns: {', '.join(t['patterns'])}\")
    print()
" 2>/dev/null)

# ──────────────────────────────────────────────
# Mostrar resultado y decidir
# ──────────────────────────────────────────────
case "$VERDICT" in
  "block")
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${RED}║  ⛔  MALICIOUS HOOKS DETECTED — LAUNCH BLOCKED             ║${RESET}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "${BOLD}Risk score:${RESET} $RISK / 100"
    echo -e "${BOLD}Reason:${RESET} $REASON"
    echo ""
    if [ -n "$THREATS" ]; then
      echo -e "${BOLD}Detected threats:${RESET}"
      echo "$THREATS"
    fi
    echo -e "${RED}The project's .claude/settings.json contains hooks that would${RESET}"
    echo -e "${RED}execute malicious code automatically when you trust this project.${RESET}"
    echo ""
    echo -e "To inspect the file: ${BOLD}cat $SETTINGS_FILE${RESET}"
    exit 1
    ;;
  "warn")
    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${YELLOW}║  ⚠️   SUSPICIOUS HOOKS FOUND — REVIEW BEFORE PROCEEDING     ║${RESET}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
    echo -e "${BOLD}Risk score:${RESET} $RISK / 100"
    echo -e "${BOLD}Reason:${RESET} $REASON"
    echo ""
    if [ -n "$THREATS" ]; then
      echo -e "${BOLD}Suspicious hooks:${RESET}"
      echo "$THREATS"
    fi
    echo -n "Proceed anyway? [y/N] "
    read -r CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
      echo "Aborted."
      exit 1
    fi
    ;;
  *)
    echo -e "${GREEN}[safe-claude] ✓ No malicious hooks detected (score=$RISK)${RESET}"
    ;;
esac

# ──────────────────────────────────────────────
# Lanzar claude real
# ──────────────────────────────────────────────
if [ -z "$REAL_CLAUDE" ]; then
  echo -e "${RED}[safe-claude] ERROR: 'claude' not found in PATH${RESET}"
  echo "Set REAL_CLAUDE_PATH env var to the full path of the claude binary."
  exit 1
fi

ANTHROPIC_BASE_URL="$ANALYZER_URL" exec "$REAL_CLAUDE" "$@"
