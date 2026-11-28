import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { publish, subscribe, type SseEvent } from "@/server/conversations/events/bus";
import {
  backplaneStatus,
  stopBackplane,
} from "@/server/conversations/events/backplane";

/**
 * F5 — Backplane SSE (riesgo A1). Contrato:
 *  - `SSE_BACKPLANE=off` (default): comportamiento de S4.3/S4.4 intacto,
 *    entrega local inmediata.
 *  - `SSE_BACKPLANE=postgres`: los eventos atraviesan instancias vía
 *    LISTEN/NOTIFY de la MISMA PostgreSQL. La prueba real simula la INSTANCIA
 *    B con un cliente postgres.js aparte que hace `pg_notify`: si este
 *    proceso (instancia A) recibe el evento por su LISTEN y lo re-emite en el
 *    bus local, el transporte multi-instancia queda demostrado contra un
 *    servidor real — sin mocks.
 *
 * Sin DATABASE_URL (CI sin BD) las pruebas de servidor real se saltan y la
 * suite sigue verde; la corrida F5 las ejecuta contra PostgreSQL 16.16 real.
 */

const CON_DB = !!process.env.DATABASE_URL;

function limpiarEstadoGlobal() {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.__whatspowerBus;
  delete g.__whatspowerSseBackplane;
}

beforeEach(() => {
  limpiarEstadoGlobal();
  delete process.env.SSE_BACKPLANE;
});

afterEach(async () => {
  // cierra la conexión LISTEN del caso anterior: sin esto, dos conexiones
  // escucharían el mismo canal y cada evento llegaría duplicado.
  await stopBackplane();
});

afterAll(async () => {
  limpiarEstadoGlobal();
  delete process.env.SSE_BACKPLANE;
});

describe("bus SSE — modo off (comportamiento conservado)", () => {
  it("publish entrega localmente e inmediatamente a los suscriptores de la org", () => {
    const recibidos: SseEvent[] = [];
    const otros: SseEvent[] = [];
    const baja = subscribe("org_off_a", (e) => recibidos.push(e));
    const bajaOtra = subscribe("org_off_b", (e) => otros.push(e));

    publish("org_off_a", {
      type: "message.new",
      data: { conversationId: "cv_1", message: { id: "m1" } },
    });

    expect(recibidos).toHaveLength(1);
    expect(recibidos[0]!.type).toBe("message.new");
    expect(otros).toHaveLength(0); // el canal de otra org no se cruza

    baja();
    bajaOtra();
    expect(backplaneStatus().mode).toBe("off");
    expect(backplaneStatus().connected).toBeNull();
  });

  it("unsubscribe deja de entregar (contrato del bus)", () => {
    const recibidos: SseEvent[] = [];
    const baja = subscribe("org_off_c", (e) => recibidos.push(e));
    baja();
    publish("org_off_c", {
      type: "note.new",
      data: { conversationId: "cv_2", note: { id: "n1" } },
    });
    expect(recibidos).toHaveLength(0);
  });
});

describe.skipIf(!CON_DB)(
  "backplane SSE postgres — transporte real entre instancias (F5)",
  () => {
    let sqlB: ReturnType<typeof postgres> | null = null;

    afterAll(async () => {
      if (sqlB) await sqlB.end({ timeout: 1 });
    });

    it("un pg_notify de OTRA instancia llega al suscriptor local (LISTEN real)", async () => {
      process.env.SSE_BACKPLANE = "postgres";
      const recibidos: SseEvent[] = [];
      const baja = subscribe("org_bp_a", (e) => recibidos.push(e));

      // instancia "B": un cliente aparte, notifica por pg_notify sin tocar el
      // bus local de este proceso — como haría el webhook en otra instancia.
      sqlB = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
      const evento: SseEvent = {
        type: "message.new",
        data: { conversationId: "cv_bp", message: { id: "m_bp", texto: "hola" } },
      };
      await sqlB`SELECT pg_notify('whatspower_sse', ${JSON.stringify({
        orgId: "org_bp_a",
        event: evento,
      })})`;

      await vi.waitFor(
        () => expect(recibidos).toHaveLength(1),
        { timeout: 5_000, interval: 50 }
      );
      expect(recibidos[0]!.type).toBe("message.new");
      const mensaje = recibidos[0]!.data as { message: { id: string } };
      expect(mensaje.message.id).toBe("m_bp");
      baja();
    });

    it("publish() con backplane encendido notifica y la instancia vuelve a recibir su evento (exactamente una vez)", async () => {
      process.env.SSE_BACKPLANE = "postgres";
      const { publish: publishConBackplane } = await import(
        "@/server/conversations/events/bus"
      );

      const recibidos: SseEvent[] = [];
      const baja = subscribe("org_bp_b", (e) => recibidos.push(e));

      // espera a que el LISTEN de esta instancia esté arriba
      await vi.waitFor(
        () => expect(backplaneStatus().connected).toBe(true),
        { timeout: 5_000, interval: 50 }
      );

      publishConBackplane("org_bp_b", {
        type: "conversation.updated",
        data: { conversation: { id: "cv_bp_b" } },
      });
      await vi.waitFor(
        () => expect(recibidos).toHaveLength(1),
        { timeout: 5_000, interval: 50 }
      );
      // sin duplicados: el publicador NO emite localmente cuando el backplane
      // está arriba — la re-emisión viene SOLO del LISTEN.
      await new Promise((r) => setTimeout(r, 250));
      expect(recibidos).toHaveLength(1);

      const st = backplaneStatus();
      expect(st.mode).toBe("postgres");
      expect(st.notified).toBeGreaterThanOrEqual(1);
      expect(st.received).toBeGreaterThanOrEqual(1);
      baja();
    });

    it("payload grande (>7900 bytes) viaja comprimido y llega íntegro", async () => {
      process.env.SSE_BACKPLANE = "postgres";
      const { publish: publishConBackplane } = await import(
        "@/server/conversations/events/bus"
      );

      const recibidos: SseEvent[] = [];
      const baja = subscribe("org_bp_c", (e) => recibidos.push(e));
      await vi.waitFor(
        () => expect(backplaneStatus().connected).toBe(true),
        { timeout: 5_000, interval: 50 }
      );

      const textoLargo = "x".repeat(12_000); // serializado supera el límite de pg_notify
      publishConBackplane("org_bp_c", {
        type: "message.new",
        data: { conversationId: "cv_bp_c", message: { id: "m_gz", texto: textoLargo } },
      });

      await vi.waitFor(
        () => expect(recibidos).toHaveLength(1),
        { timeout: 5_000, interval: 50 }
      );
      const evGz = recibidos[0]!;
      expect(
        (evGz.data as { message: { texto: string } }).message.texto.length
      ).toBe(12_000);
      baja();
    });

    it("el canal de la org filtra: un evento de otra org no cruza", async () => {
      process.env.SSE_BACKPLANE = "postgres";
      const { publish: publishConBackplane } = await import(
        "@/server/conversations/events/bus"
      );

      const recibidosA: SseEvent[] = [];
      const bajaA = subscribe("org_bp_d_a", (e) => recibidosA.push(e));
      await vi.waitFor(
        () => expect(backplaneStatus().connected).toBe(true),
        { timeout: 5_000, interval: 50 }
      );

      publishConBackplane("org_bp_d_b", {
        type: "note.new",
        data: { conversationId: "cv_bp_d", note: { id: "n2" } },
      });
      await new Promise((r) => setTimeout(r, 400));
      expect(recibidosA).toHaveLength(0);
      bajaA();
    });
  }
);
