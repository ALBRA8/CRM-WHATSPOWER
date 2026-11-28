/**
 * @whatspower/contracts — contratos de integración versionados de WhatsPower.
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md`.
 * Regla de evolución (§12): cambios compatibles → mismo /v1; incompatibles →
 * /v2 con deprecación anunciada. Los códigos de error existentes NO se renombran.
 */

export * from "./errors.js";
export * from "./context.js";
export * from "./dispatch.js";
export * from "./bot-api.js";
export * from "./v1-api.js";
export * from "./flows.js";
export * from "./campaigns.js";
export * from "./agenda.js";
