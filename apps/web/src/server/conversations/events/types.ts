/**
 * Contrato de eventos SSE de la bandeja (contrato sse.md).
 * Vive aparte del bus para que el backplane (F5) y el bus compartan el tipo
 * SIN ciclo de import: bus -> types, backplane -> types.
 */

export type SseEvent =
  | { type: "message.new"; data: { conversationId: string; message: unknown } }
  | {
      type: "message.status";
      data: {
        conversationId: string;
        messageId: string;
        status: string;
        /** Motivo del fallo, presente solo cuando status = "failed". */
        error?: string | null;
      };
    }
  /**
   * 044 — El adjunto de un mensaje terminó de descargarse (o falló): sin
   * esto la burbuja se quedaba en «descargando…» hasta recargar.
   */
  | {
      type: "message.media";
      data: { conversationId: string; messageId: string; media: unknown };
    }
  /** 074 — Un mensaje se editó (texto o pie): se pinta el nuevo y la marca. */
  | {
      type: "message.updated";
      data: {
        conversationId: string;
        messageId: string;
        text: string | null;
        /** Pie nuevo si lo editado fue el de un adjunto; si no, null. */
        caption: string | null;
        editedAt: string;
        originalText: string | null;
      };
    }
  | { type: "conversation.updated"; data: { conversation: unknown } }
  /** 026 — alguien del equipo eliminó la conversación: se quita de la bandeja. */
  | {
      type: "conversation.deleted";
      data: { conversationId: string; contactId: string; contactDeleted: boolean };
    }
  /** 050 — una nota interna nueva o borrada: el hilo abierto la pinta o la quita. */
  | { type: "note.new"; data: { conversationId: string; note: unknown } }
  /** 072 — Cambiaron las reacciones de un mensaje (del cliente o del equipo). */
  | {
      type: "reaction.updated";
      data: { conversationId: string; messageId: string; reactions: unknown };
    }
  | { type: "note.deleted"; data: { conversationId: string; noteId: string } }
  /** 015 — algo cambió en la agenda: la pantalla de Citas se refresca sola. */
  | { type: "booking.updated"; data: { bookingId: string } }
  | {
      type: "lab.run";
      data: {
        runId: string;
        status: string;
        progress: { done: number; total: number };
        score?: number | null;
      };
    };
