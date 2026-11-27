# TEST INDEX — inventario de pruebas

**Última ejecución real:** 2026-11-27, sandbox de construcción, pnpm v9.15.9, Node v24.22.3.
**Regla:** los conteos se copian como «reportados» hasta reejecutarlos; los de
esta tabla con fecha son resultados REALES de esta sesión (comando + salida).

## Verificación Fase 4 — etapa 1 (REAL, 2026-11-27)

Comandos ejecutados en la raíz del monorepo: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build` (después de `pnpm install` limpio, 440 paquetes).

| Paquete | Typecheck | Lint | Tests | Build |
|---|---|---|---|---|
| `packages/contracts` | PASS | n/d (sin script propio) | **49/49 PASS** (4 archivos) | PASS |
| `packages/tenant` | PASS | n/d | **15/15 PASS** (1 archivo) | PASS |
| `services/agent-gateway` | PASS | n/d | **10/10 PASS** (1 archivo) | PASS |
| `services/flows` | PASS | n/d | **8/8 PASS** (1 archivo) | PASS |
| `services/campaigns` | PASS | n/d | **5/5 PASS** (1 archivo) | PASS |
| `apps/web` (VOCERO 2.12.0) | PASS | **PASS** (eslint .) | **1714/1714 PASS** (141 archivos) | **PASS** (next build completo) |
| Total | 7/7 | PASS | **1801/1801** | 7/7 |

### Evidencia de la regresión de VOCERO (conservación de comportamiento)

- **142 rutas API** (`route.ts`) y **28 páginas** (`page.tsx`) compiladas por `next build` — coincide con la auditoría (142/28).
- **43 tablas** Drizzle en `apps/web/src/lib/db/schema.ts` — coincide con la auditoría.
- Suite unitaria completa en verde: 141 archivos, 1714 tests (77 s).
- Cero cambios de código fuente en la migración (ver `apps/web/PROVENANCE.md`).

### Correcciones durante la verificación (transparencia)

1. `ExecutionResult` no estaba exportado como tipo en contracts → añadido.
2. Regex de `ACTOR` no aceptaba la identidad lógica del agente con `#` (`agent:org_x#ventas`) → corregida.
3. `callerAction: "Ídem"` (4 caracteres) violaba la propia regla de documento ejecutable → texto explícito.
4. Audiencia de campaña aceptaba `{kind:"contactIds"}` sin ids → `refine` fail-closed añadido.
5. Test de bookings esperaba que `…Z` fuera inválido; en Zod 4 `offset:true` acepta UTC explícito → expectativa corregida (naive datetime sí se rechaza).
6. Cliente del agente componía mal la URL de despacho (duplicaba `/crm/dispatch`) → `dispatchUrl` es endpoint completo, como `BRAIN_DISPATCH_URL` en VOCERO.

## Inventario por paquete (alcance real de cada suite)

| Suite | Alcance | Vigías clave |
|---|---|---|
| `contracts/tests/errors.test.ts` | Catálogo congelado de 18 códigos (D-013), HTTP por código, envelope tipado | Renombrar/retirar un código del contrato ROMPE la prueba |
| `contracts/tests/context.test.ts` | Identidad triple (org/agent/actor), scopes, cabeceras §2 | agentId sin mapeo org:* se rechaza |
| `contracts/tests/dispatch-bot.test.ts` | Despacho canónico §4 + 13 rutas bot congeladas + esquemas | Las 13 rutas VOCERO se conservan exactas |
| `contracts/tests/v1-flows-campaigns.test.ts` | 9 rutas v1 (toda escritura exige Idempotency-Key), flujos §8, campañas §9, agenda §10 | Transiciones ilegales de campaña se rechazan |
| `tenant/tests/tenant.test.ts` | Fail-closed sin contexto, propagación async, no-cruce de orgs, eco de org, cabeceras | Sin contexto → error; eco distinto → tenant_mismatch |
| `agent-gateway/tests/client.test.ts` | Firma HMAC real sobre servidor HTTP, reintentos 5xx, códigos tipados (ai_paused, firewall_denied, rate_limited sin reintento), HITL 202, health sin_cerebro | Fail-closed sin apiKey/secreto |
| `flows/tests/hmac.test.ts` | Ventana ±300 s anti-replay, timing-safe, fail-closed sin secreto | Firma alterada y timestamps fuera de ventana se rechazan |
| `campaigns/tests/states.test.ts` | Máquina de estados 7 estados, estados terminales, checks JIT 50 ms, webhook leads | Transiciones ilegales y webhook sin org se rechazan |
| `apps/web` tests/unit | Suite heredada completa de VOCERO (141 archivos) | Regresión de comportamiento |

## Pendientes de ejecución (definidos, no ejecutados aún)

| Prueba | Cuándo | Estado |
|---|---|---|
| Batería T1-T15 de fuga multi-tenant sobre PostgreSQL real (MODELO_MULTI_TENANT §9) | F5 (S5.3), en CI | DEFINIDA — scripts RLS en `infra/sql/`; sin Docker en el sandbox de esta etapa |
| Guiones E2E de VOCERO (test:e2e:* con servidor y BD) | S4.3 | Reportados; requieren entorno con PostgreSQL |
| Prueba de vigilancia de fronteras entre los 14 dominios | S4.3 | PENDIENTE |
| Verificación de licencias desde lockfile + THIRD_PARTY_NOTICES | S4.1 (siguiente sprint) | PENDIENTE |

## Resultados S4.2 (2026-11-27) — reorganización en los 14 dominios

| Verificación | Resultado real |
|---|---|
| Typecheck monorepo | 6/6 Done, 0 errores |
| Lint monorepo | Done, 0 errores |
| Suite completa | **1.801** (apps/web 1.714/1.714 · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway 10) |
| Build (`next build`) | OK (28 páginas) |
| Rutas API | 142 bajo `src/app/api` (+2 `.well-known/` OAuth); `git diff` de rutas baseline↔HEAD vacío |
| Contratos | api-v1/openapi/bot-twin/despacho 70 verdes; contracts 49 verdes (catálogo congelado intacto) |
| Guardarraíles de dominio | notas-internas, stage-history-guard, ficha-guard, api-v1, conversions con rutas nuevas; invariantes intactas |
| Canarios regenerados con doble verificación | scrypt (better-auth) y SigV4 (spec AWS en Python vs implementación del código, coinciden) |

---

## Resultados S4.3 (2026-11-27) — fronteras entre dominios, PostgreSQL real y E2E

Comandos: `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r test` · `pnpm -r build`
· `pnpm --filter @vestro/web test:multi-tenant` · self-test E2E documentado (036).

| Verificación | Resultado real |
|---|---|
| Typecheck monorepo | 6/6 Done, 0 errores |
| Lint monorepo | Done, 0 errores |
| Suite completa | **1.816** — apps/web **1.723/1.723 (142 archivos)** · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway **16** (2 archivos, uno contra el cerebro real) |
| Baseline VOCERO 1.801 | **Intacta**: 0 pruebas eliminadas o debilitadas; +15 nuevas (9 fronteras + 1 sobre HITL + 5 integración cerebro) |
| Build (`next build`) | OK — compilación completa |
| Rutas API | 142 bajo `src/app/api` (vigía permanente en `fronteras-dominios.test.ts`) |
| Batería multi-tenant (T1-T15 subset BD + audit + txns) | **26/26 PASS** sobre PostgreSQL 16.16 REAL (`vestro_s43_bateria`, rol `app_runtime` con FORCE RLS) |
| Cobertura RLS | **39/39 tablas org-scoped** con `ENABLE + FORCE RLS` (defecto D-S43-1 corregido: antes 15/39) |
| Contratos versionados | contracts 49 verdes; vigía de 13 rutas bot del contrato contra los `route.ts` reales; 142 rutas congeladas |
| Fronteras de dominios | **9/9** (`fronteras-dominios.test.ts`): 14 dominios + Platform, 4 stubs honestos, grafo congelado de 38 aristas, 12 pares bidireccionales documentados, 2 ciclos conocidos congelados |
| AGENTE-GENERAL (integración real) | **5/5 contra el servidor FastAPI real** (health 200 healthy/ready; despacho → 404 tipado: endpoint `/crm/dispatch` PENDIENTE en el cerebro (R-AG-1); HITL approvals 200 con sobre real normalizado; `memory_store: not_configured` → T9 pendiente) |
| E2E real (self-test 036, servidor dev + PostgreSQL + wa-mock/ai-mock/cerebro-falso) | **269/302 checks verdes (0 FAIL)** en una sola corrida; la corrida se detiene por memoria del sandbox (4 GB) al inicio de la ráfaga R11 (700 peticiones); secciones R11+, ~33 checks, quedaron sin ejecutar en corrida continua |

### Defectos registrados y corregidos en S4.3 (§6 del mandato)

| ID | Defecto | Causa raíz | Corrección | Prueba anti-regresión |
|---|---|---|---|---|
| D-S43-1 | 24 de 39 tablas org-scoped sin RLS (credenciales Meta/IG/Messenger/TikTok/Google/Zoom, OAuth ×3, `member`, `invitation`, `media_asset`, …) | `003_rls_policies.sql` con lista fija de 22 nombres que no coincidía con las tablas reales | RLS dinámica por descubrimiento + valla estática que aborta si falta una; `004_grants.sql` para el rol `app_runtime` | Batería 26/26 (`test:multi-tenant`) — la batería es el vigía permanente |
| D-S43-2 | `approvalsPending()` del adaptador esperaba array plano; el cerebro real responde `{storage_scope, approvals}` | El adaptador se escribió contra el contrato §6 sin verificación contra el cerebro real | Normalización compatible (array o sobre) en `services/agent-gateway/src/client.ts` | Test de sobre real en `client.test.ts` + integración real en `cerebro-real.test.ts` |
| D-S43-3 | `POST /api/auth/sign-up/email` → 500 `SCHEMA_MISMATCH` (falta `invitation.createdAt`) | better-auth exige la columna; schema y migraciones de VOCERO no la tenían (invisible sin BD real) | Columna añadida a schema + migración aditiva `0033` (D-021) | Self-test E2E completo de registro; 269 checks verdes tras la corrección |

### Deuda y pendientes documentados (no ocultados)

1. **Ciclo de valores heredado** `conversations/inbox` (`ingest→reacciones→send→ingest`) — preexistente en VOCERO (verificado en `c370cc4`); congelado por vigía; refactor futuro fuera de S4.3 (D-020).
2. **T9 (memoria por tenant del cerebro)**: el `memory_store` de AGENTE-GENERAL está `not_configured` en core_only y su esquema aísla por `(agent_id, domain, user_id, context_id)` SIN dimensión de organización — pendiente lado cerebro (bloquea activación en producción, D-014).
3. **Endpoint `/crm/dispatch` en el cerebro**: 404 real; el despacho del CRM falla tipado hasta publicar el adaptador en AGENTE-GENERAL (R-AG-1).
4. **Runtime sobre el rol dueño**: el `DATABASE_URL` documentado conecta como `vestro` (dueño/superusuario, ignora RLS). La valla de BD muerde al operar como `app_runtime` (probado); el cambio de rol de runtime queda como trabajo operativo de F5 (los grants ya están en 004).
5. **E2E corrida completa**: R11+ (~33 checks) sin verificar en corrida continua por memoria del sandbox (4 GB); en un host con ≥8 GB el mismo guion corre completo (`node --env-file=.env.e2e-036 scripts/e2e-selftest.mjs`).

---

## Resultados S4.4 (2026-11-27) — cierre de bloqueos del cerebro (R-AG-1 + T9)

Comandos: `pytest tests` (cerebro) · `pnpm -r test` · `pnpm -r typecheck` ·
`pnpm -r lint` · `pnpm -r build` · `pnpm --filter @vestro/web test:multi-tenant`
· self-test E2E documentado (036).

| Verificación | Resultado real |
|---|---|
| Suite del cerebro AGENTE-GENERAL | **821/821** — baseline 781 intacta + 40 nuevas (15 memoria-org T9 + 25 integración `/crm/dispatch`) |
| Integración real CRM ↔ cerebro | **9/9** contra el uvicorn real (`cerebro-real.test.ts`): health con memoria configurada (T9), despacho real **200** `{accepted, event_id, approvalRequired:false}` (R-AG-1 cerrado), idempotencia real, firma HMAC manipulada → 401 tipado, organización cruzada → **403 `tenant_mismatch`** (envelope del catálogo), HITL 200, identidad de organización |
| Suite completa CRM | **1.819/1.819** — apps/web 1.723 (142 archivos) · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway **19**; baseline 1.816 íntegra, 0 pruebas eliminadas o debilitadas |
| Typecheck / lint / build | 6/6 Done · Done · OK |
| Rutas API / contratos / fronteras | 142 · 49/49 · 9/9 (vigías intactos) |
| Batería multi-tenant (PostgreSQL 16.16 real, clúster limpio `pgdata-s44`, 34 migraciones) | **26/26 PASS** — cobertura RLS **39/39 tablas org-scoped**; T1–T15, audit hash-chained, transacciones, credenciales e ISO |
| Memoria del cerebro por organización (T9) | 15/15 unitarias (`test_memory_org_isolation.py`: clave `(org_id, agent_id, domain, user_id, context_id)`, identidad↔org fail-closed, consultas cruzadas = 0 filas / `PermissionError`, migración legacy real sin pérdida) + negativas por HTTP |
| Vigía de contaminación del seed del cerebro | 0 hallazgos críticos (el puente vive en `albra_specialization/crm`, hook genérico `extra_extensions`; D-022) |
| E2E real (self-test 036, corrida continua, turbo dev + heap 2 GB) | **269/302 checks verdes (0 FAIL)** — parada reproducible al inicio de R11 por memoria del sandbox (3,9 GB; el guion completo exige ≥8 GB, condición del propio mandato); 4 configuraciones probadas (webpack/turbo × heap 1,6–2,5 GB); R11+ (~33 checks) sin verificar, nada simulado |

### Defectos registrados y corregidos en S4.4 (§6)

| ID | Defecto | Causa raíz | Corrección | Prueba anti-regresión |
|---|---|---|---|---|
| D-S44-1 | `SQLiteMemoryStore` con BD migrada leía `full_json` de la columna equivocada | acceso posicional `row[-1]` asumía `full_json` última; `ALTER TABLE ADD COLUMN org_id` la añade al final | acceso por NOMBRE de columna (`sqlite3.Row`) | `test_legacy_sqlite_database_migrates_without_data_loss` (BD legacy real → migración → lectura intacta) |
| D-S44-2 | health del cerebro sin `memory_manager` — T9 no verificable por HTTP | lista fija de componentes en `Runtime.health()` | componente añadido (genérico) | `cerebro-real.test.ts`: `memory_store` + `memory_manager` = `configured` |
| D-S44-3 | vigía de contaminación del seed en rojo (55 hallazgos `crm`) | primera ubicación del puente dentro de `src/albra_seed/` | puente en `albra_specialization/crm/bridge.py` + hook `extra_extensions`; el seed no importa dominio | `tests/contamination` 0 críticos; suite cerebro 821/821 |

### Pendientes documentados (no ocultados)

1. **E2E R11+ (~33 checks)** requiere host ≥8 GB (mandato); sandbox 3,9 GB —
   corrida continua detenida en la frontera física, misma de S4.3.
2. Rol runtime de BD y backplane SSE — trabajo operativo de F5 (heredado).
3. Activación en producción del puente: secretos fuertes, memoria persistente,
   autenticador real y firewall default-deny (riesgo S2 vigente para el demo).

---

## Resultados F5 (2026-11-28) — preparación y validación de producción

Comandos: `pnpm -r test` · `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r build` ·
`pnpm --filter @vestro/web test:multi-tenant` · `node scripts/verificar-rol-runtime.mjs` ·
`node scripts/verificar-restauracion.mjs` · `infra/backup/prueba-persistencia-recuperacion.sh` ·
`pytest tests` (cerebro) · self-test E2E (036) · `vitest tests/unit/sse-backplane.test.ts`.

| Verificación | Resultado real |
|---|---|
| Suite completa CRM (`pnpm -r test`, con DATABASE_URL real y AGENTE_GENERAL_DIR al cerebro) | **1.825/1.825 PASS** — apps/web **1.729** (143 archivos: 142 + sse-backplane) · contracts 49 · tenant 15 · flows 8 · campaigns 5 · agent-gateway 19 (integración real cerebro 9/9 incluida) |
| Typecheck / lint / build | 0 errores · Done (tras corregir 2 variables muertas) · OK (7 paquetes) |
| Rutas API / contratos / fronteras | **142** (vigía) · 49/49 · **9/9** (grafo congelado con la arista F5 documentada D-027; ciclos sin nuevos) |
| Batería multi-tenant (PostgreSQL 16.16 real) | **26/26 PASS** — RLS **39/39 tablas org-scoped** (clon TEMPLATE de base migrada limpia) |
| **F5.1 rol runtime** (`verificar-rol-runtime.mjs`) | **24/24 PASS** — `vestro_runtime` LOGIN miembro de `app_runtime`: solo DML+secuencias (44/44 tablas), DDL rechazado (CREATE/DROP TABLE, CREATE ROLE → 42501), fail-closed sin contexto, cruzado 0 filas/42501, DML en su org, audit append-only, app operativa (R1-R7) |
| **F5.2 backplane SSE** (LISTEN/NOTIFY, PostgreSQL real) | **6/6 PASS** — pg_notify de OTRA instancia llega al suscriptor local; exactly-once por instancia; payload >7900 viaja comprimido e íntegro; filtro por org; modo off conserva el contrato previo |
| **F5.3 ciclo respaldo→restauración→verificación** | **5/5 PASS** — 44/44 tablas con conteos idénticos, RLS 39/39 restaurada con FORCE, cadena de hash de audit_log íntegra, 34 migraciones, base operable (`pg_dump -Fc` + `pg_restore` 16.9 sobre servidor 16.16) |
| **F5.3 persistencia y recuperación** | **PASS** — marcador con nonce único sobrevive reinicio controlado (P3) y crash real SIGKILL al postmaster con replay de WAL (F3); cadena de hash íntegra tras ambos |
| Cerebro AGENTE-GENERAL (`pytest tests`) | **821 passed, 1 skipped** (el skip es `test_nvidia_glm_flash`: requiere `NVIDIA_API_KEY`, prueba en vivo condicionada al entorno) |
| E2E self-test 036 (turbo dev + heap 2 GB, :3260, corrida B corregida) | **270/302 checks OK, 0 FAIL** — parada reproducible al inicio de R11 por OOM del kernel (dmesg «Killed process next-server»; sandbox 3,9 GB; el guion completo exige ≥8 GB); corrida A abortada por defecto de configuración del arnés (D-F5-3, log conservado) |
| `/api/health` con campos F5 | verificado en el servidor real: `dbRole:"owner"`, `sse:{mode:"off", connected:null, ...}` — aditivo, sin romper el contrato previo |
| Escaneo de secretos del repo | sin hallazgos reales (0 tokens/claves en 1.272 archivos; solo fixtures E2E `password-e2e-*`) |

### Corrida E2E F5 (036)

Entorno reconstruido desde cero: BD `vestro_036_e2e` limpia (34 migraciones +
audit_log), `.env.e2e-036` recreado (wa-mock/ai-mock/zoom-mock en la app,
BOT_API_KEY ≥16, AGENT_COALESCE_MS=1500, AGENT_COALESCE_LARGO_MS=1500,
AGENDA=on, BRAIN_DISPATCH_URL → cerebro falso 3261, WA_MOCK_ENABLED=true),
servidor dev turbo + heap 2 GB en :3260. Resultado al cierre: ver
`ENTREGA_F5.md` §pruebas. El host sigue en 3,9 GB RAM — el límite R11+
documentado en S4.4 sigue siendo condición física del sandbox, no del producto.
