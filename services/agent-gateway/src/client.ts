/**
 * Cliente hacia AGENTE-GENERAL (únicobro cerebro — D-003).
 *
 * Contrato: CONTRATOS_INTEGRACION.md §2 (firma), §4 (despacho), §6 (HITL y
 * resultados). Esquema del puente heredado de CRM-ALBRA→agente:
 *   Authorization: Bearer AGENT_API_KEY
 *   X-Signature:  HMAC-SHA256(cuerpo + timestamp, secreto)
 *   X-Timestamp:  unix
 *   X-Org-Id:     organizationId
 *
 * Reglas:
 * - Fail-closed sin clave: no se firma, no se envía.
 * - El agente NO recibe credenciales de BD ni del canal.
 * - Health check para el interruptor de IA (`sin_cerebro` si no hay agente).
 * - El despacho reintenta; sin respuesta tras 3 intentos → red de seguridad humana.
 */

import { createHmac } from "node:crypto";
import {
  API_ERROR_ENVELOPE,
  CONVERSATION_TURN_RECEIVED,
  CONTEXT_HEADER_NAMES,
  EXECUTION_RESULT,
  type ConversationTurnReceived,
  type DispatchAck,
  type ErrorCode,
  type EventEnvelope,
  type ExecutionResult,
} from "@vestro/contracts";

export interface AgentGatewayConfig {
  /** URL COMPLETA del endpoint de despacho ({AGENT_DISPATCH_URL}/crm/dispatch, §4). */
  dispatchUrl: string;
  /** URL base de la API del agente ({AGENT_API}); sobre ella se componen /api/v1/*. */
  apiUrl: string;
  /** Clave Bearer compartida. Sin ella: fail-closed. */
  apiKey?: string;
  /** Secreto HMAC para X-Signature. Sin él: fail-closed. */
  signingSecret?: string;
  organizationId: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export class AgentGatewayError extends Error {
  readonly code: ErrorCode | "network_error" | "sin_cerebro";
  readonly httpStatus?: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode | "network_error" | "sin_cerebro",
    message: string,
    options?: { httpStatus?: number; details?: unknown },
  ) {
    super(message);
    this.name = "AgentGatewayError";
    this.code = code;
    if (options?.httpStatus !== undefined) this.httpStatus = options.httpStatus;
    if (options?.details !== undefined) this.details = options.details;
  }
}

export interface AgentGatewayResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: ErrorCode | "network_error"; message: string; details?: unknown };
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export class AgentGateway {
  private readonly cfg: Required<
    Pick<AgentGatewayConfig, "timeoutMs" | "maxRetries" | "retryBaseDelayMs">
  > & { apiKey: string; signingSecret: string } & AgentGatewayConfig;

  constructor(config: AgentGatewayConfig) {
    if (!config.apiKey || !config.signingSecret) {
      // Fail-closed: sin credenciales el adaptador no se construye.
      throw new AgentGatewayError(
        "sin_cerebro",
        "AGENT_API_KEY / secreto HMAC ausentes: el adaptador no envía nada (fail-closed)",
      );
    }
    this.cfg = {
      ...config,
      apiKey: config.apiKey,
      signingSecret: config.signingSecret,
      timeoutMs: config.timeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 100,
    };
  }

  /** Firma un cuerpo: HMAC-SHA256(cuerpo + timestamp, secreto). */
  signPayload(body: string, timestamp: number): string {
    return createHmac("sha256", this.cfg.signingSecret)
      .update(`${body}${timestamp}`)
      .digest("hex");
  }

  private buildHeaders(body: string, requestId: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.cfg.apiKey}`,
      [CONTEXT_HEADER_NAMES.orgId]: this.cfg.organizationId,
      [CONTEXT_HEADER_NAMES.requestId]: requestId,
      [CONTEXT_HEADER_NAMES.timestamp]: String(timestamp),
      [CONTEXT_HEADER_NAMES.signature]: this.signPayload(body, timestamp),
    };
  }

  private async request(
    url: string,
    init: { method: "GET" | "POST"; body?: string; requestId: string },
  ): Promise<{ status: number; json: unknown }> {
    if (!this.cfg.apiKey) {
      throw new AgentGatewayError("sin_cerebro", "Sin clave de agente (fail-closed)");
    }
    const headers = this.buildHeaders(init.body ?? "", init.requestId);
    let lastNetworkError: unknown;
    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: init.method,
          headers,
          ...(init.body !== undefined ? { body: init.body } : {}),
          signal: AbortSignal.timeout(this.cfg.timeoutMs),
        });
        const json: unknown = await res.json().catch(() => undefined);
        // 5xx transportable → reintento; el resto se clasifica una vez.
        if (RETRYABLE_STATUS.has(res.status) && attempt < this.cfg.maxRetries) {
          await sleep(this.cfg.retryBaseDelayMs * 2 ** attempt);
          continue;
        }
        return { status: res.status, json };
      } catch (err) {
        lastNetworkError = err;
        if (attempt < this.cfg.maxRetries) {
          await sleep(this.cfg.retryBaseDelayMs * 2 ** attempt);
          continue;
        }
      }
    }
    throw new AgentGatewayError("network_error", "Sin respuesta del agente tras reintentos", {
      details: String(lastNetworkError),
    });
  }

  private classifyFailure(status: number, json: unknown): AgentGatewayError {
    const parsed = API_ERROR_ENVELOPE.safeParse(json);
    if (parsed.success) {
      const err = parsed.data.error;
      return new AgentGatewayError(err.code as ErrorCode, err.message, {
        httpStatus: status,
        details: err.details,
      });
    }
    return new AgentGatewayError("network_error", `Respuesta no tipada del agente (HTTP ${status})`, {
      httpStatus: status,
    });
  }

  /**
   * Operación 1 del catálogo: despachar el turno de conversación al agente.
   * El CRM no espera la respuesta del agente por esta vía: el ACK solo acusa
   * recepción; el agente responde por la bot API.
   */
  async dispatch(
    event: ConversationTurnReceived,
    requestId: string,
  ): Promise<AgentGatewayResult<DispatchAck>> {
    const body = CONVERSATION_TURN_RECEIVED.parse(event);
    const { status, json } = await this.request(this.cfg.dispatchUrl, {
      method: "POST",
      body: JSON.stringify(body),
      requestId,
    });
    if (status === 429) {
      return {
        ok: false,
        status,
        error: { code: "rate_limited", message: "Límite alcanzado; esperar Retry-After" },
      };
    }
    if (status >= 400 || status === 202) {
      const err = this.classifyFailure(status, json);
      // 202 = approval_required (HITL): el despacho se acepta con retención.
      if (err.code === "approval_required") {
        return { ok: true, status, data: { accepted: true, event_id: body.event_id, approvalRequired: true } };
      }
      return {
        ok: false,
        status,
        error: { code: err.code, message: err.message, details: err.details },
      };
    }
    const parsed = API_ERROR_ENVELOPE.safeParse(json);
    if (parsed.success) {
      return { ok: false, status, error: { code: parsed.data.error.code as ErrorCode, message: parsed.data.error.message } };
    }
    // ACK simple aceptado (puede venir sin envelope si el agente confirma directo).
    return {
      ok: true,
      status,
      data: { accepted: true, event_id: body.event_id, approvalRequired: false },
    };
  }

  /** Health del agente (interruptor de IA: `sin_cerebro` si no responde). */
  async health(requestId: string): Promise<{ online: boolean; detail?: string }> {
    try {
      const { status } = await this.request(`${this.cfg.apiUrl}/api/v1/health`, {
        method: "GET",
        requestId,
      });
      return { online: status >= 200 && status < 300, detail: `HTTP ${status}` };
    } catch {
      return { online: false, detail: "sin_cerebro" };
    }
  }

  /** §6.2: cola de aprobaciones pendientes (HITL visible en el CRM). */
  async approvalsPending(
    requestId: string,
  ): Promise<AgentGatewayResult<Array<Record<string, unknown>>>> {
    const { status, json } = await this.request(`${this.cfg.apiUrl}/api/v1/approvals/pending`, {
      method: "GET",
      requestId,
    });
    if (status >= 400) {
      const err = this.classifyFailure(status, json);
      return { ok: false, status, error: { code: err.code, message: err.message } };
    }
    return { ok: true, status, data: (json as Array<Record<string, unknown>>) ?? [] };
  }

  /** §3 operación 15: resultado de una ejecución con traza. */
  async executionResult(
    executionId: string,
    requestId: string,
  ): Promise<AgentGatewayResult<ExecutionResult>> {
    const { status, json } = await this.request(
      `${this.cfg.apiUrl}/api/v1/execution/${encodeURIComponent(executionId)}`,
      { method: "GET", requestId },
    );
    if (status >= 400) {
      const err = this.classifyFailure(status, json);
      return { ok: false, status, error: { code: err.code, message: err.message } };
    }
    return { ok: true, status, data: EXECUTION_RESULT.parse(json) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { EventEnvelope };
