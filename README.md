# Hackan't — Real-time protection for Claude Code against malicious repos

<img src="./project-logo.png" alt="Hackan't Logo" width="200" />

**Track:** AI Security | **Team:** team-13 (Buenos Aires)

- Tomas Ignacio Emanuel ([@tomasemanuel](https://github.com/tomasemanuel))
- Rocio Platini ([@rplatini](https://github.com/rplatini))
- Julieta Zimmerman ([@Julizimmerman](https://github.com/Julizimmerman))
- Magali Burstein ([@Magaliburstein](https://github.com/Magaliburstein))

---

## Overview

Claude Code trusts the projects it opens. A malicious repo can manipulate the model via prompt injection to execute dangerous commands through its tools (Bash, Write, Edit) — and the user has no visibility into these attacks until after they happen.

Hackan't adds a real-time defense layer without changing the user's workflow: an **analysis proxy** that sits between Claude Code and `api.anthropic.com`. Claude Code points to the local IP where the client is running instead of the upstream API. The proxy intercepts every tool call the model attempts to execute, analyzes it, and either allows, warns, or blocks it before handing it back to the agent.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18 (`node --version` to verify)

### Install dependencies

```bash
cd backend && npm install
```

### Environment variables

Copy the example file and fill in your Anthropic API key — that's the only required value:

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
| `RISK_SCORE_THRESHOLD` | `50` | No | Score boundary between warn and block |

### Run

**Development** (watch mode, auto-restarts on file changes):

```bash
cd backend && npm run start:dev
```

**Production**:

```bash
cd backend && npm run build && npm start
```

The server starts on `http://localhost:3000`.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Claude Code PreToolUse hook — returns allow / warn / block verdict |
| `POST` | `/v1/messages` | Anthropic API proxy — intercepts `tool_use` blocks in responses |

To use the proxy, set `ANTHROPIC_BASE_URL=http://localhost:3000` in your Claude Code environment.
