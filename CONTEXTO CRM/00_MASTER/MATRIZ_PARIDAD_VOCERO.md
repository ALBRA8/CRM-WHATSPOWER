# MATRIZ_PARIDAD_VOCERO.md

**Proyecto:** Construcción del nuevo CRM SaaS multi-tenant
**Fase:** 2 — Inventario funcional y matriz de paridad de VOCERO
**Fecha:** 2026-11-27
**Fuente:** `vocero-crm` v2.12.0 (commit auditado `aa90a81`), verificado por lectura directa de `src/`, `drizzle/`, `specs/`, `docs/` y `tests/`.

> **Estado tras la Fase 4 etapa 1 (2026-11-27):** VOCERO migrado íntegro a `apps/web`
> sin cambios de código. `next build` compiló 142 rutas API + 28 páginas y el
> esquema conserva sus 43 tablas — la verificación de esta migración está en
> `05_TESTS/TEST_INDEX.md`. Ningún estado de capacidad cambió en esta etapa: las
> 67 «Conservar» siguen intactas por migración directa y las «Adaptar/Reconstruir»
> conservan su fase asignada. Esta matriz se actualiza en cada sprint que toque
> una capacidad (regla del mandato §2).

## 1. Objetivo y método

Demostrar que **cada capacidad funcional de VOCERO sigue disponible** en la nueva plataforma, indicando dónde vive (módulo destino), con qué estrategia (conservar / adaptar / reconstruir) y en qué fase se entrega.

Definiciones de estrategia (alineadas con el mandato: «mantener su comportamiento y reconstruir internamente su implementación de forma controlada»):

| Estrategia | Significado |
|---|---|
| **Conservar** | El módulo se migra con cambios mínimos (extracción, renombrado); su implementación actual es válida en la nueva arquitectura |
| **Adaptar** | El **comportamiento y contrato se conservan**; la implementación interna se reorganiza (multi-tenancy RLS, nuevos dominios, nuevas colas/almacenes) |
| **Reconstruir** | La funcionalidad se re-deriva de su especificación (spec SDD de VOCERO cuando existe) con implementación nueva, por reorganización arquitectónica mayor |

Ninguna capacidad se elimina por considerarse secundaria. La cobertura es **100 % del inventario real de VOCERO** (28 pantallas, 142 rutas API, 43 tablas, 65 specs) más las capacidades del chaleco solicitadas que VOCERO no tenía (sección 7).

## 2. Resumen de cobertura

| Dominio funcional | Capacidades inventariadas | Conservar | Adaptar | Reconstruir | Nueva (no estaba en VOCERO) |
|---|---:|---:|---:|---:|---:|
| Autenticación, usuarios y equipo | 9 | 4 | 4 | 0 | 1 |
| Bandeja y gestión de conversaciones | 24 | 10 | 13 | 1 | 0 |
| Canales (WhatsApp/IG/Messenger/TikTok) | 14 | 6 | 8 | 0 | 2 |
| Contactos | 8 | 3 | 4 | 0 | 1 |
| Pipeline y etapas comerciales | 10 | 5 | 4 | 0 | 1 |
| Notas, etiquetas, adjuntos, historial | 9 | 5 | 2 | 0 | 2 |
| Asignación de asesores y handoff | 6 | 1 | 4 | 0 | 1 |
| Agente externo (perfil, contexto, despacho) | 13 | 6 | 6 | 1 | 0 |
| Laboratorio y simulación | 8 | 4 | 3 | 0 | 1 |
| Agenda y conectores | 10 | 4 | 5 | 0 | 2 |
| Resultados y analítica | 8 | 3 | 4 | 0 | 1 |
| Atribución y Meta CAPI | 8 | 4 | 4 | 0 | 0 |
| API pública, MCP y OAuth | 9 | 4 | 5 | 0 | 0 |
| Seguridad, cifrado y auditoría | 9 | 3 | 4 | 1 | 1 |
| Instalación y despliegue | 10 | 2 | 5 | 1 | 2 |
| Experiencia de producto (temas, PWA, marca) | 9 | 3 | 4 | 1 | 1 |
| **Total** | **156** | **67** | **69** | **5** | **15** |

## 3. Matriz por dominio

Evidencia = ruta real en `vocero-crm`. Fase = fase del `ROADMAP_CONSTRUCCION.md` donde la paridad queda demostrada.

### 3.1 Autenticación, usuarios y equipo

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| A1 | Login/registro con better-auth | `src/app/(auth)/login|register`, `src/lib/auth/` | Conservar | Identity | F5 |
| A2 | Registro público cerrado tras la primera organización (`ALLOW_SIGNUP`) | `src/server/auth/registration.ts` | Adaptar → registro por organización/invitación (SaaS) | Identity | F5, F11 |
| A3 | Equipo con roles owner/admin/member (`canConfigure`) | `src/lib/auth/roles.ts`, tabla `member` | Conservar | Identity | F5 |
| A4 | Invitaciones de equipo | `settings/team`, `member`, `invitation` | Conservar | Identity | F5 |
| A5 | Sesión de 7 días | `specs/073-sesion-siete-dias` | Conservar | Identity | F5 |
| A6 | Llaves API `vk_` con scopes `read/operate/send/configure` | `src/server/api-v1/llaves.ts` | Conservar | Integrations/API | F10 |
| A7 | OAuth PKCE propio con tokens opacos y rotación | `src/server/oauth/`, `.well-known/*` (RFC 8414/9728) | Conservar | Integrations/API | F10 |
| A8 | Límite de intentos de login (10/10 min por IP) | `src/lib/rate-limit.ts` | Adaptar → límites por tenant + por IP | Security | F5 |
| A9 | 2FA / RBAC granular / revocación por tokenVersion | **No estaba en VOCERO** (probado en CRM-ALBRA como especificación) | Nueva | Identity | F5 |

### 3.2 Bandeja de entrada y gestión de conversaciones

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| B1 | Bandeja de 3 columnas en tiempo real (SSE ≤2 s) | `src/app/(app)/inbox`, `src/server/events/bus.ts` | Adaptar → SSE por tenant con bus compartido | Conversations | F6 |
| B2 | Ingesta idempotente de mensajes (`waMessageId` UNIQUE) | `src/server/inbox/ingest.ts` | Conservar | Conversations | F6 |
| B3 | Estados de entrega monotónicos (pending→sent→delivered→read→failed) | `src/server/inbox/status.ts` | Conservar | Conversations | F6 |
| B4 | Ventana de 24 h visible y bloqueada; plantilla aprobada al cerrarse | `src/server/inbox/window.ts`, spec 024 | Conservar | Conversations | F6 |
| B5 | Ventana por canal (24 h WA/IG/Messenger, 48 h TikTok) | `src/server/channels/capabilities.ts` | Conservar | Channels | F6 |
| B6 | Envío unificado con guard de sandbox y límites | `src/server/inbox/send.ts` | Conservar | Conversations/Channels | F6 |
| B7 | Adjuntos bidireccionales (imagen, audio, video, documento, ubicación, contacto) | `media_asset`, `voice-recorder.tsx`, `webm-ogg.ts` | Conservar | Conversations/Files | F6 |
| B8 | Notas de voz (grabación y reproducción) | `voice-recorder.tsx`, spec 044 | Conservar | Conversations | F6 |
| B9 | Responder citando | `quotes.ts`, spec 039 | Conservar | Conversations | F6 |
| B10 | Reacciones a mensajes | `reacciones.ts`, spec 029 | Conservar | Conversations | F6 |
| B11 | Reenviar texto/imagen entre conversaciones | `forward-message.ts`, spec 043 | Conservar | Conversations | F6 |
| B12 | Fijar chats (máx. 3 por usuario) | `pins.ts`, spec 028 | Conservar | Conversations | F6 |
| B13 | Borradores por conversación | `src/lib/borradores.ts`, spec 051 | Conservar | Conversations | F6 |
| B14 | Búsqueda en mensajes | `search-messages`, `busqueda-mensajes.ts`, spec 079 | Conservar | Conversations | F6 |
| B15 | Respuestas rápidas `/atajo` con variables | `quick_reply`, spec 049 | Conservar | Conversations | F6 |
| B16 | Plantillas multi-variable con estado de Meta | `templates.ts`, tabla `template` | Adaptar → módulo Plantillas compartido con Campaigns | Channels | F6 |
| B17 | Eventos de hilo (handoff, plantilla, etc. visibles en el hilo) | `eventos-hilo.ts`, spec 054 | Conservar | Conversations | F6 |
| B18 | Filtros de bandeja (sin leer, sin responder, ventanas por cerrar, canal) | `filtros-bandeja.ts`, spec 052 | Conservar | Conversations | F6 |
| B19 | Cintillo «Esperando a una persona» / reactivación de IA | `esperando.ts`, `reactivacion.ts`, specs 077/076 | Conservar | Conversations | F6 |
| B20 | Eliminar conversación (borra mensajes, adjuntos y aprendizaje) | spec 026 | Adaptar → derecho al olvido por tenant | Conversations | F6 |
| B21 | Identidad de contacto estable (`wa_identity`, `bsuid:`) | `src/server/inbox/identity.ts` | Conservar | Conversations/CRM | F6 |
| B22 | Cuenta de mensajes (tope por canal, p. ej. TikTok 10) | migración 0026, `message_limit` | Conservar | Channels | F6 |
| B23 | «Una respuesta por ráfaga» (coalescing del despacho) | `dispatch/ventana.ts`, specs 075/078 | Conservar | Agents/Dispatch | F7 |
| B24 | Lista compartida de contactos | `lista-compartida.ts`, spec 064 | Conservar | CRM | F6 |

### 3.3 Canales

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| C1 | WhatsApp Business Cloud API exclusivamente (cliente único Graph) | `src/lib/meta/client.ts` | Conservar | Channels | F6 |
| C2 | Webhook WhatsApp autenticado en dos capas + persistir antes del ACK | `webhooks/wa/[webhookToken]`, `src/server/webhooks/` | Conservar | Channels | F6 |
| C3 | Credenciales por canal cifradas (AES-256-GCM) | `meta_credentials`, `instagram_credentials`, etc. | Adaptar → vault por tenant con RLS | Channels | F6 |
| C4 | Instagram (ingesta y envío, fuente `zernio` o `meta`) | `src/server/instagram/`, migración 0008 | Conservar | Channels | F6 |
| C5 | Facebook Messenger (ingesta y envío) | `src/server/messenger/`, migración 0011 | Conservar | Channels | F6 |
| C6 | TikTok (vía transporte unificado Zernio; sin iniciar conversación; 48 h; tope 10 mensajes/48 h) | `src/server/tiktok/`, `zernio/`, spec 022 | Conservar (sujeto a APIs oficiales vigentes) | Channels | F6 |
| C7 | Transporte unificado (Zernio) con firma HMAC y reparación de conexiones | `src/server/zernio/`, pantalla Estado | Adaptar → adaptador de canal con contrato propio | Channels | F6 |
| C8 | Bandera de canales opcionales (`CHANNELS=…`) ADR-001 | `src/server/channels/enabled.ts`, `docs/adr-001*` | Conservar | Channels | F6 |
| C9 | Embedded Signup v4 de WhatsApp (canje de código, PIN, registro de webhook) | `src/server/whatsapp/embedded.ts`, `docs/embedded-signup.md` | Conservar | Channels | F6 |
| C10 | Respeto a override de callback de WABA + «Recuperar el webhook» | `src/server/whatsapp/webhook-url.ts` | Conservar | Channels | F6 |
| C11 | Texto social adaptado por canal (formato WhatsApp → IG/Messenger/TikTok) | `src/lib/social-text.ts` | Conservar | Channels | F6 |
| C12 | Pantalla Ajustes → Estado (diagnóstico y reparación de canales) | `channels/status.ts` | Adaptar → diagnóstico extendido al instalador | Channels | F6, F8 |
| C13 | **Telegram** | **No estaba en VOCERO** | Nueva (omnicanalidad objetivo) | Channels | F6 |
| C14 | Webhooks de canales con reintentos y registro de errores | `webhook_event` (lease/attempts/notBefore), spec 047 | Conservar | Channels | F6 |

### 3.4 Contactos

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| D1 | Alta automática y manual de contactos con nombre y fuente del nombre | migración 0013, `nameSource` | Conservar | CRM | F6 |
| D2 | Importación CSV con vista previa y anti-duplicados | `contacts-import.ts`, spec 027 | Adaptar → importador con validación E.164 multi-país | CRM | F6 |
| D3 | Marca «sin agente» (`aiPaused`) por contacto | migración 0019 | Conservar | CRM | F6 |
| D4 | Ficha del lead con claves libres (`ficha` jsonb) | `bot/ficha.ts`, `ficha-panel.tsx` | Conservar | CRM | F6 |
| D5 | Origen del contacto (anuncio/orgánico/referido) | `contact-source.ts` | Conservar | CRM/Attribution | F6, F10 |
| D6 | Panel de contacto con anuncio de origen (creativo, texto, enlace) | `anuncio-origen.tsx`, spec 018 | Conservar | CRM/Attribution | F10 |
| D7 | Iniciar conversación desde el contacto | `start-conversation.ts` | Conservar | Conversations | F6 |
| D8 | **Etiquetas de contacto** | **No estaba en VOCERO** (existe en WHATSPOWER `contact_tags`) | Nueva | CRM | F6 |
| D9 | Empresas / cuentas | **No estaba en VOCERO ni en el ecosistema verificado** | Nueva | CRM | F4 (modelo), F6 (UI) |

### 3.5 Pipeline y etapas comerciales

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| E1 | Pipeline kanban con drag & drop (`@dnd-kit`) | `pipeline-client.tsx` | Conservar | CRM | F6 |
| E2 | Etapas editables con anclas won/lost | `pipeline_stage` (kind open/won/lost) | Conservar | CRM | F6 |
| E3 | Bitácora append-only de etapas (`lead_stage_event`, única puerta de escritura vigilada por test) | `src/server/leads/stage-history.ts` | Conservar | CRM/Audit | F6 |
| E4 | Monto en centavos + moneda, prioridad, motivo de pérdida con CHECK en BD | `lead` | Conservar | CRM | F6 |
| E5 | 1 lead por contacto (invariante) | índice parcial `lead` | Conservar | CRM | F6 |
| E6 | Avance de etapa por el agente (solo hacia adelante y a etapas abiertas) | `bot/stage.ts`, spec 038 | Conservar | Agents | F7 |
| E7 | Cajón de lead con actividad | `lead-drawer.tsx` | Conservar | CRM | F6 |
| E8 | Archivar leads | README/specs | Conservar | CRM | F6 |
| E9 | **Cotizaciones con PDF** | **No estaba en VOCERO** (probado en CRM-ALBRA) | Nueva | CRM | F6 |
| E10 | **Productos y servicios** | **No estaba en VOCERO** | Nueva | CRM | F6 |

### 3.6 Notas, etiquetas, adjuntos, historial

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| F1 | Notas internas por conversación (tabla propia, propósito explícito) | `conversation_note`, spec 050 | Conservar | Conversations | F6 |
| F2 | Notas del trato/lead vía ficha | `ficha` jsonb | Conservar | CRM | F6 |
| F3 | Historial de conversaciones por contacto | `conversation`, único parcial 1 conversación real por contacto | Conservar | Conversations | F6 |
| F4 | Adjuntos en disco o bucket (S3/R2/MinIO con firma SigV4 propia) | `src/lib/storage/objetos.ts`, `media_asset` | Adaptar → rutas por tenant + ciclo de vida | Files | F6 |
| F5 | Descarga de medios con headers propios (sin re-multiplicar llamadas a Meta) | `media-headers.ts` | Conservar | Conversations | F6 |
| F6 | Etiquetas de conversación/pipeline | **No estaba en VOCERO** | Nueva (fuente WHATSPOWER) | CRM | F6 |
| F7 | Adjuntos de entrantes descargables por API sin tocar Meta | `GET /api/bot/media/{id}` | Conservar | Agents/Conversations | F7 |
| F8 | Mensajes editados con texto original conservado | migración 074 (`editedAt`, `originalText`) | Conservar | Conversations | F6 |
| F9 | Borrado de mensajes/adjuntos al eliminar conversación | spec 026 | Adaptar → derecho al olvido | Conversations | F6 |

### 3.7 Asignación de asesores y transferencia a humanos

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| G1 | Handoff a humano con un click (7 causas tipadas) | `handoffAt` + `handoffReason`, `bot/handoff.ts` | Conservar | Conversations | F6 |
| G2 | Marca de respuesta IA vs operador/manual/plantilla | `message.origin` | Conservar | Conversations | F6 |
| G3 | «Te toca» (bandeja prioriza lo humano) + cintillo esperando | `esperando.ts`, `leads/priority.ts` | Conservar | Conversations | F6 |
| G4 | Reglas de escalado del agente (instrucciones + `escalar` no apagable) | `agent_profile`, `agent-roles.ts`, spec 034 | Conservar | Agents | F7 |
| G5 | Transferencia por el agente (`POST /api/bot/handoff`) | contrato bot API | Conservar | Agents | F7 |
| G6 | **Asignación explícita de asesores a conversaciones** (colas, reasignación) | **No estaba en VOCERO** (existe en WHATSPOWER `agent_assignments`) | Nueva | Conversations/Identity | F6 |

### 3.8 Agente externo (perfil, instrucciones, conocimiento, despacho)

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| H1 | Perfil del agente (nombre, tono, instrucciones, escalado, saludo) | `agent_profile`, pantalla Agente | Adaptar → agentes lógicos por organización | Agents | F7 |
| H2 | Base de conocimiento en pares Q/A y bloques libres | `kb_entry`, `kb/` | Adaptar → Knowledge multi-tenant compartible por agentes | Knowledge | F7 |
| H3 | Roles y herramientas del agente como datos (ficha/agendar/reprogramar/salida/escalar) | spec 034, `agent-roles.ts` | Conservar (base de especializaciones) | Agents | F7 |
| H4 | Interruptor de IA con chequeo de salud del cerebro (`sin_cerebro` 409) | `bot/status.ts` | Conservar | Agents | F7 |
| H5 | Despacho estándar: el CRM entrega cada turno al agente (outbox, firma, coalescing, 3 reintentos, red de seguridad) | `specs/021-despacho-estandar`, `dispatch/` | Conservar (es el esqueleto del adaptador) | Agents/Integrations | F7 |
| H6 | Contrato bot API completo (13 rutas `/api/bot/*`, OpenAPI 3.1 publicado) | `docs/openapi.json` | Conservar con compat de códigos 409 | Integrations | F7 |
| H7 | Proxy LLM (`POST /api/bot/llm/{ruta}`) — la llave de IA nunca sale del CRM | `bot/llm-proxy.ts`, migración 0015 | Adaptar → el cerebro (AGENTE-GENERAL) gestiona proveedores; el CRM no expone LLM genérico salvo para el juez | Agents | F7 |
| H8 | Ficha del lead guardada por el bot (`PUT /api/bot/ficha`) | `bot/ficha.ts` | Conservar | Agents/CRM | F7 |
| H9 | Avance de etapa por el bot con reglas (`POST /api/bot/stage`) | `bot/stage.ts` | Conservar | Agents/CRM | F7 |
| H10 | Contexto autorizado (`GET /api/bot/context`: persona, etapa, humano, ventana, citas) | `bot/` | Conservar (base del «contexto autorizado» del adaptador) | Agents/Integrations | F7 |
| H11 | Typing + marcar leído (`POST /api/bot/typing`) | contrato bot | Conservar | Agents | F7 |
| H12 | Reset de conversación de pruebas (`POST /api/bot/reset`) | contrato bot | Conservar | Agents | F7 |
| H13 | Tarjeta «Quién responde a tus clientes» (última llamada, health, modo) | `brain-status-card.tsx`, `brains/config.ts` | Adaptar → panel de salud del adaptador con AGENTE-GENERAL | Agents | F7 |

### 3.9 Laboratorio de evaluación y simulación

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| I1 | Clientes simulados guionados sin LLM (comprador decidido, precios, enojado, fuera de KB, exige humano, confuso, hostil, sin rumbo) | `src/server/lab/personas.ts` | Conservar (extensible con personas de plantilla sectorial) | Agents/Lab | F8 |
| I2 | Ejecución por contrato: el agente REAL recibe los turnos en conversaciones `is_test` | `lab/runner.ts` (571 líneas), spec 033 | Conservar | Lab | F8 |
| I3 | Sandbox total: `sendText` lanza `sandbox_violation` con `is_test`; sin tocar Meta/Zernio/agenda | `lab/sandbox.ts` | Conservar | Lab/Security | F8 |
| I4 | Juez LLM independiente con veredicto (verde/amarillo/rojo) y hallazgos tipados (alucinación, fuera de KB, debió escalar, tono) | `lab/judge.ts` | Conservar | Lab | F8 |
| I5 | Score 0-100, historial con delta, sugerencias aplicables con un click | `agent_test_run`, `/api/lab/suggestions/apply` | Conservar | Lab | F8 |
| I6 | Olvido del caso (`conversation.deleted` al cerrar) | spec 033-D6 | Conservar | Lab/Privacy | F8 |
| I7 | Lock de 1 corrida activa por organización | índice parcial `agent_test_run` | Conservar | Lab | F8 |
| I8 | Simulación puntual por API (`POST /api/v1/agent/simulate`, 10/min) | `lab/simular.ts` | Conservar | Lab | F8 |
| I9 | Personas de plantilla sectorial en el Laboratorio | **No estaba** | Nueva (composición con F8) | Lab | F8 |

### 3.10 Agenda y conectores

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| J1 | Motor de agenda con bandera `AGENDA=on` | `src/server/agenda/`, ADR-002 | Adaptar → módulo Scheduling siempre disponible | Scheduling | F10 |
| J2 | Horario semanal + zona horaria del negocio | `calendar_settings` | Conservar | Scheduling | F10 |
| J3 | Solo se reserva lo ofrecido (`offered_slot` — «memoria de lo ofrecido») | `agenda/offers.ts` | Conservar (garantía no negociable) | Scheduling | F10 |
| J4 | Nunca se confirma una cita que no se creó (alternativas frescas si el hueco se ocupó) | `bot/bookings`, spec 015 | Conservar | Scheduling | F10 |
| J5 | Anti doble-booking en BD (índice parcial único por slot activo) | `booking` | Conservar | Scheduling | F10 |
| J6 | Conector enlace fijo (default) | `connectors/enlace-fijo.ts` | Conservar | Scheduling | F10 |
| J7 | Conector Zoom (una reunión por cita; mover/borrar) | `connectors/zoom.ts`, `zoom_credentials` | Conservar | Scheduling | F10 |
| J8 | Conector Google Calendar + Meet | `connectors/google.ts`, `google_credentials` | Conservar | Scheduling | F10 |
| J9 | Contrato público de 4 operaciones para nuevos conectores | `docs/agenda-conectores.md` | Conservar | Scheduling | F10 |
| J10 | Calendario Día/Semana/Mes/Lista con bloqueos manuales, reprogramar, no-show, cancelar | `bookings-client.tsx`, `time-grid.tsx` | Conservar | Scheduling | F10 |
| J11 | Cita cae igual con enlace pendiente si el proveedor se cae (`linkPending`) | spec agenda | Conservar | Scheduling | F10 |
| J12 | **Microsoft Outlook** | **No estaba en VOCERO** | Nueva | Scheduling | F10 |
| J13 | **Enlaces personalizados de reserva (booking links)** | **No estaba en VOCERO** | Nueva | Scheduling | F10 |

### 3.11 Resultados y analítica

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| K1 | Pantalla Resultados: prospectos, ganados/perdidos, dinero, embudo vs periodo anterior | `analytics/sales.ts` (539 líneas), spec 019 | Conservar | Analytics | F6/F11 |
| K2 | Métricas del agente (tiempos de respuesta, traspasos) | `analytics/bot.ts` | Conservar | Analytics | F6 |
| K3 | Análisis de anuncios (origen + creativos de las conversaciones que venden) | `analytics/ads.ts` | Conservar | Attribution | F10 |
| K4 | Higiene (leads en silencio, envíos fallidos, ventanas por cerrar) | `analytics/hygiene.ts` | Conservar | Analytics | F6 |
| K5 | Citas sumadas a Resultados (realizadas/no llegaron/canceladas) con zona horaria de la agenda | `analytics/shared.ts` | Conservar | Analytics | F10 |
| K6 | Exclusión del Laboratorio de todas las métricas | `analytics/shared.ts` | Conservar | Analytics | F6 |
| K7 | Evaluación de silencios del agente (`eval:silencios`) | `scripts/eval-silencios.ts` | Conservar | Lab/Analytics | F8 |
| K8 | **Reportes PDF/Excel/CSV descargables** | **No estaba en VOCERO** (probado en CRM-ALBRA) | Nueva | Analytics | F11 |

### 3.12 Atribución publicitaria y Meta CAPI

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| L1 | Captura CTWA (Click-to-WhatsApp) en el webhook sin banderas ni credenciales extra | migración 0014, `ad_attribution` | Conservar | Attribution | F10 |
| L2 | Distintivo «Anuncio · titular» + filtro de anuncios en bandeja y ficha | spec 018 | Conservar | Attribution | F10 |
| L3 | Meta Conversions API con dataset y token reutilizado (cifrado) | `attribution/conversions.ts`, `capi_settings` | Conservar | Attribution | F10 |
| L4 | Eventos lead calificado y venta con importe, disparados desde el movimiento de etapa (valga quién la mueva) | `attribution/`, spec 016 | Conservar | Attribution | F10 |
| L5 | Deduplicación de eventos (`org+conv+evento`, `fbTraceId`, estados con `skipped`) | `conversion_event` | Conservar | Attribution | F10 |
| L6 | Tabla de actividad CAPI (qué se envió, acuse, por qué falló) | `settings/capi/events` | Conservar | Attribution | F10 |
| L7 | Si Meta cae, el lead se mueve igual (una conversación jamás vale un movimiento bloqueado) | spec 016 | Conservar | Attribution | F10 |
| L8 | **UTM generalizado / identificación de campañas y anuncios no-CTWA (formularios Meta Ads)** | Parcial en VOCERO (solo CTWA); el resto es nueva | Nueva/Adaptar | Attribution | F10 |

### 3.13 API pública, MCP y OAuth

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| M1 | API v1 con bandera `API_V1=on`: 25 rutas (me, contacts, conversations, knowledge, pipeline, bookings, calendar, quick-replies, agent…) | `src/app/api/v1/`, `docs/api-v1.md` | Conservar (contratos) con multi-tenant nativo | Integrations | F10 |
| M2 | Handler compartido UI/API (mismos permisos y límites) | `src/server/http/` | Conservar | Integrations | F10 |
| M3 | Límites: 120 req/min por llave, 20 envíos/min, 30 fallos/min por IP, 429 + Retry-After | `api-v1/acceso.ts` | Adaptar → límites por plan y por tenant | Integrations | F10 |
| M4 | Servidor MCP Streamable HTTP (JSON-RPC, herramientas de configuración y operativas) | `src/server/mcp/`, `POST /api/v1/mcp` | Conservar | Integrations | F10 |
| M5 | MCP sin permiso de envío («agent first») | `docs/api-v1.md` | Conservar | Integrations | F10 |
| M6 | OAuth PKCE S256 (register/authorize/token/revoke), clientes públicos, códigos de un solo uso, refresh rotado | `src/server/oauth/` | Conservar | Integrations | F10 |
| M7 | Documentos RFC 8414 / 9728 en `.well-known` | `src/app/.well-known/` | Conservar | Integrations | F10 |
| M8 | OpenAPI 3.1 publicado por la instancia | `docs/openapi.json`, `api-v1/openapi.json` | Conservar | Integrations | F10 |
| M9 | **Operaciones sensibles con aprobación humana vía MCP/API** | Parcial (HITL vive en AGENTE-GENERAL) | Nueva (cableado del ApprovalEngine del agente) | Integrations/Agents | F7, F10 |

### 3.14 Seguridad, cifrado y auditoría

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| N1 | Cifrado AES-256-GCM de todos los secretos (IV 12 bytes + tag) | `src/lib/crypto/index.ts` | Conservar | Security | F5 |
| N2 | Webhook en dos capas (token URL timing-safe + HMAC) con huella sha256 única | `inbox/webhook.ts`, `webhook_event` | Conservar | Security/Channels | F6 |
| N3 | Rate limits in-process por ventana deslizante | `src/lib/rate-limit.ts` | Adaptar → límites compatibles con multi-replica (almacén compartido) | Security | F5 |
| N4 | Llaves API solo hash sha256 + prefijo + last4; contadores de uso | `api_key` | Conservar | Security | F5 |
| N5 | Secretos jamás al cliente ni logs; redacción | `ai_credentials.tokenLast4`, doctor | Conservar | Security | F5 |
| N6 | Mocks de desarrollo 404 en producción (`dev-guard`) | `src/server/dev/` | Conservar | Security | F4 |
| N7 | **Tabla de auditoría general** (quién hizo qué, cuándo, por tenant) | **No existía** (solo bitácoras parciales) | Reconstruir → `audit_log` append-only tamper-evident (patrón de AGENTE-GENERAL) | Audit | F5 |
| N8 | Roles como datos + permisos de equipo | spec 034 | Conservar | Identity | F5 |
| N9 | Cuentas de mensajes / anti-spam por canal | migración 0026 | Conservar | Channels | F6 |
| N10 | Pruebas de fuga entre tenants automatizadas | **No existía como suite** (precedente en CRM-ALBRA) | Nueva | Security | F5 |

### 3.15 Instalación y despliegue

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| O1 | Docker multi-stage standalone + migraciones al boot + healthcheck | `Dockerfile`, `vocero-entrypoint.sh` | Conservar | Deploy | F12 |
| O2 | docker-compose con Postgres 16, Caddy (SSE), MinIO opcional | `docker-compose.yml`, `Caddyfile` | Adaptar → compose de la plataforma (app + postgres + agente + flows + campaigns) | Deploy | F12 |
| O3 | `pnpm init-env` (crea `.env` con secretos generados, nunca pisa) | `src/server/doctor/init-env.ts` | Conservar | Deploy/Installer | F8 |
| O4 | `pnpm doctor` (valida env con zod, BD, escritura de media, tokens contra Meta, IA, cerebro) | `src/server/doctor/checks.ts` (629 líneas) | Adaptar → doctor de la plataforma (más conectores y módulos) | Deploy/Installer | F8 |
| O5 | Manifests Fly/Railway/Render fijados por versión | `fly.toml`, `railway.toml`, `render.yaml` | Adaptar → render.yaml/blueprint propio; revisar railway.toml obsoleto | Deploy | F12 |
| O6 | Instalación Coolify guiada por IA (`INSTALL-IA.md`) | raíz del repo | Adaptar → guía Coolify propia | Installer | F8 |
| O7 | Seed demo (Ferretería El Martillo) desde la UI | `scripts/seed/demo.ts` | Conservar | Installer/Onboarding | F8 |
| O8 | Actualización por etiqueta de imagen + migraciones al arrancar | README | Conservar | Deploy | F12 |
| O9 | **Instalador guiado de 7 pasos** (identificación del negocio → diagnóstico) estilo CRM-WHATSAPP | **No estaba en VOCERO así** | Nueva (F8, fuente CRM-WHATSAPP) | Installer | F8 |
| O10 | **Soporte de instalación VPS / Docker / local con validación de dominio y systemd** | Parcial (VPS por compose; systemd no) | Nueva (fuente CRM-WHATSAPP `--servidor`) | Installer | F8 |

### 3.16 Experiencia de producto (temas, PWA, marca blanca, onboarding)

| # | Capacidad VOCERO | Evidencia | Estrategia | Módulo destino | Fase |
|---|---|---|---|---|---|
| P1 | Marca blanca por organización (nombre, color, logo, favicon, icono PWA) en BD | `src/server/branding.ts`, spec 002 | Conservar | Product/Billing | F6 |
| P2 | PWA instalable sin caché de datos + «Sin conexión» explícito | `pwa.ts`, `sw.js`, spec 048 | Conservar | Product | F6 |
| P3 | 8 temas + tema propio, fuente, tamaño, densidad (AA en oscuro) | `src/lib/temas.ts` (582 líneas), spec 062 | Conservar | Product | F6 |
| P4 | Tipografías self-hosted con licencias OFL en el repo | `src/app/fonts/licencias/` | Conservar | Product | F4 |
| P5 | Onboarding con estado y guía | `src/server/onboarding/` | Adaptar → onboarding SaaS (plan, canal, agente) | Product | F8 |
| P6 | Atajos de teclado globales | `atajos-globales.tsx`, spec 055 | Conservar | Product | F6 |
| P7 | Avisos y ajustes proactivos (IA pausada, sin conexión, plantillas) | spec 045, `aviso-ia.tsx` | Conservar | Product | F6 |
| P8 | Apariencia por usuario (claro/oscuro por navegador) | README | Conservar | Product | F6 |
| P9 | **Multi-idioma de interfaz (i18n)** | **No estaba** (UI íntegra en español) | Nueva (opcional, post F12) | Product | Post-F12 |

## 4. Reglas de paridad acordadas

1. **Ninguna capacidad se elimina.** Las marcadas «Adaptar» conservan contrato y comportamiento; solo cambia su implementación interna de forma controlada (spec nueva + pruebas de vigilancia que compare el comportamiento antiguo vs nuevo cuando aplique).
2. **Códigos de error tipados se conservan** (`ai_paused`, `window_closed`, `sandbox_violation`, `message_limit`, `sin_cerebro`) para no romper la compatibilidad con el contrato bot ya publicado; los nuevos módulos añaden códigos propios (`CONTRATOS_INTEGRACION.md`).
3. **Invariantes de BD no negociables** heredados: `waMessageId` UNIQUE (idempotencia), único parcial 1 conversación real por contacto, índice parcial anti doble-booking de citas, 1 corrida activa de Laboratorio por org, huella sha256 única de webhook.
4. La paridad se **demostrará con pruebas**, no con palabras: cada fila «Adaptar/Reconstruir» se entrega con su test de vigilancia y, cuando exista, el guión E2E de VOCERO correspondiente (`tests/e2e/*.md`, 59 guiones).

## 5. Capacidades del chaleco NO presentes en VOCERO

Las incorpora la nueva plataforma desde otros orígenes o como diseño nuevo (fuentes: requisitos del mandato, WHATSPOWER, CRM-ALBRA como especificación):

| Capacidad | Origen | Fase |
|---|---|---|
| Etiquetas de contacto/conversación | WHATSPOWER (`contact_tags`) | F6 |
| Asignación explícita de asesores | WHATSPOWER (`agent_assignments`) | F6 |
| Cotizaciones con PDF, productos y servicios | CRM-ALBRA (especificación funcional) | F6 |
| Empresas/cuentas | Diseño nuevo | F4/F6 |
| Tareas y seguimientos programáticos | Diseño nuevo (+ WorkflowEngine del agente) | F6/F7 |
| Finanzas (ingresos/gastos por organización) | CRM-ALBRA (especificación) | F11 |
| Documentos por cliente | Diseño nuevo (Files por tenant) | F6 |
| Automatizaciones no conversacionales | WHATSPOWER (secuencias/triggers) + diseño nuevo | F9 |
| Telegram | Diseño nuevo (adaptador oficial) | F6 |
| Billing/planes/suscripciones | Diseño nuevo | F11 |
| Auditoría general tamper-evident | Patrón de AGENTE-GENERAL | F5 |
| Preferencias de clientes estructuradas | Extensión de `ficha` jsonb | F6 |

## 6. Conclusión

El inventario completo de VOCERO (156 capacidades inventariadas en 16 dominios) queda mapeado al 100 %: 67 se conservan, 69 se adaptan conservando comportamiento y contrato, 5 se reconstruyen de forma controlada (auditoría general, rate-limits multi-replica, multi-tenancy operativa, instalador guiado, identidad visual) y 15 capacidades nuevas del chaleco se suman sin eliminar nada. La paridad se verificará fase por fase en el roadmap con los guiones E2E de VOCERO como base de pruebas de regresión.

## Nota de verificación S4.2 (2026-11-27)

Tras el rebrand VOCERO→Vestro y la reorganización de `src/server/*` en los 14
dominios (sesión `08_SESSIONS/SESSION_2026-11-27_S4.2_DOMINIOS.md`), la matriz
**no registra ninguna baja ni cambio de estado de capacidad**: 156/156
capacidades conservadas con su estado anterior (67 conservadas, 69 adaptación
pendiente, 5 refactor, 15 nuevas planificadas). Evidencia objetiva de paridad:
- Suite completa 1.801/1.801 verde (1.714 heredadas sin modificación de
  aserciones salvo: cadenas de marca, rutas de guardarraíles hacia los
  directorios nuevos, y 2 canarios regenerados con verificación independiente).
- 142 rutas API idénticas (`git diff` de rutas entre el commit base `c370cc4`
  y el HEAD: vacío).
- Catálogo de errores y contratos bot v1 congelados por vigía: verdes.
