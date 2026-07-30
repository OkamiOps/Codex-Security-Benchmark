# Codex Security Benchmark

Aplicação local para disparar scans do [`@openai/codex-security`](https://github.com/openai/codex-security), visualizar findings, acompanhar custo estimado e comparar modelo × effort.

## Stack

- **Web:** Vite + React + TypeScript (`apps/web`)
- **API:** Node + Hono (`apps/api`)
- **Shared types:** `packages/shared`
- **Dados:** lê `~/.codex/state/plugins/codex-security` e espelha métricas em `data/benchmark.db`

## Pré-requisitos

- Node.js 22+ (ou 24+)
- pnpm
- Python 3.10+ (exigido pelo Codex Security)
- Login no Codex Security:

```bash
npx @openai/codex-security login
# ou
npx @openai/codex-security login --device-auth
```

## Setup

```bash
pnpm install
# se o pnpm pedir aprovação de build scripts:
pnpm approve-builds --all
pnpm install
pnpm dev
```

- UI: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

Na subida, a API indexa scans já existentes no state do Codex Security (ex.: Contion).

## Uso

1. **Dashboard** — gasto total, ranking modelo×effort, runs recentes  
2. **Novo scan** — escolha pasta/repositório, modelo, effort, max cost e inicie pela UI  
3. **Detalhe** — findings, evidência, progresso SSE enquanto o scan roda  
4. **Comparar** — 2+ runs para ranking high/$ e diff de findings  

## Variáveis opcionais

| Variável | Default | Efeito |
|---|---|---|
| `CODEX_SECURITY_STATE_DIR` | `~/.codex/state/plugins/codex-security` | State do plugin |
| `CODEX_SECURITY_BIN` | `npx` | Binário do CLI |
| `CSB_HOST` / `CSB_PORT` | `127.0.0.1` / `8787` | Bind da API |

## Aviso de custo

Scans podem ser caros. O Contion (gpt-5.6-sol / high) chegou a ~US$ 98 de estimativa. Use sempre `--max-cost` / o campo Max cost na UI. Os valores são **estimativas** de tokens API e podem diferir do consumo do plano ChatGPT.

## Scripts

```bash
pnpm dev          # api + web
pnpm dev:api
pnpm dev:web
pnpm typecheck
```
