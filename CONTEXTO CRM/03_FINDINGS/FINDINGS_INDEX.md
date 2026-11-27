# FINDINGS INDEX — hallazgos con evidencia

| # | Hallazgo | Impacto | Estado | Evidencia |
|---|---|---|---|---|
| F-001 | Baileys/libsignal son GPL-3.0 | Excluidos del producto comercial; solo APIs oficiales de canal (D-007) | VERIFIED | `04_AUDITS/REPOSITORIOS_AUDITORIA.md` (CRM-WHATSAPP/CRM-ALBRA dependencias) |
| F-002 | CRM-ALBRA sin archivo LICENSE («all rights reserved») | Código no reutilizable; solo especificaciones funcionales | VERIFIED | `09_KNOWLEDGE/MATRIZ_LICENCIAS.md` |
| F-003 | WHATSPOWER-ULTRA sin LICENSE | Reconstrucción clean-room de campañas obligatoria | VERIFIED | `09_KNOWLEDGE/MATRIZ_LICENCIAS.md` |
| F-004 | AGENTE-GENERAL sin multi-tenant real: memoria sin org_id, SQLite local | Activación en producción exige mapeo `org:*` + backend Postgres tenant-safe (D-014) | VERIFIED | auditoría del repo; `00_MASTER/MODELO_MULTI_TENANT.md` §6 |
| F-005 | VOCERO: 40/43 tablas ya org-scoped; 3 tablas de sesión auth fuera del modelo | RLS directa sobre la base existente; F5 con menor fricción | VERIFIED | `00_MASTER/MODELO_MULTI_TENANT.md` §4 |
| F-006 | VOCERO carece de etiquetas, asignación de asesor, cotizaciones y catálogo de productos | Capacidades nuevas tomadas de especificaciones WHATSPOWER/CRM-ALBRA (filas «NUEVA» de la matriz) | VERIFIED | `00_MASTER/MATRIZ_PARIDAD_VOCERO.md` |
| F-007 | SSE de VOCERO es mono-instancia | Backplane multi-replica requerido en F5 (riesgo A1) | VERIFIED | `07_FAILURES/RIESGOS_TECNICOS.md` |
| F-008 | Despacho estándar de VOCERO con coalescing + 3 reintentos + red de seguridad | Comportamiento conservado íntegro en el contrato de despacho | VERIFIED | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §4 |
| F-009 | ULTRA: checks JIT fail-closed <50 ms y anti-replay durable | Especificación obligatoria de la reconstrucción (no negociable) | VERIFIED | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §9 |
| F-010 | `pnpm-workspace.yaml` interno de VOCERO incompatible con monorepo | Retirado de `apps/web`; `allowBuilds`/`overrides` trasladados al raíz; cero cambios de código | RESUELTO (2026-11-27) | `apps/web/PROVENANCE.md` |
| F-011 | Repo destino ALBRA8/CRM-WHATSPOWER estaba vacío (sin commits) | Inicialización desde cero en este repositorio; historia de VOCERO queda documentada por SHA en PROVENANCE, no en git history | VERIFIED (2026-11-27) | sesión 2026-11-27 |

## Regla

Un hallazgo solo se marca RESUELTO con evidencia de la solución. Los VERIFIED
que implican trabajo futuro permanecen abiertos hasta que la fase correspondiente
los cierre con prueba.
