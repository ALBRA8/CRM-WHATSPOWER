import { describe, expect, it } from "vitest";
import {
  AGENT_ID,
  ACTOR,
  CONTEXT_HEADER_NAMES,
  HMAC_TIMESTAMP_TOLERANCE_SECONDS,
  IDEMPOTENCY_KEY_HEADER,
  ORGANIZATION_ID,
  TENANT_CONTEXT,
  SCOPES,
  tenantContext,
} from "../src/context.js";

describe("identidad de tenant", () => {
  it("acepta organizationId con prefijo org_", () => {
    expect(ORGANIZATION_ID.parse("org_4h5j6k")).toBe("org_4h5j6k");
  });

  it("rechaza organizationId sin prefijo o vacío", () => {
    expect(() => ORGANIZATION_ID.parse("4h5j6k")).toThrow();
    expect(() => ORGANIZATION_ID.parse("")).toThrow();
  });

  it("acepta agentId org:<org> y org:<org>#<agente> (D-014)", () => {
    expect(AGENT_ID.parse("org:org_4h5j6k")).toBe("org:org_4h5j6k");
    expect(AGENT_ID.parse("org:org_4h5j6k#ventas")).toBe("org:org_4h5j6k#ventas");
  });

  it("rechaza agentId sin mapeo de organización (memoria cruzada prohibida)", () => {
    expect(() => AGENT_ID.parse("ventas")).toThrow();
    expect(() => AGENT_ID.parse("agente_global")).toThrow();
    expect(() => AGENT_ID.parse("org:#ventas")).toThrow();
  });

  it("acepta los cuatro tipos de actor y rechaza desconocidos", () => {
    expect(ACTOR.parse("user:usr_1")).toBe("user:usr_1");
    expect(ACTOR.parse("api_key:key_9")).toBe("api_key:key_9");
    expect(ACTOR.parse("agent:org_4h5j6k#ventas")).toBe("agent:org_4h5j6k#ventas");
    expect(ACTOR.parse("webhook:conn_7")).toBe("webhook:conn_7");
    expect(() => ACTOR.parse("admin:1")).toThrow();
    expect(() => ACTOR.parse("user:")).toThrow();
  });
});

describe("TenantContext", () => {
  const requestId = "f0e1d2c3-a4b5-4c6d-8e7f-001122334455";

  it("construye contexto con scopes mínimos y deriva actorType", () => {
    const ctx = tenantContext({
      organizationId: "org_4h5j6k",
      actor: "api_key:key_9",
      scopes: ["read"],
      requestId,
    });
    expect(ctx.actorType).toBe("api_key");
    expect(ctx.actorId).toBe("key_9");
    expect(TENANT_CONTEXT.parse(ctx).organizationId).toBe("org_4h5j6k");
  });

  it("con agente lógico incluye agentId", () => {
    const ctx = tenantContext({
      organizationId: "org_4h5j6k",
      actor: "agent:org_4h5j6k#ventas",
      scopes: ["read", "operate"],
      requestId,
      agentId: "org:org_4h5j6k#ventas",
    });
    expect(ctx.agentId).toBe("org:org_4h5j6k#ventas");
    expect(ctx.scopes).toEqual(["read", "operate"]);
  });

  it("rechaza contexto sin scopes o con requestId no uuid", () => {
    expect(() =>
      tenantContext({
        organizationId: "org_4h5j6k",
        actor: "user:usr_1",
        scopes: [],
        requestId,
      }),
    ).toThrow();
    expect(() =>
      tenantContext({
        organizationId: "org_4h5j6k",
        actor: "user:usr_1",
        scopes: ["read"],
        requestId: "no-es-uuid",
      }),
    ).toThrow();
  });

  it("los scopes del contrato son read/operate/send/configure", () => {
    expect([...SCOPES]).toEqual(["read", "operate", "send", "configure"]);
  });
});

describe("cabeceras estándar", () => {
  it("declara las cabeceras del contrato §2", () => {
    expect(CONTEXT_HEADER_NAMES.orgId).toBe("x-org-id");
    expect(CONTEXT_HEADER_NAMES.agentId).toBe("x-agent-id");
    expect(CONTEXT_HEADER_NAMES.actor).toBe("x-actor");
    expect(CONTEXT_HEADER_NAMES.requestId).toBe("x-request-id");
    expect(CONTEXT_HEADER_NAMES.signature).toBe("x-signature");
    expect(CONTEXT_HEADER_NAMES.timestamp).toBe("x-timestamp");
  });

  it("idempotencia en escrituras y ventana HMAC de ±300 s", () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe("Idempotency-Key");
    expect(HMAC_TIMESTAMP_TOLERANCE_SECONDS).toBe(300);
  });
});
