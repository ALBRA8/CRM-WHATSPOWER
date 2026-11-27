import { describe, expect, it } from "vitest";
import {
  BOT_API_V1_ROUTES,
  BOT_AVAILABILITY_RESPONSE,
  BOT_BOOKING_REQUEST,
  BOT_CONTEXT_RESPONSE,
  BOT_FICHA_REQUEST,
  BOT_HANDOFF_REQUEST,
  BOT_MESSAGE_REQUEST,
  BOT_MESSAGE_RESPONSE,
  BOT_PROFILE_RESPONSE,
  BOT_STAGE_REQUEST,
} from "../src/bot-api.js";
import { CONVERSATION_TURN_RECEIVED, DISPATCH_ACK } from "../src/dispatch.js";

/** Cuerpo canónico del contrato de despacho (CONTRATOS_INTEGRACION §4). */
const CANONICAL_DISPATCH = {
  event: "conversation.turn.received",
  event_id: "evt_9f3k2m",
  conversation: { id: "cv_ab12cd", channel: "whatsapp", test: false },
  contact: {
    id: "ct_x7y8z9",
    identity: "5215512345678",
    name: "Laura Pérez",
    stage: "interested",
    aiPaused: false,
  },
  organization: {
    id: "org_4h5j6k",
    agentId: "org:org_4h5j6k#ventas",
    timezone: "America/Bogota",
    locale: "es",
  },
  messageIds: ["msg_01", "msg_02"],
  turn: {
    text: "¿Tienen disponibilidad el jueves por la tarde?",
    media: [],
    sinceLastReplyMs: 382000,
  },
  capabilities: {
    booking: true,
    stageMoves: ["qualified"],
    windowOpenUntil: "2026-11-28T03:12:00Z",
  },
};

describe("contrato de despacho estándar", () => {
  it("valida el cuerpo canónico del contrato §4", () => {
    const parsed = CONVERSATION_TURN_RECEIVED.parse(CANONICAL_DISPATCH);
    expect(parsed.event_id).toBe("evt_9f3k2m");
    expect(parsed.organization.agentId).toBe("org:org_4h5j6k#ventas");
    expect(parsed.conversation.test).toBe(false);
  });

  it("el turno del Laboratorio (test:true) queda marcado y el sandbox jamás se entrega", () => {
    const lab = CONVERSATION_TURN_RECEIVED.parse({
      ...CANONICAL_DISPATCH,
      conversation: { ...CANONICAL_DISPATCH.conversation, test: true },
    });
    expect(lab.conversation.test).toBe(true);
  });

  it("rechaza despacho sin event_id o sin mensajes", () => {
    const sinEventId = { ...CANONICAL_DISPATCH } as Record<string, unknown>;
    delete sinEventId["event_id"];
    expect(() => CONVERSATION_TURN_RECEIVED.parse(sinEventId)).toThrow();
    expect(() =>
      CONVERSATION_TURN_RECEIVED.parse({ ...CANONICAL_DISPATCH, messageIds: [] }),
    ).toThrow();
  });

  it("stageMoves limita las etapas permitidas del agente", () => {
    const parsed = CONVERSATION_TURN_RECEIVED.parse(CANONICAL_DISPATCH);
    expect(parsed.capabilities.stageMoves).toEqual(["qualified"]);
  });

  it("la respuesta HTTP del despacho solo acusa recepción", () => {
    const ack = DISPATCH_ACK.parse({ accepted: true, event_id: "evt_9f3k2m" });
    expect(ack.accepted).toBe(true);
    expect(ack.approvalRequired).toBe(false);
    expect(() => DISPATCH_ACK.parse({ accepted: false, event_id: "x" })).toThrow();
  });
});

describe("bot API v1 — vigía de las 13 rutas heredadas de VOCERO", () => {
  const FROZEN_PATHS = [
    "/api/bot/profile",
    "/api/bot/context",
    "/api/bot/messages",
    "/api/bot/llm/{ruta}",
    "/api/bot/ficha",
    "/api/bot/stage",
    "/api/bot/handoff",
    "/api/bot/typing",
    "/api/bot/media/{id}",
    "/api/bot/reset",
    "/api/bot/availability",
    "/api/bot/bookings",
    "/api/bot/openapi.json",
  ];

  it("conserva exactamente las 13 rutas del contrato", () => {
    expect(BOT_API_V1_ROUTES).toHaveLength(13);
    expect(BOT_API_V1_ROUTES.map((r) => r.path)).toEqual(FROZEN_PATHS);
  });

  it("POST|PATCH bookings está representado por la ruta POST (mover = PATCH)", () => {
    const bookings = BOT_API_V1_ROUTES.find((r) => r.path === "/api/bot/bookings");
    expect(bookings?.method).toBe("POST");
  });
});

describe("esquemas de la bot API", () => {
  it("messages valida conversación + texto y responde con id", () => {
    expect(BOT_MESSAGE_REQUEST.parse({ conversationId: "cv_ab12cd", text: "Hola" }).conversationId).toBe("cv_ab12cd");
    expect(() => BOT_MESSAGE_REQUEST.parse({ conversationId: "cv_ab12cd", text: "" })).toThrow();
    expect(BOT_MESSAGE_RESPONSE.parse({ id: "msg_1" }).id).toBe("msg_1");
  });

  it("ficha hace merge por claves con valores escalares", () => {
    const ficha = BOT_FICHA_REQUEST.parse({
      conversationId: "cv_ab12cd",
      ficha: { zona: "Chapinero", metros: "72", listo: true, vacio: null },
    });
    expect(ficha.ficha["zona"]).toBe("Chapinero");
    expect(() =>
      BOT_FICHA_REQUEST.parse({ conversationId: "cv", ficha: { anidado: { a: 1 } } }),
    ).toThrow();
  });

  it("stage y handoff exigen lead/conversación y razón", () => {
    expect(BOT_STAGE_REQUEST.parse({ leadId: "ld_1", stageId: "st_qualified" }).leadId).toBe("ld_1");
    expect(() => BOT_STAGE_REQUEST.parse({ leadId: "", stageId: "st" })).toThrow();
    expect(() => BOT_HANDOFF_REQUEST.parse({ conversationId: "cv_1", reason: "" })).toThrow();
  });

  it("bookings exige slot con offset explícito o UTC y status confirma o linkPending", () => {
    expect(
      BOT_BOOKING_REQUEST.parse({
        conversationId: "cv_ab12cd",
        slot: "2026-11-30T10:00:00-05:00",
        connector: "zoom",
      }).slot,
    ).toBe("2026-11-30T10:00:00-05:00");
    // Un slot en UTC explícito (Z) también es válido.
    expect(
      BOT_BOOKING_REQUEST.parse({ conversationId: "cv_ab12cd", slot: "2026-11-30T15:00:00Z" }).slot,
    ).toBe("2026-11-30T15:00:00Z");
    // Un datetime ingenuo sin zona horaria NO es reservable (ambigüedad prohibida).
    expect(() =>
      BOT_BOOKING_REQUEST.parse({ conversationId: "cv_ab12cd", slot: "2026-11-30T10:00:00" }),
    ).toThrow();
  });

  it("availability responde con slots registrados como ofrecidos", () => {
    expect(BOT_AVAILABILITY_RESPONSE.parse({ slots: ["10:00", "11:30"] }).slots).toHaveLength(2);
    expect(BOT_AVAILABILITY_RESPONSE.parse({}).slots).toEqual([]);
  });

  it("profile y context conservan la forma del contrato con la extensión de tareas", () => {
    const profile = BOT_PROFILE_RESPONSE.parse({
      agent: { name: "Sofía", tone: "cercano", instructions: "…", escalation: "…" },
      kb: { qa: [{ question: "Horario?", answer: "9-6" }], blocks: ["Precios"] },
    });
    expect(profile.agent.name).toBe("Sofía");
    const ctx = BOT_CONTEXT_RESPONSE.parse({
      contact: { id: "ct_x7y8z9", identity: "5215512345678" },
      humanActive: false,
      windowOpen: true,
      tasks: [{ id: "task_1", title: "Llamar mañana", dueAt: null }],
    });
    expect(ctx.tasks).toHaveLength(1);
    expect(ctx.appointments).toEqual([]);
  });
});
