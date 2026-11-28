# ENTREGA F5 — CRM WhatsPower

**Fase:** F5 — preparación y validación de producción (SIN exposición pública).
**Repositorios:** `ALBRA8/CRM-WHATSPOWER` (rama `main`) y `ALBRA8/AGENTE-GENERAL` (rama `main`).
**Estados de partida autorizados y verificados con `git ls-remote` ANTES de tocar
nada:** CRM `f03048a` (S4.4 publicado), AGENTE-GENERAL `7f6e908` (S4.4 merged
por PR #77). El sandbox local no conservaba las copias de trabajo (reciclado):
se materializó el estado publicado EXACTO de ambos remotos y se re-verificó el
baseline ANTES de modificar nada.
**Fecha de ejecución:** 2026-11-28.
**Regla cumplida:** no se reconstruyó el proyecto, no se re-clonó VOCERO, no se
rehicieron S4.1-S4.4 y no se alteró ninguna funcionalidad verificada: los
cambios son ADITIVOS u OPERATIVOS, cada uno con prueba que impide su repetición.
**Restricción de autorización respetada:** F5 prepara y valida producción; NO
se publicó ni activó el SaaS para clientes; no se expuso nada públicamente.

---

## 1. Arquitectura desplegable

| Componente | Cómo se despliega | Notas operativas |
|---|---|---|
| **apps/web** (CRM, Next.js 15) | proceso Node (`pnpm --filter @whatspower/web start`) detrás de proxy TLS (Caddy/Traefik/coolify) | escala a N instancias: con `SSE_BACKPLANE=postgres` los eventos de bandeja cruzan instancias (D-024); con 1 instancia, `off` (default) |
| **PostgreSQL 16** | `infra/docker-compose.yml` (dev) o servidor gestionado; migraciones Drizzle al boot (34) + `infra/sql/002..005` idempotentes | RLS FORCE en 39/39 tablas org-scoped; `audit_log` append-only con hash encadenado |
| **AGENTE-GENERAL** (cerebro, FastAPI) | `render_app.py` + uvicorn; SOLO red interna del CRM | `/crm/dispatch` + `/api/v1/health`; memoria T9 por organización en `ALBRA_MEMORY_DB` PERSISTENTE |
| **services/agent-gateway** | se ejecuta DENTRO de apps/web (cliente del despacho); `BRAIN_DISPATCH_URL` al cerebro por red interna | fail-closed sin secreto |
| **Backups** | cron/systemd → `infra/backup/backup.sh` (`pg_dump -Fc`) → almacenamiento EXTERNO al host (regla 3-2-1) | restauración verificada obligatoria tras cambios de versión/estrategia |

Variables de despliegue (completas en `apps/web/.env.example` y
`infra/SECRETOS.md`): obligatorias `APP_BASE_URL`, `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `META_WEBHOOK_VERIFY_TOKEN`;
recomendadas F5 `DATABASE_URL_RUNTIME` (rol runtime), `SSE_BACKPLANE`
(`off` 1 instancia / `postgres` N instancias); del puente `BOT_API_KEY`,
`BRAIN_DISPATCH_URL`, `ALBRA_CRM_HMAC_SECRET` (el MISMO secreto en ambos
lados), `ALBRA_MEMORY_DB` persistente; banderas `AGENDA`, `ATRIBUCION`,
`API_V1`, `CHANNELS`, `MEDIA_STORE`.

## 2. Configuración operativa F5 (lo nuevo de esta fase)

1. **Rol de BD runtime con privilegios mínimos (D-025).** `infra/sql/
   005_runtime_login.sql` crea `whatspower_runtime` (LOGIN, miembro de
   `app_runtime`, `NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
   NOBYPASSRLS`). La app conecta con `DATABASE_URL_RUNTIME` si el despliegue
   la define; sin ella, comportamiento de siempre. Verificación real 24/24:
   solo DML+secuencias sobre 44/44 tablas; CREATE/DROP TABLE y CREATE ROLE
   rechazados (42501); fail-closed sin `app.current_org` (0 filas);
   consulta/UPDATE/DELETE cruzados → 0 filas; INSERT cruzado → 42501 (WITH
   CHECK); DML dentro de su org operativo; `audit_log` append-only; la app
   arranca con esa URL. `/api/health` reporta `dbRole`.
   **Declarado y NO hecho (honesto):** el corte completo del HTTP al rol
   runtime exige propagar `app.current_org` por transacción en el pool
   (MODELO_MULTI_TENANT §5.3) — soporte y verificación entregados, el corte es
   trabajo operativo posterior. Hoy la valla efectiva es `scoped()` +
   AsyncLocalStorage (primera) y la valla BD probada como segunda (batería 26/26
   + R1-R7).
2. **Backplane SSE multi-instancia (D-024, cierra A1).** `SSE_BACKPLANE=postgres`
   publica por `pg_notify` (canal `whatspower_sse`) y cada instancia re-emite lo
   que su LISTEN recibe: cada evento llega EXACTAMENTE una vez por instancia
   (el publicador también recibe el suyo por LISTEN). Payloads >7900 bytes
   viajan gzip+base64; si aún exceden, reparto local de respaldo + contador
   `droppedOversize` (el cliente hace catch-up con `since=`). Reconexión con
   reintentos exponenciales. `off` conserva byte-a-byte el bus in-process
   verificado. Estado en `/api/health` → `sse.{mode,connected,notified,
   received,droppedOversize,lastError}`.
3. **Backups automáticos + restauración real (D-026).** `infra/backup/
   backup.sh` (`pg_dump -Fc`, integridad `pg_restore --list`, retención por
   días, bitácora) programable con cron o systemd timer (ejemplos en
   `infra/README.md §6`). `restaurar.sh` restaura a base aparte;
   `verificar-restauracion.mjs` compara origen vs restaurada. Ciclo completo
   reproducible: `prueba-respaldo-restauracion.sh`.
4. **Persistencia y recuperación ante fallos.** `prueba-persistencia-
   recuperacion.sh`: marcador con nonce → reinicio controlado (`pg_ctl
   restart`) → marcador intacto; SIGKILL al postmaster (crash real) → arranque
   con replay de WAL → marcador y cadena de hash intactos.
5. **Checklist de producción del puente (D-028).** `CONTEXTO CRM/
   06_INTEGRATIONS/CHECKLIST_PRODUCCION_PUENTE.md`: A (secreto HMAC ≥32 bytes,
   rotación sin downtime), B (cerebro: autenticador real, firewall/policy
   explicit sin allow-all `*`, memoria persistente, rate limit, ledger,
   health), C (CRM: URLs internas, cola HITL, interruptor por org apagado por
   defecto, backplane según topología), D (datos: backups, persistencia,
   re-versión, rollback, 4 stubs identificados). Es la puerta de salida del
   despliegue real.
6. **Gestión segura de secretos.** `infra/SECRETOS.md`: inventario con
   generación (`openssl rand -hex 32`), inyección solo por entorno del
   runtime, rotación HMAC en ventana, auditoría de fuga. Escaneo real del
   repo: 0 secretos en 1.272 archivos (solo fixtures E2E etiquetados).
7. **Health y observabilidad.** `/api/health` ampliado ADITIVAMENTE
   (`dbRole`, `sse`) sin romper el contrato previo (tests actualizados con el
   nuevo contrato, nada eliminado); `CONTEXTO CRM/09_KNOWLEDGE/
   OBSERVABILIDAD.md`: los 2 probes (CRM `/api/health`, cerebro
   `/api/v1/health`), señales recomendadas y convención de logs sin PII ni
   firmas.

## 3. Evidencia de seguridad

| Valla | Evidencia real (F5, PostgreSQL 16.16) |
|---|---|
| Rol runtime sin DDL | R3a/R3b/R3c: CREATE TABLE, DROP TABLE, CREATE ROLE → **42501** |
| Privilegios exactos | R2: DML 44/44 tablas; **0** privilegios TRUNCATE/REFERENCES/TRIGGER; secuencias USAGE |
| RLS fail-closed | R4a sin contexto → 0 filas; R4g contexto manipulado → 0 filas |
| RLS anti-crucado | R4c/R4d/R4e cruzado → 0 filas; R4f INSERT cruzado → 42501 |
| DML legítimo | R5a/R5b insert/select/delete en su org + secuencia |
| Auditoría tamper-evident | R6a/R6b UPDATE/DELETE rechazados; R6c cadena de hash por org |
| Autenticación HMAC del puente | suite 1.825 incluye cerebro-real 9/9: firma manipulada → 401, org cruzada → 403 `tenant_mismatch` |
| Escaneo de secretos | 0 hallazgos reales en el árbol tracked (1272 archivos) |
| Backups | respaldo verificado legible por `pg_restore`; restauración con conteos idénticos 44/44 |

## 4. Resultados de pruebas (reales, esta sesión)

| # | Batería | Resultado |
|---|---|---|
| 1 | Suite completa monorepo (`pnpm -r test`, con DATABASE_URL y cerebro real) | **1.825/1.825 PASS** — apps/web 1.729 (143 archivos = 142 + sse-backplane) · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway 19 (con integración REAL cerebro 9/9 incluida) |
| 2 | Typecheck / lint / build | 0 errores · Done · OK (7 paquetes) |
| 3 | Rutas API / contratos / fronteras | **142** · 49/49 · **9/9** (grafo congelado +1 arista consciente D-027; ciclos: solo los 2 heredados documentados) |
| 4 | Batería multi-tenant (PostgreSQL real, clon TEMPLATE limpio) | **26/26 PASS** — RLS **39/39** org-scoped con FORCE |
| 5 | **F5.1** verificador rol runtime (`test:rol-runtime`) | **24/24 PASS** (R1-R7) |
| 6 | **F5.2** backplane SSE (LISTEN/NOTIFY contra PG real) | **6/6 PASS** (instancia externa pg_notify → entrega local; exactly-once; >7900 comprimido íntegro; filtro por org) |
| 7 | **F5.3** ciclo respaldo→restauración→verificación | **5/5 PASS** (44/44 tablas idénticas; RLS 39/39 restaurada; hash íntegro; 34 migraciones; operable) |
| 8 | **F5.3** persistencia tras reinicio + recuperación tras crash | **PASS / PASS** (nonce sobrevive `pg_ctl restart`; SIGKILL al postmaster + replay de WAL; cadena íntegra en ambos) |
| 9 | Cerebro AGENTE-GENERAL (`pytest tests`) | **821 passed, 1 skipped** — el skip es `test_nvidia_glm_flash` (requiere `NVIDIA_API_KEY`, prueba en vivo condicionada al entorno; sin relación con esta fase) |
| 10 | E2E self-test 036 | **ver §6** |
| 11 | Escaneo de secretos | limpio |

**Conservación de líneas base:** la 1.819 de S4.4 está ÍNTEGRA dentro de la
actual (1.825 = 1.819 + 6 pruebas nuevas del backplane); la 821 del cerebro
íntegra; 142 rutas y contratos intactos; la matriz de paridad VOCERO (156
capacidades) SIN CAMBIO; los 4 dominios stub (audit, billing, campaigns,
automation) siguen identificados como pendientes (vigía de dominios 9/9);
ninguna prueba eliminada ni debilitada (los 2 mocks de `@/lib/db` se
actualizaron con el campo NUEVO, y el grafo congelado recibió la arista F5
documentada — mecanismo previsto por el propio vigía).

## 5. Backups y restauración (resumen operativo)

- Respaldo: `pg_dump -Fc` por cron/systemd (02:00) con retención 14 días y
  bitácora; verificación de legibilidad integrada en el script (exit 1 si
  `pg_restore --list` falla).
- Restauración: `restaurar.sh` a base APARTE + `verificar-restauracion.mjs`
  (V1 conteos 44/44, V2 RLS 39/39+FORCE, V3 cadena de hash, V4 migraciones,
  V5 operable) — **5/5 PASS en esta sesión**.
- Persistencia/recuperación: reinicio controlado y crash SIGKILL con replay
  de WAL — **PASS**.
- Regla operativa adoptada (D-026): un respaldo no verificado con una
  restauración real no se da por bueno; el ciclo completo se corre en el
  entorno de despliegue tras cada cambio de versión de PG o de estrategia.
- El `.dump` debe ir a almacenamiento EXTERNO al host (regla 3-2-1); en este
  sandbox quedó en `/tmp/whatspower-backups-f5` (área de trabajo local, no es la
  política de destino).

## 6. E2E 302 checks — resultado real y condición física del sandbox

- Entorno 036 reconstruido íntegro en esta sesión: BD `whatspower_036_e2e` limpia
  (34 migraciones + audit_log), `.env.e2e-036` recreado (wa-mock/ai-mock/
  zoom-mock en la app, `BOT_API_KEY` ≥16, `AGENT_COALESCE_MS=1500`,
  `AGENT_COALESCE_LARGO_MS=1500`, `AGENDA=on`, `BRAIN_DISPATCH_URL` → cerebro
  falso 3261, `WA_MOCK_ENABLED=true`, `ZOOM_*_BASE_URL` al zoom-mock),
  servidor dev turbo + heap 2 GB en :3260.
- Corrida A (defecto de configuración del arnés — D-F5-3): sin
  `WA_MOCK_ENABLED` ni `ZOOM_*` → 41 FAIL en cascada + 5 FAIL de Zoom; abortada
  a propósito. Registro crudo: `/tmp/e2e-run-f5-configA-defectuosa.log` de la
  sesión. Corrección documentada en `SESSION_2026-11-28_F5.md` §D-F5-3.
- Corrida B (configuración estándar corregida — la oficial de F5):
  **270/302 checks OK, 0 FAIL** en corrida continua (turbo dev + heap 2 GB):
  setup de registro/onboarding, webhook us5, us-bsuid ×4, #51 nombre del
  contacto, us-bot-api ×9, zona horaria, FR-022, 008 inbox/adjuntos/previews,
  #78 botones y listas, 015 agenda ×5 (Zoom contra su mock — esta corrida SÍ
  pasó la sección Zoom, mejor que S4.4), R10 huecos por fecha, 016/018
  atribución, y PARADA REPRODUCIBLE al inicio de R11 (ráfaga de 700 peticiones):
  el kernel mató al servidor dev por memoria (dmesg: «Out of memory: Killed
  process next-server») — misma pared física de S4.4 (3,9 GB sandbox; el
  mandato exige ≥8 GB para la corrida completa). Quedan **~32 checks (R11+)
  sin verificar en corrida continua; NADA simulado ni declarado aprobado**.
- Límite físico: el sandbox tiene **3,9 GB RAM**; el mandato exige ≥8 GB para
  la corrida completa. En S4.4 la parada reproducible fue al inicio de R11
  (ráfaga de ~700 peticiones). **No se simuló nada y no se declaró aprobado lo
  no corrido**: el guion completo debe ejecutarse en el host de despliegue
  (≥8 GB) antes de exponer clientes reales — queda en el checklist (D6 del
  puente) y en los límites declarados §8.

## 7. Riesgos pendientes

1. **E2E completo en host ≥8 GB** (condición del mandato; limitación del
   sandbox, no del producto).
2. **Corte completo al rol runtime** (D-025): soporte + verificación
   entregados; propagar `app.current_org` por transacción en el pool es el
   paso restante, documentado en `infra/README.md §5`.
3. **Checklist del puente por ejecutar en el despliegue real**: secretos
   fuertes (`ALBRA_CRM_HMAC_SECRET` ≥32 bytes), `ALBRA_MEMORY_DB` persistente,
   autenticador real del cerebro (DevAuthenticator jamás en producción —
   fail-closed 503), reglas de firewall/policy explícitas (el allow-all `*` de
   demo NO va a producción — riesgo S2 vigente).
4. **Activación**: prohibida sin autorización expresa (mandato F5 §7); el
   interruptor del Agente queda por organización, apagado por defecto.
5. L1/L2 licencias antes de F9 (heredado).
6. Nota operativa: la batería multi-tenant exige base migrada LIMPIA (AUD-4
   cuenta filas de audit_log); las corridas de respaldo/persistencia siembran
   eventos — reconstruir la base (34 migraciones) antes de re-corridas de la
   batería (D-F5-2).

## 8. Procedimiento de despliegue y reversión

**Despliegue (checklist):**
1. Aprovisionar PostgreSQL 16 (o servicio gestionado); crear roles con
   `infra/sql/001` + `005`; contraseña de `whatspower_runtime` desde el gestor de
   secretos.
2. Base vacía + `DATABASE_URL` del dueño → migraciones al boot (34) +
   `infra/sql/002_audit_log.sql`, `003_rls_policies.sql`, `004_grants.sql`.
3. Secretos por entorno (sin archivos .env en el host salvo desarrollo):
   ver `infra/SECRETOS.md`; `SSE_BACKPLANE=postgres` si hay ≥2 instancias.
4. Desplegar apps/web (imagen con commit congelado; `/api/health` debe dar
   `commitVerified:true`) y el cerebro en red interna con su health verde.
5. Ejecutar el checklist del puente (A/B/C/D) y el ciclo
   `prueba-respaldo-restauracion.sh` en el entorno.
6. Correr el E2E 302 completo (host ≥8 GB). Solo entonces, y con autorización
   expresa, activar organizaciones.

**Reversión:**
1. Imagen/commit anterior etiquetado (el despliegue conserva la anterior);
   `/api/health` confirma el commit activo tras el rollback.
2. Si la BD cambió: las migraciones F5 no alteraron esquema (005 es de ROLES,
   no de tablas) — volver a la imagen anterior no exige down-migración.
3. Desastre de datos: `restaurar.sh` del último `.dump` verificado + re-aplicar
   `infra/sql` (idempotentes) + re-verificar con `verificar-restauracion.mjs`.
4. El cerebro se revierte a su commit etiquetado (su despliegue es
   independiente; el puente falla tipado/cerrado mientras esté caído, sin
   perder datos del CRM).

## 9. Defectos registrados y corregidos durante F5

| ID | Defecto (demostrado) | Causa raíz | Corrección | Anti-regresión |
|---|---|---|---|---|
| D-F5-1 | R6b del verificador FAIL (esperaba 42501; el trigger lanza P0001) | código SQL esperado equivocado | aceptar rechazo del trigger + fila intacta (como AUD-3) | verificador 24/24 |
| D-F5-2 | Batería AUD-4 FAIL tras las corridas de evidencia (super-admin veía 9 filas) | la batería exige base limpia; las corridas F5 siembran audit_log (append-only) | reconstruir base limpia y re-corrida | 26/26 en base limpia; nota §7.6 |
| D-F5-3 | E2E corrida A: 422 al conectar número + Zoom `invalid_client` | env del arnés sin `WA_MOCK_ENABLED` ni `ZOOM_*_BASE_URL` (reconstrucción manual) | env corregido; BD e2e recreada; corrida B | corrida B sin FAIL de configuración |
| D-F5-4 | `/api/health` con campos F5 rompía mocks de tests (sin `dbRoleInUse`) | contrato aditivo nuevo no estaba en los mocks | mocks actualizados | health 13/13, version 15/15 |
| D-F5-5 | Vigía de ciclos: ciclo NUEVO bus↔backplane | `SseEvent` en `bus.ts` importado por `backplane.ts` | `SseEvent` → `events/types.ts` | fronteras 9/9, ciclos intactos |
| D-F5-6 | `postgres.js` serializa string JS como jsonb-STRING con `::jsonb` (doble codificación) — el marcador de persistencia no era consultable por `->>'nonce'` | serialización de parámetros de postgres.js | `sql.json({nonce})` en el script; documentado | prueba de persistencia PASS con nonce consultable |
| D-F5-7 | Lint: 2 variables muertas tras el refactor del import de health | import sin uso + binding sin uso en test | eliminados | lint Done |

Ningún parche acumulado: cada corrección es mínima y con prueba que impide su
repetición. No se ocultó ningún error ni se cambió funcionalidad para
conseguir verdes.

## 10. Commits publicados

- **ALBRA8/CRM-WHATSPOWER → `main`: `52372f6`** — push verificado con
  `git ls-remote` (`f03048a..52372f6`): rol runtime (005 + DATABASE_URL_RUNTIME
  + verificador), backplane SSE (D-024) + tests, /api/health aditivo, backups
  y restauración real (infra/backup), checklist del puente (D-028),
  infra/SECRETOS.md, observabilidad, ENTREGA_F5.md y CONTEXTO CRM actualizado
  (D-024..D-028, TEST_INDEX §F5, SESSION_2026-11-28, PROJECT_STATE, INDEX).
- **ALBRA8/AGENTE-GENERAL → `main`: `7f6e908` SIN CAMBIOS** — el árbol del
  cerebro quedó intacto en esta fase (git status 0 entradas): F5 fue trabajo
  del lado CRM/infra; el estado verificado de S4.4 se conserva byte-a-byte.
- **No se crearon ramas ni PRs nuevos** (push directo a main del CRM, misma
  vía que S4.3/S4.4; el repo del cerebro no fue tocado).

*Evidencia cruda: `apps/web/scripts/verificar-rol-runtime.mjs`,
`apps/web/scripts/verificar-restauracion.mjs`, `apps/web/scripts/
verificar... ` (baterías), `infra/backup/*.sh`, `apps/web/tests/unit/
sse-backplane.test.ts`, `apps/web/tests/unit/fronteras-dominios.test.ts`,
`CONTEXTO CRM/05_TESTS/TEST_INDEX.md` §F5,
`CONTEXTO CRM/08_SESSIONS/SESSION_2026-11-28_F5.md`,
`CONTEXTO CRM/06_INTEGRATIONS/CHECKLIST_PRODUCCION_PUENTE.md`,
`infra/README.md`, `infra/SECRETOS.md`,
`CONTEXTO CRM/09_KNOWLEDGE/OBSERVABILIDAD.md`.*
