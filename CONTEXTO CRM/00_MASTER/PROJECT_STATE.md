# PROJECT STATE — CRM WHATSPOWER (Vestro)

**Estado unificado:** FASE 4 COMPLETADA (S4.1-S4.4) + F5 ENTREGADA + **CIERRE OPERATIVO POST-F5 ENTREGADO** (validación ampliada y controles del puente re-verificados; sin activación pública: pendiente de aprobación expresa del propietario).
**Última actualización:** 2026-11-28 (cierre post-F5, commit `dc7d153`).
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
| Cierre operativo post-F5 | **ENTREGADO 2026-11-28 — informe para aprobación expresa** | `ENTREGA_CIERRE_POSTF5.md` + commit `dc7d153`: R11 primera ejecución real 11/11 (ráfaga 700 sin OOM); controles del puente frescos (runtime 24/24, SSE 6/6, respaldo→restauración 5/5, persistencia/crash PASS, adaptador↔cerebro real `7f6e908` 19/19); contabilidad honesta: 270+11 = 281 checks con evidencia individual, 0 FAIL; estados publicados conservados (`ff691d9`/`7f6e908`) |
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

**CIERRE POST-F5 ENTREGADO** (2026-11-28, commit `dc7d153`): F5 conservada (`ff691d9` byte-a-byte; cerebro `7f6e908` sin cambios) y validación ampliada con evidencia real: E2E R11 ejecutado por primera vez **11/11 OK, 0 FAIL** (ráfaga de 700 peticiones sin OOM; en S4.3/S4.4/F5 la corrida continua moría por OOM antes de R11); controles del puente re-ejecutados frescos — rol runtime 24/24, backplane SSE 6/6, ciclo respaldo→restauración 5/5, persistencia/crash PASS, adaptador↔cerebro real 19/19; contabilidad honesta del total de checks (total dinámico; **281 checks con evidencia individual, 0 FAIL acumulado**; «302/302» exige corrida continua completa en host ≥8 GB). Dos hallazgos de entorno documentados, sin defectos de producto (`ENTREGA_CIERRE_POSTF5.md`).

**Pendiente antes de activar para clientes** (requiere autorización expresa del propietario): aprobación del informe de cierre; corrida E2E continua completa (302) en el host de despliegue ≥8 GB; checklist del puente (D-028) ejecutado en el despliegue real con secretos gestionados en el entorno; decisión de activación comercial.
