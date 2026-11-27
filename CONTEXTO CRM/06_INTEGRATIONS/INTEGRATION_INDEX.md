# INTEGRATION INDEX — integraciones del ecosistema

| # | Integración | Dirección | Contrato | Estado |
|---|---|---|---|---|
| INT-001 | AGENTE-GENERAL (cerebro único) | CRM → Agente: despacho firmado + health + aprobaciones; Agente → CRM: bot API v1 (13 rutas) + `/v1` comercial | `06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §3-§7; esquemas en `packages/contracts` | CONTRATO IMPLEMENTADO (esquemas + cliente `services/agent-gateway` con pruebas); conexión real pendiente (F7) |
| INT-002 | Motor de flujos (herencia WHATSPOWER, MIT) | Inbound firmado CRM→Flujos; acciones comerciales y dispatch-proxy Flujos→CRM; locks/supresión campañas→flujos | ídem §8; esquemas `packages/contracts/flows` | CONTRATO IMPLEMENTADO (esquemas + validador de ventana HMAC en `services/flows`); motor completo en F9 |
| INT-003 | Motor de campañas (clean-room de ULTRA) | Cola/lifecycle CRM→Campañas; checks JIT; transporte vía CRM | ídem §9; esquemas `packages/contracts/campaigns` | CONTRATO IMPLEMENTADO (esquemas + máquina de estados declarativa en `services/campaigns`); motor en F9 |
| INT-004 | Canales oficiales (Meta Cloud API WhatsApp, Instagram, Messenger, Telegram, TikTok) | Proveedor → CRM: webhooks `/api/webhooks/{canal}/{token}` con doble auth; CRM → proveedor con credenciales org-scoped | ídem §11 | HEREDADO DE VOCERO (conservado); sin Baileys (D-007) |
| INT-005 | Conectores de agenda | 4 operaciones públicas: createMeeting/rescheduleMeeting/cancelMeeting/health | ídem §10 | HEREDADO DE VOCERO (conservado) |
| INT-006 | AGENTE-GENERAL A2A | JSON-RPC `/a2a/v1/` + agent-card | ídem §3 (adicional) | DEFINIDO; consumo en F7 |

## Reglas transversales (no negociables)

- Toda llamada interna lleva `X-Org-Id`, actor y firma HMAC; el receptor verifica el eco de la organización (fail-closed `tenant_mismatch`).
- El token del canal nunca sale del CRM; los satélites despachan vía el CRM.
- `ALLOW_REAL_DISPATCH` es la única salvaguarda de envío real; sin ella, nada se envía.
- Clasificación obligatoria de todo efecto: `SENT / REJECTED / UNCERTAIN`; `uncertain_dispatch` jamás se reintenta ciegamente.
