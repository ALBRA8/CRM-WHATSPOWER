# CONTRATOS_INTEGRACION.md

**Proyecto:** Construcción del nuevo CRM SaaS multi-tenant
**Fase:** 3 — Contratos de integración entre módulos
**Fecha:** 2026-11-27
**Base:** los contratos ya publicados y probados del ecosistema se conservan: OpenAPI 3.1 del bot API de VOCERO (`docs/openapi.json`, 13 rutas `/api/bot/*`), contrato de despacho estándar (`specs/021-despacho-estandar/contracts/despacho.md`), contrato HARNESS de CRM-ALBRA (`/api/crm/actions`, MCP), puentes HMAC de WHATSPOWER/ULTRA y API de ejecución/aprobaciones de AGENTE-GENERAL. Este documento los unifica y versiona.

## 1. Principios de todo contrato

| Principio | Regla |
|---|---|
| **Versionado** | Rutas `/v1/…`; cambios incompatibles → `/v2/…` con ventana de deprecación; el OpenAPI se sirve por instancia (`GET /v1/openapi.json`) |
| **Identidad triple** | Toda operación lleva: identidad del **tenant** (`organizationId`), identidad del **agente lógico** cuando aplica (`agentId`), identidad del **usuario** cuando aplica (`actor` + scopes) |
| **Permisos** | Scopes `read / operate / send / configure` (heredados de la API v1 de VOCERO) + permisos del agente (RBAC del motor: `execution:run`, `approval:decide`, …) |
| **Validación** | Todo input validado con esquema (Zod en el núcleo; contratos tipados en los satélites); rechazo 422 con detalle |
| **Idempotencia** | `Idempotency-Key` en toda operación de escritura + claves naturales en la BD (`waMessageId` UNIQUE, `sha256(campaignId_phone)`, `(org,eventId)` en flujos); re-ejecutar no duplica efectos |
| **Auditoría** | Toda operación queda en `audit_log` por tenant (quién, qué, cuándo, desde dónde, con qué resultado) |
| **Errores tipados** | Catálogo único de códigos (§7); los 409 de VOCERO se conservan por compatibilidad |
| **Límites** | Rate limits por llave/org/plan con `429 + Retry-After` |
| **Fail-closed** | Sin firma válida, sin org verificada o sin salvaguarda explícita (`ALLOW_REAL_DISPATCH`), no se ejecuta |

## 2. Autenticación y firma

| Flujo | Mecanismo | Notas |
|---|---|---|
| UI → núcleo | Sesión cookie (better-auth, 7 días) + CSRF | Multi-org por sesión activa |
| Llave API → núcleo | `Authorization: Bearer vk_…` o `X-API-Key`; guardada solo por sha256; scopes | Actúa con el rol recortado de su creador (patrón VOCERO) |
| OAuth → núcleo | OAuth 2.0 PKCE S256, tokens opacos rotados, `.well-known` RFC 8414/9728 | Heredado de VOCERO |
| Núcleo → AGENTE-GENERAL | `Authorization: Bearer AGENT_API_KEY` + firma HMAC `X-Signature` (cuerpo) + `X-Timestamp` + `X-Org-Id` | Hereda el esquema del puente CRM-ALBRA→agente (fail-closed sin clave) |
| AGENTE-GENERAL → núcleo | `X-API-Key: BOT_API_KEY` (+ `Authorization: Bearer` aceptado) sobre `/api/bot/*` y `/v1/*` autorizado | El token de WhatsApp nunca sale del CRM |
| Núcleo → flujos/campañas | HMAC-SHA256 con secreto por organización + `X-Timestamp` (±300 s) + anti-replay durable | Heredado de los puentes del ecosistema |
| Proveedores → núcleo | Webhook con token de URL por conexión (timing-safe) + firma del proveedor (`x-hub-signature-256`) | Persistir antes del ACK |

Cabecera estándar de contexto en llamadas internas (núcleo ↔ satélites):

```
X-Org-Id: <organizationId>            # obligatorio; el receptor verifica el eco
X-Agent-Id: <agentLogicalId>          # cuando la operación la ejecuta un agente
X-Actor: user:<id> | api_key:<id> | agent:<id> | webhook:<connId>
X-Request-Id: <uuid>                  # correlación con ExecutionTrace del agente
X-Signature: <hmac-sha256(body+timestamp)>
X-Timestamp: <unix>
```

## 3. Catálogo de operaciones (las 15 del mandato, sección 5)

| # | Operación | Dirección | Endpoint | Scope/permiso | Idempotencia |
|---|---|---|---|---|---|
| 1 | Recibir eventos de conversación | CRM → Agente | `POST {AGENT_DISPATCH_URL}/crm/dispatch` | — (evento firmado) | `event_id` único por conversación |
| 2 | Entregar contexto autorizado | Agente → CRM | `GET /api/bot/context` | bot | solo lectura |
| 3 | Consultar contactos | Agente → CRM | `GET /v1/contacts` (+`search`) | read | solo lectura |
| 4 | Consultar oportunidades | Agente → CRM | `GET /v1/leads` | read | solo lectura |
| 5 | Consultar historial | Agente → CRM | `GET /v1/conversations/{id}/messages` | read | solo lectura |
| 6 | Crear contacto | Agente → CRM | `POST /v1/contacts` | operate | `Idempotency-Key` |
| 7 | Actualizar información comercial (ficha) | Agente → CRM | `PUT /api/bot/ficha` | operate | merge por claves |
| 8 | Crear tarea | Agente → CRM | `POST /v1/tasks` | operate | `Idempotency-Key` |
| 9 | Programar seguimiento | Agente → CRM | `POST /v1/tasks` con `dueAt` / `POST /v1/sequences` (motor flujos) | operate | `Idempotency-Key` |
| 10 | Consultar disponibilidad | Agente → CRM | `GET /api/bot/availability` | bot | solo lectura (registra lo ofrecido) |
| 11 | Crear reserva | Agente → CRM | `POST /api/bot/bookings` | bot | slot ofrecido + único parcial en BD |
| 12 | Ejecutar workflow | Agente → CRM | `POST /v1/automations/run` (núcleo) o interno del motor del agente | operate + firewall/policy/HITL del agente | `Idempotency-Key` |
| 13 | Enviar mensaje autorizado | Agente → CRM | `POST /api/bot/messages` | send | `waMessageId`/key único |
| 14 | Transferir conversación a humanos | Agente → CRM | `POST /api/bot/handoff` | operate | por conversación |
| 15 | Consultar resultados de ejecuciones | CRM → Agente | `GET {AGENT_API}/api/v1/execution/{id}` + `/api/v1/approvals/pending` | Bearer agente | solo lectura |

Adicionalmente el **CRM → Agente** consume: health (`GET {AGENT_API}/api/v1/health`), A2A (`POST /a2a/v1/` JSON-RPC, `GET /.well-known/agent-card.json`) para agentes secundarios compatibles, y el canal de aprobaciones (§6.2).

## 4. Contrato de despacho (evento de conversación, CRM → Agente)

Conserva el despacho estándar de VOCERO (outbox con coalescing por ráfaga, firma, 3 reintentos, red de seguridad) y añade el contexto del tenant:

`POST {BRAIN_DISPATCH_URL}` — ejemplo de cuerpo:

```json
{
  "event": "conversation.turn.received",
  "event_id": "evt_9f3k2m",
  "conversation": {
    "id": "cv_ab12cd",
    "channel": "whatsapp",
    "test": false
  },
  "contact": {
    "id": "ct_x7y8z9",
    "identity": "5215512345678",
    "name": "Laura Pérez",
    "stage": "interested",
    "aiPaused": false
  },
  "organization": {
    "id": "org_4h5j6k",
    "agentId": "org_4h5j6k#ventas",
    "timezone": "America/Bogota",
    "locale": "es"
  },
  "messageIds": ["msg_01", "msg_02"],
  "turn": {
    "text": "¿Tienen disponibilidad el jueves por la tarde?",
    "media": [],
    "sinceLastReplyMs": 382000
  },
  "capabilities": {
    "booking": true,
    "stageMoves": ["qualified"],
    "windowOpenUntil": "2026-11-28T03:12:00Z"
  },
  "signature": "…hmac-sha256…"
}
```

Reglas del contrato (no negociables, heredadas):

1. El CRM espera el final de la ráfaga del cliente antes de despachar (coalescing `AGENT_COALESCE_MS`).
2. El agente responde por `POST /api/bot/messages` (no por la respuesta HTTP del despacho); la respuesta HTTP del despacho solo acusa recepción.
3. Sin respuesta tras 3 reintentos → la conversación queda para una persona (red de seguridad) y el mensaje sigue en la bandeja.
4. `conversation.test: true` marca el turno del Laboratorio: el agente debe responder, pero el CRM **jamás envía** al canal (sandbox).
5. `capabilities.stageMoves` limita las etapas a las que el agente puede avanzar el lead (solo hacia adelante y abiertas).

## 5. API bot v1 (Agente → CRM) — contrato conservado

Las 13 rutas de VOCERO se conservan con sus códigos de error; añadidos en cursiva:

| Endpoint | Para qué | Ejemplo de cuerpo / respuesta |
|---|---|---|
| `GET /api/bot/profile` | Perfil del agente y KB que editó el negocio; `llm` para pensar | `{ "agent": { "name": "Sofía", "tone": "cercano", "instructions": "…", "escalation": "…" }, "kb": { "qa": [...], "blocks": [...] } }` |
| `GET /api/bot/context` | Persona, etapa, humano activo, ventana, citas, *tareas y seguimientos* | *(extensión: `tasks: [{id, title, dueAt}]`)* |
| `POST /api/bot/messages` | Responder (queda marcado como IA) | `{ "conversationId": "cv_ab12cd", "text": "…" }` → 201 |
| `POST /api/bot/llm/{ruta}` | *Compat:* proxy LLM conservado; en la plataforma el uso principal del proveedor vive en el motor del agente | passthrough OpenAI-compatible; 402 `sin_credencial` |
| `PUT /api/bot/ficha` | Guardar lo que el bot descubre del lead | `{ "conversationId": "cv_…", "ficha": { "zona": "Chapinero", "metros": "72" } }` |
| `POST /api/bot/stage` | Avanzar el lead (solo adelante, etapas abiertas) | `{ "leadId": "ld_…", "stageId": "st_qualified" }` → 200; 409 si no permitido |
| `POST /api/bot/handoff` | Devolver la conversación a un humano | `{ "conversationId": "cv_…", "reason": "pide_humano" }` |
| `POST /api/bot/typing` | Marcar leído + «escribiendo…» | `{ "conversationId": "cv_…" }` |
| `GET /api/bot/media/{id}` | Descargar adjunto entrante sin tocar Meta | binario |
| `POST /api/bot/reset` | Reiniciar conversación de pruebas | `{ "conversationId": "cv_…" }` |
| `GET /api/bot/availability` | Horarios para ofrecer (quedan registrados como ofrecidos) | `?date=2026-11-30` → `{ "slots": ["10:00","11:30"] }` |
| `POST|PATCH /api/bot/bookings` | Reservar (201) o mover (200) **solo un horario que se ofreció** | `{ "conversationId": "cv_…", "slot": "2026-11-30T10:00:00-05:00", "connector": "zoom" }` |
| `GET /api/bot/openapi.json` | Contrato OpenAPI 3.1 servido por la instancia | — |

*Nuevas rutas bot autorizadas en la plataforma (mismo esquema de auth):*

| Endpoint | Para qué |
|---|---|
| `POST /v1/tasks` *(nueva)* | Crear tarea/seguimiento con `Idempotency-Key` |
| `GET /v1/knowledge` *(ya en v1)* | KB por organización (desacoplada del agente) |
| `POST /v1/automations/run` *(nueva)* | Ejecutar automatización declarada por el tenant (pasa por firewall/policy del agente) |
| `GET /v1/execution-results/{id}` *(nueva, CRM → Agente)* | Resultado de una ejecución con traza |

## 6. Integración específica con AGENTE-GENERAL

### 6.1 Mapeo de identidad

- **Tenant → espacio del agente:** `agent_id = "org:<organizationId>#<agentLogico>"`; `domain = "crm"`. La memoria queda aislada por organización (ver `MODELO_MULTI_TENANT.md` §6).
- **Especializaciones** (ventas, atención, prospección, seguimiento, recuperación, marketing, agendamiento, soporte, personalizadas) = **configuración por organización** del perfil del agente en el CRM (instrucciones, conocimiento, herramientas autorizadas, políticas) + rol/herramientas como datos (patrón spec 034). **No se crean motores cognitivos separados.**

### 6.2 Aprobaciones humanas (HITL) visibles en el CRM

1. El CRM consulta periódicamente `GET {AGENT_API}/api/v1/approvals/pending` (Bearer agente).
2. La UI muestra la cola por organización con evidencia del agente.
3. La decisión se envía por `POST /api/v1/approvals/{id}/decision` **por parte del usuario** (el CRM nunca auto-aprueba; el ApprovalEngine del agente tampoco).
4. La decisión y su autor quedan auditadas en ambos lados.

### 6.4 Estado de implantación (S4.4, 2026-11-27)

| Bloqueador | Estado | Evidencia |
|---|---|---|
| R-AG-1 (`/crm/dispatch` en el cerebro) | **CERRADO** — endpoint real en `AGENTE-GENERAL` (`albra_specialization/crm/bridge.py`, montado vía hook genérico `extra_extensions`): HMAC ±300 s timing-safe, eco de organización + identidad D-014, RBAC `crm:dispatch`, firewall (default-deny), HITL 202 `approval_required`, envelope D-013, idempotencia `(org, conversación, event_id)`, rate limit por org, persistencia en memoria de tenant antes del ACK | `test_crm_dispatch.py` 25/25 (app real); `cerebro-real.test.ts` 9/9 contra uvicorn real — despacho 200, firma manipulada 401, org cruzada 403 tipado |
| T9 (memoria del cerebro por organización) | **CERRADO** — dimensión `org_id` primera componente de la clave `(org_id, agent_id, domain, user_id, context_id)`, validación identidad↔org fail-closed en cada operación, cubeta legacy `""` para registros pre-S4.4 (migración aditiva probada sin pérdida), health reporta `memory_store`/`memory_manager` configurados | `test_memory_org_isolation.py` 15/15; suite del cerebro 821/821; health verificado contra el servidor real |

La activación en producción exige además (F5+): `ALBRA_CRM_HMAC_SECRET` fuerte
compartido, `ALBRA_MEMORY_DB` persistente, autenticador real (el dev token
jamás corre en producción) y firewall default-deny del cerebro.

### 6.3 Reglas del adaptador (independiente, versionado)

- El adaptador vive en el núcleo (`src/server/agent-adapter/`): encola, firma, reintenta, clasifica y audita. El agente **no** recibe credenciales de BD ni del canal.
- Health check con `BRAIN_HEALTH_URL` (patrón VOCERO) para el interruptor de IA (`sin_cerebro` si no hay agente en línea).
- Toda operación tiene límites de ejecución (timeout por fase, tope de turnos por conversación) y registro en `audit_log`.
- Con el agente caído: bandeja manual garantizada; el despacho reintenta con red de seguridad; nada se pierde.

## 7. Catálogo de errores tipados (unificado)

| Código | HTTP | Significado | Origen | Acción esperada del llamante |
|---|---|---|---|---|
| `ai_paused` | 409 | IA pausada (por ajuste o por fallo de credencial) | VOCERO | No reintentar; avisar |
| `window_closed` | 409 | Ventana de 24 h cerrada | VOCERO | Enviar plantilla aprobada o rendirse |
| `sandbox_violation` | 409 | Intento de envío real en conversación `is_test` | VOCERO | Corregir; es un guardrail |
| `message_limit` | 409 | El canal no admite más mensajes (p. ej. TikTok) | VOCERO | **No reintentar** |
| `sin_cerebro` | 409 | No hay agente conectado/en línea | VOCERO | Fallback a bandeja manual |
| `tenant_mismatch` | 403 | La organización del parámetro/cuerpo no coincide con la del contexto | Ecosistema (fail-closed) | Corregir contexto; se audita |
| `unauthorized_scope` | 403 | Scope insuficiente (`read/operate/send/configure`) | VOCERO | Solicitar scope |
| `rate_limited` | 429 | Límite alcanzado | Todos | Esperar `Retry-After` |
| `uncertain_dispatch` | 202/504 | Resultado del envío desconocido (timeout/5xx) | Ecosistema | **Prohibido reintentar ciegamente**; reconciliar por consulta |
| `rejected_dispatch` | 4xx mapped | El proveedor rechazó (400/401/403/404/410/413/422/429) | Ecosistema | Reintento limpio permitido tras corrección |
| `skipped_lock_unavailable` | — | Ítem de campaña saltado: lock de conversación no respondió (fail-closed) | ULTRA | Reintentar en próxima pasada |
| `suppressed` | — | Destinatario en lista de supresión o sin consentimiento | Ecosistema | No contactar |
| `approval_required` | 202 | Acción retenida por HITL | AGENTE-GENERAL | Resolver en la cola de aprobaciones |
| `firewall_denied` | 403 | Acción bloqueada por ActionFirewall/PolicyEngine | AGENTE-GENERAL | No reintentar; revisar política |
| `no_matching_rule` | 403 | Sin regla de firewall → DENY (default-deny) | AGENTE-GENERAL | Ídem |
| `not_offered` | 409 | Se intentó reservar un hueco que no se ofreció | VOCERO | Re-consultar disponibilidad |
| `credential_invalid` | 402 | Credencial rechazada por el proveedor (401/402) | VOCERO | Pausar y avisar en Ajustes |
| `validation_failed` | 422 | Input inválido | Todos | Corregir payload |

## 8. Contrato con el motor de flujos (WHATSPOWER, adaptador)

Herencia directa de los puentes ya probados del ecosistema (fail-closed sin secreto; eco de organización verificado):

| Operación | Dirección | Detalle |
|---|---|---|
| Reenvío de inbound firmado | CRM → Flujos | `POST {FLOWS}/api/inbound` con HMAC-SHA256 (`X-Timestamp` ±300 s, anti-replay durable, rate limit 120/min). El CRM **no espera** el resultado para mostrar el mensaje en bandeja |
| Notificación de cambio de etapa | CRM → Flujos | `POST {FLOWS}/api/crm/stage-change` (triggers de pipeline con dedup) |
| Acciones comerciales | Flujos → CRM | `POST {CRM}/api/crm/actions` (`create_client`, `create_opportunity`, `add_note`, `update_stage`, + `create_task`) con Bearer de servicio y verificación de eco de org |
| Transporte de envío | Flujos → CRM | `POST {CRM}/api/whatsapp/dispatch-proxy` (el CRM posee el token; nunca sale) o Meta Cloud por org con credenciales del CRM |
| Locks y supresión para campañas | Campañas → Flujos | `GET {FLOWS}/api/internal/locks/:phone`, `GET/POST/DELETE /api/internal/suppression/:phone` (fail-closed, eco de org obligatorio) |
| Resultados | Ambos | Clasificación `SENT / REJECTED / UNCERTAIN` obligatoria en cada efecto; journal de efectos consultable |

Garantías: la indisponibilidad del motor **no afecta** la bandeja ni el pipeline (el inbound se procesa localmente; los flujos se re-entregan con idempotencia); `goto_flow` solo dentro de la misma organización; sin envío real sin `ALLOW_REAL_DISPATCH=true`.

## 9. Contrato con el motor de campañas (WHATSPOWER-ULTRA, adaptador)

| Operación | Dirección | Detalle |
|---|---|---|
| Cola de campaña | CRM → Campañas | `POST {CAMPAIGNS}/api/campaigns` (audiencia ya verificada, plantilla, opciones de ritmo) |
| Ciclo de vida | CRM → Campañas | `POST /api/campaigns/:id/{pause,resume,cancel}` con ownership; máquina de estados con transiciones atómicas |
| Checks JIT | Campañas → CRM/Flujos | Antes de cada envío: supresión → consentimiento → lock de conversación → ownership → pacing por org (**fail-closed <50 ms**; timeout → `skipped_lock_unavailable`) |
| Transporte | Campañas → CRM | Dispatcher del CRM (el token nunca sale) o Meta Cloud por org con credenciales provistas |
| Webhooks de leads | Formularios → Campañas → CRM | `POST {CAMPAIGNS}/api/audiences/webhook-lead` HMAC v2 por org con anti-replay durable |
| Resultados | Campañas → CRM | Contadores por campaña (`sent/failed/skipped`), estados por ítem, audit log exportable |

Controles de cumplimiento obligatorios del módulo (heredados y generalizados): base legal/consentimiento por contacto, supresión por organización, plantillas aprobadas por el canal, límites de mensajería y calidad de cuenta, bajas inmediatas. **El control de ritmo es operación de calidad, no mecanismo de evasión** de las políticas de las plataformas.

## 10. Contrato de conectores de agenda (conservado)

Las 4 operaciones publicadas por VOCERO (`docs/agenda-conectores.md`) se mantienen como contrato público para añadir proveedores:

| Operación | Semántica |
|---|---|
| `createMeeting(booking)` | Crea la reunión del conector y devuelve el enlace |
| `rescheduleMeeting(booking, newSlot)` | Mueve la reunión |
| `cancelMeeting(booking)` | Cancela y borra |
| `health()` | Disponibilidad del conector |

Invariantes: solo se reserva un horario que se ofreció; nunca se confirma una cita que el sistema no creó; si el conector falla, la cita se agenda igual con enlace pendiente de reintento (`linkPending`); anti doble-booking por índice parcial único en BD.

## 11. Webhooks de canales (conservado y extendido)

- Ruta por canal y conexión: `/api/webhooks/{canal}/{webhookToken}` (WhatsApp, Instagram, Messenger, Telegram, TikTok).
- Autenticación en dos capas: token de URL (comparación timing-safe) + firma del proveedor (HMAC-SHA256).
- **Persistir antes del ACK** en `webhook_event` con huella sha256 única (idempotencia) + lease/attempts/notBefore para reintentos y retención.
- El evento crudo queda disponible para diagnóstico por tenant (pantalla Ajustes → Estado).

## 12. Evolución de contratos

1. Cambios compatibles (campos opcionales, nuevos códigos de error) → mismo `/v1`.
2. Cambios incompatibles → `/v2` + deprecación anunciada (header `Deprecation` + ventana mínima de un ciclo de release).
3. Todo cambio de contrato se publica en `packages/contracts` (OpenAPI + tipos) y va acompañado de su prueba de vigía que falla si el comportamiento conservado se rompe.
4. Los códigos de error tipados existentes **no se renombran** (compatibilidad con agentes ya conectados al contrato VOCERO).
