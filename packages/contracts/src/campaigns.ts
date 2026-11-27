/**
 * Contrato con el motor de campañas (reconstrucción clean-room de
 * WHATSPOWER-ULTRA; sin copiar código — D-009).
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §9.
 * El control de ritmo es operación de calidad, NO mecanismo de evasión de las
 * políticas de las plataformas.
 */

import { z } from "zod";
import { ORGANIZATION_ID } from "./context.js";
import { DISPATCH_CLASSIFICATIONS } from "./errors.js";

export const CAMPAIGN_ROUTES = {
  create: "POST /api/campaigns",
  pause: "POST /api/campaigns/:id/pause",
  resume: "POST /api/campaigns/:id/resume",
  cancel: "POST /api/campaigns/:id/cancel",
  webhookLead: "POST /api/audiences/webhook-lead",
} as const;

/* ---------- Cola de campaña (CRM → Campañas) ---------- */

export const CAMPAIGN_CREATE = z.object({
  organizationId: ORGANIZATION_ID,
  /** La audiencia ya fue verificada por el CRM (consentimiento, supresión). */
  audience: z
    .object({
      kind: z.enum(["contactIds", "segment"]),
      contactIds: z.array(z.string()).optional(),
      segmentId: z.string().optional(),
    })
    .refine(
      (a) =>
        a.kind === "contactIds"
          ? (a.contactIds?.length ?? 0) > 0
          : Boolean(a.segmentId),
      { message: "la audiencia exige contactIds (mínimo 1) o segmentId según su kind" },
    ),
  template: z.object({
    name: z.string().min(1),
    language: z.string().min(1),
    variables: z.record(z.string(), z.string()).default({}),
  }),
  pacing: z.object({
    perMinute: z.number().int().min(1).max(1000).optional(),
    /** Round-robin equitativo por organización (patrón del worker de ULTRA). */
    fairShare: z.boolean().default(true),
  }),
  idempotencyKey: z.string().min(1),
});

export const CAMPAIGN_RESPONSE = z.object({
  id: z.string().min(1),
  organizationId: ORGANIZATION_ID,
  status: z.enum(["queued", "running", "paused", "cancelling", "cancelled", "completed", "failed"]),
});

/* ---------- Ciclo de vida: máquina de estados con transiciones atómicas ---------- */

export const CAMPAIGN_STATES = [
  "queued",
  "running",
  "paused",
  "cancelling",
  "cancelled",
  "completed",
  "failed",
] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export const CAMPAIGN_TRANSITIONS: Readonly<
  Record<CampaignState, readonly CampaignState[]>
> = {
  queued: ["running", "cancelled"],
  running: ["paused", "cancelling", "completed", "failed"],
  paused: ["running", "cancelling", "cancelled"],
  cancelling: ["cancelled"],
  cancelled: [],
  completed: [],
  failed: [],
};

export function canTransitionCampaign(from: CampaignState, to: CampaignState): boolean {
  return CAMPAIGN_TRANSITIONS[from].includes(to);
}

/* ---------- Checks JIT (fail-closed < 50 ms antes de cada envío) ---------- */

export const JIT_CHECKS = [
  "suppression",
  "consent",
  "lock",
  "ownership",
  "pacing",
] as const;
export type JitCheck = (typeof JIT_CHECKS)[number];

export const JIT_CHECK_RESULT = z.object({
  check: z.enum(JIT_CHECKS),
  status: z.enum(["pass", "skip"]),
  /** Código tipado cuando el check no pasa (p. ej. suppressed, skipped_lock_unavailable). */
  code: z.string().optional(),
  elapsedMs: z.number().int().nonnegative(),
});

/** Timeout del lock: si no responde → `skipped_lock_unavailable` (fail-closed). */
export const LOCK_TIMEOUT_MS = 50;

/* ---------- Webhooks de leads (Formularios → Campañas → CRM) ---------- */

export const WEBHOOK_LEAD = z.object({
  organizationId: ORGANIZATION_ID,
  source: z.string().min(1),
  identity: z.string().min(3),
  name: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  receivedAt: z.string().datetime({ offset: true }),
});

/* ---------- Resultados (Campañas → CRM) ---------- */

export const CAMPAIGN_RESULTS = z.object({
  campaignId: z.string().min(1),
  organizationId: ORGANIZATION_ID,
  counters: z.object({
    sent: z.number().int().nonnegative().default(0),
    failed: z.number().int().nonnegative().default(0),
    skipped: z.number().int().nonnegative().default(0),
    pending: z.number().int().nonnegative().default(0),
  }),
  items: z
    .array(
      z.object({
        contactId: z.string(),
        status: z.enum(DISPATCH_CLASSIFICATIONS),
        code: z.string().optional(),
        at: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .default([]),
  auditLogExportable: z.literal(true),
});

export type CampaignResults = z.infer<typeof CAMPAIGN_RESULTS>;
