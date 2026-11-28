import { EventEmitter } from "node:events";
import {
  backplaneMode,
  ensureBackplane,
  notifyBackplane,
  watchBackplane,
} from "./backplane";
import type { SseEvent } from "./types";

export type { SseEvent };

/**
 * Bus de eventos por organización (contrato sse.md).
 * Publicar SIEMPRE después del commit de BD.
 *
 * Transporte: en `SSE_BACKPLANE=off` (default, comportamiento de S4.3/S4.4)
 * los eventos van por EventEmitter in-process — una instancia = un proceso.
 * En `SSE_BACKPLANE=postgres` (F5, riesgo A1) `publish()` atraviesa instancias
 * vía LISTEN/NOTIFY y cada instancia re-emite localmente lo que recibe: el
 * publicador también recibe su propio evento por LISTEN, así el reparto es
 * exactamente una vez por instancia (ver backplane.ts).
 */

const globalForBus = globalThis as unknown as { __whatspowerBus?: EventEmitter };

function getBus(): EventEmitter {
  if (!globalForBus.__whatspowerBus) {
    const bus = new EventEmitter();
    bus.setMaxListeners(200);
    globalForBus.__whatspowerBus = bus;
  }
  return globalForBus.__whatspowerBus;
}

export function publish(organizationId: string, event: SseEvent): void {
  if (backplaneMode() === "postgres") {
    // Atraviesa instancias: pg_notify y el LISTEN local lo re-emite.
    // Si la conexión aún no está, este mismo proceso se la da al listener
    // de respaldo para no perder el evento del commit que acaba de confirmar.
    void notifyBackplane(organizationId, event).then((enCola) => {
      if (!enCola) emitLocal(organizationId, event);
    });
    return;
  }
  emitLocal(organizationId, event);
}

function emitLocal(organizationId: string, event: SseEvent): void {
  getBus().emit(`org:${organizationId}`, event);
}

function reemitirDesdeBackplane(organizationId: string, event: SseEvent): void {
  emitLocal(organizationId, event);
}

export function subscribe(
  organizationId: string,
  listener: (event: SseEvent) => void
): () => void {
  if (backplaneMode() === "postgres") {
    // Garantiza un LISTEN por proceso; el vigía reconecta si la BD cayó.
    void ensureBackplane(reemitirDesdeBackplane);
    watchBackplane(reemitirDesdeBackplane);
  }
  const bus = getBus();
  const channel = `org:${organizationId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
