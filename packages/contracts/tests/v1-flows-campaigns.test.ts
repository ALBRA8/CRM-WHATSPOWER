import { describe, expect, it } from "vitest";
import {
  CRM_ACTIONS,
  CRM_ACTION_REQUEST,
  FLOW_EFFECT_RESULT,
  FLOW_INBOUND,
} from "../src/flows.js";
import {
  CAMPAIGN_CREATE,
  CAMPAIGN_RESULTS,
  CAMPAIGN_STATES,
  canTransitionCampaign,
  JIT_CHECK_RESULT,
  LOCK_TIMEOUT_MS,
} from "../src/campaigns.js";
import { V1_ROUTES, TASK_CREATE, EXECUTION_RESULT } from "../src/v1-api.js";
import { AGENDA_CONNECTOR_OPS, AGENDA_INVARIANTS, EVENT_ENVELOPE } from "../src/agenda.js";

describe("contrato del motor de flujos (§8)", () => {
  it("el inbound exige organización y es asíncrono respecto de la bandeja", () => {
    const inbound = FLOW_INBOUND.parse({
      organizationId: "org_4h5j6k",
      conversationId: "cv_1",
      contactIdentity: "573001112233",
      messageId: "msg_1",
      text: "Hola",
      media: [],
      receivedAt: "2026-11-27T12:00:00-05:00",
      test: false,
    });
    expect(inbound.organizationId).toBe("org_4h5j6k");
    expect(inbound.test).toBe(false);
    expect(() => FLOW_INBOUND.parse({ ...inbound, organizationId: "otra_org" })).toThrow();
  });

  it("las acciones comerciales conservan las 5 operaciones con create_task", () => {
    expect([...CRM_ACTIONS]).toEqual([
      "create_client",
      "create_opportunity",
      "add_note",
      "update_stage",
      "create_task",
    ]);
    expect(() =>
      CRM_ACTION_REQUEST.parse({
        organizationId: "org_4h5j6k",
        action: "delete_everything",
        payload: {},
        actor: "agent:org_4h5j6k#flujos",
      }),
    ).toThrow();
  });

  it("el actor de acciones comerciales siempre es el motor de flujos", () => {
    expect(() =>
      CRM_ACTION_REQUEST.parse({
        organizationId: "org_4h5j6k",
        action: "add_note",
        payload: {},
        actor: "user:usr_1",
      }),
    ).toThrow();
  });

  it("todo efecto se clasifica SENT/REJECTED/UNCERTAIN", () => {
    const effect = FLOW_EFFECT_RESULT.parse({
      classification: "UNCERTAIN",
      occurredAt: "2026-11-27T12:00:00-05:00",
    });
    expect(effect.classification).toBe("UNCERTAIN");
    expect(() => FLOW_EFFECT_RESULT.parse({ classification: "MAYBE", occurredAt: "2026-11-27T12:00:00-05:00" })).toThrow();
  });
});

describe("contrato del motor de campañas (§9, clean-room)", () => {
  it("crea campaña con audiencia verificada, plantilla y ritmo", () => {
    const c = CAMPAIGN_CREATE.parse({
      organizationId: "org_4h5j6k",
      audience: { kind: "contactIds", contactIds: ["ct_1", "ct_2"] },
      template: { name: "recordatorio_cita", language: "es", variables: { fecha: "lunes" } },
      pacing: { perMinute: 30 },
      idempotencyKey: "camp-key-1",
    });
    expect(c.pacing.fairShare).toBe(true);
    expect(() =>
      CAMPAIGN_CREATE.parse({ ...c, audience: { kind: "contactIds" } }),
    ).toThrow();
  });

  it("la máquina de estados rechaza transiciones ilegales", () => {
    expect(canTransitionCampaign("queued", "running")).toBe(true);
    expect(canTransitionCampaign("running", "paused")).toBe(true);
    expect(canTransitionCampaign("paused", "running")).toBe(true);
    expect(canTransitionCampaign("running", "queued")).toBe(false);
    expect(canTransitionCampaign("cancelled", "running")).toBe(false);
    expect(canTransitionCampaign("completed", "running")).toBe(false);
  });

  it("declara los 7 estados del ciclo de vida", () => {
    expect([...CAMPAIGN_STATES]).toEqual([
      "queued",
      "running",
      "paused",
      "cancelling",
      "cancelled",
      "completed",
      "failed",
    ]);
  });

  it("los checks JIT son los 5 del contrato y el lock es fail-closed a 50 ms", () => {
    const r = JIT_CHECK_RESULT.parse({ check: "lock", status: "skip", code: "skipped_lock_unavailable", elapsedMs: 50 });
    expect(r.check).toBe("lock");
    expect(() => JIT_CHECK_RESULT.parse({ check: "marketing", status: "pass", elapsedMs: 1 })).toThrow();
    expect(LOCK_TIMEOUT_MS).toBe(50);
  });

  it("los resultados exigen auditLogExportable y contadores completos", () => {
    const res = CAMPAIGN_RESULTS.parse({
      campaignId: "cmp_1",
      organizationId: "org_4h5j6k",
      counters: { sent: 10, failed: 1, skipped: 2, pending: 0 },
      auditLogExportable: true,
    });
    expect(res.counters.sent).toBe(10);
    expect(res.items).toEqual([]);
    expect(() => CAMPAIGN_RESULTS.parse({ ...res, auditLogExportable: false })).toThrow();
  });
});

describe("API v1 comercial (§3)", () => {
  it("declara las 9 rutas v1 con sus scopes", () => {
    expect(V1_ROUTES).toHaveLength(9);
    const postContacts = V1_ROUTES.find((r) => r.method === "POST" && r.path === "/v1/contacts");
    expect(postContacts?.scope).toBe("operate");
    expect(postContacts?.requiresIdempotencyKey).toBe(true);
  });

  it("toda escritura exige Idempotency-Key", () => {
    for (const route of V1_ROUTES.filter((r) => r.method !== "GET")) {
      expect(route.requiresIdempotencyKey, route.path).toBe(true);
    }
  });

  it("el schema de tarea admite dueAt para seguimientos programados", () => {
    const t = TASK_CREATE.parse({ title: "Llamar a Laura", dueAt: "2026-11-30T10:00:00-05:00" });
    expect(t.dueAt).toBe("2026-11-30T10:00:00-05:00");
    expect(() => TASK_CREATE.parse({ title: "" })).toThrow();
  });

  it("execution-results conserva la traza con pasos y estados", () => {
    const e = EXECUTION_RESULT.parse({
      executionId: "ex_1",
      status: "waiting_approval",
      startedAt: "2026-11-27T12:00:00-05:00",
      finishedAt: null,
      steps: [{ seq: 0, tool: "crm.get_contact", status: "ok" }],
    });
    expect(e.steps[0]?.tool).toBe("crm.get_contact");
  });
});

describe("agenda y eventos (§10)", () => {
  it("conserva las 4 operaciones públicas de conectores", () => {
    expect([...AGENDA_CONNECTOR_OPS]).toEqual([
      "createMeeting",
      "rescheduleMeeting",
      "cancelMeeting",
      "health",
    ]);
  });

  it("los invariantes de agenda están activos (solo slots ofrecidos, linkPending)", () => {
    expect(AGENDA_INVARIANTS.onlyOfferedSlots).toBe(true);
    expect(AGENDA_INVARIANTS.neverConfirmExternalBookings).toBe(true);
    expect(AGENDA_INVARIANTS.linkPendingOnConnectorFailure).toBe(true);
    expect(AGENDA_INVARIANTS.uniqueSlotPerOrg).toBe(true);
  });

  it("el envelope de evento exige actor y organización", () => {
    const ev = EVENT_ENVELOPE.parse({
      eventId: "evt_1",
      organizationId: "org_4h5j6k",
      type: "crm.stage.changed",
      occurredAt: "2026-11-27T12:00:00-05:00",
      actor: "user:usr_1",
      payload: { leadId: "ld_1" },
    });
    expect(ev.type).toBe("crm.stage.changed");
    expect(() =>
      EVENT_ENVELOPE.parse({ ...ev, type: "evento.inexistente" }),
    ).toThrow();
  });
});
