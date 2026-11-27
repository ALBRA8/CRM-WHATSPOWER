/**
 * Contexto de tenant y cabeceras estándar de contexto.
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §2
 * y `CONTEXTO CRM/00_MASTER/MODELO_MULTI_TENANT.md` §5.
 *
 * Cabecera estándar en llamadas internas (núcleo ↔ satélites):
 *   X-Org-Id: <organizationId>   obligatorio; el receptor verifica el eco
 *   X-Agent-Id: <agentLogicalId> cuando la operación la ejecuta un agente
 *   X-Actor: user:<id> | api_key:<id> | agent:<id> | webhook:<connId>
 *   X-Request-Id: <uuid>         correlación con ExecutionTrace del agente
 *   X-Signature: <hmac-sha256(body+timestamp)>
 *   X-Timestamp: <unix>
 */

import { z } from "zod";

/** Identificador de organización con prefijo (patrón VOCERO con nanoid). */
export const ORGANIZATION_ID = z
  .string()
  .regex(/^org_[A-Za-z0-9_-]+$/, "organizationId debe tener el formato org_<id>");

/** Identidad del agente lógico: org:<organizationId>#<agenteLogico> (D-014). */
export const AGENT_ID = z
  .string()
  .regex(
    /^org:[A-Za-z0-9_-]+(#[A-Za-z0-9_-]+)?$/,
    'agentId debe tener el formato "org:<organizationId>" o "org:<organizationId>#<agenteLogico>"',
  );

/** Actor emisor de la operación. El agente lleva su identidad lógica con #. */
export const ACTOR = z
  .string()
  .regex(
    /^(user|api_key|agent|webhook):[A-Za-z0-9_.-]+(?:#[A-Za-z0-9_.-]+)?$/,
    "actor debe ser user:<id> | api_key:<id> | agent:<id> | webhook:<connId>",
  );

export const SCOPES = ["read", "operate", "send", "configure"] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LIST = z.array(z.enum(SCOPES)).min(1);

export const REQUEST_ID = z.string().uuid();

export const TENANT_CONTEXT = z.object({
  organizationId: ORGANIZATION_ID,
  /** Agente lógico que ejecuta, cuando aplica (D-014). */
  agentId: AGENT_ID.optional(),
  /** Actor completo, p. ej. "user:usr_1" o "webhook:conn_9". */
  actor: ACTOR,
  actorType: z.enum(["user", "api_key", "agent", "webhook"]),
  actorId: z.string().min(1),
  scopes: SCOPE_LIST,
  requestId: REQUEST_ID,
});

export type TenantContext = z.infer<typeof TENANT_CONTEXT>;

export const CONTEXT_HEADER_NAMES = {
  orgId: "x-org-id",
  agentId: "x-agent-id",
  actor: "x-actor",
  requestId: "x-request-id",
  signature: "x-signature",
  timestamp: "x-timestamp",
} as const;

/** Claves de idempotencia y firma (§1). */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
/** Ventana de tolerancia del X-Timestamp en los puentes HMAC (§8/§9). */
export const HMAC_TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Construye un TenantContext a partir de un actor tipado. */
export function tenantContext(input: {
  organizationId: string;
  actor: string;
  scopes: readonly Scope[];
  requestId: string;
  agentId?: string;
}): TenantContext {
  const actorType = ACTOR.parse(input.actor).split(":")[0] as TenantContext["actorType"];
  return TENANT_CONTEXT.parse({
    organizationId: input.organizationId,
    actor: input.actor,
    actorType,
    actorId: input.actor.split(":")[1] ?? "",
    scopes: input.scopes,
    requestId: input.requestId,
    ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
  });
}
