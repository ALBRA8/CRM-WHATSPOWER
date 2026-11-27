/**
 * @vestro/flows — servicio satélite de flujos.
 *
 * Etapa 1 (F4): contratos versionados + firma HMAC de puente.
 * El motor completo (12 nodos, constructor visual, locks e idempotencia,
 * herencia WHATSPOWER MIT) se integra en la Fase 9 del roadmap: los esquemas
 * y garantías ya están fijados en @vestro/contracts (FLOW_ROUTES, FLOW_INBOUND,
 * CRM_ACTIONS, FLOW_EFFECT_RESULT).
 */

export * from "./hmac.js";
export {
  FLOW_ROUTES,
  FLOW_INBOUND,
  FLOW_STAGE_CHANGE,
  CRM_ACTIONS,
  CRM_ACTION_REQUEST,
  CRM_ACTION_RESPONSE,
  DISPATCH_PROXY_REQUEST,
  FLOW_LOCK_STATUS,
  SUPPRESSION_ENTRY,
  FLOW_EFFECT_RESULT,
} from "@vestro/contracts";
