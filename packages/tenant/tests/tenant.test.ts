import { describe, expect, it } from "vitest";
import {
  TenantContextError,
  assertSameOrganization,
  requireOrganizationId,
  requireTenantContext,
  runWithTenant,
  tryGetTenantContext,
} from "../src/context.js";
import {
  TenantContextMissingError,
  TenantMismatchError,
  assertOrgEcho,
  parseTenantContext,
  readTenantHeaders,
} from "../src/headers.js";
import { tenantContext } from "@whatspower/contracts";

const CTX_A = tenantContext({
  organizationId: "org_aaa111",
  actor: "user:usr_1",
  scopes: ["read", "operate"],
  requestId: "f0e1d2c3-a4b5-4c6d-8e7f-001122334455",
});

const CTX_B = tenantContext({
  organizationId: "org_bbb222",
  actor: "api_key:key_2",
  scopes: ["read"],
  requestId: "aabbccdd-1122-4333-8444-555566667777",
});

describe("contexto fail-closed (MODELO_MULTI_TENANT §5.1)", () => {
  it("fuera de runWithTenant no hay contexto y require falla", () => {
    expect(tryGetTenantContext()).toBeUndefined();
    expect(() => requireTenantContext()).toThrow(TenantContextError);
    expect(() => requireOrganizationId()).toThrow(TenantContextError);
  });

  it("dentro de runWithTenant el contexto está disponible", () => {
    const org = runWithTenant(CTX_A, () => requireOrganizationId());
    expect(org).toBe("org_aaa111");
  });

  it("la propagación async conserva la organización (workers/jobs/SSE/MCP)", async () => {
    const observed = await runWithTenant(CTX_A, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return requireOrganizationId();
    });
    expect(observed).toBe("org_aaa111");
  });

  it("dos organizaciones en paralelo no se cruzan", async () => {
    const [a, b] = await Promise.all([
      runWithTenant(CTX_A, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return requireOrganizationId();
      }),
      runWithTenant(CTX_B, async () => {
        await new Promise((r) => setTimeout(r, 2));
        return requireOrganizationId();
      }),
    ]);
    expect(a).toBe("org_aaa111");
    expect(b).toBe("org_bbb222");
  });

  it("al salir del run el contexto desaparece (sin fugas de pool)", () => {
    runWithTenant(CTX_A, () => undefined);
    expect(tryGetTenantContext()).toBeUndefined();
  });
});

describe("guarda de dominio (primera valla; RLS es la segunda)", () => {
  it("assertSameOrganization acepta la misma organización", () => {
    expect(() =>
      runWithTenant(CTX_A, () => assertSameOrganization("org_aaa111")),
    ).not.toThrow();
  });

  it("assertSameOrganization lanza tenant_mismatch al cruzar organizaciones", () => {
    try {
      runWithTenant(CTX_A, () => assertSameOrganization("org_bbb222"));
      expect.unreachable("debía lanzar tenant_mismatch");
    } catch (e) {
      expect((e as Error & { code?: string }).code).toBe("tenant_mismatch");
    }
  });

  it("assertSameOrganization fuera de contexto es fail-closed", () => {
    expect(() => assertSameOrganization("org_aaa111")).toThrow(TenantContextError);
  });
});

describe("cabeceras estándar y eco de organización (§5.2)", () => {
  const HEADERS: Record<string, string> = {
    "x-org-id": "org_aaa111",
    "x-agent-id": "org:org_aaa111#ventas",
    "x-actor": "agent:org_aaa111#ventas",
    "x-request-id": "f0e1d2c3-a4b5-4c6d-8e7f-001122334455",
  };

  it("lee cabeceras insensible a mayúsculas", () => {
    const parsed = readTenantHeaders({ "X-Org-Id": "org_aaa111", "X-Actor": "user:usr_1", "X-Request-Id": "f0e1d2c3-a4b5-4c6d-8e7f-001122334455" });
    expect(parsed.organizationId).toBe("org_aaa111");
    expect(parsed.actor).toBe("user:usr_1");
  });

  it("parseTenantContext construye un contexto válido desde cabeceras", () => {
    const ctx = parseTenantContext(HEADERS);
    expect(ctx.organizationId).toBe("org_aaa111");
    expect(ctx.agentId).toBe("org:org_aaa111#ventas");
    expect(ctx.actorType).toBe("agent");
  });

  it("sin cabeceras obligatorias falla cerrado", () => {
    expect(() => parseTenantContext({})).toThrow(TenantContextMissingError);
    expect(() =>
      parseTenantContext({ "x-org-id": "org_aaa111" }),
    ).toThrow(TenantContextMissingError);
  });

  it("rechaza cabeceras malformadas", () => {
    expect(() =>
      parseTenantContext({ ...HEADERS, "x-org-id": "sin-prefijo" }),
    ).toThrow();
    expect(() =>
      parseTenantContext({ ...HEADERS, "x-request-id": "no-uuid" }),
    ).toThrow();
  });

  it("eco de organización correcto pasa", () => {
    expect(() => assertOrgEcho("org_aaa111", "org_aaa111")).not.toThrow();
  });

  it("eco ausente o distinto lanza tenant_mismatch (fail-closed)", () => {
    expect(() => assertOrgEcho("org_aaa111", undefined)).toThrow(TenantMismatchError);
    expect(() => assertOrgEcho("org_aaa111", "org_bbb222")).toThrow(/org_bbb222/);
  });

  it("funciona con un Headers real (fetch/undici)", () => {
    const h = new Headers(HEADERS);
    expect(readTenantHeaders(h).organizationId).toBe("org_aaa111");
    expect(parseTenantContext(h).actor).toBe("agent:org_aaa111#ventas");
  });
});
