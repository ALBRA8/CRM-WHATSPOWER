# CONTEXTO CRM — INDEX

**Estado:** FASE 4 COMPLETADA (S4.1-S4.4) / F5 PREPARACIÓN DE PRODUCCIÓN ENTREGADA (sin activación pública)
**Última actualización:** 2026-11-28 (F5: rol runtime, backplane SSE, backups con restauración verificada, checklist del puente, secretos, observabilidad — ver SESSION_2026-11-28_F5.md y ENTREGA_F5.md)

| Área | Archivo | Estado | Propósito |
|---|---|---|---|
| Master | `00_MASTER/INSTRUCCION_MAESTRA.md` | VIGENTE | instrucción de construcción de la Fase 4 y reglas del proyecto (mandato del propietario) |
| Master | `00_MASTER/PROJECT_STATE.md` | EN_CURSO | estado actual, hitos, bloqueadores y próximo paso |
| Master | `00_MASTER/ARQUITECTURA_MAESTRA_CRM.md` | APROBADO (F3) | arquitectura de 14 dominios, C4, stack, decisión de marca |
| Master | `00_MASTER/MODELO_MULTI_TENANT.md` | APROBADO (F3) | RLS, contexto de tenant, memoria por org, batería T1-T15 |
| Master | `00_MASTER/ROADMAP_CONSTRUCCION.md` | APROBADO (F3) | fases F0-F12 con sprints y criterios de aceptación |
| Master | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` | VIVA | 156 capacidades: conservadas / adaptadas / pendientes |
| Master | `00_MASTER/GLOSSARY.md` | V1 | términos del proyecto |
| Decisions | `01_DECISIONS/DECISION_LOG.md` | POPULATED (D-001..D-014) | decisiones arquitectónicas, legales y de proceso |
| Processes | `02_PROCESSES/PROCESS_INDEX.md` | POPULATED | procesos de trabajo: aceptación, reversión, paridad, licencias |
| Findings | `03_FINDINGS/FINDINGS_INDEX.md` | POPULATED (F-001..F-010) | hallazgos de auditoría y construcción con evidencia |
| Audits | `04_AUDITS/AUDIT_INDEX.md` | POPULATED | auditorías de los 6 repos + auditoría del monorepo |
| Tests | `05_TESTS/TEST_INDEX.md` | POPULATED | inventario de pruebas: ejecutadas con resultado real vs reportadas |
| Integrations | `06_INTEGRATIONS/INTEGRATION_INDEX.md` | POPULATED | AGENTE-GENERAL, flujos, campañas, canales oficiales |
| Integrations | `06_INTEGRATIONS/CHECKLIST_PRODUCCION_PUENTE.md` | VIGENTE (F5) | puerta de salida de producción del puente CRM↔cerebro con evidencia por ítem |
| Failures | `07_FAILURES/FAILURE_INDEX.md` | POPULATED | riesgos top, incidentes y prohibiciones |
| Sessions | `08_SESSIONS/SESSION_INDEX.md` | POPULATED | continuidad entre sesiones de trabajo |
| Knowledge | `09_KNOWLEDGE/KNOWLEDGE_INDEX.md` | POPULATED | licencias, stack, patrones y reglas técnicas |
| Knowledge | `09_KNOWLEDGE/OBSERVABILIDAD.md` | VIGENTE (F5) | probes, señales y convención de logs del CRM y del cerebro |

## Hitos vigentes

- **F0-F3 COMPLETADOS (2026-11-26):** 8 documentos rectores producidos y aprobados; auditoría real de los 6 repositorios; matriz de paridad de 156 capacidades; arquitectura maestra; modelo multi-tenant con batería T1-T15; contratos de integración; roadmap F0-F12; registro de 40+ riesgos.
- **FASE 4 — etapa 1 (2026-11-27):** monorepo pnpm creado en este repositorio; VOCERO 2.12.0 migrado íntegro a `apps/web` (commit `aa90a81`, sin cambios de código); `packages/contracts` (contratos versionados + catálogo de errores con prueba de vigía), `packages/tenant` (contexto fail-closed), `services/agent-gateway` (cliente firmado del despacho HITL), `services/flows` y `services/campaigns` (esqueletos de contrato), `infra/` (PG16 + RLS + audit_log); verificación real de typecheck/lint/test/build — resultados en `05_TESTS/TEST_INDEX.md` y `08_SESSIONS/SESSION_2026-11-27_FASE4_ETAPA1.md`.

## Próximo hito

S4.2: reorganización de `src/server/*` en los 14 dominios (sin cambios de comportamiento) + tabla `audit_log` con ganchos de auditoría en operaciones sensibles. No avanzar si la regresión VOCERO no está verde.
