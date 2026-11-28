# WhatsPower — CRM SaaS empresarial multi-tenant

**Repositorio del proyecto:** ALBRA8/CRM-WHATSPOWER
**Nombre de trabajo del producto:** WhatsPower (ver `CONTEXTO CRM/00_MASTER/PROJECT_STATE.md`)

WhatsPower es una plataforma CRM SaaS modular, multi-tenant y comercializable cuyo
núcleo funcional es **WHATSPOWER CRM** (conservado al 100 %) y cuyo **único cerebro
de inteligencia y ejecución es AGENTE-GENERAL**, conectado por contratos
versionados e independiente del núcleo.

## Estructura del monorepo

```
├── CONTEXTO CRM/          Memoria documental de continuidad + documentos rectores
├── apps/
│   └── web/               Núcleo WHATSPOWER 2.12.0 (Next.js 15 + React 19 + Drizzle + PG16)
├── services/
│   ├── agent-gateway/     Adaptador hacia AGENTE-GENERAL (despacho, firma HMAC, HITL)
│   ├── flows/             Motor de flujos (herencia WHATSPOWER, contrato versionado)
│   └── campaigns/         Motor de campañas (reconstrucción clean-room de ULTRA, Fase 9)
├── packages/
│   ├── contracts/         Contratos de integración versionados (Zod + catálogo de errores)
│   ├── tenant/            Contexto de tenant (AsyncLocalStorage, fail-closed, eco de org)
│   └── presets/           Perfiles sectoriales (herencia MIT de CRM-WHATSAPP)
└── infra/
    ├── docker-compose.yml PostgreSQL 16 para desarrollo
    └── sql/               Roles, audit_log tamper-evident y políticas RLS (Fase 5)
```

## Reglas de oro (no negociables)

1. **WHATSPOWER se conserva completo.** Ninguna capacidad se elimina ni se marca
   como implementada sin correspondencia verificable en código y pruebas.
   Matriz viva: `CONTEXTO CRM/00_MASTER/MATRIZ_PARIDAD_VOCERO.md`.
2. **AGENTE-GENERAL es el único cerebro.** Nada de razonamiento, memoria,
   herramientas, firewall ni aprobaciones se duplica en WhatsPower.
3. **Aislamiento multi-tenant en la base de datos** (RLS) y doble valla en la
   capa de aplicación. Fail-closed siempre.
4. **Licencias:** sin código de CRM-ALBRA ni WHATSPOWER-ULTRA; sin
   Baileys/libsignal. Ver `THIRD_PARTY_NOTICES.md` y la matriz de licencias.
5. **Contratos versionados:** todo cambio de contrato se publica en
   `packages/contracts` con su prueba de vigía.

## Desarrollo

```bash
pnpm install
pnpm typecheck   # verificación de tipos en todos los paquetes
pnpm lint        # lint en todos los paquetes
pnpm test        # pruebas unitarias (contracts, tenant, services, apps/web)
pnpm build       # construcción de paquetes y de apps/web
```

Infraestructura local (PostgreSQL 16 para desarrollo): `pnpm infra:up`.

## Documentación

Toda la documentación del proyecto vive en [`CONTEXTO CRM/`](CONTEXTO%20CRM/README.md):
estado del proyecto, instrucción maestra, arquitectura, modelo multi-tenant,
contratos, matrices de paridad y licencias, roadmap, riesgos, sesiones y
conocimiento técnico.
