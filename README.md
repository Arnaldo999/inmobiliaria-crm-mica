# Inmobiliaria CRM — Mica

Backend FastAPI del CRM Inmobiliaria de System IA (Mica). Migrado desde Airtable a Postgres en Easypanel Mica el 2026-05-27.

## Stack

- FastAPI + uvicorn
- psycopg (sync) → Postgres Mica (Easypanel)
- bcrypt + PyJWT (HS256, exp 30 días)

## Endpoints

- `GET /health` — sanity check con ping a DB
- `GET /tenant/mica-demo` — branding del tenant (lo consume el HTML al cargar)
- `POST /auth/login` — body `{email, password}` → `{token, nombre}`
- CRUD `/api/leads | /api/propiedades | /api/clientes-activos` (todos con JWT en header)
- Aliases `/crm/clientes | /crm/propiedades | /crm/activos` (compat con HTML heredado)
- `GET /crm/metricas` — counts agregados para dashboard

## Env vars (ver `.env.example`)

- `PG_DSN` — DSN Postgres Mica (DB `inmobiliaria_mica`)
- `JWT_SECRET` — secret para firmar JWTs
- `PORT` — opcional, default 8000

## Datos demo precargados

- 10 leads (mix calificado/contactado/no_contactado/en_negociacion)
- 10 propiedades (Buenos Aires/Córdoba/Mendoza/Rosario)
- 3 clientes activos
- 1 usuario: `mica@systemia.site` / `Mica2026!`

## Deploy

Configurado para auto-deploy en Easypanel Mica via Dockerfile. Service apunta a este repo, branch `main`.

## Chat IA

El asistente conversacional del CRM corre en el harness Mica ([Arnaldo999/harness-creando-mas](https://github.com/Arnaldo999/harness-creando-mas), tenant `mica-inmobiliaria-demo`), endpoint `https://agente.systemia.site/chat/stream`. No vive en este repo.

## Replica de

[Arnaldo999/system-ia-agentes](https://github.com/Arnaldo999/system-ia-agentes) (worker Lovbot Inmobiliaria de Robert), pero standalone y simplificado para el demo Mica.
