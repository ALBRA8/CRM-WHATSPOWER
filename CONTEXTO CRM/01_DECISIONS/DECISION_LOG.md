# DECISION LOG — CRM WHATSPOWER (Vestro)

Formato: D-XXX · Estado · Decisión · Motivo/Evidencia. Las decisiones aquí no
se revierten sin nueva entrada que documente motivo e impacto.

## D-001 — Producto único SaaS sobre la base funcional de VOCERO
- **Estado:** VERIFIED (vigente).
- **Decisión:** construir UN producto CRM SaaS (Vestro) tomando VOCERO como base funcional completa; no una suma de seis repositorios ni un launcher de herramientas.
- **Motivo:** el mandato exige un SaaS empresarial completo, no una colección de módulos desconectados.

## D-002 — Conservación total de VOCERO (156 capacidades)
- **Estado:** VERIFIED (vigente).
- **Decisión:** migrar VOCERO 2.12.0 íntegro a `apps/web` sin cambios de comportamiento; toda adaptación conserva el resultado funcional y queda en la matriz de paridad.
- **Evidencia:** `apps/web/PROVENANCE.md` (commit `aa90a81`), matriz en `00_MASTER/`.

## D-003 — AGENTE-GENERAL único cerebro, independiente
- **Estado:** VERIFIED (vigente).
- **Decisión:** razonamiento, memoria, herramientas, skills, MCP, workflows, firewall, HITL y observabilidad viven SOLO en AGENTE-GENERAL; Vestro se conecta por contratos y adaptadores versionados. Las especializaciones son configuración por organización, no motores separados.
- **Motivo:** prohibición de crear un segundo agente que compita.

## D-004 — Stack base: el de VOCERO
- **Estado:** VERIFIED (vigente).
- **Decisión:** Next.js 15 + React 19 + TypeScript + Drizzle ORM + better-auth + PostgreSQL 16 + Zod; Tailwind en UI. Los satélites se adaptan a este stack vía contratos (no se fuerzan a un mismo runtime).
- **Motivo:** minimizar el riesgo de regresión al conservar VOCERO.

## D-005 — Monorepo pnpm con límites de módulos
- **Estado:** VERIFIED (vigente).
- **Decisión:** workspace pnpm: `apps/web` (núcleo), `packages/contracts` (contratos versionados), `packages/tenant` (contexto), `services/agent-gateway|flows|campaigns` (satélites), `infra/` (BD, RLS). Dependencias entre paquetes solo vía `@vestro/*`.
- **Motivo:** separación de responsabilidades exigida por la instrucción maestra §3.

## D-006 — Multi-tenant: PostgreSQL compartido + RLS + doble valla
- **Estado:** VERIFIED (vigente).
- **Decisión:** RLS por `organization_id` con `FORCE`, rol `app_runtime` sin DDL, `SET LOCAL app.current_org` por transacción, contexto en AsyncLocalStorage, batería T1-T15 en CI sobre PostgreSQL real. Schema/BD por tenant quedan como variante enterprise futura.
- **Motivo:** aislamiento demostrable, no filtros de frontend.

## D-007 — Canales: solo APIs oficiales
- **Estado:** VERIFIED (vigente).
- **Decisión:** exclusión de Baileys/libsignal (GPL-3.0) del producto comercial; WhatsApp vía Meta Cloud API; webhooks con doble autenticación (token de URL timing-safe + firma del proveedor) y persistencia antes del ACK.
- **Motivo:** licencias incompatibles + políticas de plataforma.

## D-008 — CRM-ALBRA: especificaciones sí, código no
- **Estado:** VERIFIED (vigente).
- **Decisión:** CRM-ALBRA no tiene licencia → su código NO se reutiliza; sus capacidades (RBAC fino, switch-organization, especs comerciales) se reconstruyen con implementación independiente.
- **Motivo:** matriz de licencias; riesgo legal L1.

## D-009 — WHATSPOWER-ULTRA: reconstrucción clean-room
- **Estado:** VERIFIED (vigente).
- **Decisión:** sin licencia → se heredan solo especificaciones funcionales (locks de conversación, checks JIT fail-closed <50 ms, supresión, pacing como calidad, anti-replay durable, clasificación SENT/REJECTED/UNCERTAIN); implementación nueva en `services/campaigns` (Fase 9).
- **Motivo:** riesgo legal L2.

## D-010 — WHATSPOWER (MIT): motor de flujos como servicio independiente
- **Estado:** VERIFIED (vigente).
- **Decisión:** el motor de flujos (12 nodos, locks, idempotencia, MIT) se integra como servicio satélite con contrato HMAC; el CRM no espera su resultado para mostrar el mensaje en bandeja.
- **Motivo:** degradación limpia: la indisponibilidad del motor no afecta bandeja ni pipeline.

## D-011 — CRM-WHATSAPP (MIT): presets e instalador reutilizables
- **Estado:** VERIFIED (vigente).
- **Decisión:** perfiles sectoriales copiados a `packages/presets` con atribución; instalador/plantillas se reutilizan en F8.
- **Motivo:** MIT permite reuso con licencia conservada.

## D-012 — Marca provisional «Vestro»
- **Estado:** PROVISIONAL.
- **Decisión:** nombre de trabajo Vestro; paleta base #0B2447 + tipografía Inter/Archivo (OFL) según arquitectura maestra. Confirmación final pendiente del propietario; no bloquea construcción.
- **Impacto:** cambio de marca afectaría solo tokens de UI y naming comercial, no contratos.

## D-013 — Contratos versionados y catálogo único de errores
- **Estado:** VERIFIED (vigente).
- **Decisión:** rutas `/v1/…`; incompatible → `/v2` + deprecación. Los códigos de error existentes (`ai_paused`, `window_closed`, `sandbox_violation`, `sin_cerebro`, …) NO se renombran. Todo cambio se publica en `packages/contracts` con prueba de vigía.
- **Motivo:** compatibilidad con agentes ya conectados al contrato VOCERO.

## D-014 — Memoria del agente aislada por organización
- **Estado:** VERIFIED (vigente).
- **Decisión:** identidad `agent_id = "org:<organizationId>#<agenteLogico>"`, dominio `crm`; backend de memoria en Postgres del CRM (tablas org-scoped con RLS); prohibida la memoria SQLite de producción para datos de negocio; conocimiento comercial desacoplado en `kb_entry` consumible por `GET /v1/knowledge`.
- **Motivo:** AGENTE-GENERAL no tiene org_id nativo; activación en producción exige este aislamiento (mandato §5).

## D-015 — Sesión 2026-11-27: estructura inicial de contracts
- **Estado:** VERIFIED.
- **Decisión:** `packages/contracts` implementa con Zod: catálogo de errores, contexto de tenant, despacho, bot API v1, API v1, flujos, campañas, agenda y eventos; incluye prueba de vigía que congela los códigos de error (D-013).
- **Evidencia:** `packages/contracts`, resultados en `05_TESTS/TEST_INDEX.md`.

## D-016 — Rebrand VOCERO → Vestro con consolidación legal de la atribución MIT
- **Estado:** VERIFIED (vigente).
- **Decisión:** se eliminó toda traza de marca y autoría del producto (UI, docs, specs, fixtures, infra, env vars `VESTRO_*`, imagen del cerebro en el namespace ALBRA8). La atribución exigida por la licencia MIT del código heredado se consolidó en un ÚNICO archivo legal `THIRD_PARTY_NOTICES.md` de la raíz (práctica estándar; invisible para el producto). Se retiraron `apps/web/LICENSE` y `NOTICE.md`.
- **Motivo:** la supresión total del aviso de copyright incumpliría la MIT del código heredado (apps/web) y expondría legalmente al proyecto comercial; el archivo único cumple el requisito sin afectar marca ni comercialización.

## D-017 — Fronteras de dominios S4.2 (src/server)
- **Estado:** VERIFIED (vigente).
- **Decisión:** `analytics/` → `platform/` (reportes transversales, no hay dominio Analytics en la maestra); capa `http/` disuelta hacia `<dominio>/http/` con compartidos (`compartido.ts`, `enlaces.ts`) en Platform; `events/bus.ts` → Conversations (SSE de hilo); `lab/` → Agents; dominios sin código (audit/billing/campaigns/automation) con README stub. Interfaces públicas intactas: mismos handlers, mismas rutas, mismos códigos de error.
- **Evidencia:** sesión S4.2; suite 1.801 verde; diff de rutas vacío.

## D-018 — Endpoints del cerebro en ejemplos/defaults → contrato AGENTE-GENERAL
- **Estado:** VERIFIED (vigente).
- **Decisión:** ejemplos y defaults de `BRAIN_DISPATCH_URL`=`http://agente:8000/crm/dispatch` y `BRAIN_HEALTH_URL`=`http://agente:8000/health` (derivación `/health` del código intacta); servicio compose `agente` con imagen `ghcr.io/albra8/agente-general` (pendiente de publicar: R-AG-1).
- **Motivo:** coherencia con `packages/contracts` §4 (despacho firmado) y con el cliente de `services/agent-gateway`.

## D-019 — RLS dinámica sobre TODA tabla org-scoped (corrige D-S43-1)
- **Estado:** VERIFIED (vigente).
- **Decisión:** `infra/sql/003_rls_policies.sql` ya no lleva una lista fija de 22 nombres: descubre dinámicamente toda tabla de `public` con columna `organization_id` y le aplica `ENABLE + FORCE ROW LEVEL SECURITY` + política `tenant_isolation` fail-closed (`current_setting('app.current_org', true)`). El script además ABORTA si queda cualquier tabla org-scoped sin RLS. Se añade `infra/sql/004_grants.sql` (privilegios DML del rol `app_runtime` + privilegios por defecto para tablas futuras), completando el modelo de roles §4.1 del MODELO_MULTI_TENANT.
- **Motivo:** la batería real demostró que solo 15 de 39 tablas org-scoped tenían RLS (24 sin aislar, incluidas las 7 de credenciales y las 3 de OAuth). La lista fija se desalineaba de los nombres reales de las migraciones.
- **Evidencia:** batería multi-tenant 26/26 en PostgreSQL 16 real (`apps/web/scripts/bateria-multi-tenant.mjs`, `pnpm test:multi-tenant`); cobertura 39/39.

## D-020 — Ciclos de import heredados congelados por vigía, sin refactor en S4.3
- **Estado:** VERIFIED (vigente).
- **Decisión:** la prueba `fronteras-dominios.test.ts` congela el grafo de dependencias entre dominios (38 aristas) y los ciclos de archivo: en RUNTIME el único ciclo de valores es `conversations/inbox` (`ingest→reacciones→send→ingest`, heredado de VOCERO, verificado en el baseline pre-S4.2 `c370cc4`) y en FUENTE existe además el ciclo benigno de solo-tipos `integrations/mcp` (se borra en runtime). Cualquier arista o ciclo NUEVO rompe la prueba. No se refactorizó: el mandato S4.3 prohíbe refactors no demostrados por defectos de comportamiento; la reducción de acoplamiento (eventos de dominio) queda para su etapa.
- **Motivo:** congelar la frontera impide que el acoplamiento heredado crezca sin decisión consciente, sin arriesgar el comportamiento conservado.

## D-021 — `invitation.created_at` (corrige D-S43-3, defecto latente de VOCERO)
- **Estado:** VERIFIED (vigente).
- **Decisión:** se añade `created_at` a la tabla `invitation` (schema Drizzle + migración aditiva `0033_next_captain_stacy.sql`). better-auth (plugin organization) exige la columna y el registro/invitación devolvía 500 `SCHEMA_MISMATCH` contra PostgreSQL real; el defecto era invisible en unitarios (sin BD) y en el flujo documentado se manifiesta al primer E2E real.
- **Motivo:** defecto demostrado por la prueba E2E; corrección mínima y aditiva (una columna con default `now()`), sin tocar comportamiento existente.
- **Evidencia:** self-test E2E: registro y 269 verificaciones verdes tras la corrección; sin ella, 0 verificaciones posibles.

## D-022 — El puente CRM vive en la capa de especialización del cerebro (R-AG-1)
- **Estado:** VERIFIED (vigente).
- **Decisión:** el endpoint `/crm/dispatch` se implementa en `src/albra_specialization/crm/bridge.py` (capa de especialización de AGENTE-GENERAL, patrón `albra_specialization/youtube`) y se monta mediante el hook genérico `extra_extensions` de `create_app` (callables `extension(app, ctx)`). El seed universal (`src/albra_seed/`) NO importa módulos de dominio; su vigía de contaminación (keyword `crm`) permanece en 0 hallazgos críticos. El endpoint cumple el contrato versionado §4: HMAC-SHA256(cuerpo+timestamp) ±300 s timing-safe, eco de organización + identidad D-014 (`tenant_mismatch`), RBAC `crm:dispatch` default-deny, veredictos de ActionFirewall (`firewall_denied`/`no_matching_rule`/`approval_required`), envelope del catálogo congelado (D-013), idempotencia por `(org, conversación, event_id)`, rate limit por org, persistencia del turno en memoria de tenant antes del ACK.
- **Motivo:** la primera implementación dentro de `src/albra_seed/` rompió el vigía de contaminación (55 hallazgos) — la frontera seed↔especialización es un invariant verificado del cerebro que no se negocia.
- **Evidencia:** `AGENTE-GENERAL/tests/integration/test_crm_dispatch.py` (25 pruebas contra la app real); `services/agent-gateway/tests/cerebro-real.test.ts` (9/9 contra el uvicorn real, incluido despacho 200, idempotencia, firma manipulada 401 y org cruzada 403 tipado); suite del cerebro 821/821.

## D-023 — T9: dimensión de organización en la memoria del cerebro
- **Estado:** VERIFIED (vigente).
- **Decisión:** la memoria de AGENTE-GENERAL añade `org_id` como PRIMERA componente de la clave de aislamiento `(org_id, agent_id, domain, user_id, context_id)`: campo en `MemoryRecord`, `MemoryIsolator.validate_org_id` (formato `org_<id>` fail-closed) y `assert_org_consistent` (si el `agent_id` lleva el prefijo D-014 `org:<X>`, un `org_id` explícito distinto es `PermissionError`), filtrado por cubeta de org en los tres stores (SQLite/InMemory/Vector) y validación en cada operación del `MemoryManager` (incluidas lecturas/borrados por `record_id`). Migración aditiva de BD pre-S4.4 (`ALTER TABLE ADD COLUMN org_id`; los registros existentes quedan en la cubeta legacy `""` que jamás se mezcla con una org) con el formato de índice legacy preservado byte-a-byte. `render_app.py` registra SQLite + MemoryManager y el health reporta `memory_store`/`memory_manager` configurados. El puente CRM escribe cada turno con `domain="crm"` y la org del evento firmado; el agent loop propaga `org_id` vía `Session`→`RunContext`.
- **Motivo:** bloqueador D-014/T9 para activar el agente; sin dimensión de organización, dos tenants podrían compartir cubeta si el `agent_id` no lleva prefijo.
- **Evidencia:** `AGENTE-GENERAL/tests/unit/test_memory_org_isolation.py` (15 pruebas, incluida migración legacy real y negativas cruzadas por store); pruebas de integración HTTP con org A/org B; suite del cerebro 821/821 sin perder ningún test de memoria preexistente.
