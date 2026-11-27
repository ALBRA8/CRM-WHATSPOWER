/**
 * API v1 comercial (Agente → CRM y usos internos con llave/sesión).
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §3.
 * Scopes: read / operate / send / configure. Toda escritura exige
 * `Idempotency-Key`. La identidad del tenant viaja en `X-Org-Id`.
 */

import { z } from "zod";
import { ORGANIZATION_ID } from "./context.js";

export type V1RouteMethod = "GET" | "POST" | "PUT";
export type V1RouteDirection = "agente->crm" | "crm->agente" | "interno";

export interface V1Route {
  readonly method: V1RouteMethod;
  readonly path: string;
  readonly scope: "read" | "operate" | "send" | "configure";
  readonly direction: V1RouteDirection;
  readonly requiresIdempotencyKey: boolean;
  readonly purpose: string;
}

export const V1_ROUTES: readonly V1Route[] = [
  { method: "GET", path: "/v1/contacts", scope: "read", direction: "agente->crm", requiresIdempotencyKey: false, purpose: "Consultar contactos (+search)" },
  { method: "POST", path: "/v1/contacts", scope: "operate", direction: "agente->crm", requiresIdempotencyKey: true, purpose: "Crear contacto" },
  { method: "GET", path: "/v1/leads", scope: "read", direction: "agente->crm", requiresIdempotencyKey: false, purpose: "Consultar oportunidades" },
  { method: "GET", path: "/v1/conversations/{id}/messages", scope: "read", direction: "agente->crm", requiresIdempotencyKey: false, purpose: "Consultar historial" },
  { method: "POST", path: "/v1/tasks", scope: "operate", direction: "agente->crm", requiresIdempotencyKey: true, purpose: "Crear tarea" },
  { method: "POST", path: "/v1/sequences", scope: "operate", direction: "agente->crm", requiresIdempotencyKey: true, purpose: "Programar seguimiento (motor de flujos)" },
  { method: "GET", path: "/v1/knowledge", scope: "read", direction: "agente->crm", requiresIdempotencyKey: false, purpose: "KB por organización" },
  { method: "POST", path: "/v1/automations/run", scope: "operate", direction: "agente->crm", requiresIdempotencyKey: true, purpose: "Ejecutar workflow (pasa por firewall/policy del agente)" },
  { method: "GET", path: "/v1/execution-results/{id}", scope: "read", direction: "crm->agente", requiresIdempotencyKey: false, purpose: "Resultado de ejecución con traza" },
] as const;

/* ---------- Contactos ---------- */

export const CONTACT_SEARCH_QUERY = z.object({
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const CONTACT_CREATE = z.object({
  /** Identidad estable por canal (p. ej. WhatsApp). Única por (org, canal, identidad). */
  identity: z.string().min(3),
  channel: z.string().min(1),
  name: z.string().max(200).optional(),
  ficha: z.record(z.string(), z.unknown()).optional(),
});

export const CONTACT_RESPONSE = z.object({
  id: z.string().min(1),
  organizationId: ORGANIZATION_ID,
  identity: z.string(),
  name: z.string().optional(),
  stage: z.string().optional(),
});

/* ---------- Tareas y seguimientos ---------- */

export const TASK_CREATE = z.object({
  title: z.string().min(1).max(300),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  leadId: z.string().optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(4000).optional(),
});

export const TASK_RESPONSE = z.object({
  id: z.string().min(1),
  title: z.string(),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(["open", "done", "cancelled"]),
});

export const SEQUENCE_CREATE = z.object({
  /** Referencia al flujo declarado por el tenant. */
  flowId: z.string().min(1),
  contactId: z.string().min(1),
  startAt: z.string().datetime({ offset: true }).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

/* ---------- Ejecución del agente (CRM → Agente) ---------- */

export const EXECUTION_RESULT = z.object({
  executionId: z.string().min(1),
  status: z.enum(["running", "waiting_approval", "succeeded", "failed", "cancelled"]),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  steps: z
    .array(
      z.object({
        seq: z.number().int().nonnegative(),
        tool: z.string(),
        status: z.enum(["ok", "error", "skipped", "denied"]),
        detail: z.string().optional(),
      }),
    )
    .default([]),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

export type ExecutionResult = z.infer<typeof EXECUTION_RESULT>;
