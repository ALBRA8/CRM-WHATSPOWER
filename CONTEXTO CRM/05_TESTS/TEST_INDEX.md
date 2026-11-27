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
