/**
 * Contrato con el motor de flujos (herencia WHATSPOWER, adaptador versionado).
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §8.
 * Garantías: fail-closed sin secreto; eco de organización verificado; la
 * indisponibilidad del motor NO afecta la bandeja ni el pipeline; `goto_flow`
 * solo dentro de la misma organización; sin envío real sin ALLOW_REAL_DISPATCH.
 */

import { z } from "zod";
import { ORGANIZATION_ID } from "./context.js";
import { DISPATCH_CLASSIFICATIONS } from "./errors.js";

export const FLOW_ROUTES = {
  inbound: "POST /api/inbound",
  stageChange: "POST /api/crm/stage-change",
  crmActions: "POST /api/crm/actions",
  dispatchProxy: "POST /api/whatsapp/dispatch-proxy",
  locks: "GET /api/internal/locks/:phone",
  suppression: "GET|POST|DELETE /api/internal/suppression/:phone",
} as const;

/* ---------- CRM → Flujos ---------- */

export const FLOW_INBOUND = z.object({
  organizationId: ORGANIZATION_ID,
  conversationId: z.string().min(1),
  contactIdentity: z.string().min(3),
  messageId: z.string().min(1),
  text: z.string().default(""),
  media: z.array(z.string()).default([]),
  receivedAt: z.string().datetime({ offset: true }),
  /** El CRM no espera el resultado para mostrar el mensaje en bandeja. */
  test: z.boolean(),
});

export const FLOW_STAGE_CHANGE = z.object({
  organizationId: ORGANIZATION_ID,
  leadId: z.string().min(1),
  fromStageId: z.string().min(1),
  toStageId: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  /** Dedup por (org, leadId, transición, occurredAt) en el motor. */
  dedupKey: z.string().min(1),
});

/* ---------- Flujos → CRM (acciones comerciales) ---------- */

export const CRM_ACTIONS = [
  "create_client",
  "create_opportunity",
  "add_note",
  "update_stage",
  "create_task",
] as const;
export type CrmAction = (typeof CRM_ACTIONS)[number];

export const CRM_ACTION_REQUEST = z.object({
  /** El CRM verifica el eco de la organización (fail-closed tenant_mismatch). */
  organizationId: ORGANIZATION_ID,
  action: z.enum(CRM_ACTIONS),
  payload: z.record(z.string(), z.unknown()),
  /** El actor es el motor de flujos en nombre del tenant. */
  actor: z.string().regex(/^agent:[A-Za-z0-9_-]+$/),
});

export const CRM_ACTION_RESPONSE = z.object({
  ok: z.boolean(),
  entityRef: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

/* ---------- Transporte de envío ---------- */

export const DISPATCH_PROXY_REQUEST = z.object({
  organizationId: ORGANIZATION_ID,
  conversationId: z.string().min(1),
  text: z.string().min(1).max(4096),
  template: z
    .object({
      name: z.string(),
      language: z.string(),
      variables: z.array(z.string()).default([]),
    })
    .optional(),
});

/* ---------- Locks y supresión (Campañas → Flujos) ---------- */

export const FLOW_LOCK_STATUS = z.object({
  organizationId: ORGANIZATION_ID,
  phone: z.string().min(3),
  locked: z.boolean(),
  owner: z.string().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export const SUPPRESSION_ENTRY = z.object({
  organizationId: ORGANIZATION_ID,
  phone: z.string().min(3),
  reason: z.string().min(1),
  until: z.string().datetime({ offset: true }).nullable(),
});

/* ---------- Resultados ---------- */

export const FLOW_EFFECT_RESULT = z.object({
  /** Clasificación obligatoria en cada efecto (SENT / REJECTED / UNCERTAIN). */
  classification: z.enum(DISPATCH_CLASSIFICATIONS),
  code: z.string().optional(),
  detail: z.string().optional(),
  occurredAt: z.string().datetime({ offset: true }),
});

export type FlowEffectResult = z.infer<typeof FLOW_EFFECT_RESULT>;
