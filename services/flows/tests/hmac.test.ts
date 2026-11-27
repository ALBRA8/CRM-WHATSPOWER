import { describe, expect, it } from "vitest";
import {
  SignatureError,
  isWithinTimestampWindow,
  signBridgePayload,
  verifyBridgeSignature,
} from "../src/hmac.js";
import { FLOW_INBOUND, CRM_ACTIONS } from "@vestro/contracts";

const SECRET = "secreto-puente";
const NOW = new Date("2026-11-27T12:00:00Z").getTime();

describe("firma de puente (CONTRATOS §8)", () => {
  it("firma y verifica un payload en ventana", () => {
    const ts = Math.floor(NOW / 1000);
    const body = JSON.stringify({ hello: "world" });
    const sig = signBridgePayload(body, ts, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(() => verifyBridgeSignature(body, ts, sig, SECRET, NOW)).not.toThrow();
  });

  it("rechaza timestamp fuera de la ventana ±300 s (anti-replay)", () => {
    const ts = Math.floor(NOW / 1000) - 301;
    const body = "x";
    const sig = signBridgePayload(body, ts, SECRET);
    expect(() =>
      verifyBridgeSignature(body, ts, sig, SECRET, NOW),
    ).toThrow(SignatureError);
    try {
      verifyBridgeSignature(body, ts, sig, SECRET, NOW);
    } catch (e) {
      expect((e as SignatureError).code).toBe("timestamp_out_of_window");
    }
  });

  it("acepta justo dentro de la ventana (299 s)", () => {
    const ts = Math.floor(NOW / 1000) - 299;
    const body = "x";
    const sig = signBridgePayload(body, ts, SECRET);
    expect(isWithinTimestampWindow(ts, NOW)).toBe(true);
    expect(() => verifyBridgeSignature(body, ts, sig, SECRET, NOW)).not.toThrow();
  });

  it("rechaza firma alterada en tiempo constante", () => {
    const ts = Math.floor(NOW / 1000);
    const sig = signBridgePayload("cuerpo-legitimo", ts, SECRET);
    const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    try {
      verifyBridgeSignature("cuerpo-legitimo", ts, tampered, SECRET, NOW);
      expect.unreachable("debía rechazar la firma alterada");
    } catch (e) {
      expect((e as SignatureError).code).toBe("bad_signature");
    }
  });

  it("fail-closed: sin secreto no firma ni verifica", () => {
    const ts = Math.floor(NOW / 1000);
    expect(() => signBridgePayload("x", ts, "")).toThrow(SignatureError);
    expect(() => verifyBridgeSignature("x", ts, "00", "", NOW)).toThrow(/fail-closed/);
  });

  it("rechaza firmas con longitud distinta (evita crash de timingSafeEqual)", () => {
    const ts = Math.floor(NOW / 1000);
    try {
      verifyBridgeSignature("x", ts, "corto", SECRET, NOW);
      expect.unreachable("debía rechazar");
    } catch (e) {
      expect((e as SignatureError).code).toBe("bad_signature");
    }
  });
});

describe("contratos heredados disponibles", () => {
  it("el inbound de flujos exige organización válida", () => {
    const inbound = FLOW_INBOUND.parse({
      organizationId: "org_4h5j6k",
      conversationId: "cv_1",
      contactIdentity: "573001112233",
      messageId: "msg_1",
      receivedAt: "2026-11-27T12:00:00-05:00",
      test: false,
    });
    expect(inbound.text).toBe("");
    expect(inbound.media).toEqual([]);
  });

  it("las 5 acciones comerciales siguen expuestas", () => {
    expect(CRM_ACTIONS).toHaveLength(5);
  });
});
