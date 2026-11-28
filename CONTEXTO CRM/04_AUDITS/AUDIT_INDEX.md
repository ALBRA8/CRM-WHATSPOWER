# AUDIT INDEX — auditorías realizadas

| # | Auditoría | Alcance | Estado | Documento |
|---|---|---|---|---|
| A-001 | vocero-crm v2.12.0 | Stack, 28 páginas, 142 rutas API, 43 tablas, 65 specs, licencia MIT (Kevin Belier), commit `aa90a81` | COMPLETADA (2026-11-26) | `04_AUDITS/REPOSITORIOS_AUDITORIA.md` |
| A-002 | CRM-WHATSAPP (AILINK) | Instalador + 4 presets sectoriales + dependencias Baileys GPL (no se usa su canal) | COMPLETADA (2026-11-26) | ídem |
| A-003 | CRM-ALBRA v0.2.1 | Multi-tenant (RLS/switch-organization) como especificación; sin LICENSE | COMPLETADA (2026-11-26) | ídem |
| A-004 | WHATSPOWER | Motor de flujos: 12 nodos, locks, idempotencia, puentes HMAC, MIT | COMPLETADA (2026-11-26) | ídem |
| A-005 | WHATSPOWER-ULTRA | Motor de campañas: locks JIT, supresión, pacing, anti-replay; sin LICENSE | COMPLETADA (2026-11-26) | ídem |
| A-006 | AGENTE-GENERAL (albra-seed) | Cerebro: FastAPI, memoria, skills, MCP, HITL, firewall; sin org_id nativo | COMPLETADA (2026-11-26) | ídem |
| A-007 | Monorepo WhatsPower — etapa 1 | Estructura, contratos, tenant, servicios, infra, verificación typecheck/lint/test/build | COMPLETADA (2026-11-27) | `08_SESSIONS/SESSION_2026-11-27_FASE4_ETAPA1.md` + `05_TESTS/TEST_INDEX.md` |

## Auditorías pendientes

| # | Auditoría | Cuándo |
|---|---|---|
| A-008 | Verificación de licencias desde lockfile + generación de THIRD_PARTY_NOTICES | S4.1 (siguiente sprint) |
| A-009 | Regresión E2E completa de VOCERO en el monorepo (guiones portados) | S4.3 |
| A-010 | Batería T1-T15 sobre PostgreSQL real | F5 |
| A-011 | Auditoría de seguridad de la integración AGENTE-GENERAL (previa a producción) | F7 |
