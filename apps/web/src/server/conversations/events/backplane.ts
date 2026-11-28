import postgres from "postgres";
import { gzipSync, gunzipSync } from "node:zlib";
import type { SseEvent } from "./types";

/**
 * Backplane SSE para varias instancias (F5 — riesgo A1 heredado de S4.3).
 *
 * Hoy el bus de eventos es in-process (EventEmitter): correcto mientras el CRM
 * corre en UNA instancia, insuficiente en producción con N instancias (el
 * webhook entra por la instancia A y la sesión SSE vive en la B → el navegador
 * de B nunca entera).
 *
 * Diseño (Constitución II — sin servicios nuevos): LISTEN/NOTIFY de la MISMA
 * PostgreSQL. Publicar por `pg_notify` y recibir con una conexión dedicada
 * `LISTEN whatspower_sse` por instancia; lo recibido se re-emite en el bus local.
 * Con el backplane encendido, `publish()` NO emite localmente: la propia
 * instancia publicadora recibe su evento por LISTEN como cualquier otra, así
 * cada evento llega EXACTAMENTE una vez por instancia.
 *
 * `SSE_BACKPLANE=off` (default) conserva byte-a-byte el comportamiento de
 * S4.3/S4.4 (una instancia = EventEmitter): cero riesgo para lo verificado.
 *
 * Límite duro de PostgreSQL: un payload de NOTIFY cabe en 8000 bytes. Los
 * eventos que excedan 7900 tras serializar se comprimen (gzip + base64, el
 * texto de mensajes comprime bien); si AÚN así no caben, el evento se entrega
 * solo en la instancia publicadora y se registra el fallo — el cliente SSE
 * hace catch-up con `since=` (contrato sse.md), así que lo perdido se
 * recupera, no se corrompe. Igual que `/api/health`, aquí se lee
 * `process.env` directo: el estado del backplane nunca depende de la
 * validación del entorno completo (mal escrito, el CRM sigue levantando).
 */

const CHANNEL = "whatspower_sse";
/** Límite de seguridad bajo el máximo de 8000 bytes de pg_notify. */
const NOTIFY_LIMIT = 7_900;

export type BackplaneMode = "off" | "postgres";

export type BackplaneStatus = {
  mode: BackplaneMode;
  /** null cuando el modo es off (no hay conexión que observar). */
  connected: boolean | null;
  notified: number;
  received: number;
  droppedOversize: number;
  lastError: string | null;
  connectedAt: string | null;
};

export function backplaneMode(): BackplaneMode {
  return process.env.SSE_BACKPLANE?.trim().toLowerCase() === "postgres"
    ? "postgres"
    : "off";
}

type BackplaneState = {
  sql: ReturnType<typeof postgres> | null;
  listening: boolean;
  starting: Promise<void> | null;
  retryTimer: NodeJS.Timeout | null;
  retries: number;
  status: BackplaneStatus;
};

const globalForBackplane = globalThis as unknown as {
  __whatspowerSseBackplane?: BackplaneState;
};

function state(): BackplaneState {
  if (!globalForBackplane.__whatspowerSseBackplane) {
    globalForBackplane.__whatspowerSseBackplane = {
      sql: null,
      listening: false,
      starting: null,
      retryTimer: null,
      retries: 0,
      status: {
        mode: backplaneMode(),
        connected: null,
        notified: 0,
        received: 0,
        droppedOversize: 0,
        lastError: null,
        connectedAt: null,
      },
    };
  }
  return globalForBackplane.__whatspowerSseBackplane;
}

export function backplaneStatus(): BackplaneStatus {
  const s = state();
  return { ...s.status, mode: backplaneMode() };
}

/** URL de BD para el backplane: runtime si existe, si no la principal. */
function backplaneUrl(): string | null {
  return (
    process.env.DATABASE_URL_RUNTIME?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

/**
 * Arranca (una sola vez por proceso) la conexión LISTEN. Idempotente y con
 * reintento exponencial: si la BD aún no responde al boot, el CRM arranca
 * igual y el backplane se conecta cuando pueda.
 */
export function ensureBackplane(
  onEvent: (organizationId: string, event: SseEvent) => void
): Promise<void> {
  const s = state();
  if (s.listening) return Promise.resolve();
  if (s.starting) return s.starting;

  const start = async () => {
    const url = backplaneUrl();
    if (!url) {
      s.status.lastError = "sin DATABASE_URL: backplane no arrancado";
      return;
    }
    try {
      const sql = s.sql ?? postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
      s.sql = sql;
      await sql.listen(CHANNEL, (payload) => {
        try {
          const { orgId, event } = decodePayload(payload);
          s.status.received += 1;
          onEvent(orgId, event);
        } catch (e) {
          s.status.lastError = `payload inválido: ${String(e).slice(0, 120)}`;
        }
      });
      s.listening = true;
      s.retries = 0;
      s.status.connected = true;
      s.status.connectedAt = new Date().toISOString();
      s.status.lastError = null;
    } catch (e) {
      s.status.connected = false;
      s.status.lastError = String(e).slice(0, 200);
      programarReintento(onEvent);
    }
  };

  s.starting = start().finally(() => {
    s.starting = null;
  });
  return s.starting;
}

/**
 * Cierra la conexión LISTEN y limpia el estado (graceful shutdown y pruebas).
 * Idempotente: si no hay backplane, no hace nada.
 */
export async function stopBackplane(): Promise<void> {
  const s = state();
  if (s.retryTimer) {
    clearTimeout(s.retryTimer);
    s.retryTimer = null;
  }
  const sql = s.sql;
  if (sql) {
    try {
      await sql.end({ timeout: 1 });
    } catch {
      // la conexión ya estaba muerta: eso es lo que se cerraba
    }
  }
  delete (globalThis as unknown as Record<string, unknown>).__whatspowerSseBackplane;
}

function programarReintento(onEvent: (organizationId: string, event: SseEvent) => void) {
  const s = state();
  if (s.retryTimer) return;
  const espera = Math.min(30_000, 500 * 2 ** Math.min(s.retries, 6));
  s.retries += 1;
  s.retryTimer = setTimeout(() => {
    s.retryTimer = null;
    s.listening = false;
    void ensureBackplane(onEvent);
  }, espera);
  s.retryTimer.unref?.();
}

/**
 * Si el proceso ya tenía el LISTEN y la conexión murió, el siguiente
 * `ensureBackplane` lo detecta por `listening` — pero nadie lo llama de
 * nuevo salvo un subscribe posterior. La reconexión automática corre en un
 * intervalo ligero SOLO cuando el modo está encendido y no hay conexión.
 */
export function watchBackplane(onEvent: (organizationId: string, event: SseEvent) => void): void {
  const s = state();
  if (backplaneMode() !== "postgres") return;
  if (s.retryTimer) return;
  const t = setInterval(() => {
    if (!s.listening) void ensureBackplane(onEvent);
  }, 5_000);
  t.unref?.();
}

function encodePayload(organizationId: string, event: SseEvent): string | null {
  const plano = JSON.stringify({ orgId: organizationId, event });
  if (Buffer.byteLength(plano) <= NOTIFY_LIMIT) return plano;
  const comprimido = zlibDeflate(plano);
  if (comprimido && Buffer.byteLength(comprimido) <= NOTIFY_LIMIT) return comprimido;
  return null;
}

function decodePayload(payload: string): { orgId: string; event: SseEvent } {
  if (payload.startsWith("gz:")) {
    const plano = zlibInflate(payload.slice(3));
    return JSON.parse(plano);
  }
  return JSON.parse(payload);
}

function zlibDeflate(texto: string): string | null {
  try {
    return "gz:" + gzipSync(Buffer.from(texto, "utf8")).toString("base64");
  } catch {
    return null;
  }
}

function zlibInflate(b64: string): string {
  return gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

/**
 * Publica el evento por el backplane. Devuelve true si quedó en cola de
 * PostgreSQL; false si no hay conexión o el payload excede el límite (en ese
 * caso el llamador decide el reparto local de respaldo).
 */
export async function notifyBackplane(
  organizationId: string,
  event: SseEvent
): Promise<boolean> {
  const s = state();
  const payload = encodePayload(organizationId, event);
  if (!payload) {
    s.status.droppedOversize += 1;
    return false;
  }
  // Sin LISTEN establecido, un NOTIFY no lo recibiría nadie: el llamador
  // reparte localmente (respaldo) en lugar de dejar el evento huérfano.
  if (!s.listening || !s.sql) return false;
  const sql = s.sql;
  try {
    await sql`SELECT pg_notify(${CHANNEL}, ${payload})`;
    s.status.notified += 1;
    return true;
  } catch (e) {
    s.status.connected = false;
    s.status.lastError = `pg_notify: ${String(e).slice(0, 150)}`;
    return false;
  }
}
