# GLOSSARY — Vestro / CRM WHATSPOWER

| Término | Definición en este proyecto |
|---|---|
| **Vestro** | Nombre de trabajo del producto CRM SaaS (D-012, provisional hasta confirmación del propietario). |
| **Tenant / Organización** | El inquilino de la plataforma. Toda entidad de negocio pertenece a una `organization`; no existen datos globales de negocio sin dueño. |
| **RLS** | Row-Level Security de PostgreSQL: política a nivel de fila que filtra por `organization_id = current_setting('app.current_org', true)`. Fail-closed: sin contexto fijado devuelve cero filas. |
| **Doble valla** | Aislamiento en dos capas: RLS en la BD + `scoped()` en la aplicación. Si una capa falla, la otra bloquea. |
| **Fail-closed** | Si no puede determinarse el contexto/credencial/salvaguarda, la operación NO se ejecuta (patrón heredado del ecosistema). |
| **VOCERO** | CRM open source v2.12.0 (MIT, Kevin Belier): base funcional completa conservada en `apps/web`. 28 páginas, 142 rutas API, 43 tablas, 65 specs. |
| **AGENTE-GENERAL** | Sistema Python/FastAPI independiente: único cerebro de razonamiento, memoria, herramientas, MCP, workflows, firewall, HITL y observabilidad. No se duplica dentro de Vestro. |
| **Agente lógico** | Especialización (ventas, atención, prospección…) = configuración por organización del perfil del agente; NO un motor cognitivo separado. Identidad: `org:<organizationId>#<agenteLogico>`. |
| **Despacho estándar** | Evento `conversation.turn.received` que el CRM envía al agente tras coalescing de la ráfaga del cliente, firmado, con 3 reintentos y red de seguridad hacia humanos. |
| **Coalescing** | Espera del fin de ráfaga (`AGENT_COALESCE_MS`) antes de despachar al agente. |
| **Ventana 24 h** | Plazo de WhatsApp para mensajes libres de plantilla; cerrada → error `window_closed` (enviar plantilla aprobada o rendirse). |
| **Laboratorio / sandbox** | Modo de prueba (`conversation.test: true`): el agente responde pero el CRM jamás envía al canal real (`sandbox_violation` si se intenta). |
| **HITL** | Human-in-the-loop: cola de aprobaciones del agente visible en el CRM; la decisión la envía el usuario, nunca auto-aprobada. |
| **MCP** | Model Context Protocol: herramientas del agente. El MCP del CRM resuelve tenant como la API v1, sin excepción. |
| **A2A** | Agent-to-agent protocol (JSON-RPC + agent-card) para agentes secundarios compatibles. |
| **Outbox** | Patrón de eventos salientes persistentes (despachos, jobs) con org en la fila, reintentos y trazabilidad. |
| **audit_log tamper-evident** | Bitácora por organización append-only con hash encadenado; triggers rechazan UPDATE/DELETE. |
| **Bot API v1** | Las 13 rutas `/api/bot/*` de VOCERO conservadas con sus códigos de error; el agente consume con `X-API-Key`, sin credenciales de BD ni del canal. |
| **Idempotencia** | `Idempotency-Key` en escrituras + claves naturales (`waMessageId` único, `sha256(campaignId_phone)`, `(org,eventId)` en flujos). Re-ejecutar no duplica efectos. |
| **Presets** | Perfiles sectoriales (clínica, inmobiliaria, reformas, genérico) heredados de CRM-WHATSAPP en `packages/presets`. |
| **Clean-room** | Reconstrucción de capacidades a partir de especificaciones funcionales, sin copiar código sin licencia (CRM-ALBRA, WHATSPOWER-ULTRA). |
| **T1-T15** | Batería de pruebas de fuga multi-tenant (MODELO_MULTI_TENANT §9); obligatoria en CI sobre PostgreSQL real en F5. |
| **X-Org-Id / eco de org** | Cabecera estándar de contexto; el receptor verifica el eco de la organización en la respuesta (desajuste → `tenant_mismatch`). |
| **uncertain_dispatch** | Resultado de envío desconocido (timeout/5xx): prohibido reintentar ciegamente; reconciliar por consulta. |
| **SSE** | Server-Sent Events para tiempo real en bandeja; límite mono-instancia documentado (riesgo A1, backplane en F5). |
