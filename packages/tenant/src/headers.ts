/**
 * Lectura de cabeceras estándar de contexto y verificación del eco de
 * organización (fail-closed `tenant_mismatch`).
 *
 * Modelo: MODELO_MULTI_TENANT.md §5.2 — los satélites verifican el eco de la
 * organización en las respuestas.
 */

import {
  ACTOR,
  CONTEXT_HEADER_NAMES,
  ORGANIZATION_ID,
  REQUEST_ID,
  AGENT_ID,
  tenantContext,
  type Scope,
  type TenantContext,
} from "@whatspower/contracts";

export type HeaderSource =
  | Headers
  | Record<string, string | string[] | undefined>;

function pick(source: HeaderSource, name: string): string | undefined {
  if (source instanceof Headers) {
    return source.get(name) ?? undefined;
  }
  const direct = source[name];
  if (typeof direct === "string") return direct;
  if (Array.isArray(direct) && typeof direct[0] === "string") return direct[0];
  // Búsqueda insensible a mayúsculas (Node normaliza a minúsculas).
  const key = Object.keys(source).find((k) => k.toLowerCase() === name);
  const value = key ? source[key] : undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export class TenantMismatchError extends Error {
  readonly code = "tenant_mismatch" as const;

  constructor(message = "tenant_mismatch: eco de organización no coincide") {
    super(message);
    this.name = "TenantMismatchError";
  }
}

/**
 * Verifica el eco de organización de una respuesta de satélite.
 * Fail-closed: sin eco o con eco distinto → TenantMismatchError.
 */
export function assertOrgEcho(expectedOrganizationId: string, responseOrgId: string | undefined): void {
  if (!responseOrgId) {
    throw new TenantMismatchError("tenant_mismatch: el satélite no devolvió el eco de organización");
  }
  if (responseOrgId !== expectedOrganizationId) {
    throw new TenantMismatchError(
      `tenant_mismatch: esperado ${expectedOrganizationId}, recibido ${responseOrgId}`,
    );
  }
}

export interface ParsedTenantHeaders {
  organizationId?: string;
  agentId?: string;
  actor?: string;
  requestId?: string;
}

/** Lee las cabeceras estándar sin validar el contexto completo. */
export function readTenantHeaders(source: HeaderSource): ParsedTenantHeaders {
  const organizationId = pick(source, CONTEXT_HEADER_NAMES.orgId);
  const agentId = pick(source, CONTEXT_HEADER_NAMES.agentId);
  const actor = pick(source, CONTEXT_HEADER_NAMES.actor);
  const requestId = pick(source, CONTEXT_HEADER_NAMES.requestId);
  return {
    ...(organizationId !== undefined ? { organizationId } : {}),
    ...(agentId !== undefined ? { agentId } : {}),
    ...(actor !== undefined ? { actor } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
  };
}

export class TenantContextMissingError extends Error {
  readonly code = "missing_tenant_context" as const;

  constructor(message = "Cabeceras de contexto incompletas (X-Org-Id, X-Actor, X-Request-Id)") {
    super(message);
    this.name = "TenantContextMissingError";
  }
}

/**
 * Resuelve y valida un TenantContext desde cabeceras entrantes.
 * Los scopes no viajan en cabeceras: los resuelve el llamante según su llave/
 * sesión y los pasa por `options.scopes` (por defecto: solo lectura).
 * Lanza si falta alguna cabecera obligatoria o el formato es inválido.
 */
export function parseTenantContext(
  source: HeaderSource,
  options?: { scopes?: readonly Scope[] },
): TenantContext {
  const raw = readTenantHeaders(source);
  if (!raw.organizationId || !raw.actor || !raw.requestId) {
    throw new TenantContextMissingError();
  }
  ORGANIZATION_ID.parse(raw.organizationId);
  ACTOR.parse(raw.actor);
  REQUEST_ID.parse(raw.requestId);
  if (raw.agentId !== undefined) {
    AGENT_ID.parse(raw.agentId);
  }
  return tenantContext({
    organizationId: raw.organizationId,
    actor: raw.actor,
    scopes: options?.scopes ?? ["read"],
    requestId: raw.requestId,
    ...(raw.agentId !== undefined ? { agentId: raw.agentId } : {}),
  });
}
