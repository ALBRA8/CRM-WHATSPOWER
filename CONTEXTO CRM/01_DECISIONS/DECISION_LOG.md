# DECISION LOG — CRM WHATSPOWER (WhatsPower)

Formato: D-XXX · Estado · Decisión · Motivo/Evidencia. Las decisiones aquí no
se revierten sin nueva entrada que documente motivo e impacto.

## D-001 — Producto único SaaS sobre la base funcional de VOCERO
- **Estado:** VERIFIED (vigente).
- **Decisión:** construir UN producto CRM SaaS (WhatsPower) tomando VOCERO como base funcional completa; no una suma de seis repositorios ni un launcher de herramientas.
- **Motivo:** el mandato exige un SaaS empresarial completo, no una colección de módulos desconectados.

## D-002 — Conservación total de VOCERO (156 capacidades)
- **Estado:** VERIFIED (vigente).
- **Decisión:** migrar VOCERO 2.12.0 íntegro a `apps/web` sin cambios de comportamiento; toda adaptación conserva el resultado funcional y queda en la matriz de paridad.
- **Evidencia:** `apps/web/PROVENANCE.md` (commit `aa90a81`), matriz en `00_MASTER/`.

## D-003 — AGENTE-GENERAL único cerebro, independiente
- **Estado:** VERIFIED (vigente).
- **Decisión:** razonamiento, memoria, herramientas, skills, MCP, workflows, firewall, HITL y observabilidad viven SOLO en AGENTE-GENERAL; WhatsPower se conecta por contratos y adaptadores versionados. Las especializaciones son configuración por organización, no motores separados.
- **Motivo:** prohibición de crear un segundo agente que compita.

## D-004 — Stack base: el de VOCERO
- **Estado:** VERIFIED (vigente).
- **Decisión:** Next.js 15 + React 19 + TypeScript + Drizzle ORM + better-auth + PostgreSQL 16 + Zod; Tailwind en UI. Los satélites se adaptan a este stack vía contratos (no se fuerzan a un mismo runtime).
- **Motivo:** minimizar el riesgo de regresión al conservar VOCERO.

## D-005 — Monorepo pnpm con límites de módulos
- **Estado:** VERIFIED (vigente).
- **Decisión:** workspace pnpm: `apps/web` (núcleo), `packages/contracts` (contratos versionados), `packages/tenant` (contexto), `services/agent-gateway|flows|campaigns` (satélites), `infra/` (BD, RLS). Dependencias entre paquetes solo vía `@whatspower/*`.
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

## D-012 — Marca provisional «WhatsPower»
- **Estado:** PROVISIONAL.
- **Decisión:** nombre de trabajo WhatsPower; paleta base #0B2447 + tipografía Inter/Archivo (OFL) según arquitectura maestra. Confirmación final pendiente del propietario; no bloquea construcción.
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

## D-016 — Rebrand VOCERO → WhatsPower
- **Estado:** VERIFIED (vigente).
- **Decisión:** se renombró la marca del producto en toda su superficie (UI, docs, specs, fixtures, infra, env vars `WHATSPOWER_*`, imagen del cerebro en el namespace ALBRA8); paquete `vocero-crm` → `@whatspower/web`; README y CHANGELOG reescritos.
- **Motivo:** identidad propia del producto comercial; la base funcional y el comportamiento quedan intactos (misma suite verde, mismas rutas).
- **Evidencia:** sesión S4.2 §2.2 (commit `c370cc4`); suite 1.801 verde; 142 rutas intactas (diff vacío vs baseline).

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

## D-024 — Backplane SSE vía LISTEN/NOTIFY de la misma PostgreSQL (F5, cierra A1)
- **Estado:** VERIFIED (vigente).
- **Decisión:** con `SSE_BACKPLANE=postgres` el bus de eventos de bandeja atraviesa instancias usando LISTEN/NOTIFY de la MISMA base de datos (canal `whatspower_sse`, conexión dedicada por proceso, reconexión con reintentos exponenciales). `publish()` en modo backplane NO emite localmente: el propio publicador recibe su evento por LISTEN y cada instancia entrega cada evento exactamente una vez. Payload ≤7900 bytes en claro; mayor → gzip+base64 automático; si aún excede, reparto local de respaldo + contador `droppedOversize` (el cliente hace catch-up con `since=`, contrato sse.md). `off` (default) conserva el EventEmitter in-process de S3/S4 byte-a-byte. Estado visible en `/api/health` (`sse.*`).
- **Motivo:** riesgo A1 heredado (mono-instancia) era bloqueador de producción multi-replica; la Constitución prohíbe servicios nuevos de cola, y la propia BD del CRM ya es el punto de encuentro natural entre instancias.
- **Evidencia:** `apps/web/tests/unit/sse-backplane.test.ts` 6/6 contra PostgreSQL 16.16 real (pg_notify de OTRA instancia llega al suscriptor local; exactly-once; compresión >7900 bytes íntegra; filtro por org) — F5.

## D-025 — Rol LOGIN de runtime `whatspower_runtime` (F5, operativo sobre el riesgo de S4.4 §7.2)
- **Estado:** VERIFIED (vigente).
- **Decisión:** `infra/sql/005_runtime_login.sql` crea el rol LOGIN `whatspower_runtime`, miembro del grupo `app_runtime` (DML de 004), con `NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS`. La app conecta con `DATABASE_URL_RUNTIME` si el despliegue la define (`apps/web/src/lib/db/index.ts`); sin ella usa `DATABASE_URL` como siempre. Verificación real: `apps/web/scripts/verificar-rol-runtime.mjs` 24/24 (solo DML+secuencias; DDL prohibido; RLS muerde sin contexto/cruzado; DML en su org; audit append-only; app operativa). El corte completo del HTTP al rol runtime exige propagar `app.current_org` por transacción en el pool (MODELO_MULTI_TENANT §5.3) — trabajo operativo declarado, no hecho en F5.
- **Motivo:** el runtime nunca debe ser dueño de los objetos; S4.4 dejó el cambio «como trabajo operativo de F5».
- **Evidencia:** batería multi-tenant 26/26 + verificador R1-R7 contra PostgreSQL real; `/api/health` reporta `dbRole:"owner"|"runtime"` según el despliegue.

## D-026 — Backups `pg_dump -Fc` con restauración verificada obligatoria (F5)
- **Estado:** VERIFIED (vigente).
- **Decisión:** respaldo en formato CUSTOM (`pg_dump -Fc`, restaurable y verificable con `pg_restore --list`), retención por días configurable, bitácora; restauración a base APARTE y verificación comparativa obligatoria (`verificar-restauracion.mjs`: conteos por tabla 44/44, RLS 39/39 con FORCE, cadena de hash de audit_log, migraciones). Ciclos repetibles en `infra/backup/` (backup.sh, restaurar.sh, prueba-respaldo-restauracion.sh, prueba-persistencia-recuperacion.sh). Programación con cron/systemd documentada; el `.dump` a almacenamiento externo (regla 3-2-1).
- **Motivo:** «un respaldo que nunca se restauró es una esperanza, no un respaldo»; riesgo O1 heredado.
- **Evidencia:** ciclo completo 5/5 (44 tablas idénticas, RLS restaurada, hash íntegro, 34 migraciones) y persistencia/crash PASS sobre PostgreSQL 16.16 real — F5.

## D-027 — Arista `platform→conversations` +1: /api/health observa el backplane
- **Estado:** VERIFIED (vigente).
- **Decisión:** el grafo congelado de `fronteras-dominios.test.ts` pasa de `platform->conversations: 1` a `2` con comentario: la segunda arista es `/api/health` leyendo el estado del backplane (read-only, observabilidad). Además `SseEvent` se extrae a `server/conversations/events/types.ts` para que bus y backplane compartan el tipo SIN ciclo de import nuevo (el vigía de ciclos siguió en 2, sin ciclo nuevo).
- **Motivo:** el vigía exige que todo acoplamiento nuevo sea una decisión consciente y documentada, no un accidente.
- **Evidencia:** `fronteras-dominios.test.ts` 9/9 tras la edición consciente; suite 1.825/1.825.

## D-028 — Checklist de producción del puente como puerta de salida de F5
- **Estado:** VIGENTE (por ejecutar en el despliegue real).
- **Decisión:** `CONTEXTO CRM/06_INTEGRATIONS/CHECKLIST_PRODUCCION_PUENTE.md` (A1-A4 secretos/rotación, B1-B7 cerebro, C1-C7 CRM, D1-D6 datos/operación) es la puerta de salida operativa: cada ítem exige evidencia verificable. La exposición pública queda PROHIBIDA sin autorización expresa (mandato F5 §7); el E2E completo (302) debe correrse en el host de despliegue (≥8 GB).
- **Motivo:** F5 autoriza preparación y validación de producción, no activación; el checklist deja explícito qué falta ejecutar FUERA del sandbox.
- **Evidencia:** documento con estado por ítem y límites declarados de F5.

## D-029 — Contabilidad honesta de checks E2E: total dinámico con evidencia individual (cierre post-F5)
- **Estado:** VERIFIED (vigente).
- **Decisión:** los informes de E2E usan el total EN EJECUCIÓN con evidencia individual por check; el guion 036 tiene 301 puntos `ok()` (302 contando la definición), pero el total real es dinámico (bucles que emiten por iteración y ramas por banderas). «302/302» solo se declara con UNA corrida continua completa en host ≥8 GB (checklist D6). Estado publicado: 270 (F5, corrida B) + 11 (R11, primera ejecución real) = **281 checks con evidencia individual, 0 FAIL acumulado**.
- **Motivo:** no declarar aprobado lo no ejecutado; presentar un total fijo de un total dinámico induce a error de lectura.
- **Evidencia:** `ENTREGA_CIERRE_POSTF5.md` §contabilidad; `scripts/e2e-r11-postf5.mjs` 11/11; `05_TESTS/TEST_INDEX.md` §CIERRE POST-F5.

## D-030 — Identidad de marca única: CRM WhatsPower
- **Estado:** VERIFIED (vigente).
- **Decisión:** renombrado completo de la marca del producto a **CRM WhatsPower** en toda la superficie del repositorio (383 archivos + renombres de ruta vía `git mv`): UI (marca por defecto `WhatsPower`, temas, favicon, `sw.js`), paquetes pnpm (raíz `crm-whatspower`, scope `@whatspower/*` y lockfile), variables de entorno (`WHATSPOWER_API_KEY`, `CRM_WHATSPOWER_VERSION`), cabeceras del contrato CRM del puente (`x-whatspower-signature`, `x-whatspower-dispatch-id`, `x-whatspower-organization`, `x-whatspower-event`, arnés `cerebro-falso` y E2E incluidos), MCP (servidor `crm-whatspower`, herramienta `configurar_whatspower`, realm `whatspower`), infra (imagen `ghcr.io/albra8/crm-whatspower` — se normaliza el typo heredado `crm-whatpower` —, DB/volúmenes `crm-whatspower-db`/`whatspower_*`, bucket `whatspower`), specs (`001-whatspower-core`), plugin Claude (`plugin/whatspower` + skill `configurar-whatspower`) y toda la documentación (README, ENTREGA, specs, CONTEXTO CRM). Correspondencia aplicada en todas las variantes de caja y composición del nombre anterior: identificadores y slugs en minúscula (`whatspower`, `crm-whatspower`, `whatspower.app`, `crm-whatspower-db`, `@whatspower/*`, correo E2E `@whatspower.test`), marca en CamelCase (`WhatsPower`) y constantes/env en MAYÚSCULAS (`WHATSPOWER_API_KEY`, `CRM_WHATSPOWER_VERSION`).
- **Motivo:** orden del propietario (2026-11-28): el proyecto se llama CRM WhatsPower y el nombre anterior ya no existe; una sola identidad evita enredos y confusiones entre los repositorios del ecosistema.
- **No cambia:** el protocolo del cerebro real (AGENTE-GENERAL usa `x-albra-metadata`; las cabeceras renombradas son del contrato CRM-side, actualizadas junto con su arnés y sus E2E), los contratos funcionales, las rutas de negocio, los estados publicados (`ff691d9` CRM / `7f6e908` cerebro) ni el historial git (sin rewrite; renombres con `git mv`). El trazo visual de marca se conserva (el nombre es lo que cambia; `isWhatsPowerName` compara «whatspower»).
- **Evidencia:** verificación del nombre anterior: 0 coincidencias en el árbol rastreado post-renombrado; los `.json` rastreados reparsean (incl. `openapi.json` de docs y api-v1); sesión `08_SESSIONS/SESSION_2026-11-28-c_REBRAND_CRM_WHATSPOWER.md`.

## D-031 — Acceso al demo sin registro: `DEMO_MODE` + `/api/demo/sesion`
- **Estado:** VERIFIED (vigente).
- **Decisión:** interruptor opcional `DEMO_MODE` (mismo patrón que `AGENDA`/`ATRIBUCION`/`API_V1`: el código viaja en main y la variable de despliegue decide si existe). Encendido, el login muestra «Entrar al demo»: `POST /api/demo/sesion` garantiza cuenta demo (`demo@whatspower.test`, contraseña fija SOLO server-side) y organización demo aislada (`slug: demo`, con semillas de pipeline y perfil de agente idénticas a un negocio nuevo), inicia sesión vía `auth.api.signInEmail({ asResponse: true })` y devuelve las cookies. Rate limit propio con la misma política de login/registro (FR-062, llave `/demo/sesion:<ip>` separada). Apagado: la ruta responde 404 mudo y el botón no se pinta.
- **Motivo:** pedido del propietario (2026-11-28): «ponle un botón para poder iniciar sin registro». El registro público sigue cerrado (FR-060): el demo NO abre registro, entra a una organización aislada por RLS que no toca los datos del negocio real.
- **Frontera:** el vigía de fronteras se actualizó a propósito: conteo de rutas API del núcleo 142 → 143 (comentario en `fronteras-dominios.test.ts`, estilo D-027). El grafo NO cambia: `HORAS_REACTIVACION_NUEVAS` se reexporta desde `on-signup.ts` y el demo toma la constante por ahí, evitando una segunda arista `identity->conversations`. La cuenta demo atraviesa `runInternalSignup` (bypass interno ya existente) PERO se rechaza en instancia virgen (409 `ErrorInstanciaSinInicializar`): en una instalación nueva el demo jamás roba la primera organización al propietario real.
- **Evidencia:** `tests/unit/demo-sesion.test.ts` 23/23; `fronteras-dominios.test.ts` 9/9; typecheck limpio; suite apps/web 1.748/1.752 (los 4 restantes son los de `sse-backplane`, que exigen PostgreSQL real y no corren en sandbox).

## D-032 — El demo entra también en instancia virgen: la organización demo no decide el arranque
- **Estado:** VERIFIED (vigente). Sustituye la frontera «409 en instancia virgen» de D-031 (que queda como histórico).
- **Decisión:** `POST /api/demo/sesion` funciona desde la PRIMERA visita, sin registro previo del propietario. Tres piezas:
  1. **Alta sin arranque**: la cuenta demo se crea vía `auth.api.signUpEmail` envuelta en `runWithoutOnboarding` + `runInternalSignup` (`lib/auth/index.ts`, mismo patrón AsyncLocalStorage en globalThis que el bypass de registro): el hook `user.create.after` (ahora `alCrearUsuario`, exportado para poder probarlo) NO dispara `onUserCreated`, así que el demo jamás queda como dueño de la primera organización.
  2. **La org demo no decide el arranque**: `contarOrganizacionesReales` (nueva, en `lib/db/instancia.ts`) cuenta organizaciones con `slug <> 'demo'` y la usan `onUserCreated` (dentro del tx del advisory lock 874201) e `isPublicSignupAllowed` (FR-060): el propietario real conserva su primer registro y el registro público sigue abierto hasta que exista SU organización. «demo» es slug reservado.
  3. **La org demo no es la de la instancia**: `resolveInstanceOrg` (bot/API), y las ramas sin sesión de branding y apariencia, filtran `slug <> 'demo'` — en una instalación donde solo se entró al demo, el bot/OAuth quedan sin organización (los consumidores ya tratan el null, y null no se cachea) y el login muestra marca/tema de fábrica.
- **Motivo:** pedido del propietario (2026-11-28): «al parecer es obligatorio hacer registro, podemos saltar eso para seguir el proceso normal?». El diseño D-031 bloqueaba el demo en una instalación nueva para proteger la primera organización; con el arranque suprimido esa protección se logra sin bloquear la entrada.
- **Frontera:** el grafo congelado del vigía NO cambia: la regla vive en `lib/db/instancia.ts` porque la consumen tres dominios (identity, agents, platform) y los imports por `lib/` no son aristas del grafo (`fronteras-dominios.test.ts` solo mapea `src/server`). La ruta `/api/demo/sesion` ya contaba en el 143 (D-031).
- **Evidencia:** `tests/unit/alta-demo-sin-arranque.test.ts` 4/4 (hook suprimido, sin fugas de contexto); `tests/unit/demo-sesion.test.ts` 23/23 (incl. instancia virgen → 200 con cuenta+org+semillas); `tests/unit/registration.test.ts` 5/5 (solo la org demo → registro abierto); typecheck limpio; suite apps/web 1.753/1.757 (los 4 restantes son los ambientales de `sse-backplane`, que exigen PostgreSQL real).

## D-033 — Acceso de PRUEBA sin registro: el proceso real de principio a fin (sustituye el demo aislado de D-031/D-032)
- **Estado:** VERIFIED (vigente). TEMPORAL por diseño: es una puerta de pruebas que el propietario quitará («para pruebas no más»).
- **Decisión:** con `PRUEBA_MODE=on` (legacy `DEMO_MODE=on`, mismo efecto: despliegues vivos no cambian nada), el login muestra «Entrar sin registro» → `POST /api/prueba/sesion`:
  1. **Alta por el camino REAL**: en una instancia virgen crea la cuenta propietaria (`prueba@whatspower.test`, contraseña fija SOLO server-side) vía `auth.api.signUpEmail` dentro de `runInternalSignup`, SIN suprimir el hook: `onUserCreated` crea la organización de la instancia (`slug: principal`), siembra pipeline/perfil y la guía de inicio sale como a cualquier propietario. NO hay organización demo ni datos de ejemplo: lo configurado durante la prueba queda en la organización real (aclaración del propietario: «no es pasar directo al dashboard sino que me permita seguir el proceso sin registro»).
  2. **Solo instancia virgen**: si `contarOrganizacionesReales > 0` y no existe la cuenta de prueba → 409 `ya_inicializada` sin crear nada (nadie entra a la organización de otro). Con la cuenta de prueba ya creada el botón es REENTRADA (solo `signInEmail`, idempotente, seguro aunque la instancia esté inicializada).
  3. **Se renombra el mecanismo**: módulo `identity/auth/demo.ts` → `prueba.ts`, ruta `/api/demo/sesion` → `/api/prueba/sesion` (el conteo del vigía sigue 143), botón «Entrar al demo» → «Entrar sin registro». La maquinaria de supresión del hook de D-032 (`runWithoutOnboarding`/`alCrearUsuario`) se elimina: nada la usa. El filtro de organizaciones demo (`contarOrganizacionesReales`, D-032) SE CONSERVA: las instalaciones que llegaron a crear la org demo entre D-032 y D-033 siguen contando como vírgenes y pueden bootstrappear la organización real.
  4. **Salida**: al quitar la bandera, la instancia queda inicializada tal cual; para dejarla con una cuenta propia se reinicia la BD y se registra el propietario, o se actualiza el correo/contraseña de la cuenta de prueba en la BD.
- **Motivo:** aclaración del propietario (2026-11-28): el demo de D-031/D-032 llevaba a una organización aparte con datos de ejemplo; lo que se necesita es recorrer el PROCESO NORMAL (organización, guía, configuración) sin registrarse, y quitar la puerta después.
- **Frontera:** el grafo congelado NO cambia (la regla de conteo sigue en `lib/db/instancia.ts`; `identity->conversations` queda en 1 con el import directo de `on-signup.ts`, ya que desaparece el reexport que solo consumía el demo). Conteo de rutas 143 (renombrada, no nueva).
- **Evidencia:** `tests/unit/prueba-sesion.test.ts` (bandera+legacy, 404 mudo, 429 con llave propia, virgen→alta real+sesión, ya inicializada→409 sin tocar nada, reentrada solo sign-in, carrera benigna); `fronteras-dominios.test.ts` 9/9; typecheck limpio; suite apps/web completa con solo los 4 fallos ambientales de `sse-backplane` (PostgreSQL real).
