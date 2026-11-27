import { describe, expect, it } from "vitest";
import {
  IllegalCampaignTransitionError,
  assertCampaignTransition,
  isTerminalState,
} from "../src/states.js";
import { LOCK_TIMEOUT_MS, WEBHOOK_LEAD } from "@vestro/contracts";

describe("máquina de estados de campaña (CONTRATOS §9)", () => {
  it("transiciones legales del ciclo de vida", () => {
    expect(assertCampaignTransition("queued", "running")).toBe("running");
    expect(assertCampaignTransition("running", "paused")).toBe("paused");
    expect(assertCampaignTransition("paused", "cancelling")).toBe("cancelling");
    expect(assertCampaignTransition("cancelling", "cancelled")).toBe("cancelled");
    expect(assertCampaignTransition("running", "completed")).toBe("completed");
    expect(assertCampaignTransition("running", "failed")).toBe("failed");
  });

  it("transiciones ilegales se rechazan (atomía del ciclo de vida)", () => {
    expect(() => assertCampaignTransition("running", "queued")).toThrow(IllegalCampaignTransitionError);
    expect(() => assertCampaignTransition("cancelled", "running")).toThrow(IllegalCampaignTransitionError);
    expect(() => assertCampaignTransition("completed", "paused")).toThrow(IllegalCampaignTransitionError);
    try {
      assertCampaignTransition("failed", "queued");
      expect.unreachable("debía lanzar");
    } catch (e) {
      expect((e as IllegalCampaignTransitionError).code).toBe("validation_failed");
      expect((e as IllegalCampaignTransitionError).from).toBe("failed");
    }
  });

  it("los estados terminales son cancelled, completed y failed", () => {
    expect(isTerminalState("cancelled")).toBe(true);
    expect(isTerminalState("completed")).toBe(true);
    expect(isTerminalState("failed")).toBe(true);
    expect(isTerminalState("running")).toBe(false);
    expect(isTerminalState("paused")).toBe(false);
    expect(isTerminalState("queued")).toBe(false);
    expect(isTerminalState("cancelling")).toBe(false);
  });
});

describe("controles de cumplimiento heredados (clean-room, sin código de ULTRA)", () => {
  it("el lock JIT es fail-closed a 50 ms", () => {
    expect(LOCK_TIMEOUT_MS).toBe(50);
  });

  it("el webhook de leads exige organización y origen", () => {
    const lead = WEBHOOK_LEAD.parse({
      organizationId: "org_4h5j6k",
      source: "formulario_web",
      identity: "573001112233",
      fields: { ciudad: "Bogotá" },
      receivedAt: "2026-11-27T12:00:00-05:00",
    });
    expect(lead.name).toBeUndefined();
    expect(() =>
      WEBHOOK_LEAD.parse({ ...lead, organizationId: "invalido" }),
    ).toThrow();
  });
});
