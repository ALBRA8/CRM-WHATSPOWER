# ENTREGA — CIERRE OPERATIVO POST-F5 (CRM WHATSPOWER / Vestro)

**Mandato:** «AUTORIZACIÓN PARA CIERRE OPERATIVO POST-F5» — F5 aceptada
(`ff691d9`); completar validación E2E (checks restantes, R11+); validar los
controles del puente; entregar informe; **sin despliegue público**.
**Fecha:** 2026-11-28.
**Estados conservados (verificados con `git ls-remote` ANTES de tocar nada):**
CRM WhatsPower `main` = **`ff691d9`** (byte-a-byte; materializado por clon
exacto); AGENTE-GENERAL `main` = **`7f6e908`** (sin modificaciones; clon
separado SOLO para pruebas, sin push).

**Regla cumplida:** nada se rehízo de S4.1–S4.4/F5; ningún cambio de producto;
todos los cambios de este cierre son ADITIVOS (un runner E2E nuevo + documentos)
y quedan en la lista de commits §7. **Límite de autorización respetado:** no se
desplegó, no se expuso nada, no se conectaron clientes, no se enviaron campañas.

---

## 1. Evidencia y resultados de los 302 checks

### 1.1 Qué se conserva (mandato: «Conservar los resultados actuales»)

- **F5 corrida B (oficial): 270 checks OK, 0 FAIL** en corrida continua
  (turbo dev + heap 2 GB), detenida de forma REPRODUCIBLE al inicio de R11 por
  OOM del kernel (dmesg «Killed process next-server»; sandbox 3,9 GB).
  Evidencia: `ENTREGA_F5.md` §4/§6 — intacta, no se re-corrió ni se alteró.

### 1.2 Qué se ejecutó NUEVO en este cierre: R11 completa (la sección final)

Los «checks restantes, especialmente R11 y posteriores» son la sección R11
del self-test 036 — la ÚLTIMA del guion («R11 y posteriores» = R11; no hay
sección posterior). En S4.3, S4.4 y F5 la corrida continua murió siempre ANTES
de ejecutarla: **R11 se ejecutó por primera vez en este cierre.**

Método (aditivo, sin tocar el guion): `apps/web/scripts/e2e-r11-postf5.mjs`
NUEVO — copia VERBATIM de `r11BotChecks` de `e2e-selftest.mjs` @ `ff691d9`,
con un PREP mínimo sin checks (registro + conexión WhatsApp + 1 inbound, las
mismas operaciones que en la corrida completa generan checks ya verificados en
F5). Servidor dev estándar 036 (`next dev`, heap 2 GB, :3260) con
`.env.e2e-036` estándar (fixtures etiquetados, gitignored). El cerebro falso
NO se necesita en R11 (ningún check exige respuesta del agente).

**Resultado: 11/11 checks OK, 0 FAIL** (log crudo `/tmp/e2e-r11-postf5.log`):

| # | Check | Resultado |
|---|---|---|
| 1 | hay una conversación para que el cerebro pregunte | OK |
| 2 | la inundación: 30 → 401 y las otras 670 → 429 (frenada por IP) | OK |
| 3 | el cerebro DURANTE la inundación → 200 (otra IP y la misma) | OK |
| 4 | el cerebro DESPUÉS de la inundación → 200 | OK |
| 5 | otra IP sin key sigue en 401 (el freno es por IP, no global) | OK |
| 6 | el contacto nace con el teléfono como identidad | OK |
| 7 | la ingesta reconcilia el mensaje solo-BSUID a la MISMA conversación | OK |
| 8 | GET /api/bot/context?waIdentity=bsuid:\<id\> → 200 (antes 404) | OK |
| 9 | …y es el MISMO contacto y conversación (identidad = teléfono) | OK |
| 10 | el nombre neutro `identity` resuelve igual | OK |
| 11 | un BSUID que nadie tiene sigue en 404 | OK |

La ráfaga de 700 peticiones (14 lotes × 50) pasó **sin OOM** en esta corrida:
el servidor dev de la corrida COMPLETA acumula las páginas/rutas compiladas de
todas las secciones previas (~270 checks); el runner de R11 solo compila las
rutas de su sección, y el pico de memoria del sandbox (3,9 GB) aguanta la
ráfaga. **No hubo fallos que separar: 0 defectos de producto, 0 de entorno en
R11.** (Los hallazgos de entorno de la sesión — inyección de `DATABASE_URL`
global por el driver del sandbox y el gate FR-080 de mocks en producción —
están documentados en §2; ninguno es un defecto del producto.)

### 1.3 Contabilidad honesta del total «302»

- El guion tiene **301 puntos de llamada `ok()`** (302 contando la línea de la
  definición — origen del «302» de los informes previos). El total EN
  EJECUCIÓN es DINÁMICO: hay bucles que emiten checks por iteración (015
  agenda: 5 rutas; 018 anuncio de origen: 4 casos × 2 pasadas) y ramas por
  banderas (atribución apagada termina temprano con 4 checks en lugar de 30).
- Por eso **NO se declara 302/302**: la única forma de obtener el total exacto
  es UNA corrida continua completa, que exige el host ≥8 GB (condición física
  del mandato). Lo que sí está verificado con evidencia individual:
  **270 (F5, corrida B) + 11 (R11, este cierre) = 281 checks OK, 0 FAIL
  acumulado.** Nada simulado; nada declarado aprobado sin ejecución.

---

## 2. Configuración validada del entorno (sandbox, post-reciclado)

| Componente | Estado validado |
|---|---|
| PostgreSQL | **16.16** servidor real (`@embedded-postgres/linux-x64` 16.16.0-beta.19, binarios en el repo `work/pg`); herramientas `psql/pg_dump/pg_restore` **16.9.1**; clúster :5433 (`shared_buffers=128MB`, `max_connections=60`) |
| Recuperación REAL no planificada | el clúster `pgdata-f5` sobrevivió al reciclado del sandbox: arranque con **replay de WAL** («database system was interrupted… automatic recovery» → «ready to accept connections»), todas las BD F5 intactas (`vestro_036_e2e`, `vestro_f5_runtime`, `vestro_f5_restaurada`, `vestro_s43_bateria`) |
| BD E2E | `vestro_036_e2e` recreada LIMPIA: 34 migraciones Drizzle + `infra/sql/001-005` → **44 tablas, RLS ENABLE+FORCE 39/39** |
| `.env.e2e-036` | configuración estándar 036 completa (WA_MOCK_ENABLED, wa-mock/ai-mock/zoom-mock, BOT_API_KEY ≥16, AGENT_COALESCE 1500/1500, AGENDA=on, BRAIN_DISPATCH_URL 3261, BETTER_AUTH_SECRET/ENCRYPTION_KEY base64 32 bytes generados) — **fixtures de prueba, NO credenciales de producción**; gitignored |
| Servidor | dev estándar 036 (`next dev` heap 2 GB, :3260); `/api/health` vivo: `ok:true`, versión 2.12.0, `dbRole:"owner"`, bloque `sse:{mode:"off"…}` |
| Hallazgo de entorno 1 | el sandbox inyecta `DATABASE_URL=file:…/custom.db` global; `node --env-file` no sobreescribe existentes → app contra URL falsa (ECONNREFUSED). Corrección operativa `env -u DATABASE_URL`. **Problema del ENTORNO, no del producto** |
| Hallazgo de entorno 2 | con `next start` (NODE_ENV=production) los mocks responden **404 por diseño (FR-080)**: `isMockEnabled()` exige `NODE_ENV !== "production"` — indistinguible de rutas inexistentes. **Comportamiento de seguridad DEL PRODUCTO, correcto**; el arnés E2E exige dev (igual que F5) |

---

## 3. Resultado de cada control del puente

Formato: **control (checklist D-028) → resultado fresco post-F5 → qué queda
para el host de despliegue.** Sin credenciales de desarrollo presentadas como
evidencia de producción: todo lo de esta sección es validación A NIVEL SANDBOX
con fixtures etiquetados; los controles que exigen el entorno de despliegue
real quedan explícitamente PENDIENTES, no «aprobados».

| Control | Resultado en sandbox (fresco, este cierre) | Pendiente en host real |
|---|---|---|
| **A. Secreto HMAC ≥32 bytes gestionado por entorno** | MECANISMO probado: firma sobre cuerpo crudo; manipulada → **401 tipado**; sin secreto → cliente no se construye (fail-closed, 11 unitarias del adaptador); el mismo secreto en ambos lados (`ALBRA_CRM_HMAC_SECRET`) | Secretos REALES ≥32B desde el gestor de secretos + rotación en ventana (checklist A) |
| **B1. Autenticador real del cerebro** | el cerebro `7f6e908` arrancó con `DevAuthenticator` (registrado en el runtime, como en pruebas); el adaptador exige sobre tipado y falla cerrado | Autenticador real (DevAuthenticator JAMÁS en producción; fail-closed 503 sin él) — checklist B |
| **B2. Memoria persistente (T9)** | aislamiento por organización probado contra el cerebro real (T9 en `/api/v1/health` = configured; consultas cruzadas 0 filas); las pruebas usan `ALBRA_MEMORY_DB=":memory:"` declarado | `ALBRA_MEMORY_DB` en disco PERSISTENTE en el despliegue — checklist B |
| **C1. Conectividad y permisos del rol runtime** | **24/24 PASS** (`verificar-rol-runtime.mjs`, clon TEMPLATE): `vestro_runtime` LOGIN miembro de `app_runtime`, solo DML+secuencias 44/44 tablas; CREATE/DROP TABLE y CREATE ROLE → **42501**; fail-closed sin `app.current_org` (0 filas); cruzado 0 filas / INSERT 42501 (WITH CHECK); audit_log append-only (UPDATE/DELETE → P0001, fila intacta); hash encadenado íntegro; app operativa | Apuntar `DATABASE_URL_RUNTIME` al rol en el despliegue y propagar `app.current_org` por transacción (paso operativo heredado, F5 §7.2) |
| **C2. Backplane SSE entre instancias** | **6/6 PASS** (LISTEN/NOTIFY real sobre el PG 16.16): pg_notify de OTRA instancia llega; exactly-once por instancia; filtro por org; payload >7900 gzip+base64; modo `off` conserva contrato | `SSE_BACKPLANE=postgres` cuando haya ≥2 instancias (topología real) |
| **C3. Health checks y logs** | `/api/health` vivo con contrato aditivo F5 (`dbRole`, `sse`); health del cerebro real 200 healthy/ready; convención de logs sin PII (OBSERVABILIDAD.md) | Alertas/probes externos del despliegue (2 probes documentados) |
| **D1. Backup y restauración verificables** | **5/5 PASS** ciclo completo REAL: siembra de auditoría → `pg_dump -Fc` (integridad `pg_restore --list`) → restauración a base aparte → verificación (V1 conteos 44/44 idénticos; V2 RLS 39/39+FORCE; V3 cadena de hash íntegra; V4 34 migraciones; V5 operable) | El `.dump` a almacenamiento EXTERNO al host (3-2-1); cron/systemd del despliegue |
| **D2. Persistencia y recuperación** | **PASS** scripted: marcador con nonce sobrevive reinicio controlado (P3) y **crash real SIGKILL** al postmaster con replay de WAL (F3), cadena de hash íntegra en ambos. ADEMÁS, recuperación REAL no planificada (reciclado del sandbox, §2) | Reinicios/crash del host de despliegue con sus herramientas (systemd/orquestador) |
| **D3. Puente CRM ↔ cerebro (integración real)** | **19/19 PASS** (`services/agent-gateway`): 11 unitarias (fail-closed sin credenciales, sobre tipado) + **8 contra el cerebro REAL `7f6e908`** (uvicorn real): health 200 healthy/ready, T9 configured, `/crm/dispatch` → **200** `{accepted, event_id}` (R-AG-1), idempotencia reenvío → 200, **HMAC manipulada → 401 tipado**, **org cruzada → 403 `tenant_mismatch`**, HITL 200, X-Org-Id+firma en toda petición | Firewall/policy explícitas default-deny (el allow-all `*` de demo NO va a producción — riesgo S2) — checklist B/C |

**Sin defectos de producto en este cierre.** Los dos hallazgos de entorno
(§2) quedan separados y documentados; ninguno requirió cambio de código.

---

## 4. Riesgos residuales (actualizados)

1. **Corrida continua completa (total exacto de checks) en host ≥8 GB** —
   condición física del mandato; en este sandbox (3,9 GB) la pared de memoria
   de la corrida completa persiste (probadа en S4.4/F5 con 4 configuraciones).
   R11 ya tiene evidencia individual (§1.2); la corrida continua que integre
   todo en una sola ejecución queda para el host de despliegue (checklist D6).
   **No se declara 302/302.**
2. **Corte completo al rol runtime** — soporte + verificación entregados
   (24/24 fresco); propagar `app.current_org` por transacción en el pool es el
   paso operativo restante (infra/README.md §5).
3. **Controles de puente del despliegue real** — secretos ≥32B desde gestor de
   secretos, `ALBRA_MEMORY_DB` persistente, autenticador real (DevAuthenticator
   jamás en producción), firewall default-deny (riesgo S2 del demo vigente).
4. **Activación** — prohibida sin autorización expresa; interruptor del Agente
   por organización, APAGADO por defecto (verificado en el arranque: guía con
   cerebro sin contestar → paso «pendiente»).
5. Licencias L1/L2 antes de F9 (heredado).
6. Nota operativa heredada (D-F5-2): las baterías multi-tenant exigen base
   limpia; las corridas de evidencia siembran audit_log — reconstruir antes de
   re-corridas.
7. **Contabilidad dinámica de checks** (§1.3): el total «302» es nominal;
   cualquier cifra futura debe salir del resumen final de la corrida continua,
   no de conteos estáticos.

---

## 5. Procedimiento de despliegue y reversión

**Inalterado respecto a `ENTREGA_F5.md` §8** (aprobado con F5): aprovisionar
PG16 + roles (`infra/sql/001`+`005`) → base vacía + migraciones al boot (34) +
`infra/sql/002-005` → secretos por entorno (`infra/SECRETOS.md`) → desplegar
apps/web y el cerebro en red interna (`/api/health` con `commitVerified:true`)
→ checklist del puente (A/B/C/D) + ciclo
`prueba-respaldo-restauracion.sh` → **corrida continua completa del E2E en el
host (≥8 GB)** → solo con autorización expresa, activar organizaciones.

**Reversión** (ídem F5 §8): imagen/commit anterior etiquetado (`/api/health`
confirma el commit activo tras el rollback); las migraciones de F5 no alteran
esquema (005 es de ROLES); desastre de datos → `restaurar.sh` del último
`.dump` verificado + re-verificar con `verificar-restauracion.mjs`; el cerebro
se revierte a su commit etiquetado de forma independiente (el puente falla
tipado/cerrado mientras esté caído, sin perder datos del CRM).

**Añadido de este cierre (evidencia, no procedimiento nuevo):** la corrida R11
individual (`e2e-r11-postf5.mjs`) es repetible en cualquier host como verificación
aditiva de robustez del bot-API sin correr el guion completo.

---

## 6. Diferencias entre lo validado en sandbox y lo validado en el host real

| Dimensión | Sandbox (este cierre) | Host de despliegue real (pendiente) |
|---|---|---|
| RAM | 3,9 GB — R11 individual OK (pico bajo: solo rutas de R11 compiladas); corrida completa imposible (pared OOM reproducida en S4.4/F5) | ≥8 GB — corrida continua completa exigida por el mandato |
| Servidor para E2E | dev estándar 036 (igual clase que F5; los mocks exigen NODE_ENV≠production por FR-080) | mismo arnés; adicionalmente validar contra build de producción (`next start`) para rutas y health |
| Secretos | fixtures etiquetados (BOT_API_KEY, HMAC de prueba, Better-Auth/ENCRYPTION_KEY generados) — gitignored | secretos REALES ≥32B desde el gestor de secretos (checklist A) |
| Memoria del cerebro | `ALBRA_MEMORY_DB=":memory:"` en pruebas de integración (declarado) | `ALBRA_MEMORY_DB` persistente en disco |
| Backups | ciclo REAL completo en sandbox; `.dump` en `/tmp` (área local) | `.dump` a almacenamiento EXTERNO (3-2-1) + cron/systemd del host |
| Cerebro | `7f6e908` real en uvicorn local (misma versión publicada) | cerebro desplegado en red interna con autenticador real y firewall explícito |
| Red/TLS | localhost sin proxy ni TLS | proxy TLS, dominio, probes externos, alertas |
| Multi-instancia | backplane probado unitariamente contra PG real | `SSE_BACKPLANE=postgres` con ≥2 instancias reales |

---

## 7. Commits publicados

- **ALBRA8/CRM-WHATSPOWER → `main`:** commit de cierre SOLO con cambios
  ADITIVOS: `apps/web/scripts/e2e-r11-postf5.mjs` (runner R11, copia verbatim
  de la sección del self-test), `CONTEXTO CRM/08_SESSIONS/
  SESSION_2026-11-28_CIERRE_POSTF5.md`, `CONTEXTO CRM/05_TESTS/TEST_INDEX.md`
  (§ cierre), `ENTREGA_CIERRE_POSTF5.md` (este documento), SESSION_INDEX.
  Ningún archivo de producto modificado (`git status` del árbol: solo
  adiciones). SHA exacto: ver `git log` tras el push.
- **ALBRA8/AGENTE-GENERAL → `main`: `7f6e908` SIN CAMBIOS** (verificado con
  `git ls-remote` antes y después; el clon `AGENTE-GENERAL-7f6e908` fue SOLO
  para pruebas de integración, sin push).
- No se crearon ramas ni PRs nuevos (misma vía directa a main que S4.3/S4.4/F5).

## 8. Límites de la autorización (respetados)

Esta instrucción autorizó **preparación y validación**. No se desplegó
públicamente, no se conectaron clientes reales, no se enviaron campañas, no se
activó comercialmente nada. **El trabajo se detiene aquí: el informe queda
entregado para aprobación expresa.**
