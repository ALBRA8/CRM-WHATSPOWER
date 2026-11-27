/**
 * Firma HMAC de los puentes CRM ↔ flujos/campañas.
 *
 * Contrato: CONTRATOS_INTEGRACION.md §8 y §9. Herencia de los puentes probados
 * del ecosistema: fail-closed sin secreto; X-Timestamp con ventana ±300 s;
 * verificación en tiempo constante (timing-safe).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { HMAC_TIMESTAMP_TOLERANCE_SECONDS } from "@vestro/contracts";

export class SignatureError extends Error {
  readonly code: "missing_secret" | "timestamp_out_of_window" | "bad_signature";

  constructor(code: "missing_secret" | "timestamp_out_of_window" | "bad_signature", message: string) {
    super(message);
    this.name = "SignatureError";
    this.code = code;
  }
}

/** Firma el cuerpo con el secreto del puente: HMAC-SHA256(cuerpo + timestamp). */
export function signBridgePayload(body: string, timestamp: number, secret: string): string {
  if (!secret) {
    throw new SignatureError("missing_secret", "Sin secreto del puente: fail-closed");
  }
  return createHmac("sha256", secret).update(`${body}${timestamp}`).digest("hex");
}

/** La ventana ±300 s del contrato; utilizable con un reloj inyectado para pruebas. */
export function isWithinTimestampWindow(
  timestampSeconds: number,
  nowMs: number = Date.now(),
): boolean {
  const delta = Math.abs(nowMs / 1000 - timestampSeconds);
  return delta <= HMAC_TIMESTAMP_TOLERANCE_SECONDS;
}

/** Verifica firma en tiempo constante (evita comparaciones vulnerables). */
export function verifyBridgeSignature(
  body: string,
  timestampSeconds: number,
  receivedSignature: string,
  secret: string,
  nowMs: number = Date.now(),
): void {
  if (!secret) {
    throw new SignatureError("missing_secret", "Sin secreto del puente: fail-closed");
  }
  if (!isWithinTimestampWindow(timestampSeconds, nowMs)) {
    throw new SignatureError(
      "timestamp_out_of_window",
      `X-Timestamp fuera de la ventana de ±${HMAC_TIMESTAMP_TOLERANCE_SECONDS} s`,
    );
  }
  const expected = signBridgePayload(body, timestampSeconds, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(receivedSignature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new SignatureError("bad_signature", "Firma HMAC inválida");
  }
}
