# PROJECT STATE — CRM WHATSPOWER (Vestro)

**Estado unificado:** FASE 4 COMPLETADA (S4.1-S4.4) + **F5 EN CURSO — preparación y validación de producción ENTREGADA** (sin activación pública: mandato F5 §7).
**Última actualización:** 2026-11-28 (F5).
**Fuente:** ejecución real en sandbox de construcción + documentos rectores de F0-F3.

## Estado por fase

| Fase | Estado | Evidencia |
|---|---|---|
| F0 Documentación obligatoria | COMPLETADA | 8 documentos rectores en `CONTEXTO CRM/` |
| F1 Auditoría técnica y legal | COMPLETADA | `04_AUDITS/REPOSITORIOS_AUDITORIA.md` (6/6 repos clonados y auditados) |
| F2 Matriz de paridad | COMPLETADA | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` (156/156 mapeadas) |
| F3 Arquitectura y modelo | COMPLETADA | `00_MASTER/ARQUITECTURA_MAESTRA_CRM.md`, `00_MASTER/MODELO_MULTI_TENANT.md`, `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` |
| F4 Base funcional y modularización | **COMPLETADA (S4.1-S4.4)** | sesiones 2026-11-27; `ENTREGA_S4_3.md`, `ENTREGA_S4_4.md` (R-AG-1 + T9 cerrados, PR #77 merged `7f6e908`) |
| F5 Preparación producción | **ENTREGADA 2026-11-28 — sin exposición pública** | `ENTREGA_F5.md`: rol runtime verificado 24/24 (D-025), backplane SSE 6/6 (D-024, A1 cerrado), backups+restauración 5/5 y persistencia/crash PASS (D-026), checklist del puente (D-028), secretos (infra/SECRETOS.md), observabilidad; suite 1.825/1.825, batería 26/26, cerebro 821 |
| F6-F12 | PENDIENTES | F6 requiere autorización expresa de activación + host de despliegue (≥8 GB para E2E completo) |

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
- **O1 (operación): RESUELTO EN F5** — backups automáticos programables + ciclo de restauración verificado (5/5) y persistencia/crash PASS; programación por cron/systemd documentada (D-026).
- **A1 (SSE mono-instancia): RESUELTO EN F5** — backplane LISTEN/NOTIFY (`SSE_BACKPLANE=postgres`) probado contra PostgreSQL real 6/6; `off` por defecto conserva el comportamiento de una instancia (D-024).

## Próximo paso

**F5 ENTREGADA** (2026-11-28): preparación y validación de producción sobre los estados publicados `f03048a` (CRM) y `7f6e908` (cerebro) — SIN exposición pública (mandato F5 §7). Entregado con evidencia real: rol runtime `vestro_runtime` con privilegios mínimos verificado 24/24 (D-025; corte completo del HTTP = operativo pendiente declarado), backplane SSE LISTEN/NOTIFY 6/6 (D-024), ciclo respaldo→restauración→verificación 5/5 + persistencia tras reinicio + recuperación tras crash SIGKILL (D-026), checklist de producción del puente (D-028), gestión de secretos (infra/SECRETOS.md), observabilidad (OBSERVABILIDAD.md + /api/health con `dbRole` y `sse`). Verificación: suite **1.825/1.825**, batería **26/26** (RLS 39/39), cerebro **821** (1 skip condicionado a NVIDIA_API_KEY), typecheck/lint/build verdes, 142 rutas y contratos 49/49 intactos, E2E 036 re-corrida (resultado exacto en `ENTREGA_F5.md`). Antes de activar para clientes: E2E completo en host ≥8 GB, checklist del puente ejecutado en el despliegue real, y autorización expresa del propietario.
