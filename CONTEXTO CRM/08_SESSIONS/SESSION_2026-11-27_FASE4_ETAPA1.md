# SESIÓN 2026-11-27 — Fase 4, etapa 1: monorepo, migración de VOCERO y base verificable

## Objetivo

Iniciar la Fase 4 (S4.1) según la instrucción maestra: preparar el monorepo y su
estructura, definir aplicaciones/paquetes y límites, establecer contratos de
integración versionados, migrar VOCERO sin alterar su comportamiento, preparar
la infraestructura multi-tenant, crear el adaptador para AGENTE-GENERAL y
configurar la base de pruebas de paridad y regresión.

## Hechos con evidencia

1. **Repositorio destino inicializado.** `ALBRA8/CRM-WHATSPOWER` estaba vacío (verificado con `git ls-remote`); este monorepo es su primer contenido. La procedencia de VOCERO queda por SHA en `apps/web/PROVENANCE.md` (commit `aa90a81`, PR #215 release/2.12.0).
2. **Monorepo pnpm creado** (workspace raíz con `allowBuilds`/`overrides` heredados de VOCERO); instalación limpia de 440 paquetes en 16,2 s.
3. **VOCERO 2.12.0 migrado íntegro a `apps/web`:** cero cambios de código fuente; único ajuste estructural: retiro del `pnpm-workspace.yaml` interno (pnpm solo lee el raíz) y del lockfile anidado. `next build` compiló **142 rutas API + 28 páginas + 43 tablas Drizzle**, coincidiendo exactamente con la auditoría.
4. **`packages/contracts` publicado:** catálogo de 18 errores tipados congelado por vigía, identidad triple, despacho estándar §4, bot API v1 (13 rutas congeladas), API v1 comercial (9 rutas), flujos §8, campañas §9, agenda §10, eventos de dominio.
5. **`packages/tenant` publicado:** AsyncLocalStorage fail-closed, `assertSameOrganization` (tenant_mismatch), eco de organización, lectura de cabeceras estándar.
6. **`services/agent-gateway` publicado:** cliente con HMAC-SHA256(cuerpo+timestamp), fail-closed sin credenciales, reintentos con backoff sobre 5xx, health (interruptor `sin_cerebro`), cola HITL y resultados de ejecución — probado contra servidor HTTP real.
7. **`services/flows` (firma de puente ±300 s, timing-safe) y `services/campaigns` (máquina de estados de campaña, checks JIT):** esqueletos de contrato sin duplicar lógica de negocio (motor completo en F9, clean-room para ULTRA).
8. **`packages/presets`:** 4 perfiles sectoriales de CRM-WHATSAPP (MIT, AILINK) con atribución.
9. **`infra/`:** docker-compose PG16 + `001_roles.sql` (app_runtime/app_migrations/app_super) + `002_audit_log.sql` (append-only con hash encadenado y RLS) + `003_rls_policies.sql` (plantilla idempotente fail-closed). Ejecución real pendiente de Docker (F5) — documentado honestamente.
10. **CI definida** (`.github/workflows/ci.yml`): typecheck → lint → test → build; T1-T15 se añadirán en S5.3.

## Resultado real de verificación (la salida completa está en `05_TESTS/TEST_INDEX.md`)

| Puerta | Resultado |
|---|---|
| `pnpm install` | OK (440 paquetes) |
| `pnpm -r typecheck` | **7/7 PASS** |
| `pnpm -r lint` | **PASS** (apps/web; resto sin script lint propio aún) |
| `pnpm -r test` | **1801/1801 PASS** (contracts 49 · tenant 15 · agent-gateway 10 · flows 8 · campaigns 5 · apps/web 1714 en 141 archivos) |
| `pnpm -r build` | **7/7 PASS** (incl. `next build` completo de VOCERO) |

Durante la verificación se corrigieron 6 defectos detectados por las propias
pruebas (listados con detalle en TEST_INDEX «Correcciones durante la verificación»).

## Entrega §10 del mandato

1. **Estructura real del monorepo:** `apps/web` + `services/{agent-gateway,flows,campaigns}` + `packages/{contracts,tenant,presets}` + `infra/` + `CONTEXTO CRM/`.
2. **Árbol de directorios:** ver README raíz y árbol en este documento (abajo).
3. **Responsabilidad de cada paquete:** tabla en README raíz.
4. **Contratos iniciales:** `packages/contracts` (15 operaciones del catálogo, bot API v1, errores tipados, flujos, campañas, agenda) — fuente `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md`.
5. **Estado de modularización de VOCERO:** migrado íntegro y verificable (142/28/43); reorganización en 14 dominios = S4.2 (próximo sprint); sin cambios de comportamiento.
6. **Matriz de capacidades:** `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` (156/156 mapeadas); en esta etapa ninguna capacidad se tocó: 67 conservar quedan intactas por migración directa.
7. **Resultados de build/lint/typecheck/tests:** tabla anterior + TEST_INDEX.
8. **Riesgos y decisiones pendientes:** L1/L2 (licencias CRM-ALBRA/ULTRA), O1 (backups), A1 (backplane SSE), Docker ausente en sandbox (verificación T1-T15 real), marca «WhatsPower» provisional (D-012).
9. **Archivos creados:** árbol abajo; modificados: ninguno de `apps/web/src`.

```
CRM-WHATSPOWER/
├── .github/workflows/ci.yml          CI obligatoria
├── .env.example                      plantilla de entorno (sin secretos)
├── package.json / pnpm-workspace.yaml / .gitignore / .editorconfig
├── LICENSE / NOTICE.md / README.md
├── CONTEXTO CRM/                     memoria de continuidad + 8 documentos rectores
├── apps/web/                         VOCERO 2.12.0 completo (+ PROVENANCE.md)
├── services/
│   ├── agent-gateway/{package.json,tsconfig.json,vitest.config.ts,src/{index.ts,client.ts},tests/client.test.ts}
│   ├── flows/{...,src/{index.ts,hmac.ts},tests/hmac.test.ts}
│   └── campaigns/{...,src/{index.ts,states.ts},tests/states.test.ts}
├── packages/
│   ├── contracts/{...,src/{index.ts,errors.ts,context.ts,dispatch.ts,bot-api.ts,v1-api.ts,flows.ts,campaigns.ts,agenda.ts},tests/{errors,context,dispatch-bot,v1-flows-campaigns}.test.ts}
│   ├── tenant/{...,src/{index.ts,context.ts,headers.ts},tests/tenant.test.ts}
│   └── presets/{package.json,README.md,clinica.md,inmobiliaria.md,reformas.md,generico.md}
└── infra/{README.md,docker-compose.yml,sql/{001_roles.sql,002_audit_log.sql,003_rls_policies.sql}}
```

## Decisiones registradas

D-005 (monorepo) y D-015 (estructura inicial de contracts) quedaron documentadas en `01_DECISIONS/DECISION_LOG.md`.

## Pendientes y próximo paso

- **S4.2:** reorganizar `apps/web/src/server/*` en los 14 dominios (sin cambios de comportamiento) + ganchos de `audit_log`.
- **S4.3:** test de vigilancia de fronteras + guiones E2E portados.
- **S4.1 (restante):** verificación de licencias desde lockfile + `THIRD_PARTY_NOTICES`.
- Confirmación del propietario: marca y licencias (D-008/D-009/D-012).
