# safe-claude — AI Security for Claude Code

**safe-claude** protects developers from malicious `.claude/settings.json` hooks and dangerous tool calls when using [Claude Code](https://claude.ai/download). It acts as a transparent security proxy: every tool invocation is analyzed by a rule engine and an LLM before execution.

<img src="./project-logo.png" alt="Project Logo" width="200" />

Track: 🛡️ AI Security · Platanus Hack 26 Buenos Aires · Team 13

- Tomas Ignacio Emanuel ([@tomasemanuel](https://github.com/tomasemanuel))
- Rocio Platini ([@rplatini](https://github.com/rplatini))
- Julieta Zimmerman ([@Julizimmerman](https://github.com/Julizimmerman))
- Magali Burstein ([@Magaliburstein](https://github.com/Magaliburstein))

---

## Quick Start (End Users)

Install safe-claude with a single command. The installer registers you, issues your API key, and configures your shell automatically.

```bash
curl -fsSL https://platanus-hack-26-ar-team-13-production.up.railway.app/install | bash
```

Then reload your shell:

```bash
source ~/.zshrc   # or ~/.bashrc
```

From now on, running `claude` will automatically scan for malicious hooks and proxy all API calls through the security backend. See [SETUP.md](./SETUP.md) for the full user guide, manual registration, and troubleshooting.

---

## For Developers

### Prerequisites

- Node.js ≥ 18 (`node --version` to verify)

### Install dependencies

```bash
cd backend && npm install
```

### Environment variables

```bash
cp backend/.env.example backend/.env
# Open backend/.env and set ANTHROPIC_API_KEY
```

| Variable | Default | Required | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Yes** | Your Anthropic API key (`sk-ant-...`) |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | No | Upstream Anthropic endpoint |
| `LLM_MODEL` | `claude-sonnet-4-6` | No | Model used for LLM security analysis |
| `PORT` | `3000` | No | Port the server listens on |
| `NODE_ENV` | `development` | No | `development` or `production` |
| `ENABLE_RULE_ENGINE` | `true` | No | Toggle rule-based pattern checks |
| `ENABLE_LLM_ANALYZER` | `true` | No | Toggle LLM semantic analysis |
| `RISK_SCORE_THRESHOLD` | `30` | No | Score boundary between allow and warn |

### Run

**Development** (watch mode):

```bash
cd backend && npm run start:dev
```

**Production**:

```bash
cd backend && npm run build && npm start
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Register a client and receive an API key |
| `POST` | `/auth/validate` | None | Validate an API key |
| `POST` | `/analyze` | Required | Claude Code PreToolUse hook — returns allow / warn / block verdict |
| `POST` | `/analyze/settings` | Required | Scan `.claude/settings.json` for malicious hooks |
| `POST` | `/v1/messages` | Required | Anthropic API proxy with tool call interception |
| `GET` | `/audit` | None | Paginated audit log |
| `GET` | `/audit/stats` | None | Per-client verdict statistics |
| `GET` | `/install` | None | One-liner installer script |
| `GET` | `/safe-claude.sh` | None | The safe-claude wrapper script |

Protected endpoints require `Authorization: Bearer <api-key>`. See [SETUP.md](./SETUP.md) for full API documentation, deployment instructions, and configuration reference.
