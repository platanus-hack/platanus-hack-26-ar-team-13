#!/bin/bash
# install.sh — instala safe-claude como reemplazo automático de claude
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAFE_CLAUDE="$SCRIPT_DIR/safe-claude.sh"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

echo -e "${BOLD}[safe-claude installer]${RESET}"

# Verificar que el script existe
if [ ! -f "$SAFE_CLAUDE" ]; then
  echo -e "${RED}Error: safe-claude.sh not found at $SAFE_CLAUDE${RESET}"
  exit 1
fi

chmod +x "$SAFE_CLAUDE"

# Detectar shell y rc file
detect_rc() {
  if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
    echo "$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ] || [ "$SHELL" = "/usr/bin/bash" ]; then
    echo "$HOME/.bashrc"
  else
    # Fallback: intentar ambos
    echo "$HOME/.zshrc"
  fi
}

RC_FILE=$(detect_rc)
ALIAS_LINE="alias claude='bash $SAFE_CLAUDE'"
MARKER="# safe-claude"

# Verificar si ya está instalado
if grep -q "$MARKER" "$RC_FILE" 2>/dev/null; then
  echo -e "${YELLOW}Already installed in $RC_FILE${RESET}"
  echo -e "To uninstall: run ${BOLD}./install.sh --uninstall${RESET}"
  exit 0
fi

# Uninstall mode
if [ "$1" = "--uninstall" ]; then
  if grep -q "$MARKER" "$RC_FILE" 2>/dev/null; then
    grep -v "$MARKER" "$RC_FILE" > "$RC_FILE.tmp" && mv "$RC_FILE.tmp" "$RC_FILE"
    echo -e "${GREEN}Uninstalled from $RC_FILE${RESET}"
    echo "Restart your terminal or run: source $RC_FILE"
  else
    echo "Not installed in $RC_FILE — nothing to remove."
  fi
  exit 0
fi

# Agregar alias al rc file
echo "" >> "$RC_FILE"
echo "$ALIAS_LINE $MARKER" >> "$RC_FILE"

echo -e "${GREEN}✓ Installed!${RESET} Alias added to $RC_FILE"
echo ""
echo "Run this to activate now (or open a new terminal):"
echo -e "  ${BOLD}source $RC_FILE${RESET}"
echo ""
echo -e "To uninstall: ${BOLD}./install.sh --uninstall${RESET}"
