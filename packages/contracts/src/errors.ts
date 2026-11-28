/**
 * Catálogo de errores tipados de WhatsPower.
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §7.
 *
 * REGLA DE COMPATIBILIDAD (D-013): los códigos existentes NO se renombran.
 * Los códigos marcados `compat: "whatspower"` / `"ecosistema"` / `"agente"`
 * provienen de sistemas ya conectados al contrato WHATSPOWER, a los puentes del
 * ecosistema o al motor del agente, y están congelados por la prueba de vigía
 * `tests/errors.test.ts`.
 */

import { z } from "zod";

export const ERROR_CATALOG = {
  ai_paused: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "IA pausada (por ajuste o por fallo de credencial)",
    callerAction: "No reintentar; avisar",
  },
  window_closed: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "Ventana de 24 h cerrada",
    callerAction: "Enviar plantilla aprobada o rendirse",
  },
  sandbox_violation: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "Intento de envío real en conversación is_test",
    callerAction: "Corregir; es un guardrail",
  },
  message_limit: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "El canal no admite más mensajes (p. ej. TikTok)",
    callerAction: "No reintentar",
  },
  sin_cerebro: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "No hay agente conectado/en línea",
    callerAction: "Fallback a bandeja manual",
  },
  tenant_mismatch: {
    httpStatus: 403,
    origin: "ecosistema",
    compat: "ecosistema",
    meaning: "La organización del parámetro/cuerpo no coincide con la del contexto",
    callerAction: "Corregir contexto; se audita",
  },
  unauthorized_scope: {
    httpStatus: 403,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "Scope insuficiente (read/operate/send/configure)",
    callerAction: "Solicitar scope",
  },
  rate_limited: {
    httpStatus: 429,
    origin: "todos",
    compat: "whatspower",
    meaning: "Límite alcanzado",
    callerAction: "Esperar Retry-After",
  },
  uncertain_dispatch: {
    httpStatus: 504,
    altHttpStatus: [202],
    origin: "ecosistema",
    compat: "ecosistema",
    meaning: "Resultado del envío desconocido (timeout/5xx)",
    callerAction: "Prohibido reintentar ciegamente; reconciliar por consulta",
  },
  rejected_dispatch: {
    httpStatus: null,
    mappedFromProvider: [400, 401, 403, 404, 410, 413, 422, 429],
    origin: "ecosistema",
    compat: "ecosistema",
    meaning: "El proveedor rechazó el envío",
    callerAction: "Reintento limpio permitido tras corrección",
  },
  skipped_lock_unavailable: {
    httpStatus: null,
    origin: "ultra",
    compat: "ecosistema",
    meaning: "Ítem de campaña saltado: lock de conversación no respondió (fail-closed)",
    callerAction: "Reintentar en próxima pasada",
  },
  suppressed: {
    httpStatus: null,
    origin: "ecosistema",
    compat: "ecosistema",
    meaning: "Destinatario en lista de supresión o sin consentimiento",
    callerAction: "No contactar",
  },
  approval_required: {
    httpStatus: 202,
    origin: "agente",
    compat: "agente",
    meaning: "Acción retenida por HITL",
    callerAction: "Resolver en la cola de aprobaciones",
  },
  firewall_denied: {
    httpStatus: 403,
    origin: "agente",
    compat: "agente",
    meaning: "Acción bloqueada por ActionFirewall/PolicyEngine",
    callerAction: "No reintentar; revisar política",
  },
  no_matching_rule: {
    httpStatus: 403,
    origin: "agente",
    compat: "agente",
    meaning: "Sin regla de firewall → DENY (default-deny)",
    callerAction: "No reintentar; revisar la regla de firewall",
  },
  not_offered: {
    httpStatus: 409,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "Se intentó reservar un hueco que no se ofreció",
    callerAction: "Re-consultar disponibilidad",
  },
  credential_invalid: {
    httpStatus: 402,
    origin: "whatspower",
    compat: "whatspower",
    meaning: "Credencial rechazada por el proveedor (401/402)",
    callerAction: "Pausar y avisar en Ajustes",
  },
  validation_failed: {
    httpStatus: 422,
    origin: "todos",
    compat: "whatspower",
    meaning: "Input inválido",
    callerAction: "Corregir payload",
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;
export type ErrorOrigin = (typeof ERROR_CATALOG)[ErrorCode]["origin"];

/** Conjunto congelado de códigos: la prueba de vigía falla si cambia. */
export const ERROR_CODES: readonly ErrorCode[] = Object.keys(
  ERROR_CATALOG,
) as readonly ErrorCode[];

export function httpStatusFor(code: ErrorCode): number | null {
  return ERROR_CATALOG[code].httpStatus;
}

export const API_ERROR_ENVELOPE = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES as unknown as [ErrorCode, ...ErrorCode[]]),
    message: z.string().min(1),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof API_ERROR_ENVELOPE>;

/** Construye un envelope de error tipado validado. */
export function apiError(
  code: ErrorCode,
  message: string,
  options?: { details?: unknown; requestId?: string },
): ApiErrorEnvelope {
  return API_ERROR_ENVELOPE.parse({
    error: {
      code,
      message,
      ...(options?.details !== undefined ? { details: options.details } : {}),
      ...(options?.requestId !== undefined ? { requestId: options.requestId } : {}),
    },
  });
}

/** Clasificación obligatoria de todo efecto de envío (flujos/campañas). */
export const DISPATCH_CLASSIFICATIONS = ["SENT", "REJECTED", "UNCERTAIN"] as const;
export type DispatchClassification = (typeof DISPATCH_CLASSIFICATIONS)[number];
