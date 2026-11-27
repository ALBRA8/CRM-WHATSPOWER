# CHECKLIST — Producción del puente CRM ↔ AGENTE-GENERAL (F5)

**Fuente de verdad:** `CONTRATOS_INTEGRACION.md` (contrato versionado
`CONVERSATION_TURN_RECEIVED`), `ENTREGA_S4_4.md` §2-§3 (implementación real),
`ENTREGA_S4_4.md` §7.4 (requisitos de activación heredados). Este checklist es
la puerta de salida de F5: cada ítem exige evidencia verificable, no una
declaración. **Ninguna activación para clientes sin autorización expresa del
propietario** (mandato F5 §7).

## A. Identidad y secreto compartido

| # | Requisito | Cómo se verifica | Estado |
|---|---|---|---|
| A1 | `ALBRA_CRM_HMAC_SECRET` ≥ 32 bytes aleatorios, IGUAL en ambos lados | `openssl rand -hex 32`; mismo valor en el entorno del CRM (`AGENT_API_KEY`/secreto del gateway) y del cerebro. Prueba real: firma manipulada → 401 (cerebro-real 9/9) | ☐ |
| A2 | El secreto NO vive en el repo ni en logs | `infra/SECRETOS.md`; grep de secretos en el repo limpio; logs sin cuerpo/firma | ☐ |
| A3 | Procedimiento de rotación probado (dos secretos en ventana) | rotar en staging: cerebro acepta nuevo, viejo rechazado; CRM actualiza sin downtime | ☐ |
| A4 | Ventana de repetición ±300 s activa en relojes sincronizados | NTP en ambos hosts; prueba de timestamp fuera de ventana → 401 | ☐ |

## B. Cerebro (AGENTE-GENERAL)

| # | Requisito | Cómo se verifica | Estado |
|---|---|---|---|
| B1 | Autenticador REAL (el `DevAuthenticator` jamás corre en producción: fail-closed 503) | config del autenticador en el despliegue; `/api/v1/health` refleja componentes `configured` | ☐ |
| B2 | Perímetro de seguridad con reglas explícitas — el allow-all `*` del `render_app.py` de demo NO va a producción (riesgo S2 vigente) | PolicyEngine con permiso `crm:dispatch` creado y reglas ALLOW/REQUIRE_HITL/DENY explícitas; sin regla → `no_matching_rule` (default-deny probado) | ☐ |
| B3 | Memoria persistente por organización: `ALBRA_MEMORY_DB` a archivo/BD persistente (nunca `:memory:`) | reinicio del cerebro conserva memoria de cada org; suite T9 verde en el despliegue | ☐ |
| B4 | Rate limit por organización dimensionado (`ALBRA_CRM_DISPATCH_RATE_PER_MINUTE`, 240/min default) | prueba de ráfaga: org A throttled NO afecta org B (429 + Retry-After) | ☐ |
| B5 | Ledger de idempotencia con retención definida (crecimiento acotado) | política documentada de purga por `(org, conversación, event_id)` | ☐ |
| B6 | `/api/v1/health` responde `memory_store: configured`, `memory_manager: configured` | curl desde el host del CRM | ☐ |
| B7 | Firewall de red: el cerebro SOLO accesible desde el CRM (y operación), jamás público | reglas de red/documento de topología; curl externo rechazado | ☐ |

## C. CRM (WhatsPower)

| # | Requisito | Cómo se verifica | Estado |
|---|---|---|---|
| C1 | `BRAIN_DISPATCH_URL` al cerebro por red interna (alias de red, no dominio público) | tarjeta del Agente muestra health verde (server/bot/status.ts) | ☐ |
| C2 | `BOT_API_KEY`/secreto del gateway presentes (fail-closed sin ellos: no envía nada) | arranque del gateway con secreto; intento sin secreto no despacha | ☐ |
| C3 | Interruptor del Agente por organización apagado por defecto hasta autorización | estado del interruptor en BD; el despacho no corre sin encendido explícito | ☐ |
| C4 | Cola HITL visible: `GET /api/v1/approvals/pending` operativa y con dueño del cierre | prueba real 202 + cola (S4.4); runbook de aprobación/rechazo | ☐ |
| C5 | `DATABASE_URL_RUNTIME` apuntando a `vestro_runtime` (infra/sql/005) — o decisión documentada de quedarse en owner con la primera valla `scoped()` | `/api/health` → `dbRole:"runtime"`; verificador R1-R7 verde | ☐ |
| C6 | Backplane SSE según topología: 1 instancia → `SSE_BACKPLANE=off`; N instancias → `postgres` | `/api/health` → `sse.mode` correcto; prueba de evento cruzado | ☐ |
| C7 | Webhook por URL firmada por organización; firewall de canales oficial activo | S4.3/S4.4 webhook us5; ninguna ruta pública sin firma | ☐ |

## D. Datos y operación

| # | Requisito | Cómo se verifica | Estado |
|---|---|---|---|
| D1 | Respaldo automático programado (cron/systemd) + prueba de restauración REAL aprobada | infra/backup + ENTREGA_F5 §backups; ciclo verde en el entorno de despliegue | ☐ |
| D2 | Persistencia tras reinicio y recuperación tras crash probadas en el entorno | prueba-persistencia-recuperacion.sh verde en despliegue | ☐ |
| D3 | `/api/health` del CRM y `/api/v1/health` del cerebro monitorizados (probe externo) | alerta cuando `ok:false` o componentes no `configured` | ☐ |
| D4 | Íntegridad de conversaciones/contactos/documentos tras un ciclo de backup→restauración | verificar-restauracion.mjs 5/5 en el entorno de despliegue | ☐ |
| D5 | Procedimiento de reversión: imagen/commit anterior etiquetado, `pg_restore` de emergencia documentado | runbook de rollback (ENTREGA_F5 §procedimiento) | ☐ |
| D6 | Los 4 dominios stub siguen identificados como pendientes (sin exponer superficies ficticias) | ARQUITECTURA_MAESTRA_CRM.md — vigía de dominios verde en la suite | ☐ |

## E. Límites declarados de F5 (no confundir con bloqueantes nuevos)

1. **E2E 302 checks**: requieren host ≥8 GB (el entorno de construcción tiene
   3.9 GB y se detiene reproduciblemente en R11); 269/302 verificados en
   corrida continua en S4.4. Correr COMPLETO en el host de despliegue antes de
   clientes reales.
2. **Corte completo al rol runtime** (C5): con soporte de conexión y verificación
   R1-R7 entregadas; la propagación de contexto por transacción en todo el
   pool es trabajo operativo posterior (ver infra/README §5).
3. **Exposición pública**: prohibida por el mandato F5 §7 hasta entrega de
   resultados y autorización expresa.
