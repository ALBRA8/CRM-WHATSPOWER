/**
 * Contexto de tenant con AsyncLocalStorage — fail-closed.
 *
 * Modelo: `CONTEXTO CRM/00_MASTER/MODELO_MULTI_TENANT.md` §5.
 * - Toda operación requiere contexto explícito: nadie «hereda» una organización por accidente.
 * - Si no hay contexto, `require*` lanza `TenantContextError` (código `tenant_mismatch`
 *   es para desajustes; sin contexto el error es de ausencia).
 * - La propagación cubre HTTP → servicio → worker → job → SSE → MCP → webhook.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "@whatspower/contracts";

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export class TenantContextError extends Error {
  readonly code: "missing_tenant_context";
  readonly organizationId?: undefined;

  constructor(message = "Operación sin contexto de tenant: fail-closed") {
    super(message);
    this.name = "TenantContextError";
    this.code = "missing_tenant_context";
  }
}

/** Ejecuta `fn` con el contexto fijado (equivalente a SET LOCAL app.current_org). */
export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(TENANT_CONTEXT.parse(context), fn);
}

/** Contexto si existe; undefined fuera de un runWithTenant. */
export function tryGetTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** Fail-closed: sin contexto no hay operación. */
export function requireTenantContext(): TenantContext {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new TenantContextError();
  }
  return store;
}

/** Fail-closed: sin organización no hay consulta de dominio. */
export function requireOrganizationId(): string {
  return requireTenantContext().organizationId;
}

/**
 * Guarda de dominio (primera valla de aplicación; la segunda es RLS).
 * Lanza si la entidad no pertenece a la organización del contexto.
 */
export function assertSameOrganization(entityOrganizationId: string): void {
  const ctx = requireTenantContext();
  if (ctx.organizationId !== entityOrganizationId) {
    const e = new Error(
      `tenant_mismatch: entidad de ${entityOrganizationId} accedida desde ${ctx.organizationId}`,
    );
    (e as Error & { code?: string }).code = "tenant_mismatch";
    throw e;
  }
}
