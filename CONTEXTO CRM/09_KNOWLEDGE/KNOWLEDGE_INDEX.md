# KNOWLEDGE INDEX — conocimiento técnico consolidado

| # | Conocimiento | Documento | Estado |
|---|---|---|---|
| K-001 | Stack oficial del producto (Next.js 15, React 19, TS, Drizzle, better-auth, PG16, Zod, Tailwind) | `00_MASTER/ARQUITECTURA_MAESTRA_CRM.md`; `apps/web/package.json` | VIGENTE |
| K-002 | Matriz de licencias del ecosistema y prohibiciones de reuso | `09_KNOWLEDGE/MATRIZ_LICENCIAS.md`; `NOTICE.md` raíz | VIGENTE |
| K-003 | Patrones heredados probados: fail-closed, idempotencia por claves naturales, eco de org, anti-replay durable, clasificación SENT/REJECTED/UNCERTAIN, outbox con coalescing | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` | VIGENTE |
| K-004 | Patrones RLS: `FORCE ROW LEVEL SECURITY`, `current_setting('app.current_org', true)` fail-closed, `SET LOCAL` por transacción, roles `app_runtime`/`app_migrations` separados | `00_MASTER/MODELO_MULTI_TENANT.md` §4; `infra/sql/` | VIGENTE |
| K-005 | Formato de memoria de continuidad (carpetas numeradas + índices + estados VERIFIED/IN_PROGRESS), inspirado en la memoria de YOUTUBE-AUTOMATION | `README.md` de esta carpeta | VIGENTE |
| K-006 | Convenciones de código: ESM, TypeScript estricto, Zod en fronteras, nombres en español en dominio de negocio (herencia VOCERO), commit por entrega | `02_PROCESSES/PROCESS_INDEX.md` P-003 | VIGENTE |
| K-007 | Errores tipados congelados: los 18 códigos del catálogo no se renombran; guardados por prueba de vigía en `packages/contracts` | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §7 | VIGENTE |
| K-008 | Identidad de agente por tenant: `agent_id = "org:<organizationId>#<agenteLogico>"`, dominio `crm` | `00_MASTER/MODELO_MULTI_TENANT.md` §6 | VIGENTE |

## Reglas técnicas que no se discuten (resumen)

1. Una capacidad sin código + prueba no está implementada.
2. Sin contexto de tenant no hay consulta: fail-closed.
3. El token del canal nunca sale del CRM; los satélites despachan vía CRM.
4. La IA no se activa en producción hasta verificar aislamiento y seguridad del agente (mandato §5).
5. Toda operación de escritura es idempotente y auditada.
