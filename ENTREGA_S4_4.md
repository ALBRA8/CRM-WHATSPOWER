# ENTREGA S4.4 — CRM WHATSPOWER (Vestro)

**Fase:** Cierre de bloqueos de AGENTE-GENERAL — R-AG-1 (`/crm/dispatch`) y T9
(memoria aislada por organización) + pruebas completas.
**Repositorios:** `ALBRA8/CRM-WHATSPOWER` (rama `main`) y `ALBRA8/AGENTE-GENERAL` (rama `main`).
**Estado de partida:** `419c57b` (estado publicado de S4.3) — verificado antes de
modificar nada: copia local re-sincronizada del remoto, HEAD exacto `419c57b`,
árbol limpio. Baseline S4.3 confirmada: suite **1.816**, RLS 39/39, 142 rutas.
**Cerebro:** clon local de `AGENTE-GENERAL` en `main` (`a54c2e0`), árbol limpio;
suite propia baseline **781** verde antes de tocar nada.
**Fecha de ejecución:** 2026-11-27.
**Regla cumplida:** no se reconstruyó el proyecto ni se re-migró VOCERO; la
arquitectura verificada no se alteró (los cambios son aditivos o de aislamiento,
cada uno con prueba que impide su repetición).

---

## 1. Pruebas ejecutadas y resultados reales

| # | Batería | Resultado real |
|---|---|---|
| 1 | Suite completa monorepo CRM (`pnpm -r test`) | **1.819/1.819 PASS** — apps/web 1.723/1.723 (142 archivos) · contracts 49 · tenant 15 · flows 8 · campaigns 5 · **agent-gateway 19** |
| 2 | Typecheck (`pnpm -r typecheck`) | 6/6 Done, 0 errores |
| 3 | Lint (`pnpm -r lint`) | Done, 0 errores |
| 4 | Build (`pnpm -r build`) | OK — apps/web compilación completa + 6 paquetes TS |
| 5 | Rutas API | **142** `route.ts` bajo `src/app/api` (vigía permanente, dentro de la suite) |
| 6 | Contratos versionados (`packages/contracts`) | 49/49 — catálogo de errores congelado intacto (D-013) |
| 7 | Batería multi-tenant sobre PostgreSQL REAL (`pnpm --filter @vestro/web test:multi-tenant`) | **26/26 PASS** — servidor PostgreSQL **16.16** real en `127.0.0.1:5433`, migraciones desde base limpia (34), rol `app_runtime` con `SET ROLE`, cobertura **RLS 39/39 tablas org-scoped** |
| 8 | Vigía de fronteras entre dominios | 9/9 PASS (dentro de apps/web) |
| 9 | **Suite del cerebro AGENTE-GENERAL** (`pytest tests`, sin `llm_real`) | **821/821 PASS** — baseline 781 intacta + 40 nuevas (15 T9 memoria-org + 25 integración `/crm/dispatch`) |
| 10 | Integración REAL CRM ↔ cerebro (`cerebro-real.test.ts`, uvicorn real como proceso hijo) | **9/9 PASS** (health+memoria configurada, despacho real ACK, idempotencia real, HMAC manipulado 401, tenant cruzado 403 tipado, HITL 200, identidad org) |
| 11 | E2E self-test de VOCERO (036, corrida continua) | **269/302 checks verdes, 0 FAIL**; parada reproducible al inicio de R11 por memoria del sandbox (ver §7) |

Conservación de líneas base: la **1.816 de S4.3 está íntegra** dentro de la
actual (1.819 = 1.816 + 3 nuevas pruebas reales de integración cerebro); la
**781 del cerebro está íntegra** dentro de 821; la matriz de paridad de VOCERO
queda **sin cambio**; **ninguna prueba se eliminó ni debilitó** y ningún
comportamiento conservado cambió para conseguir verdes.

## 2. OBJETIVO 1 — R-AG-1: `/crm/dispatch` implantado en AGENTE-GENERAL

**Antes (S4.3):** `POST /crm/dispatch` → **404 real** contra el servidor FastAPI
del cerebro; el adaptador del CRM fallaba tipado.

**Ahora:** endpoint real, implementado en la **capa de especialización** del
cerebro (`src/albra_specialization/crm/bridge.py`) y montado por
`render_app.py` a través del hook genérico `extra_extensions` de `create_app`
(`src/albra_seed/api/app.py`). El seed universal de AGENTE-GENERAL NO importa
módulos de dominio — el vigía de contaminación (`tests/contamination`, keyword
`crm`) sigue en **0 hallazgos críticos**, así la frontera arquitectónica del
cerebro (seed vs especialización) queda intacta y verificada.

| Requisito del mandato | Cómo se cumple | Evidencia (pruebas reales) |
|---|---|---|
| Contrato versionado | Esquema pydantic que refleja campo a campo `CONVERSATION_TURN_RECEIVED` (`packages/contracts/src/dispatch.ts` §4); ACK exacto `{accepted, event_id, approvalRequired}`; errores con el **envelope tipado del catálogo congelado** (D-013): `validation_failed` 422, `tenant_mismatch` 403, `unauthorized_scope` 403, `firewall_denied` 403, `no_matching_rule` 403, `approval_required` 202, `rate_limited` 429 | 25 pruebas de integración contra la app real (`tests/integration/test_crm_dispatch.py`); 5 de ellas vía `TestClient` real + 9 contra el proceso uvicorn real desde el CRM |
| Autenticación HMAC | `X-Signature = HMAC-SHA256(cuerpo crudo + X-Timestamp, ALBRA_CRM_HMAC_SECRET)`; ventana de repetición **±300 s** (igual que `HMAC_TIMESTAMP_TOLERANCE_SECONDS` del contrato); comparación **timing-safe** (`hmac.compare_digest`); fail-closed sin secreto (503) | firma manipulada → 401 (2 pruebas); timestamp fuera de ventana → 401; sin secreto → 503 |
| Identidad y organización | Eco obligatorio: `X-Org-Id` DEBE ser igual a `organization.id` del cuerpo firmado; `organization.agentId` debe pertenecer a la MISMA organización (identidad D-014 `org:<orgId>#<agente>`); `org_id` con formato `org_<id>` | `tenant_mismatch` por eco (2 pruebas), por `agentId` cruzado (1) y `validation_failed` por formato (1) — contra servidor real |
| Firewall y políticas de ejecución | Perímetro de seguridad obligatorio (firewall o policy engine, si no 503); permiso RBAC explícito **`crm:dispatch`** vía PolicyEngine + PermissionRegistry (default-deny); veredicto de `ActionFirewall` sobre la acción `crm:dispatch`: ALLOW/DRY_RUN → sigue, DENY → `firewall_denied`, **sin regla → `no_matching_rule`** (default-deny), REQUIRE_HITL → `approval_required` 202 | 5 pruebas de firewall/RBAC reales (regla ausente, permiso ausente, REQUIRE_HITL, DENY, no-match) |
| Aprobaciones HITL | La retención del puente responde **202 `approval_required`** con `event_id` en `details` y NO persiste el turno hasta que una persona lo resuelva (el CRM lo muestra en su cola vía `GET /api/v1/approvals/pending`, ya verificada en S4.3 y re-verificada ahora 200) | prueba real 202 + cola pendiente vacía mientras la retención vive |
| Errores consistentes | Envelope `{"error": {code, message, details?}}` con estados del catálogo; `details` de validación **sanitizado** (nunca devuelve valores enviados); fallos de capa auth (401) mantienen la semántica HTTP llana como el resto de la API | verificación de envelope y sanitización en pruebas |
| Idempotencia | Ledger acotado por `(organización, conversación, event_id)` — la repetición devuelve el MISMO ACK sin reprocesar; el mismo `event_id` de OTRA organización NO colisiona (ledger por org) | 2 pruebas reales de idempotencia + prueba negativa entre orgs |
| Rate limit por organización | Ventana fija por org (`ALBRA_CRM_DISPATCH_RATE_PER_MINUTE`, 240/min por defecto) → 429 `rate_limited` + `Retry-After`; la ráfaga de una org NO throttling a otra | prueba real con límite 2/min |
| Persistencia (T9) | El turno se escribe en memoria de tenant con `(org_id, agent_id, domain=crm, user_id, context_id)` antes del ACK; sin memoria configurada el puente **no opera** (503 fail-closed) | el ACK va precedido de la escritura verificada en la prueba happy path |
| Integración de pruebas contra el servidor real | `cerebro-real.test.ts` levanta el **uvicorn real** del cerebro (proceso hijo, `render_app.py` + `ALBRA_CRM_HMAC_SECRET` compartido) y ejercita el adaptador del CRM de punta a punta — sin mocks de por medio | 9/9 PASS; el despacho real responde 200 `{accepted, event_id, approvalRequired:false}` y la repetición del mismo `event_id` vuelve a ACK 200 |

**No se simuló nada desde el adaptador CRM:** `services/agent-gateway/src/client.ts`
queda SIN cambios en esta fase; el que cambió de lado es el cerebro, que ahora
sirve el endpoint de verdad.

## 3. OBJETIVO 2 — T9: memoria de AGENTE-GENERAL aislada por organización

**Antes (S4.3):** `memory_store: not_configured` en core_only; el esquema
aislaba por `(agent_id, domain, user_id, context_id)` **sin dimensión de
organización** — bloqueador de producción (D-014).

**Ahora** (todo en el seed genérico, sin keywords de dominio — vigía de
contaminación 0 hallazgos):

1. **Dimensión de organización en TODO el circuito de memoria:**
   `MemoryRecord.org_id` (nuevo campo), clave compuesta
   **`(org_id, agent_id, domain, user_id, context_id)`** en `MemoryIsolator`
   (el org es la PRIMERA componente), y filtrado por cubeta de org en los tres
   stores (`SQLiteMemoryStore`, `InMemoryMemoryStore`, `VectorMemoryStore`).
2. **Validación de identidad y organización en cada operación:**
   `MemoryIsolator.assert_org_consistent` — si el `agent_id` lleva el prefijo
   D-014 `org:<X>`, un `org_id` explícito DEBE ser `X`; un desacople es
   `PermissionError` (nunca una advertencia). `org_id` con formato inválido se
   rechaza (`ValueError`) antes de tocar cualquier store. Aplica a
   `remember/recall/get/forget/cleanup_working/count` del `MemoryManager`.
3. **Protección contra consultas cruzadas:** consulta de org B sobre cubeta de
   org A → **0 filas** (la cubeta org es parte de la clave en los tres stores;
   `COALESCE(org_id,'')` en SQL mapea los registros legacy a la cubeta "" que
   jamás se mezcla con una org); lectura/borrado por `record_id` con org ajena →
   `PermissionError`.
4. **Aislamiento de recuperación, almacenamiento y contexto:**
   `MemoryRetriever.retrieve` propaga `org_id` al recall; `Session.org_id` →
   `RunContext.org_id` → las fases del agent loop (MEM-READ/MEM-WRITE/cleanup)
   escriben y leen SIEMPRE en la cubeta del tenant. El puente CRM escribe cada
   turno con `domain="crm"` y la org del evento firmado.
5. **Pruebas negativas entre organizaciones:** 15 pruebas unitarias
   (`tests/unit/test_memory_org_isolation.py`) + 5 de integración HTTP reales
   (despacho org A → consulta cruzada de org B por manager es `PermissionError`;
   ledger de idempotencia por org; rate-limit por org).
6. **Compatibilidad con la memoria existente:** migración **aditiva** de bases
   SQLite pre-S4.4 (`ALTER TABLE ADD COLUMN org_id` — probada creando una BD
   legacy real y abriéndola con el store nuevo: los registros viejos se leen
   intactos en la cubeta legacy y jamás se mezclan con cubetas de org). El
   formato de clave legacy `mem::agent::domain::user::ctx` se conserva
   byte-a-byte para índices existentes. **No se pierde información ni
   comportamiento** (suite completa 821/821 incluye todos los test de memoria
   preexistentes).
7. **Cerebro con memoria configurada:** `render_app.py` registra
   `SQLiteMemoryStore` (`ALBRA_MEMORY_DB`, por defecto `:memory:`) + 
   `MemoryManager`; el `/api/v1/health` ahora reporta
   `memory_store: configured` y `memory_manager: configured` (verificado contra
   el servidor real desde el CRM).

**Producción sigue SIN activarse** (mandato): el puente no expone credenciales
del canal ni de BD al cerebro; la respuesta del agente sigue siendo por la bot
API del CRM; lo que se entregó es el cierre de los dos bloqueadores con
evidencia.

## 4. Evidencia de PostgreSQL y RLS (batería completa re-ejecutada)

- Servidor real: PostgreSQL **16.16** (`127.0.0.1:5433`), binario embebido
  oficial — Docker no existe en el sandbox (misma sustitución OPERATIVA
  documentada en S4.3; las pruebas son 100 % TCP contra el servidor real, sin
  mocks).
- Clúster limpio nuevo (`pgdata-s44`): `initdb` → roles `001_roles.sql`
  (`app_runtime` sin DDL) → **34 migraciones Drizzle desde base limpia** → 44
  tablas → `002_audit_log` → batería.
- **Batería 26/26 PASS** (`vestro_s43_bateria`, clon TEMPLATE de la migrada):
  T1a-f (RLS directo: SELECT/UPDATE/DELETE cruzados → 0 filas; INSERT cruzado →
  `42501`), T2/T2b (fail-closed sin contexto y con contexto manipulado),
  T15a/b (unicidad por organización), AUD-1..4 (hash encadenado por org +
  append-only + super-admin con contexto explícito), TX-1..4 (rollback,
  escritura cruzada rechazada, COMMIT visible solo en su org), CRED-1/2, ISO-1.
- **Cobertura RLS: 39/39 tablas org-scoped** con `ENABLE + FORCE ROW LEVEL
  SECURITY` (vigía B2: 0 tablas org-scoped sin RLS).

## 5. E2E real (self-test de VOCERO, corrida continua)

- Entorno documentado 036 reconstruido íntegro en esta sesión: BD
  `vestro_036_e2e` limpia (34 migraciones + audit_log), `.env.e2e-036` estándar
  (wa-mock/ai-mock/zernio-mock/zoom-mock integrados en la app, `BOT_API_KEY`,
  `AGENT_COALESCE_MS=1500`, `AGENDA=on`, `BRAIN_DISPATCH_URL` → cerebro falso
  3261), servidor dev real en :3260.
- **269/302 checks verdes (0 FAIL)** en una sola corrida continua (turbo dev +
  heap 2 GB): setup de registro/onboarding, webhook us5, us-bsuid ×4, #51
  nombre del contacto, us-bot-api ×9 (autorización, typing+leído, media proxy,
  perfil+KB, contexto, ficha, envío del bot, handoff, IA pausada/reset),
  zona horaria, FR-022, 008 inbox/adjuntos/previews (imagen 6 MB y 413), #78
  botones y listas, 015 agenda ×5 (Zoom contra su mock), R10 huecos por fecha,
  016/018 atribución.
- **Punto de parada reproducible:** al inicio de la ráfaga **R11 (700
  peticiones)** el sandbox (3,9 GB RAM) mata el servidor dev. Se probaron 4
  configuraciones (webpack/turbo × heap 1,6/2,5 GB; turbo+2 GB fue la que llegó
  más lejos, con 0 FAIL hasta R11). **No verificado en corrida continua: R11+
  (~33 checks).** No es defecto del producto: en un host con ≥8 GB el mismo
  guion corre completo — exactamente la condición que el propio mandato exige
  para esta prueba. **No se simuló ni se declaró terminada la parte faltante.**
- Los registros crudos de las 4 corridas (incluida la de 269/302) quedan en
  `/tmp/e2e-run.log` y `/tmp/next-dev-e2e.log` de la sesión.

## 6. Regresiones encontradas y correcciones (§6 del mandato S4.3, aplicado)

| ID | Defecto (cómo se demostró) | Causa raíz | Corrección mínima | Prueba anti-regresión |
|---|---|---|---|---|
| D-S44-1 | `SQLiteMemoryStore` con BD migrada leía `full_json` de la columna equivocada (`row[-1]` posicional: `ALTER TABLE ADD COLUMN org_id` añade la columna AL FINAL) | acceso posicional heredado que asumía `full_json` última | `sqlite3.Row` + acceso por NOMBRE de columna en `_deserialize` | `test_legacy_sqlite_database_migrates_without_data_loss` (crea una BD pre-S4.4 real y la migra) |
| D-S44-2 | `health` del cerebro no reportaba `memory_manager` — el CRM no podía verificar el estado de T9 por HTTP | lista fija de componentes en `Runtime.health()` | `COMPONENT_MEMORY_MANAGER` añadido a la lista de health (genérico, sin dominio) | `cerebro-real.test.ts` «health … T9 resuelto» verifica ambos componentes `configured` |
| D-S44-3 | Vigía de contaminación del seed en rojo (55 hallazgos `crm`) tras una primera implementación del puente dentro de `src/albra_seed/` | el puente se alojó en el seed, violando el invariant seed↔especialización | el puente vive en `src/albra_specialization/crm/bridge.py` y se monta con el hook GENÉRICO `extra_extensions` de `create_app`; el seed no importa nada de dominio | `tests/contamination` 0 hallazgos críticos; la suite completa del cerebro quedó 821/821 |

Ningún parche acumulado: cada corrección es mínima, aditiva o de aislamiento,
con prueba que impide su repetición. No se ocultó ningún error ni se cambió
funcionalidad para conseguir verdes. Las incidencias de ENTORNO detectadas y
resueltas durante la corrida E2E (sin tocar producto): `DATABASE_URL` inyectado
por la plataforma del sandbox que pisaba el `--env-file` (se anula por env de
lanzamiento), caché webpack corrupta de reinicios (`rm -rf .next` por corrida),
puerto 3261 ocupado por un cerebro falso huérfano.

## 7. Riesgos y pendientes

1. **E2E R11+ en host ≥8 GB** (limitación del sandbox, no del producto; el
   mandato exigía ≥8 GB para la corrida completa — el sandbox tiene 3,9 GB).
   Quedan ~33 checks sin verificar en corrida continua.
2. **Runtime de BD sobre el rol dueño** (heredado de S4.3): la URL documentada
   conecta como `vestro` (dueño); la valla de BD opera como `app_runtime`
   (probado 26/26). El cambio de rol de runtime sigue siendo trabajo operativo
   de F5 (grants ya en `004`).
3. **A1 — SSE mono-instancia** (heredado, F5 backplane).
4. **Activación en producción del puente:** exige, en el despliegue real:
   `ALBRA_CRM_HMAC_SECRET` fuerte compartido con el CRM, `ALBRA_MEMORY_DB`
   persistente, autenticador real (el `DevAuthenticator` jamás corre en
   producción — fail-closed 503), firewall/policy del cerebro con reglas
   explícitas (el `render_app.py` de demo trae allow-all `*` — riesgo S2 del
   registro, sigue vigente para staging/producción).
5. L1/L2 licencias (heredado) antes de F9.

## 8. Commits publicados y verificación del push

- `ALBRA8/CRM-WHATSPOWER` → `main`: push directo verificado
  (`419c57b..b0d8650`; la rama no está protegida).
- `ALBRA8/AGENTE-GENERAL`: `main` está PROTEGIDA por reglas de repositorio
  (3 status checks requeridos; el push directo a `main` es rechazado por
  GitHub — intentado y documentado). El commit `e0d8442` se publicó en la
  rama **`s4.4/crm-dispatch-t9`** y quedó abierto el **PR #77**
  (`https://github.com/ALBRA8/AGENTE-GENERAL/pull/77`) para que la CI del
  cerebro (3 checks requeridos) corra y el propietario haga merge. Los
  checks de la CI del cerebro corren contra este mismo árbol: la suite
  local ya dio **821/821** sin `llm_real` (los flujos de CI que exigen
  credenciales externas son los que decidan en el PR).
- Criterio de finalización: R-AG-1 y T9 **resueltos con pruebas reales**,
  integración satisfactoria (1.819 CRM + 821 cerebro + 26/26 RLS + 269/302
  E2E), documentación entregada. Lo no verificable está enumerado exactamente
  (§7) y **no se activó producción ni se inició F5**.

*Evidencia cruda: `CONTEXTO CRM/05_TESTS/TEST_INDEX.md` §S4.4, `CONTEXTO CRM/08_SESSIONS/SESSION_2026-11-27_S4.4_CIERRE_BLOQUEOS_AGENTE.md`, `AGENTE-GENERAL/tests/integration/test_crm_dispatch.py`, `AGENTE-GENERAL/tests/unit/test_memory_org_isolation.py`, `CRM-WHATSPOWER/services/agent-gateway/tests/cerebro-real.test.ts`, `apps/web/scripts/bateria-multi-tenant.mjs` (salida JSON real), `apps/web/scripts/e2e-selftest.mjs` (269/302).*
`CONTEXTO CRM/08_SESSIONS/SESSION_2026-11-27_S4.4_CIERRE_BLOQUEOS_AGENTE.md`,
`AGENTE-GENERAL/tests/integration/test_crm_dispatch.py`,
`AGENTE-GENERAL/tests/unit/test_memory_org_isolation.py`,
`CRM-WHATSPOWER/services/agent-gateway/tests/cerebro-real.test.ts`,
`apps/web/scripts/bateria-multi-tenant.mjs` (salida JSON real),
`apps/web/scripts/e2e-selftest.mjs` (269/302).*
