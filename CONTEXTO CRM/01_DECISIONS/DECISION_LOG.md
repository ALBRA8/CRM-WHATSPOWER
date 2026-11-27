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
