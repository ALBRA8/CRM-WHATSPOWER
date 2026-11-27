# PROJECT STATE — CRM WHATSPOWER (Vestro)

**Estado unificado:** FASE 4 EN CURSO — etapas 1 y 2 (monorepo + 14 dominios) y etapa 3 (S4.3: fronteras, PostgreSQL real y E2E) CONSTRUIDAS Y VERIFICADAS.
**Última actualización:** 2026-11-27.
**Fuente:** ejecución real en sandbox de construcción + documentos rectores de F0-F3.

## Estado por fase

| Fase | Estado | Evidencia |
|---|---|---|
| F0 Documentación obligatoria | COMPLETADA | 8 documentos rectores en `CONTEXTO CRM/` |
| F1 Auditoría técnica y legal | COMPLETADA | `04_AUDITS/REPOSITORIOS_AUDITORIA.md` (6/6 repos clonados y auditados) |
| F2 Matriz de paridad | COMPLETADA | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` (156/156 mapeadas) |
| F3 Arquitectura y modelo | COMPLETADA | `00_MASTER/ARQUITECTURA_MAESTRA_CRM.md`, `00_MASTER/MODELO_MULTI_TENANT.md`, `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` |
| F4 Base funcional y modularización | **EN CURSO — etapas 1-3 completadas** | sesiones 2026-11-27 (etapa 1, S4.2, S4.3); verificación real en `05_TESTS/TEST_INDEX.md`; entrega en `ENTREGA_S4_3.md` |
| F5-F12 | PENDIENTES | dependencias duras: F5←F4 |

## Hito Fase 4 — etapa 1 (2026-11-27)

1. **Monorepo pnpm creado** en este repositorio (`apps/*`, `services/*`, `packages/*`, workspace raíz con `allowBuilds` y `overrides` heredados de VOCERO).
2. **VOCERO 2.12.0 migrado íntegro a `apps/web`** desde el commit `aa90a8146f05c836d0e1e242cb7f137e07b06e32` (PR #215 release/2.12.0), sin ningún cambio de código fuente; procedencia en `apps/web/PROVENANCE.md`. Único ajuste: retiro del `pnpm-workspace.yaml` interno (pnpm solo lee el workspace raíz; su `allowBuilds`/`overrides` se trasladó al raíz).
3. **`packages/contracts` creado:** catálogo de errores tipados (18 códigos, compatibilidad VOCERO congelada por prueba de vigía), contexto de tenant (cabeceras estándar), contrato de despacho estándar, API bot v1 (13 rutas), API v1 comercial, contratos de flujos y campañas, conectores de agenda, eventos de dominio — todo en Zod con suite propia.
4. **`packages/tenant` creado:** contexto de tenant con `AsyncLocalStorage`, `requireTenantId` fail-closed, eco de organización (`tenant_mismatch`) y helpers de cabeceras — con suite propia.
5. **`services/agent-gateway` creado:** cliente hacia AGENTE-GENERAL con firma HMAC-SHA256 (`X-Signature` + `X-Timestamp` + `X-Org-Id`), fail-closed sin clave, reintentos con backoff y health check — con suite propia sobre servidor HTTP real de prueba.
6. **`services/flows` y `services/campaigns` creados** como esqueletos de contrato (validador de ventana HMAC ±300 s y máquina de estados declarativa; sin lógica de negocio duplicada — Fase 9).
7. **`infra/` creado:** docker-compose de PostgreSQL 16, SQL de roles (`app_runtime` sin DDL), tabla `audit_log` tamper-evident (hash encadenado + triggers de solo-append) y plantillas de políticas RLS + batería T1-T15 documentada para CI (ejecución real en F5).
8. **Verificación real ejecutada** (typecheck, lint, tests, build): resultados exactos en `05_TESTS/TEST_INDEX.md`.

## Bloqueadores

- **L1/L2 (licencias):** CRM-ALBRA y WHATSPOWER-ULTRA sin respuesta de licencia. Mitigación vigente: cero código copiado; solo especificaciones. El bloqueo legal debe resolverse antes de F9.
- **O1 (operación):** sin backups configurados aún; obligatorio antes de cualquier entorno con datos reales.
- **A1 (SSE mono-instancia):** backplane multi-replica requerido en F5; hoy el núcleo conserva su comportamiento actual.

## Próximo paso

**S4.3 ENTREGADA** (2026-11-27): fronteras congeladas por vigía, batería multi-tenant 26/26 sobre PostgreSQL 16 real (RLS 39/39 tras corregir D-S43-1), adaptador del cerebro 16/16 con integración real (R-AG-1 y T9 pendientes lado cerebro), E2E real 269/302 checks verdes (resto por memoria del sandbox). Ver `ENTREGA_S4_3.md`. Pendientes habilitantes para F5: rol runtime `app_runtime` (grants en 004), backplane SSE, backups.
