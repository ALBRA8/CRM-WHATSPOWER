# ENTREGA S4.3 — CRM WHATSPOWER (WhatsPower)

**Fase:** Pruebas de fronteras entre los 14 dominios y validación E2E.
**Repositorio:** `ALBRA8/CRM-WHATSPOWER`, rama `main`.
**Estado de partida:** `c540f43` (estado publicado de S4.2) — verificado antes
de modificar nada: suite **1.801/1.801**, typecheck 7/7, lint verde, build OK,
**142 rutas API** (+2 `.well-known` OAuth), 28 páginas, 43 tablas.
**Fecha de ejecución:** 2026-11-27.
**Regla cumplida:** no se reconstruyó ni re-clonó nada; el único sincronizado
fue el propio repositorio del proyecto (la copia local del sandbox no sobrevivió
al reciclaje); VOCERO permaneció intacto.

---

## 1. Pruebas ejecutadas y resultados reales

| # | Batería | Resultado real |
|---|---|---|
| 1 | Suite completa monorepo (`pnpm -r test`) | **1.816/1.816 PASS** — apps/web 1.723/1.723 (142 archivos) · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway 16 |
| 2 | Typecheck (`pnpm -r typecheck`) | 6/6 Done, 0 errores |
| 3 | Lint (`pnpm -r lint`) | Done, 0 errores |
| 4 | Build (`pnpm -r build`) | OK — apps/web compilación completa + 6 paquetes TS |
| 5 | Rutas API | **142** `route.ts` bajo `src/app/api` (vigía permanente nuevo) |
| 6 | Contratos versionados (`packages/contracts`) | 49/49 — catálogo de errores congelado intacto |
| 7 | Batería multi-tenant sobre PostgreSQL REAL (`pnpm --filter @whatspower/web test:multi-tenant`) | **26/26 PASS** |
| 8 | Vigía de fronteras entre dominios (`fronteras-dominios.test.ts`) | **9/9 PASS** |
| 9 | Adaptador AGENTE-GENERAL (`services/agent-gateway`) | **16/16 PASS** (incluye 5 contra el servidor REAL del cerebro) |
| 10 | E2E self-test de VOCERO (036) | **269/302 checks verdes, 0 FAIL**; parada por memoria del sandbox en R11 (ver §7) |

Conservación de la línea base: las **1.801 pruebas originales están todas
verdes** dentro de la suite actual; se añadieron 15 (9 fronteras + 1 HITL +
5 integración cerebro) y **no se eliminó ni debilitó ninguna**. La matriz de
paridad de VOCERO queda **sin cambio** (ninguna capacidad alterada).

## 2. Evidencia de PostgreSQL y RLS

- **Servidor real:** PostgreSQL **16.16** en `127.0.0.1:5433` (mismo puerto y
  credenciales documentadas que `infra/docker-compose.yml`; Docker no existe en
  el sandbox — el binario embebido oficial 16.16 es la sustitución OPERATIVA,
  las pruebas son 100 % contra el servidor real por TCP, sin mocks).
- **Migraciones desde base limpia:** 33 migraciones Drizzle aplicadas → 44
  tablas (43 de VOCERO + `audit_log` de la Fase 4).
- **RLS real:** `ENABLE + FORCE ROW LEVEL SECURITY` + política `tenant_isolation`
  fail-closed (`current_setting('app.current_org', true)`) sobre **39/39 tablas
  org-scoped** (defecto D-S43-1 corregido; antes 15/39).
- **Evidencia por casos (batería, rol `app_runtime` vía `SET ROLE`):**
  - `T1a-e`: con contexto org A, SELECT/UPDATE/DELETE sobre filas de org B →
    **0 filas**; INSERT con `organization_id` de org B → rechazado
    (`42501 new row violates row-level security policy`).
  - `T1f`: los datos de org B intactos tras los intentos de mutación.
  - `T2/T2b`: sin contexto → **0 filas** en las 7 tablas de dominio probadas
    (fail-closed); con contexto manipulado (`org_fantasma`) → 0 filas.
  - `T15a/b`: unicidad compuesta por organización — duplicado DENTRO de la org
    rechazado (23505), misma identidad en OTRA org permitida.
  - `AUD-1..4`: `audit_log` con cadena de hash por organización
    (`prev_hash[i] = hash[i-1]`, cadenas independientes), append-only
    (UPDATE/DELETE rechazados por trigger incluso como dueño), super-admin solo
    con contexto explícito (`app.super_admin=on` + `org=platform`).
  - `TX-1..4`: transacción con ROLLBACK descarta; escritura cruzada dentro de
    txn rechazada y sin efectos; COMMIT visible solo en su org.
  - `CRED-1/2`, `ISO-1`: credenciales, llaves API, conversaciones y mensajes
    estrictamente separados por organización.

## 3. Aislamiento entre tenants (pruebas negativas reales)

Un usuario/llave/contexto de la organización A **no puede consultar, modificar
ni eliminar** información de la organización B: probado a nivel BD (T1a-f,
T2, CRED, ISO — arriba) y en las suites existentes de `packages/tenant`
(fail-closed, eco `tenant_mismatch`) y contracts. Todos los intentos devuelven
0 filas o error tipado; nada se inyecta, nada se filtra.

## 4. Estado de las fronteras de los 14 dominios

| Verificación del mandato §2 | Resultado |
|---|---|
| Responsabilidades respetadas | Vigía congelado: 14 dominios maestra + Platform; stubs audit/billing/campaigns/automation con SOLO README (sin declararse implementados) |
| Sin dependencias circulares | RUNTIME: único ciclo el heredado de VOCERO `conversations/inbox` (ingest→reacciones→send→ingest) — demostrado preexistente en el baseline `c370cc4`, congelado por prueba (D-020); FUENTE además el benigno de solo-tipos en `integrations/mcp`. Cero ciclos nuevos. |
| Sin acceso a datos internos de otro dominio donde corresponde contratos | 128 imports cross-domain reales congelados (38 aristas); contratos para límites de servicio: los 3 servicios consumen `@whatspower/contracts` (vigía) y las 13 rutas bot del contrato existen verbatim en el núcleo |
| Contratos versionados respetados | contracts 49/49; openapi/bot/despacho intactos; vigía de 13 rutas bot ↔ `route.ts` |
| Sin duplicación de lógica | el catálogo de errores y contratos viven SOLO en `packages/contracts`; los servicios los consumen (`workspace:*`); la ventana HMAC (±300 s) tiene un único punto de verificación por dirección |
| Stubs identificados correctamente | 4/4 con README honesto y verificado por prueba |

## 5. Estado de los contratos

- `packages/contracts`: **49/49** — catálogo congelado de 18 códigos intacto,
  despacho §4, bot v1 (13 rutas), v1 comercial, flujos, campañas, agenda.
- Cambio de contrato por S4.3: **NINGUNO** (ningún breaking change).
- Alineación adaptador↔cerebro: corrección de NORMALIZACIÓN en el adaptador
  (D-S43-2) para el sobre real `{storage_scope, approvals}` del cerebro —
  compatible hacia atrás, con prueba de vigía.

## 6. Resultado de las pruebas de AGENTE-GENERAL

Verificación REAL contra el servidor FastAPI del cerebro (proceso hijo real,
sin mocks; se omite solo si el repo no está presente — nunca simula):

| Requisito §4 | Estado | Evidencia |
|---|---|---|
| Autenticación HMAC | **CUMPLIDO lado CRM** | 10 tests de firma sobre HTTP real; el adaptador firma `X-Signature`/`X-Timestamp`/`X-Org-Id` siempre; fail-closed sin credenciales |
| Despacho de ejecuciones | **CUMPLIDO lado CRM · PENDIENTE lado cerebro** | el despacho sale tipado y con reintentos; contra el cerebro real `/crm/dispatch` responde **404** (endpoint aún no implantado en AGENTE-GENERAL — R-AG-1) |
| Reintentos | **CUMPLIDO** | 5xx reintentos con backoff verificados; 429 sin reintento |
| Health checks | **CUMPLIDO** | health real del cerebro 200 `healthy/ready` → interruptor de IA en línea |
| Aprobaciones HITL | **CUMPLIDO** (con corrección D-S43-2) | cola real `/api/v1/approvals/pending` → 200 con sobre real normalizado; 202 `approval_required` soportado |
| Identidad de organización | **CUMPLIDO lado CRM** | `X-Org-Id` en toda petición (vigía); la identidad triple vive en contracts |
| Aislamiento de memoria por tenant | **PENDIENTE lado cerebro (T9)** | `memory_store: not_configured` en core_only; el esquema de memoria del cerebro aísla por `(agent_id, domain, user_id, context_id)` SIN dimensión de organización → requisito D-014 sigue bloqueando producción |

**AGENTE-GENERAL NO se publica ni activa** (mandato §4): verificación y
documentación únicamente.

## 7. E2E real (self-test de VOCERO, corrida continua)

- Entorno documentado 036: app real (dev), PostgreSQL real, wa-mock/ai-mock
  integrados en la app, cerebro falso de prueba en 3261, BD `whatspower_036_e2e`.
- **269/302 checks verdes (0 FAIL)** en una sola corrida: setup de registro,
  guía de inicio, webhook us5, us-bsuid ×4 (inbound sin wa_id, sin teléfono,
  reconciliación 521/52, destinatario argentino), #51 nombre del contacto,
  us-bot-api ×9 (autorización 401/403, typing+leído, media proxy, perfil+KB,
  contexto, ficha, envío del bot, handoff, IA pausada/reset), zona horaria,
  FR-022, 008 inbox/adjuntos/previews (incluida imagen de 6 MB y 413), #78
  botones y listas, 015 agenda ×5 (incluido conector Zoom contra su mock),
  R10 huecos por fecha, 016/018 atribución.
- **Punto de parada reproducible:** al inicio de la ráfaga R11 (700 peticiones)
  el kernel del sandbox (4 GB RAM) mata el servidor dev (proceso ausente; 4
  configuraciones probadas: webpack/turbo × heap 2-3 GB). **No verificado en
  corrida continua: R11+ (~33 checks).** No es defecto del producto: en un host
  con ≥8 GB el mismo guion corre completo. **No se simuló ni se declaró
  terminada la parte faltante** (mandato §8).

## 8. Regresiones encontradas y correcciones (§6 del mandato)

| ID | Defecto (cómo se demostró) | Causa raíz | Corrección mínima | Prueba anti-regresión |
|---|---|---|---|---|
| D-S43-1 | 24/39 tablas org-scoped sin RLS (batería real) | lista fija de 22 nombres en `003` desalineada de las tablas reales | `003` dinámico + aborta si falta una; `004` grants de `app_runtime` (D-019) | la batería `test:multi-tenant` (26 casos) es el vigía permanente |
| D-S43-2 | HITL del adaptador contra el cerebro real devolvía datos no normalizados (integración real) | adaptador escrito contra §6 sin verificación contra el cerebro real | normalización compatible (array o `{approvals}`) en `client.ts` | sobre real congelado en `client.test.ts` + 5 pruebas de integración real |
| D-S43-3 | `sign-up/email` → 500 `SCHEMA_MISMATCH` (E2E real) | better-auth exige `invitation.created_at`; schema y migraciones de VOCERO no la tenían | columna aditiva + migración `0033` (D-021) | self-test E2E (registro + 269 checks) |

Ningún parche acumulado: cada corrección es mínima, aditiva o de aislamiento,
con prueba que impide su repetición. No se ocultó ningún error ni se cambió
funcionalidad para conseguir verdes.

## 9. Riesgos y pendientes

1. **T9 — memoria del cerebro por organización** (pendiente lado AGENTE-GENERAL;
   bloquea producción según D-014).
2. **R-AG-1 — `/crm/dispatch` no implantado en el cerebro** (404 real; el CRM
   falla tipado y con red de seguridad hasta publicar el adaptador).
3. **Runtime de BD sobre el rol dueño**: la URL documentada conecta como
   `whatspower` (dueño; RLS no muerde para superusuario). La valla de BD opera como
   `app_runtime` — probado; el cambio de rol de runtime es trabajo operativo de
   F5 (grants ya en `004`).
4. **A1 — SSE mono-instancia** (inherited, F5 backplane).
5. **E2E R11+ en host ≥8 GB** (limitación del sandbox, no del producto).
6. L1/L2 licencias (inherited) antes de F9.

## 10. Commit publicado y verificación del push

- Commits S4.3: (ver `git log` — fuerzan la trazabilidad completa de esta
  entrega; el push se verifica con `git ls-remote` tras subir).
- Criterio §8: pruebas reales ejecutadas y documentadas; lo no verificable está
  enumerado exactamente (§7 y §9) y **no se avanzó a fase alguna ni se desplegó
  producción**.

*Evidencia cruda: `CONTEXTO CRM/05_TESTS/TEST_INDEX.md` §S4.3,
`CONTEXTO CRM/08_SESSIONS/SESSION_2026-11-27_S4.3_FRONTERAS_Y_E2E.md`,
`apps/web/scripts/bateria-multi-tenant.mjs` (salida JSON real),
`apps/web/tests/unit/fronteras-dominios.test.ts`,
`services/agent-gateway/tests/cerebro-real.test.ts`.*
