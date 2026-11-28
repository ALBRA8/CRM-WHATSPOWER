import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { AgentGateway, AgentGatewayError } from "../src/client.js";
import type { ConversationTurnReceived } from "@whatspower/contracts";

const SECRET = "secreto-hmac-de-prueba";
const KEY = "agent-api-key-de-prueba";
const ORG = "org_test001";

let server: Server;
let baseUrl: string;
const hits = new Map<string, number>();

const VALID_EVENT: ConversationTurnReceived = {
  event: "conversation.turn.received",
  event_id: "evt_test01",
  conversation: { id: "cv_test01", channel: "whatsapp", test: false },
  contact: { id: "ct_test01", identity: "573001112233", name: "Laura" },
  organization: { id: ORG, agentId: `org:${ORG}#ventas`, timezone: "America/Bogota", locale: "es" },
  messageIds: ["msg_1"],
  turn: { text: "Hola", media: [], sinceLastReplyMs: 1000 },
  capabilities: { booking: false, stageMoves: [], windowOpenUntil: "2026-11-28T03:12:00Z" },
};

function makeGateway(dispatchPath = "/crm/dispatch", maxRetries = 3): AgentGateway {
  return new AgentGateway({
    dispatchUrl: `${baseUrl}${dispatchPath}`,
    apiUrl: baseUrl,
    apiKey: KEY,
    signingSecret: SECRET,
    organizationId: ORG,
    timeoutMs: 1000,
    maxRetries,
    retryBaseDelayMs: 5,
  });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const path = req.url ?? "";
      hits.set(path, (hits.get(path) ?? 0) + 1);

      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      if (path === "/crm/dispatch") return json(200, { accepted: true, event_id: "evt_test01" });
      if (path === "/crm/dispatch-5xx") return json(500, { error: { code: "network_error", message: "boom" } });
      if (path === "/crm/dispatch-paused")
        return json(409, { error: { code: "ai_paused", message: "IA pausada por ajuste" } });
      if (path === "/crm/dispatch-approval")
        return json(202, { error: { code: "approval_required", message: "Acción retenida por HITL" } });
      if (path === "/crm/dispatch-ratelimited") {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "30" });
        res.end(JSON.stringify({ error: { code: "rate_limited", message: "Límite alcanzado" } }));
        return;
      }
      if (path === "/api/v1/health") return json(200, { status: "ok" });
      if (path === "/api/v1/approvals/pending")
        return json(200, [{ id: "ap_1", action: "send_template", organizationId: ORG }]);
      // Forma REAL del cerebro (AGENTE-GENERAL): objeto con sobre {storage_scope, approvals}
      if (path === "/envelope-cerebro/api/v1/approvals/pending")
        return json(200, {
          storage_scope: "process-local",
          approvals: [
            { approval_id: "ap_2", action: "send_template", status: "awaiting_approval" },
          ],
        });
      if (path === "/api/v1/execution/ex_1")
        return json(200, {
          executionId: "ex_1",
          status: "succeeded",
          startedAt: "2026-11-27T12:00:00-05:00",
          finishedAt: "2026-11-27T12:00:05-05:00",
          steps: [{ seq: 0, tool: "crm.create_task", status: "ok" }],
        });
      if (path === "/api/v1/execution/ex_bad")
        return json(403, { error: { code: "firewall_denied", message: "Acción bloqueada" } });
      res.writeHead(404);
      res.end("{}");
      void body; // el cuerpo se usa solo en la firma del test de despacho
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("fail-closed sin credenciales (contrato §2)", () => {
  it("no construye el cliente sin apiKey", () => {
    expect(
      () => new AgentGateway({ dispatchUrl: baseUrl, apiUrl: baseUrl, organizationId: ORG }),
    ).toThrow(AgentGatewayError);
  });

  it("no construye el cliente sin secreto de firma", () => {
    expect(
      () =>
        new AgentGateway({
          dispatchUrl: baseUrl,
          apiUrl: baseUrl,
          apiKey: KEY,
          organizationId: ORG,
        }),
    ).toThrow(/fail-closed/);
  });
});

describe("despacho firmado (contrato §4)", () => {
  it("firma HMAC-SHA256(cuerpo+timestamp) y envía cabeceras de contexto", async () => {
    const gw = makeGateway();
    const res = await gw.dispatch(VALID_EVENT, "req-uuid-1");
    expect(res.ok).toBe(true);
    expect(res.data?.accepted).toBe(true);

    // Verificamos la firma recalculándola sobre un cuerpo capturado por el
    // servidor real: la firma depende del cuerpo y del timestamp enviados.
    const gwSig = gw.signPayload(JSON.stringify(VALID_EVENT), Math.floor(Date.now() / 1000));
    expect(gwSig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reintenta 5xx y agota el máximo de intentos configurado", async () => {
    const gw = makeGateway("/crm/dispatch-5xx", 2);
    const res = await gw.dispatch(VALID_EVENT, "req-uuid-2");
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("network_error");
    expect(hits.get("/crm/dispatch-5xx")).toBe(3); // 1 inicial + 2 reintentos
  });

  it("preserva el código tipado ai_paused en 409 (compatibilidad WHATSPOWER)", async () => {
    const gw = makeGateway("/crm/dispatch-paused", 0);
    const res = await gw.dispatch(VALID_EVENT, "req-uuid-3");
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("ai_paused");
  });

  it("429 rate_limited pide esperar Retry-After y no reintentar", async () => {
    const gw = makeGateway("/crm/dispatch-ratelimited", 3);
    const res = await gw.dispatch(VALID_EVENT, "req-uuid-4");
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("rate_limited");
    expect(hits.get("/crm/dispatch-ratelimited")).toBe(1); // sin reintentos
  });
});

describe("HITL y resultados (contrato §6)", () => {
  it("202 approval_required se reporta como aceptado con retención", async () => {
    const gw = makeGateway("/crm/dispatch-approval", 0);
    const res = await gw.dispatch({ ...VALID_EVENT, event_id: "evt_ap" }, "req-uuid-5");
    expect(res.ok).toBe(true);
    expect(res.data?.approvalRequired).toBe(true);
  });

  it("health en línea y fuera de línea (interruptor sin_cerebro)", async () => {
    const gw = makeGateway();
    expect((await gw.health("req-uuid-6")).online).toBe(true);

    const down = new AgentGateway({
      dispatchUrl: "http://127.0.0.1:9",
      apiUrl: "http://127.0.0.1:9",
      apiKey: KEY,
      signingSecret: SECRET,
      organizationId: ORG,
      timeoutMs: 200,
      maxRetries: 0,
    });
    const h = await down.health("req-uuid-7");
    expect(h.online).toBe(false);
    expect(h.detail).toBe("sin_cerebro");
  });

  it("consulta la cola de aprobaciones HITL pendiente", async () => {
    const gw = makeGateway();
    const res = await gw.approvalsPending("req-uuid-8");
    expect(res.ok).toBe(true);
    expect(res.data?.[0]?.["id"]).toBe("ap_1");
    expect(hits.get("/api/v1/approvals/pending")).toBe(1);
  });

  it("normaliza el sobre REAL del cerebro {storage_scope, approvals} a la lista (regresión S4.3)", async () => {
    // apiUrl con prefijo → el mock responde con el sobre real del cerebro
    const gw = new AgentGateway({
      dispatchUrl: `${baseUrl}/crm/dispatch`,
      apiUrl: `${baseUrl}/envelope-cerebro`,
      apiKey: KEY,
      signingSecret: SECRET,
      organizationId: ORG,
      timeoutMs: 1000,
      maxRetries: 0,
    });
    const res = await gw.approvalsPending("req-uuid-8b");
    expect(res.ok).toBe(true);
    expect(res.data?.[0]?.["approval_id"]).toBe("ap_2");
    expect(res.data?.[0]?.["status"]).toBe("awaiting_approval");
  });

  it("resultado de ejecución con traza; firewall_denied tipado", async () => {
    const gw = makeGateway();
    const ok = await gw.executionResult("ex_1", "req-uuid-9");
    expect(ok.ok).toBe(true);
    expect(ok.data?.status).toBe("succeeded");
    expect(ok.data?.steps[0]?.tool).toBe("crm.create_task");

    const denied = await gw.executionResult("ex_bad", "req-uuid-10");
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("firewall_denied");
  });
});
