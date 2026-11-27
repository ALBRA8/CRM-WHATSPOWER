import { describe, expect, it } from "vitest";
import {
  API_ERROR_ENVELOPE,
  DISPATCH_CLASSIFICATIONS,
  ERROR_CATALOG,
  ERROR_CODES,
  apiError,
  httpStatusFor,
} from "../src/errors.js";

/**
 * PRUEBA DE VIGÍA (D-013): el catálogo de errores está CONGELADO.
 * Los agentes ya conectados al contrato VESTRO dependen de estos códigos:
 * renombrar, retirar o alterar el HTTP de un código debe romper esta prueba.
 */
describe("catálogo de errores — vigía de compatibilidad", () => {
  const FROZEN_CODES = [
    "ai_paused",
    "window_closed",
    "sandbox_violation",
    "message_limit",
    "sin_cerebro",
    "tenant_mismatch",
    "unauthorized_scope",
    "rate_limited",
    "uncertain_dispatch",
    "rejected_dispatch",
    "skipped_lock_unavailable",
    "suppressed",
    "approval_required",
    "firewall_denied",
    "no_matching_rule",
    "not_offered",
    "credential_invalid",
    "validation_failed",
  ];

  it("contiene exactamente los 18 códigos del contrato, sin cambios", () => {
    expect([...ERROR_CODES].sort()).toEqual([...FROZEN_CODES].sort());
    expect(ERROR_CODES).toHaveLength(18);
  });

  it("conserva el HTTP de los códigos 409/403/429/402/422/202 documentados", () => {
    expect(httpStatusFor("ai_paused")).toBe(409);
    expect(httpStatusFor("window_closed")).toBe(409);
    expect(httpStatusFor("sandbox_violation")).toBe(409);
    expect(httpStatusFor("message_limit")).toBe(409);
    expect(httpStatusFor("sin_cerebro")).toBe(409);
    expect(httpStatusFor("tenant_mismatch")).toBe(403);
    expect(httpStatusFor("unauthorized_scope")).toBe(403);
    expect(httpStatusFor("rate_limited")).toBe(429);
    expect(httpStatusFor("approval_required")).toBe(202);
    expect(httpStatusFor("not_offered")).toBe(409);
    expect(httpStatusFor("credential_invalid")).toBe(402);
    expect(httpStatusFor("validation_failed")).toBe(422);
  });

  it("uncertain_dispatch conserva 504 con alternativa 202", () => {
    expect(ERROR_CATALOG.uncertain_dispatch.httpStatus).toBe(504);
    expect(ERROR_CATALOG.uncertain_dispatch.altHttpStatus).toContain(202);
  });

  it("los códigos sin HTTP único lo documentan como null con su mapeo", () => {
    expect(ERROR_CATALOG.rejected_dispatch.httpStatus).toBeNull();
    expect(ERROR_CATALOG.rejected_dispatch.mappedFromProvider).toContain(429);
    expect(ERROR_CATALOG.skipped_lock_unavailable.httpStatus).toBeNull();
    expect(ERROR_CATALOG.suppressed.httpStatus).toBeNull();
  });

  it("cada código declara significado y acción esperada del llamante", () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_CATALOG[code].meaning.length).toBeGreaterThan(5);
      expect(ERROR_CATALOG[code].callerAction.length).toBeGreaterThan(5);
    }
  });

  it("la clasificación de efectos queda en SENT/REJECTED/UNCERTAIN", () => {
    expect([...DISPATCH_CLASSIFICATIONS]).toEqual(["SENT", "REJECTED", "UNCERTAIN"]);
  });
});

describe("envelope de error tipado", () => {
  it("construye y valida un envelope canónico", () => {
    const envelope = apiError("ai_paused", "IA pausada por ajuste", {
      requestId: "8b9e1a2c-1111-4222-8333-444455556666",
    });
    expect(API_ERROR_ENVELOPE.parse(envelope).error.code).toBe("ai_paused");
  });

  it("rechaza un código desconocido (sin inventar errores)", () => {
    expect(() =>
      API_ERROR_ENVELOPE.parse({
        error: { code: "error_totally_nuevo", message: "x" },
      }),
    ).toThrow();
  });

  it("rechaza envelope sin mensaje", () => {
    expect(() => apiError("rate_limited", "")).toThrow();
  });
});
